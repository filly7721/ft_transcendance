"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  applyMove,
  createInitialState,
  isValidMove,
  type Mark,
  type SuperTttState,
} from "./superTtt";
import {
  markOf,
  snapshotToState,
  type GameOverEvent,
  type GameUpdateEvent,
  type JoinedEvent,
  type MoveAck,
} from "./superTttProtocol";
import { getToken } from "./auth-storage";

const SOCKET_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/super-tic-tac-toe`;

export type GamePhase = "connecting" | "waiting" | "playing" | "over" | "rejected";

// Friendlier text for the reasons the server rejects a connection with.
const ERROR_NOTICES: Record<string, string> = {
  unauthorized: "You need to log in to play online",
  lobby_full: "Lobby is full — try again later",
  rate_limited: "Too many connections from your network",
  timeout: "Game timed out from inactivity",
};

export interface SuperTttGame {
  phase: GamePhase;
  /** Which mark the server assigned us, null until seated. */
  myMark: Mark | null;
  state: SuperTttState;
  /** Final result reported by the server, null while playing. */
  result: GameOverEvent | null;
  /** Last rejection or connection problem, for display. */
  notice: string | null;
  sendMove: (boardIdx: number, cellIdx: number) => void;
}

/**
 * Owns the socket connection to the backend's super tic tac toe lobby. The
 * server is authoritative: clicks only emit 'game:move', and the board only
 * changes when the server echoes a validated move back (to both players),
 * which we then apply with the same rules engine the server uses.
 */
export function useSuperTtt(lobbyCode: string): SuperTttGame {
  const [phase, setPhase] = useState<GamePhase>("connecting");
  const [myMark, setMyMark] = useState<Mark | null>(null);
  const [state, setState] = useState<SuperTttState>(createInitialState);
  const [result, setResult] = useState<GameOverEvent | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth: { token: getToken() },
      query: { lobby: lobbyCode },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    // Sent on first join AND when the lobby resets because the opponent
    // left — either way it means "fresh board, wait for player 2".
    socket.on("game:joined", (event: JoinedEvent) => {
      setMyMark(markOf(event.player));
      setState(snapshotToState(event.board));
      setResult(null);
      setPhase("waiting");
    });
    socket.on("game:start", () => {
      setPhase("playing");
      setNotice(null);
    });
    socket.on("game:update", (event: GameUpdateEvent) => {
      // The server already validated this move (ours or the opponent's), so
      // apply it without turn checks — the local engine mirrors the server's.
      setState((current) => applyMove(current, event.boardIdx, event.cellIdx));
      setNotice(null);
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

  const sendMove = useCallback(
    (boardIdx: number, cellIdx: number) => {
      // Client-side validation: only our turn, only a legal move — anything
      // else never reaches the websocket. The board itself only updates when
      // the server echoes the move back on 'game:update'.
      if (phase !== "playing" || myMark === null) return;
      if (state.currentPlayer !== myMark) return;
      if (!isValidMove(state, boardIdx, cellIdx)) return;

      socketRef.current?.emit("game:move", { boardIdx, cellIdx }, (ack: MoveAck) => {
        if (!ack.ok) setNotice(ack.reason);
      });
    },
    [phase, myMark, state],
  );

  return { phase, myMark, state, result, notice, sendMove };
}
