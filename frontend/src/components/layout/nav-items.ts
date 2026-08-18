// The app's navigation, in one place.
//
// It is rendered twice — as the permanent sidebar on desktop and as the drawer
// behind the TopBar's menu button on small screens — and the two must never
// drift apart, so both read this list instead of each repeating the markup.
import type { IconName } from "@/components/ui/Icon";
import { games, gameHref } from "@/lib/games";

/** Which badge count belongs on an item, if any. Resolved where the counts are
 *  available (the drawer), ignored where they are not (the static sidebar). */
export type NavBadge = "friendRequests" | "unreadChats";

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  /** Highlight only on an exact path match — for "/" , which prefixes everything. */
  exact?: boolean;
  badge?: NavBadge;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    title: "MENU",
    items: [{ href: "/", label: "Home", icon: "home", exact: true }],
  },
  {
    title: "LOBBY",
    items: games.map((game) => ({
      href: gameHref(game),
      label: game.title,
      icon: game.pixelIcon,
    })),
  },
  {
    title: "SOCIAL",
    items: [
      { href: "/friends", label: "Friends", icon: "users", badge: "friendRequests" },
      { href: "/chat", label: "Chat", icon: "chat", badge: "unreadChats" },
    ],
  },
  {
    title: "ACCOUNT",
    items: [{ href: "/settings", label: "Settings", icon: "settings" }],
  },
];
