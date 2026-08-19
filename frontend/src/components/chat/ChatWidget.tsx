"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { ChatPanel } from "./ChatPanel";

/**
 * Floating chat widget — opens/closes on click, available on every page inside
 * the (with-sidebar) route group.
 *
 * Not rendered on /chat, which already shows a full-size ChatPanel: a second
 * one means two chat sockets, two sets of fetches and two panels racing to
 * publish the unread total, and the gateway caps sockets per IP.
 *
 * The open panel was a fixed 450×500 box, which is wider than a phone screen.
 * From `sm` up it keeps those dimensions; below that it becomes a sheet inset
 * from the edges, stopping short of the top bar so the navigation stays
 * reachable while chatting.
 *
 * Below the top bar's z-index on purpose: the bar holds the navigation drawer,
 * which has to be able to cover this.
 */
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  if (pathname === "/chat") return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        // Lifted clear of the iOS home indicator, which sits on top of a
        // plain bottom-4 button.
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-neon-cyan/40 bg-arcade-panel shadow-[0_0_12px_#00f5ff20] transition-all hover:border-neon-cyan hover:shadow-[0_0_16px_#00f5ff40]"
        aria-label="Open chat"
      >
        <span className="font-arcade text-lg text-neon-cyan">💬</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] top-[4.5rem] z-30 flex flex-col sm:inset-auto sm:bottom-4 sm:right-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-arcade text-[10px] text-neon-cyan">CHAT</span>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close chat"
          className="flex h-8 w-8 items-center justify-center text-arcade-muted transition-colors hover:text-neon-red"
        >
          <Icon name="close" size={12} />
        </button>
      </div>
      {/* min-h-0 lets the sheet's flex child shrink to the space it actually
          has; the fixed size only comes back once the screen can hold it. */}
      <div className="min-h-0 flex-1 sm:h-[500px] sm:w-[26rem]">
        <ChatPanel />
      </div>
    </div>
  );
}
