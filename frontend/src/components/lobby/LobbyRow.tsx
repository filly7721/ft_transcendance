"use client";

import { useState } from "react";
import Button from "@/components/Button";
import type { Lobby } from "@/lib/lobbies";

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="border border-arcade-border/60 px-2 py-0.5 font-mono text-[10px] uppercase text-arcade-muted">
      {label}: <span className="text-foreground/70">{value}</span>
    </span>
  );
}

// One lobby in the list: compact summary row, options tucked behind a toggle
export default function LobbyRow({ lobby, onJoin }: { lobby: Lobby; onJoin: () => void }) {
  const [open, setOpen] = useState(false);
  const full = lobby.players >= lobby.maxPlayers;

  return (
    <li className="border border-arcade-border bg-arcade-card">
      <div className="flex items-center gap-3 p-3">
        <button
          onClick={() => setOpen(!open)}
          aria-label="Toggle lobby details"
          className="cursor-pointer font-mono text-xs text-arcade-muted transition-colors hover:text-neon-cyan"
        >
          {open ? "▾" : "▸"}
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate font-arcade text-[10px]">{lobby.name}</p>
          <p className="truncate font-mono text-[10px] uppercase text-arcade-muted">
            Host: {lobby.host}
          </p>
        </div>

        <span className={`font-mono text-xs ${full ? "text-neon-red" : "text-neon-green"}`}>
          {lobby.players}/{lobby.maxPlayers}
        </span>
        <Button onClick={onJoin} disabled={full}>
          {full ? "FULL" : "JOIN"}
        </Button>
      </div>

      {open && (
        <div className="flex flex-wrap gap-2 border-t border-arcade-border/50 px-3 py-2">
          <Chip label="id" value={lobby.id} />
          {Object.entries(lobby.options).map(([key, value]) => (
            <Chip key={key} label={key} value={value} />
          ))}
        </div>
      )}
    </li>
  );
}
