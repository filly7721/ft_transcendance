"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { getToken } from "@/lib/auth-storage";
import { fetchFriendRequests, fetchConversations } from "@/lib/friends";
import { apiFetch } from "@/lib/api";

const SOCIAL_WS = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/social`;

type NotificationState = {
  /** Pending incoming friend requests count. */
  friendRequestCount: number;
  /** Total unread chat messages across all conversations. */
  unreadChatCount: number;
  /** Online friend logins (real-time). */
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
 * Exposes badge counts that the TopBar/Sidebar can display.
 */
export default function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [onlineFriendIds, setOnlineFriendIds] = useState<Set<string>>(new Set());
  const [socket, setSocket] = useState<Socket | null>(null);

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
    setSocket(s);

    s.on("connect", () => {
      // Request initial state
      s.emit("social:state", {}, (ack: { ok: boolean; data?: { onlineFriends: string[]; pendingRequests: number } }) => {
        if (ack.ok && ack.data) {
          setOnlineFriendIds(new Set(ack.data.onlineFriends));
          setFriendRequestCount(ack.data.pendingRequests);
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
    });

    s.on("friends:request", () => {
      setFriendRequestCount((prev) => prev + 1);
      refresh(); // re-fetch to get the full request details
    });

    s.on("friends:accept", () => {
      refresh();
    });

    // Poll unread chat count every 30s as a fallback
    const interval = setInterval(refresh, 30_000);

    return () => {
      s.disconnect();
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
