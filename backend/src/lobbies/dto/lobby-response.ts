/**
 * Public lobby representation returned by every lobbies endpoint.
 *
 * Mirrors the `Lobby` type the frontend already consumes
 * (see `frontend/src/lib/lobbies.ts`), so the frontend can swap its mock
 * data layer for real HTTP calls without changing any component.
 *
 * `id` is the 9-digit room code ("xxx-xxx-xxx") — it is both the primary key
 * and the secret a player enters to join via "JOIN BY CODE".
 */
export interface LobbyResponse {
  /** Room code, format "xxx-xxx-xxx" (9 random digits, dash-separated). */
  id: string;
  /** Game slug this lobby belongs to. */
  game: string;
  /** Human-readable lobby name. */
  name: string;
  /** Host's public login (username). */
  host: string;
  /** Current number of players (members) in the lobby. */
  players: number;
  /** Maximum number of players the lobby accepts. */
  maxPlayers: number;
  /** Open-ended options bag (e.g. { mode: "CASUAL" }). */
  options: Record<string, string>;
}
