/**
 * Deduction-only minesweeper solver.
 *
 * Answers one question, used by the board generator: starting from a given
 * opening, can this board be cleared by reasoning alone — never by guessing?
 *
 * The solver plays as a player who can see only what a player sees: revealed
 * numbers and cells it has already proved to be mines. It never consults the
 * real mine layout except to read the number under a cell it has *earned* the
 * right to reveal.
 *
 * Soundness is the property that matters here. Every rule below only marks a
 * cell when that cell has the same value in EVERY arrangement consistent with
 * what is known, so the solver can never call a guessing board solvable.
 * Completeness is optional: a board this solver cannot finish is simply
 * thrown away by the generator and another is rolled, so a missed deduction
 * costs a few milliseconds, never correctness.
 *
 * Rules, cheapest first — each pass stops as soon as one produces progress:
 *   1. Counting.     A number with all its mines already found frees its
 *                    remaining neighbours; a number needing exactly as many
 *                    mines as it has unknowns condemns all of them.
 *   2. Subset.       If one clue's unknowns are contained in another's, the
 *                    difference carries the difference of their mine counts.
 *                    This is what cracks 1-2-1 walls and similar patterns.
 *   3. Enumeration.  Brute-force every legal arrangement over a connected
 *                    clump of boundary cells. Cells that come out the same
 *                    way in all of them are settled. Catches everything the
 *                    first two miss, short of true probability.
 *   4. Mine budget.  The global count finishes endgames the local clues
 *                    cannot see.
 */

import type { BoardSpec } from './minesweeper.engine';

/** Cell state from the solver's point of view. */
const UNKNOWN = 0;
const REVEALED = 1;
const KNOWN_MINE = 2;

/**
 * Largest clump of boundary cells worth brute-forcing. Backtracking prunes
 * hard, so the real cost is far below 2^n, but a cap keeps a pathological
 * board from stalling generation. Skipping an oversized clump only weakens
 * the solver (see the soundness note above), so this is safe to tune.
 */
const MAX_ENUM_CELLS = 22;

/** Give up on a clump that explodes; treated the same as skipping it. */
const MAX_SOLUTIONS = 200_000;

/** A clue: `mines` of these still-unknown `cells` are mines. */
interface Constraint {
  cells: number[];
  mines: number;
}

/** Board geometry precomputed once per solve. */
interface Geometry {
  rows: number;
  cols: number;
  size: number;
  /** neighbours[i] — the up-to-8 cells touching i. */
  neighbours: number[][];
  /** adjacent[i] — how many mines touch i (the number a player would see). */
  adjacent: number[];
  /** True where a mine actually sits. Read only for cells already earned. */
  isMine: boolean[];
  mineCount: number;
}

export function buildGeometry(spec: BoardSpec): Geometry {
  const { rows, cols } = spec;
  const size = rows * cols;
  const isMine = new Array<boolean>(size).fill(false);
  for (const [r, c] of spec.mines) isMine[r * cols + c] = true;

  const neighbours: number[][] = new Array<number[]>(size);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const list: number[] = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            list.push(nr * cols + nc);
          }
        }
      }
      neighbours[r * cols + c] = list;
    }
  }

  const adjacent = new Array<number>(size).fill(0);
  for (let i = 0; i < size; i++) {
    adjacent[i] = neighbours[i].filter((n) => isMine[n]).length;
  }

  return {
    rows,
    cols,
    size,
    neighbours,
    adjacent,
    isMine,
    mineCount: spec.mines.length,
  };
}

/**
 * Can this board be cleared from `opening` without ever guessing?
 *
 * `opening` is the cell the server opens for both players before the race
 * starts (see the generator). Solvability is a property of the board AND that
 * opening — the same layout can be fair from one starting cell and a coin
 * flip from another, which is why the two are always generated together.
 */
export function isSolvableWithoutGuessing(
  spec: BoardSpec,
  opening: readonly [number, number],
): boolean {
  const geo = buildGeometry(spec);
  const state = new Uint8Array(geo.size).fill(UNKNOWN);

  const openIdx = opening[0] * geo.cols + opening[1];
  if (geo.isMine[openIdx]) return false;
  if (!floodReveal(openIdx, geo, state)) return false;

  for (;;) {
    const constraints = collectConstraints(geo, state);
    const progressed =
      applyCounting(constraints, geo, state) ||
      applySubset(constraints, geo, state) ||
      applyMineBudget(geo, state) ||
      applyEnumeration(constraints, geo, state);
    if (progressed === PROVED_UNSOUND) return false;
    if (!progressed) break;
  }

  // Cleared means every safe cell is open. Mines may be flagged or not; a
  // player wins by revealing the safe cells, which is what the engine checks.
  for (let i = 0; i < geo.size; i++) {
    if (!geo.isMine[i] && state[i] !== REVEALED) return false;
  }
  return true;
}

/**
 * Sentinel returned when a rule tried to reveal a mine.
 *
 * That can only happen if a deduction above is wrong, and the consequence
 * would be the one thing this whole module exists to prevent: shipping a
 * board that needs a guess while claiming it does not. The final sweep
 * cannot catch it — it only checks that safe cells are open, and a wrongly
 * revealed mine leaves every safe cell open. So the reveal path reports it
 * and the board is discarded. A latent bug here costs boards, never fairness.
 */
const PROVED_UNSOUND = 'unsound' as const;
type Progress = boolean | typeof PROVED_UNSOUND;

/** Reveal a safe cell, spreading through the zero-region exactly as the
 *  engine's flood fill does, so the solver sees the same board a player would.
 *  Returns false if asked to reveal a mine — see PROVED_UNSOUND. */
function floodReveal(start: number, geo: Geometry, state: Uint8Array): boolean {
  if (geo.isMine[start]) return false;
  const stack = [start];
  while (stack.length > 0) {
    const idx = stack.pop()!;
    if (state[idx] === REVEALED) continue;
    state[idx] = REVEALED;
    if (geo.adjacent[idx] === 0) {
      for (const n of geo.neighbours[idx]) {
        if (!geo.isMine[n] && state[n] !== REVEALED) stack.push(n);
      }
    }
  }
  return true;
}

/** One clue per revealed number that still touches something unknown. */
function collectConstraints(geo: Geometry, state: Uint8Array): Constraint[] {
  const constraints: Constraint[] = [];
  for (let i = 0; i < geo.size; i++) {
    if (state[i] !== REVEALED || geo.adjacent[i] === 0) continue;
    let known = 0;
    const cells: number[] = [];
    for (const n of geo.neighbours[i]) {
      if (state[n] === UNKNOWN) cells.push(n);
      else if (state[n] === KNOWN_MINE) known++;
    }
    if (cells.length > 0) {
      constraints.push({ cells, mines: geo.adjacent[i] - known });
    }
  }
  return constraints;
}

/** Rule 1 — a clue whose mines are all found, or whose unknowns are all mines. */
function applyCounting(
  constraints: Constraint[],
  geo: Geometry,
  state: Uint8Array,
): Progress {
  let progress = false;
  for (const { cells, mines } of constraints) {
    if (mines === 0) {
      for (const c of cells) {
        if (state[c] === UNKNOWN) {
          if (!floodReveal(c, geo, state)) return PROVED_UNSOUND;
          progress = true;
        }
      }
    } else if (mines === cells.length) {
      for (const c of cells) {
        if (state[c] === UNKNOWN) {
          state[c] = KNOWN_MINE;
          progress = true;
        }
      }
    }
  }
  return progress;
}

/** Rule 2 — one clue's unknowns contained in another's: the difference of the
 *  cell sets holds the difference of the mine counts. */
function applySubset(
  constraints: Constraint[],
  geo: Geometry,
  state: Uint8Array,
): Progress {
  let progress = false;
  for (const a of constraints) {
    for (const b of constraints) {
      if (a === b || a.cells.length >= b.cells.length) continue;
      if (!a.cells.every((c) => b.cells.includes(c))) continue;

      const diff = b.cells.filter((c) => !a.cells.includes(c));
      const diffMines = b.mines - a.mines;
      if (diffMines === 0) {
        for (const c of diff) {
          if (state[c] === UNKNOWN) {
            if (!floodReveal(c, geo, state)) return PROVED_UNSOUND;
            progress = true;
          }
        }
      } else if (diffMines === diff.length) {
        for (const c of diff) {
          if (state[c] === UNKNOWN) {
            state[c] = KNOWN_MINE;
            progress = true;
          }
        }
      }
    }
  }
  return progress;
}

/** Rule 4 — the global mine budget, which finishes endgames local clues can't.
 *  Runs before enumeration because it is O(size) and often ends the board. */
function applyMineBudget(geo: Geometry, state: Uint8Array): Progress {
  let found = 0;
  const unknown: number[] = [];
  for (let i = 0; i < geo.size; i++) {
    if (state[i] === KNOWN_MINE) found++;
    else if (state[i] === UNKNOWN) unknown.push(i);
  }
  if (unknown.length === 0) return false;

  const remaining = geo.mineCount - found;
  if (remaining === 0) {
    for (const c of unknown) {
      if (!floodReveal(c, geo, state)) return PROVED_UNSOUND;
    }
    return true;
  }
  if (remaining === unknown.length) {
    for (const c of unknown) state[c] = KNOWN_MINE;
    return true;
  }
  return false;
}

/**
 * Rule 3 — brute force a connected clump of boundary cells.
 *
 * Cells are connected when a clue mentions both. Enumerating each clump on its
 * own (rather than the whole boundary at once) is what keeps this tractable,
 * and it stays sound: dropping the global mine budget here can only admit
 * arrangements that are in fact impossible, and a cell that reads the same
 * across a SUPERSET of the real solutions still reads that way across the
 * real ones.
 */
function applyEnumeration(
  constraints: Constraint[],
  geo: Geometry,
  state: Uint8Array,
): Progress {
  if (constraints.length === 0) return false;

  for (const component of splitComponents(constraints)) {
    if (component.cells.length > MAX_ENUM_CELLS) continue;

    const tally = enumerate(component);
    if (!tally) continue; // exploded — skip, still sound

    let progress = false;
    for (let i = 0; i < component.cells.length; i++) {
      const cell = component.cells[i];
      if (state[cell] !== UNKNOWN) continue;
      if (tally.mineIn[i] === tally.total) {
        state[cell] = KNOWN_MINE;
        progress = true;
      } else if (tally.mineIn[i] === 0) {
        if (!floodReveal(cell, geo, state)) return PROVED_UNSOUND;
        progress = true;
      }
    }
    // Revealing changes every clue, so restart the whole pass rather than
    // enumerate the next clump against stale constraints.
    if (progress) return true;
  }
  return false;
}

/** A set of clues that share cells, plus those cells in a stable order. */
interface Component {
  constraints: Constraint[];
  cells: number[];
}

/** Partition clues into groups that share no cells — each solvable alone. */
function splitComponents(constraints: Constraint[]): Component[] {
  const parent = constraints.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  const owner = new Map<number, number>();
  constraints.forEach((constraint, i) => {
    for (const cell of constraint.cells) {
      const seen = owner.get(cell);
      if (seen === undefined) owner.set(cell, i);
      else union(seen, i);
    }
  });

  const groups = new Map<number, Constraint[]>();
  constraints.forEach((constraint, i) => {
    const root = find(i);
    const list = groups.get(root);
    if (list) list.push(constraint);
    else groups.set(root, [constraint]);
  });

  return [...groups.values()].map((group) => ({
    constraints: group,
    cells: [...new Set(group.flatMap((c) => c.cells))],
  }));
}

/** How many enumerated arrangements make each cell a mine, and how many there
 *  were in total. Null when the clump blew past MAX_SOLUTIONS. */
interface Tally {
  mineIn: number[];
  total: number;
}

/**
 * Every arrangement of mines over a clump that satisfies all its clues.
 *
 * Plain backtracking with two prunes per clue — already over its mine budget,
 * or unable to reach it with the cells left. That is enough to keep a 9x9
 * clump in the microseconds.
 */
function enumerate(component: Component): Tally | null {
  const { cells, constraints } = component;
  const index = new Map(cells.map((cell, i) => [cell, i]));

  // Per clue: the positions it covers, its mine target, and running counters.
  const covers = constraints.map((c) =>
    c.cells.map((cell) => index.get(cell)!),
  );
  const targets = constraints.map((c) => c.mines);
  // clueOf[i] — which clues mention position i, so only those are rechecked.
  const clueOf: number[][] = cells.map(() => []);
  covers.forEach((positions, ci) => {
    for (const p of positions) clueOf[p].push(ci);
  });

  const assignedMines = new Array<number>(constraints.length).fill(0);
  const assignedCells = new Array<number>(constraints.length).fill(0);
  const mineIn = new Array<number>(cells.length).fill(0);
  const choice = new Uint8Array(cells.length);
  let total = 0;
  let exploded = false;

  // Counters are applied in full BEFORE anything is checked, so `place` and
  // `undo` are always exact mirrors. Bailing out mid-loop would leave some
  // clues incremented and others not, and undo would corrupt the rest.
  const place = (pos: number, isMine: boolean): boolean => {
    choice[pos] = isMine ? 1 : 0;
    for (const ci of clueOf[pos]) {
      assignedCells[ci]++;
      if (isMine) assignedMines[ci]++;
    }
    for (const ci of clueOf[pos]) {
      const left = covers[ci].length - assignedCells[ci];
      if (assignedMines[ci] > targets[ci]) return false;
      if (assignedMines[ci] + left < targets[ci]) return false;
    }
    return true;
  };

  const undo = (pos: number, isMine: boolean): void => {
    for (const ci of clueOf[pos]) {
      assignedCells[ci]--;
      if (isMine) assignedMines[ci]--;
    }
  };

  const recurse = (pos: number): void => {
    if (exploded) return;
    if (pos === cells.length) {
      total++;
      if (total > MAX_SOLUTIONS) {
        exploded = true;
        return;
      }
      for (let i = 0; i < cells.length; i++) if (choice[i]) mineIn[i]++;
      return;
    }
    for (const isMine of [false, true]) {
      if (place(pos, isMine)) recurse(pos + 1);
      undo(pos, isMine);
      if (exploded) return;
    }
  };

  recurse(0);
  if (exploded || total === 0) return null;
  return { mineIn, total };
}
