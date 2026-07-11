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
import { MinesweeperEngine } from './engine/minesweeper.engine';
import { DEFAULT_MAP } from './engine/maps';
import { WsRateLimiter, getSocketIp, verifyWsToken } from '../common/ws-auth';
import { LobbiesService } from '../lobbies/lobbies.service';

/**
 * Minesweeper versus gateway, one race per lobby room.
 *
 * The client passes its room code in `handshake.query.lobby` (the
 * "xxx-xxx-xxx" code from POST /lobbies); each room seats two players who
 * race on identical copies of the hardcoded map. Rooms are created lazily on
 * first connect and destroyed when the last player leaves. Game rules live
 * in MinesweeperEngine.
 *
 * Connections are JWT-authenticated (same contract as the other gateways:
 * token in handshake.auth.token) and per-IP capped via WsRateLimiter.
 *
 * Client -> server (both acked with MoveAck):
 *   'game:reveal' { row, col }
 *   'game:flag'   { row, col }
 *
 * Server -> client:
 *   'game:joined'     you were seated (also sent again if the room resets
 *                     because your opponent left — treat it as a full reset)
 *   'game:start'      { players: [{ player, login }, ...] } — moves accepted
 *   'game:update'     changes to YOUR board
 *   'opponent:update' changes to the OPPONENT's board (side-by-side view)
 *   'game:over'       { winner, reason: 'mine' | 'cleared' }
 *   'game:error'      { reason } — 'unauthorized' | 'rate_limited'
 *                     | 'invalid_lobby' | 'lobby_full'
 *
 * Connect from the frontend with:
 *   io('http://localhost:3001/minesweeper', {
 *     auth: { token: '<JWT>' },
 *     query: { lobby: '<room code>' },
 *     transports: ['websocket'],
 *   })
 */

type PlayerIndex = 1 | 2;
type MoveAck = { ok: true } | { ok: false; reason: string };
type MovePayload = { row: number; col: number };

/** One lobby room's live race. */
interface Room {
  /** seats[i] is player i+1's socket id; each seat gets its own engine. */
  seats: (string | null)[];
  /** logins[i] is player i+1's public login, for opponent display. */
  logins: (string | null)[];
  engines: MinesweeperEngine[];
  status: 'waiting' | 'playing' | 'over';
}

/** Room codes come from user-controlled input, so bound their shape. */
const ROOM_CODE_RE = /^[a-zA-Z0-9-]{1,32}$/;

@WebSocketGateway({
  namespace: 'minesweeper',
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
  maxHttpBufferSize: 1e4, // 10KB — more than enough for { row, col }
  transports: ['websocket'],
})
export class MinesweeperGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MinesweeperGateway.name);

  @WebSocketServer()
  private readonly server: Namespace;

  /** Live races keyed by lobby room code. */
  private readonly rooms = new Map<string, Room>();

  constructor(
    private readonly jwt: JwtService,
    private readonly rateLimiter: WsRateLimiter,
    private readonly lobbies: LobbiesService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const payload = await verifyWsToken(client, this.jwt);
    if (!payload) {
      this.logger.warn(`rejecting ${client.id}: unauthorized (no/invalid token)`);
      client.emit('game:error', { reason: 'unauthorized' });
      client.disconnect(true);
      return;
    }
    client.data.userId = payload.sub;
    client.data.login = payload.login;

    const ip = getSocketIp(client);
    if (!this.rateLimiter.tryAcquire('minesweeper', ip)) {
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
    client.emit('game:joined', this.joinedEvent(seat));
    this.logger.log(
      `client ${client.id} (login=${payload.login}) seated as player ${seat + 1} in room ${code}`,
    );

    if (room.seats.every((s) => s !== null)) {
      room.status = 'playing';
      this.server.to(code).emit('game:start', {
        players: room.logins.map((login, i) => ({
          player: (i + 1) as PlayerIndex,
          login,
        })),
      });
      this.logger.log(`room ${code}: both players connected, game started`);
      // Hide the lobby from the browser now that its game is running.
      void this.lobbies.markInProgress(code);
    }
  }

  handleDisconnect(client: Socket): void {
    // Release the connection slot. Unconditional — also covers sockets
    // rejected after tryAcquire, whose room entry never existed.
    const ip = (client.data as { ip?: string }).ip;
    if (ip) this.rateLimiter.release('minesweeper', ip);

    const found = this.roomOf(client);
    if (!found) return;
    const { code, room, seat } = found;

    const survivor = room.seats[1 - seat];
    const survivorLogin = room.logins[1 - seat];

    if (survivor === null) {
      // Last player out — the room dies with them, and so does its lobby row.
      this.rooms.delete(code);
      void this.lobbies.remove(code);
      this.logger.log(`client ${client.id} left, room ${code} removed`);
      return;
    }

    // Whoever stayed becomes player 1 of a fresh race in the same room; the
    // frontend treats a repeated game:joined as a full reset.
    room.seats = [survivor, null];
    room.logins = [survivorLogin, null];
    room.engines = this.freshEngines();
    room.status = 'waiting';
    this.server.to(survivor).emit('game:joined', this.joinedEvent(0));
    this.logger.log(`client ${client.id} left, room ${code} reset for survivor`);
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
    const found = this.roomOf(client);
    if (!found) return { ok: false, reason: 'you are not in the game' };
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
    const row = payload?.row;
    const col = payload?.col;
    if (typeof row !== 'number' || typeof col !== 'number') {
      return { ok: false, reason: 'payload must be { row, col }' };
    }

    const engine = room.engines[seat];
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
    this.server.to(room.seats[1 - seat]!).emit('opponent:update', update);

    if (result.outcome !== 'continue') {
      room.status = 'over';
      const winner = (
        result.outcome === 'win' ? seat + 1 : 2 - seat
      ) as PlayerIndex;
      const reason = result.outcome === 'win' ? 'cleared' : 'mine';
      this.server.to(code).emit('game:over', { winner, reason });
      this.logger.log(`room ${code} game over: player ${winner} wins (${reason})`);
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
      engines: this.freshEngines(),
      status: 'waiting',
    };
  }

  private freshEngines(): MinesweeperEngine[] {
    return [
      new MinesweeperEngine(DEFAULT_MAP),
      new MinesweeperEngine(DEFAULT_MAP),
    ];
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
}
