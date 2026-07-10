"use client";

import { use, useEffect, useState } from "react";
import Button from "@/components/Button";
import { Avatar } from "@/components/profile/Avatar";
import { useAuth } from "@/components/auth/AuthProvider";
import { fetchPublicProfile, type PublicProfile } from "@/lib/profile";
import { sendFriendRequest, unfriend, fetchFriends, type Friend } from "@/lib/friends";

export default function ProfilePage({ params }: { params: Promise<{ login: string }> }) {
  const { login } = use(params);
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFriend, setIsFriend] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const isOwnProfile = user?.login === login;

  useEffect(() => {
    setProfile(null);
    setError(null);
    Promise.all([fetchPublicProfile(login), fetchFriends()])
      .then(([p, friends]) => {
        setProfile(p);
        setIsFriend(friends.some((f: Friend) => f.login === login));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "failed to load profile"));
  }, [login]);

  async function handleAddFriend() {
    setNotice(null);
    setError(null);
    try {
      const result = await sendFriendRequest(login);
      setNotice(result.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    }
  }

  async function handleUnfriend() {
    if (!confirm(`Unfriend ${login}?`)) return;
    try {
      await unfriend(login);
      setIsFriend(false);
      setNotice(`Unfriended ${login}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    }
  }

  if (error) return <div className="px-6 py-8 font-mono text-xs text-neon-red">{error}</div>;
  if (!profile) return <div className="px-6 py-8 font-mono text-xs text-arcade-muted animate-blink">LOADING...</div>;

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <div className="flex flex-col items-center gap-4 border border-arcade-border bg-arcade-panel p-6">
        <Avatar login={profile.login} avatarUrl={profile.avatarUrl} className="h-20 w-20" />
        <h1 className="font-arcade text-lg text-neon-cyan">{profile.displayName}</h1>
        <p className="font-mono text-xs text-arcade-muted">@{profile.login}</p>
        <p className="font-mono text-[10px] text-arcade-muted">Joined {new Date(profile.createdAt).toLocaleDateString()}</p>

        {/* Stats */}
        <div className="mt-4 flex gap-6 border-t border-arcade-border pt-4">
          <Stat label="GAMES" value={profile.stats.gamesPlayed} />
          <Stat label="WINS" value={profile.stats.wins} color="text-neon-green" />
          <Stat label="LOSSES" value={profile.stats.losses} color="text-neon-red" />
          <Stat label="DRAWS" value={profile.stats.draws} color="text-arcade-muted" />
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex gap-2">
          {isOwnProfile ? (
            <Button><a href="/settings">EDIT PROFILE</a></Button>
          ) : isFriend ? (
            <>
              <Button><a href={`/chat?peer=${login}`}>MESSAGE</a></Button>
              <Button onClick={handleUnfriend}>UNFRIEND</Button>
            </>
          ) : (
            <Button onClick={handleAddFriend}>ADD FRIEND</Button>
          )}
        </div>
        {notice && <p className="font-mono text-xs text-neon-green">{notice}</p>}
      </div>
    </div>
  );
}

function Stat({ label, value, color = "text-foreground" }: { label: string; value: number; color?: string }) {
  return (
    <div className="text-center">
      <p className={`font-arcade text-lg ${color}`}>{value}</p>
      <p className="font-mono text-[10px] text-arcade-muted">{label}</p>
    </div>
  );
}
