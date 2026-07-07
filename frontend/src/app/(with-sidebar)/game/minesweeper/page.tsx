import MinesweeperDemo from "@/components/games/MinesweeperDemo";
import Cell from "./components/Cell"
import MinesweeperBoard from "./components/MinesweeperBoard";
// Dedicated minesweeper game page — currently shows the static demo board.
// TODO: build the real game here; multiplayer rooms will live at
// /lobby/minesweeper/[room-code] and reuse the game component built for this page.

// - Fog enemy board; your board stays visible
// - Enemy board appears on the right
// - Left‑click = open, right‑click = flag
// - Backend provides the map; same h/f/number logic
// - Clicking a number assigns a random 1–6
// - Basic click interactions (just show the button works)
// - Add working timer
// - Right‑click reduces bomb counter
// - Clicking the face resets board + timer


export default function MinesweeperGame() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 py-12">
      <div className="text-center">
        <h1 className="mb-2 font-arcade text-2xl glow-cyan animate-glow-pulse">MINESWEEPER</h1>
        <p className="font-mono text-xs uppercase tracking-widest text-neon-yellow animate-blink">
          DEV PREVIEW
        </p>
      </div>

      {/* <MinesweeperDemo /> */}
      {/* yours to replace*/}
      <div className="bg-arcade-card w-fit h-fit">
        <MinesweeperBoard />
      </div>

      </div>
  );
}
