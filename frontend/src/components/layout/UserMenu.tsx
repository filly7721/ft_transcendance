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
    <div className="flex items-center gap-3 text-xs font-mono">
      <span className="flex items-center gap-2">
        <span className="h-2 w-2 animate-blink rounded-full bg-neon-green shadow-[0_0_6px_#00ff88]" />
        <span className="tracking-wider text-neon-green">{auth.user.displayName}</span>
      </span>
      <button
        type="button"
        onClick={auth.logout}
        className="flex items-center gap-2 uppercase tracking-widest text-arcade-muted transition-colors hover:text-neon-red"
      >
        <Icon name="logout" />
        Logout
      </button>
    </div>
  );
}
