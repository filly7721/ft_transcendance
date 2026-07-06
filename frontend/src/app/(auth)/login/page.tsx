import Link from "next/link";
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-8 text-center font-arcade text-xl glow-yellow animate-glow-pulse">
        PLAYER LOGIN
      </h1>

      <LoginForm />

      <p className="mt-6 text-center text-xs font-mono uppercase tracking-widest text-arcade-muted">
        New player?{" "}
        <Link href="/register" className="text-neon-cyan transition-colors hover:glow-cyan">
          Register
        </Link>
      </p>
    </>
  );
}
