type Mark = 'X' | 'O' | null;
type BoardWinner = 'X' | 'O' | null;
type BoardState = 'won-x' | 'won-o' | 'active' | 'inactive';

const miniBoards: Mark[][][] = [
  // (0,0) — won by X
  [['X','O','X'], ['O','X','O'], ['X','O','X']],
  // (0,1) — in progress
  [['X', null,'O'], [null,'X', null], ['O', null, null]],
  // (0,2) — won by O
  [['O','X','O'], ['X','O','X'], ['O','X','O']],
  // (1,0) — in progress
  [[null,'X', null], ['O', null,'X'], [null,'O', null]],
  // (1,1) — won by X
  [['O','X','O'], ['X','X','O'], ['O','X','X']],
  // (1,2) — in progress
  [['X', null, null], [null,'O', null], [null, null,'X']],
  // (2,0) — won by O
  [['X','O','X'], ['O','O','X'], ['X','O','O']],
  // (2,1) — in progress
  [[null, null,'X'], ['O', null, null], [null,'X', null]],
  // (2,2) — ACTIVE (X needs to win here for game victory)
  [[null,'X', null], [null, null,'O'], [null, null, null]],
];

// Outer board: which inner board has been won
const outerBoard: BoardWinner[] = [
  'X', null, 'O',
  null, 'X', null,
  'O', null, null,
];

const boardStates: BoardState[] = [
  'won-x', 'inactive', 'won-o',
  'inactive', 'won-x', 'inactive',
  'won-o', 'inactive', 'active',
];

function MiniBoard({ cells, state }: { cells: Mark[][]; state: BoardState }) {
  const isWon = state === 'won-x' || state === 'won-o';
  const isActive = state === 'active';

  const borderClass = isActive
    ? 'border-2 border-neon-cyan shadow-[0_0_12px_#00f5ff40]'
    : isWon
    ? 'border border-arcade-border/30'
    : 'border border-arcade-border/50';

  return (
    <div className={`relative p-1 ${borderClass} bg-arcade-card transition-all`}>
      {/* Won overlay */}
      {isWon && (
        <div className="absolute inset-0 flex items-center justify-center bg-arcade-bg/70 z-10">
          <span
            className={`font-arcade text-3xl ${state === 'won-x' ? 'glow-cyan' : 'glow-magenta'}`}
          >
            {state === 'won-x' ? 'X' : 'O'}
          </span>
        </div>
      )}

      {/* Active indicator */}
      {isActive && (
        <div className="absolute -top-5 left-0 right-0 text-center">
          <span className="font-mono text-xs glow-cyan animate-blink">▶ ACTIVE</span>
        </div>
      )}

      {/* Inner cells */}
      <div className="grid grid-cols-3 gap-0.5">
        {cells.flat().map((mark, i) => (
          <div
            key={i}
            className={`w-8 h-8 flex items-center justify-center border text-xs font-arcade transition-colors ${
              isActive && !mark
                ? 'border-arcade-border/60 bg-arcade-panel cursor-pointer hover:border-neon-cyan/50'
                : 'border-arcade-border/30 bg-arcade-panel'
            }`}
          >
            {mark === 'X' && <span className="glow-cyan text-xs">X</span>}
            {mark === 'O' && <span className="glow-magenta text-xs">O</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SuperTicTacToe() {
  const xWins = outerBoard.filter((b) => b === 'X').length;
  const oWins = outerBoard.filter((b) => b === 'O').length;

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col items-center gap-10">
      {/* Title */}
      <div className="text-center">
        <h1 className="font-arcade text-2xl glow-magenta animate-glow-pulse mb-2">SUPER TTT</h1>
        <p className="text-arcade-muted font-mono text-xs uppercase tracking-widest">
          Win 3 boards in a row to claim victory
        </p>
      </div>

      {/* Score bar */}
      <div className="flex items-center gap-8 border border-arcade-border bg-arcade-panel px-8 py-4">
        <div className="text-center">
          <div className="font-mono text-xs text-arcade-muted mb-1">PLAYER 1</div>
          <div className="font-arcade text-2xl glow-cyan">{xWins}</div>
          <div className="font-arcade text-xs glow-cyan mt-1">X</div>
        </div>

        <div className="text-center font-mono text-xs text-arcade-muted px-4 border-x border-arcade-border">
          <div className="font-arcade text-neon-cyan text-xs animate-blink">X TURN</div>
          <div className="text-arcade-muted mt-1">BOARD 9</div>
        </div>

        <div className="text-center">
          <div className="font-mono text-xs text-arcade-muted mb-1">PLAYER 2</div>
          <div className="font-arcade text-2xl glow-magenta">{oWins}</div>
          <div className="font-arcade text-xs glow-magenta mt-1">O</div>
        </div>
      </div>

      {/* Main board — 3×3 grid of mini boards */}
      <div className="grid grid-cols-3 gap-4 mt-2">
        {miniBoards.map((cells, i) => (
          <MiniBoard key={i} cells={cells} state={boardStates[i]} />
        ))}
      </div>

      {/* How to play */}
      <div className="border border-arcade-border/50 bg-arcade-card px-6 py-4 text-xs font-mono text-arcade-muted max-w-sm w-full">
        <div className="font-arcade text-xs text-arcade-muted mb-3">HOW TO PLAY</div>
        <ul className="space-y-1.5 text-foreground/60">
          <li>▸ Win a mini board to claim it on the outer grid</li>
          <li>▸ Your move sends your opponent to that board</li>
          <li>▸ Win 3 boards in a row to win the game</li>
        </ul>
      </div>
    </div>
  );
}
