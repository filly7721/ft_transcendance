import Sidebar from "@/components/layout/Sidebar";

// Route group layout: everything in (with-sidebar) gets the sidebar.
// Pages that only need the top bar (e.g. /login) live outside this group.
export default function WithSidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <main className="min-w-0 flex-1">{children}</main>
    </>
  );
}
