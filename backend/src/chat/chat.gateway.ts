import { HttpException, Logger } from '@nestjs/common';
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
import {
  WsMessageLimiter,
  WsRateLimiter,
  getSocketIp,
  verifyWsToken,
} from '../common/ws-auth';
import { FRONTEND_ORIGIN } from '../config/frontend-origin';
import { SocialGateway } from '../social/social.gateway';

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

/** Ceiling on ALL events from one socket per minute. Sized well above real
 *  use (the client already throttles typing to one per 2s) — this is a flood
 *  stop, not a business rule. */
const EVENTS_PER_MIN = 120;
/** Messages actually persisted, per socket per minute. Matches the limit
 *  ThrottlerGuard puts on `POST /chat/:login`, so the socket is no longer a
 *  way around the REST cap. */
const SENDS_PER_MIN = 30;

@WebSocketGateway({
  namespace: 'chat',
  cors: {
    origin: FRONTEND_ORIGIN,
    credentials: true,
  },
  maxHttpBufferSize: 1e5, // M1: 100KB (chat messages can be longer)
  transports: ['websocket'], // M2
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  private readonly server: Namespace;

  /** socketId → idle timer, restarted whenever that socket shows activity. */
  private readonly idleTimers = new Map<string, NodeJS.Timeout>();

  /** Per-socket flood stops: one for every event, one just for sends. */
  private readonly events = new WsMessageLimiter(EVENTS_PER_MIN);
  private readonly sends = new WsMessageLimiter(SENDS_PER_MIN);

  constructor(
    private readonly jwt: JwtService,
    private readonly chat: ChatService,
    private readonly presence: PresenceService,
    private readonly rateLimiter: WsRateLimiter,
    private readonly social: SocialGateway,
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

    // Join a room named after the user, so "every tab this user has open" is
    // addressable as `to(userId)` instead of scanning the whole namespace.
    await client.join(userId);

    this.logger.log(
      `client ${client.id} (login=${payload.login}, ip=${ip}) connected to chat`,
    );

    // Register in PresenceService.
    const cameOnline = this.presence.connect(userId, client.id);
    this.startIdleTimer(client.id);

    // Presence goes out on /social, never from here — see the note on
    // SocialGateway.broadcastPresence.
    if (cameOnline) await this.social.broadcastPresence(userId, true);
  }

  handleDisconnect(client: Socket): void {
    // Unconditional, before the early return below: the rate-limit windows
    // are keyed by socket id and nothing else ever removes them.
    this.events.forget(client.id);
    this.sends.forget(client.id);

    const userId = (client.data as { userId?: string }).userId;
    const ip = (client.data as { ip?: string }).ip;
    if (!userId) return;

    // C2: release the connection slot.
    if (ip) this.rateLimiter.release('chat', ip);

    // Clear this socket's idle timer.
    this.clearIdleTimer(client.id);

    // Unregister from PresenceService. Only the last socket going away means
    // the user is actually offline.
    if (this.presence.disconnect(userId, client.id)) {
      this.logger.log(`user ${userId} went offline`);
      void this.social.broadcastPresence(userId, false);
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
    if (
      !this.events.tryConsume(client.id) ||
      !this.sends.tryConsume(client.id)
    ) {
      return { ok: false, reason: 'rate limited — slow down' };
    }

    if (!payload?.receiverLogin || !payload?.content) {
      return {
        ok: false,
        reason: 'payload must be { receiverLogin, content }',
      };
    }
    if (
      typeof payload.content !== 'string' ||
      payload.content.length === 0 ||
      payload.content.length > 1000
    ) {
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

      // Deliver to every tab of the receiver, and to the sender's OTHER tabs
      // — `broadcast` is what excludes the sending socket, which already has
      // the message through the ack below.
      const receiverId = await this.chat.getUserIdByLogin(
        payload.receiverLogin,
      );
      if (receiverId) {
        this.server.to(receiverId).emit('chat:message', message);
      }
      client.broadcast.to(senderId).emit('chat:message', message);

      return { ok: true, message };
    } catch (err) {
      return this.failure('chat:send', err, 'could not send message');
    }
  }

  @SubscribeMessage('chat:typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { receiverLogin?: string } | undefined,
  ): Promise<MoveAck> {
    const senderId = (client.data as { userId?: string }).userId;
    if (!senderId) return { ok: false, reason: 'not authenticated' };
    if (!this.events.tryConsume(client.id)) {
      return { ok: false, reason: 'rate limited — slow down' };
    }
    if (!payload?.receiverLogin) {
      return { ok: false, reason: 'payload must be { receiverLogin }' };
    }

    this.restartIdleTimer(client.id);

    // Friends only — strangers must not receive typing indicators. The
    // context also carries our current login fresh from the DB, so the
    // event stays correct after a login rename.
    const ctx = await this.chat.getPeerContext(senderId, payload.receiverLogin);
    if (!ctx) return { ok: false, reason: 'you can only message your friends' };

    this.server
      .to(ctx.peerId)
      .emit('chat:typing', { senderLogin: ctx.myLogin });
    return { ok: true };
  }

  @SubscribeMessage('chat:read')
  async handleRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { senderLogin?: string } | undefined,
  ): Promise<MoveAck | { ok: true; marked: number }> {
    const userId = (client.data as { userId?: string }).userId;
    if (!userId) return { ok: false, reason: 'not authenticated' };
    if (!this.events.tryConsume(client.id)) {
      return { ok: false, reason: 'rate limited — slow down' };
    }
    if (!payload?.senderLogin) {
      return { ok: false, reason: 'payload must be { senderLogin }' };
    }

    this.restartIdleTimer(client.id);

    // Friends only, same as typing — and myLogin is DB-fresh.
    const ctx = await this.chat.getPeerContext(userId, payload.senderLogin);
    if (!ctx) return { ok: false, reason: 'you can only message your friends' };

    const result = await this.chat.markAsRead(userId, payload.senderLogin);

    // Notify every tab of the sender that their messages were read.
    this.server
      .to(ctx.peerId)
      .emit('chat:read-receipt', { readerLogin: ctx.myLogin });

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
    if (!this.events.tryConsume(client.id)) {
      return { ok: false, reason: 'rate limited — slow down' };
    }
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
      return this.failure('chat:history', err, 'could not load history');
    }
  }

  // ----- internals --------------------------------------------------------

  /**
   * Turn a thrown error into an ack.
   *
   * A service's own refusal (ForbiddenException — "you can only message your
   * friends") is written for the client and passes through. Anything else is
   * an internal fault, and returning `err.message` for those piped Prisma
   * error text straight out over the socket; log it and answer generically.
   */
  private failure(
    event: string,
    err: unknown,
    fallback: string,
  ): { ok: false; reason: string } {
    if (err instanceof HttpException) {
      return { ok: false, reason: err.message };
    }
    this.logger.error(
      `${event} failed`,
      err instanceof Error ? err.stack : String(err),
    );
    return { ok: false, reason: fallback };
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
