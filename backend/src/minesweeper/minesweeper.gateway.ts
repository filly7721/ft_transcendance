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
import { MinesweeperEngine } from './engine/minesweeper.engine';
import { DEFAULT_MAP } from './engine/maps';

/**
 * The single minesweeper versus lobby. Two players race on identical copies
 * of the hardcoded map; game rules live in MinesweeperEngine.
 *
 * Client -> server (both acked with MoveAck):
 *   'game:reveal' { row, col }
 *   'game:flag'   { row, col }
 *
 * Server -> client:
 *   'game:joined'     you were seated (also sent again if the lobby resets
 *                     because your opponent left — treat it as a full reset)
 *   'game:start'      both players present, moves accepted
 *   'game:update'     changes to YOUR board
 *   'opponent:update' changes to the OPPONENT's board (side-by-side view)
 *   'game:over'       { winner, reason: 'mine' | 'cleared' }
 *   'game:error'      { reason } — e.g. lobby full, connection refused
 *
 * Connect from the frontend with:
 *   io('http://localhost:3001/minesweeper', { query: { lobby: 'ABC123' } })
 */

type PlayerIndex = 1 | 2;
type MoveAck = { ok: true } | { ok: false; reason: string };
type MovePayload = { row: number; col: number };

@WebSocketGateway({
  namespace: 'minesweeper',
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class MinesweeperGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MinesweeperGateway.name);

  @WebSocketServer()
  private readonly server: Namespace;

  /** seats[i] is player i+1's socket id; each seat gets its own engine. */
  private seats: (string | null)[] = [null, null];
  private engines: MinesweeperEngine[] = [];
  private status: 'waiting' | 'playing' | 'over' = 'waiting';

  constructor() {
    this.resetLobby();
  }

  handleConnection(client: Socket): void {
    // Lobby codes are logged but not used yet — there is only one lobby.
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

  @SubscribeMessage('game:reveal')
  handleReveal(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: Partial<MovePayload> | undefined,
  ): MoveAck {
    return this.applyMove(client, 'reveal', payload);
  }

  @SubscribeMessage('game:flag')
  handleFlag(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: Partial<MovePayload> | undefined,
  ): MoveAck {
    return this.applyMove(client, 'flag', payload);
  }

  private applyMove(
    client: Socket,
    kind: 'reveal' | 'flag',
    payload: Partial<MovePayload> | undefined,
  ): MoveAck {
    const seat = this.seats.indexOf(client.id);
    if (seat === -1) return { ok: false, reason: 'you are not in the game' };
    if (this.status !== 'playing') {
      return {
        ok: false,
        reason:
          this.status === 'waiting'
            ? 'waiting for the second player'
            : 'game is already over',
      };
    }
    const row = payload?.row;
    const col = payload?.col;
    if (typeof row !== 'number' || typeof col !== 'number') {
      return { ok: false, reason: 'payload must be { row, col }' };
    }

    const engine = this.engines[seat];
    const result =
      kind === 'reveal' ? engine.reveal(row, col) : engine.toggleFlag(row, col);
    if (!result.ok) {
      this.logger.debug(
        `rejected ${kind} (${row}, ${col}) from ${client.id}: ${result.reason}`,
      );
      return result;
    }

    // Your own board changes come back on 'game:update'; the same changes go
    // to the opponent as 'opponent:update' to feed the side-by-side view.
    const update = {
      player: (seat + 1) as PlayerIndex,
      changes: result.changes,
      outcome: result.outcome,
    };
    client.emit('game:update', update);
    this.server.to(this.seats[1 - seat]!).emit('opponent:update', update);

    if (result.outcome !== 'continue') {
      this.status = 'over';
      const winner = (
        result.outcome === 'win' ? seat + 1 : 2 - seat
      ) as PlayerIndex;
      const reason = result.outcome === 'win' ? 'cleared' : 'mine';
      this.server.emit('game:over', { winner, reason });
      this.logger.log(`game over: player ${winner} wins (${reason})`);
    }
    return { ok: true };
  }

  private joinedEvent(seat: number) {
    return {
      player: (seat + 1) as PlayerIndex,
      board: {
        rows: DEFAULT_MAP.rows,
        cols: DEFAULT_MAP.cols,
        mineCount: DEFAULT_MAP.mines.length,
      },
    };
  }

  private resetLobby(): void {
    this.seats = [null, null];
    this.engines = [
      new MinesweeperEngine(DEFAULT_MAP),
      new MinesweeperEngine(DEFAULT_MAP),
    ];
    this.status = 'waiting';
  }
}
