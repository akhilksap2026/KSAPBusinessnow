import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp, AlertTriangle, CheckCircle2, Clock,
  Briefcase, Users, DollarSign, BarChart3,
  ArrowRight, RefreshCw, Activity, Rocket,
  Flame, CalendarCheck, Layers, UserX, UserCheck,
} from "lucide-react";
import { format, addDays, isBefore } from "date-fns";
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from "recharts";

const API = "/api";

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

function KPI({ label, value, sub, trend, color }: {
  label: string; value: string | number; sub?: string; trend?: string; color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color || "text-foreground"}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
      {trend && <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1"><TrendingUp size={10} />{trend}</p>}
    </div>
  );
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(100, score)}%` }} />
    </div>
  );
}

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const [adminMetrics, setAdminMetrics] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [staffingRequests, setStaffingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, accs, projs, invs, mils, allocs, srs] = await Promise.all([
        fetch(`${API}/admin/metrics`).then(r => r.json()),
        fetch(`${API}/accounts`).then(r => r.json()),
        fetch(`${API}/projects`).then(r => r.json()),
        fetch(`${API}/invoices`).then(r => r.json()),
        fetch(`${API}/milestones`).then(r => r.json()).catch(() => []),
        fetch(`${API}/allocations`).then(r => r.json()).catch(() => []),
        fetch(`${API}/staffing-requests`).then(r => r.json()).catch(() => []),
      ]);
      setAdminMetrics(m);
      setAccounts(Array.isArray(accs) ? accs : []);
      setProjects(Array.isArray(projs) ? projs : []);
      setInvoices(Array.isArray(invs) ? invs : []);
      setMilestones(Array.isArray(mils) ? mils : []);
      setAllocations(Array.isArray(allocs) ? allocs : []);
      setStaffingRequests(Array.isArray(srs) ? srs : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !adminMetrics) return (
    <div className="p-8 space-y-4">
      <div className="h-8 w-64 bg-muted rounded animate-pulse" />
      <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>
      <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <div key={i} className="h-72 bg-muted rounded-xl animate-pulse" />)}</div>
      <div className="grid grid-cols-2 gap-4">{[...Array(2)].map((_, i) => <div key={i} className="h-52 bg-muted rounded-xl animate-pulse" />)}</div>
    </div>
  );

  const { entities } = adminMetrics;

  const activeProjects = projects.filter(p => p.status === "active" || p.status === "in_progress");
  const atRiskProjects = projects.filter(p => (p.healthScore ?? 100) < 65);
  const overdueInvoices = invoices.filter(i => i.status === "overdue");
  const totalARR = accounts.reduce((s, a) => s + parseFloat(a.annualContractValue || "0"), 0);
  const totalInvoiceValue = invoices.reduce((s, i) => s + parseFloat(i.amount || "0"), 0);
  const paidValue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + parseFloat(i.amount || "0"), 0);
  const overdueValue = overdueInvoices.reduce((s, i) => s + parseFloat(i.amount || "0"), 0);
  const collectionRate = totalInvoiceValue > 0 ? Math.round((paidValue / totalInvoiceValue) * 100) : 0;

  const sortedAccounts = [...accounts].sort((a, b) => (b.healthScore ?? 100) - (a.healthScore ?? 100)).slice(0, 8);

  // Margin Watch: compare project budget vs invoiced
  const marginProjects = activeProjects.map(p => {
    const projectInvoices = invoices.filter(i => i.projectId === p.id);
    const invoiced = projectInvoices.reduce((s, i) => s + parseFloat(i.amount || "0"), 0);
    const budget = parseFloat(p.contractValue || p.budget || "0");
    const margin = budget > 0 ? Math.round(((budget - (p.consumedCost || 0)) / budget) * 100) : null;
    return { ...p, invoiced, budget, margin };
  }).sort((a, b) => (a.margin ?? 100) - (b.margin ?? 100)).slice(0, 6);

  // Upcoming go-lives: milestones due in the next 30 days that are not completed
  const in30Days = addDays(new Date(), 30);
  const upcomingGoLives = milestones
    .filter(m => m.dueDate && !isBefore(new Date(in30Days), new Date(m.dueDate)) && !isBefore(new Date(m.dueDate), new Date()) && m.status !== "completed")
    .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))
    .slice(0, 8);

  // Staffing pulse
  const today = new Date().toISOString().split("T")[0];
  const activeAllocs = allocations.filter(a => (!a.endDate || a.endDate >= today) && (!a.startDate || a.startDate <= today));
  const resourceLoads: Record<number, number> = {};
  activeAllocs.forEach(a => { resourceLoads[a.resourceId] = (resourceLoads[a.resourceId] || 0) + (a.allocationPct || 0); });
  const overallocated = Object.values(resourceLoads).filter(pct => pct > 100).length;
  const softBookedAllocs = allocations.filter(a => a.allocationType === "soft");
  const openRequests = staffingRequests.filter(r => r.status === "open" || r.status === "pending");
  const benchCount = Math.max(0, (entities.resources?.total || 0) - Object.keys(resourceLoads).length);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Portfolio Command Center</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Portfolio health · Margin watch · Delivery risk · Utilization · Upcoming go-lives</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={load} className="text-xs gap-1.5">
            <RefreshCw size={12} />Refresh
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate("/admin")} className="text-xs text-muted-foreground">
            System Settings →
          </Button>
        </div>
      </div>

      {/* Portfolio Health KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Total ARR" value={fmt(totalARR)} sub={`${accounts.length} accounts`} color="text-emerald-400" />
        <KPI label="Active Projects" value={activeProjects.length} sub={`${entities.projects.total} total · ${entities.milestones.completed} milestones done`} trend={`${entities.milestones.completed} milestones completed`} />
        <KPI label="Invoice Collection" value={`${collectionRate}%`} sub={`${overdueInvoices.length} overdue · ${fmt(overdueValue)} outstanding`} color={collectionRate >= 80 ? "text-emerald-400" : "text-amber-400"} />
        <KPI label="At-Risk Projects" value={atRiskProjects.length} sub="health score < 65" color={atRiskProjects.length > 0 ? "text-red-400" : "text-emerald-400"} />
      </div>

      {/* ── Ecosystem Charts Row ── */}
      {(() => {
        // Project Status donut data
        const statusGroups = [
          { name: "Active",    value: projects.filter(p => p.status === "active").length,    color: "#3b82f6" },
          { name: "At Risk",   value: projects.filter(p => p.status === "at_risk" || (p.healthScore != null && p.healthScore < 65 && p.status === "active")).length, color: "#f59e0b" },
          { name: "On Hold",   value: projects.filter(p => p.status === "on_hold").length,   color: "#6b7280" },
          { name: "Completed", value: projects.filter(p => p.status === "completed").length, color: "#10b981" },
        ].filter(s => s.value > 0);

        // Invoice cash flow bar data
        const invoiceBars = [
          { label: "Paid",        value: paidValue,    fill: "#10b981" },
          { label: "Outstanding", value: invoices.filter(i => i.status === "sent").reduce((s: number, i: any) => s + parseFloat(i.amount || "0"), 0), fill: "#3b82f6" },
          { label: "Overdue",     value: overdueValue, fill: "#ef4444" },
          { label: "Draft",       value: invoices.filter(i => i.status === "draft").reduce((s: number, i: any) => s + parseFloat(i.amount || "0"), 0), fill: "#9ca3af" },
        ].filter(b => b.value > 0);

        // Resource capacity bars
        const resourceCapData = [
          { label: "Overallocated", value: overallocated,  fill: "#ef4444" },
          { label: "Soft-booked",   value: Math.max(0, Object.keys(resourceLoads).length - overallocated - softBookedAllocs.length), fill: "#3b82f6" },
          { label: "Bench",         value: benchCount,     fill: "#10b981" },
        ].filter(d => d.value > 0);

        const fmtTick = (v: number) => v >= 1_000_000 ? `$${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${(v/1_000).toFixed(0)}K` : `$${v}`;

        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* 1. Project Status Distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Project Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie data={statusGroups} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value" strokeWidth={0}>
                        {statusGroups.map((s, i) => <Cell key={i} fill={s.color} />)}
                      </Pie>
                      <RTooltip formatter={(v: any, name: any) => [v, name]} contentStyle={{ fontSize: 11, padding: "4px 8px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2 flex-1">
                    {statusGroups.map(s => (
                      <div key={s.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                          <span className="text-xs text-muted-foreground">{s.name}</span>
                        </div>
                        <span className="text-xs font-semibold">{s.value}</span>
                      </div>
                    ))}
                    {statusGroups.length === 0 && <p className="text-xs text-muted-foreground">No project data</p>}
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="w-full text-xs h-7 text-muted-foreground mt-3" onClick={() => navigate("/projects")}>
                  View All Projects <ArrowRight size={11} className="ml-1" />
                </Button>
              </CardContent>
            </Card>

            {/* 2. Invoice Cash Flow */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Invoice Cash Flow</CardTitle>
              </CardHeader>
              <CardContent>
                {invoiceBars.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No invoice data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={invoiceBars} layout="vertical" margin={{ left: 8, right: 32, top: 4, bottom: 4 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="label" width={72} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <RTooltip formatter={(v: any) => [fmtTick(v)]} contentStyle={{ fontSize: 11, padding: "4px 8px" }} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                        <LabelList dataKey="value" position="right" formatter={fmtTick} style={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                        {invoiceBars.map((b, i) => <Cell key={i} fill={b.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
                <Button size="sm" variant="ghost" className="w-full text-xs h-7 text-muted-foreground mt-2" onClick={() => navigate("/invoices")}>
                  View Invoices <ArrowRight size={11} className="ml-1" />
                </Button>
              </CardContent>
            </Card>

            {/* 3. Resource Capacity Pulse */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resource Capacity Pulse</CardTitle>
              </CardHeader>
              <CardContent>
                {resourceCapData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No allocation data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={100}>
                    <BarChart data={resourceCapData} layout="vertical" margin={{ left: 8, right: 32, top: 4, bottom: 4 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="label" width={88} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <RTooltip formatter={(v: any) => [`${v} people`]} contentStyle={{ fontSize: 11, padding: "4px 8px" }} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                        <LabelList dataKey="value" position="right" style={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                        {resourceCapData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
                <div className="flex gap-3 justify-center mt-2 text-[10px] text-muted-foreground">
                  <span><span className="text-red-400 font-semibold">{overallocated}</span> over</span>
                  <span><span className="text-emerald-400 font-semibold">{benchCount}</span> available</span>
                  <span><span className="text-blue-400 font-semibold">{openRequests.length}</span> open requests</span>
                </div>
                <Button size="sm" variant="ghost" className="w-full text-xs h-7 text-muted-foreground mt-2" onClick={() => navigate("/resources")}>
                  View Resources <ArrowRight size={11} className="ml-1" />
                </Button>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Main 3-col: Portfolio Health | Delivery Risk | Margin Watch */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Portfolio Health — Account Leaderboard */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 size={14} className="text-blue-400" /> Account Health
              </CardTitle>
              <CardDescription>Sorted by health score</CardDescription>
            </div>
            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => navigate("/accounts")}>
              All <ArrowRight size={11} className="ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {sortedAccounts.map(acc => {
              const score = acc.healthScore ?? 100;
              return (
                <button key={acc.id} onClick={() => navigate(`/accounts/${acc.id}`)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left">
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-foreground shrink-0">
                    {acc.name?.[0] || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-medium truncate">{acc.name}</span>
                      <span className={`text-xs font-bold shrink-0 ${score >= 75 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400"}`}>{score}</span>
                    </div>
                    <HealthBar score={score} />
                  </div>
                  <Badge variant="secondary" className={`text-[10px] shrink-0 ${score >= 75 ? "text-emerald-400 bg-emerald-500/10" : score >= 50 ? "text-amber-400 bg-amber-500/10" : "text-red-400 bg-red-500/10"}`}>
                    {score >= 75 ? "Healthy" : score >= 50 ? "At Risk" : "Critical"}
                  </Badge>
                </button>
              );
            })}
            {sortedAccounts.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No accounts yet</p>}
          </CardContent>
        </Card>

        {/* Delivery Risk */}
        <Card className={atRiskProjects.length > 0 ? "border-amber-200 dark:border-amber-900/50" : ""}>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Flame size={14} className="text-red-400" /> Delivery Risk
                {atRiskProjects.length > 0 && <Badge variant="destructive" className="text-[10px]">{atRiskProjects.length}</Badge>}
              </CardTitle>
              <CardDescription>Projects with health score below 65</CardDescription>
            </div>
            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => navigate("/projects")}>
              All <ArrowRight size={11} className="ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {atRiskProjects.slice(0, 8).map(p => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate(`/projects/${p.id}/command`)}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium truncate">{p.name}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{p.accountName}</p>
                  <Progress value={p.healthScore ?? 0} className="h-1 mt-1 w-24 [&>div]:bg-red-400" />
                </div>
                <div className="flex items-center gap-1.5 ml-2 shrink-0">
                  <span className="text-xs font-bold text-red-400">{p.healthScore ?? "—"}</span>
                  <span title="Command Center"><Rocket size={11} className="text-muted-foreground" /></span>
                </div>
              </div>
            ))}
            {atRiskProjects.length === 0 && (
              <div className="flex items-center gap-2 px-3 py-4 text-emerald-400">
                <CheckCircle2 size={14} />
                <span className="text-xs">All projects healthy</span>
              </div>
            )}

            {/* Blocked tasks summary */}
            <div className="pt-3 border-t border-border mt-2">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <AlertTriangle size={10} className="text-amber-400" /> Execution Signals
                </span>
              </div>
              {[
                { label: "Blocked tasks", value: entities.tasks.blocked, color: entities.tasks.blocked > 0 ? "text-red-400" : "text-muted-foreground" },
                { label: "Overdue milestones", value: milestones.filter(m => m.dueDate && isBefore(new Date(m.dueDate), new Date()) && m.status !== "completed").length, color: "text-amber-400" },
                { label: "Pending CRs", value: entities.changeRequests.pending, color: entities.changeRequests.pending > 0 ? "text-amber-400" : "text-muted-foreground" },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between px-1 py-0.5">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <span className={`text-sm font-semibold ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Margin Watch */}
        <Card>
          <CardHeader className="pb-3">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <DollarSign size={14} className="text-emerald-400" /> Margin Watch
              </CardTitle>
              <CardDescription>Active projects sorted by remaining margin</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {marginProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No active projects</p>
            ) : marginProjects.map(p => (
              <button key={p.id} className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left" onClick={() => navigate(`/projects/${p.id}/command`)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium truncate">{p.name}</span>
                    <span className={`text-xs font-bold shrink-0 ${p.margin !== null && p.margin < 20 ? "text-red-400" : p.margin !== null && p.margin < 35 ? "text-amber-400" : "text-emerald-400"}`}>
                      {p.margin !== null ? `${p.margin}%` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>Budget {fmt(p.budget)}</span>
                    {p.invoiced > 0 && <span>Invoiced {fmt(p.invoiced)}</span>}
                  </div>
                  {p.budget > 0 && (
                    <Progress
                      value={p.budget > 0 ? Math.min(100, ((p.consumedCost || 0) / p.budget) * 100) : 0}
                      className={`h-1 mt-1 ${(p.consumedCost || 0) / p.budget > 0.9 ? "[&>div]:bg-red-500" : (p.consumedCost || 0) / p.budget > 0.7 ? "[&>div]:bg-amber-400" : ""}`}
                    />
                  )}
                </div>
              </button>
            ))}
            <div className="pt-3 border-t border-border">
              <div className="flex items-center justify-between px-2 mb-1">
                <span className="text-xs text-muted-foreground">Total Invoiced</span>
                <span className="text-sm font-semibold">{fmt(totalInvoiceValue)}</span>
              </div>
              <div className="flex items-center justify-between px-2 mb-1">
                <span className="text-xs text-muted-foreground">Collected</span>
                <span className="text-sm font-semibold text-emerald-400">{fmt(paidValue)}</span>
              </div>
              <div className="flex items-center justify-between px-2">
                <span className="text-xs text-muted-foreground">Overdue</span>
                <span className={`text-sm font-semibold ${overdueValue > 0 ? "text-red-400" : "text-muted-foreground"}`}>{fmt(overdueValue)}</span>
              </div>
              <Button size="sm" variant="ghost" className="w-full text-xs h-7 text-muted-foreground mt-2" onClick={() => navigate("/finance")}>
                Open Finance <ArrowRight size={11} className="ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary row: Upcoming Go-Lives | Staffing Pulse */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Upcoming Go-Lives */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CalendarCheck size={14} className="text-blue-400" /> Upcoming Go-Lives & Milestones
                {upcomingGoLives.length > 0 && <Badge variant="secondary" className="text-[10px]">{upcomingGoLives.length} in 30 days</Badge>}
              </CardTitle>
              <CardDescription>Milestones due in the next 30 days</CardDescription>
            </div>
            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => navigate("/milestones")}>
              All <ArrowRight size={11} className="ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingGoLives.length === 0 ? (
              <div className="flex items-center gap-2 p-3 text-muted-foreground">
                <CalendarCheck size={14} className="text-emerald-400" />
                <span className="text-xs">No milestones due in the next 30 days</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {upcomingGoLives.map(m => {
                  const daysOut = Math.ceil((new Date(m.dueDate).getTime() - Date.now()) / 86400000);
                  return (
                    <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate(`/projects/${m.projectId}/command`)}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{m.name}</p>
                        <p className="text-[10px] text-muted-foreground">{m.projectName}</p>
                      </div>
                      <div className="text-right ml-3 shrink-0">
                        <p className="text-xs font-semibold">{m.dueDate ? format(new Date(m.dueDate), "MMM d") : "—"}</p>
                        <p className={`text-[10px] ${daysOut <= 7 ? "text-amber-500" : "text-muted-foreground"}`}>
                          {daysOut === 0 ? "Today" : daysOut === 1 ? "Tomorrow" : `${daysOut}d away`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Staffing Pulse */}
        <Card>
          <CardHeader className="pb-3">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers size={14} className="text-violet-400" /> Staffing Pulse
              </CardTitle>
              <CardDescription>Bench · Over-allocated · Soft-booked · Open requests</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: "Bench / Unallocated", value: benchCount, icon: UserX, color: benchCount > 0 ? "text-blue-400" : "text-muted-foreground", bg: benchCount > 0 ? "bg-blue-50 dark:bg-blue-950/20" : "bg-muted/30" },
                { label: "Over-allocated", value: overallocated, icon: AlertTriangle, color: overallocated > 0 ? "text-red-400" : "text-muted-foreground", bg: overallocated > 0 ? "bg-red-50 dark:bg-red-950/20" : "bg-muted/30" },
                { label: "Soft-booked (Pipeline)", value: softBookedAllocs.length, icon: UserCheck, color: "text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/20" },
                { label: "Open Staffing Requests", value: openRequests.length, icon: Briefcase, color: openRequests.length > 0 ? "text-violet-400" : "text-muted-foreground", bg: openRequests.length > 0 ? "bg-violet-50 dark:bg-violet-950/20" : "bg-muted/30" },
              ].map(k => (
                <div key={k.label} className={`rounded-lg border p-3 ${k.bg}`}>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                    <k.icon size={10} className={k.color} />
                    {k.label}
                  </div>
                  <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 pt-2 border-t border-border">
              {[
                { label: "Total Resources", value: entities.resources.total },
                { label: "Employees", value: entities.resources.employees },
                { label: "Contractors", value: entities.resources.contractors },
                { label: "Hard-allocated (active)", value: activeAllocs.filter(a => a.allocationType === "hard").length },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between px-1">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-semibold">{item.value}</span>
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="ghost" className="flex-1 text-xs h-7 text-muted-foreground" onClick={() => navigate("/allocations")}>
                  Allocations <ArrowRight size={11} className="ml-1" />
                </Button>
                <Button size="sm" variant="ghost" className="flex-1 text-xs h-7 text-muted-foreground" onClick={() => navigate("/staffing-requests")}>
                  Requests <ArrowRight size={11} className="ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform Activity */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity size={14} className="text-blue-400" /> Platform Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Tasks in flight", value: entities.tasks.total - entities.tasks.completed, icon: Briefcase, color: "text-blue-400" },
              { label: "Blocked tasks", value: entities.tasks.blocked, icon: AlertTriangle, color: entities.tasks.blocked > 0 ? "text-red-400" : "text-muted-foreground" },
              { label: "Pending timesheets", value: entities.timesheets.pending, icon: Clock, color: entities.timesheets.pending > 0 ? "text-amber-400" : "text-muted-foreground" },
              { label: "Form responses", value: entities.forms.responses, icon: CheckCircle2, color: "text-emerald-400" },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <item.icon size={16} className={item.color} />
                <div>
                  <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
