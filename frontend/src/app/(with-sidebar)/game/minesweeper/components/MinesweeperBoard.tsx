"use client";
import Cell from "./Cell";
import { Cell as CellType } from "./CellDisplay";

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
  return (
    <div className={`flex flex-col p-4 ${disabled ? "opacity-80" : ""}`}>
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
