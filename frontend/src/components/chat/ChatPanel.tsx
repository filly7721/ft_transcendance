"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/Button";
import Input from "@/components/ui/Input";
import { FriendAvatar } from "@/components/profile/FriendAvatar";
import {
  fetchConversations,
  fetchHistory,
  createChatSocket,
  type Conversation,
  type Message,
} from "@/lib/chat";
import { useAuth } from "@/components/auth/AuthProvider";

/**
 * Apply a message to the conversation list locally, without a REST re-fetch:
 * update the peer's last message + unread count and move them to the top.
 *
 * Returns null when the list doesn't contain the peer yet (brand-new
 * conversation) — the caller falls back to one fetchConversations() call,
 * because the message payload lacks the peer's displayName/avatarUrl.
 */
function applyMessageToConversations(
  prev: Conversation[] | null,
  msg: Message,
  myLogin: string | undefined,
  activePeer: string | null,
): Conversation[] | null {
  if (!prev) return null;
  // The sender's other tabs receive their own messages too, so the peer is
  // whichever side of the message isn't us.
  const peer = msg.senderLogin === myLogin ? msg.receiverLogin : msg.senderLogin;
  const existing = prev.find((c) => c.peerLogin === peer);
  if (!existing) return null;

  const incoming = msg.senderLogin === peer;
  const updated: Conversation = {
    ...existing,
    lastMessage: {
      content: msg.content,
      senderLogin: msg.senderLogin,
      createdAt: msg.createdAt,
    },
    // Viewing the thread auto-marks it read; otherwise incoming bumps unread.
    unreadCount: peer === activePeer ? 0 : existing.unreadCount + (incoming ? 1 : 0),
  };
  return [updated, ...prev.filter((c) => c.peerLogin !== peer)];
}

/**
 * Shared chat panel — used by both the /chat page (full size) and the
 * ChatWidget (floating). Shows a conversation list on the left and the
 * active message thread on the right.
 *
 * Which of those two it can afford depends on how much width the panel itself
 * was given, not on how wide the window is — the floating widget is narrow on
 * a desktop too. So the layout switches on a container query (`@container` +
 * `@lg:`): under 32rem it shows one pane at a time, list until a conversation
 * is picked and thread after that, with a back button to return.
 *
 * Connects to the /chat WebSocket namespace for real-time messages,
 * typing indicators, and read receipts. WS payloads are applied to local
 * state directly — the only REST calls are the initial load and the
 * new-conversation fallback (re-fetching per event caused 429s).
 */
export function ChatPanel({ initialPeer }: { initialPeer?: string }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [activePeer, setActivePeer] = useState<string | null>(initialPeer ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<ReturnType<typeof createChatSocket> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // The socket connects once; handlers read the current conversation from
  // this ref so switching conversations doesn't tear the connection down
  // (each reconnect churned presence broadcasts to every friend). Same for
  // the conversation list and our own login (to tell which side of a
  // message is the peer).
  //
  // These are synced in an effect, not assigned during render: a render can
  // be thrown away or replayed, and writing a ref from one is a side effect
  // React makes no promises about. Socket handlers only fire after commit,
  // so they always observe the synced value.
  const activePeerRef = useRef<string | null>(activePeer);
  const conversationsRef = useRef<Conversation[] | null>(conversations);
  const myLoginRef = useRef<string | undefined>(user?.login);
  const lastTypingSentRef = useRef(0);
  // Timer that clears the peer's "TYPING..." line. Held so each new typing
  // event can cancel the previous one: unmanaged, the timer armed at t+0 fired
  // at t+3 and blanked an indicator that a t+2 event had just refreshed, so a
  // peer who kept typing flickered. Also cleared on unmount, which is what
  // stops the callback setting state on a panel that is gone.
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    activePeerRef.current = activePeer;
  }, [activePeer]);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  useEffect(() => {
    myLoginRef.current = user?.login;
  }, [user?.login]);

  // Apply a message to the conversation list; one fallback fetch only when
  // the peer isn't in the list yet (their displayName/avatar are unknown).
  const upsertConversation = useCallback((msg: Message) => {
    const next = applyMessageToConversations(
      conversationsRef.current,
      msg,
      myLoginRef.current,
      activePeerRef.current,
    );
    if (next) setConversations(next);
    else fetchConversations().then(setConversations).catch(() => {});
  }, []);

  // Load conversations on mount
  useEffect(() => {
    fetchConversations()
      .then(setConversations)
      .catch((e) => setError(e.message));
  }, []);

  // WebSocket connection — established once per mount.
  useEffect(() => {
    const socket = createChatSocket();
    socketRef.current = socket;

    socket.on("chat:message", (msg: Message) => {
      const peer = activePeerRef.current;
      // Only thread messages belonging to the open conversation; others
      // just bump the conversation list / badge.
      if (msg.senderLogin === peer || msg.receiverLogin === peer) {
        setMessages((prev) => [...prev, msg]);
      }
      // Auto-mark as read if we're viewing this conversation
      if (msg.senderLogin === peer) {
        socket.emit("chat:read", { senderLogin: msg.senderLogin });
      }
      // Update last message + unread locally from the payload itself
      upsertConversation(msg);
    });

    socket.on("chat:typing", ({ senderLogin }: { senderLogin: string }) => {
      if (senderLogin !== activePeerRef.current) return;
      setTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        typingTimerRef.current = null;
        setTyping(false);
      }, 3000);
    });

    socket.on("chat:read-receipt", ({ readerLogin }: { readerLogin: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.receiverLogin === readerLogin ? { ...m, readAt: new Date().toISOString() } : m,
        ),
      );
    });

    // (No presence:update handler: the conversation list doesn't render
    // online status, so re-fetching it on every presence change was waste.)

    socket.on("chat:error", ({ reason }: { reason: string }) => {
      setError(reason);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, [upsertConversation]);

  // Switching threads clears the old messages and drops the peer's unread
  // badge (opening a thread reads it). Done while rendering, not in an
  // effect: an effect would leave the previous conversation's messages on
  // screen under the new peer's name until the history request came back.
  const [shownPeer, setShownPeer] = useState(activePeer);
  if (shownPeer !== activePeer) {
    setShownPeer(activePeer);
    setMessages([]);
    // The old peer's "TYPING..." must not carry over onto the new thread. A
    // timer still pending from them only sets this false again — harmless.
    setTyping(false);
    if (activePeer) {
      setConversations((prev) =>
        prev
          ? prev.map((c) =>
              c.peerLogin === activePeer ? { ...c, unreadCount: 0 } : c,
            )
          : prev,
      );
    }
  }

  // Load history when activePeer changes.
  useEffect(() => {
    if (!activePeer) return;
    let cancelled = false;
    fetchHistory(activePeer)
      .then((h) => {
        if (cancelled) return;
        setMessages([...h.messages].reverse());
        // Mark as read
        socketRef.current?.emit("chat:read", { senderLogin: activePeer });
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [activePeer]);

  // Push the unread total to the NotificationProvider's badge whenever the
  // conversation list changes — event-carried state instead of the provider
  // re-fetching /chat/conversations on every message.
  useEffect(() => {
    if (!conversations) return;
    const total = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
    window.dispatchEvent(new CustomEvent("chat:unread", { detail: { total } }));
  }, [conversations]);

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
          upsertConversation(ack.message);
        } else if (!ack.ok) {
          setError(ack.reason ?? "failed to send");
        }
      },
    );
  }, [input, activePeer, upsertConversation]);

  const handleTyping = useCallback(() => {
    if (!activePeer) return;
    // Throttle: at most one typing event per 2s, not one per keystroke —
    // the server hits the DB (friendship check) for each of these.
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = now;
    socketRef.current?.emit("chat:typing", { receiverLogin: activePeer });
  }, [activePeer]);

  return (
    <div className="@container flex h-full min-h-0 border border-arcade-border bg-arcade-panel">
      {/* Conversation list — the whole panel while nothing is open, a fixed
          column beside the thread once there is room for both. */}
      <div
        className={`w-full shrink-0 overflow-y-auto border-r border-arcade-border @lg:block @lg:w-48 ${
          activePeer ? "hidden" : "block"
        }`}
      >
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
              className={`flex w-full items-center gap-2 border-b border-arcade-border/50 px-2 py-3 text-left transition-colors hover:bg-arcade-card @lg:py-2 ${activePeer === c.peerLogin ? "bg-arcade-card" : ""}`}
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

      {/* Message thread — hidden on a narrow panel until a peer is picked, so
          the list gets the full width instead of both being unusable. */}
      <div
        className={`min-w-0 flex-1 flex-col @lg:flex ${activePeer ? "flex" : "hidden"}`}
      >
        {activePeer ? (
          <>
            <div className="flex items-center gap-2 border-b border-arcade-border px-2 py-2 @lg:px-4">
              <button
                type="button"
                onClick={() => setActivePeer(null)}
                aria-label="Back to conversations"
                className="flex h-7 w-6 shrink-0 items-center justify-center font-mono text-sm text-arcade-muted transition-colors hover:text-neon-cyan @lg:hidden"
              >
                ‹
              </button>
              <p className="min-w-0 truncate font-arcade text-[10px] text-neon-cyan">@{activePeer}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {messages.map((m) => (
                <div key={m.id} className={`mb-2 flex ${m.senderLogin === activePeer ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[85%] border px-3 py-1.5 font-mono text-xs @lg:max-w-[70%] ${m.senderLogin === activePeer ? "border-arcade-border bg-arcade-card" : "border-neon-cyan/30 bg-neon-cyan/10"}`}>
                    <p className="break-words">{m.content}</p>
                    <p className="mt-0.5 text-[8px] text-arcade-muted">{new Date(m.createdAt).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
              {typing && <p className="font-mono text-[10px] text-arcade-muted animate-blink">TYPING...</p>}
              <div ref={messagesEndRef} />
            </div>
            <div className="flex gap-2 border-t border-arcade-border p-2">
              <Input
                type="text"
                value={input}
                onChange={(e) => { setInput(e.target.value); handleTyping(); }}
                onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
                placeholder="TYPE A MESSAGE..."
                maxLength={1000}
                className="flex-1"
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
