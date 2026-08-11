"use client";

import { useState } from "react";
import {
  isBoardPlayable,
  type Mark,
  type SuperTttState,
} from "@/lib/superTtt";
import { markOf, type GameOverEvent } from "@/lib/superTttProtocol";
import { useSuperTtt, type GamePhase } from "@/lib/useSuperTtt";
import GameOverModal, { type GameOutcome } from "./GameOverModal";
import GameStatusBar, { StatusCell } from "./GameStatusBar";

// The playable super-tic-tac-toe game for one lobby. All game state lives in
// the useSuperTtt hook: clicks are validated locally and sent to the server,
// and the board only changes when the server echoes validated moves back.
export default function SuperTtt({ lobbyCode }: { lobbyCode: string }) {
  const {
    phase,
    myMark,
    opponent,
    opponentOnline,
    state,
    lastMove,
    result,
    notice,
    sendMove,
  } = useSuperTtt(lobbyCode);

  // Boards are clickable only while the game runs and it is our turn; the
  // hook re-checks every move anyway before emitting it.
  const myTurn = phase === "playing" && myMark === state.currentPlayer;

  // The result popup, until it is waved away to look at the final board. What
  // is remembered is WHICH result was waved away: the next game ends with a
  // different one, so its popup shows up rather than starting out dismissed.
  const [dismissed, setDismissed] = useState<GameOverEvent | null>(null);
  const end =
    result && result !== dismissed && myMark ? endOfGame(result, myMark) : null;

  return (
    <div className="flex flex-col items-center gap-10">
      <GameStatusBar
        room={lobbyCode}
        opponent={opponent}
        opponentOnline={opponentOnline}
        trailing={
          <StatusCell label="SCORE">
            <span className="glow-cyan">
              {state.boardResults.filter((r) => r === "X").length}
            </span>
            <span className="text-arcade-muted mx-1">-</span>
            <span className="glow-magenta">
              {state.boardResults.filter((r) => r === "O").length}
            </span>
          </StatusCell>
        }
      >
        <PhaseStatus state={state} phase={phase} myMark={myMark} />
      </GameStatusBar>

      {notice !== null && (
        <p className="font-mono text-xs uppercase tracking-widest text-neon-yellow">
          {notice}
        </p>
      )}

      <div className="bg-arcade-card  mt-2 p-4 rounded-xl">
        <div className="grid grid-cols-3 gap-1 bg-[radial-gradient(circle_closest-side,var(--color-arcade-border)_95%,transparent_100%)]">
          {state.boards.map((cells, boardIdx) => {
            // A board is "in play" whoever's turn it is: on our turn it lights
            // up in our colour and takes clicks, on theirs it stays lit but
            // grey — so you can see where the game is without being invited to
            // click. Off the board entirely (waiting, over), nothing is lit.
            const inPlay = phase === "playing" && isBoardPlayable(state, boardIdx);
            return (
              <MiniBoard
                key={boardIdx}
                cells={cells}
                result={state.boardResults[boardIdx]}
                inPlay={inPlay}
                playable={inPlay && myTurn}
                lastMoveCell={
                  lastMove?.boardIdx === boardIdx ? lastMove.cellIdx : null
                }
                onCellClick={(cellIdx) => sendMove(boardIdx, cellIdx)}
                currentPlayer={state.currentPlayer}
              />
            );
          })}
        </div>
      </div>

      {end && (
        <GameOverModal
          outcome={end.outcome}
          detail={end.detail}
          lobbyHref="/lobby/super-tic-tac-toe"
          onDismiss={() => setDismissed(result)}
        />
      )}
    </div>
  );
}

// How the game ended, from this player's side. The server reports the winner
// as a seat, so it only means anything once we know which seat we are.
function endOfGame(
  result: GameOverEvent,
  myMark: Mark,
): { outcome: GameOutcome; detail: string } {
  if (result.reason === "draw" || result.winner === null) {
    return { outcome: "draw", detail: "NO BOARDS LEFT TO WIN" };
  }
  const won = markOf(result.winner) === myMark;
  return {
    outcome: won ? "win" : "lose",
    detail: won
      ? "THREE BOARDS IN A ROW"
      : "ENEMY TOOK THREE BOARDS IN A ROW",
  };
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
  inPlay,
  playable,
  lastMoveCell,
  onCellClick,
  currentPlayer,
}: {
  cells: (Mark | null)[];
  result: Mark | "draw" | null;
  /** The next move must land here — whoever's turn it is. */
  inPlay: boolean;
  /** ...and that next move is ours, so this board takes clicks. */
  playable: boolean;
  /** Index of the cell the last move landed in, if it was on this board. */
  lastMoveCell: number | null;
  onCellClick: (cellIdx: number) => void;
  currentPlayer: Mark;
}) {
  // Our turn: the board glows in our colour and invites the click. Their turn:
  // the same board stays marked out, but grey and barely glowing — it is where
  // the game is, not where we can act.
  const borderClass = playable
    ? currentPlayer === "X"
      ? "border-2 border-neon-cyan shadow-[0_0_12px_#00f5ff40]"
      : "border-2 border-neon-magenta shadow-[0_0_12px_#ff00cc40]"
    : inPlay
      ? "border-2 border-arcade-muted/70 shadow-[0_0_6px_#4a4a8a30]"
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
        {cells.map((mark, cellIdx) => {
          // The move that just landed keeps a lit background until the next
          // one, so you can always find what the opponent did.
          const isLastMove = cellIdx === lastMoveCell;
          const cellClass = isLastMove
            ? mark === "X"
              ? "border-neon-cyan/70 bg-neon-cyan/20"
              : "border-neon-magenta/70 bg-neon-magenta/20"
            : playable && !mark
              ? `border-arcade-border/60 bg-arcade-panel cursor-pointer ${
                  currentPlayer === "X"
                    ? "hover:border-neon-cyan/50"
                    : "hover:border-neon-magenta/50"
                }`
              : "border-arcade-border/30 bg-arcade-panel";

          return (
            <button
              key={cellIdx}
              onClick={() => onCellClick(cellIdx)}
              disabled={!playable || mark !== null}
              className={`w-8 h-8 flex items-center justify-center border text-xs font-arcade transition-colors ${cellClass}`}
            >
              {mark === "X" && <span className="glow-cyan text-xs">X</span>}
              {mark === "O" && <span className="glow-magenta text-xs">O</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
