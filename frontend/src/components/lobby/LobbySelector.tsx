"use client";

import { useEffect, useState } from "react";
import Button from "@/components/Button";
import { createLobby, fetchLobbies, type Lobby } from "@/lib/lobbies";
import CreateLobbyForm from "./CreateLobbyForm";
import LobbyRow from "./LobbyRow";

type Props = {
  // Registry slug ("minesweeper" | "super-tic-tac-toe") — the future backend
  // takes this in the request body, so this prop is all the API needs.
  game: string;
};

export default function LobbySelector({ game }: Props) {
  const [lobbies, setLobbies] = useState<Lobby[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLobbies(null);
    setStatus(null);
    fetchLobbies(game).then((result) => {
      if (!cancelled) setLobbies(result);
    });
    return () => {
      cancelled = true;
    };
  }, [game]);

  function handleJoin(lobby: Lobby) {
    // TODO: ask the backend to join, then route into the game session
    setStatus(`JOINING ${lobby.name}… (BACKEND PENDING)`);
  }

  async function handleCreate(name: string, maxPlayers: number, options: Record<string, string>) {
    const lobby = await createLobby({ game, name, maxPlayers, options });
    setLobbies((prev) => [lobby, ...(prev ?? [])]);
    setCreating(false);
    setStatus(`LOBBY ${lobby.id} CREATED — WAITING FOR PLAYERS`);
  }

  function handleJoinByCode(e: React.FormEvent) {
    e.preventDefault();
    // TODO: resolve the code via the backend, then join as above
    if (code.trim()) setStatus(`LOOKING UP ${code.trim().toUpperCase()}… (BACKEND PENDING)`);
  }

  return (
    <section className="flex w-full max-w-md shrink-0 flex-col gap-4 border border-arcade-border bg-arcade-panel p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-arcade text-xs text-arcade-muted">OPEN LOBBIES</h2>
        {!creating && <Button onClick={() => setCreating(true)}>+ CREATE LOBBY</Button>}
      </div>

      {creating && <CreateLobbyForm onCreate={handleCreate} onCancel={() => setCreating(false)} />}

      {lobbies === null ? (
        <p className="py-6 text-center font-mono text-xs text-arcade-muted animate-blink">
          SCANNING FOR LOBBIES…
        </p>
      ) : lobbies.length === 0 ? (
        <p className="py-6 text-center font-mono text-xs text-arcade-muted">
          NO OPEN LOBBIES — CREATE ONE
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lobbies.map((lobby) => (
            <LobbyRow key={lobby.id} lobby={lobby} onJoin={() => handleJoin(lobby)} />
          ))}
        </ul>
      )}

      {status && (
        <p className="text-center font-mono text-xs text-neon-green">{status}</p>
      )}

      <form onSubmit={handleJoinByCode} className="flex gap-2 border-t border-arcade-border pt-4">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="LOBBY CODE"
          className="min-w-0 flex-1 border border-arcade-border bg-arcade-bg px-2 py-1.5 font-mono text-xs text-foreground outline-none transition-colors focus:border-neon-cyan"
        />
        <Button type="submit">JOIN BY CODE</Button>
      </form>
    </section>
  );
}
