/**
 * Pure Super Tic-Tac-Toe rules engine — no Nest/socket imports so it can be
 * unit-tested directly and reused outside the gateway.
 *
 * One engine instance = one game. The gateway creates a single instance per
 * lobby; both players' moves flow through it. The server is authoritative:
 * clients send moves, the engine validates them and owns the state.
 *
 * Board layout:
 *   - 9 mini boards indexed 0-8 (row-major in the outer 3×3 grid).
 *   - 9 cells per mini board indexed 0-8 (row-major in the inner 3×3 grid).
 *
 * Rules:
 *   - Player 1 = 'X', Player 2 = 'O'. X always goes first.
 *   - A move picks a mini board (boardIdx) and a cell in it (cellIdx).
 *   - After playing cellIdx, the opponent is sent to mini board `cellIdx`.
 *     If that mini board is already won or full, the opponent gets a free
 *     choice (nextBoard = null).
 *   - You cannot play in a mini board that is already won.
 *   - Win a mini board by getting 3 in a row (standard tic-tac-toe).
 *   - Win the game by winning 3 mini boards in a row on the outer board.
 *   - If all mini boards are won/full with no outer winner → draw.
 */

/** A mark on the board. */
export type Mark = 'X' | 'O';

/** A single cell: null = empty, otherwise the mark. */
export type Cell = Mark | null;

/** Outcome of a mini board: null = not yet won, otherwise the winning mark. */
export type BoardWinner = Mark | null;

/** Player number (1 = X, 2 = O). */
export type PlayerIndex = 1 | 2;

/** What a successful move did to the game as a whole. */
export type MoveOutcome = 'continue' | 'win' | 'draw';

/** Payload a client sends to make a move. */
export interface MovePayload {
  /** Which mini board (0-8). */
  boardIdx: number;
  /** Which cell in that mini board (0-8). */
  cellIdx: number;
}

/** Result of a move: either the applied move's details or a rejection. */
export type MoveResult =
  | {
      ok: true;
      outcome: MoveOutcome;
      /** Who made the move. */
      player: PlayerIndex;
      /** The mark placed ('X' or 'O'). */
      mark: Mark;
      /** Mini board the move was in. */
      boardIdx: number;
      /** Cell the move was in. */
      cellIdx: number;
      /** Present if this move won the mini board. */
      miniWinner?: Mark;
      /** Mini board the next player must play in, or null for free choice. */
      nextBoard: number | null;
      /** Present if this move won the whole game. */
      outerWinner?: Mark;
    }
  | { ok: false; reason: string };

/** Full board snapshot, sent on `game:joined` so a reconnect renders the
 *  current state without missing anything. */
export interface GameSnapshot {
  /** 9 mini boards, each 9 cells. boards[boardIdx][cellIdx]. */
  boards: Cell[][];
  /** Outer board winners (null = not won). */
  outerBoard: BoardWinner[];
  /** Whose turn it is now. */
  currentPlayer: PlayerIndex;
  /** Mini board the next player must play in, or null for free choice. */
  nextBoard: number | null;
  /** Whether the game is over. */
  over: boolean;
}

/** All 3-in-a-row lines on a 3×3 board (indices 0-8, row-major). */
const WIN_LINES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8], // rows
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8], // cols
  [0, 4, 8],
  [2, 4, 6], // diagonals
];

/** Returns the winner ('X' or 'O') of a 3×3 board, or null if none yet. */
function checkWinner(cells: Cell[]): Mark | null {
  for (const [a, b, c] of WIN_LINES) {
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
      return cells[a];
    }
  }
  return null;
}

/** True if every cell in the board is filled (no empties). */
function isFull(cells: Cell[]): boolean {
  return cells.every((c) => c !== null);
}

export class SuperTttEngine {
  /** 9 mini boards, each 9 cells. boards[boardIdx][cellIdx]. */
  private readonly boards: Cell[][] = Array.from({ length: 9 }, () =>
    Array<Cell>(9).fill(null),
  );

  /** Outer board winners: null = not won, 'X'/'O' = won by that mark. */
  private readonly outerBoard: BoardWinner[] = Array(9).fill(null);

  /** Whose turn it is. X (player 1) always goes first. */
  private currentPlayer: PlayerIndex = 1;

  /** Mini board the next player must play in, or null for free choice. */
  private nextBoard: number | null = null;

  /** Whether the game has ended (win or draw). */
  private over = false;

  /**
   * Apply a move from a player.
   *
   * Validates the move, places the mark, checks for mini-board wins and
   * outer-board wins, determines the next constrained board (or free choice),
   * and switches the current player.
   */
  applyMove(
    player: PlayerIndex,
    payload: Partial<MovePayload> | undefined,
  ): MoveResult {
    if (this.over) {
      return { ok: false, reason: 'game is already over' };
    }
    if (player !== this.currentPlayer) {
      return {
        ok: false,
        reason: `not your turn (it is player ${this.currentPlayer}'s turn)`,
      };
    }

    const boardIdx = payload?.boardIdx;
    const cellIdx = payload?.cellIdx;
    if (typeof boardIdx !== 'number' || typeof cellIdx !== 'number') {
      return { ok: false, reason: 'payload must be { boardIdx, cellIdx }' };
    }
    if (!Number.isInteger(boardIdx) || boardIdx < 0 || boardIdx > 8) {
      return { ok: false, reason: `invalid board index ${boardIdx}` };
    }
    if (!Number.isInteger(cellIdx) || cellIdx < 0 || cellIdx > 8) {
      return { ok: false, reason: `invalid cell index ${cellIdx}` };
    }

    // Constrained-board rule: if nextBoard is set, the move must be there.
    if (this.nextBoard !== null && boardIdx !== this.nextBoard) {
      return {
        ok: false,
        reason: `you must play in mini board ${this.nextBoard}`,
      };
    }
    // Can't play in an already-won mini board.
    if (this.outerBoard[boardIdx] !== null) {
      return { ok: false, reason: 'that mini board is already won' };
    }
    // Cell must be empty.
    if (this.boards[boardIdx][cellIdx] !== null) {
      return { ok: false, reason: 'that cell is already taken' };
    }

    const mark: Mark = player === 1 ? 'X' : 'O';
    this.boards[boardIdx][cellIdx] = mark;

    // Did this move win the mini board?
    let miniWinner: Mark | undefined;
    const wonMini = checkWinner(this.boards[boardIdx]);
    if (wonMini) {
      this.outerBoard[boardIdx] = wonMini;
      miniWinner = wonMini;
    }

    // Did winning this mini board also win the outer board (the whole game)?
    const wonOuter = checkWinner(this.outerBoard as Cell[]);
    if (wonOuter) {
      this.over = true;
      return {
        ok: true,
        outcome: 'win',
        player,
        mark,
        boardIdx,
        cellIdx,
        miniWinner,
        nextBoard: null,
        outerWinner: wonOuter,
      };
    }

    // Draw: every mini board is won or full, but no outer winner.
    const allDone = this.outerBoard.every(
      (w, i) => w !== null || isFull(this.boards[i]),
    );
    if (allDone) {
      this.over = true;
      return {
        ok: true,
        outcome: 'draw',
        player,
        mark,
        boardIdx,
        cellIdx,
        miniWinner,
        nextBoard: null,
      };
    }

    // Determine the next constrained board: the cell index just played.
    // If that mini board is already won or full → free choice (null).
    const targetBoard = cellIdx;
    this.nextBoard =
      this.outerBoard[targetBoard] !== null || isFull(this.boards[targetBoard])
        ? null
        : targetBoard;

    // Switch player.
    this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;

    return {
      ok: true,
      outcome: 'continue',
      player,
      mark,
      boardIdx,
      cellIdx,
      miniWinner,
      nextBoard: this.nextBoard,
    };
  }

  /** Current full-state snapshot (for `game:joined`). */
  snapshot(): GameSnapshot {
    return {
      boards: this.boards.map((b) => [...b]),
      outerBoard: [...this.outerBoard],
      currentPlayer: this.currentPlayer,
      nextBoard: this.nextBoard,
      over: this.over,
    };
  }
}
