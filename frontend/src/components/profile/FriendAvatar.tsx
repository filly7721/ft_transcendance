import { Avatar } from "./Avatar";

/** Small avatar with online indicator dot. */
export function FriendAvatar({
  login,
  avatarUrl,
  online,
  size = "md",
}: {
  login: string;
  avatarUrl: string | null;
  online?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-16 w-16" : "h-10 w-10";
  return (
    <div className="relative shrink-0">
      <Avatar login={login} avatarUrl={avatarUrl} className={sizeClass} />
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-arcade-bg ${
            online ? "bg-neon-green shadow-[0_0_6px_#00ff88]" : "bg-arcade-muted"
          }`}
        />
      )}
    </div>
  );
}
