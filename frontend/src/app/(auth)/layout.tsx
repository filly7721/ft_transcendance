import AuthHero from "@/components/auth/AuthHero";

// Shared split-screen layout for the auth pages (login, register):
// graphics panel on the left, the page's form panel on the right.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1">
      <AuthHero />
      <div className="mx-auto flex w-full max-w-md flex-col justify-center px-8 py-16 lg:mx-0 lg:w-[26rem] lg:border-l lg:border-arcade-border lg:bg-arcade-panel/40">
        {children}
      </div>
    </main>
  );
}
