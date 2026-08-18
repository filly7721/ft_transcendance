"use client";

import { ButtonLink } from "@/components/Button";
import Icon from "@/components/ui/Icon";
import { useAuth } from "@/components/auth/AuthProvider";

export default function UserMenu() {
  const auth = useAuth();

  if (auth.status !== "authenticated") {
    return <ButtonLink href="/login">LOGIN</ButtonLink>;
  }

  return (
    <div className="flex min-w-0 items-center gap-3 text-xs font-mono">
      {/* A long display name is what pushed the logout button off the right of
          a phone screen, so it truncates rather than growing the row. */}
      <span className="flex min-w-0 items-center gap-2">
        <span className="h-2 w-2 shrink-0 animate-blink rounded-full bg-neon-green shadow-[0_0_6px_#00ff88]" />
        <span className="truncate tracking-wider text-neon-green">{auth.user.displayName}</span>
      </span>
      <button
        type="button"
        onClick={auth.logout}
        // The label is dropped below `sm` — the door icon carries it there, and
        // aria-label keeps the button named for assistive tech either way.
        aria-label="Logout"
        className="flex shrink-0 items-center gap-2 uppercase tracking-widest text-arcade-muted transition-colors hover:text-neon-red"
      >
        <Icon name="logout" />
        <span className="hidden sm:inline">Logout</span>
      </button>
    </div>
  );
}
