import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuthRole, type Role } from "@/lib/auth";
import {
  LayoutDashboard, FolderKanban, Building2, Users, Clock,
  Target, PieChart, GitMerge, DollarSign, ScrollText,
  ClipboardList, BarChart3, Zap, Settings2, Receipt,
  CheckSquare, Package, UserCircle, Handshake, CreditCard,
  ChevronDown, ChevronRight, Wrench,
} from "lucide-react";

interface NavItem { name: string; href: string; icon: React.ElementType; exact?: boolean; roles?: Role[] }
interface NavSection { label: string; sublabel: string; items: NavItem[] }

// ─── Primary navigation — delivery, staffing, profitability ─────────────────

const SECTIONS: Record<string, NavSection> = {
  Home: {
    label: "Home",
    sublabel: "",
    items: [{ name: "Dashboard", href: "/", icon: LayoutDashboard, exact: true }],
  },
  Pipeline: {
    label: "Pipeline",
    sublabel: "Creates work",
    items: [
      { name: "Customers",     href: "/customers",     icon: Building2 },
      { name: "Prospects",     href: "/prospects",     icon: Target },
      { name: "Opportunities", href: "/opportunities", icon: Handshake },
    ],
  },
  Projects: {
    label: "Projects",
    sublabel: "Delivery & execution",
    items: [
      { name: "Projects",   href: "/projects",  icon: FolderKanban },
      { name: "Milestones", href: "/milestones", icon: Target },
      { name: "Tasks",      href: "/tasks",      icon: CheckSquare },
      { name: "Time Logs",  href: "/timesheets", icon: Clock },
    ],
  },
  People: {
    label: "People",
    sublabel: "Staffing & capacity",
    items: [
      { name: "Team",              href: "/resources",         icon: Users },
      { name: "Assignments",       href: "/allocations",       icon: GitMerge },
      { name: "Staffing Requests", href: "/staffing-requests", icon: UserCircle },
    ],
  },
  Finance: {
    label: "Finance",
    sublabel: "Billing & revenue",
    items: [
      { name: "Financials",    href: "/finance",     icon: DollarSign },
      { name: "Invoices",      href: "/invoices",    icon: Receipt },
      { name: "Rate Cards",    href: "/rate-cards",  icon: CreditCard },
      { name: "Change Orders", href: "/changes",     icon: ClipboardList },
    ],
  },
  Portfolio: {
    label: "Portfolio",
    sublabel: "Leadership view",
    items: [
      { name: "Portfolio View", href: "/portfolio", icon: BarChart3 },
    ],
  },
  Settings: {
    label: "Settings",
    sublabel: "",
    items: [
      { name: "PMO Settings", href: "/settings/pmo", icon: Settings2, roles: ["admin", "delivery_director", "project_manager"] },
      { name: "System Settings", href: "/admin", icon: Settings2, roles: ["admin"] },
    ],
  },
};

// ─── Role → primary sections visible ────────────────────────────────────────

const ROLE_SECTIONS: Record<Role, string[]> = {
  admin:              ["Home", "Pipeline", "Projects", "People", "Finance", "Portfolio", "Settings"],
  executive:          ["Home", "Portfolio", "Pipeline"],
  delivery_director:  ["Home", "Projects", "People", "Portfolio"],
  project_manager:    ["Home", "Projects", "People", "Finance"],
  consultant:         ["Home", "Projects"],
  resource_manager:   ["Home", "Projects", "People"],
  finance_lead:       ["Home", "Finance", "Pipeline", "Projects"],
  sales:              ["Home", "Pipeline", "Portfolio"],
  account_manager:    ["Home", "Pipeline", "Finance"],
  client_stakeholder: [],
  external:           [],
};

// ─── Advanced & Tools — progressively disclosed ──────────────────────────────
// All routes still exist; features are just out of the primary surface.

const ADVANCED_ITEMS: NavItem[] = [
  {
    name: "Capacity Forecast",
    href: "/capacity",
    icon: PieChart,
    roles: ["admin", "delivery_director", "resource_manager", "project_manager"],
  },
  {
    name: "Contracts",
    href: "/contracts",
    icon: ScrollText,
    roles: ["admin", "finance_lead", "project_manager", "account_manager"],
  },
  {
    name: "Project Blueprints",
    href: "/templates",
    icon: Package,
    roles: ["admin", "delivery_director", "project_manager"],
  },
  {
    name: "Automations",
    href: "/automations",
    icon: Zap,
    roles: ["admin", "delivery_director"],
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function ContextSidebar() {
  const [location] = useLocation();
  const { role } = useAuthRole();
  const isOnAdvancedRoute = ADVANCED_ITEMS.some(i => location === i.href || (i.href !== "/" && location.startsWith(i.href)));
  const [showAdvanced, setShowAdvanced] = useState(isOnAdvancedRoute);

  useEffect(() => {
    if (isOnAdvancedRoute) setShowAdvanced(true);
  }, [isOnAdvancedRoute]);

  const allowed = role ? (ROLE_SECTIONS[role] ?? []) : [];

  const seen = new Set<string>();
  const sections = allowed
    .map(key => SECTIONS[key])
    .filter(Boolean)
    .map(s => ({
      ...s,
      items: s.items.filter(i =>
        (!i.roles || i.roles.includes(role as Role)) &&
        !seen.has(i.href) && seen.add(i.href)
      ),
    }))
    .filter(s => s.items.length > 0);

  const advancedVisible = ADVANCED_ITEMS.filter(i =>
    !i.roles || i.roles.includes(role as Role)
  );

  function isActive(href: string, exact?: boolean) {
    if (exact) return location === href;
    return location === href || (href !== "/" && location.startsWith(href));
  }

  return (
    <aside className="w-52 shrink-0 bg-background border-r border-border flex flex-col h-[100dvh] sticky top-0 overflow-y-auto">
      <div className="px-3 py-4 border-b border-border">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">BUSINESSNow</p>
        <p className="text-xs font-medium text-foreground mt-0.5 truncate">Delivery Command Center</p>
      </div>

      <nav className="flex-1 p-3 space-y-5 overflow-y-auto">

        {/* Primary sections */}
        {sections.map(section => (
          <div key={section.label}>
            <div className="px-2 mb-1.5 flex items-baseline gap-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {section.label}
              </p>
              {section.sublabel && (
                <p className="text-[9px] text-muted-foreground/40 truncate leading-none">
                  {section.sublabel}
                </p>
              )}
            </div>
            <div className="space-y-0.5">
              {section.items.map(item => {
                const active = isActive(item.href, item.exact);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-colors",
                      active
                        ? "bg-primary/8 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <item.icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-primary" : "text-muted-foreground/60")} />
                    <span className="truncate">{item.name}</span>
                    {active && <div className="ml-auto w-1 h-1 rounded-full bg-primary" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* Advanced & Tools — progressive disclosure */}
        {advancedVisible.length > 0 && (
          <div>
            <button
              onClick={() => setShowAdvanced(v => !v)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted transition-colors group"
            >
              <Wrench className="h-3 w-3 shrink-0" />
              <span className="text-[11px] font-medium flex-1 text-left">More Tools</span>
              {showAdvanced
                ? <ChevronDown className="h-3 w-3 shrink-0" />
                : <ChevronRight className="h-3 w-3 shrink-0" />
              }
            </button>

            {showAdvanced && (
              <div className="mt-1 space-y-0.5 pl-1">
                <p className="text-[9px] text-muted-foreground/40 px-2 mb-1.5 uppercase tracking-widest">
                  Contracts · Automations · Config
                </p>
                {advancedVisible.map(item => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-colors",
                        active
                          ? "bg-primary/8 text-primary font-medium"
                          : "text-muted-foreground/70 hover:text-foreground hover:bg-muted"
                      )}
                    >
                      <item.icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-primary" : "text-muted-foreground/50")} />
                      <span className="truncate text-sm">{item.name}</span>
                      {active && <div className="ml-auto w-1 h-1 rounded-full bg-primary" />}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </nav>
    </aside>
  );
}
