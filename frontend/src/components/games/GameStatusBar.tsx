import type { ReactNode } from "react";

// Shared status bar for in-game pages, so every game shows the same chrome:
// which lobby room you are in, game-specific status in the middle, who you
// are playing against, plus optional game-specific cells (e.g. score).

/** One labeled cell of the bar. */
export function StatusCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="text-center">
      <div className="mb-1 font-mono text-xs text-arcade-muted">{label}</div>
      <div className="font-arcade text-xs text-foreground/80">{children}</div>
    </div>
  );
}

type Props = {
  /** Lobby room code the session runs in. */
  room: string;
  /** Opponent's login, or null while waiting for one. */
  opponent: string | null;
  /** False while the opponent is disconnected mid-game; defaults to true. */
  opponentOnline?: boolean;
  /** Game-specific status content, rendered in the middle panel. */
  children: ReactNode;
  /** Optional extra cells appended after OPPONENT (e.g. a score cell). */
  trailing?: ReactNode;
};

export default function GameStatusBar({
  room,
  opponent,
  opponentOnline = true,
  children,
  trailing,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border border-arcade-border bg-arcade-panel px-8 py-4">
      <StatusCell label="ROOM">{room}</StatusCell>

      <div className="border-x border-arcade-border px-4 text-center font-mono text-xs">
        {children}
      </div>

      <StatusCell label="OPPONENT">
        {opponent === null ? (
          <span className="text-arcade-muted animate-blink">???</span>
        ) : opponentOnline ? (
          opponent
        ) : (
          <>
            <span className="text-arcade-muted">{opponent}</span>
            <span className="ml-2 text-neon-red animate-blink">DISCONNECTED</span>
          </>
        )}
      </StatusCell>

      {trailing}
    </div>
  );
}
