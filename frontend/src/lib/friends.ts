// Friends API calls. Mirrors the backend's FriendsController endpoints.
import { apiFetch } from "./api";

export type GameStats = {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
};

export type Friend = {
  id: string;
  login: string;
  displayName: string;
  avatarUrl: string | null;
  online: boolean;
  friendshipId: number;
  friendsSince: string;
  stats: GameStats;
};

export type FriendRequest = {
  id: number;
  login: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
};

export type FriendRequestsResponse = {
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
};

export function fetchFriends(): Promise<Friend[]> {
  return apiFetch<Friend[]>("/friends");
}

export function fetchFriendRequests(): Promise<FriendRequestsResponse> {
  return apiFetch<FriendRequestsResponse>("/friends/requests");
}

export function sendFriendRequest(login: string): Promise<{ id: number; status: string; message: string }> {
  return apiFetch(`/friends/request/${encodeURIComponent(login)}`, { method: "POST" });
}

export function acceptFriendRequest(id: number): Promise<{ message: string }> {
  return apiFetch(`/friends/accept/${id}`, { method: "POST" });
}

export function rejectFriendRequest(id: number): Promise<{ message: string }> {
  return apiFetch(`/friends/reject/${id}`, { method: "POST" });
}

export function unfriend(login: string): Promise<{ message: string }> {
  return apiFetch(`/friends/${encodeURIComponent(login)}`, { method: "DELETE" });
}

export type BlockedUser = {
  id: string;
  login: string;
  displayName: string;
  avatarUrl: string | null;
  blockedAt: string;
};

export function fetchBlocked(): Promise<BlockedUser[]> {
  return apiFetch<BlockedUser[]>("/friends/blocked");
}

/**
 * Block a user. Ends any friendship or pending request between you, stops
 * messages in both directions, and hides each of you from the other's lobby
 * browser.
 */
export function blockUser(login: string): Promise<{ message: string }> {
  return apiFetch(`/friends/block/${encodeURIComponent(login)}`, {
    method: "POST",
  });
}

/** Lift your own block. Does not restore the friendship. */
export function unblockUser(login: string): Promise<{ message: string }> {
  return apiFetch(`/friends/block/${encodeURIComponent(login)}`, {
    method: "DELETE",
  });
}
