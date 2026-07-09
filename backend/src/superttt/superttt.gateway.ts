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
 * Security fixes applied (see backend/SECURITY_AUDIT.md):
 *   C1: JWT auth on connection — token verified from handshake.auth.token
 *       or handshake.query.token; connection rejected if invalid.
 *   C2: Per-IP connection cap (5) via WsRateLimiter.
 *   C3: Idle timeouts — 120s ready timeout during 'waiting', 60s
 *       inactivity timeout during 'playing'. On timeout: emit game:error,
 *       disconnect both players, reset lobby.
 *   M1: maxHttpBufferSize: 1e4 (10KB) — rejects oversized payloads.
 *   M2: transports: ['websocket'] — no polling attack surface.
 *
 * Client -> server (acked with MoveAck):
 *   'game:move' { boardIdx, cellIdx }
 *
 * Server -> client:
 *   'game:joined'  { player, board: GameSnapshot }
 *   'game:start'   { players: [1,2] }
 *   'game:update'  { player, mark, boardIdx, cellIdx, miniWinner?, nextBoard, outerWinner? }
 *   'game:over'    { winner, reason: 'boards' | 'draw' }
 *   'game:error'   { reason } — 'unauthorized' | 'rate_limited' | 'lobby_full' | 'timeout' | ...
 *
 * Connect from the frontend with:
 *   io('http://localhost:3001/super-tic-tac-toe', {
 *     auth: { token: '<JWT>' },
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

/** Ready timeout: if player 2 doesn't arrive in 120s, disconnect player 1. */
const READY_TIMEOUT_MS = 120_000;
/** Inactivity timeout: if no move in 60s during playing, disconnect both. */
const INACTIVITY_TIMEOUT_MS = 60_000;

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

  private seats: (string | null)[] = [null, null];
  private engine: SuperTttEngine = new SuperTttEngine();
  private status: 'waiting' | 'playing' | 'over' = 'waiting';

  /** C3: ready timer (during 'waiting') + inactivity timer (during 'playing'). */
  private readyTimer: NodeJS.Timeout | null = null;
  private inactivityTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly jwt: JwtService,
    private readonly rateLimiter: WsRateLimiter,
  ) {
    this.resetLobby();
  }

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
    if (!this.rateLimiter.tryAcquire(ip)) {
      client.emit('game:error', { reason: 'rate_limited' });
      client.disconnect(true);
      return;
    }
    client.data.ip = ip;

    const lobby = client.handshake.query.lobby ?? '(none)';
    this.logger.log(
      `client ${client.id} (login=${payload.login}, ip=${ip}) connected, lobby: ${String(lobby)}`,
    );

    const seat = this.seats.indexOf(null);
    if (seat === -1) {
      this.logger.warn(`rejecting ${client.id}: lobby full`);
      client.emit('game:error', { reason: 'lobby_full' });
      this.rateLimiter.release(ip);
      client.disconnect(true);
      return;
    }

    this.seats[seat] = client.id;
    client.emit('game:joined', this.joinedEvent(seat));
    this.logger.log(`client ${client.id} seated as player ${seat + 1}`);

    if (this.seats.every((s) => s !== null)) {
      // Both players present — start the game.
      this.status = 'playing';
      this.clearReadyTimer();
      this.startInactivityTimer();
      this.server.emit('game:start', { players: [1, 2] });
      this.logger.log('both players connected, game started');
    } else {
      // C3: first player — start the ready timeout.
      this.startReadyTimer();
    }
  }

  handleDisconnect(client: Socket): void {
    const seat = this.seats.indexOf(client.id);
    if (seat === -1) return;

    // C2: release the connection slot.
    const ip = (client.data as { ip?: string }).ip;
    if (ip) this.rateLimiter.release(ip);

    const survivor = this.seats[1 - seat];
    this.resetLobby();
    this.logger.log(`client ${client.id} left, lobby reset`);

    if (survivor !== null) {
      this.seats[0] = survivor;
      this.server.to(survivor).emit('game:joined', this.joinedEvent(0));
      this.startReadyTimer();
    }
  }

  @SubscribeMessage('game:move')
  handleMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: Partial<MovePayload> | undefined,
  ): MoveAck {
    const seat = this.seats.indexOf(client.id);
    if (seat === -1) {
      return { ok: false, reason: 'you are not in the game' };
    }
    if (this.status !== 'playing') {
      return {
        ok: false,
        reason:
          this.status === 'waiting'
            ? 'waiting for the second player'
            : 'game is already over',
      };
    }

    const player: PlayerIndex = (seat + 1) as PlayerIndex;
    const result: MoveResult = this.engine.applyMove(player, payload);
    if (!result.ok) {
      this.logger.debug(`rejected move from ${client.id}: ${result.reason}`);
      return result;
    }

    // C3: reset the inactivity timer on every valid move.
    this.restartInactivityTimer();

    const update: GameUpdateEvent = {
      player: result.player,
      mark: result.mark,
      boardIdx: result.boardIdx,
      cellIdx: result.cellIdx,
      miniWinner: result.miniWinner,
      nextBoard: result.nextBoard,
      outerWinner: result.outerWinner,
    };
    this.server.emit('game:update', update);

    if (result.outcome !== 'continue') {
      this.status = 'over';
      this.clearInactivityTimer();
      const overEvent: GameOverEvent =
        result.outcome === 'win'
          ? { winner: result.player, reason: 'boards' }
          : { winner: null, reason: 'draw' };
      this.server.emit('game:over', overEvent);
      this.logger.log(
        `game over: ${
          overEvent.winner ? `player ${overEvent.winner} wins` : 'draw'
        } (${overEvent.reason})`,
      );
    }
    return { ok: true };
  }

  // ----- C3: timer management ------------------------------------------------

  private startReadyTimer(): void {
    this.clearReadyTimer();
    this.readyTimer = setTimeout(() => {
      this.logger.warn('ready timeout (120s) — no second player, disconnecting');
      this.server.emit('game:error', { reason: 'timeout' });
      this.disconnectAll();
    }, READY_TIMEOUT_MS);
  }

  private clearReadyTimer(): void {
    if (this.readyTimer) {
      clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
  }

  private startInactivityTimer(): void {
    this.clearInactivityTimer();
    this.inactivityTimer = setTimeout(() => {
      this.logger.warn('inactivity timeout (60s) — no moves, disconnecting');
      this.server.emit('game:error', { reason: 'timeout' });
      this.disconnectAll();
    }, INACTIVITY_TIMEOUT_MS);
  }

  private restartInactivityTimer(): void {
    if (this.status === 'playing') {
      this.startInactivityTimer();
    }
  }

  private clearInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  /** Disconnect all seated clients (used by timeouts). */
  private disconnectAll(): void {
    this.clearReadyTimer();
    this.clearInactivityTimer();
    for (const seat of this.seats) {
      if (seat) {
        const s = this.server.sockets.get(seat);
        s?.disconnect(true);
      }
    }
    this.resetLobby();
  }

  // ----- lobby management ----------------------------------------------------

  private joinedEvent(seat: number): { player: PlayerIndex; board: GameSnapshot } {
    return {
      player: (seat + 1) as PlayerIndex,
      board: this.engine.snapshot(),
    };
  }

  private resetLobby(): void {
    this.clearReadyTimer();
    this.clearInactivityTimer();
    this.seats = [null, null];
    this.engine = new SuperTttEngine();
    this.status = 'waiting';
  }
}
