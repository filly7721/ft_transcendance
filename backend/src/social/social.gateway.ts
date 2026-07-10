import { Logger, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { PresenceService } from '../presence/presence.service';
import { FriendsService } from '../friends/friends.service';
import { WsRateLimiter, getSocketIp, verifyWsToken } from '../common/ws-auth';

/**
 * Social WebSocket gateway — handles real-time social notifications:
 *   - Presence: broadcasts presence:update to friends when a user comes online/offline
 *   - Friend requests: broadcasts friends:request when a new request arrives
 *   - Friend accept: broadcasts friends:accept when a request is accepted
 *
 * Namespace: /social
 *
 * Connect from the frontend with:
 *   io('http://localhost:3001/social', { auth: { token: '<JWT>' }, transports: ['websocket'] })
 *
 * The frontend listens for:
 *   presence:update    { userId, online } — a friend came online/offline
 *   friends:request     { from: { login, displayName, avatarUrl } } — new friend request received
 *   friends:accept      { login } — your friend request was accepted
 *
 * The frontend can also request the current state:
 *   social:state → ack with { onlineFriends: string[], pendingRequests: number }
 *
 * This gateway shares the PresenceService with the chat gateway (both @Global),
 * so connecting to either /chat or /social registers the user as online.
 */
type MoveAck = { ok: true } | { ok: false; reason: string };

@WebSocketGateway({
  namespace: 'social',
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
  maxHttpBufferSize: 1e4,
  transports: ['websocket'],
})
export class SocialGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(SocialGateway.name);

  @WebSocketServer()
  private readonly server: Namespace;

  constructor(
    private readonly jwt: JwtService,
    private readonly presence: PresenceService,
    @Inject(forwardRef(() => FriendsService))
    private readonly friends: FriendsService,
    private readonly rateLimiter: WsRateLimiter,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    // C1: verify JWT
    const payload = await verifyWsToken(client, this.jwt);
    if (!payload) {
      client.emit('social:error', { reason: 'unauthorized' });
      client.disconnect(true);
      return;
    }
    const userId = payload.sub;
    client.data.userId = userId;
    client.data.login = payload.login;

    // C2: per-IP connection cap
    const ip = getSocketIp(client);
    if (!this.rateLimiter.tryAcquire(ip)) {
      client.emit('social:error', { reason: 'rate_limited' });
      client.disconnect(true);
      return;
    }
    client.data.ip = ip;

    // Register in PresenceService (shared with chat gateway)
    this.presence.connect(userId, client.id);
    this.logger.log(`user ${payload.login} connected to social`);

    // Broadcast presence:update to online friends
    await this.broadcastPresence(userId, true);
  }

  handleDisconnect(client: Socket): void {
    const userId = (client.data as { userId?: string }).userId;
    const ip = (client.data as { ip?: string }).ip;
    if (!userId) return;
    if (ip) this.rateLimiter.release(ip);

    const wasOnline = this.presence.isOnline(userId);
    this.presence.disconnect(userId, client.id);
    const isStillOnline = this.presence.isOnline(userId);

    // Only broadcast offline if this was the last connection
    if (wasOnline && !isStillOnline) {
      this.logger.log(`user ${userId} went offline`);
      void this.broadcastPresence(userId, false);
    }
  }

  /**
   * Client requests current state: online friends + pending request count.
   * Useful on initial connect to sync without a REST call.
   */
  @SubscribeMessage('social:state')
  async handleState(
    @ConnectedSocket() client: Socket,
  ): Promise<{ ok: true; data: { onlineFriends: string[]; pendingRequests: number } } | MoveAck> {
    const userId = (client.data as { userId?: string }).userId;
    if (!userId) return { ok: false, reason: 'not authenticated' };

    const [friendList, requests] = await Promise.all([
      this.friends.listFriends(userId),
      this.friends.listRequests(userId),
    ]);

    return {
      ok: true,
      data: {
        onlineFriends: friendList.filter((f) => f.online).map((f) => f.login),
        pendingRequests: requests.incoming.length,
      },
    };
  }

  /**
   * Notify a user that they received a new friend request.
   * Called by FriendsService when a request is created.
   */
  async notifyFriendRequest(addresseeId: string, fromLogin: string, fromDisplayName: string, fromAvatarUrl: string | null): Promise<void> {
    const sockets = await this.server.fetchSockets();
    for (const s of sockets) {
      const data = s.data as { userId?: string };
      if (data.userId === addresseeId) {
        this.server.to(s.id).emit('friends:request', {
          from: { login: fromLogin, displayName: fromDisplayName, avatarUrl: fromAvatarUrl },
        });
      }
    }
  }

  /**
   * Notify a user that their friend request was accepted.
   * Called by FriendsService when a request is accepted.
   */
  async notifyFriendAccept(requesterId: string, acceptorLogin: string): Promise<void> {
    const sockets = await this.server.fetchSockets();
    for (const s of sockets) {
      const data = s.data as { userId?: string };
      if (data.userId === requesterId) {
        this.server.to(s.id).emit('friends:accept', { login: acceptorLogin });
      }
    }
  }

  /**
   * Broadcast presence:update to all online friends of the user.
   */
  private async broadcastPresence(userId: string, online: boolean): Promise<void> {
    const friendIds = await this.friends.getFriendIds(userId);
    if (friendIds.length === 0) return;

    const sockets = await this.server.fetchSockets();
    for (const s of sockets) {
      const data = s.data as { userId?: string };
      if (data.userId && friendIds.includes(data.userId)) {
        this.server.to(s.id).emit('presence:update', { userId, online });
      }
    }
  }
}
