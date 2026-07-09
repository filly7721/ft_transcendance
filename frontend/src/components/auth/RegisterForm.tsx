"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import Field from "./Field";
import { useAuth } from "./AuthProvider";
import { ApiError } from "@/lib/api";

export default function RegisterForm() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("PASSWORDS DO NOT MATCH");
      return;
    }
    setPending(true);
    try {
      await register(email, username, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message.toUpperCase() : "REGISTRATION FAILED");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 border border-arcade-border bg-arcade-panel p-8"
    >
      <Field label="Email" type="email" value={email} onChange={setEmail} />
      <Field label="Username" type="text" value={username} onChange={setUsername} />
      <Field label="Password" type="password" value={password} onChange={setPassword} />
      <Field label="Confirm password" type="password" value={confirm} onChange={setConfirm} />

      {error && <p className="text-center text-xs font-mono text-neon-red animate-blink">{error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "CREATING..." : "CREATE PLAYER"}
      </Button>
    </form>
  );
}
