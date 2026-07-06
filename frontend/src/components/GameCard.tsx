import Link from "next/link";
import { type Game, type GameAccent, gameHref } from "@/lib/games";

// Tailwind needs full class names at build time, so accent styles live in a
// static map instead of being interpolated.
const accents: Record<GameAccent, { glow: string; card: string; badge: string }> = {
  cyan: {
    glow: "glow-cyan",
    card: "hover:border-neon-cyan hover:box-glow-cyan",
    badge: "border-neon-cyan/30 text-neon-cyan/50",
  },
  magenta: {
    glow: "glow-magenta",
    card: "hover:border-neon-magenta hover:box-glow-magenta",
    badge: "border-neon-magenta/30 text-neon-magenta/50",
  },
};

export default function GameCard({ game }: { game: Game }) {
  const accent = accents[game.accent];

  return (
    <Link href={gameHref(game)} className="group block">
      <div
        className={`relative rounded-sm border border-arcade-border bg-arcade-card p-8 transition-all duration-300 ${accent.card}`}
      >
        <span className={`absolute right-4 top-4 border px-2 py-0.5 text-xs font-mono ${accent.badge}`}>
          {game.difficulty}
        </span>

        <div className={`mb-6 text-5xl ${accent.glow}`}>{game.icon}</div>
        <h2 className={`mb-3 font-arcade text-sm ${accent.glow}`}>{game.title}</h2>
        <p className="mb-6 text-xs font-mono uppercase leading-relaxed tracking-wider text-arcade-muted">
          {game.description}
        </p>

        <div className="flex items-end justify-between border-t border-arcade-border pt-4">
          {/* TODO: show real per-player stats (best time, wins) from the backend */}
          <span className="text-xs font-mono text-arcade-muted">2 PLAYERS</span>
          <span className="font-arcade text-xs text-arcade-muted transition-colors group-hover:text-foreground">
            PLAY →
          </span>
        </div>
      </div>
    </Link>
  );
}
