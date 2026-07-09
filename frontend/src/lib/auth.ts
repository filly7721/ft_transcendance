// Auth API calls. Mirrors the backend's DTOs/response shapes exactly
// (backend/src/auth/dto, backend/src/users/users.service.ts SafeUser).
import { apiFetch } from "./api";

export type User = {
  id: number;
  email: string;
  login: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
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
