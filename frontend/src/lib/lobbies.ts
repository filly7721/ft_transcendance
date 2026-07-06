// Lobby data layer. Currently hardcoded — the backend will expose ONE endpoint
// that takes the game in its request body, so both functions here swap to:
//   fetchLobbies:  POST /lobbies        body { game }                 → Lobby[]
//   createLobby:   POST /lobbies/create body { game, name, ... }      → Lobby
// Callers never touch the transport, so only this file changes.

export type Lobby = {
  id: string;
  name: string;
  host: string;
  players: number;
  maxPlayers: number;
  // Open-ended bag for lobby options: future options are just new keys,
  // and the lobby viewer renders whatever is present.
  options: Record<string, string>;
};

export type CreateLobbyInput = {
  game: string;
  name: string;
  maxPlayers: number;
  options: Record<string, string>;
};

const mockLobbies: Record<string, Lobby[]> = {
  minesweeper: [
    { id: "MS-4821", name: "MINE MADNESS", host: "BOMBSQUAD", players: 1, maxPlayers: 2, options: { mode: "CO-OP", board: "9×9" } },
    { id: "MS-1177", name: "NO FLAGS ALLOWED", host: "XYLO", players: 2, maxPlayers: 2, options: { mode: "RACE", board: "16×16" } },
    { id: "MS-3054", name: "SWEEP DREAMS", host: "GRIDLOCK", players: 2, maxPlayers: 4, options: { mode: "RACE", board: "9×9" } },
  ],
  "super-tic-tac-toe": [
    { id: "T3-0042", name: "GRANDMASTERS ONLY", host: "NEONQUEEN", players: 1, maxPlayers: 2, options: { mode: "RANKED" } },
    { id: "T3-0968", name: "CASUAL CORNER", host: "PIXEL_PETE", players: 2, maxPlayers: 2, options: { mode: "CASUAL", timer: "BLITZ" } },
  ],
};

export async function fetchLobbies(game: string): Promise<Lobby[]> {
  // TODO(backend): replace mock with the real request (see header comment)
  return mockLobbies[game] ?? [];
}

export async function createLobby(input: CreateLobbyInput): Promise<Lobby> {
  // TODO(backend): replace mock with the real request (see header comment)
  return {
    id: `${input.game === "minesweeper" ? "MS" : "T3"}-${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`,
    name: input.name,
    host: "YOU",
    players: 1,
    maxPlayers: input.maxPlayers,
    options: input.options,
  };
}
