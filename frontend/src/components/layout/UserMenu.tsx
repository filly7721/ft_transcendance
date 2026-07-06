import Link from "next/link";

type Session = { username: string } | null;

// TODO: replace with the real session from the backend once auth is implemented
const getSession = (): Session => null;

export default function UserMenu() {
  const session = getSession();

  if (!session) {
    return (
      <Link
        href="/login"
        className="border border-neon-yellow/40 px-3 py-1.5 font-arcade text-[10px] text-neon-yellow transition-all hover:border-neon-yellow hover:shadow-[0_0_8px_#ffe00040]"
      >
        LOGIN
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs font-mono">
      <span className="h-2 w-2 animate-blink rounded-full bg-neon-green shadow-[0_0_6px_#00ff88]" />
      {/* TODO: turn into a dropdown (profile, settings, logout) */}
      <span className="tracking-wider text-neon-green">{session.username}</span>
    </div>
  );
}
