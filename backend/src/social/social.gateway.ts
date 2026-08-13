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
import {
  FriendsService,
  type FriendRequestResponse,
  type FriendResponse,
} from '../friends/friends.service';
import { WsRateLimiter, getSocketIp, verifyWsToken } from '../common/ws-auth';
import { FRONTEND_ORIGIN } from '../config/frontend-origin';

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
 *   friends:request     { request: FriendRequestResponse } — new friend request received
 *   friends:accept      { friend: FriendResponse } — your friend request was accepted
 *
 * Both friends:* payloads carry the full row (not just a hint), so clients
 * apply them to local state directly instead of re-fetching over REST —
 * re-fetch-per-event was tripping the HTTP rate limiter (429s).
 *
 * The frontend can also request the current state:
 *   social:state → ack with { onlineFriendIds: string[], pendingRequests: number }
 *
 * This gateway shares the PresenceService with the chat gateway (both @Global),
 * so connecting to either /chat or /social registers the user as online.
 */
type MoveAck = { ok: true } | { ok: false; reason: string };

@WebSocketGateway({
  namespace: 'social',
  cors: {
    origin: FRONTEND_ORIGIN,
    credentials: true,
  },
  maxHttpBufferSize: 1e4,
  transports: ['websocket'],
})
export class SocialGateway implements OnGatewayConnection, OnGatewayDisconnect {
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
    // C2: per-IP connection cap — checked before any client.data is set so
    // a rejected socket's handleDisconnect is a clean no-op.
    const ip = getSocketIp(client);
    if (!this.rateLimiter.tryAcquire('social', ip)) {
      client.emit('social:error', { reason: 'rate_limited' });
      client.disconnect(true);
      return;
    }

    const userId = payload.sub;
    client.data.userId = userId;
    client.data.ip = ip;

    // Join a room named after the user. Every emit to this user then costs a
    // room lookup instead of a scan of every socket in the namespace, and
    // "all of this user's tabs" is expressed by the room itself.
    await client.join(userId);

    // Register in PresenceService (shared with chat gateway)
    const cameOnline = this.presence.connect(userId, client.id);
    this.logger.log(`user ${payload.login} connected to social`);

    if (cameOnline) await this.broadcastPresence(userId, true);
  }

  handleDisconnect(client: Socket): void {
    const userId = (client.data as { userId?: string }).userId;
    const ip = (client.data as { ip?: string }).ip;
    if (!userId) return;
    if (ip) this.rateLimiter.release('social', ip);

    if (this.presence.disconnect(userId, client.id)) {
      this.logger.log(`user ${userId} went offline`);
      void this.broadcastPresence(userId, false);
    }
  }

  /**
   * Client requests current state: online friends + pending request count.
   * Useful on initial connect to sync without a REST call.
   *
   * `onlineFriendIds` carries user IDs, matching what presence:update
   * events carry — the client keeps one Set and must never have to mix
   * logins and IDs in it.
   */
  @SubscribeMessage('social:state')
  async handleState(
    @ConnectedSocket() client: Socket,
  ): Promise<
    | { ok: true; data: { onlineFriendIds: string[]; pendingRequests: number } }
    | MoveAck
  > {
    const userId = (client.data as { userId?: string }).userId;
    if (!userId) return { ok: false, reason: 'not authenticated' };

    const [friendList, requests] = await Promise.all([
      this.friends.listFriends(userId),
      this.friends.listRequests(userId),
    ]);

    return {
      ok: true,
      data: {
        onlineFriendIds: friendList.filter((f) => f.online).map((f) => f.id),
        pendingRequests: requests.incoming.length,
      },
    };
  }

  /**
   * Notify a user that they received a new friend request.
   * Called by FriendsService when a request is created. The payload is the
   * same shape as a GET /friends/requests incoming entry — including the
   * request id the client needs for accept/reject — so the friends page can
   * append it locally without a REST re-fetch.
   */
  notifyFriendRequest(
    addresseeId: string,
    request: FriendRequestResponse,
  ): void {
    this.server.to(addresseeId).emit('friends:request', { request });
  }

  /**
   * Notify a requester that their outgoing request was turned down.
   *
   * Rejection deletes the row, so without this the request simply vanished
   * server-side while the sender's list kept showing it as pending until they
   * happened to reload. Only the id travels — the client just drops that entry.
   */
  notifyFriendReject(requesterId: string, requestId: number): void {
    this.server.to(requesterId).emit('friends:reject', { requestId });
  }

  /**
   * Notify a user that their friend request was accepted.
   * Called by FriendsService when a request is accepted. The payload is the
   * acceptor as a full GET /friends entry, so the client can insert them
   * into its friends list without a REST re-fetch.
   */
  notifyFriendAccept(requesterId: string, friend: FriendResponse): void {
    this.server.to(requesterId).emit('friends:accept', { friend });
  }

  /**
   * Broadcast presence:update to every friend of the user.
   *
   * Public because the chat gateway delegates here rather than emitting on its
   * own namespace: only /social clients listen for presence, so a second copy
   * on /chat was fanned out to nobody.
   *
   * `to()` takes the friend ids as rooms directly — offline friends simply
   * have no room, and socket.io de-duplicates a recipient that matches more
   * than one room. The guard matters: `to([])` addresses no room at all,
   * which is a broadcast to the entire namespace.
   */
  async broadcastPresence(userId: string, online: boolean): Promise<void> {
    const friendIds = await this.friends.getFriendIds(userId);
    if (friendIds.length === 0) return;
    this.server.to(friendIds).emit('presence:update', { userId, online });
  }

  /**
   * Notify a user's friends that their profile changed (login, displayName,
   * or avatar). Called by ProfileService.updateProfile after a successful
   * update. The frontend friends list re-fetches on this event so it shows
   * the new login/displayName without a manual page refresh.
   */
  async notifyProfileUpdate(userId: string): Promise<void> {
    const friendIds = await this.friends.getFriendIds(userId);
    if (friendIds.length === 0) return;
    this.server.to(friendIds).emit('profile:update', { userId });
  }
}
