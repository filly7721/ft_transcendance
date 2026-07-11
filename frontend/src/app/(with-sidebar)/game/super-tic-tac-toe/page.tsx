import GamePageHeader from "@/components/games/GamePageHeader";
import NoRoomScreen from "@/components/games/NoRoomScreen";
import SuperTtt from "@/components/games/SuperTtt";

// Game sessions are keyed by the lobby room code: the lobby browser routes
// here as /game/super-tic-tac-toe?room=<code> and the same code is handed to
// the game socket, so both players who joined the lobby land in one session.
export default async function SuperTicTacToeGame({
  searchParams,
}: PageProps<"/game/super-tic-tac-toe">) {
  const { room } = await searchParams;
  const roomCode = typeof room === "string" && room.length > 0 ? room : null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 py-12">
      <GamePageHeader slug="super-tic-tac-toe" />

      {roomCode ? (
        <SuperTtt lobbyCode={roomCode} />
      ) : (
        <NoRoomScreen game="super-tic-tac-toe" />
      )}
    </div>
  );
}
