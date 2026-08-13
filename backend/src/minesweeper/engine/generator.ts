/**
 * Random board generation, guaranteed solvable by pure deduction.
 *
 * Two problems with the board this replaced: it was one hardcoded layout, so
 * anyone who played twice (or opened `maps.ts`) knew where all ten mines were;
 * and, being an ordinary random-ish layout, it could demand a coin flip to
 * finish. Both are worse in a race than in solitaire — a memorised board is an
 * outright win, and a 50/50 decides the match on luck rather than speed.
 *
 * The generator rolls a layout and hands it to the solver. If the solver can
 * clear it by reasoning alone, the board ships; otherwise it is discarded and
 * another is rolled. Nothing clever, and at this size nothing needs to be:
 * roughly five in six random 9x9/10 layouts are already fair, so a board is
 * usually found first try and takes well under a millisecond either way.
 *
 * ## Why the opening comes with the board
 *
 * "Solvable without guessing" is not a property of a layout on its own — it is
 * a property of a layout PLUS the cell you start from. Single-player games
 * hide this by generating the board after the first click.
 *
 * A race cannot: both players must get identical boards, and they would click
 * first in different places. So the server picks the opening, reveals it for
 * both players before the countdown, and guarantees fairness from exactly
 * that cell. Both racers start from the same information, and nobody dies on
 * the first click any more.
 */

import { randomInt } from 'crypto';
import { MinesweeperEngine, type BoardSpec } from './minesweeper.engine';
import { buildGeometry, isSolvableWithoutGuessing } from './solver';

/**
 * Board size every race uses — minesweeper's standard "intermediate".
 *
 * The 9x9/10 this replaced is the beginner board: at 12% mine density it is
 * mostly flood-fill and over in well under a minute, which makes for a thin
 * race. 16x16/40 raises density to 15.6% and quadruples the area, so the
 * deduction actually carries the game. Two of these still sit side by side in
 * the versus view; the expert board (16x30) does not.
 */
export const BOARD_ROWS = 16;
export const BOARD_COLS = 16;
export const BOARD_MINES = 40;

/**
 * Reject a layout whose smallest opening would uncover more than this share of
 * the safe cells. Guards the rare clump-everything roll that would hand the
 * players a nearly finished board.
 */
const MAX_OPENING_FRACTION = 0.5;

/**
 * How many layouts to roll before giving up.
 *
 * Generous on purpose: each attempt is sub-millisecond at this size, so even
 * an unlucky run costs nothing a player would notice, and exhausting this is
 * a signal that the parameters are wrong rather than that we were unlucky.
 */
const MAX_ATTEMPTS = 2_000;

/** A board and the cell the server opens on it. */
export interface GeneratedBoard {
  spec: BoardSpec;
  /** Always a zero-adjacency cell, so opening it uncovers a real region. */
  opening: readonly [number, number];
}

/**
 * Roll boards until one is clearable by deduction alone from its opening.
 *
 * @throws if MAX_ATTEMPTS layouts in a row all needed a guess — impossible in
 * practice at 9x9/10, and far better than silently serving an unfair board.
 */
export function generateNoGuessBoard(
  rows: number = BOARD_ROWS,
  cols: number = BOARD_COLS,
  mineCount: number = BOARD_MINES,
): GeneratedBoard {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const spec = randomSpec(rows, cols, mineCount);
    const picked = pickOpening(spec);
    if (!picked) continue;

    // Occasionally every mine lands in one clump and even the smallest region
    // uncovers most of the board — technically fair, but the race would be
    // over in two clicks. Re-rolling costs a fraction of a millisecond.
    const safeCells = rows * cols - mineCount;
    if (picked.size > safeCells * MAX_OPENING_FRACTION) continue;

    if (isSolvableWithoutGuessing(spec, picked.cell)) {
      return { spec, opening: picked.cell };
    }
  }
  throw new Error(
    `could not generate a no-guess ${rows}x${cols} board with ${mineCount} ` +
      `mines in ${MAX_ATTEMPTS} attempts`,
  );
}

/** A uniformly random mine layout.
 *
 *  `crypto.randomInt`, not `Math.random`, for the same reason room codes use
 *  it: a layout drawn from a predictable stream is a layout an opponent could
 *  in principle reproduce, and the whole point here is that nobody knows the
 *  board in advance. */
function randomSpec(rows: number, cols: number, mineCount: number): BoardSpec {
  const size = rows * cols;
  const cells = Array.from({ length: size }, (_, i) => i);
  // Partial Fisher-Yates: only the first `mineCount` slots need to be settled.
  for (let i = 0; i < mineCount; i++) {
    const j = i + randomInt(0, size - i);
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const mines = cells
    .slice(0, mineCount)
    .map((idx): readonly [number, number] => [
      Math.floor(idx / cols),
      idx % cols,
    ]);
  return { rows, cols, mines };
}

/**
 * Choose where to open, or null if this layout has nowhere good.
 *
 * Only a zero-adjacency cell is worth opening: it flood-fills a region and
 * gives both the solver and the players something to reason from. A lone '3'
 * is a legal start and a useless one.
 *
 * Of those, take the one uncovering the FEWEST cells. Zero-regions on a 9x9
 * vary wildly — picking at random gave a median opening of 52% of the safe
 * cells and sometimes 96%, which is not a race so much as a formality. The
 * smallest region leaves the most board to actually play. Every zero cell in
 * one region floods identically, so regions are measured once each.
 *
 * A layout whose only opening clears the entire board (all ten mines packed
 * together) returns null and gets re-rolled.
 */
function pickOpening(
  spec: BoardSpec,
): { cell: readonly [number, number]; size: number } | null {
  const geo = buildGeometry(spec);
  const measured = new Set<number>();
  let best: { cell: readonly [number, number]; size: number } | null = null;
  let bestSize = Infinity;

  for (let i = 0; i < geo.size; i++) {
    if (geo.isMine[i] || geo.adjacent[i] !== 0 || measured.has(i)) continue;

    const cell = [Math.floor(i / spec.cols), i % spec.cols] as const;
    const result = new MinesweeperEngine(spec).reveal(cell[0], cell[1]);
    if (!result.ok) continue;

    // Every zero cell this flood touched belongs to the same region and would
    // uncover exactly the same thing, so none of them needs measuring again.
    for (const change of result.changes) {
      if (change.adjacentMines === 0) {
        measured.add(change.row * spec.cols + change.col);
      }
    }

    // 'win' means the opening alone cleared the board — no race left.
    if (result.outcome === 'win') continue;
    if (result.changes.length < bestSize) {
      bestSize = result.changes.length;
      best = { cell, size: bestSize };
    }
  }
  return best;
}
