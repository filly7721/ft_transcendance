/** Avatar component — shows the user's avatar or a default.
 *
 * The avatarUrl stored in the DB is a full API path like
 * "/api/uploads/avatars/<file>.png". The frontend constructs the full URL
 * as `API_ROOT + avatarUrl` where API_ROOT is the backend origin
 * (e.g. "http://localhost:3001"). The /api prefix is already in avatarUrl.
 *
 * NEXT_PUBLIC_API_URL may be "http://localhost:3001" or "http://localhost:3001/api"
 * — we strip the trailing /api so API_ROOT is always just the origin.
 */
export function Avatar({
  login,
  avatarUrl,
  className = "h-10 w-10",
}: {
  login: string;
  avatarUrl: string | null;
  className?: string;
}) {
  const API_ROOT = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/api$/, "");

  if (avatarUrl) {
    return (
      <img
        src={`${API_ROOT}${avatarUrl}`}
        alt={login}
        className={`${className} rounded border border-arcade-border object-cover`}
      />
    );
  }

  const initial = login.charAt(0).toUpperCase();
  return (
    <div
      className={`${className} flex items-center justify-center rounded border border-neon-cyan/30 bg-arcade-bg font-arcade text-sm text-neon-cyan`}
    >
      {initial}
    </div>
  );
}
