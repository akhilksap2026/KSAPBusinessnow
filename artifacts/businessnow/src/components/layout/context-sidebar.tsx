import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuthRole, type Role } from "@/lib/auth";
import { useSidebarCollapsed } from "@/lib/sidebar-state";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  LayoutDashboard, FolderKanban, Building2, Users, Clock,
  Target, PieChart, GitMerge, DollarSign, ScrollText,
  ClipboardList, BarChart3, Settings2, Receipt,
  CheckSquare, Package, UserCircle, Handshake, CreditCard,
  ChevronRight, Wrench,
} from "lucide-react";

interface NavItem { name: string; href: string; icon: React.ElementType; exact?: boolean; roles?: Role[] }
interface NavSection { label: string; items: NavItem[]; roles?: Role[] }

const CRM_ENABLED = import.meta.env.VITE_ENABLE_CRM_MODULES === "true";

const SECTIONS: NavSection[] = [
  {
    label: "My Work",
    items: [
      { name: "Dashboard",   href: "/",            icon: LayoutDashboard, exact: true },
      { name: "Time Logs",   href: "/timesheets",  icon: Clock },
      { name: "My Tasks",    href: "/tasks",        icon: CheckSquare },
    ],
  },
  {
    label: "Projects",
    roles: ["admin","delivery_director","project_manager","consultant","resource_manager","finance_lead","executive"],
    items: [
      { name: "Projects",          href: "/projects",   icon: FolderKanban },
      { name: "Portfolio",         href: "/portfolio",  icon: BarChart3,  roles: ["admin","executive","delivery_director","project_manager"] },
      { name: "Blueprints",        href: "/templates",  icon: Package,    roles: ["admin","delivery_director","project_manager"] },
    ],
  },
  {
    label: "Resources",
    roles: ["admin","delivery_director","project_manager","resource_manager"],
    items: [
      { name: "Team",              href: "/resources",         icon: Users },
      { name: "Allocations",       href: "/allocations",       icon: GitMerge },
      { name: "Staffing Requests", href: "/staffing-requests", icon: UserCircle },
      { name: "Capacity",          href: "/capacity",          icon: PieChart },
    ],
  },
  {
    label: "Pipeline",
    roles: ["admin","delivery_director","sales","account_manager","finance_lead","executive"],
    items: [
      { name: "Customers", href: "/accounts", icon: Building2 },
      ...(CRM_ENABLED ? [
        { name: "Prospects",     href: "/prospects",     icon: Target },
        { name: "Opportunities", href: "/opportunities", icon: Handshake },
      ] as NavItem[] : []),
    ],
  },
  {
    label: "Finance",
    roles: ["admin","finance_lead","project_manager","delivery_director","executive","account_manager"],
    items: [
      { name: "Financials",    href: "/finance",     icon: DollarSign },
      { name: "Invoices",      href: "/invoices",    icon: Receipt },
      { name: "Rate Cards",    href: "/rate-cards",  icon: CreditCard },
      { name: "Contracts",     href: "/contracts",   icon: ScrollText,  roles: ["admin","finance_lead","project_manager","account_manager"] },
      { name: "Change Orders", href: "/changes",     icon: ClipboardList },
    ],
  },
  {
    label: "Settings",
    roles: ["admin","delivery_director","project_manager"],
    items: [
      { name: "PMO Settings",    href: "/settings/pmo", icon: Settings2,  roles: ["admin","delivery_director","project_manager"] },
      { name: "System Settings", href: "/admin",         icon: Wrench,     roles: ["admin"] },
    ],
  },
];

export function ContextSidebar() {
  const [location] = useLocation();
  const { role } = useAuthRole();
  const [collapsed, toggleCollapse] = useSidebarCollapsed();

  useEffect(() => {
    if (window.innerWidth < 1024 && !collapsed) toggleCollapse();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function isActive(href: string, exact?: boolean) {
    if (exact) return location === href;
    return location === href || (href !== "/" && location.startsWith(href));
  }

  const visibleSections = SECTIONS
    .filter(s => !s.roles || !role || s.roles.includes(role))
    .map(s => ({
      ...s,
      items: s.items.filter(i => !i.roles || !role || i.roles.includes(role)),
    }))
    .filter(s => s.items.length > 0);

  const allItems = visibleSections.flatMap(s => s.items);

  if (collapsed) {
    return (
      <aside
        className="shrink-0 bg-background border-r border-border flex flex-col h-[100dvh] sticky top-0 overflow-hidden transition-all duration-200 ease-in-out"
        style={{ width: 64 }}
      >
        <div className="flex items-center justify-center py-4 border-b border-border">
          <button
            onClick={toggleCollapse}
            className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm hover:bg-primary/20 transition-colors"
            title="Expand sidebar"
          >
            B
          </button>
        </div>
        <nav className="flex-1 py-3 flex flex-col items-center gap-0.5 overflow-y-auto">
          {allItems.map(item => {
            const active = isActive(item.href, item.exact);
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link href={item.href}>
                    <div className={cn(
                      "w-10 h-10 flex items-center justify-center rounded-xl transition-all",
                      active ? "bg-primary/10 text-primary" : "text-muted-foreground/60 hover:text-foreground hover:bg-muted"
                    )}>
                      <item.icon className="h-4 w-4" />
                    </div>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">{item.name}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
      </aside>
    );
  }

  return (
    <aside
      className="shrink-0 bg-background border-r border-border flex flex-col h-[100dvh] sticky top-0 overflow-y-auto transition-all duration-200 ease-in-out"
      style={{ width: 208 }}
    >
      <div className="px-3 py-4 border-b border-border flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">BUSINESSNow</p>
          <p className="text-xs font-medium text-foreground mt-0.5 truncate">Delivery Command Center</p>
        </div>
        <button
          onClick={toggleCollapse}
          className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors shrink-0 ml-1"
          title="Collapse sidebar"
        >
          <ChevronRight className="h-3.5 w-3.5 rotate-180" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {visibleSections.map(section => (
          <div key={section.label} className="mb-1">
            <p className="px-4 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-[2px] text-muted-foreground/60">
              {section.label}
            </p>
            <div className="px-2 space-y-0.5">
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
      </nav>
    </aside>
  );
}
