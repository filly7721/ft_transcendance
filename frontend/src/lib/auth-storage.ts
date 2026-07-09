// localStorage access for the JWT, isolated in one place so callers never
// touch window.localStorage directly (and so SSR-safety only needs handling
// here).
const TOKEN_KEY = "arcade.accessToken";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}
