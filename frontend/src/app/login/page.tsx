function Field({ label, type }: { label: string; type: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-mono uppercase tracking-widest text-arcade-muted">
        {label}
      </span>
      <input
        type={type}
        className="w-full border border-arcade-border bg-arcade-bg px-3 py-2 text-sm font-mono text-foreground outline-none transition-colors focus:border-neon-cyan"
      />
    </label>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="mb-8 text-center font-arcade text-xl glow-yellow animate-glow-pulse">
        PLAYER LOGIN
      </h1>

      {/* TODO: wire up to the backend auth endpoints (server action or route handler) */}
      <form className="flex flex-col gap-6 border border-arcade-border bg-arcade-panel p-8">
        <Field label="Username" type="text" />
        <Field label="Password" type="password" />
        <button
          type="submit"
          className="border border-neon-yellow/40 py-3 font-arcade text-xs text-neon-yellow transition-all hover:border-neon-yellow hover:shadow-[0_0_8px_#ffe00040]"
        >
          INSERT COIN
        </button>
        {/* TODO: add REGISTER link and OAuth (42 intra) login */}
      </form>
    </div>
  );
}
