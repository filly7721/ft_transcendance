"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { getToken } from "@/lib/auth-storage";
import { fetchFriendRequests } from "@/lib/friends";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";

const SOCIAL_WS = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/social`;

/** Badge counts, as read from REST. */
type Counts = { requests: number; unread: number };

/** Nothing online. A module constant so the logged-out reset below hands
 *  back the same Set every time instead of a fresh one per render. */
const NO_ONE_ONLINE: ReadonlySet<string> = new Set<string>();

/**
 * Fetch the badge counts. Deliberately returns them instead of writing state:
 * an effect may not call a function that sets state (it cascades renders), but
 * it may set state from a promise callback. Keeping the fetch state-free is
 * what lets both the effect and `refresh` below use it.
 */
async function fetchCounts(): Promise<Counts> {
  const [reqs, convs] = await Promise.all([
    fetchFriendRequests(),
    apiFetch<{ peerLogin: string; unreadCount: number }[]>(
      "/chat/conversations",
    ).catch(() => []),
  ]);
  return {
    requests: reqs.incoming.length,
    unread: Array.isArray(convs)
      ? convs.reduce((sum, c) => sum + (c.unreadCount || 0), 0)
      : 0,
  };
}

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
 *   - Unread chat count (pushed by ChatPanel via "chat:unread" window events;
 *     polled from REST every 30s as a fallback for when no ChatPanel is
 *     mounted — the widget is closed — or a WS event was missed)
 *   - Online friend IDs (real-time via presence:update)
 *
 * WS events are applied to local state directly — the payloads carry the
 * full data, so there is no REST re-fetch per event. (Re-fetching on every
 * event was tripping the backend rate limiter: 429s during active chats.)
 *
 * Exposes badge counts via useNotifications() for the TopBar/Sidebar.
 *
 * ALSO dispatches window CustomEvents so page-level components (like the
 * friends page) can react to real-time updates without each one opening
 * its own WS connection:
 *   - "friends:request"  — { detail: { request } } a new friend request was received
 *   - "friends:accept"   — { detail: { friend } } your outgoing request was accepted
 *   - "friends:reject"   — { detail: { requestId } } your outgoing request was declined
 *   - "presence:update"  — a friend came online or went offline { detail: { userId, online } }
 */
export default function NotificationProvider({ children }: { children: React.ReactNode }) {
  // Auth status drives the socket lifecycle: connecting registers the user
  // as online (PresenceService), so the connection must follow login/logout
  // in this session — not just whether a token existed at page load.
  const { status } = useAuth();
  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [onlineFriendIds, setOnlineFriendIds] = useState<Set<string>>(new Set());

  const applyCounts = useCallback((counts: Counts) => {
    setFriendRequestCount(counts.requests);
    setUnreadChatCount(counts.unread);
  }, []);

  /** Exposed on the context so consumers can force a re-read after an action
   *  (accepting a request, say). Effects use the fetch + apply pair directly. */
  const refresh = useCallback(async () => {
    if (!getToken()) return;
    try {
      applyCounts(await fetchCounts());
    } catch {
      // ignore — the 30s poll below will retry
    }
  }, [applyCounts]);

  // Logging out clears the badges. Done while rendering rather than in an
  // effect: this is state derived from a change in `status`, and an effect
  // would render the stale counts once before blanking them.
  const [prevStatus, setPrevStatus] = useState(status);
  if (status !== prevStatus) {
    setPrevStatus(status);
    if (status !== "authenticated") {
      setFriendRequestCount(0);
      setUnreadChatCount(0);
      setOnlineFriendIds(NO_ONE_ONLINE as Set<string>);
    }
  }

  // Initial REST load — re-runs when the user logs in mid-session.
  useEffect(() => {
    if (status !== "authenticated" || !getToken()) return;
    let cancelled = false;
    fetchCounts()
      .then((counts) => {
        if (!cancelled) applyCounts(counts);
      })
      .catch(() => {
        // ignore — the 30s poll below will retry
      });
    return () => {
      cancelled = true;
    };
  }, [applyCounts, status]);

  // WS connection for real-time updates. Depends on auth status: logging in
  // opens the socket right away (before this fix, a freshly logged-in user
  // was invisible to friends until they hard-refreshed the page), and
  // logging out closes it (stops appearing online) and clears the badges.
  useEffect(() => {
    // The badge reset for this case happens during render, above.
    if (status !== "authenticated" || !getToken()) return;

    // socket.io reconnects on its own (network blips, a backend restart, the
    // freeze a page takes on entering the back/forward cache). Handlers are
    // registered on this Socket instance, so they survive those reconnects —
    // rebuilding the socket by hand would silently drop them. `auth` is a
    // callback rather than a literal so each attempt re-reads the token
    // instead of replaying whatever was in storage at mount.
    const s = io(SOCIAL_WS, {
      auth: (cb) => cb({ token: getToken() }),
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

    s.on("friends:request", (payload: { request: unknown }) => {
      setFriendRequestCount((prev) => prev + 1);
      // Forward the full request so the friends page can append it locally
      window.dispatchEvent(new CustomEvent("friends:request", { detail: payload }));
    });

    s.on("friends:accept", (payload: { friend: unknown }) => {
      // Someone accepted OUR request — incoming count is unaffected.
      // Forward the new friend so the friends page can insert them locally.
      window.dispatchEvent(new CustomEvent("friends:accept", { detail: payload }));
    });

    s.on("friends:reject", (payload: { requestId: number }) => {
      // Someone turned OUR request down. Incoming count is unaffected; the
      // friends page drops the entry from its outgoing list.
      window.dispatchEvent(new CustomEvent("friends:reject", { detail: payload }));
    });

    s.on("profile:update", () => {
      // A friend's profile (login/displayName/avatar) changed.
      window.dispatchEvent(new CustomEvent("profile:update"));
    });

    // The ChatPanel maintains the conversation list locally and dispatches
    // the recomputed unread total whenever it changes — no REST round-trip.
    const onChatUnread = (e: Event) => {
      const total = (e as CustomEvent<{ total: number }>).detail?.total;
      if (typeof total === "number") setUnreadChatCount(total);
    };
    window.addEventListener("chat:unread", onChatUnread);

    // Poll every 30s as a fallback (covers ChatPanel not mounted / missed events)
    const interval = setInterval(refresh, 30_000);

    return () => {
      s.disconnect();
      window.removeEventListener("chat:unread", onChatUnread);
      clearInterval(interval);
    };
  }, [refresh, status]);

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
