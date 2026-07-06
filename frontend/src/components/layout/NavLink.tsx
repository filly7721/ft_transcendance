"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  href: string;
  label: string;
  exact?: boolean;
};

export default function NavLink({ href, label, exact = false }: Props) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`block border-l-2 px-4 py-2 text-xs font-mono uppercase tracking-widest transition-colors ${
        active
          ? "border-neon-cyan bg-arcade-card text-neon-cyan"
          : "border-transparent text-arcade-muted hover:text-neon-cyan"
      }`}
    >
      {label}
    </Link>
  );
}
