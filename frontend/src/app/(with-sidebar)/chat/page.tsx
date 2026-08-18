"use client";

import { use } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";

/**
 * Dedicated /chat page — full-size chat with optional ?peer=<login> to
 * open a specific conversation.
 */
export default function ChatPage({ searchParams }: { searchParams: Promise<{ peer?: string }> }) {
  const { peer } = use(searchParams);
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="mb-4 font-arcade text-base text-neon-cyan sm:text-xl">CHAT</h1>
      {/* Tall enough to be worth using, never taller than the space between the
          top bar and the footer — a fixed 600px pushed both off a phone. */}
      <div className="h-[calc(100dvh-16rem)] min-h-80 max-h-[600px]">
        <ChatPanel initialPeer={peer} />
      </div>
    </div>
  );
}
