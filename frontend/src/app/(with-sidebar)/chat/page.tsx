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
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-4 font-arcade text-xl text-neon-cyan">CHAT</h1>
      <div className="h-[600px]">
        <ChatPanel initialPeer={peer} />
      </div>
    </div>
  );
}
