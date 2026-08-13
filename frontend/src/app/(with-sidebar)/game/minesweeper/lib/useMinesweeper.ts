"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { Cell } from "../components/CellDisplay";
import {
  applyChanges,
  fog,
  makeHiddenBoard,
  type BoardUpdateEvent,
  type CountdownEvent,
  type GameOverEvent,
  type GameStartEvent,
  type JoinedEvent,
  type MoveAck,
  type PlayerIndex,
  type PresenceEvent,
} from "./protocol";
import { getToken } from "@/lib/auth-storage";

const SOCKET_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/minesweeper`;

export type GamePhase =
  | "connecting"
  | "waiting"
  | "countdown"
  | "playing"
  | "over"
  | "rejected";

// Friendlier text for the reasons the server rejects a connection with.
const ERROR_NOTICES: Record<string, string> = {
  unauthorized: "You need to log in to play online",
  lobby_full: "Lobby is full — try again later",
  rate_limited: "Too many connections from your network",
  invalid_lobby: "Invalid room code — go back to the lobby",
  superseded: "You opened this game somewhere else — playing there now",
};

export interface MinesweeperGameState {
  phase: GamePhase;
  /** Seconds still to go before the race starts (3, 2, 1); null outside the
   *  'countdown' phase. */
  countdown: number | null;
  player: PlayerIndex | null;
  /** Opponent's login, null until both players are seated. */
  opponent: string | null;
  /** False while the opponent is disconnected mid-game (they may come back). */
  opponentOnline: boolean;
  myBoard: Cell[][];
  enemyBoard: Cell[][];
  mineCount: number;
  result: GameOverEvent | null;
  /** Last server-side rejection or connection problem, for display. */
  notice: string | null;
  /** Raw `game:error` reason when the connection was refused, else null.
   *  Kept separate from `notice` so callers can branch on it (see
   *  useRejection) instead of matching on prose. */
  rejection: string | null;
  reveal: (row: number, col: number) => void;
  flag: (row: number, col: number) => void;
}

/**
 * Owns the socket connection to the backend's single minesweeper lobby and
 * the state of both boards. The server is authoritative: clicks only emit
 * moves, and boards change exclusively through server events.
 */
export function useMinesweeper(lobbyCode: string): MinesweeperGameState {
  const [phase, setPhase] = useState<GamePhase>("connecting");
  // When the pre-race countdown runs out, as a local timestamp: the server
  // sends a duration, so nothing here depends on the two clocks agreeing.
  // `now` is only ticked while that countdown runs; the digit itself is
  // derived from the pair below.
  const [countdownEndsAt, setCountdownEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [player, setPlayer] = useState<PlayerIndex | null>(null);
  const [opponent, setOpponent] = useState<string | null>(null);
  const [opponentOnline, setOpponentOnline] = useState(true);
  // Empty until 'game:joined' arrives with the dimensions the server rolled.
  // Guessing a size here would mean hardcoding the backend's BOARD_ROWS/COLS
  // a second time, where nothing would catch the two drifting apart — so the
  // board is simply not drawn until its real shape is known.
  const [myBoard, setMyBoard] = useState<Cell[][]>([]);
  const [enemyBoard, setEnemyBoard] = useState<Cell[][]>([]);
  const [mineCount, setMineCount] = useState(0);
  const [result, setResult] = useState<GameOverEvent | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  // Our seat, readable inside socket handlers without a stale closure.
  const seatRef = useRef<PlayerIndex | null>(null);

  useEffect(() => {
    // The room code rides in `auth`, not `query`: auth is per-socket, while
    // query belongs to the manager socket.io-client caches per origin — a
    // reused manager (SPA navigation, chat/social sockets on the same
    // origin) would silently resend the FIRST connection's query and drop
    // us into the wrong room.
    //
    // `auth` is a callback so socket.io's own reconnects re-read the token
    // rather than replaying whatever was in storage when the effect ran.
    const socket = io(SOCKET_URL, {
      auth: (cb) => cb({ token: getToken(), lobby: lobbyCode }),
      transports: ["websocket"],
    });
    socketRef.current = socket;

    const seat = (event: JoinedEvent) => {
      seatRef.current = event.player;
      setPlayer(event.player);
      setOpponent(null);
      setOpponentOnline(true);
      setMineCount(event.board.mineCount);
      // Shape only — both grids stay fully covered until the countdown hands
      // over the opening. Whoever gets here first must not be able to study
      // the position while the second player is still joining.
      const { rows, cols } = event.board;
      setMyBoard(makeHiddenBoard(rows, cols));
      setEnemyBoard(makeHiddenBoard(rows, cols));
      setResult(null);
      setCountdownEndsAt(null);
      setPhase("waiting");
    };

    // Sent on first join AND when the lobby resets because the opponent
    // left — either way it means "fresh board, wait for player 2".
    socket.on("game:joined", seat);
    // Both seats are taken; the server holds the race for a few seconds. It
    // also decides when the race actually starts (game:start below) — this is
    // only the display, so a slow tick here can't hand anyone a head start.
    socket.on("game:countdown", (event: CountdownEvent) => {
      const other = event.players?.find((p) => p.player !== seatRef.current);
      setOpponent(other?.login ?? null);
      // First sight of the board, for both players at once. Ours in full;
      // the opponent's grid gets it fogged, so it reads the same as every
      // opponent:update that follows.
      const opening = event.opening ?? [];
      if (opening.length > 0) {
        setMyBoard((board) => applyChanges(board, opening));
        setEnemyBoard((board) => applyChanges(board, fog(opening)));
      }
      // Anchor the clock and the deadline in the same instant, so the first
      // frame shows the full count rather than a leftover `now`.
      const startedAt = Date.now();
      setNow(startedAt);
      setCountdownEndsAt(startedAt + event.ms);
      setPhase("countdown");
      setNotice(null);
    });
    socket.on("game:start", (event: GameStartEvent) => {
      const other = event.players?.find((p) => p.player !== seatRef.current);
      setOpponent(other?.login ?? null);
      setCountdownEndsAt(null);
      setPhase("playing");
      setNotice(null);
    });
    socket.on("game:update", (event: BoardUpdateEvent) => {
      setMyBoard((board) => applyChanges(board, event.changes));
      setNotice(null);
    });
    socket.on("opponent:update", (event: BoardUpdateEvent) => {
      setEnemyBoard((board) => applyChanges(board, event.changes));
    });
    socket.on("game:presence", (event: PresenceEvent) => {
      // Only the opponent's presence matters to this client.
      if (event.player !== seatRef.current) setOpponentOnline(event.connected);
    });
    socket.on("game:over", (event: GameOverEvent) => {
      setResult(event);
      setPhase("over");
    });
    socket.on("game:error", (event: { reason: string }) => {
      setPhase("rejected");
      setRejection(event.reason);
      setNotice(ERROR_NOTICES[event.reason] ?? event.reason);
    });
    socket.on("connect_error", () => {
      setNotice("Cannot reach the game server");
    });
    socket.on("disconnect", (reason) => {
      // Server-initiated disconnects (e.g. lobby full) already set a notice.
      if (reason !== "io server disconnect") setPhase("connecting");
    });

    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, [lobbyCode]);

  // Move the clock while the countdown runs — faster than 1Hz, so the digit
  // never sits a whole second behind the deadline it was handed. Nothing ticks
  // outside the countdown.
  useEffect(() => {
    if (countdownEndsAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [countdownEndsAt]);

  const countdown =
    countdownEndsAt === null
      ? null
      : Math.max(0, Math.ceil((countdownEndsAt - now) / 1000));

  const sendMove = useCallback((kind: "game:reveal" | "game:flag", row: number, col: number) => {
    socketRef.current?.emit(kind, { row, col }, (ack: MoveAck) => {
      if (!ack.ok) setNotice(ack.reason);
    });
  }, []);

  const reveal = useCallback(
    (row: number, col: number) => sendMove("game:reveal", row, col),
    [sendMove],
  );
  const flag = useCallback(
    (row: number, col: number) => sendMove("game:flag", row, col),
    [sendMove],
  );

  return {
    phase,
    countdown,
    player,
    opponent,
    opponentOnline,
    myBoard,
    enemyBoard,
    mineCount,
    result,
    notice,
    rejection,
    reveal,
    flag,
  };
}
