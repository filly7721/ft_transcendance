import GameCard from "@/components/GameCard";
import Hero from "@/components/Hero";
import { games } from "@/lib/games";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-10 sm:px-6 sm:py-16">
      <Hero />

      <div className="grid w-full max-w-3xl grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2">
        {games.map((game) => (
          <GameCard key={game.slug} game={game} />
        ))}
      </div>

      <p className="mt-12 text-center text-[10px] font-mono uppercase tracking-widest text-arcade-muted sm:mt-20 sm:text-xs">
        <span className="animate-blink">▌</span> More games coming soon{" "}
        <span className="animate-blink">▌</span>
      </p>
    </div>
  );
}
