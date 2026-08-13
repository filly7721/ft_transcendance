"use client";
import Cell from "./Cell";
import { Cell as CellType } from "./CellDisplay";

/**
 * Widest a single board may render. Two of these sit side by side in the
 * versus view, so each has to leave room for the other plus the sidebar.
 */
const MAX_BOARD_PX = 420;
/** Never larger than this — the size the 9x9 board always used. */
const MAX_CELL_PX = 40;
/** Never smaller than this, or the cells stop being clickable. */
const MIN_CELL_PX = 18;

/** Fit `cols` cells into MAX_BOARD_PX, within the bounds above. */
function cellSize(cols: number): number {
  if (cols <= 0) return MAX_CELL_PX;
  return Math.max(
    MIN_CELL_PX,
    Math.min(MAX_CELL_PX, Math.floor(MAX_BOARD_PX / cols)),
  );
}

// Presentational board: all game state lives on the server (via
// useMinesweeper); this only renders cells and forwards clicks.
function MinesweeperBoard({
  board,
  onReveal,
  onFlag,
  disabled = false,
}: {
  board: CellType[][];
  onReveal?: (row: number, col: number) => void;
  onFlag?: (row: number, col: number) => void;
  disabled?: boolean;
}) {
  // No board yet: the server sends its dimensions with 'game:joined', and the
  // status bar is showing CONNECTING… meanwhile. Drawing a guessed grid here
  // would only be a guess at the backend's configured size.
  const cols = board[0]?.length ?? 0;
  if (cols === 0) {
    return <div className="p-4 font-mono text-[10px] text-arcade-muted">…</div>;
  }

  return (
    <div
      className={`flex flex-col p-4 ${disabled ? "opacity-80" : ""}`}
      style={{ "--ms-cell": `${cellSize(cols)}px` } as React.CSSProperties}
    >
      {board.map((row, r) => {
        return (
          <div key={r} className="flex w-fit">
            {row.map((cell, c) => {
              return (
                <Cell
                  key={c}
                  name={cell}
                  onLeftClick={() => {
                    if (!disabled) onReveal?.(r, c);
                  }}
                  onRightClick={() => {
                    if (!disabled) onFlag?.(r, c);
                  }}
                ></Cell>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export default MinesweeperBoard;
