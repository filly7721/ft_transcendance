"use client";

import { useState } from "react";
import Button from "@/components/Button";
import Field from "./Field";

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: POST to the backend auth endpoint and store the session
    setError("AUTH NOT WIRED UP YET");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 border border-arcade-border bg-arcade-panel p-8"
    >
      <Field label="Username" type="text" value={username} onChange={setUsername} />
      <Field label="Password" type="password" value={password} onChange={setPassword} />

      {error && <p className="text-center text-xs font-mono text-neon-red animate-blink">{error}</p>}

      <Button type="submit">INSERT COIN</Button>
    </form>
  );
}
