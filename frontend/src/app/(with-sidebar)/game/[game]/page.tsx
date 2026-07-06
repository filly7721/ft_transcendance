import { notFound } from "next/navigation";
import GameDemo from "@/components/games/GameDemo";
import { accentGlow, games } from "@/lib/games";

// TEMPORARY dev page: renders a game's board directly, outside any room,
// for easy iteration on the games themselves. Remove (along with its sidebar
// section) once real sessions exist at /lobby/<game>/[room-code].
export function generateStaticParams() {
  return games.map((game) => ({ game: game.slug }));
}

export default async function GamePreviewPage({ params }: PageProps<"/game/[game]">) {
  const { game: slug } = await params;
  const game = games.find((g) => g.slug === slug);
  if (!game) notFound();

  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 py-12">
      <div className="text-center">
        <h1 className={`mb-2 font-arcade text-2xl animate-glow-pulse ${accentGlow[game.accent]}`}>
          {game.title}
        </h1>
        <p className="font-mono text-xs uppercase tracking-widest text-neon-yellow animate-blink">
          DEV PREVIEW
        </p>
      </div>

      <GameDemo game={game.slug} />
    </div>
  );
}
