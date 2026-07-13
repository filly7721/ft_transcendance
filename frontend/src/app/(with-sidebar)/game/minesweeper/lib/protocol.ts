import type { Cell } from "../components/CellDisplay";

// Mirror of the backend websocket protocol
// (backend/src/minesweeper/minesweeper.types.ts + engine CellChange).

export type PlayerIndex = 1 | 2;

export interface CellChange {
  row: number;
  col: number;
  state: "hidden" | "revealed" | "flagged";
  adjacentMines?: number;
  isMine?: boolean;
}

export type MoveOutcome = "continue" | "mine" | "win";

export interface MovePayload {
  row: number;
  col: number;
}

export type MoveAck = { ok: true } | { ok: false; reason: string };

export interface JoinedEvent {
  player: PlayerIndex;
  board: { rows: number; cols: number; mineCount: number };
}

/**
 * Both seats taken — the race begins in `ms`, and moves are rejected until it
 * does. A duration rather than a deadline, so our clock does not have to agree
 * with the server's; rejoining mid-countdown gets whatever is left of it.
 * Carries the seating too, so the opponent is named while the count runs.
 */
export interface CountdownEvent {
  ms: number;
  players: { player: PlayerIndex; login: string }[];
}

/** The countdown ran out — moves are accepted. Carries who is sitting where. */
export interface GameStartEvent {
  players: { player: PlayerIndex; login: string }[];
}

export interface BoardUpdateEvent {
  player: PlayerIndex;
  changes: CellChange[];
  outcome: MoveOutcome;
}

export type GameOverReason = "mine" | "cleared";

export interface GameOverEvent {
  winner: PlayerIndex;
  reason: GameOverReason;
}

/** A seated player dropped mid-game (or came back); the race keeps running. */
export interface PresenceEvent {
  player: PlayerIndex;
  connected: boolean;
}

export function makeHiddenBoard(rows: number, cols: number): Cell[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, (): Cell => "h"),
  );
}

// Translate a batch of backend changes into the Cell vocabulary the display
// components already speak ('h' | 'f' | 'm' | 0-8).
export function applyChanges(board: Cell[][], changes: CellChange[]): Cell[][] {
  const next = board.map((row) => [...row]);
  for (const change of changes) {
    let cell: Cell;
    if (change.state === "revealed") {
      cell = change.isMine ? "m" : ((change.adjacentMines ?? 0) as Cell);
    } else if (change.state === "flagged") {
      cell = "f";
    } else {
      cell = "h";
    }
    next[change.row][change.col] = cell;
  }
  return next;
}
