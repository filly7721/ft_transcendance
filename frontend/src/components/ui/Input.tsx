/**
 * Text input — the arcade-styled field used by the lobby code box, the chat
 * composer, and the search box.
 *
 * `Field` (auth) is the labelled variant built on the same visual rules; this
 * is the bare control for places that supply their own label or none at all.
 * Forwarding `...props` keeps every native input attribute available, so
 * callers set `type`, `maxLength`, `required` and friends directly.
 *
 * The font size is 16px up to `sm` and the design's 12px above it: iOS Safari
 * zooms the whole page in when a focused field is smaller than 16px, and the
 * page never zooms back out. For the same reason, callers must not override the
 * font size with a plain `text-xs` — use `sm:text-xs` if a variant needs one.
 */
type Props = React.ComponentProps<"input"> & {
  /** Draw the field in the error colour (e.g. a rejected room code). */
  invalid?: boolean;
};

export default function Input({
  invalid = false,
  className = "",
  ...props
}: Props) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={`min-w-0 border bg-arcade-bg px-3 py-2 font-mono text-base text-foreground outline-none transition-colors placeholder:text-arcade-muted disabled:opacity-40 sm:py-1.5 sm:text-xs ${
        invalid
          ? "border-neon-red focus:border-neon-red"
          : "border-arcade-border focus:border-neon-cyan"
      } ${className}`}
    />
  );
}
