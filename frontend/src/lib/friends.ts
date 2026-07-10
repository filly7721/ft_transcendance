// Friends API calls. Mirrors the backend's FriendsController endpoints.
import { apiFetch } from "./api";

export type Friend = {
  id: string;
  login: string;
  displayName: string;
  avatarUrl: string | null;
  online: boolean;
  friendshipId: number;
  friendsSince: string;
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
