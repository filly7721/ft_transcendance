import { notFound } from "next/navigation";
import GameLobby from "@/components/lobby/GameLobby";
import { accentGlow, games } from "@/lib/games";

// One page serves every game's lobby, so their layout can never diverge —
// game-specific content (title, tagline, hints) is data from the registry.
export function generateStaticParams() {
  return games.map((game) => ({ game: game.slug }));
}

export default async function LobbyPage({ params }: PageProps<"/lobby/[game]">) {
  const { game: slug } = await params;
  const game = games.find((g) => g.slug === slug);
  if (!game) notFound();

  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 py-12">
      <div className="text-center">
        <h1 className={`mb-2 font-arcade text-2xl animate-glow-pulse ${accentGlow[game.accent]}`}>
          {game.title}
        </h1>
        <p className="font-mono text-xs uppercase tracking-widest text-arcade-muted">
          {game.tagline}
        </p>
      </div>

      <GameLobby game={game.slug} />

      <div className="w-full max-w-sm border border-arcade-border/50 bg-arcade-card px-6 py-4 font-mono text-xs text-arcade-muted">
        <div className="mb-3 font-arcade text-xs">HOW TO PLAY</div>
        <ul className="space-y-1.5 text-foreground/60">
          {game.hints.map((hint) => (
            <li key={hint}>▸ {hint}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
