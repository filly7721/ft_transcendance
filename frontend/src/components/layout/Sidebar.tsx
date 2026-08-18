import NavLink from "./NavLink";
import { navSections } from "./nav-items";

// Permanent navigation column, from `md` up. Below that the viewport is too
// narrow to spend 13rem on chrome, so the same links live in MobileMenu's
// drawer instead — both render from navSections.
export default function Sidebar() {
  return (
    <aside className="hidden w-52 shrink-0 border-r border-arcade-border bg-arcade-panel/60 py-6 md:block">
      {navSections.map((section) => (
        <div key={section.title} className="mb-8">
          <p className="mb-2 px-4 font-arcade text-[10px] text-arcade-muted">
            {section.title}
          </p>
          <nav>
            {section.items.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                exact={item.exact}
              />
            ))}
          </nav>
        </div>
      ))}
    </aside>
  );
}
