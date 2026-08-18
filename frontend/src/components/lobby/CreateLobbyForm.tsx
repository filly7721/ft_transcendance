"use client";

import { useState } from "react";
import Button from "@/components/Button";

// text-base up to `sm` for the same reason as <Input>: iOS Safari zooms the
// page in on a focused field whose font is under 16px. The <select> is included
// — it does the same thing.
const inputClasses =
  "w-full border border-arcade-border bg-arcade-bg px-2 py-2 font-mono text-base text-foreground outline-none transition-colors focus:border-neon-cyan sm:py-1.5 sm:text-xs";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Every lobby is casual — there is no ranked mode, and nothing reads this
    // key yet. It stays in the options bag so existing lobbies keep the shape
    // the browser already renders; drop it when something needs the room.
    onCreate(name.trim() || "UNNAMED LOBBY", maxPlayers, { mode: "CASUAL" });
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
        {/* Both current games are 1v1 — reopen this to 4 when a game that
            seats more than two players lands. */}
        <select
          value={maxPlayers}
          onChange={(e) => setMaxPlayers(Number(e.target.value))}
          className={inputClasses}
        >
          <option value={2}>2</option>
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
