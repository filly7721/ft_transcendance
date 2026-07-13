// Lobby data layer, backed by the backend's lobbies endpoints:
//   fetchLobbies:  GET  /lobbies?game=<slug>       → Lobby[]  (public)
//   createLobby:   POST /lobbies                   → Lobby    (JWT)
//   joinLobby:     POST /lobbies/<room-code>/join  → Lobby    (JWT)
// Callers never touch the transport, so only this file knows the routes.
// Errors surface as ApiError (see lib/api.ts) with the backend's message.

import { apiFetch } from "./api";

export type Lobby = {
  /** Room code ("xxx-xxx-xxx") — both the list id and the join secret. */
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

export async function fetchLobbies(game: string): Promise<Lobby[]> {
  return apiFetch<Lobby[]>(`/lobbies?game=${encodeURIComponent(game)}`);
}

export async function createLobby(input: CreateLobbyInput): Promise<Lobby> {
  return apiFetch<Lobby>("/lobbies", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function joinLobby(roomCode: string): Promise<Lobby> {
  return apiFetch<Lobby>(`/lobbies/${encodeURIComponent(roomCode)}/join`, {
    method: "POST",
  });
}
