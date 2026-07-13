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
import { LobbiesService } from '../lobbies/lobbies.service';
import { PrismaService } from '../prisma/prisma.service';

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
 *   'game:joined'   { player, board: GameSnapshot }
 *   'game:start'    { players: [{ player, login }, { player, login }] }
 *   'game:update'   { player, mark, boardIdx, cellIdx, miniWinner?, nextBoard, outerWinner? }
 *   'game:presence' { player, connected } — a seated player dropped mid-game
 *                   (or came back); the game itself keeps running.
 *   'game:over'     { winner, reason: 'boards' | 'draw' }
 *   'game:error'    { reason } — 'unauthorized' | 'rate_limited' | 'invalid_lobby'
 *                   | 'lobby_full' | 'timeout' | 'superseded' | ...
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
  /** userIds[i] is player i+1's user id — the stable seat key, so a
   *  reconnect (refresh, dev remount, newer tab) reclaims the seat instead
   *  of sitting the same user down as their own opponent. */
  userIds: (string | null)[];
  /** logins[i] is player i+1's public login, for opponent display. */
  logins: (string | null)[];
  engine: SuperTttEngine;
  status: 'waiting' | 'playing' | 'over';
  /** C3: ready timer (during 'waiting') + inactivity timer (during 'playing'). */
  readyTimer: NodeJS.Timeout | null;
  inactivityTimer: NodeJS.Timeout | null;
  /** Runs while BOTH players are disconnected mid-game; destroys the room
   *  unless one of them makes it back within the grace window. */
  emptyTimer: NodeJS.Timeout | null;
}

/** Ready timeout: if player 2 doesn't arrive in 120s, disconnect player 1. */
const READY_TIMEOUT_MS = 120_000;
/** Inactivity timeout: if no move in 60s during playing, disconnect both. */
const INACTIVITY_TIMEOUT_MS = 60_000;
/** How long a mid-game room survives with both players disconnected —
 *  long enough for a refresh (or both refreshing at once) to come back. */
const EMPTY_GRACE_MS = 30_000;
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
    private readonly lobbies: LobbiesService,
    private readonly prisma: PrismaService,
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
      // Only a real lobby row may open a new room — otherwise any made-up
      // code pasted into the game URL would fabricate a playable room.
      // Live rooms above skip this so resumes survive row cleanup.
      if (!(await this.lobbies.existsForGame(code, 'super-tic-tac-toe'))) {
        this.logger.warn(`rejecting ${client.id}: no lobby for code ${code}`);
        client.emit('game:error', { reason: 'invalid_lobby' });
        client.disconnect(true);
        return;
      }
      room = this.createRoom();
      this.rooms.set(code, room);
    }

    // Same user again (refresh, dev remount, newer tab): reclaim the seat
    // and kick the stale socket, instead of seating them as their own
    // opponent or bouncing them off their own full room.
    const ownSeat = room.userIds.indexOf(payload.sub);
    if (ownSeat !== -1) {
      const staleId = room.seats[ownSeat];
      room.seats[ownSeat] = client.id;
      room.logins[ownSeat] = payload.login;
      client.data.room = code;
      await client.join(code);
      this.clearEmptyTimer(room);
      client.emit('game:joined', this.joinedEvent(room, ownSeat));
      if (room.status === 'playing') {
        // Re-announce the running game so the rejoining client resumes
        // (the joined snapshot already carries the full board).
        client.emit('game:start', this.startEvent(room));
        // ...and tell them if the opponent is offline right now.
        if (room.userIds[1 - ownSeat] && room.seats[1 - ownSeat] === null) {
          client.emit('game:presence', {
            player: (2 - ownSeat) as PlayerIndex,
            connected: false,
          });
        }
      }
      if (staleId && staleId !== client.id) {
        // One live seat per account: the newest window wins, and the old one
        // is told why it went dark instead of hanging on a dead socket.
        const stale = this.server.sockets.get(staleId);
        stale?.emit('game:error', { reason: 'superseded' });
        stale?.disconnect(true);
      } else if (room.status === 'playing') {
        // Coming back from a real disconnect — clear the opponent's
        // "opponent disconnected" indicator.
        const opponent = room.seats[1 - ownSeat];
        if (opponent) {
          this.server.to(opponent).emit('game:presence', {
            player: (ownSeat + 1) as PlayerIndex,
            connected: true,
          });
        }
      }
      this.logger.log(
        `client ${client.id} (login=${payload.login}) reclaimed seat ${ownSeat + 1} in room ${code}`,
      );
      return;
    }

    // A seat is only free if no user holds it — a disconnected mid-game
    // player keeps their seat (userIds entry) until the room dies.
    const seat = room.seats.findIndex(
      (s, i) => s === null && room.userIds[i] === null,
    );
    if (seat === -1) {
      this.logger.warn(`rejecting ${client.id}: room ${code} is full`);
      client.emit('game:error', { reason: 'lobby_full' });
      client.disconnect(true);
      return;
    }

    room.seats[seat] = client.id;
    room.userIds[seat] = payload.sub;
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
      this.server.to(code).emit('game:start', this.startEvent(room));
      this.logger.log(`room ${code}: both players connected, game started`);
      // Hide the lobby from the browser now that its game is running.
      void this.lobbies.markInProgress(code);
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

    if (room.status === 'playing') {
      // Mid-game drop: hold the seat (userIds entry stays) so the same
      // account can reconnect and resume; the survivor keeps playing and
      // just gets a presence indicator.
      room.seats[seat] = null;
      if (survivor === null) {
        // Both players gone — give refreshes a grace window to come back
        // before the room and its lobby row are dropped.
        this.startEmptyTimer(code, room);
      } else {
        this.server.to(survivor).emit('game:presence', {
          player: (seat + 1) as PlayerIndex,
          connected: false,
        });
      }
      this.logger.log(
        `client ${client.id} dropped mid-game, seat ${seat + 1} held in room ${code}`,
      );
      return;
    }

    const survivorUserId = room.userIds[1 - seat];
    const survivorLogin = room.logins[1 - seat];
    this.clearReadyTimer(room);
    this.clearInactivityTimer(room);
    this.clearEmptyTimer(room);

    if (survivor === null) {
      // Last player out — the room dies with them, and so does its lobby row.
      this.rooms.delete(code);
      void this.lobbies.remove(code);
      this.logger.log(`client ${client.id} left, room ${code} removed`);
      return;
    }

    // Pre-game or post-game exit: whoever stayed becomes player 1 of a fresh
    // board in the same room; the frontend treats a repeated game:joined as
    // a full reset.
    room.seats = [survivor, null];
    room.userIds = [survivorUserId, null];
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
      void this.recordStats(room, overEvent.winner);
    }
    return { ok: true };
  }

  private async recordStats(room: Room, winner: PlayerIndex | null): Promise<void> {
    const p1Id = room.userIds[0];
    const p2Id = room.userIds[1];
    if (!p1Id || !p2Id) return;

    const game = 'super-tic-tac-toe';
    try {
      await Promise.all([
        this.prisma.gameResult.create({
          data: {
            userId: p1Id,
            game,
            result: winner === 1 ? 'win' : winner === null ? 'draw' : 'loss',
          },
        }),
        this.prisma.gameResult.create({
          data: {
            userId: p2Id,
            game,
            result: winner === 2 ? 'win' : winner === null ? 'draw' : 'loss',
          },
        }),
      ]);
      this.logger.log(`recorded stats for game ${game} between ${p1Id} and ${p2Id}`);
    } catch (err) {
      this.logger.error(`failed to record stats for game ${game}:`, err);
    }
  }

  // ----- room lookup ---------------------------------------------------------

  /**
   * Validate and normalize the lobby code from the connection handshake.
   *
   * Read from `handshake.auth` first: auth is per-socket, while `query` is a
   * manager-level option in socket.io-client — a client reusing a cached
   * manager (SPA navigation, a second namespace on the same origin) silently
   * keeps the FIRST connection's query, which would drop players into the
   * wrong room. The query fallback stays for hand-rolled clients.
   */
  private roomCodeOf(client: Socket): string | null {
    const raw =
      (client.handshake.auth as { lobby?: unknown } | undefined)?.lobby ??
      client.handshake.query.lobby;
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
      userIds: [null, null],
      logins: [null, null],
      engine: new SuperTttEngine(),
      status: 'waiting',
      readyTimer: null,
      inactivityTimer: null,
      emptyTimer: null,
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

  private startEmptyTimer(code: string, room: Room): void {
    this.clearEmptyTimer(room);
    room.emptyTimer = setTimeout(() => {
      this.logger.warn(
        `room ${code}: nobody came back within ${EMPTY_GRACE_MS / 1000}s — dropping`,
      );
      this.destroyRoom(code, room);
    }, EMPTY_GRACE_MS);
  }

  private clearEmptyTimer(room: Room): void {
    if (room.emptyTimer) {
      clearTimeout(room.emptyTimer);
      room.emptyTimer = null;
    }
  }

  /** Disconnect every seated client and drop the room (used by timeouts). */
  private destroyRoom(code: string, room: Room): void {
    this.clearReadyTimer(room);
    this.clearInactivityTimer(room);
    this.clearEmptyTimer(room);
    this.rooms.delete(code);
    void this.lobbies.remove(code);
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

  private startEvent(room: Room): {
    players: { player: PlayerIndex; login: string | null }[];
  } {
    return {
      players: room.logins.map((login, i) => ({
        player: (i + 1) as PlayerIndex,
        login,
      })),
    };
  }
}
