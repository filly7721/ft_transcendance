"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { getToken } from "@/lib/auth-storage";
import { fetchFriendRequests } from "@/lib/friends";
import { apiFetch } from "@/lib/api";

const SOCIAL_WS = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/social`;

type NotificationState = {
  /** Pending incoming friend requests count. */
  friendRequestCount: number;
  /** Total unread chat messages across all conversations. */
  unreadChatCount: number;
  /** Online friend IDs (real-time). */
  onlineFriendIds: Set<string>;
  /** Refresh counts from REST (fallback). */
  refresh: () => Promise<void>;
};

const NotificationContext = createContext<NotificationState | null>(null);

/**
 * Notification provider — connects to the /social WS namespace and tracks:
 *   - Friend request count (real-time via friends:request event)
 *   - Unread chat count (polled from REST every 30s + refreshed on chat:message)
 *   - Online friend IDs (real-time via presence:update)
 *
 * Exposes badge counts via useNotifications() for the TopBar/Sidebar.
 *
 * ALSO dispatches window CustomEvents so page-level components (like the
 * friends page) can react to real-time updates without each one opening
 * its own WS connection:
 *   - "friends:request"  — a new friend request was received
 *   - "friends:accept"   — a friend request was accepted (by either party)
 *   - "friends:reject"   — a friend request was rejected
 *   - "presence:update"  — a friend came online or went offline { detail: { userId, online } }
 *   - "chat:message"     — a new chat message was received
 */
export default function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [onlineFriendIds, setOnlineFriendIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const [reqs, convs] = await Promise.all([
        fetchFriendRequests(),
        apiFetch<{ peerLogin: string; unreadCount: number }[]>("/chat/conversations").catch(() => []),
      ]);
      setFriendRequestCount(reqs.incoming.length);
      setUnreadChatCount(
        Array.isArray(convs) ? convs.reduce((sum, c) => sum + (c.unreadCount || 0), 0) : 0,
      );
    } catch {
      // ignore — will retry
    }
  }, []);

  // Initial REST load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // WS connection for real-time updates
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const s = io(SOCIAL_WS, {
      auth: { token },
      transports: ["websocket"],
    });

    s.on("connect", () => {
      // Request initial state. onlineFriendIds carries user IDs — the same
      // identifier presence:update events carry, so the Set stays uniform.
      s.emit("social:state", {}, (ack: { ok: boolean; data?: { onlineFriendIds: string[]; pendingRequests: number } }) => {
        if (ack.ok && ack.data) {
          setOnlineFriendIds(new Set(ack.data.onlineFriendIds));
          setFriendRequestCount(ack.data.pendingRequests);
          // Notify pages that presence data is available
          window.dispatchEvent(new CustomEvent("presence:sync"));
        }
      });
    });

    s.on("presence:update", ({ userId, online }: { userId: string; online: boolean }) => {
      setOnlineFriendIds((prev) => {
        const next = new Set(prev);
        if (online) next.add(userId);
        else next.delete(userId);
        return next;
      });
      // Dispatch so the friends page can re-fetch + re-render
      window.dispatchEvent(new CustomEvent("presence:update", { detail: { userId, online } }));
    });

    s.on("friends:request", () => {
      setFriendRequestCount((prev) => prev + 1);
      refresh();
      // Dispatch so the friends page can re-fetch + re-render the request list
      window.dispatchEvent(new CustomEvent("friends:request"));
    });

    s.on("friends:accept", () => {
      refresh();
      window.dispatchEvent(new CustomEvent("friends:accept"));
    });

    s.on("profile:update", () => {
      // A friend's profile (login/displayName/avatar) changed.
      window.dispatchEvent(new CustomEvent("profile:update"));
    });

    // The ChatPanel dispatches this window event whenever a message
    // arrives, so the unread badge updates instantly instead of waiting
    // for the next poll.
    const onChatMessage = () => refresh();
    window.addEventListener("chat:message", onChatMessage);

    // Poll unread chat count every 30s as a fallback
    const interval = setInterval(refresh, 30_000);

    return () => {
      s.disconnect();
      window.removeEventListener("chat:message", onChatMessage);
      clearInterval(interval);
    };
  }, [refresh]);

  return (
    <NotificationContext.Provider
      value={{ friendRequestCount, unreadChatCount, onlineFriendIds, refresh }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationState {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
