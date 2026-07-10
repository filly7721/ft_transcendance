"use client";

import Link from "next/link";
import UserMenu from "./UserMenu";
import { useNotifications } from "@/components/NotificationProvider";
import { useAuth } from "@/components/auth/AuthProvider";

const topLinks = [
  { href: "/faq", label: "FAQ" },
];

export default function TopBar() {
  const { friendRequestCount, unreadChatCount } = useNotifications();
  const { status } = useAuth();

  // Don't show notification badges for guests
  const showBadges = status === "authenticated";

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
