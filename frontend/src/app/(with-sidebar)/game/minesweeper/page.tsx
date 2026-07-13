import GamePageHeader from "@/components/games/GamePageHeader";
import NoRoomScreen from "@/components/games/NoRoomScreen";
import MinesweeperGame from "./components/MinesweeperGame";

// Game sessions are keyed by the lobby room code: the lobby browser routes
// here as /game/minesweeper?room=<code> and the same code is handed to the
// game socket, so both players who joined the lobby land in one session.
//
// - Enemy board appears on the right, fed by opponent:update events
// - Left-click = open, right-click = flag
// - Backend owns the map and validates every move
// - TODO: working timer + mine counter
// - TODO: clicking the face resets board + timer (needs a backend rematch event)

export default async function MinesweeperGamePage({
  searchParams,
}: PageProps<"/game/minesweeper">) {
  const { room } = await searchParams;
  const roomCode = typeof room === "string" && room.length > 0 ? room : null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 py-12">
      <GamePageHeader slug="minesweeper" />

      {roomCode ? (
        <MinesweeperGame lobbyCode={roomCode} />
      ) : (
        <NoRoomScreen game="minesweeper" />
      )}
    </div>
  );
}
