import { Briefcase, Building2, KanbanSquare, Users, UserCog } from "lucide-react";
import { NavLink } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };

const mainNav: NavItem[] = [
  { to: "/", label: "Pipeline", icon: KanbanSquare },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/candidates", label: "Candidates", icon: Users },
];

const adminNav: NavItem[] = [
  { to: "/admin/organizations", label: "Organizations", icon: Building2 },
  { to: "/admin/users", label: "Users", icon: UserCog },
];

function NavSection({ title, items }: { title?: string; items: NavItem[] }) {
  return (
    <div className="space-y-1">
      {title && (
        <p className="px-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </p>
      )}
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )
          }
        >
          <Icon className="size-4" />
          {label}
        </NavLink>
      ))}
    </div>
  );
}

export function Sidebar() {
  const { isAdmin } = useAuth();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
      <div className="flex h-14 items-center border-b px-5">
        <span className="text-lg font-semibold tracking-tight">MiniATS</span>
      </div>
      <nav className="flex flex-1 flex-col gap-6 p-3">
        <NavSection items={mainNav} />
        {isAdmin && <NavSection title="Admin" items={adminNav} />}
      </nav>
    </aside>
  );
}
