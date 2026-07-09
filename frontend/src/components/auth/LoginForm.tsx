"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import Field from "./Field";
import { useAuth } from "./AuthProvider";
import { ApiError } from "@/lib/api";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message.toUpperCase() : "LOGIN FAILED");
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
      <Field label="Password" type="password" value={password} onChange={setPassword} />

      {error && <p className="text-center text-xs font-mono text-neon-red animate-blink">{error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "CONNECTING..." : "INSERT COIN"}
      </Button>
    </form>
  );
}
