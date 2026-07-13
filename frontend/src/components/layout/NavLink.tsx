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
};

export default function NavLink({ href, label, exact = false, icon }: Props) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 border-l-2 px-4 py-2 text-xs font-mono uppercase tracking-widest transition-colors ${
        active
          ? "border-neon-cyan bg-arcade-card text-neon-cyan"
          : "border-transparent text-arcade-muted hover:text-neon-cyan"
      }`}
    >
      {icon && <Icon name={icon} />}
      {label}
    </Link>
  );
}
