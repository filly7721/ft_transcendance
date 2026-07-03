import Link from "next/link";

const navLinks = [
  { href: "/", label: "HOME" },
  { href: "/games/minesweeper", label: "MINESWEEPER" },
  { href: "/games/super-tic-tac-toe", label: "SUPER TTT" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-arcade-border bg-arcade-panel/90 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
        <Link
          href="/"
          className="font-arcade text-xs glow-cyan animate-flicker shrink-0"
        >
          ARCADE
        </Link>

        <nav className="flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs font-mono text-arcade-muted hover:text-neon-cyan transition-colors uppercase tracking-widest"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 text-xs font-mono shrink-0">
          <span className="w-2 h-2 rounded-full bg-neon-green shadow-[0_0_6px_#00ff88] animate-blink" />
          <span className="text-neon-green tracking-wider">P1 READY</span>
        </div>
      </div>
    </header>
  );
}
