import { useState, useEffect, useRef } from "react";
import { Bell, Search, CheckCheck, ExternalLink, X, PanelLeftOpen, PanelLeftClose, Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthRole, DEMO_USERS, ROLE_LABELS } from "@/lib/auth";
import { useSidebarCollapsed } from "@/lib/sidebar-state";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

const API = "/api";

// Ordered list: longer/more-specific paths MUST come before shorter prefix matches
const PAGE_NAMES: [string, string][] = [
  ["/dashboard/pm",        "PM Dashboard"],
  ["/dashboard/sales",     "Sales Dashboard"],
  ["/dashboard/am",        "Account Manager Dashboard"],
  ["/dashboard/admin",     "Admin Dashboard"],
  ["/projects",            "Projects"],
  ["/milestones",          "Milestones"],
  ["/tasks",               "Tasks"],
  ["/timesheets",          "Time Logs"],
  ["/resources",           "Team"],
  ["/allocations",         "Assignments"],
  ["/staffing-requests",   "Staffing Requests"],
  ["/capacity",            "Capacity Forecast"],
  ["/finance",             "Finance"],
  ["/invoices",            "Invoices"],
  ["/changes",             "Change Orders"],
  ["/contracts",           "Contracts"],
  ["/opportunities",       "Opportunity Pipeline"],
  ["/customers",           "Customers"],
  ["/accounts",            "Customers"],
  ["/prospects",           "Prospects"],
  ["/rate-cards",          "Rate Cards"],
  ["/proposals",           "Proposals"],
  ["/portfolio",           "Portfolio"],
  ["/renewal-signals",     "Renewal Signals"],
  ["/templates",           "Project Blueprints"],
  ["/forms",               "Forms"],
  ["/automations",         "Automations"],
  ["/admin",               "System Settings"],
  ["/handoff",             "Project Handoff"],
  ["/handover",            "Client Handover"],
  ["/",                    "Dashboard"],
];

function resolvePageName(location: string): string | null {
  for (const [prefix, name] of PAGE_NAMES) {
    if (prefix === "/") {
      if (location === "/") return name;
    } else if (location === prefix || location.startsWith(prefix + "/")) {
      return name;
    }
  }
  return null;
}

const ROLE_INITIALS: Record<string, string> = {
  admin: "AD", executive: "EX", delivery_director: "DD",
  project_manager: "PM", consultant: "CN", resource_manager: "RM",
  finance_lead: "FM", sales: "BD", account_manager: "AM", client_stakeholder: "CC",
};

const TYPE_STYLES: Record<string, string> = {
  info: "bg-blue-500/10 text-blue-600",
  warning: "bg-amber-500/10 text-amber-600",
  success: "bg-green-500/10 text-green-600",
  error: "bg-red-500/10 text-red-600",
};

const PRIORITY_STYLES: Record<string, string> = {
  action_required: "border-l-red-500",
  fyi: "border-l-blue-300",
  reminder: "border-l-amber-400",
};

interface TopBarProps {
  onSearchOpen?: () => void;
}

type ThemeValue = "light" | "dark" | "system";

function applyTheme(t: ThemeValue) {
  const root = document.documentElement;
  if (t === "dark") {
    root.classList.add("dark");
  } else if (t === "light") {
    root.classList.remove("dark");
  } else {
    window.matchMedia("(prefers-color-scheme: dark)").matches
      ? root.classList.add("dark")
      : root.classList.remove("dark");
  }
  localStorage.setItem("theme", t);
}

export function TopBar({ onSearchOpen }: TopBarProps) {
  const { role, user, setUser } = useAuthRole();
  const [location, setLocation] = useLocation();
  const [sidebarCollapsed, toggleSidebar] = useSidebarCollapsed();
  const pageName = resolvePageName(location);
  const [showNotifs, setShowNotifs] = useState(false);
  const [theme, setTheme] = useState<ThemeValue>(
    () => (localStorage.getItem("theme") as ThemeValue) ?? "system"
  );

  const cycleTheme = () => {
    const next: ThemeValue = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
    applyTheme(next);
  };

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const themeLabel = theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System";
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const [notifs, count] = await Promise.all([
        fetch(`${API}/notifications?userId=1`).then(r => r.json()),
        fetch(`${API}/notifications/unread-count?userId=1`).then(r => r.json()),
      ]);
      setNotifications(Array.isArray(notifs) ? notifs : []);
      setUnreadCount(count?.count || 0);
    } catch {
      // silently fail
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!showNotifs) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNotifs]);

  const markRead = async (id: number) => {
    await fetch(`${API}/notifications/${id}/read`, { method: "PUT" });
    fetchNotifications();
  };

  const markAllRead = async () => {
    await fetch(`${API}/notifications/mark-all-read`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: 1 }),
    });
    fetchNotifications();
  };

  const deleteNotif = async (id: number) => {
    await fetch(`${API}/notifications/${id}`, { method: "DELETE" });
    fetchNotifications();
  };

  const handleUserSwitch = (userId: string) => {
    const u = DEMO_USERS.find(x => x.id === userId);
    if (u) { setUser(u); setLocation("/"); }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <header className="h-12 bg-background border-b border-border flex items-center px-4 sticky top-0 z-10 shrink-0 gap-3">
      {/* Sidebar toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
        onClick={toggleSidebar}
        title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </Button>

      {/* Left: Search */}
      <div className="flex-none">
        <button
          onClick={onSearchOpen}
          className="flex items-center gap-2 bg-muted/60 hover:bg-muted border border-border rounded-lg px-3 h-8 text-sm text-muted-foreground transition-all cursor-pointer min-w-[200px] max-w-sm"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 text-left text-sm text-muted-foreground hidden sm:block">Search projects, accounts…</span>
          <kbd className="text-[10px] bg-background text-muted-foreground px-1.5 py-0.5 rounded border border-border hidden lg:inline">⌘K</kbd>
        </button>
      </div>

      {/* Center: Page name */}
      <div className="flex-1 flex justify-center">
        {pageName && (
          <span className="text-sm font-medium text-foreground/70 hidden md:block truncate max-w-xs">
            {pageName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 relative flex-none">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={cycleTheme}
          title={`Theme: ${themeLabel} — click to cycle`}
        >
          <ThemeIcon className="h-4 w-4" />
        </Button>

        {/* Notification Bell */}
        <div className="relative" ref={panelRef}>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => { setShowNotifs(v => !v); if (!showNotifs) fetchNotifications(); }}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[14px] h-[14px] rounded-full bg-destructive border border-background flex items-center justify-center text-[9px] text-white font-bold px-0.5">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>

          {/* Notification Panel */}
          {showNotifs && (
            <div className="absolute right-0 top-10 w-96 bg-background border border-border rounded-xl shadow-xl z-50 flex flex-col max-h-[520px]">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">Notifications</h3>
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="text-[10px] h-4 px-1">{unreadCount}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={markAllRead}>
                      <CheckCheck className="h-3 w-3" /> Mark all read
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setShowNotifs(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* List */}
              <div className="overflow-y-auto flex-1">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Bell className="h-8 w-8 text-muted-foreground mb-2 opacity-30" />
                    <p className="text-sm text-muted-foreground">All caught up!</p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">No notifications yet</p>
                  </div>
                ) : notifications.map(n => (
                  <div
                    key={n.id}
                    className={`flex gap-3 px-4 py-3 border-b border-border/50 hover:bg-muted/30 transition-colors border-l-2 ${PRIORITY_STYLES[n.priority] || "border-l-transparent"} ${!n.read ? "bg-primary/3" : ""}`}
                  >
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.read ? "bg-primary" : "bg-transparent"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-medium leading-snug ${!n.read ? "text-foreground" : "text-foreground/70"}`}>{n.title}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(n.createdAt)}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${TYPE_STYLES[n.type] || "bg-muted text-muted-foreground"}`}>
                          {n.type}
                        </span>
                        {n.priority === "action_required" && (
                          <span className="text-[9px] font-bold text-red-500 uppercase tracking-wide">Action required</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        {!n.read && (
                          <button className="text-[10px] text-primary hover:underline" onClick={() => markRead(n.id)}>
                            Mark read
                          </button>
                        )}
                        {n.actionUrl && (
                          <button
                            className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                            onClick={() => { setLocation(n.actionUrl); setShowNotifs(false); }}
                          >
                            <ExternalLink className="h-2.5 w-2.5" /> View
                          </button>
                        )}
                        <button className="text-[10px] text-muted-foreground hover:text-foreground ml-auto" onClick={() => deleteNotif(n.id)}>
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 h-8 px-2 rounded-lg hover:bg-muted">
              <Avatar className="h-6 w-6 border border-border">
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-[9px]">
                  {user ? user.initials : role ? (ROLE_INITIALS[role] || role.substring(0, 2).toUpperCase()) : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col items-start leading-none max-w-[120px]">
                {user ? (
                  <>
                    <span className="text-xs font-semibold text-foreground truncate w-full">{user.name.split(" ")[0]} {user.name.split(" ").slice(-1)[0]}</span>
                    <span className="text-[9px] text-muted-foreground truncate w-full">{role ? ROLE_LABELS[role] : ""}</span>
                  </>
                ) : role ? (
                  <span className="text-xs font-medium text-foreground">{ROLE_LABELS[role]}</span>
                ) : null}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60" align="end" forceMount>
            <DropdownMenuLabel className="font-normal pb-2">
              {user ? (
                <>
                  <p className="text-sm font-semibold text-foreground">{user.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{user.title}</p>
                  {role && <Badge variant="secondary" className="text-xs font-medium mt-1.5">{ROLE_LABELS[role]}</Badge>}
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-1">Signed in as</p>
                  {role && <Badge variant="secondary" className="text-xs font-medium">{ROLE_LABELS[role]}</Badge>}
                </>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider py-1">Switch user</DropdownMenuLabel>
            <div className="max-h-[280px] overflow-y-auto">
              {DEMO_USERS.map((u) => (
                <DropdownMenuItem key={u.id} onClick={() => handleUserSwitch(u.id)} className="cursor-pointer py-2">
                  <div className="flex items-center gap-2 w-full min-w-0">
                    <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold shrink-0">
                      {u.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{u.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{ROLE_LABELS[u.role]}</p>
                    </div>
                    {user?.id === u.id && <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-muted-foreground cursor-pointer"
              onClick={() => { setUser(null); setLocation("/login"); }}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
