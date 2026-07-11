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
      </Section>

      <Section title="LOBBY">
        {games.map((game) => (
          <NavLink key={game.slug} href={gameHref(game)} label={game.title} />
        ))}
      </Section>

      {/* TEMPORARY: direct board previews for development — remove once real
          game sessions exist at /lobby/<game>/[room-code] */}
      <Section title="GAME PREVIEW">
        {games.map((game) => (
          <NavLink key={game.slug} href={`/game/${game.slug}`} label={game.title} />
        ))}
      </Section>

      <Section title="SOCIAL">
        <NavLink href="/friends" label="Friends" />
        <NavLink href="/chat" label="Chat" />
      </Section>

      <Section title="ACCOUNT">
        <NavLink href="/settings" label="Settings" />
      </Section>
    </aside>
  );
}
