import GameCard from "@/components/GameCard";
import Hero from "@/components/Hero";
import { games } from "@/lib/games";

export default function Home() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center px-6 py-16">
      <Hero />

      <div className="grid w-full max-w-3xl grid-cols-1 gap-8 md:grid-cols-2">
        {games.map((game) => (
          <GameCard key={game.slug} game={game} />
        ))}
      </div>

      <p className="mt-20 text-center text-xs font-mono uppercase tracking-widest text-arcade-muted">
        <span className="animate-blink">▌</span> More games coming soon{" "}
        <span className="animate-blink">▌</span>
      </p>
    </div>
  );
}
