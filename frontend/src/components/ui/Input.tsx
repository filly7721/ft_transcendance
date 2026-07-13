/**
 * Text input — the arcade-styled field used by the lobby code box, the chat
 * composer, and the search box.
 *
 * `Field` (auth) is the labelled variant built on the same visual rules; this
 * is the bare control for places that supply their own label or none at all.
 * Forwarding `...props` keeps every native input attribute available, so
 * callers set `type`, `maxLength`, `required` and friends directly.
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
      className={`min-w-0 border bg-arcade-bg px-3 py-2 font-mono text-sm text-foreground outline-none transition-colors placeholder:text-arcade-muted disabled:opacity-40 ${
        invalid
          ? "border-neon-red focus:border-neon-red"
          : "border-arcade-border focus:border-neon-cyan"
      } ${className}`}
    />
  );
}
