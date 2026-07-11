import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { PresenceService } from '../presence/presence.service';
import { WsRateLimiter, getSocketIp, verifyWsToken } from '../common/ws-auth';

/**
 * Chat WebSocket gateway.
 *
 * Namespace: `/chat`
 *
 * Security (from the audit):
 *   C1: JWT auth on connection — token verified from handshake.auth.token.
 *   C2: Per-IP connection cap (5) via WsRateLimiter.
 *   C3: 30-min idle timeout (chat is less time-sensitive than games).
 *   M1: maxHttpBufferSize: 1e5 (100KB — chat messages can be longer).
 *   M2: transports: ['websocket'] only.
 *
 * Client -> server:
 *   'chat:send'     { receiverLogin, content }    -> ack with MessageResponse
 *   'chat:typing'   { receiverLogin }              -> no ack (ephemeral)
 *   'chat:read'     { senderLogin }                -> ack with { marked }
 *   'chat:history'  { peerLogin, cursor? }         -> ack with HistoryResponse
 *
 * Server -> client:
 *   'chat:message'         { id, senderLogin, receiverLogin, content, readAt, createdAt }
 *   'chat:typing'          { senderLogin }              — someone is typing
 *   'chat:read-receipt'    { readerLogin }              — your messages were read
 *   'presence:update'      { userId, online }           — a friend came online/offline
 *   'chat:error'           { reason }
 *
 * Connect from the frontend with:
 *   io('http://localhost:3001/chat', {
 *     auth: { token: '<JWT>' },
 *     transports: ['websocket'],
 *   })
 *
 * On connect: registers in PresenceService, broadcasts presence:update to
 * online friends.
 * On disconnect: unregisters from PresenceService, broadcasts presence:update
 * to online friends (if this was their last connection).
 */
type MoveAck = { ok: true } | { ok: false; reason: string };

/** 30-minute idle timeout — chat is less time-sensitive than games. */
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

@WebSocketGateway({
  namespace: 'chat',
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
  maxHttpBufferSize: 1e5, // M1: 100KB (chat messages can be longer)
  transports: ['websocket'], // M2
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  private readonly server: Namespace;

  /** socketId → idle timer, restarted whenever that socket shows activity. */
  private readonly idleTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly jwt: JwtService,
    private readonly chat: ChatService,
    private readonly presence: PresenceService,
    private readonly rateLimiter: WsRateLimiter,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    // C1: verify JWT.
    const payload = await verifyWsToken(client, this.jwt);
    if (!payload) {
      this.logger.warn(`rejecting ${client.id}: unauthorized`);
      client.emit('chat:error', { reason: 'unauthorized' });
      client.disconnect(true);
      return;
    }
    // C2: per-IP connection cap. Checked before any client.data is set so
    // a rejected socket's handleDisconnect is a clean no-op (no slot to
    // release, no presence to unregister).
    const ip = getSocketIp(client);
    if (!this.rateLimiter.tryAcquire('chat', ip)) {
      client.emit('chat:error', { reason: 'rate_limited' });
      client.disconnect(true);
      return;
    }

    const userId = payload.sub;
    client.data.userId = userId;
    client.data.ip = ip;

    this.logger.log(
      `client ${client.id} (login=${payload.login}, ip=${ip}) connected to chat`,
    );

    // Register in PresenceService.
    this.presence.connect(userId, client.id);
    this.startIdleTimer(client.id);

    // Broadcast presence:update to online friends.
    await this.broadcastPresence(userId, true);
  }

  handleDisconnect(client: Socket): void {
    const userId = (client.data as { userId?: string }).userId;
    const ip = (client.data as { ip?: string }).ip;
    if (!userId) return;

    // C2: release the connection slot.
    if (ip) this.rateLimiter.release('chat', ip);

    // Clear this socket's idle timer.
    this.clearIdleTimer(client.id);

    // Unregister from PresenceService.
    const wasOnline = this.presence.isOnline(userId);
    this.presence.disconnect(userId, client.id);
    const isStillOnline = this.presence.isOnline(userId);

    // Only broadcast presence:update if the user went from online to offline.
    if (wasOnline && !isStillOnline) {
      this.logger.log(`user ${userId} went offline`);
      void this.broadcastPresence(userId, false);
    }

    this.logger.log(`client ${client.id} disconnected from chat`);
  }

  @SubscribeMessage('chat:send')
  async handleSend(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { receiverLogin?: string; content?: string } | undefined,
  ): Promise<MoveAck | { ok: true; message: unknown }> {
    const senderId = (client.data as { userId?: string }).userId;
    if (!senderId) return { ok: false, reason: 'not authenticated' };

    if (!payload?.receiverLogin || !payload?.content) {
      return { ok: false, reason: 'payload must be { receiverLogin, content }' };
    }
    if (typeof payload.content !== 'string' || payload.content.length === 0 || payload.content.length > 1000) {
      return { ok: false, reason: 'content must be 1-1000 chars' };
    }

    // Reset idle timer on activity.
    this.restartIdleTimer(client.id);

    try {
      const message = await this.chat.sendDirectMessage(
        senderId,
        payload.receiverLogin,
        payload.content,
      );

      // Deliver to every socket of the receiver (all their tabs) and to
      // the sender's other tabs; the sending socket gets it via the ack.
      const receiverId = await this.chat.getUserIdByLogin(payload.receiverLogin);
      if (receiverId) {
        for (const id of await this.findSocketsByUserId(receiverId)) {
          this.server.to(id).emit('chat:message', message);
        }
      }
      for (const id of await this.findSocketsByUserId(senderId)) {
        if (id !== client.id) this.server.to(id).emit('chat:message', message);
      }

      return { ok: true, message };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown error';
      return { ok: false, reason };
    }
  }

  @SubscribeMessage('chat:typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { receiverLogin?: string } | undefined,
  ): Promise<MoveAck> {
    const senderId = (client.data as { userId?: string }).userId;
    if (!senderId) return { ok: false, reason: 'not authenticated' };
    if (!payload?.receiverLogin) {
      return { ok: false, reason: 'payload must be { receiverLogin }' };
    }

    this.restartIdleTimer(client.id);

    // Friends only — strangers must not receive typing indicators. The
    // context also carries our current login fresh from the DB, so the
    // event stays correct after a login rename.
    const ctx = await this.chat.getPeerContext(senderId, payload.receiverLogin);
    if (!ctx) return { ok: false, reason: 'you can only message your friends' };

    for (const id of await this.findSocketsByUserId(ctx.peerId)) {
      this.server.to(id).emit('chat:typing', { senderLogin: ctx.myLogin });
    }
    return { ok: true };
  }

  @SubscribeMessage('chat:read')
  async handleRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { senderLogin?: string } | undefined,
  ): Promise<MoveAck | { ok: true; marked: number }> {
    const userId = (client.data as { userId?: string }).userId;
    if (!userId) return { ok: false, reason: 'not authenticated' };
    if (!payload?.senderLogin) {
      return { ok: false, reason: 'payload must be { senderLogin }' };
    }

    this.restartIdleTimer(client.id);

    // Friends only, same as typing — and myLogin is DB-fresh.
    const ctx = await this.chat.getPeerContext(userId, payload.senderLogin);
    if (!ctx) return { ok: false, reason: 'you can only message your friends' };

    const result = await this.chat.markAsRead(userId, payload.senderLogin);

    // Notify every tab of the sender that their messages were read.
    for (const id of await this.findSocketsByUserId(ctx.peerId)) {
      this.server.to(id).emit('chat:read-receipt', { readerLogin: ctx.myLogin });
    }

    return { ok: true, marked: result.marked };
  }

  @SubscribeMessage('chat:history')
  async handleHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { peerLogin?: string; cursor?: number | null } | undefined,
  ): Promise<MoveAck | { ok: true; data: unknown }> {
    const userId = (client.data as { userId?: string }).userId;
    if (!userId) return { ok: false, reason: 'not authenticated' };
    if (!payload?.peerLogin) {
      return { ok: false, reason: 'payload must be { peerLogin, cursor? }' };
    }

    this.restartIdleTimer(client.id);

    try {
      const history = await this.chat.getHistory(
        userId,
        payload.peerLogin,
        payload.cursor ?? null,
      );
      return { ok: true, data: history };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown error';
      return { ok: false, reason };
    }
  }

  // ----- internals --------------------------------------------------------

  /**
   * Find ALL socket IDs belonging to a user (they may have several tabs).
   * Routing is by user ID, never by login: the login in a socket's JWT
   * goes stale when the user renames themselves, the ID never does.
   *
   * Iterates all connected sockets in the namespace. O(n) but n is small
   * (connected users).
   */
  private async findSocketsByUserId(userId: string): Promise<string[]> {
    const sockets = await this.server.fetchSockets();
    const ids: string[] = [];
    for (const s of sockets) {
      const data = s.data as { userId?: string };
      if (data.userId === userId) ids.push(s.id);
    }
    return ids;
  }

  /**
   * Broadcast a presence:update event to all online friends of the user.
   *
   * @param userId The user whose presence changed.
   * @param online True if the user just came online, false if went offline.
   */
  private async broadcastPresence(userId: string, online: boolean): Promise<void> {
    const friendIds = await this.chat.getFriendIds(userId);
    if (friendIds.length === 0) return;

    // Find sockets belonging to online friends.
    const sockets = await this.server.fetchSockets();
    for (const s of sockets) {
      const data = s.data as { userId?: string };
      if (data.userId && friendIds.includes(data.userId)) {
        this.server.to(s.id).emit('presence:update', { userId, online });
      }
    }
  }

  // ----- C3: idle timer management ----------------------------------------

  private startIdleTimer(socketId: string): void {
    const timer = setTimeout(() => {
      this.logger.warn(`idle timeout (30min) for socket ${socketId}`);
      this.idleTimers.delete(socketId);
      const s = this.server.sockets.get(socketId);
      s?.emit('chat:error', { reason: 'timeout' });
      s?.disconnect(true);
    }, IDLE_TIMEOUT_MS);
    this.idleTimers.set(socketId, timer);
  }

  private clearIdleTimer(socketId: string): void {
    const timer = this.idleTimers.get(socketId);
    if (timer === undefined) return;
    clearTimeout(timer);
    this.idleTimers.delete(socketId);
  }

  private restartIdleTimer(socketId: string): void {
    this.clearIdleTimer(socketId);
    this.startIdleTimer(socketId);
  }
}
