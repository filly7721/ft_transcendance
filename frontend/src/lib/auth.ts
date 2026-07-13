// Auth API calls. Mirrors the backend's DTOs/response shapes exactly
// (backend/src/auth/dto, backend/src/users/users.service.ts SafeUser).
import { apiFetch } from "./api";

export type GameStats = {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
};

export type User = {
  id: string;
  email: string;
  login: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  stats: GameStats;
};

export type AuthResponse = {
  user: User;
  accessToken: string;
};

export function login(email: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function register(
  email: string,
  login: string,
  password: string,
): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, login, password }),
  });
}

export function fetchMe(): Promise<User> {
  return apiFetch<User>("/users/me");
}

/**
 * Permanently delete the current account. The backend requires the current
 * password so a stolen JWT alone can't destroy an account.
 */
export function deleteAccount(password: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/auth/account", {
    method: "DELETE",
    body: JSON.stringify({ password }),
  });
}
