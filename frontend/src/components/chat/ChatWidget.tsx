"use client";

import { useState } from "react";
import { ChatPanel } from "./ChatPanel";

/**
 * Floating chat widget — bottom-right corner, opens/closes on click.
 * Wraps the ChatPanel in a toggleable panel so chat is available on every
 * page (within the (with-sidebar) route group).
 */
export function ChatWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <div className="flex flex-col">
          <div className="mb-1 flex justify-between">
            <span className="font-arcade text-[10px] text-neon-cyan">CHAT</span>
            <button onClick={() => setOpen(false)} className="font-mono text-xs text-arcade-muted hover:text-neon-red">✕</button>
          </div>
          <div className="h-96 w-80">
            <ChatPanel />
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-neon-cyan/40 bg-arcade-panel shadow-[0_0_12px_#00f5ff20] transition-all hover:border-neon-cyan hover:shadow-[0_0_16px_#00f5ff40]"
          aria-label="Open chat"
        >
          <span className="font-arcade text-lg text-neon-cyan">💬</span>
        </button>
      )}
    </div>
  );
}
