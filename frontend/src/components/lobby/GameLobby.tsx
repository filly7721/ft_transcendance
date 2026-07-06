import GameDemo from "@/components/games/GameDemo";
import LobbySelector from "./LobbySelector";

// Lobby browser + demo preview, embedded on each game's lobby page.
// TODO: joining a lobby routes into /lobby/<game>/[room-code] — that dynamic
// segment will host the actual game session once rooms exist.
export default function GameLobby({ game }: { game: string }) {
  return (
    <div className="flex w-full flex-col items-start gap-8 xl:flex-row">
      <LobbySelector game={game} />

      {/* Demo preview of the game, replaced by the real board inside a room.
          flex-1 soaks up all leftover width so the selector never moves. */}
      <div className="hidden min-w-0 flex-1 flex-col items-center gap-4 md:flex">
        <p className="self-start font-mono text-[10px] uppercase tracking-widest text-arcade-muted">
          ▸ Demo preview
        </p>
        <GameDemo game={game} />
      </div>
    </div>
  );
}
