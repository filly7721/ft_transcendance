import { Logger } from '@nestjs/common';
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
  MoveOutcome,
  MovePayload,
  MoveResult,
  PlayerIndex,
  SuperTttEngine,
} from './engine/superttt.engine';

/**
 * The single Super Tic-Tac-Toe lobby. Two players (X vs O) play on a shared
 * authoritative engine; game rules live in SuperTttEngine.
 *
 * Client -> server (acked with MoveAck):
 *   'game:move' { boardIdx, cellIdx }
 *
 * Server -> client:
 *   'game:joined'  you were seated (also sent again if the lobby resets
 *                  because your opponent left — treat it as a full reset)
 *   'game:start'   both players present, moves accepted
 *   'game:update'  a move was applied (sent to BOTH players so each side
 *                  renders the same authoritative board)
 *   'game:over'    { winner, reason: 'boards' | 'draw' }
 *   'game:error'   { reason } — e.g. lobby full, connection refused
 *
 * Connect from the frontend with:
 *   io('http://localhost:3001/super-tic-tac-toe', { query: { lobby: 'ABC123' } })
 *
 * Player 1 = X (goes first), Player 2 = O.
 */
type MoveAck = { ok: true } | { ok: false; reason: string };

/** What we broadcast on `game:update` — a slimmed-down MoveResult. */
interface GameUpdateEvent {
  /** Who made the move (1 or 2). */
  player: PlayerIndex;
  /** The mark placed ('X' or 'O'). */
  mark: 'X' | 'O';
  /** Mini board the move was in (0-8). */
  boardIdx: number;
  /** Cell the move was in (0-8). */
  cellIdx: number;
  /** Present if this move won the mini board. */
  miniWinner?: 'X' | 'O';
  /** Mini board the next player must play in, or null for free choice. */
  nextBoard: number | null;
  /** Present if this move won the whole game. */
  outerWinner?: 'X' | 'O';
}

/** What we broadcast on `game:over`. */
interface GameOverEvent {
  /** 1 or 2 for a win, null for a draw. */
  winner: PlayerIndex | null;
  /** 'boards' = 3 mini boards in a row; 'draw' = board full, no winner. */
  reason: 'boards' | 'draw';
}

@WebSocketGateway({
  namespace: 'super-tic-tac-toe',
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class SuperTttGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(SuperTttGateway.name);

  @WebSocketServer()
  private readonly server: Namespace;

  /** seats[i] is player i+1's socket id. */
  private seats: (string | null)[] = [null, null];

  /** The single authoritative game engine (shared by both players). */
  private engine: SuperTttEngine = new SuperTttEngine();

  /** Current game status. */
  private status: 'waiting' | 'playing' | 'over' = 'waiting';

  constructor() {
    this.resetLobby();
  }

  handleConnection(client: Socket): void {
    const lobby = client.handshake.query.lobby ?? '(none)';
    this.logger.log(
      `client ${client.id} connected, lobby code: ${String(lobby)}`,
    );

    const seat = this.seats.indexOf(null);
    if (seat === -1) {
      this.logger.warn(`rejecting ${client.id}: lobby full`);
      client.emit('game:error', { reason: 'lobby_full' });
      client.disconnect(true);
      return;
    }

    this.seats[seat] = client.id;
    client.emit('game:joined', this.joinedEvent(seat));
    this.logger.log(`client ${client.id} seated as player ${seat + 1}`);

    if (this.seats.every((s) => s !== null)) {
      this.status = 'playing';
      this.server.emit('game:start', { players: [1, 2] });
      this.logger.log('both players connected, game started');
    }
  }

  handleDisconnect(client: Socket): void {
    const seat = this.seats.indexOf(client.id);
    if (seat === -1) return;

    const survivor = this.seats[1 - seat];
    this.resetLobby();
    this.logger.log(`client ${client.id} left, lobby reset`);

    // Whoever stayed becomes player 1 of the fresh lobby; the frontend
    // treats a repeated game:joined as a full reset.
    if (survivor !== null) {
      this.seats[0] = survivor;
      this.server.to(survivor).emit('game:joined', this.joinedEvent(0));
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
      this.logger.debug(
        `rejected move from ${client.id}: ${result.reason}`,
      );
      return result;
    }

    // Broadcast the move to BOTH players (shared board — no side-by-side
    // view like minesweeper; both render the same authoritative state).
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

  /** Build the `game:joined` event for a freshly seated player. */
  private joinedEvent(seat: number): { player: PlayerIndex; board: GameSnapshot } {
    return {
      player: (seat + 1) as PlayerIndex,
      board: this.engine.snapshot(),
    };
  }

  /** Reset the lobby to a fresh empty game. */
  private resetLobby(): void {
    this.seats = [null, null];
    this.engine = new SuperTttEngine();
    this.status = 'waiting';
  }
}
