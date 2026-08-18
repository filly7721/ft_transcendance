"use client";

import Icon, { type IconName } from "@/components/ui/Icon";

/** What a plain tap, or a left click, does on the player's own board. */
export type TapMode = "reveal" | "flag";

const MODES: {
  mode: TapMode;
  label: string;
  icon: IconName;
  /** Neon for the selected segment: cyan is the player's colour, and yellow is
   *  the palette's "waiting / marked" tone, which is what a flag is. */
  selected: string;
}[] = [
  {
    mode: "reveal",
    label: "REVEAL",
    icon: "search",
    selected: "border-neon-cyan bg-neon-cyan/10 text-neon-cyan",
  },
  {
    mode: "flag",
    label: "FLAG",
    icon: "flag",
    selected: "border-neon-yellow bg-neon-yellow/10 text-neon-yellow",
  },
];

/**
 * Reveal/flag switch for the player's own board.
 *
 * A touchscreen has no right click, and right click was the only way to place a
 * flag: a tap never fires the board's onContextMenu. This is the equivalent for
 * a finger. It costs a mouse nothing, because right click keeps flagging
 * whatever is selected here.
 *
 * Two buttons rather than one that flips its own label, which is always
 * ambiguous about whether it names the current mode or the one it switches to.
 * aria-pressed is what says which of the two is live.
 */
export default function TapModeToggle({
  mode,
  onChange,
}: {
  mode: TapMode;
  onChange: (mode: TapMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="What a tap does"
      className="flex border border-arcade-border bg-arcade-panel"
    >
      {MODES.map((m) => {
        const isSelected = m.mode === mode;
        return (
          <button
            key={m.mode}
            type="button"
            onClick={() => onChange(m.mode)}
            aria-pressed={isSelected}
            className={`flex cursor-pointer touch-manipulation items-center justify-center gap-2 border px-3 py-2 font-arcade text-[10px] transition-colors ${
              isSelected
                ? m.selected
                : "border-transparent text-arcade-muted hover:text-foreground"
            }`}
          >
            <Icon name={m.icon} />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
