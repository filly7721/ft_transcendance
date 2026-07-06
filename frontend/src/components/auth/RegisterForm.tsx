"use client";

import { useState } from "react";
import Button from "@/components/Button";
import Field from "./Field";

export default function RegisterForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("PASSWORDS DO NOT MATCH");
      return;
    }
    // TODO: POST to the backend registration endpoint, then log the player in
    setError("REGISTRATION NOT WIRED UP YET");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 border border-arcade-border bg-arcade-panel p-8"
    >
      <Field label="Username" type="text" value={username} onChange={setUsername} />
      <Field label="Password" type="password" value={password} onChange={setPassword} />
      <Field label="Confirm password" type="password" value={confirm} onChange={setConfirm} />

      {error && <p className="text-center text-xs font-mono text-neon-red animate-blink">{error}</p>}

      <Button type="submit">CREATE PLAYER</Button>
    </form>
  );
}
