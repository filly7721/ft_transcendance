type Props = {
  /** Section number. Explicit rather than derived, because the documents
   *  refer to each other by number ("see section 8"). */
  n: number;
  title: string;
  children: React.ReactNode;
};

/**
 * One numbered clause of a legal document.
 *
 * Body copy is styled from here with child selectors so the pages themselves
 * stay plain semantic HTML — a paragraph is a `<p>`, not a `<p className=…>`
 * repeated forty times across two documents.
 */
export default function Section({ n, title, children }: Props) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-arcade text-[11px] leading-relaxed text-neon-cyan">
        {n}. {title}
      </h2>
      <div
        className="flex flex-col gap-3 font-mono text-sm leading-relaxed text-foreground/85
          [&_a]:text-neon-cyan [&_a]:underline [&_a]:underline-offset-2
          [&_strong]:font-semibold [&_strong]:text-foreground
          [&_code]:text-neon-green
          [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5
          [&_li]:marker:text-arcade-muted"
      >
        {children}
      </div>
    </section>
  );
}
