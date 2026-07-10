// Social WebSocket hook — real-time presence + friend request notifications.
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { getToken } from "./auth-storage";

const WS_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/social`;

export type SocialState = {
  /** Set of friend logins who are currently online. */
  onlineFriends: Set<string>;
  /** Number of pending incoming friend requests. */
  pendingRequests: number;
  /** Whether the socket is connected. */
  connected: boolean;
};

/**
 * Connects to the /social WebSocket namespace and tracks:
 *   - Online friends (updates in real-time via presence:update events)
 *   - Pending friend request count (updates via friends:request events)
 *
 * Also exposes the socket so callers can listen for friends:accept events
 * (to refresh the friends list when a request is accepted).
 */
export function useSocialSocket(): SocialState & {
  socket: Socket | null;
  refreshState: () => void;
} {
  const [onlineFriends, setOnlineFriends] = useState<Set<string>>(new Set());
  const [pendingRequests, setPendingRequests] = useState(0);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const connect = useCallback(() => {
    const token = getToken();
    if (!token) return;

    const socket = io(WS_URL, {
      auth: { token },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      // Request initial state
      socket.emit("social:state", {}, (ack: { ok: boolean; data?: { onlineFriends: string[]; pendingRequests: number } }) => {
        if (ack.ok && ack.data) {
          setOnlineFriends(new Set(ack.data.onlineFriends));
          setPendingRequests(ack.data.pendingRequests);
        }
      });
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("presence:update", ({ userId, online }: { userId: string; online: boolean }) => {
      // We get userId but need login — the friends list maps login→id.
      // For simplicity, we just refresh the friends list on any presence change.
      // The friends page will re-fetch and update online status.
      // This is a lightweight trigger.
      window.dispatchEvent(new CustomEvent("presence:update", { detail: { userId, online } }));
    });

    socket.on("friends:request", () => {
      setPendingRequests((prev) => prev + 1);
      window.dispatchEvent(new CustomEvent("friends:request"));
    });

    socket.on("friends:accept", () => {
      window.dispatchEvent(new CustomEvent("friends:accept"));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);

  const refreshState = useCallback(() => {
    socketRef.current?.emit("social:state", {}, (ack: { ok: boolean; data?: { onlineFriends: string[]; pendingRequests: number } }) => {
      if (ack.ok && ack.data) {
        setOnlineFriends(new Set(ack.data.onlineFriends));
        setPendingRequests(ack.data.pendingRequests);
      }
    });
  }, []);

  return {
    onlineFriends,
    pendingRequests,
    connected,
    socket: socketRef.current,
    refreshState,
  };
}
