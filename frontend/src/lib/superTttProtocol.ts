// Mirror of the backend websocket protocol for super tic tac toe
// (backend/src/superttt/superttt.gateway.ts + engine/superttt.engine.ts).

import {
  findLineWinner,
  type BoardResult,
  type CellValue,
  type Mark,
  type SuperTttState,
} from "./superTtt";

export type PlayerIndex = 1 | 2;

export interface MovePayload {
  boardIdx: number;
  cellIdx: number;
}

export type MoveAck = { ok: true } | { ok: false; reason: string };

/** Full board state the server sends on 'game:joined'. */
export interface GameSnapshot {
  boards: CellValue[][];
  outerBoard: (Mark | null)[];
  currentPlayer: PlayerIndex;
  nextBoard: number | null;
  over: boolean;
}

export interface JoinedEvent {
  player: PlayerIndex;
  board: GameSnapshot;
}

/** One validated move, broadcast to both players. */
export interface GameUpdateEvent {
  player: PlayerIndex;
  mark: Mark;
  boardIdx: number;
  cellIdx: number;
  miniWinner?: Mark;
  nextBoard: number | null;
  outerWinner?: Mark;
}

export interface GameOverEvent {
  winner: PlayerIndex | null;
  reason: "boards" | "draw";
}

export function markOf(player: PlayerIndex): Mark {
  return player === 1 ? "X" : "O";
}

// Translate the server snapshot into the SuperTttState the board component
// renders. The server never marks a full-but-unwon mini board, so the "draw"
// results are derived here from the cells.
export function snapshotToState(snapshot: GameSnapshot): SuperTttState {
  const boardResults: BoardResult[] = snapshot.outerBoard.map(
    (winner, i) =>
      winner ??
      (snapshot.boards[i].every((cell) => cell !== null) ? "draw" : null),
  );

  const winner = findLineWinner(boardResults);
  const result: BoardResult = snapshot.over
    ? (winner ?? "draw")
    : null;

  return {
    boards: snapshot.boards.map((cells) => [...cells]),
    boardResults,
    activeBoard: snapshot.nextBoard,
    currentPlayer: markOf(snapshot.currentPlayer),
    result,
  };
}
