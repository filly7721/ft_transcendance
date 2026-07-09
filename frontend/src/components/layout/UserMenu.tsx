"use client";

import { ButtonLink } from "@/components/Button";
import { useAuth } from "@/components/auth/AuthProvider";

export default function UserMenu() {
  const auth = useAuth();

  if (auth.status !== "authenticated") {
    return <ButtonLink href="/login">LOGIN</ButtonLink>;
  }

  return (
    <div className="flex items-center gap-3 text-xs font-mono">
      <span className="flex items-center gap-2">
        <span className="h-2 w-2 animate-blink rounded-full bg-neon-green shadow-[0_0_6px_#00ff88]" />
        <span className="tracking-wider text-neon-green">{auth.user.displayName}</span>
      </span>
      <button
        type="button"
        onClick={auth.logout}
        className="uppercase tracking-widest text-arcade-muted transition-colors hover:text-neon-red"
      >
        Logout
      </button>
    </div>
  );
}
