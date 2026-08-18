"use client";
import Cell from "./Cell";
import { Cell as CellType } from "./CellDisplay";
import type { TapMode } from "./TapModeToggle";

/**
 * Presentational board: all game state lives on the server (via
 * useMinesweeper); this only renders cells and forwards clicks.
 *
 * Sizing is CSS, not arithmetic (see the `ms-board` utility in globals.css).
 * The cells are one square grid that divides up whatever width the board is
 * given, capped at the 2.5rem cells it has on a desktop, so the 16×16 board no
 * longer runs off the side of a phone. `@container` is what the utility
 * measures against — the panel this board sits in, not the window, which is
 * what the versus view needs: two boards share the width there.
 *
 * `tapMode` is what a primary click does, for the sake of touchscreens that
 * cannot right-click. Right click still flags either way, so a mouse never has
 * to touch the switch.
 */
function MinesweeperBoard({
  board,
  onReveal,
  onFlag,
  tapMode = "reveal",
  disabled = false,
}: {
  board: CellType[][];
  onReveal?: (row: number, col: number) => void;
  onFlag?: (row: number, col: number) => void;
  tapMode?: TapMode;
  disabled?: boolean;
}) {
  // No board yet: the server sends its dimensions with 'game:joined', and the
  // status bar is showing CONNECTING… meanwhile. Drawing a guessed grid here
  // would only be a guess at the backend's configured size.
  const cols = board[0]?.length ?? 0;
  if (cols === 0) {
    return <div className="p-4 font-mono text-[10px] text-arcade-muted">…</div>;
  }

  const onTap = tapMode === "flag" ? onFlag : onReveal;

  return (
    <div
      className={`@container touch-manipulation select-none p-2 sm:p-4 ${
        disabled ? "opacity-80" : ""
      }`}
    >
      <div
        className="ms-board mx-auto"
        style={{ "--ms-cols": cols } as React.CSSProperties}
      >
        {board.map((row, r) =>
          row.map((cell, c) => (
            <Cell
              key={`${r}-${c}`}
              name={cell}
              onLeftClick={() => {
                if (!disabled) onTap?.(r, c);
              }}
              onRightClick={() => {
                if (!disabled) onFlag?.(r, c);
              }}
            />
          )),
        )}
      </div>
    </div>
  );
}

export default MinesweeperBoard;
