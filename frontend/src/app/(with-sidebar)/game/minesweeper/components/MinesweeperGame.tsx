"use client";
import { useMinesweeper } from "../lib/useMinesweeper";
import MinesweeperBoard from "./MinesweeperBoard";

// Lobby selection doesn't exist yet: the backend has one lobby and only logs
// this code. Once /lobby/minesweeper/[room-code] lands, pass the code in.
const DEV_LOBBY_CODE = "dev-lobby";

function statusLine(state: ReturnType<typeof useMinesweeper>): { text: string; glow: string } {
  switch (state.phase) {
    case "connecting":
      return { text: "CONNECTING…", glow: "glow-yellow" };
    case "waiting":
      return { text: "WAITING FOR PLAYER 2…", glow: "glow-yellow" };
    case "playing":
      return { text: `RACE! FIRST TO CLEAR THE BOARD WINS — 💣 ${state.mineCount}`, glow: "glow-green" };
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

export default function MinesweeperGame() {
  const game = useMinesweeper(DEV_LOBBY_CODE);
  const status = statusLine(game);
  const canPlay = game.phase === "playing";

  return (
    <div className="flex flex-col items-center gap-6">
      <p className={`font-arcade text-sm ${status.glow}`}>{status.text}</p>

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
          <p className="pt-3 text-center font-arcade text-xs glow-magenta">
            ENEMY {game.player !== null ? `(P${game.player === 1 ? 2 : 1})` : ""}
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
