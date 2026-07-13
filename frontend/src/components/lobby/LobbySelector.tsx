"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import Icon from "@/components/ui/Icon";
import Input from "@/components/ui/Input";
import { ApiError } from "@/lib/api";
import { gameRoomHref } from "@/lib/games";
import { createLobby, fetchLobbies, joinLobby, type Lobby } from "@/lib/lobbies";
import CreateLobbyForm from "./CreateLobbyForm";
import LobbyRow from "./LobbyRow";

type Props = {
  // Registry slug ("minesweeper" | "super-tic-tac-toe") — the backend takes
  // this as the ?game= filter, so this prop is all the API needs.
  game: string;
};

// One status line under the list serves both progress and errors.
type Status = { text: string; error: boolean };

function statusFromError(err: unknown, fallback: string): Status {
  const text =
    err instanceof ApiError ? err.message.toUpperCase() : fallback;
  return { text, error: true };
}

export default function LobbySelector({ game }: Props) {
  const router = useRouter();
  const [lobbies, setLobbies] = useState<Lobby[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLobbies(null);
    setStatus(null);
    fetchLobbies(game)
      .then((result) => {
        if (!cancelled) setLobbies(result);
      })
      .catch(() => {
        if (cancelled) return;
        setLobbies([]);
        setStatus({ text: "COULD NOT REACH THE LOBBY SERVER", error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [game]);

  /** Join a room we already know exists, then drop into the game session. */
  async function enterRoom(roomCode: string, label: string) {
    setBusy(true);
    setStatus({ text: `JOINING ${label}…`, error: false });
    try {
      const lobby = await joinLobby(roomCode);
      router.push(gameRoomHref(game, lobby.id));
    } catch (err) {
      setStatus(statusFromError(err, "COULD NOT JOIN THE LOBBY"));
      // The lobby may have filled or died — refresh the list so the row
      // reflects reality instead of the state it had when we clicked.
      fetchLobbies(game).then(setLobbies).catch(() => {});
      setBusy(false);
    }
  }

  async function handleCreate(name: string, maxPlayers: number, options: Record<string, string>) {
    setBusy(true);
    setStatus({ text: "CREATING LOBBY…", error: false });
    try {
      const lobby = await createLobby({ game, name, maxPlayers, options });
      setCreating(false);
      // The creator is already a member — go straight into the room and
      // wait for the opponent there.
      router.push(gameRoomHref(game, lobby.id));
    } catch (err) {
      setStatus(statusFromError(err, "COULD NOT CREATE THE LOBBY"));
      setBusy(false);
    }
  }

  function handleJoinByCode(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || busy) return;
    void enterRoom(trimmed, trimmed.toUpperCase());
  }

  return (
    <section className="flex w-full max-w-md shrink-0 flex-col gap-4 border border-arcade-border bg-arcade-panel p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-arcade text-xs text-arcade-muted">OPEN LOBBIES</h2>
        {!creating && (
          <Button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2"
          >
            <Icon name="plus" /> CREATE LOBBY
          </Button>
        )}
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
            <LobbyRow
              key={lobby.id}
              lobby={lobby}
              onJoin={() => !busy && void enterRoom(lobby.id, lobby.name)}
            />
          ))}
        </ul>
      )}

      {status && (
        <p
          className={`text-center font-mono text-xs ${
            status.error ? "text-neon-red" : "text-neon-green"
          }`}
        >
          {status.text}
        </p>
      )}

      <form onSubmit={handleJoinByCode} className="flex gap-2 border-t border-arcade-border pt-4">
        <Input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="LOBBY CODE"
          invalid={status?.error ?? false}
          className="flex-1 py-1.5 text-xs"
        />
        <Button type="submit" disabled={busy} className="flex items-center gap-2">
          <Icon name="search" /> JOIN BY CODE
        </Button>
      </form>
    </section>
  );
}
