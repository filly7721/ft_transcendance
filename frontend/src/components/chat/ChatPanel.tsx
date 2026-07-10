"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/Button";
import { FriendAvatar } from "@/components/profile/FriendAvatar";
import {
  fetchConversations,
  fetchHistory,
  createChatSocket,
  type Conversation,
  type Message,
} from "@/lib/chat";
import { getToken } from "@/lib/auth-storage";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Shared chat panel — used by both the /chat page (full size) and the
 * ChatWidget (floating). Shows a conversation list on the left and the
 * active message thread on the right.
 *
 * Connects to the /chat WebSocket namespace for real-time messages,
 * typing indicators, read receipts, and presence updates.
 */
export function ChatPanel({ initialPeer }: { initialPeer?: string }) {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [activePeer, setActivePeer] = useState<string | null>(initialPeer ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<ReturnType<typeof createChatSocket> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations on mount
  useEffect(() => {
    fetchConversations()
      .then(setConversations)
      .catch((e) => setError(e.message));
  }, []);

  // WebSocket connection
  useEffect(() => {
    const socket = createChatSocket();
    socketRef.current = socket;

    socket.on("chat:message", (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
      // Auto-mark as read if we're viewing this conversation
      if (msg.senderLogin === activePeer) {
        socket.emit("chat:read", { senderLogin: msg.senderLogin });
      }
      // Refresh conversations to update last message + unread
      fetchConversations().then(setConversations).catch(() => {});
    });

    socket.on("chat:typing", ({ senderLogin }: { senderLogin: string }) => {
      if (senderLogin === activePeer) {
        setTyping(true);
        setTimeout(() => setTyping(false), 3000);
      }
    });

    socket.on("chat:read-receipt", ({ readerLogin }: { readerLogin: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.receiverLogin === readerLogin ? { ...m, readAt: new Date().toISOString() } : m,
        ),
      );
    });

    socket.on("presence:update", () => {
      // Refresh conversations to update online status
      fetchConversations().then(setConversations).catch(() => {});
    });

    socket.on("chat:error", ({ reason }: { reason: string }) => {
      setError(reason);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [activePeer]);

  // Load history when activePeer changes
  useEffect(() => {
    if (!activePeer) return;
    setMessages([]);
    fetchHistory(activePeer)
      .then((h) => {
        setMessages([...h.messages].reverse());
        // Mark as read
        socketRef.current?.emit("chat:read", { senderLogin: activePeer });
      })
      .catch((e) => setError(e.message));
  }, [activePeer]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(() => {
    const content = input.trim();
    if (!content || !activePeer) return;
    setInput("");

    socketRef.current?.emit(
      "chat:send",
      { receiverLogin: activePeer, content },
      (ack: { ok: boolean; message?: Message; reason?: string }) => {
        if (ack.ok && ack.message) {
          setMessages((prev) => [...prev, ack.message!]);
          fetchConversations().then(setConversations).catch(() => {});
        } else if (!ack.ok) {
          setError(ack.reason ?? "failed to send");
        }
      },
    );
  }, [input, activePeer]);

  const handleTyping = useCallback(() => {
    if (!activePeer) return;
    socketRef.current?.emit("chat:typing", { receiverLogin: activePeer });
  }, [activePeer]);

  return (
    <div className="flex h-full min-h-[400px] border border-arcade-border bg-arcade-panel">
      {/* Conversation list */}
      <div className="w-48 shrink-0 border-r border-arcade-border overflow-y-auto">
        <p className="sticky top-0 bg-arcade-panel px-3 py-2 font-arcade text-[10px] text-arcade-muted">CHATS</p>
        {conversations === null ? (
          <p className="px-3 py-4 font-mono text-[10px] text-arcade-muted animate-blink">LOADING...</p>
        ) : conversations.length === 0 ? (
          <p className="px-3 py-4 font-mono text-[10px] text-arcade-muted">NO CHATS</p>
        ) : (
          conversations.map((c) => (
            <button
              key={c.peerLogin}
              onClick={() => setActivePeer(c.peerLogin)}
              className={`flex w-full items-center gap-2 border-b border-arcade-border/50 px-2 py-2 text-left transition-colors hover:bg-arcade-card ${activePeer === c.peerLogin ? "bg-arcade-card" : ""}`}
            >
              <FriendAvatar login={c.peerLogin} avatarUrl={c.peerAvatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[10px]">{c.peerLogin}</p>
                <p className="truncate font-mono text-[9px] text-arcade-muted">{c.lastMessage.content}</p>
              </div>
              {c.unreadCount > 0 && (
                <span className="bg-neon-cyan px-1 font-arcade text-[8px] text-arcade-bg">{c.unreadCount}</span>
              )}
            </button>
          ))
        )}
      </div>

      {/* Message thread */}
      <div className="flex min-w-0 flex-1 flex-col">
        {activePeer ? (
          <>
            <div className="border-b border-arcade-border px-4 py-2">
              <p className="font-arcade text-[10px] text-neon-cyan">@{activePeer}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {messages.map((m) => (
                <div key={m.id} className={`mb-2 flex ${m.senderLogin === activePeer ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[70%] border px-3 py-1.5 font-mono text-xs ${m.senderLogin === activePeer ? "border-arcade-border bg-arcade-card" : "border-neon-cyan/30 bg-neon-cyan/10"}`}>
                    <p>{m.content}</p>
                    <p className="mt-0.5 text-[8px] text-arcade-muted">{new Date(m.createdAt).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
              {typing && <p className="font-mono text-[10px] text-arcade-muted animate-blink">TYPING...</p>}
              <div ref={messagesEndRef} />
            </div>
            <div className="flex gap-2 border-t border-arcade-border p-2">
              <input
                type="text"
                value={input}
                onChange={(e) => { setInput(e.target.value); handleTyping(); }}
                onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
                placeholder="TYPE A MESSAGE..."
                maxLength={1000}
                className="min-w-0 flex-1 border border-arcade-border bg-arcade-bg px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:border-neon-cyan"
              />
              <Button onClick={sendMessage}>SEND</Button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="font-mono text-xs text-arcade-muted">SELECT A CONVERSATION</p>
          </div>
        )}
        {error && <p className="px-4 py-1 font-mono text-[10px] text-neon-red">{error}</p>}
      </div>
    </div>
  );
}
