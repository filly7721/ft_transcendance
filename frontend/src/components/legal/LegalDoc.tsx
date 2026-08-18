import Link from "next/link";

type Props = {
  title: string;
  /** Effective date, written out ("13 August 2026") rather than a bare date. */
  updated: string;
  /** Plain-language summary, read before the numbered sections. */
  summary: React.ReactNode;
  /** The sibling document. Each legal page links to the other one. */
  other: { href: string; label: string };
  children: React.ReactNode;
};

/**
 * Page shell shared by the Privacy Policy and the Terms of Service.
 *
 * These two pages live outside `(with-sidebar)`, so they render for signed-out
 * visitors as well — someone reading the terms before registering must not be
 * bounced to /login. That also means there is no sidebar here, hence the
 * self-centering column instead of the usual page padding.
 */
export default function LegalDoc({
  title,
  updated,
  summary,
  other,
  children,
}: Props) {
  return (
    <main className="min-w-0 flex-1 px-4 py-10 sm:px-6 sm:py-12">
      <article className="mx-auto flex max-w-3xl flex-col gap-10">
        <header className="flex flex-col gap-4 border-b border-arcade-border pb-8">
          <h1 className="font-arcade text-base leading-relaxed glow-cyan sm:text-lg">
            {title}
          </h1>
          <p className="font-mono text-[10px] uppercase tracking-widest text-arcade-muted">
            Last updated {updated}
          </p>
          <p className="font-mono text-sm leading-relaxed text-foreground/85">
            {summary}
          </p>
        </header>

        <div className="flex flex-col gap-9">{children}</div>

        <footer className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-arcade-border pt-6 font-mono text-xs uppercase tracking-widest text-arcade-muted">
          <Link
            href={other.href}
            className="transition-colors hover:text-neon-cyan"
          >
            Read the {other.label}
          </Link>
          <Link href="/" className="transition-colors hover:text-neon-cyan">
            Back to ARCADE
          </Link>
        </footer>
      </article>
    </main>
  );
}
