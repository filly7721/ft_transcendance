// Central registry of games. The sidebar, home page, and lobby pages all read
// from here, so adding a game = one entry here (plus its demo in
// components/games/) — the /lobby/<slug> page comes for free.
import type { IconName } from "@/components/ui/Icon";

export type GameAccent = "cyan" | "magenta";

export type Game = {
  slug: string;
  title: string;
  description: string;
  tagline: string;
  hints: string[];
  /** Emoji used in the large card art on the home page. */
  icon: string;
  /** Name in the pixel icon set — used wherever the game appears at UI scale
   *  (sidebar, lobby rows), where an emoji renders in the OS font and breaks
   *  the pixel look. */
  pixelIcon: IconName;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  accent: GameAccent;
};

export const games: Game[] = [
  {
    slug: "minesweeper",
    title: "MINESWEEPER",
    description: "Clear the minefield. One wrong click ends it all.",
    tagline: "Reveal the field — avoid the mines",
    hints: [
      "Left click reveals a cell",
      "Right click places a flag",
      "Numbers count the mines around them",
    ],
    icon: "💣",
    pixelIcon: "bomb",
    difficulty: "MEDIUM",
    accent: "cyan",
  },
  {
    slug: "super-tic-tac-toe",
    title: "SUPER TTT",
    description: "9 boards. Win three. Outsmart your opponent.",
    tagline: "Win 3 boards in a row to claim victory",
    hints: [
      "Win a mini board to claim it on the outer grid",
      "Your move sends your opponent to that board",
      "Win 3 boards in a row to win the game",
    ],
    icon: "⊞",
    pixelIcon: "grid",
    difficulty: "HARD",
    accent: "magenta",
  },
];

// Tailwind needs literal class names, so accent → class lives in a static map
export const accentGlow: Record<GameAccent, string> = {
  cyan: "glow-cyan",
  magenta: "glow-magenta",
};

export const gameHref = (game: Game) => `/lobby/${game.slug}`;

/** In-room game session URL — where create/join drop you after the lobby. */
export const gameRoomHref = (slug: string, roomCode: string) =>
  `/game/${slug}?room=${encodeURIComponent(roomCode)}`;
