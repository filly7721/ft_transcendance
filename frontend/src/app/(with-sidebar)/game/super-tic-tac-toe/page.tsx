import SuperTttDemo from "@/components/games/SuperTttDemo";

// Dedicated super-tic-tac-toe game page — currently shows the static demo board.
// TODO: build the real game here; multiplayer rooms will live at
// /lobby/super-tic-tac-toe/[room-code] and reuse the game component built for this page.
export default function SuperTicTacToeGame() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 py-12">
      <div className="text-center">
        <h1 className="mb-2 font-arcade text-2xl glow-magenta animate-glow-pulse">SUPER TTT</h1>
        <p className="font-mono text-xs uppercase tracking-widest text-neon-yellow animate-blink">
          DEV PREVIEW
        </p>
      </div>

      <SuperTttDemo />
    </div>
  );
}
