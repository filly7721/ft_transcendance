// Central registry of games. Sidebar and home page both read from here,
// so adding a game = one entry here + a page under app/games/<slug>/.
export type GameAccent = "cyan" | "magenta";

export type Game = {
  slug: string;
  title: string;
  description: string;
  icon: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  accent: GameAccent;
};

export const games: Game[] = [
  {
    slug: "minesweeper",
    title: "MINESWEEPER",
    description: "Clear the minefield. One wrong click ends it all.",
    icon: "💣",
    difficulty: "MEDIUM",
    accent: "cyan",
  },
  {
    slug: "super-tic-tac-toe",
    title: "SUPER TTT",
    description: "9 boards. Win three. Outsmart your opponent.",
    icon: "⊞",
    difficulty: "HARD",
    accent: "magenta",
  },
];

export const gameHref = (game: Game) => `/games/${game.slug}`;
