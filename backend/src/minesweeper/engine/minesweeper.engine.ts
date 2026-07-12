/**
 * Pure minesweeper rules engine — no Nest/socket imports so it can be
 * unit-tested directly and reused outside the gateway.
 *
 * One engine instance = one player's board. In versus mode the gateway
 * creates two instances from the same map so both players race on
 * identical layouts.
 */

export interface BoardSpec {
  rows: number;
  cols: number;
  /** [row, col] coordinates of each mine. */
  mines: ReadonlyArray<readonly [number, number]>;
}

export interface CellChange {
  row: number;
  col: number;
  state: 'revealed' | 'flagged' | 'hidden';
  /** Number of adjacent mines; present only for revealed safe cells. */
  adjacentMines?: number;
  /** Present (true) only when a mine gets revealed, i.e. the losing click. */
  isMine?: boolean;
}

/** What a successful move did to the board as a whole. */
export type MoveOutcome = 'continue' | 'mine' | 'win';

export type MoveResult =
  | { ok: true; outcome: MoveOutcome; changes: CellChange[] }
  | { ok: false; reason: string };

const key = (row: number, col: number) => `${row},${col}`;

export class MinesweeperEngine {
  private readonly mines: Set<string>;
  private readonly revealed = new Set<string>();
  private readonly flagged = new Set<string>();
  private over = false;

  constructor(private readonly spec: BoardSpec) {
    this.mines = new Set(spec.mines.map(([r, c]) => key(r, c)));
  }

  reveal(row: number, col: number): MoveResult {
    const invalid = this.validate(row, col);
    if (invalid) return invalid;
    if (this.flagged.has(key(row, col))) {
      return { ok: false, reason: 'cell is flagged; unflag it first' };
    }

    if (this.mines.has(key(row, col))) {
      this.over = true;
      return {
        ok: true,
        outcome: 'mine',
        changes: [{ row, col, state: 'revealed', isMine: true }],
      };
    }

    // Reveal the cell and flood-fill neighbors of zero-adjacent cells.
    const changes: CellChange[] = [];
    const stack: Array<[number, number]> = [[row, col]];
    while (stack.length > 0) {
      const [r, c] = stack.pop()!;
      if (this.revealed.has(key(r, c))) continue;
      this.revealed.add(key(r, c));
      this.flagged.delete(key(r, c));
      const adjacentMines = this.adjacentMines(r, c);
      changes.push({ row: r, col: c, state: 'revealed', adjacentMines });
      if (adjacentMines === 0) {
        for (const [nr, nc] of this.neighbors(r, c)) {
          if (!this.mines.has(key(nr, nc))) stack.push([nr, nc]);
        }
      }
    }

    const safeCells = this.spec.rows * this.spec.cols - this.mines.size;
    if (this.revealed.size === safeCells) {
      this.over = true;
      return { ok: true, outcome: 'win', changes };
    }
    return { ok: true, outcome: 'continue', changes };
  }

  /**
   * Every non-hidden cell as a CellChange list, so a reconnecting client can
   * replay the board it left. Exploded mines are not included: a finished
   * game's room resets when a player leaves, so snapshots only ever describe
   * games still in progress.
   */
  snapshot(): CellChange[] {
    const changes: CellChange[] = [];
    for (const k of this.revealed) {
      const [row, col] = k.split(',').map(Number);
      changes.push({
        row,
        col,
        state: 'revealed',
        adjacentMines: this.adjacentMines(row, col),
      });
    }
    for (const k of this.flagged) {
      const [row, col] = k.split(',').map(Number);
      changes.push({ row, col, state: 'flagged' });
    }
    return changes;
  }

  toggleFlag(row: number, col: number): MoveResult {
    const invalid = this.validate(row, col);
    if (invalid) return invalid;

    const k = key(row, col);
    let state: 'flagged' | 'hidden';
    if (this.flagged.has(k)) {
      this.flagged.delete(k);
      state = 'hidden';
    } else {
      this.flagged.add(k);
      state = 'flagged';
    }
    return { ok: true, outcome: 'continue', changes: [{ row, col, state }] };
  }

  private validate(row: number, col: number): MoveResult | null {
    if (this.over) return { ok: false, reason: 'game is already over' };
    if (!this.inBounds(row, col)) {
      return { ok: false, reason: `invalid cell (${row}, ${col})` };
    }
    if (this.revealed.has(key(row, col))) {
      return { ok: false, reason: 'cell is already revealed' };
    }
    return null;
  }

  private inBounds(row: number, col: number): boolean {
    return (
      Number.isInteger(row) &&
      Number.isInteger(col) &&
      row >= 0 &&
      row < this.spec.rows &&
      col >= 0 &&
      col < this.spec.cols
    );
  }

  private adjacentMines(row: number, col: number): number {
    let count = 0;
    for (const [r, c] of this.neighbors(row, col)) {
      if (this.mines.has(key(r, c))) count++;
    }
    return count;
  }

  private *neighbors(row: number, col: number): Generator<[number, number]> {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr;
        const c = col + dc;
        if (r >= 0 && r < this.spec.rows && c >= 0 && c < this.spec.cols) {
          yield [r, c];
        }
      }
    }
  }
}
