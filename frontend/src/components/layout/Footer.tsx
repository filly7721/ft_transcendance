import Link from "next/link";

// The Privacy Policy and Terms of Service have to be reachable from anywhere
// in the app. The footer lives in the root layout, so linking them here also
// puts them in front of visitors on /login and /register — people who have no
// account yet, and who are exactly the ones deciding whether to make one.
const LEGAL = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
];

export default function Footer() {
  return (
    <footer className="border-t border-arcade-border py-4 text-[10px] font-mono uppercase tracking-widest text-arcade-muted sm:text-xs">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 text-center sm:px-6">
        <span>© 2026 ARCADE — INSERT COIN TO CONTINUE</span>
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          {LEGAL.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="transition-colors hover:text-neon-cyan"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
