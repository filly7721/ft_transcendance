// Profile API calls. Mirrors the backend's ProfileController endpoints.
import { apiFetch } from "./api";

export type PublicProfile = {
  id: string;
  login: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  stats: {
    gamesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
  };
};

export type UpdatedProfile = {
  id: string;
  email: string;
  login: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  /** Fresh JWT, present only when the login changed — must replace the stored token. */
  accessToken?: string;
};

export function fetchPublicProfile(login: string): Promise<PublicProfile> {
  return apiFetch<PublicProfile>(`/users/${encodeURIComponent(login)}`);
}

export function updateProfile(data: {
  displayName?: string;
  login?: string;
  avatarUrl?: string;
}): Promise<UpdatedProfile> {
  return apiFetch<UpdatedProfile>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/**
 * Upload an avatar file via multipart/form-data.
 *
 * Uses raw fetch (not apiFetch) because apiFetch sets Content-Type: application/json,
 * but for multipart we need the browser to set the boundary automatically.
 */
export async function uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const API_BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api`;
  const res = await fetch(`${API_BASE}/users/me/avatar`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? res.statusText);
  }

  return res.json();
}

// Import getToken here to avoid circular deps
import { getToken } from "./auth-storage";
