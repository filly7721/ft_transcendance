"use client";

import { useEffect, useState } from "react";
import Button from "@/components/Button";
import { Avatar } from "@/components/profile/Avatar";
import { useAuth } from "@/components/auth/AuthProvider";
import { updateProfile, uploadAvatar } from "@/lib/profile";
import { deleteAccount } from "@/lib/auth";
import { setToken } from "@/lib/auth-storage";

export default function SettingsPage() {
  const { user, logout, refreshUser } = useAuth();
  const [login, setLogin] = useState(user?.login ?? "");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // On a hard refresh the user loads asynchronously, so the useState
  // initializers above ran with user = null and the fields stayed empty.
  // Re-sync whenever the loaded user changes (also refills after a save).
  useEffect(() => {
    if (!user) return;
    setLogin(user.login);
    setDisplayName(user.displayName);
  }, [user]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setError(null);

    // Only send what actually changed — sending an unchanged login would
    // still round-trip the uniqueness check, and an empty field (user not
    // loaded yet) must never be submitted.
    const changes: { login?: string; displayName?: string } = {};
    if (user && login.trim() && login !== user.login) changes.login = login.trim();
    if (user && displayName.trim() && displayName !== user.displayName)
      changes.displayName = displayName.trim();
    if (Object.keys(changes).length === 0) {
      setNotice("Nothing to update");
      return;
    }

    try {
      const result = await updateProfile(changes);
      // Changing the login reissues the JWT (the payload embeds the login);
      // store it, or every later request/socket keeps the stale identity.
      if (result.accessToken) setToken(result.accessToken);
      setNotice("Profile updated");
      await refreshUser();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    }
  }

  async function handleDeleteAccount() {
    if (!confirm("Delete your account? This cannot be undone.")) return;
    const password = prompt("Enter your password to confirm deletion:");
    if (!password) return;
    setError(null);
    try {
      await deleteAccount(password);
      logout();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to delete account");
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadAvatar(file);
      setNotice("Avatar uploaded");
      await refreshUser();
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <h1 className="mb-6 font-arcade text-xl text-neon-cyan">SETTINGS</h1>
      {notice && <p className="mb-4 font-mono text-xs text-neon-green">{notice}</p>}
      {error && <p className="mb-4 font-mono text-xs text-neon-red">{error}</p>}

      {/* Current avatar preview */}
      <div className="mb-8 flex items-center gap-4 border border-arcade-border bg-arcade-panel p-4">
        <Avatar login={user?.login ?? "?"} avatarUrl={user?.avatarUrl ?? null} className="h-16 w-16" />
        <div>
          <p className="font-arcade text-[10px] text-arcade-muted">CURRENT AVATAR</p>
          <p className="font-mono text-xs">{user?.avatarUrl ? "Custom" : "Default"}</p>
        </div>
      </div>

      {/* Login + Display name */}
      <form onSubmit={handleSaveProfile} className="mb-8 border border-arcade-border bg-arcade-panel p-4">
        <h2 className="mb-3 font-arcade text-[10px] text-arcade-muted">PROFILE</h2>

        <label className="mb-1 block font-mono text-[10px] uppercase text-arcade-muted">Login (username)</label>
        <input
          type="text"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          maxLength={20}
          pattern="[a-zA-Z0-9_-]+"
          title="Letters, digits, _ and - only"
          className="mb-3 w-full border border-arcade-border bg-arcade-bg px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:border-neon-cyan"
        />

        <label className="mb-1 block font-mono text-[10px] uppercase text-arcade-muted">Display Name</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={20}
          className="mb-3 w-full border border-arcade-border bg-arcade-bg px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:border-neon-cyan"
        />

        <Button type="submit">SAVE</Button>
      </form>

      {/* Avatar upload */}
      <div className="mb-8 border border-arcade-border bg-arcade-panel p-4">
        <h2 className="mb-3 font-arcade text-[10px] text-arcade-muted">UPLOAD NEW AVATAR</h2>
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarChange} disabled={uploading} className="mb-3 w-full font-mono text-xs text-arcade-muted file:cursor-pointer file:border file:border-neon-yellow/40 file:bg-transparent file:px-3 file:py-1 file:font-arcade file:text-[10px] file:text-neon-yellow" />
        <p className="font-mono text-[10px] text-arcade-muted">PNG, JPEG, or WebP. Max 2MB.</p>
        {uploading && <p className="mt-2 font-mono text-xs text-neon-cyan animate-blink">UPLOADING...</p>}
      </div>

      {/* Danger zone */}
      <div className="border border-neon-red/30 bg-arcade-panel p-4">
        <h2 className="mb-3 font-arcade text-[10px] text-neon-red">DANGER ZONE</h2>
        <Button onClick={handleDeleteAccount} className="border-neon-red/40 text-neon-red hover:border-neon-red hover:shadow-[0_0_8px_#ff004040]">DELETE ACCOUNT</Button>
      </div>
    </div>
  );
}
