"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/ui/Icon";

type Props = {
  href: string;
  label: string;
  exact?: boolean;
  /** Decorative — the label right beside it already names the destination, so
   *  the icon is hidden from screen readers (no `title` passed). */
  icon?: IconName;
  /** Pending items behind this link (friend requests, unread chats). Rendered
   *  as a count chip; 0 and undefined render nothing. */
  count?: number;
  onNavigate?: () => void;
};

// py-3 below `md`, py-2 from there up — the breakpoint the sidebar appears at.
// Rows in the drawer (phones only) are sized for a thumb; rows in the sidebar
// (desktop only) keep their original density.
export default function NavLink({
  href,
  label,
  exact = false,
  icon,
  count,
  onNavigate,
}: Props) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 border-l-2 px-4 py-3 text-xs font-mono uppercase tracking-widest transition-colors md:py-2 ${
        active
          ? "border-neon-cyan bg-arcade-card text-neon-cyan"
          : "border-transparent text-arcade-muted hover:text-neon-cyan"
      }`}
    >
      {icon && <Icon name={icon} />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="flex h-4 min-w-4 shrink-0 items-center justify-center bg-neon-yellow px-1 font-arcade text-[8px] text-arcade-bg">
          {count}
        </span>
      )}
    </Link>
  );
}
