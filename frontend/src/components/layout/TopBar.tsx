"use client";

import Link from "next/link";
import MobileMenu from "./MobileMenu";
import UserMenu from "./UserMenu";
import { useNotifications } from "@/components/NotificationProvider";
import { useAuth } from "@/components/auth/AuthProvider";

export default function TopBar() {
  const { friendRequestCount, unreadChatCount } = useNotifications();
  const { status } = useAuth();

  // Don't show notification badges for guests
  const showBadges = status === "authenticated";

  return (
    <header className="sticky top-0 z-50 border-b border-arcade-border bg-arcade-panel/90 backdrop-blur-sm">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:gap-8 sm:px-6">
        <div className="flex items-center gap-1">
          {/* Only signed-in users have somewhere to navigate to: every drawer
              destination is behind the auth guard. */}
          {showBadges && <MobileMenu />}

          <Link href="/" className="shrink-0 font-arcade text-xs glow-cyan animate-flicker">
            ARCADE
          </Link>
        </div>

        {/* Below `md` these two live in the drawer instead, where there is room
            for them; the menu button carries the "something is waiting" dot. */}
        <nav className="hidden items-center gap-6 md:flex">
          {showBadges && (
            <>
              <Link
                href="/friends"
                className="relative text-xs font-mono uppercase tracking-widest text-arcade-muted transition-colors hover:text-neon-cyan"
              >
                FRIENDS
                {friendRequestCount > 0 && (
                  <span className="absolute -top-2 -right-3 flex h-4 min-w-4 items-center justify-center bg-neon-yellow px-1 font-arcade text-[8px] text-arcade-bg">
                    {friendRequestCount}
                  </span>
                )}
              </Link>
              <Link
                href="/chat"
                className="relative text-xs font-mono uppercase tracking-widest text-arcade-muted transition-colors hover:text-neon-cyan"
              >
                CHAT
                {unreadChatCount > 0 && (
                  <span className="absolute -top-2 -right-3 flex h-4 min-w-4 items-center justify-center bg-neon-cyan px-1 font-arcade text-[8px] text-arcade-bg">
                    {unreadChatCount}
                  </span>
                )}
              </Link>
            </>
          )}
        </nav>

        <UserMenu />
      </div>
    </header>
  );
}
