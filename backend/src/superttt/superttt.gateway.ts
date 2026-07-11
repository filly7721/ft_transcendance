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
import {
  GameSnapshot,
  MovePayload,
  MoveResult,
  PlayerIndex,
  SuperTttEngine,
} from './engine/superttt.engine';
import { WsRateLimiter, getSocketIp, verifyWsToken } from '../common/ws-auth';

/**
 * Super Tic-Tac-Toe WebSocket gateway.
 *
 * Game sessions are scoped to lobby rooms: the client passes its room code in
 * `handshake.query.lobby` (the "xxx-xxx-xxx" code from POST /lobbies), and
 * every room gets its own seats, engine and timers. Rooms are created lazily
 * on first connect and destroyed when the last player leaves.
 *
 * Security fixes applied (see backend/SECURITY_AUDIT.md):
 *   C1: JWT auth on connection — token verified from handshake.auth.token
 *       or handshake.query.token; connection rejected if invalid.
 *   C2: Per-IP connection cap (5) via WsRateLimiter.
 *   C3: Idle timeouts — 120s ready timeout during 'waiting', 60s
 *       inactivity timeout during 'playing'. On timeout: emit game:error,
 *       disconnect both players, drop the room.
 *   M1: maxHttpBufferSize: 1e4 (10KB) — rejects oversized payloads.
 *   M2: transports: ['websocket'] — no polling attack surface.
 *
 * Client -> server (acked with MoveAck):
 *   'game:move' { boardIdx, cellIdx }
 *
 * Server -> client:
 *   'game:joined'  { player, board: GameSnapshot }
 *   'game:start'   { players: [{ player, login }, { player, login }] }
 *   'game:update'  { player, mark, boardIdx, cellIdx, miniWinner?, nextBoard, outerWinner? }
 *   'game:over'    { winner, reason: 'boards' | 'draw' }
 *   'game:error'   { reason } — 'unauthorized' | 'rate_limited' | 'invalid_lobby'
 *                   | 'lobby_full' | 'timeout' | ...
 *
 * Connect from the frontend with:
 *   io('http://localhost:3001/super-tic-tac-toe', {
 *     auth: { token: '<JWT>' },
 *     query: { lobby: '<room code>' },
 *     transports: ['websocket'],
 *   })
 */
type MoveAck = { ok: true } | { ok: false; reason: string };

interface GameUpdateEvent {
  player: PlayerIndex;
  mark: 'X' | 'O';
  boardIdx: number;
  cellIdx: number;
  miniWinner?: 'X' | 'O';
  nextBoard: number | null;
  outerWinner?: 'X' | 'O';
}

interface GameOverEvent {
  winner: PlayerIndex | null;
  reason: 'boards' | 'draw';
}

/** One lobby room's live game session. */
interface Room {
  /** seats[i] is player i+1's socket id. */
  seats: (string | null)[];
  /** logins[i] is player i+1's public login, for opponent display. */
  logins: (string | null)[];
  engine: SuperTttEngine;
  status: 'waiting' | 'playing' | 'over';
  /** C3: ready timer (during 'waiting') + inactivity timer (during 'playing'). */
  readyTimer: NodeJS.Timeout | null;
  inactivityTimer: NodeJS.Timeout | null;
}

/** Ready timeout: if player 2 doesn't arrive in 120s, disconnect player 1. */
const READY_TIMEOUT_MS = 120_000;
/** Inactivity timeout: if no move in 60s during playing, disconnect both. */
const INACTIVITY_TIMEOUT_MS = 60_000;
/** Room codes come from user-controlled input, so bound their shape. */
const ROOM_CODE_RE = /^[a-zA-Z0-9-]{1,32}$/;

@WebSocketGateway({
  namespace: 'super-tic-tac-toe',
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
  maxHttpBufferSize: 1e4, // M1: 10KB — more than enough for { boardIdx, cellIdx }
  transports: ['websocket'], // M2: no polling
})
export class SuperTttGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(SuperTttGateway.name);

  @WebSocketServer()
  private readonly server: Namespace;

  /** Live game sessions keyed by lobby room code. */
  private readonly rooms = new Map<string, Room>();

  constructor(
    private readonly jwt: JwtService,
    private readonly rateLimiter: WsRateLimiter,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    // C1: verify JWT before doing anything else.
    const payload = await verifyWsToken(client, this.jwt);
    if (!payload) {
      this.logger.warn(`rejecting ${client.id}: unauthorized (no/invalid token)`);
      client.emit('game:error', { reason: 'unauthorized' });
      client.disconnect(true);
      return;
    }
    client.data.userId = payload.sub;
    client.data.login = payload.login;

    // C2: per-IP connection cap.
    const ip = getSocketIp(client);
    if (!this.rateLimiter.tryAcquire('super-tic-tac-toe', ip)) {
      client.emit('game:error', { reason: 'rate_limited' });
      client.disconnect(true);
      return;
    }
    client.data.ip = ip;

    // From here on the slot is released by handleDisconnect, which fires for
    // every accepted socket — including the ones we reject below.
    const code = this.roomCodeOf(client);
    if (!code) {
      this.logger.warn(`rejecting ${client.id}: missing/malformed lobby code`);
      client.emit('game:error', { reason: 'invalid_lobby' });
      client.disconnect(true);
      return;
    }

    let room = this.rooms.get(code);
    if (!room) {
      room = this.createRoom();
      this.rooms.set(code, room);
    }

    const seat = room.seats.indexOf(null);
    if (seat === -1) {
      this.logger.warn(`rejecting ${client.id}: room ${code} is full`);
      client.emit('game:error', { reason: 'lobby_full' });
      client.disconnect(true);
      return;
    }

    room.seats[seat] = client.id;
    room.logins[seat] = payload.login;
    client.data.room = code;
    await client.join(code);
    client.emit('game:joined', this.joinedEvent(room, seat));
    this.logger.log(
      `client ${client.id} (login=${payload.login}) seated as player ${seat + 1} in room ${code}`,
    );

    if (room.seats.every((s) => s !== null)) {
      // Both players present — start the game.
      room.status = 'playing';
      this.clearReadyTimer(room);
      this.startInactivityTimer(code, room);
      this.server.to(code).emit('game:start', {
        players: room.logins.map((login, i) => ({
          player: (i + 1) as PlayerIndex,
          login,
        })),
      });
      this.logger.log(`room ${code}: both players connected, game started`);
    } else {
      // C3: first player — start the ready timeout.
      this.startReadyTimer(code, room);
    }
  }

  handleDisconnect(client: Socket): void {
    // C2: release the connection slot. Unconditional — also covers sockets
    // rejected after tryAcquire and sockets kicked by destroyRoom, whose room
    // entry is already gone by the time this handler runs.
    const ip = (client.data as { ip?: string }).ip;
    if (ip) this.rateLimiter.release('super-tic-tac-toe', ip);

    const found = this.roomOf(client);
    if (!found) return;
    const { code, room, seat } = found;

    const survivor = room.seats[1 - seat];
    const survivorLogin = room.logins[1 - seat];
    this.clearReadyTimer(room);
    this.clearInactivityTimer(room);

    if (survivor === null) {
      // Last player out — the room dies with them.
      this.rooms.delete(code);
      this.logger.log(`client ${client.id} left, room ${code} removed`);
      return;
    }

    // Whoever stayed becomes player 1 of a fresh board in the same room; the
    // frontend treats a repeated game:joined as a full reset.
    room.seats = [survivor, null];
    room.logins = [survivorLogin, null];
    room.engine = new SuperTttEngine();
    room.status = 'waiting';
    this.server.to(survivor).emit('game:joined', this.joinedEvent(room, 0));
    this.startReadyTimer(code, room);
    this.logger.log(`client ${client.id} left, room ${code} reset for survivor`);
  }

  @SubscribeMessage('game:move')
  handleMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: Partial<MovePayload> | undefined,
  ): MoveAck {
    const found = this.roomOf(client);
    if (!found) {
      return { ok: false, reason: 'you are not in the game' };
    }
    const { code, room, seat } = found;
    if (room.status !== 'playing') {
      return {
        ok: false,
        reason:
          room.status === 'waiting'
            ? 'waiting for the second player'
            : 'game is already over',
      };
    }

    const player: PlayerIndex = (seat + 1) as PlayerIndex;
    const result: MoveResult = room.engine.applyMove(player, payload);
    if (!result.ok) {
      this.logger.debug(`rejected move from ${client.id}: ${result.reason}`);
      return result;
    }

    // C3: reset the inactivity timer on every valid move.
    this.startInactivityTimer(code, room);

    const update: GameUpdateEvent = {
      player: result.player,
      mark: result.mark,
      boardIdx: result.boardIdx,
      cellIdx: result.cellIdx,
      miniWinner: result.miniWinner,
      nextBoard: result.nextBoard,
      outerWinner: result.outerWinner,
    };
    this.server.to(code).emit('game:update', update);

    if (result.outcome !== 'continue') {
      room.status = 'over';
      this.clearInactivityTimer(room);
      const overEvent: GameOverEvent =
        result.outcome === 'win'
          ? { winner: result.player, reason: 'boards' }
          : { winner: null, reason: 'draw' };
      this.server.to(code).emit('game:over', overEvent);
      this.logger.log(
        `room ${code} game over: ${
          overEvent.winner ? `player ${overEvent.winner} wins` : 'draw'
        } (${overEvent.reason})`,
      );
    }
    return { ok: true };
  }

  // ----- room lookup ---------------------------------------------------------

  /** Validate and normalize the lobby code from the connection handshake. */
  private roomCodeOf(client: Socket): string | null {
    const raw = client.handshake.query.lobby;
    return typeof raw === 'string' && ROOM_CODE_RE.test(raw) ? raw : null;
  }

  /** Resolve a connected client back to its room and seat. */
  private roomOf(
    client: Socket,
  ): { code: string; room: Room; seat: number } | null {
    const code = (client.data as { room?: string }).room;
    if (!code) return null;
    const room = this.rooms.get(code);
    if (!room) return null;
    const seat = room.seats.indexOf(client.id);
    if (seat === -1) return null;
    return { code, room, seat };
  }

  private createRoom(): Room {
    return {
      seats: [null, null],
      logins: [null, null],
      engine: new SuperTttEngine(),
      status: 'waiting',
      readyTimer: null,
      inactivityTimer: null,
    };
  }

  // ----- C3: timer management ------------------------------------------------

  private startReadyTimer(code: string, room: Room): void {
    this.clearReadyTimer(room);
    room.readyTimer = setTimeout(() => {
      this.logger.warn(
        `room ${code}: ready timeout (120s) — no second player, disconnecting`,
      );
      this.server.to(code).emit('game:error', { reason: 'timeout' });
      this.destroyRoom(code, room);
    }, READY_TIMEOUT_MS);
  }

  private clearReadyTimer(room: Room): void {
    if (room.readyTimer) {
      clearTimeout(room.readyTimer);
      room.readyTimer = null;
    }
  }

  private startInactivityTimer(code: string, room: Room): void {
    this.clearInactivityTimer(room);
    room.inactivityTimer = setTimeout(() => {
      this.logger.warn(
        `room ${code}: inactivity timeout (60s) — no moves, disconnecting`,
      );
      this.server.to(code).emit('game:error', { reason: 'timeout' });
      this.destroyRoom(code, room);
    }, INACTIVITY_TIMEOUT_MS);
  }

  private clearInactivityTimer(room: Room): void {
    if (room.inactivityTimer) {
      clearTimeout(room.inactivityTimer);
      room.inactivityTimer = null;
    }
  }

  /** Disconnect every seated client and drop the room (used by timeouts). */
  private destroyRoom(code: string, room: Room): void {
    this.clearReadyTimer(room);
    this.clearInactivityTimer(room);
    this.rooms.delete(code);
    for (const id of room.seats) {
      if (id) this.server.sockets.get(id)?.disconnect(true);
    }
  }

  // ----- events ----------------------------------------------------------------

  private joinedEvent(
    room: Room,
    seat: number,
  ): { player: PlayerIndex; board: GameSnapshot } {
    return {
      player: (seat + 1) as PlayerIndex,
      board: room.engine.snapshot(),
    };
  }
}
