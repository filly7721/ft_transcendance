"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Icon from "@/components/ui/Icon";
import NavLink from "./NavLink";
import { navSections, type NavBadge } from "./nav-items";
import { useNotifications } from "@/components/NotificationProvider";

/**
 * The navigation for screens too narrow for the sidebar.
 *
 * Below `md` the sidebar is hidden, which used to leave the lobbies, settings
 * and the design page unreachable on a phone — the TopBar only linked friends
 * and chat. This is the same navSections list in a drawer behind a menu button.
 *
 * The panel stays mounted and slides out of view so opening and closing are
 * both animated; `inert` is what keeps its links out of the tab order and away
 * from screen readers while it is closed, which `hidden` would do at the cost
 * of the transition.
 */
export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { friendRequestCount, unreadChatCount } = useNotifications();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const counts: Record<NavBadge, number> = {
    friendRequests: friendRequestCount,
    unreadChats: unreadChatCount,
  };
  const pending = friendRequestCount + unreadChatCount;

  // Navigating closes the drawer: the destination is already on screen behind
  // it, so leaving it open would cover the page the user just asked for. This
  // covers arriving anywhere the drawer did not send us — a TopBar link, the
  // back button — and is derived while rendering rather than in an effect, so
  // the new page is never painted once with the drawer still over it.
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;

    // Move focus into the panel so the first Tab lands on a nav link, and stop
    // the page behind from scrolling under the overlay.
    panelRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      // The focus is inside a panel that is about to go inert, so it has to be
      // put somewhere — the button that reopens it.
      buttonRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function close() {
    setOpen(false);
    // Whatever closed the drawer, the menu button is where the focus belongs —
    // it is the control that reopens it.
    buttonRef.current?.focus();
  }

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        className="relative -ml-2 flex h-10 w-10 items-center justify-center text-arcade-muted transition-colors hover:text-neon-cyan"
      >
        <Icon name={open ? "close" : "menu"} size={20} />
        {/* The counts themselves live on the drawer's Friends and Chat rows;
            closed, the button only has to say that something is waiting. */}
        {!open && pending > 0 && (
          <span
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-neon-yellow"
            aria-hidden
          />
        )}
      </button>

      {/* Backdrop: dismisses the drawer, and dims the page it covers. */}
      <div
        onClick={close}
        aria-hidden
        className={`fixed inset-0 z-40 bg-arcade-bg/70 backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <div
        id="mobile-nav"
        ref={panelRef}
        role="dialog"
        aria-modal={open || undefined}
        aria-label="Navigation"
        inert={!open}
        tabIndex={-1}
        className={`fixed left-0 top-0 z-40 flex h-dvh w-64 max-w-[85vw] flex-col overflow-y-auto border-r border-arcade-border bg-arcade-panel pb-8 pt-20 outline-none transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {navSections.map((section) => (
          <div key={section.title} className="mb-6">
            <p className="mb-1 px-4 font-arcade text-[10px] text-arcade-muted">
              {section.title}
            </p>
            <nav>
              {section.items.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  exact={item.exact}
                  count={item.badge ? counts[item.badge] : undefined}
                  onNavigate={close}
                />
              ))}
            </nav>
          </div>
        ))}
      </div>
    </div>
  );
}
