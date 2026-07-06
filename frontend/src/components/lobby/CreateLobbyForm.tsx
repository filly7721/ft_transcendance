"use client";

import { useState } from "react";
import Button from "@/components/Button";

const inputClasses =
  "w-full border border-arcade-border bg-arcade-bg px-2 py-1.5 font-mono text-xs text-foreground outline-none transition-colors focus:border-neon-cyan";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-28 shrink-0 font-mono text-[10px] uppercase tracking-widest text-arcade-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

type Props = {
  onCreate: (name: string, maxPlayers: number, options: Record<string, string>) => void;
  onCancel: () => void;
};

// Options are collected into the `options` record — a future option only needs
// a new <Row> here and its key ends up in the lobby automatically.
export default function CreateLobbyForm({ onCreate, onCancel }: Props) {
  const [name, setName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [mode, setMode] = useState("CASUAL");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onCreate(name.trim() || "UNNAMED LOBBY", maxPlayers, { mode });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 border border-neon-yellow/30 bg-arcade-card p-4"
    >
      <p className="font-arcade text-[10px] text-neon-yellow">NEW LOBBY</p>

      <Row label="Name">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="MY LOBBY"
          className={inputClasses}
        />
      </Row>
      <Row label="Max players">
        <select
          value={maxPlayers}
          onChange={(e) => setMaxPlayers(Number(e.target.value))}
          className={inputClasses}
        >
          <option value={2}>2</option>
          <option value={4}>4</option>
        </select>
      </Row>
      <Row label="Mode">
        <select value={mode} onChange={(e) => setMode(e.target.value)} className={inputClasses}>
          <option>CASUAL</option>
          <option>RANKED</option>
        </select>
      </Row>
      {/* TODO: more lobby options land here (timers, board size, private + code…) */}

      <div className="mt-1 flex gap-3">
        <Button type="submit" className="flex-1">
          CREATE
        </Button>
        <Button type="button" onClick={onCancel} className="flex-1">
          CANCEL
        </Button>
      </div>
    </form>
  );
}
