// import Cell from "./Cell"
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
};

function CellDisplay({ cell }: { cell: Cell }) {
  if (cell === 'h') {
    return (
      <div className="w-10 h-10 bg-arcade-panel border border-arcade-border shadow-[inset_-1px_-1px_0_#00000080,inset_1px_1px_0_#ffffff08] flex items-center justify-center cursor-pointer hover:border-arcade-muted transition-colors" />
    );
  }
  if (cell === 'f') {
    return (
      <div className="w-10 h-10 bg-arcade-panel border border-arcade-border flex items-center justify-center text-sm select-none">
        🚩
      </div>
    );
  }
  if (cell === 'm') {
    return (
      <div className="w-10 h-10 bg-neon-red/10 border border-neon-red flex items-center justify-center text-sm select-none">
        💣
      </div>
    );
  }
  if (cell === 0) {
    return (
      <div className="w-10 h-10 bg-arcade-bg border border-arcade-border/30 flex items-center justify-center" />
    );
  }

  return (
    <div
      className={`w-10 h-10 bg-arcade-bg border border-arcade-border/30 flex items-center justify-center font-arcade text-xs ${numberGlow[cell]}`}
    >
      {cell}
    </div>
  );
}

export default CellDisplay;