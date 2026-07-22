type Cell = 0 | 1 | 2 | 3 | 4 | 5 |  6 |  7 |  8 | 'h' | 'f' | 'm';

const board: Cell[][] = [
  ['h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h'],
  ['h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h'],
  ['h', 'h', 'h', 'h', 'h',  1,  'h', 'h', 'h'],
  ['h', 'h', 'h', 'f',  3,   1,   1,  'h', 'h'],
  ['h',  2,   1,   1,   0,   0,   1,   2,  'h'],
  [ 1,   0,   0,   0,   0,   0,   0,   1,   1 ],
  [ 0,   0,   1,   1,   1,   0,   0,   0,   0 ],
  [ 0,   0,   2,  'f',  2,   0,   0,   0,   0 ],
  [ 0,   0,   2,  'h',  2,   0,   0,   0,   0 ],
];

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

// Static demo board — replaced by the real game once gameplay lands
export default function MinesweeperDemo() {
  const minesLeft = 12;
  const time = "042";

  return (
    <div className="border border-arcade-border bg-arcade-panel p-6 rounded-sm box-glow-cyan">
      {/* Status bar */}
      <div className="flex items-center justify-between mb-4 px-2">
        {/* Mine counter */}
        <div className="flex items-center gap-2 font-arcade text-sm glow-red">
          💣 {String(minesLeft).padStart(3, '0')}
        </div>

        {/* Smiley face restart button */}
        <button className="w-10 h-10 border border-arcade-border bg-arcade-card flex items-center justify-center text-lg hover:border-neon-yellow hover:shadow-[0_0_8px_#ffe00040] transition-all cursor-pointer">
          😊
        </button>

        {/* Timer */}
        <div className="font-arcade text-sm glow-green">
          {time}
        </div>
      </div>

      {/* Grid */}
      <div className="border-2 border-arcade-border">
        {board.map((row, rowIdx) => (
          <div key={rowIdx} className="flex">
            {row.map((cell, colIdx) => (
              <CellDisplay key={`${rowIdx}-${colIdx}`} cell={cell} />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 text-xs font-mono text-arcade-muted justify-center flex-wrap">
        <span className="glow-cyan">1 = SAFE</span>
        <span className="glow-magenta">3 = DANGER</span>
        <span>🚩 = FLAGGED</span>
        <span className="text-arcade-border">▪ = UNKNOWN</span>
      </div>
    </div>
  );
}
