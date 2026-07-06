import MinesweeperDemo from "@/components/games/MinesweeperDemo";

// Dedicated minesweeper game page — currently shows the static demo board.
// TODO: build the real game here; multiplayer rooms will live at
// /lobby/minesweeper/[room-code] and reuse the game component built for this page.
export default function MinesweeperGame() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 py-12">
      <div className="text-center">
        <h1 className="mb-2 font-arcade text-2xl glow-cyan animate-glow-pulse">MINESWEEPER</h1>
        <p className="font-mono text-xs uppercase tracking-widest text-neon-yellow animate-blink">
          DEV PREVIEW
        </p>
      </div>

      <MinesweeperDemo />
    </div>
  );
}
