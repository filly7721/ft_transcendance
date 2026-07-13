"use client";

import { useEffect, useRef } from "react";
import Button, { ButtonLink } from "@/components/Button";

// The end-of-game announcement, shared by every game so a win looks the same
// everywhere. The caller decides when it exists (mount it while the game is
// over and the player has not waved it away) — this component only draws it.
//
// Dismissing does NOT restart or leave anything: it just uncovers the final
// board, which players want to look at after a close game.

export type GameOutcome = "win" | "lose" | "draw";

const HEADLINE: Record<GameOutcome, string> = {
  win: "YOU WIN",
  lose: "YOU LOSE",
  draw: "DRAW",
};

// Neon per outcome: green for a win, red for a loss, yellow for a draw.
const PALETTE: Record<GameOutcome, { text: string; border: string; halo: string }> = {
  win: {
    text: "glow-green",
    border: "border-neon-green",
    halo: "shadow-[0_0_40px_#00ff8830]",
  },
  lose: {
    text: "glow-red",
    border: "border-neon-red",
    halo: "shadow-[0_0_40px_#ff224430]",
  },
  draw: {
    text: "glow-yellow",
    border: "border-neon-yellow",
    halo: "shadow-[0_0_40px_#ffe00030]",
  },
};

type Props = {
  outcome: GameOutcome;
  /** One line on how it ended, e.g. "ENEMY HIT A MINE". */
  detail: string;
  /** Where "BACK TO LOBBY" goes — the lobby browser for this game. */
  lobbyHref: string;
  /** Hide the popup and leave the final board on screen. */
  onDismiss: () => void;
};

export default function GameOverModal({
  outcome,
  detail,
  lobbyHref,
  onDismiss,
}: Props) {
  const dismissRef = useRef<HTMLButtonElement>(null);
  const palette = PALETTE[outcome];

  useEffect(() => {
    // Land the focus inside the popup, so Enter/Escape do the obvious thing
    // for anyone not reaching for the mouse.
    dismissRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onDismiss]);

  return (
    <div
      // The backdrop is a click target, but a plain div: the same action sits
      // on the focusable DISMISS button below, so nothing is keyboard-only.
      onClick={onDismiss}
      className="fixed inset-0 z-50 flex items-center justify-center bg-arcade-bg/80 p-6 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-over-headline"
        onClick={(event) => event.stopPropagation()}
        className={`flex animate-pop-in flex-col items-center gap-6 border-2 bg-arcade-panel px-10 py-10 ${palette.border} ${palette.halo}`}
      >
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-arcade-muted">
          GAME OVER
        </p>

        <h2
          id="game-over-headline"
          className={`text-center font-arcade text-2xl sm:text-3xl ${palette.text} animate-glow-pulse`}
        >
          {HEADLINE[outcome]}
        </h2>

        <p className="max-w-xs text-center font-mono text-xs uppercase tracking-widest text-foreground/60">
          {detail}
        </p>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Button ref={dismissRef} onClick={onDismiss}>
            VIEW BOARD
          </Button>
          <ButtonLink href={lobbyHref}>BACK TO LOBBY</ButtonLink>
        </div>
      </div>
    </div>
  );
}
