"use client";
import GameStatusBar from "@/components/games/GameStatusBar";
import { useMinesweeper } from "../lib/useMinesweeper";
import MinesweeperBoard from "./MinesweeperBoard";

function statusLine(state: ReturnType<typeof useMinesweeper>): { text: string; glow: string } {
  switch (state.phase) {
    case "connecting":
      return { text: "CONNECTING…", glow: "glow-yellow" };
    case "waiting":
      return { text: "WAITING FOR PLAYER 2…", glow: "glow-yellow" };
    case "playing":
      return { text: `RACE! FIRST TO CLEAR WINS — 💣 ${state.mineCount}`, glow: "glow-green" };
    case "rejected":
      return { text: "COULD NOT JOIN", glow: "glow-red" };
    case "over": {
      if (!state.result || state.player === null) return { text: "GAME OVER", glow: "glow-red" };
      const won = state.result.winner === state.player;
      const why =
        state.result.reason === "mine"
          ? won ? "ENEMY HIT A MINE" : "YOU HIT A MINE"
          : won ? "BOARD CLEARED" : "ENEMY CLEARED THEIR BOARD";
      return { text: `${won ? "YOU WIN" : "YOU LOSE"} — ${why}`, glow: won ? "glow-green" : "glow-red" };
    }
  }
}

// The playable minesweeper race for one lobby room; the code comes from the
// ?room= param the lobby browser navigates with.
export default function MinesweeperGame({ lobbyCode }: { lobbyCode: string }) {
  const game = useMinesweeper(lobbyCode);
  const status = statusLine(game);
  const canPlay = game.phase === "playing";

  return (
    <div className="flex flex-col items-center gap-6">
      <GameStatusBar
        room={lobbyCode}
        opponent={game.opponent}
        opponentOnline={game.opponentOnline}
      >
        <p className={`font-arcade text-xs ${status.glow}`}>{status.text}</p>
      </GameStatusBar>

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

      {game.notice && (
        <p className="font-mono text-xs uppercase tracking-widest text-neon-yellow">
          {game.notice}
        </p>
      )}
    </div>
  );
}
