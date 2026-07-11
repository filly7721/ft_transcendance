"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { useAuth } from "@/components/auth/AuthProvider";

// Route group layout: everything in (with-sidebar) gets the sidebar.
// Pages that only need the top bar (e.g. /login) live outside this group.
// Requires a logged-in session: guests are redirected to /login, and nothing
// renders while the session is still hydrating (avoids a flash of protected
// content before the token has been verified against /users/me).
export default function WithSidebarLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "guest") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated") return null;

  return (
    <>
      <Sidebar />
      <main className="min-w-0 flex-1">{children}</main>
      <ChatWidget />
    </>
  );
}
