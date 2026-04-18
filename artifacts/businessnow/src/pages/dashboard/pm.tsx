import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  ClipboardList, AlertCircle, CheckCircle2, Clock, AlertTriangle,
  Flame, Calendar, ArrowRight, Users, FileText, PlusCircle, RefreshCw,
  Rocket, ShieldAlert, ThumbsUp, AlarmClock, LayoutList,
} from "lucide-react";
import { format, isBefore, addDays } from "date-fns";

const API = "/api";

interface TodayAction {
  type: "milestone_overdue" | "milestone_due_soon" | "task_blocked" | "task_due" | "status_update_due";
  priority: "high" | "medium" | "low";
  label: string;
  detail: string;
  link?: string;
}

function buildTodayActions(projects: any[], milestones: any[], tasks: any[]): TodayAction[] {
  const actions: TodayAction[] = [];
  const today = new Date();
  const soon = addDays(today, 3);

  milestones.forEach(m => {
    if (!m.dueDate || m.status === "completed") return;
    const due = new Date(m.dueDate);
    if (isBefore(due, today)) {
      actions.push({ type: "milestone_overdue", priority: "high", label: `Overdue milestone: ${m.name}`, detail: `${m.projectName || "Project"} · was due ${format(due, "MMM d")}`, link: `/projects/${m.projectId}` });
    } else if (isBefore(due, soon)) {
      actions.push({ type: "milestone_due_soon", priority: "medium", label: `Milestone due in <3 days: ${m.name}`, detail: `${m.projectName || "Project"} · due ${format(due, "MMM d")}`, link: `/projects/${m.projectId}` });
    }
  });

  tasks.forEach(t => {
    if (t.status === "done" || t.status === "cancelled") return;
    if (t.status === "blocked") {
      actions.push({ type: "task_blocked", priority: "high", label: `Blocked task: ${t.name}`, detail: t.blockerNote ? `Blocker: ${t.blockerNote}` : "Task is blocked — needs resolution", link: `/tasks` });
    } else if (t.dueDate && isBefore(new Date(t.dueDate), today)) {
      actions.push({ type: "task_due", priority: "medium", label: `Overdue task: ${t.name}`, detail: `Due ${format(new Date(t.dueDate), "MMM d")} · ${t.status.replace("_", " ")}`, link: `/tasks` });
    }
  });

  projects.forEach(p => {
    if (p.status === "active" && !p.lastStatusReportAt) {
      actions.push({ type: "status_update_due", priority: "low", label: `Post status update: ${p.name}`, detail: `${p.accountName} · No status update on record`, link: `/projects/${p.id}` });
    }
  });

  return actions.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority])).slice(0, 12);
}

const ACTION_ICONS: Record<string, any> = {
  milestone_overdue: Flame, milestone_due_soon: Calendar,
  task_blocked: AlertTriangle, task_due: Clock, status_update_due: FileText,
};
const ACTION_STYLES: Record<string, { border: string; icon: string; badge: string }> = {
  milestone_overdue: { border: "border-l-red-500", icon: "text-red-500", badge: "bg-red-100 text-red-700 border-red-200" },
  task_blocked: { border: "border-l-red-500", icon: "text-red-500", badge: "bg-red-100 text-red-700 border-red-200" },
  milestone_due_soon: { border: "border-l-amber-400", icon: "text-amber-500", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  task_due: { border: "border-l-amber-400", icon: "text-amber-500", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  status_update_due: { border: "border-l-blue-300", icon: "text-blue-500", badge: "bg-blue-100 text-blue-700 border-blue-200" },
};

export default function PMDashboard() {
  const [, setLocation] = useLocation();
  const [projects, setProjects] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [missingTimesheets, setMissingTimesheets] = useState<{ missingCount: number; totalResources: number; weekStart: string; missingResources: { id: number; name: string }[] } | null>(null);
  const [digest, setDigest] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectScope, setProjectScope] = useState<"mine" | "all">(
    () => (localStorage.getItem("pm_dashboard_scope") as "mine" | "all") ?? "mine"
  );

  const setScope = (s: "mine" | "all") => {
    setProjectScope(s);
    localStorage.setItem("pm_dashboard_scope", s);
  };

  const load = async () => {
    setLoading(true);
    const [p, m, t, ts, ms, dg] = await Promise.all([
      fetch(`${API}/projects`).then(r => r.json()).catch(() => []),
      fetch(`${API}/milestones`).then(r => r.json()).catch(() => []),
      fetch(`${API}/tasks`).then(r => r.json()).catch(() => []),
      fetch(`${API}/timesheets`).then(r => r.json()).catch(() => []),
      fetch(`${API}/timesheets/missing`).then(r => r.json()).catch(() => null),
      fetch(`${API}/digest/me`).then(r => r.json()).catch(() => null),
    ]);
    setProjects(Array.isArray(p) ? p : []);
    setMilestones(Array.isArray(m) ? m : []);
    setTasks(Array.isArray(t) ? t : []);
    setTimesheets(Array.isArray(ts) ? ts : []);
    setMissingTimesheets(ms && typeof ms.missingCount === "number" ? ms : null);
    setDigest(dg && dg.summary ? dg : null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-[360px]" />
          <Skeleton className="h-[360px]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[200px]" />
        </div>
      </div>
    );
  }

  const allActiveProjects = projects.filter(p => p.status === "active" || p.status === "in_progress");
  const activeProjects = (projectScope === "mine" ? allActiveProjects.slice(0, 5) : allActiveProjects).slice(0, 8);
  const todayActions = buildTodayActions(activeProjects, milestones, tasks);
  const highCount = todayActions.filter(a => a.priority === "high").length;

  const overdueMs = milestones.filter(m => m.dueDate && isBefore(new Date(m.dueDate), new Date()) && m.status !== "completed");
  const blockedTasks = tasks.filter(t => t.status === "blocked");
  const atRiskProjects = activeProjects.filter(p => (p.healthScore ?? 100) < 65);
  const upcomingMs = milestones
    .filter(m => m.status !== "completed" && m.dueDate && !isBefore(new Date(m.dueDate), new Date()))
    .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))
    .slice(0, 6);

  const pendingApprovals = timesheets.filter(t => t.status === "submitted");
  const missingStatusProjects = activeProjects.filter(p => !p.lastStatusReportAt);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Delivery Workspace</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
            {highCount > 0 && <span className="ml-2 text-red-500 font-semibold">· {highCount} urgent item{highCount !== 1 ? "s" : ""} need attention</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* My Projects / All Projects toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
            {(["mine", "all"] as const).map(s => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`px-3 py-1.5 transition-colors ${projectScope === s ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
              >
                {s === "mine" ? "My Projects" : "All Projects"}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={load} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Missing timesheet reminder banner */}
      {missingTimesheets && missingTimesheets.missingCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/50 px-4 py-3">
          <AlarmClock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {missingTimesheets.missingCount} team member{missingTimesheets.missingCount !== 1 ? "s have" : " has"} not submitted timesheets for this week.
            </p>
            {missingTimesheets.missingResources.length <= 5 && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Missing: {missingTimesheets.missingResources.map(r => r.name).join(", ")}
              </p>
            )}
          </div>
          <button onClick={() => setLocation("/timesheets")} className="text-xs font-medium text-amber-700 dark:text-amber-400 underline underline-offset-2 hover:opacity-80 whitespace-nowrap shrink-0">
            View Timesheets →
          </button>
        </div>
      )}

      {/* Today's Actions */}
      <Card className={`border ${highCount > 0 ? "border-red-200 bg-red-50/30 dark:bg-red-950/10" : "border-border"}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className={`h-4 w-4 ${highCount > 0 ? "text-red-500" : "text-amber-500"}`} />
              Today's Actions
              {todayActions.length > 0 && (
                <Badge variant={highCount > 0 ? "destructive" : "secondary"} className="text-[10px]">
                  {todayActions.length} item{todayActions.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </CardTitle>
            <span className="text-xs text-muted-foreground">{format(new Date(), "MMM d")}</span>
          </div>
        </CardHeader>
        <CardContent>
          {todayActions.length === 0 ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
              <ThumbsUp className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-400">All clear for today</p>
                <p className="text-xs text-green-600 dark:text-green-500">No overdue milestones, blocked tasks, or urgent items.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {todayActions.map((action, i) => {
                const Icon = ACTION_ICONS[action.type] || Clock;
                const style = ACTION_STYLES[action.type] || ACTION_STYLES.status_update_due;
                return (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border border-l-4 ${style.border} border-t-border/50 border-r-border/50 border-b-border/50 bg-background hover:bg-muted/30 cursor-pointer transition-colors`} onClick={() => action.link && setLocation(action.link)}>
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${style.icon}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">{action.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{action.detail}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${style.badge}`}>{action.priority}</span>
                      {action.link && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main 2-col: Active Projects | Delivery Risks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Active Projects */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-blue-500" />
                My Active Projects
                <Badge variant="secondary" className="text-[10px]">{activeProjects.length}</Badge>
              </CardTitle>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setLocation("/projects")}>
                All Projects <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[340px] pr-2">
              <div className="space-y-2.5">
                {activeProjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No active projects</p>
                ) : activeProjects.map(p => {
                  const burnPct = Math.round((p.consumedHours || 0) / Math.max(p.budgetHours || 1, 1) * 100);
                  const health = p.healthScore || 0;
                  return (
                    <div key={p.id} className="p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => setLocation(`/projects/${p.id}`)}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-semibold text-sm truncate flex-1">{p.name}</span>
                        <div className="flex items-center gap-1.5 ml-2 shrink-0">
                          <Badge variant={health < 60 ? "destructive" : health < 80 ? "secondary" : "outline"} className="text-[10px]">
                            {health < 60 ? "At Risk" : health < 80 ? "Caution" : "Healthy"}
                          </Badge>
                          <button
                            className="p-0.5 text-muted-foreground hover:text-primary transition-colors"
                            title="Command Center"
                            onClick={e => { e.stopPropagation(); setLocation(`/projects/${p.id}/command`); }}
                          >
                            <Rocket className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                        <span>{p.accountName}</span>
                        <span className={burnPct > 90 ? "text-red-500 font-medium" : burnPct > 75 ? "text-amber-500" : ""}>Burn {burnPct}%</span>
                      </div>
                      <Progress value={Math.min(burnPct, 100)} className={`h-1 ${burnPct > 90 ? "[&>div]:bg-red-500" : burnPct > 75 ? "[&>div]:bg-amber-400" : ""}`} />
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Delivery Risks */}
        <Card className={atRiskProjects.length > 0 || overdueMs.length > 0 || blockedTasks.length > 0 ? "border-amber-200 dark:border-amber-900/50" : "border-border"}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              Delivery Risks
              {(overdueMs.length + blockedTasks.length + atRiskProjects.length) > 0 && (
                <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200">{overdueMs.length + blockedTasks.length + atRiskProjects.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[340px] pr-2">
              <div className="space-y-4">

                {/* At-risk projects */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-red-400" /> At-Risk Projects ({atRiskProjects.length})
                  </p>
                  {atRiskProjects.length === 0 ? (
                    <p className="text-xs text-muted-foreground ml-1">None — all projects healthy</p>
                  ) : atRiskProjects.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded border hover:bg-muted/30 cursor-pointer transition-colors mb-1.5" onClick={() => setLocation(`/projects/${p.id}/command`)}>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">{p.accountName}</p>
                      </div>
                      <span className="text-xs font-bold text-red-500 ml-2 shrink-0">Health {p.healthScore ?? "—"}</span>
                    </div>
                  ))}
                </div>

                {/* Overdue milestones */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Flame className="h-3 w-3 text-red-400" /> Overdue Milestones ({overdueMs.length})
                  </p>
                  {overdueMs.length === 0 ? (
                    <p className="text-xs text-muted-foreground ml-1">None — all milestones on track</p>
                  ) : overdueMs.slice(0, 5).map(m => (
                    <div key={m.id} className="flex items-center justify-between p-2 rounded border hover:bg-muted/30 cursor-pointer transition-colors mb-1.5" onClick={() => setLocation(`/projects/${m.projectId}`)}>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{m.name}</p>
                        <p className="text-[10px] text-muted-foreground">{m.projectName}</p>
                      </div>
                      <span className="text-xs font-medium text-red-500 ml-2 shrink-0">{m.dueDate ? format(new Date(m.dueDate), "MMM d") : "—"}</span>
                    </div>
                  ))}
                </div>

                {/* Blocked tasks */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                    <AlertCircle className="h-3 w-3 text-amber-400" /> Blocked Tasks ({blockedTasks.length})
                  </p>
                  {blockedTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground ml-1">No blocked tasks</p>
                  ) : blockedTasks.slice(0, 5).map(t => (
                    <div key={t.id} className="flex items-center justify-between p-2 rounded border hover:bg-muted/30 cursor-pointer transition-colors mb-1.5" onClick={() => setLocation("/tasks")}>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{t.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{t.blockerNote || "No blocker note"}</p>
                      </div>
                      <Badge variant="destructive" className="text-[10px] ml-2 shrink-0">Blocked</Badge>
                    </div>
                  ))}
                </div>

                {/* Upcoming milestones */}
                {upcomingMs.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 text-blue-400" /> Upcoming Milestones
                    </p>
                    {upcomingMs.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-2 rounded border hover:bg-muted/30 cursor-pointer transition-colors mb-1.5" onClick={() => setLocation(`/projects/${m.projectId}`)}>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{m.name}</p>
                          <p className="text-[10px] text-muted-foreground">{m.projectName}</p>
                        </div>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">{m.dueDate ? format(new Date(m.dueDate), "MMM d") : "—"}</span>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Secondary row: Pending Approvals | Missing Status Updates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Pending Timesheet Approvals */}
        <Card className={pendingApprovals.length > 0 ? "border-amber-200 dark:border-amber-900/50" : "border-border"}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                Pending Timesheet Approvals
                {pendingApprovals.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200">{pendingApprovals.length}</Badge>
                )}
              </CardTitle>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setLocation("/timesheets/approval")}>
                Review Queue <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {pendingApprovals.length === 0 ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <p className="text-sm text-green-700 dark:text-green-400">No timesheets pending approval</p>
              </div>
            ) : (
              <ScrollArea className="h-[180px] pr-2">
                <div className="space-y-1.5">
                  {pendingApprovals.slice(0, 10).map(ts => (
                    <div key={ts.id} className="flex items-center justify-between p-2.5 rounded border hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => setLocation("/timesheets/approval")}>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{ts.resourceName || "Unknown resource"}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{ts.projectName} · {ts.entryDate ? format(new Date(ts.entryDate + "T00:00:00"), "MMM d") : "—"}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        <span className="text-xs font-semibold">{ts.hours ?? ts.loggedHours ?? "—"}h</span>
                        <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">Submitted</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Missing Status Updates */}
        <Card className={missingStatusProjects.length > 0 ? "border-blue-200 dark:border-blue-900/50" : "border-border"}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                Missing Status Updates
                {missingStatusProjects.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700 border border-blue-200">{missingStatusProjects.length}</Badge>
                )}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {missingStatusProjects.length === 0 ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <p className="text-sm text-green-700 dark:text-green-400">All active projects have status updates on record</p>
              </div>
            ) : (
              <ScrollArea className="h-[180px] pr-2">
                <div className="space-y-1.5">
                  {missingStatusProjects.slice(0, 10).map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2.5 rounded border hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => setLocation(`/projects/${p.id}`)}>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">{p.accountName}</p>
                      </div>
                      <div className="flex items-center gap-1.5 ml-2 shrink-0">
                        <span className="text-[10px] text-blue-600 font-medium">No update</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Weekly Summary */}
      {digest && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <LayoutList className="h-4 w-4 text-indigo-500" />
                Weekly Summary
                <span className="text-xs font-normal text-muted-foreground">w/c {digest.weekStart}</span>
              </CardTitle>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={load}>
                <RefreshCw className="h-3 w-3 mr-1" /> Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* 4-stat summary row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {
                  label: "Overdue Milestones",
                  count: digest.summary.overdueMilestoneCount,
                  icon: Calendar,
                  accent: digest.summary.overdueMilestoneCount > 0 ? "text-red-600" : "text-muted-foreground",
                  bg: digest.summary.overdueMilestoneCount > 0 ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800/50" : "bg-muted/30",
                  link: "/milestones",
                },
                {
                  label: "Blocked Tasks",
                  count: digest.summary.blockedTaskCount,
                  icon: AlertTriangle,
                  accent: digest.summary.blockedTaskCount > 0 ? "text-amber-600" : "text-muted-foreground",
                  bg: digest.summary.blockedTaskCount > 0 ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/50" : "bg-muted/30",
                  link: "/tasks",
                },
                {
                  label: "Projects at Risk",
                  count: digest.summary.projectsAtRiskCount,
                  icon: ShieldAlert,
                  accent: digest.summary.projectsAtRiskCount > 0 ? "text-orange-600" : "text-muted-foreground",
                  bg: digest.summary.projectsAtRiskCount > 0 ? "bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800/50" : "bg-muted/30",
                  link: "/projects",
                },
                {
                  label: "Pending Timesheets",
                  count: digest.summary.pendingTimesheetCount,
                  icon: Clock,
                  accent: digest.summary.pendingTimesheetCount > 0 ? "text-blue-600" : "text-muted-foreground",
                  bg: digest.summary.pendingTimesheetCount > 0 ? "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800/50" : "bg-muted/30",
                  link: "/timesheets",
                },
              ].map(({ label, count, icon: Icon, accent, bg, link }) => (
                <button
                  key={label}
                  onClick={() => setLocation(link)}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left hover:opacity-80 transition-opacity ${bg}`}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${accent}`} />
                  <div>
                    <p className={`text-2xl font-bold leading-none ${accent}`}>{count}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-tight">{label}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Detail rows — only shown when there are items */}
            {digest.overdueMilestones.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Overdue Milestones</p>
                <div className="space-y-1">
                  {digest.overdueMilestones.slice(0, 4).map((m: any) => (
                    <div key={m.id} onClick={() => m.projectId && setLocation(`/projects/${m.projectId}`)}
                      className="flex items-center justify-between px-3 py-2 rounded border hover:bg-muted/40 cursor-pointer transition-colors">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{m.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{m.projectName}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        <span className="text-[10px] text-red-600 font-medium">{m.dueDate}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {digest.blockedTasks.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Blocked Tasks</p>
                <div className="space-y-1">
                  {digest.blockedTasks.slice(0, 4).map((t: any) => (
                    <div key={t.id} onClick={() => setLocation("/tasks")}
                      className="flex items-center justify-between px-3 py-2 rounded border hover:bg-muted/40 cursor-pointer transition-colors">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{t.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{t.projectName}{t.blockerNote ? ` · ${t.blockerNote}` : ""}</p>
                      </div>
                      <ArrowRight className="h-3 w-3 text-muted-foreground ml-3 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {digest.projectsAtRisk.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Projects at Risk</p>
                <div className="space-y-1">
                  {digest.projectsAtRisk.slice(0, 4).map((p: any) => (
                    <div key={p.id} onClick={() => setLocation(`/projects/${p.id}`)}
                      className="flex items-center justify-between px-3 py-2 rounded border hover:bg-muted/40 cursor-pointer transition-colors">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">{p.accountName}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        <span className={`text-[10px] font-semibold ${p.burnStatus === "critical" ? "text-red-600" : p.burnStatus === "warning" ? "text-amber-600" : "text-muted-foreground"}`}>
                          Health {p.healthScore}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Log Timesheet", icon: Clock, link: "/timesheets" },
              { label: "All Tasks", icon: ClipboardList, link: "/tasks" },
              { label: "All Milestones", icon: CheckCircle2, link: "/milestones" },
              { label: "Staffing Requests", icon: Users, link: "/staffing-requests" },
              { label: "New Project", icon: PlusCircle, link: "/projects" },
            ].map(a => (
              <Button key={a.label} variant="outline" size="sm" className="gap-1.5" onClick={() => setLocation(a.link)}>
                <a.icon className="h-3.5 w-3.5" /> {a.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
