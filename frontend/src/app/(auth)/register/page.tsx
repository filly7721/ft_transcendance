import Link from "next/link";
import RegisterForm from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <>
      <h1 className="mb-8 text-center font-arcade text-base glow-yellow animate-glow-pulse sm:text-xl">
        NEW PLAYER
      </h1>

      <RegisterForm />

      <p className="mt-6 text-center text-xs font-mono uppercase tracking-widest text-arcade-muted">
        Already registered?{" "}
        <Link href="/login" className="text-neon-cyan transition-colors hover:glow-cyan">
          Login
        </Link>
      </p>
    </>
  );
}
