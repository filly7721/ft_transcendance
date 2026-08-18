import { ButtonLink } from "@/components/Button";

/**
 * The card shown instead of a game when there is no game to show — no room in
 * the URL, or the server refused the connection.
 *
 * It exists because the alternative was rendering the board components with
 * nothing in them: the panels collapsed to the width of their "YOU" / "ENEMY"
 * labels and the page looked broken rather than explanatory.
 */
export default function GameNotice({
  title,
  message,
  game,
  action = "GO TO THE LOBBY",
}: {
  title: string;
  message: string;
  /** Game slug, for the lobby link. */
  game: string;
  action?: string;
}) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6 border border-arcade-border bg-arcade-panel px-6 py-10 sm:px-10 sm:py-12">
      <p className="font-arcade text-sm text-arcade-muted">{title}</p>
      <p className="max-w-xs text-center font-mono text-xs text-foreground/60">
        {message}
      </p>
      <ButtonLink href={`/lobby/${game}`}>{action}</ButtonLink>
    </div>
  );
}
