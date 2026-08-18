// Cells are square and fill their grid column, so the board's width decides
// how big they are (MinesweeperBoard's `ms-board` grid does the dividing). The
// glyphs inherit the font size the grid computed for them — a digit sized in
// absolute px would outgrow its own cell on a narrow screen.
export type Cell =
  | 'h'
  | 'f'
  | 'm'
  | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;


const numberGlow: Record<number, string> = {
  1: 'glow-cyan',
  2: 'glow-green',
  3: 'glow-magenta',
  4: 'glow-yellow',
  5: 'glow-orange',
  6: 'glow-red',
  7: 'glow-purple',
  8: 'glow-grey',
};

function CellDisplay({ cell }: { cell: Cell }) {
  if (cell === 'h') {
    return (
      <div className="aspect-square w-full bg-arcade-panel border border-arcade-border shadow-[inset_-1px_-1px_0_#00000080,inset_1px_1px_0_#ffffff08] flex items-center justify-center cursor-pointer hover:border-arcade-muted transition-colors" />
    );
  }
  if (cell === 'f') {
    return (
      <div className="aspect-square w-full bg-arcade-panel border border-arcade-border flex items-center justify-center text-[1.15em] select-none">
        🚩
      </div>
    );
  }
  if (cell === 'm') {
    return (
      <div className="aspect-square w-full bg-neon-red/10 border border-neon-red flex items-center justify-center text-[1.15em] select-none">
        💣
      </div>
    );
  }
  if (cell === 0) {
    return (
      <div className="aspect-square w-full bg-arcade-bg border border-arcade-border/30 flex items-center justify-center" />
    );
  }

  return (
    <div
      className={`aspect-square w-full bg-arcade-bg border border-arcade-border/30 flex items-center justify-center font-arcade ${numberGlow[cell]}`}
    >
      {cell}
    </div>
  );
}

export default CellDisplay;