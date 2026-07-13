/**
 * Panel container — the bordered surface every screen in ARCADE sits on.
 *
 * This markup (`border border-arcade-border bg-arcade-panel`) was copy-pasted
 * across the lobby browser, the auth forms, the profile and the settings page,
 * which meant the surface colour lived in eight places at once. It lives here
 * now.
 *
 * `title` renders the arcade-font header and the rule under it that the panels
 * already had; omit it for a bare surface.
 */
type Props = {
  title?: string;
  /** Neon accent for the title and its underline. Defaults to cyan. */
  accent?: "cyan" | "magenta" | "green" | "yellow";
  className?: string;
  children: React.ReactNode;
};

const ACCENTS: Record<NonNullable<Props["accent"]>, string> = {
  cyan: "text-neon-cyan",
  magenta: "text-neon-magenta",
  green: "text-neon-green",
  yellow: "text-neon-yellow",
};

export default function Card({
  title,
  accent = "cyan",
  className = "",
  children,
}: Props) {
  return (
    <section
      className={`border border-arcade-border bg-arcade-panel p-6 ${className}`}
    >
      {title && (
        <h2
          className={`mb-4 border-b border-arcade-border pb-3 font-arcade text-[11px] ${ACCENTS[accent]}`}
        >
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
