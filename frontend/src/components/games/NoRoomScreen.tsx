import GameNotice from "./GameNotice";

// Shown when a game page is opened without a ?room= search param. Game
// sessions only exist inside a lobby room, so send the player back to the
// lobby browser to create or join one.
export default function NoRoomScreen({ game }: { game: string }) {
  return (
    <GameNotice
      game={game}
      title="NO ROOM SELECTED"
      message="Games run inside lobby rooms. Create a lobby or join one to get a room code — you will be dropped in here automatically."
    />
  );
}
