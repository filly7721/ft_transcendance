"use client";

import { useEffect } from "react";

/**
 * Gracefully handles Back-Forward Cache (bfcache) for WebSocket connections.
 *
 * PROBLEM: When Chrome navigates back/forward, it may freeze the page in
 * bfcache. WebSocket connections are frozen too — Chrome logs warnings:
 *   "WebSocket connection failed: Page entered Back-Forward Cache"
 *   "WebSocket connection to ws://localhost:3001/socket.io/ failed:
 *    Page entered Back-Forward Cache"
 *
 * These are harmless warnings (not errors), but they clutter the console
 * and can cause stale socket state when the page is restored.
 *
 * FIX: Listen for `pagehide` (fires before bfcache freeze) and disconnect
 * the socket. Listen for `pageshow` (fires when restored from bfcache) and
 * reconnect. This prevents the warnings and ensures a fresh connection
 * when the user navigates back.
 *
 * Usage: pass the socket ref and a reconnect function.
 *
 *   useBfcache(socketRef, () => { socketRef.current = createChatSocket(); });
 */
export function useBfcache(
  socketRef: React.MutableRefObject<unknown>,
  reconnect: () => void,
): void {
  useEffect(() => {
    const handlePageHide = (e: PageTransitionEvent) => {
      // Disconnect the socket before the page enters bfcache.
      // This prevents the "WebSocket failed: Page entered Back-Forward Cache"
      // warning and ensures a clean state.
      const socket = socketRef.current as { disconnect?: () => void } | null;
      if (socket?.disconnect) {
        socket.disconnect();
      }
    };

    const handlePageShow = (e: PageTransitionEvent) => {
      // If the page was restored from bfcache, reconnect the socket.
      // e.persisted is true when the page comes from bfcache.
      if (e.persisted) {
        reconnect();
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [socketRef, reconnect]);
}
