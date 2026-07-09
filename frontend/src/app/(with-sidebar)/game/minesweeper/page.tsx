import MinesweeperGame from "./components/MinesweeperGame";
// Dedicated minesweeper game page — versus race against the backend's single
// dev lobby (two browser tabs = two players).
// TODO: multiplayer rooms will live at /lobby/minesweeper/[room-code] and
// reuse the MinesweeperGame component built for this page.

// - Enemy board appears on the right, fed by opponent:update events
// - Left-click = open, right-click = flag
// - Backend owns the map and validates every move
// - TODO: working timer + mine counter
// - TODO: clicking the face resets board + timer (needs a backend rematch event)

export default function MinesweeperGamePage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 py-12">
      <div className="text-center">
        <h1 className="mb-2 font-arcade text-2xl glow-cyan animate-glow-pulse">MINESWEEPER</h1>
        <p className="font-mono text-xs uppercase tracking-widest text-neon-yellow animate-blink">
          DEV PREVIEW
        </p>
      </div>

      <MinesweeperGame />
    </div>
  );
}
