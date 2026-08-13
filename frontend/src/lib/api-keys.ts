// Public-API key management. Mirrors the backend's ApiKeysController.
//
// Every call here is scoped to the signed-in user by the backend — the routes
// take no user id, they read it off the JWT — so there is no way to ask for
// somebody else's key from this client.
import { apiFetch } from "./api";

export type ApiKey = {
  id: string;
  name: string;
  /** Display fragment of the secret ("arc_9f3c1a2b"). The rest is unrecoverable. */
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

/** The mint response — the only payload that ever carries the secret. */
export type CreatedApiKey = ApiKey & { key: string };

/** The caller's active key, or null if they hold none. */
export function fetchActiveApiKey(): Promise<ApiKey | null> {
  return apiFetch<ApiKey | null>("/keys/active");
}

/** Mint a key. Rejects with a 409 ApiError if one is already active. */
export function createApiKey(name: string): Promise<CreatedApiKey> {
  return apiFetch<CreatedApiKey>("/keys", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function revokeApiKey(id: string): Promise<ApiKey> {
  return apiFetch<ApiKey>(`/keys/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
