import { games, gameHref } from "@/lib/games";
import NavLink from "./NavLink";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <p className="mb-2 px-4 font-arcade text-[10px] text-arcade-muted">
        {title}
      </p>
      <nav>{children}</nav>
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside className="hidden w-52 shrink-0 border-r border-arcade-border bg-arcade-panel/60 py-6 md:block">
      <Section title="MENU">
        <NavLink href="/" label="Home" icon="home" exact />
      </Section>

      <Section title="LOBBY">
        {games.map((game) => (
          <NavLink
            key={game.slug}
            href={gameHref(game)}
            label={game.title}
            icon={game.pixelIcon}
          />
        ))}
      </Section>

      <Section title="SOCIAL">
        <NavLink href="/friends" label="Friends" icon="users" />
        <NavLink href="/chat" label="Chat" icon="chat" />
      </Section>

      <Section title="ACCOUNT">
        <NavLink href="/settings" label="Settings" icon="settings" />
      </Section>
    </aside>
  );
}
