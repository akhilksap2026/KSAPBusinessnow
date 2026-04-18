import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuthRole, ROLE_LABELS, type Role } from "@/lib/auth";
import { useCallback } from "react";
import {
  LayoutDashboard, FolderKanban, Users, DollarSign,
  Building2, BarChart3, Settings2, Truck, LogOut,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const ROLE_INITIALS: Record<string, string> = {
  admin:              "AD",
  executive:          "EX",
  delivery_director:  "DD",
  project_manager:    "PM",
  consultant:         "CN",
  resource_manager:   "RM",
  finance_lead:       "FM",
  sales:              "BD",
  account_manager:    "AM",
  client_stakeholder: "CL",
};

interface RailSection {
  id: string;
  icon: React.ElementType;
  label: string;
  href: string;
  roles?: Role[];
  matchPrefixes?: string[];
}

const RAIL_SECTIONS: RailSection[] = [
  {
    id: "home",
    icon: LayoutDashboard,
    label: "Home",
    href: "/",
    matchPrefixes: ["/dashboard"],
  },
  {
    id: "projects",
    icon: FolderKanban,
    label: "Projects",
    href: "/projects",
    roles: ["admin","delivery_director","project_manager","consultant","resource_manager","finance_lead","executive"],
    matchPrefixes: ["/projects","/milestones","/tasks","/timesheets"],
  },
  {
    id: "customers",
    icon: Building2,
    label: "Customers",
    href: "/accounts",
    roles: ["admin","delivery_director","project_manager","finance_lead","executive","sales","account_manager"],
    matchPrefixes: ["/accounts", "/customers", "/prospects", "/opportunities"],
  },
  {
    id: "people",
    icon: Users,
    label: "People",
    href: "/resources",
    roles: ["admin","delivery_director","project_manager","resource_manager"],
    matchPrefixes: ["/resources","/allocations","/capacity"],
  },
  {
    id: "finance",
    icon: DollarSign,
    label: "Finance",
    href: "/finance",
    roles: ["admin","finance_lead","project_manager","delivery_director","executive"],
    matchPrefixes: ["/finance","/invoices","/contracts","/changes"],
  },
  {
    id: "reports",
    icon: BarChart3,
    label: "Reports",
    href: "/portfolio",
    roles: ["admin","executive","delivery_director","project_manager"],
    matchPrefixes: ["/portfolio"],
  },
  {
    id: "settings",
    icon: Settings2,
    label: "Settings",
    href: "/admin",
    roles: ["admin"],
    matchPrefixes: ["/templates","/admin","/settings"],
  },
];

export function GlobalRail() {
  const [location, navigate] = useLocation();
  const { role, user, setRole } = useAuthRole();

  const handleLogout = useCallback(() => {
    setRole(null);
    navigate("/login");
  }, [setRole, navigate]);

  const visibleSections = RAIL_SECTIONS.filter(s => !s.roles || !role || s.roles.includes(role));

  function isActive(s: RailSection) {
    if (s.href === "/" && location === "/") return true;
    if (s.href !== "/" && location.startsWith(s.href)) return true;
    if (s.matchPrefixes?.some(p => location.startsWith(p))) return true;
    return false;
  }

  return (
    <div className="w-14 shrink-0 bg-sidebar flex flex-col items-center py-3 gap-1 border-r border-sidebar-border h-[100dvh] sticky top-0 z-20">
      {/* Logo */}
      <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center mb-3 shrink-0">
        <Truck className="h-4.5 w-4.5 text-primary-foreground" />
      </div>

      <div className="w-px h-px mb-1" />

      {/* Nav items */}
      <nav className="flex flex-col items-center gap-0.5 flex-1">
        {visibleSections.map(s => {
          const active = isActive(s);
          return (
            <Link key={s.id} href={s.href} title={s.label}>
              <div className={cn(
                "w-9 h-9 flex items-center justify-center rounded-xl transition-all",
                active
                  ? "bg-sidebar-accent text-foreground"
                  : "text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}>
                <s.icon className="h-4 w-4" />
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User + sign out */}
      <div className="flex flex-col items-center gap-1.5 mt-auto">
        {role && (
          <div title={user ? `${user.name} · ${ROLE_LABELS[role] ?? role}` : (ROLE_LABELS[role] ?? role)} className="w-9 h-9 flex items-center justify-center">
            <Avatar className="h-7 w-7 border border-sidebar-border">
              <AvatarFallback className="bg-primary/20 text-primary text-[9px] font-bold">
                {user ? user.initials : (ROLE_INITIALS[role] ?? "??")}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
        <button
          onClick={handleLogout}
          title="Sign out"
          className="w-9 h-9 flex items-center justify-center rounded-xl text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
