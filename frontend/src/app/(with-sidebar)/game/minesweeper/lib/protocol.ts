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
