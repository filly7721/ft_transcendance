import MinesweeperDemo from "./MinesweeperDemo";
import SuperTttDemo from "./SuperTttDemo";

// Maps a game registry slug to its demo board.
// TODO: swap demos for the real game views once gameplay lands
const demos: Record<string, React.ComponentType> = {
  minesweeper: MinesweeperDemo,
  "super-tic-tac-toe": SuperTttDemo,
};

export default function GameDemo({ game }: { game: string }) {
  const Demo = demos[game];
  return Demo ? <Demo /> : null;
}
