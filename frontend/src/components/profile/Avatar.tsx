/** Avatar component — shows the user's avatar or a default. */
export function Avatar({
  login,
  avatarUrl,
  className = "h-10 w-10",
}: {
  login: string;
  avatarUrl: string | null;
  className?: string;
}) {
  const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api").replace(/\/api$/, "");

  if (avatarUrl) {
    return (
      <img
        src={`${API_BASE}${avatarUrl}`}
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
