"use client";

import {
  isBoardPlayable,
  type Mark,
  type SuperTttState,
} from "@/lib/superTtt";
import { useSuperTtt, type GamePhase } from "@/lib/useSuperTtt";

// The playable super-tic-tac-toe game for one lobby. All game state lives in
// the useSuperTtt hook: clicks are validated locally and sent to the server,
// and the board only changes when the server echoes validated moves back.
export default function SuperTtt({ lobbyCode }: { lobbyCode: string }) {
  const { phase, myMark, state, notice, sendMove } = useSuperTtt(lobbyCode);

  // Boards are clickable only while the game runs and it is our turn; the
  // hook re-checks every move anyway before emitting it.
  const myTurn = phase === "playing" && myMark === state.currentPlayer;

  return (
    <div className="flex flex-col items-center gap-10">
      <StatusBar
        state={state}
        lobbyCode={lobbyCode}
        phase={phase}
        myMark={myMark}
      />

      {notice !== null && (
        <p className="font-mono text-xs uppercase tracking-widest text-neon-yellow">
          {notice}
        </p>
      )}

      <div className="bg-arcade-card  mt-2 p-4 rounded-xl">
        <div className="grid grid-cols-3 gap-1 bg-[radial-gradient(circle_closest-side,var(--color-arcade-border)_95%,transparent_100%)]">
          {state.boards.map((cells, boardIdx) => (
            <MiniBoard
              key={boardIdx}
              cells={cells}
              result={state.boardResults[boardIdx]}
              playable={myTurn && isBoardPlayable(state, boardIdx)}
              onCellClick={(cellIdx) => sendMove(boardIdx, cellIdx)}
              currentPlayer={state.currentPlayer}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusBar({
  state,
  lobbyCode,
  phase,
  myMark,
}: {
  state: SuperTttState;
  lobbyCode: string;
  phase: GamePhase;
  myMark: Mark | null;
}) {
  return (
    <div className="flex items-center gap-8 border border-arcade-border bg-arcade-panel px-8 py-4">
      <div className="text-center">
        <div className="font-mono text-xs text-arcade-muted mb-1">LOBBY</div>
        <div className="font-arcade text-xs text-foreground/80">
          {lobbyCode}
        </div>
      </div>

      <div className="text-center font-mono text-xs px-4 border-x border-arcade-border">
        <PhaseStatus state={state} phase={phase} myMark={myMark} />
      </div>

      <div className="text-center">
        <div className="font-mono text-xs text-arcade-muted mb-1">SCORE</div>
        <div className="font-arcade text-xs">
          <span className="glow-cyan">
            {state.boardResults.filter((r) => r === "X").length}
          </span>
          <span className="text-arcade-muted mx-1">-</span>
          <span className="glow-magenta">
            {state.boardResults.filter((r) => r === "O").length}
          </span>
        </div>
      </div>
    </div>
  );
}

// The middle panel of the status bar: connection progress while we are not
// in a game yet, then whose turn it is, then the result.
function PhaseStatus({
  state,
  phase,
  myMark,
}: {
  state: SuperTttState;
  phase: GamePhase;
  myMark: Mark | null;
}) {
  if (phase === "connecting") {
    return (
      <div className="font-arcade text-xs text-arcade-muted animate-blink">
        CONNECTING...
      </div>
    );
  }
  if (phase === "waiting") {
    return (
      <>
        <div className="font-arcade text-xs text-arcade-muted animate-blink">
          WAITING FOR PLAYER 2
        </div>
        {myMark !== null && (
          <div className="text-arcade-muted mt-1">YOU ARE {myMark}</div>
        )}
      </>
    );
  }
  if (phase === "rejected") {
    return (
      <div className="font-arcade text-xs text-arcade-muted">NOT CONNECTED</div>
    );
  }

  if (state.result !== null) {
    const youWon = state.result === myMark;
    return (
      <div
        className={`font-arcade text-xs ${
          state.result === "X"
            ? "glow-cyan"
            : state.result === "O"
              ? "glow-magenta"
              : "text-arcade-muted"
        }`}
      >
        {state.result === "draw"
          ? "DRAW"
          : `${state.result} WINS${youWon ? " - YOU!" : ""}`}
      </div>
    );
  }

  return (
    <>
      <div
        className={`font-arcade text-xs animate-blink ${
          state.currentPlayer === "X" ? "glow-cyan" : "glow-magenta"
        }`}
      >
        {state.currentPlayer === myMark ? "YOUR TURN" : `${state.currentPlayer} TURN`}
      </div>
      <div className="text-arcade-muted mt-1">
        {state.activeBoard === null
          ? "ANY BOARD"
          : `BOARD ${state.activeBoard + 1}`}
      </div>
    </>
  );
}

function MiniBoard({
  cells,
  result,
  playable,
  onCellClick,
  currentPlayer,
}: {
  cells: (Mark | null)[];
  result: Mark | "draw" | null;
  playable: boolean;
  onCellClick: (cellIdx: number) => void;
  currentPlayer: Mark;
}) {
  const borderClass = playable
    ? currentPlayer === "X"
      ? "border-2 border-neon-cyan shadow-[0_0_12px_#00f5ff40]"
      : "border-2 border-neon-magenta shadow-[0_0_12px_#ff00cc40]"
    : result !== null
      ? "border border-arcade-border/30"
      : "border border-arcade-border/50";

  return (
    <div
      className={`relative p-1 ${borderClass} bg-arcade-card transition-all`}
    >
      {result !== null && result !== "draw" && (
        <div className="absolute inset-0 flex items-center justify-center bg-arcade-bg/70 z-10">
          <span
            className={`font-arcade text-3xl ${result === "X" ? "glow-cyan" : "glow-magenta"}`}
          >
            {result}
          </span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-0.5">
        {cells.map((mark, cellIdx) => (
          <button
            key={cellIdx}
            onClick={() => onCellClick(cellIdx)}
            disabled={!playable || mark !== null}
            className={`w-8 h-8 flex items-center justify-center border text-xs font-arcade transition-colors ${
              playable && !mark
                ? `border-arcade-border/60 bg-arcade-panel cursor-pointer ${
                    currentPlayer === "X"
                      ? "hover:border-neon-cyan/50"
                      : "hover:border-neon-magenta/50"
                  }`
                : "border-arcade-border/30 bg-arcade-panel"
            }`}
          >
            {mark === "X" && <span className="glow-cyan text-xs">X</span>}
            {mark === "O" && <span className="glow-magenta text-xs">O</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
