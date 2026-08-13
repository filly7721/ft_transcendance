"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * What to do when the game socket refuses the connection.
 *
 * Both gateways reject with the same vocabulary, so the handling lives here
 * rather than twice. The reasons split in two:
 *
 *  - Nothing to wait for and nothing to do on this page — the room does not
 *    exist, or you are not one of its members. Sitting on a dead game page
 *    helps nobody, so we show why and go back to the lobby.
 *  - Everything else stays put behind an explanatory card. A full room might
 *    be worth retrying, `superseded` means the game is alive in another tab
 *    and bouncing this one would be confusing, and a rate limit or a missing
 *    login are not fixed by the lobby browser.
 */
const AUTO_RETURN: ReadonlySet<string> = new Set(["invalid_lobby"]);

/** How long the reason stays on screen before the redirect. Long enough to
 *  read, short enough not to feel stuck. */
const READ_MS = 1500;

/** Copy per rejection reason: a heading and the sentence under it. */
const COPY: Record<string, { title: string; message: string }> = {
  invalid_lobby: {
    title: "ROOM NOT FOUND",
    message:
      "That room code does not match a lobby you have joined. Taking you back to the lobby browser…",
  },
  lobby_full: {
    title: "ROOM IS FULL",
    message:
      "Both seats in this room are taken. Pick another lobby, or create one of your own.",
  },
  unauthorized: {
    title: "NOT SIGNED IN",
    message: "You need to be logged in to play online. Sign in and try again.",
  },
  rate_limited: {
    title: "TOO MANY CONNECTIONS",
    message:
      "Too many game connections from your network at once. Close any other tabs running a game and try again.",
  },
  superseded: {
    title: "PLAYING ELSEWHERE",
    message:
      "You opened this game in another tab or window — the game is running there now.",
  },
};

const FALLBACK = {
  title: "COULD NOT JOIN",
  message: "The game server refused the connection.",
};

/**
 * Turn a rejection reason into the card to render, and send the player back
 * to the lobby when there is nothing else for them here.
 *
 * @param reason the raw `game:error` reason, or null while not rejected
 * @param game   game slug, for the lobby route
 */
export function useRejection(reason: string | null, game: string) {
  const router = useRouter();
  const shouldReturn = reason !== null && AUTO_RETURN.has(reason);

  useEffect(() => {
    if (!shouldReturn) return;
    // `replace`, not `push`: Back must not drop the player into the same dead
    // room they were just bounced out of.
    const timer = setTimeout(() => router.replace(`/lobby/${game}`), READ_MS);
    return () => clearTimeout(timer);
  }, [shouldReturn, router, game]);

  if (reason === null) return null;
  return COPY[reason] ?? FALLBACK;
}
