import { accentGlow, games } from "@/lib/games";

// Shared header for in-game pages: registry title in the game's accent color
// with a consistent subtitle, so the game pages can't drift apart visually.
export default function GamePageHeader({ slug }: { slug: string }) {
  const game = games.find((g) => g.slug === slug);
  if (!game) return null;

  return (
    <div className="text-center">
      <h1 className={`mb-2 font-arcade text-2xl animate-glow-pulse ${accentGlow[game.accent]}`}>
        {game.title}
      </h1>
      <p className="font-mono text-xs uppercase tracking-widest text-neon-yellow animate-blink">
        ONLINE VERSUS
      </p>
    </div>
  );
}
