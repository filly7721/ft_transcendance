// Pure super-tic-tac-toe rules — no React, no networking. The same
// functions validate moves before sending them to the backend and apply
// moves received from it, so client and server views can't drift apart.

export type Mark = "X" | "O";
export type CellValue = Mark | null;
export type BoardResult = Mark | "draw" | null;

export interface SuperTttState {
  /** 9 mini boards × 9 cells each. */
  boards: CellValue[][];
  /** Outcome of each mini board (null = still in play). */
  boardResults: BoardResult[];
  /** Board the next move must be played in; null = free choice. */
  activeBoard: number | null;
  currentPlayer: Mark;
  /** Overall game outcome (null = game in progress). */
  result: BoardResult;
}

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

export function createInitialState(): SuperTttState {
  return {
    boards: Array.from({ length: 9 }, () => Array<CellValue>(9).fill(null)),
    boardResults: Array<BoardResult>(9).fill(null),
    activeBoard: null,
    currentPlayer: "X",
    result: null,
  };
}

export function findLineWinner(values: readonly (Mark | "draw" | null)[]): Mark | null {
  for (const [a, b, c] of LINES) {
    const v = values[a];
    if ((v === "X" || v === "O") && v === values[b] && v === values[c]) return v;
  }
  return null;
}

/** A board can receive moves: undecided and allowed by the active-board rule. */
export function isBoardPlayable(state: SuperTttState, boardIdx: number): boolean {
  if (state.result !== null) return false;
  if (state.boardResults[boardIdx] !== null) return false;
  return state.activeBoard === null || state.activeBoard === boardIdx;
}

export function isValidMove(
  state: SuperTttState,
  boardIdx: number,
  cellIdx: number,
): boolean {
  if (boardIdx < 0 || boardIdx > 8 || cellIdx < 0 || cellIdx > 8) return false;
  if (!isBoardPlayable(state, boardIdx)) return false;
  return state.boards[boardIdx][cellIdx] === null;
}

/** Returns the state after a move, without mutating the input. Assumes the move is valid. */
export function applyMove(
  state: SuperTttState,
  boardIdx: number,
  cellIdx: number,
): SuperTttState {
  const boards = state.boards.map((board, i) =>
    i === boardIdx
      ? board.map((c, j) => (j === cellIdx ? state.currentPlayer : c))
      : board,
  );

  const boardResults = [...state.boardResults];
  const winner = findLineWinner(boards[boardIdx]);
  if (winner) boardResults[boardIdx] = winner;
  else if (boards[boardIdx].every((c) => c !== null)) boardResults[boardIdx] = "draw";

  const gameWinner = findLineWinner(boardResults);
  const result: BoardResult =
    gameWinner ?? (boardResults.every((r) => r !== null) ? "draw" : null);

  // The cell you play in sends the opponent to the matching board,
  // unless that board is already decided — then they play anywhere.
  const activeBoard =
    result === null && boardResults[cellIdx] === null ? cellIdx : null;

  return {
    boards,
    boardResults,
    activeBoard,
    currentPlayer: state.currentPlayer === "X" ? "O" : "X",
    result,
  };
}
