"use client";

import { useState } from "react";
import Button from "@/components/Button";
import { useAuth } from "@/components/auth/AuthProvider";
import { updateProfile, uploadAvatar } from "@/lib/profile";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setError(null);
    try {
      await updateProfile({ displayName });
      setNotice("Display name updated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const result = await uploadAvatar(file);
      setNotice(`Avatar uploaded: ${result.avatarUrl}`);
      // Reload to refresh the user's avatar in the AuthProvider
      window.location.reload();
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

      {/* Display name */}
      <form onSubmit={handleSaveName} className="mb-8 border border-arcade-border bg-arcade-panel p-4">
        <h2 className="mb-3 font-arcade text-[10px] text-arcade-muted">DISPLAY NAME</h2>
        <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={20} className="mb-3 w-full border border-arcade-border bg-arcade-bg px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:border-neon-cyan" />
        <Button type="submit">SAVE</Button>
      </form>

      {/* Avatar upload */}
      <div className="mb-8 border border-arcade-border bg-arcade-panel p-4">
        <h2 className="mb-3 font-arcade text-[10px] text-arcade-muted">AVATAR</h2>
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarChange} disabled={uploading} className="mb-3 w-full font-mono text-xs text-arcade-muted file:cursor-pointer file:border file:border-neon-yellow/40 file:bg-transparent file:px-3 file:py-1 file:font-arcade file:text-[10px] file:text-neon-yellow" />
        <p className="font-mono text-[10px] text-arcade-muted">PNG, JPEG, or WebP. Max 2MB.</p>
        {uploading && <p className="mt-2 font-mono text-xs text-neon-cyan animate-blink">UPLOADING...</p>}
      </div>

      {/* Danger zone */}
      <div className="border border-neon-red/30 bg-arcade-panel p-4">
        <h2 className="mb-3 font-arcade text-[10px] text-neon-red">DANGER ZONE</h2>
        <Button onClick={() => { if (confirm("Delete your account? This cannot be undone.")) logout(); }} className="border-neon-red/40 text-neon-red hover:border-neon-red hover:shadow-[0_0_8px_#ff004040]">DELETE ACCOUNT</Button>
      </div>
    </div>
  );
}
