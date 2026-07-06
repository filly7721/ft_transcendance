import Link from "next/link";
import UserMenu from "./UserMenu";

const topLinks = [
  { href: "/faq", label: "FAQ" },
  // TODO: add ABOUT / SUPPORT links when those pages exist
];

export default function TopBar() {
  return (
    <header className="sticky top-0 z-50 border-b border-arcade-border bg-arcade-panel/90 backdrop-blur-sm">
      <div className="flex h-16 items-center justify-between gap-8 px-6">
        <Link href="/" className="shrink-0 font-arcade text-xs glow-cyan animate-flicker">
          ARCADE
        </Link>

        <nav className="flex items-center gap-6">
          {topLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs font-mono uppercase tracking-widest text-arcade-muted transition-colors hover:text-neon-cyan"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <UserMenu />
      </div>
    </header>
  );
}
