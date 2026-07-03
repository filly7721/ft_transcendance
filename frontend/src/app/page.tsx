import Link from "next/link";

const games = [
  {
    title: "MINESWEEPER",
    description: "Clear the minefield. One wrong click ends it all.",
    href: "/games/minesweeper",
    icon: "💣",
    difficulty: "MEDIUM",
    scoreLabel: "BEST TIME",
    highScore: "04:23",
    glowClass: "glow-cyan",
    borderHover: "hover:border-neon-cyan",
    boxGlow: "hover:box-glow-cyan",
    badgeBorder: "border-neon-cyan/30",
    badgeText: "text-neon-cyan/50",
    scoreText: "text-neon-cyan",
  },
  {
    title: "SUPER TTT",
    description: "9 boards. Win three. Outsmart your opponent.",
    href: "/games/super-tic-tac-toe",
    icon: "⊞",
    difficulty: "HARD",
    scoreLabel: "HIGH SCORE",
    highScore: "12 WINS",
    glowClass: "glow-magenta",
    borderHover: "hover:border-neon-magenta",
    boxGlow: "hover:box-glow-magenta",
    badgeBorder: "border-neon-magenta/30",
    badgeText: "text-neon-magenta/50",
    scoreText: "text-neon-magenta",
  },
] as const;

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-16 flex flex-col items-center">
      {/* Hero */}
      <div className="text-center mb-20">
        <h1 className="font-arcade text-5xl md:text-7xl glow-cyan animate-glow-pulse mb-8 tracking-wide leading-tight">
          ARCADE
        </h1>
        <p className="font-mono text-arcade-muted text-xs uppercase tracking-[0.5em] mb-4">
          ——— Classic Games Collection ———
        </p>
        <p className="font-arcade text-neon-yellow text-xs animate-blink">
          INSERT COIN TO START
        </p>
      </div>

      {/* Game cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl">
        {games.map((game) => (
          <Link key={game.title} href={game.href} className="group block">
            <div
              className={`relative border border-arcade-border bg-arcade-card rounded-sm p-8 transition-all duration-300 ${game.borderHover} ${game.boxGlow}`}
            >
              {/* difficulty badge */}
              <div className={`absolute top-4 right-4 text-xs font-mono px-2 py-0.5 border ${game.badgeBorder} ${game.badgeText}`}>
                {game.difficulty}
              </div>

              {/* icon */}
              <div className={`text-5xl mb-6 ${game.glowClass}`}>{game.icon}</div>

              {/* title */}
              <h2 className={`font-arcade text-sm mb-3 ${game.glowClass}`}>{game.title}</h2>

              {/* description */}
              <p className="text-xs font-mono text-arcade-muted mb-6 uppercase tracking-wider leading-relaxed">
                {game.description}
              </p>

              {/* footer row */}
              <div className="border-t border-arcade-border pt-4 flex items-end justify-between">
                <div>
                  <div className="text-xs font-mono text-arcade-muted mb-1">{game.scoreLabel}</div>
                  <div className={`font-arcade text-xs ${game.scoreText}`}>{game.highScore}</div>
                </div>
                <span className={`font-arcade text-xs text-arcade-muted transition-all duration-300 group-hover:${game.glowClass}`}>
                  PLAY →
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Footer note */}
      <p className="mt-20 text-arcade-muted font-mono text-xs uppercase tracking-widest text-center">
        <span className="animate-blink">▌</span>
        {" "}More games coming soon{" "}
        <span className="animate-blink">▌</span>
      </p>
    </div>
  );
}
