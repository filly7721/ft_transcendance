"use client";
import { useState } from "react";
import GameStatusBar from "@/components/games/GameStatusBar";
import GameOverModal, { type GameOutcome } from "@/components/games/GameOverModal";
import { useMinesweeper, type MinesweeperGameState } from "../lib/useMinesweeper";
import type { GameOverEvent } from "../lib/protocol";
import MinesweeperBoard from "./MinesweeperBoard";

function statusLine(state: MinesweeperGameState): { text: string; glow: string } {
  switch (state.phase) {
    case "connecting":
      return { text: "CONNECTING…", glow: "glow-yellow" };
    case "waiting":
      return { text: "WAITING FOR PLAYER 2…", glow: "glow-yellow" };
    case "countdown":
      return { text: "GET READY…", glow: "glow-yellow" };
    case "playing":
      return { text: `RACE! FIRST TO CLEAR WINS — 💣 ${state.mineCount}`, glow: "glow-green" };
    case "rejected":
      return { text: "COULD NOT JOIN", glow: "glow-red" };
    case "over": {
      const end = endOfGame(state);
      if (!end) return { text: "GAME OVER", glow: "glow-red" };
      return {
        text: `${end.outcome === "win" ? "YOU WIN" : "YOU LOSE"} — ${end.detail}`,
        glow: end.outcome === "win" ? "glow-green" : "glow-red",
      };
    }
  }
}

// How the race ended, from this player's side. Null until the server has told
// us both who won and which seat we are — a minesweeper race is never a draw.
function endOfGame(
  state: MinesweeperGameState,
): { outcome: GameOutcome; detail: string } | null {
  if (!state.result || state.player === null) return null;
  const won = state.result.winner === state.player;
  const detail =
    state.result.reason === "mine"
      ? won
        ? "ENEMY HIT A MINE"
        : "YOU HIT A MINE"
      : won
        ? "BOARD CLEARED"
        : "ENEMY CLEARED THEIR BOARD";
  return { outcome: won ? "win" : "lose", detail };
}

// The playable minesweeper race for one lobby room; the code comes from the
// ?room= param the lobby browser navigates with.
export default function MinesweeperGame({ lobbyCode }: { lobbyCode: string }) {
  const game = useMinesweeper(lobbyCode);
  const status = statusLine(game);
  const canPlay = game.phase === "playing";

  // The result popup, until it is waved away to look at the final boards. What
  // is remembered is WHICH result was waved away: the next race ends with a
  // different one, so its popup shows up rather than starting out dismissed.
  const [dismissed, setDismissed] = useState<GameOverEvent | null>(null);
  const end = game.result === dismissed ? null : endOfGame(game);

  return (
    <div className="flex flex-col items-center gap-6">
      <GameStatusBar
        room={lobbyCode}
        opponent={game.opponent}
        opponentOnline={game.opponentOnline}
      >
        <p className={`font-arcade text-xs ${status.glow}`}>{status.text}</p>
      </GameStatusBar>

      <div className="relative">
        <div className="flex flex-wrap items-start justify-center gap-8">
          <div className="border border-arcade-border bg-arcade-card w-fit h-fit">
            <p className="pt-3 text-center font-arcade text-xs glow-cyan">
              YOU {game.player !== null ? `(P${game.player})` : ""}
            </p>
            <MinesweeperBoard
              board={game.myBoard}
              onReveal={game.reveal}
              onFlag={game.flag}
              disabled={!canPlay}
            />
          </div>

          <div className="border border-arcade-border bg-arcade-card w-fit h-fit">
            <p className="max-w-full truncate px-3 pt-3 text-center font-arcade text-xs glow-magenta">
              {game.opponent ?? `ENEMY ${game.player !== null ? `(P${game.player === 1 ? 2 : 1})` : ""}`}
            </p>
            <MinesweeperBoard board={game.enemyBoard} disabled />
          </div>
        </div>

        {/* The boards are already unclickable until the server starts the race
            (canPlay is false); this is the visible half of that wait. */}
        {game.phase === "countdown" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-arcade-bg/70 backdrop-blur-[2px]">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-arcade-muted">
              RACE STARTS IN
            </p>
            <span
              // Re-keyed every tick so the digit's animation plays again.
              key={game.countdown}
              className="animate-count-in font-arcade text-6xl glow-yellow"
            >
              {game.countdown !== null && game.countdown > 0 ? game.countdown : "GO!"}
            </span>
          </div>
        )}
      </div>

      {game.notice && (
        <p className="font-mono text-xs uppercase tracking-widest text-neon-yellow">
          {game.notice}
        </p>
      )}

      {end && (
        <GameOverModal
          outcome={end.outcome}
          detail={end.detail}
          lobbyHref="/lobby/minesweeper"
          onDismiss={() => setDismissed(game.result)}
        />
      )}
    </div>
  );
}
