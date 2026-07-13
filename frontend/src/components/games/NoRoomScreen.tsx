import { ButtonLink } from "@/components/Button";

// Shown when a game page is opened without a ?room= search param. Game
// sessions only exist inside a lobby room, so send the player back to the
// lobby browser to create or join one.
export default function NoRoomScreen({ game }: { game: string }) {
  return (
    <div className="flex flex-col items-center gap-6 border border-arcade-border bg-arcade-panel px-10 py-12">
      <p className="font-arcade text-sm text-arcade-muted">NO ROOM SELECTED</p>
      <p className="max-w-xs text-center font-mono text-xs text-foreground/60">
        Games run inside lobby rooms. Create a lobby or join one to get a room
        code — you will be dropped in here automatically.
      </p>
      <ButtonLink href={`/lobby/${game}`}>GO TO THE LOBBY</ButtonLink>
    </div>
  );
}
