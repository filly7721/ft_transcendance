import { games, gameHref } from "@/lib/games";
import NavLink from "./NavLink";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <p className="mb-2 px-4 font-arcade text-[10px] text-arcade-muted">{title}</p>
      <nav>{children}</nav>
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside className="hidden w-52 shrink-0 border-r border-arcade-border bg-arcade-panel/60 py-6 md:block">
      <Section title="MENU">
        <NavLink href="/" label="Home" exact />
        {/* TODO: add LEADERBOARD and PROFILE links once those pages exist */}
      </Section>

      <Section title="GAMES">
        {games.map((game) => (
          <NavLink key={game.slug} href={gameHref(game)} label={game.title} />
        ))}
      </Section>

      {/* TODO: add SOCIAL section (friends, chat) for the multiplayer features */}
    </aside>
  );
}
