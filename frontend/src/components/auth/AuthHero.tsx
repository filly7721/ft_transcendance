import { accentGlow, games } from "@/lib/games";

// Decorative panel shared by the auth pages — login doubles as the main menu.
// TODO: once logged-in routing exists, link the icons straight into the games
export default function AuthHero() {
  return (
    <div className="relative hidden flex-1 items-center justify-center overflow-hidden lg:flex">
      {/* neon grid backdrop */}
      <div className="absolute inset-0 bg-[linear-gradient(#1e1e4a50_1px,transparent_1px),linear-gradient(90deg,#1e1e4a50_1px,transparent_1px)] bg-[size:44px_44px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#06060f_85%)]" />

      <div className="relative text-center">
        <h2 className="mb-6 font-arcade text-6xl tracking-wide glow-cyan animate-glow-pulse">
          ARCADE
        </h2>
        <p className="mb-14 text-xs font-mono uppercase tracking-[0.5em] text-arcade-muted">
          Multiplayer mini games
        </p>

        <div className="mb-14 flex justify-center gap-14 text-6xl">
          {games.map((game) => (
            <span key={game.slug} className={`${accentGlow[game.accent]} animate-glow-pulse`}>
              {game.icon}
            </span>
          ))}
        </div>

        <p className="font-arcade text-xs text-neon-yellow animate-blink">PRESS START</p>
      </div>
    </div>
  );
}
