"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { Cell } from "../components/CellDisplay";
import {
  applyChanges,
  makeHiddenBoard,
  type BoardUpdateEvent,
  type GameOverEvent,
  type GameStartEvent,
  type JoinedEvent,
  type MoveAck,
  type PlayerIndex,
  type PresenceEvent,
} from "./protocol";
import { getToken } from "@/lib/auth-storage";

const SOCKET_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/minesweeper`;

export type GamePhase = "connecting" | "waiting" | "playing" | "over" | "rejected";

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
  const [player, setPlayer] = useState<PlayerIndex | null>(null);
  const [opponent, setOpponent] = useState<string | null>(null);
  const [opponentOnline, setOpponentOnline] = useState(true);
  const [myBoard, setMyBoard] = useState<Cell[][]>(() => makeHiddenBoard(9, 9));
  const [enemyBoard, setEnemyBoard] = useState<Cell[][]>(() => makeHiddenBoard(9, 9));
  const [mineCount, setMineCount] = useState(0);
  const [result, setResult] = useState<GameOverEvent | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  // Our seat, readable inside socket handlers without a stale closure.
  const seatRef = useRef<PlayerIndex | null>(null);

  useEffect(() => {
    // The room code rides in `auth`, not `query`: auth is per-socket, while
    // query belongs to the manager socket.io-client caches per origin — a
    // reused manager (SPA navigation, chat/social sockets on the same
    // origin) would silently resend the FIRST connection's query and drop
    // us into the wrong room.
    const socket = io(SOCKET_URL, {
      auth: { token: getToken(), lobby: lobbyCode },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    const seat = (event: JoinedEvent) => {
      seatRef.current = event.player;
      setPlayer(event.player);
      setOpponent(null);
      setOpponentOnline(true);
      setMineCount(event.board.mineCount);
      setMyBoard(makeHiddenBoard(event.board.rows, event.board.cols));
      setEnemyBoard(makeHiddenBoard(event.board.rows, event.board.cols));
      setResult(null);
      setPhase("waiting");
    };

    // Sent on first join AND when the lobby resets because the opponent
    // left — either way it means "fresh board, wait for player 2".
    socket.on("game:joined", seat);
    socket.on("game:start", (event: GameStartEvent) => {
      const other = event.players?.find((p) => p.player !== seatRef.current);
      setOpponent(other?.login ?? null);
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
    player,
    opponent,
    opponentOnline,
    myBoard,
    enemyBoard,
    mineCount,
    result,
    notice,
    reveal,
    flag,
  };
}
