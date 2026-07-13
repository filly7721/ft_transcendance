/**
 * Status pill — online/offline dots, lobby states, win/loss chips, key status.
 *
 * The tones map to the palette's semantic use, which is consistent across the
 * app: green = live/good, red = failed/offline, yellow = waiting, cyan =
 * neutral information, muted = inactive.
 */
type Tone = "green" | "red" | "yellow" | "cyan" | "muted";

type Props = {
  tone?: Tone;
  /** Show the leading status dot. On by default — it is what makes a badge
   *  readable at a glance without relying on colour alone. */
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
};

const TONES: Record<Tone, { text: string; border: string; dot: string }> = {
  green: { text: "text-neon-green", border: "border-neon-green/40", dot: "bg-neon-green" },
  red: { text: "text-neon-red", border: "border-neon-red/40", dot: "bg-neon-red" },
  yellow: { text: "text-neon-yellow", border: "border-neon-yellow/40", dot: "bg-neon-yellow" },
  cyan: { text: "text-neon-cyan", border: "border-neon-cyan/40", dot: "bg-neon-cyan" },
  muted: { text: "text-arcade-muted", border: "border-arcade-border", dot: "bg-arcade-muted" },
};

export default function Badge({
  tone = "cyan",
  dot = true,
  className = "",
  children,
}: Props) {
  const t = TONES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${t.text} ${t.border} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 shrink-0 ${t.dot}`} aria-hidden />}
      {children}
    </span>
  );
}
