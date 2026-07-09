import { BoardSpec } from './minesweeper.engine';

/**
 * Hardcoded 9x9 board with 10 mines, used for every game while lobby/map
 * selection doesn't exist yet. Layout for reference (* = mine):
 *
 *       0 1 2 3 4 5 6 7 8
 *     0 . . . . * . . . .
 *     1 . * . . . . . . .
 *     2 . . . . . . . * .
 *     3 . . . * . . . . .
 *     4 * . . . . . . . *
 *     5 . . . . . * . . .
 *     6 . . . . . . . . .
 *     7 . . * . . . * . .
 *     8 . . . . . . . . *
 */
export const DEFAULT_MAP: BoardSpec = {
  rows: 9,
  cols: 9,
  mines: [
    [0, 4],
    [1, 1],
    [2, 7],
    [3, 3],
    [4, 0],
    [4, 8],
    [5, 5],
    [7, 2],
    [7, 6],
    [8, 8],
  ],
};
