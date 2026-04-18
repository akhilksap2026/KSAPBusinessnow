import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { StatCard, PageHeader, SectionCard, StatusBadge, HealthBar } from "@/components/workspace/ui";
import { useAuthRole } from "@/lib/auth";
import {
  AlertTriangle, ExternalLink, RefreshCw, BarChart3, DollarSign,
  Users, Calendar, TrendingDown, XCircle, Activity, TrendingUp, Info
} from "lucide-react";

const API = "/api";
function fmt(v: number) {
  if (!v) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

export default function PortfolioPage() {
  const { role } = useAuthRole();
  const isOpsRole = role === "admin" || role === "delivery_director";
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [directorData, setDirectorData] = useState<any>(null);
  const [directorLoading, setDirectorLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("projects");

  const load = () => {
    setLoading(true);
    fetch(`${API}/portfolio`).then(r => r.json()).then(d => { setData(d); setLoading(false); });
  };
  const loadDirector = () => {
    if (directorData) return;
    setDirectorLoading(true);
    fetch(`${API}/portfolio/director`).then(r => r.json()).then(d => { setDirectorData(d); setDirectorLoading(false); }).catch(() => setDirectorLoading(false));
  };
  useEffect(() => { load(); }, []);

  if (loading || !data) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const { summary, projects, accounts, upcomingGoLives, atRiskProjects, operations } = data;

  return (
    <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
      <PageHeader
        title="Portfolio Command Center"
        description="All active projects · Health · Revenue · Utilization · Risk"
        actions={
          <Button size="sm" variant="outline" onClick={load} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />Refresh
          </Button>
        }
      />

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        <StatCard label="Active Projects" value={summary.activeProjects} icon={BarChart3} subtext={`${summary.totalProjects} total`} />
        <StatCard label="At Risk" value={summary.atRiskCount} icon={AlertTriangle} iconColor={summary.atRiskCount > 0 ? "text-red-600" : "text-muted-foreground"} subtext="health < 65" />
        <StatCard label="Go-Lives (90d)" value={summary.upcomingGoLives} icon={Calendar} subtext="upcoming" />
        <StatCard label="Total Budget" value={fmt(summary.totalBudget)} icon={DollarSign} subtext="under mgmt" />
        <StatCard label="Revenue Billed" value={fmt(summary.totalBilled)} icon={DollarSign} iconColor="text-emerald-600" subtext="to date" />
        <StatCard label="Revenue at Risk" value={fmt(summary.revenueAtRisk)} icon={TrendingDown} iconColor={summary.revenueAtRisk > 0 ? "text-red-600" : "text-muted-foreground"} subtext="at-risk projects" />
        <StatCard label="Allocated FTE" value={summary.totalAllocatedFTE} icon={Users} iconColor="text-blue-600" subtext="hard allocations" />
        <StatCard label="Overdue Invoices" value={fmt(summary.overdueInvoiceAmount)} icon={AlertTriangle} iconColor={summary.overdueInvoiceCount > 0 ? "text-amber-600" : "text-muted-foreground"} subtext={`${summary.overdueInvoiceCount} invoices`} />
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); if (v === "director") loadDirector(); }}>
        <TabsList className="mb-4">
          <TabsTrigger value="projects">All Projects ({projects.length})</TabsTrigger>
          <TabsTrigger value="accounts">Account Health ({accounts.length})</TabsTrigger>
          <TabsTrigger value="golives">Go-Lives ({upcomingGoLives.length})</TabsTrigger>
          <TabsTrigger value="atrisk">
            At Risk
            {atRiskProjects.length > 0 && (
              <span className="ml-1.5 bg-destructive text-destructive-foreground text-[10px] rounded-full px-1.5 py-px">{atRiskProjects.length}</span>
            )}
          </TabsTrigger>
          {isOpsRole && <TabsTrigger value="operations">Operations</TabsTrigger>}
          <TabsTrigger value="director">Director View</TabsTrigger>
        </TabsList>

        {/* Projects Table */}
        <TabsContent value="projects">
          <SectionCard noPadding>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium">Project</th>
                  <th className="text-left px-4 py-3 font-medium">Account</th>
                  <th className="text-left px-4 py-3 font-medium">PM</th>
                  <th className="text-left px-4 py-3 font-medium">Phase</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium w-36">Health</th>
                  <th className="text-center px-4 py-3 font-medium">Progress</th>
                  <th className="text-right px-4 py-3 font-medium">Budget</th>
                  <th className="text-right px-4 py-3 font-medium">Billed</th>
                  <th className="text-center px-4 py-3 font-medium">Overdue</th>
                  <th className="text-left px-4 py-3 font-medium">Go-Live</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {projects.sort((a: any, b: any) => (a.healthScore || 75) - (b.healthScore || 75)).map((p: any) => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.accountName}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.pmName || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.currentPhase || "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 min-w-[120px]"><HealthBar score={p.healthScore || 75} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-[80px]">
                        <Progress value={p.completionPct} className="h-1.5 w-16" />
                        <span className="text-xs text-muted-foreground">{p.completionPct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-foreground font-medium text-sm">{fmt(p.budgetValue)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-medium text-sm">{fmt(p.billedValue)}</td>
                    <td className="px-4 py-3 text-center">
                      {p.overdueMilestones > 0
                        ? <span className="text-xs text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded-full">{p.overdueMilestones}</span>
                        : <span className="text-xs text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.goLiveDate || "—"}</td>
                    <td className="px-4 py-3">
                      <Link href={`/projects/${p.id}`}>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 hover:text-primary transition-colors" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </TabsContent>

        {/* Accounts Grid */}
        <TabsContent value="accounts">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {accounts.sort((a: any, b: any) => (a.healthScore || 75) - (b.healthScore || 75)).map((a: any) => (
              <div key={a.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-foreground text-sm">{a.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.segment} · {a.activeProjects} active project{a.activeProjects !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${(a.healthScore || 75) >= 80 ? "text-emerald-600" : (a.healthScore || 75) >= 65 ? "text-amber-600" : "text-red-600"}`}>{a.healthScore || 75}</p>
                    <p className="text-xs text-muted-foreground">health</p>
                  </div>
                </div>
                <HealthBar score={a.healthScore || 75} />
                <div className="flex items-center justify-between text-xs mt-3">
                  <span className="text-muted-foreground">ACV: <span className="text-foreground font-medium">{a.annualContractValue ? fmt(a.annualContractValue) : "—"}</span></span>
                  <span className="text-muted-foreground">Renewal: <span className="text-foreground">{a.renewalDate || "—"}</span></span>
                </div>
                {a.overdueInvoices > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1.5 rounded-lg mt-2">
                    <AlertTriangle className="h-3 w-3" />{a.overdueInvoices} overdue invoice{a.overdueInvoices !== 1 ? "s" : ""}
                  </div>
                )}
                <Link href={`/accounts/${a.id}`}>
                  <Button size="sm" variant="ghost" className="w-full h-7 text-xs text-muted-foreground mt-2">
                    View Account <ExternalLink className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Go-Lives */}
        <TabsContent value="golives">
          {upcomingGoLives.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">No go-lives scheduled in the next 90 days</div>
          ) : (
            <div className="space-y-2">
              {upcomingGoLives.map((p: any) => {
                const daysUntil = Math.floor((new Date(p.goLiveDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={p.id} className={`flex items-center justify-between p-4 rounded-xl border bg-card ${daysUntil <= 14 ? "border-red-200 bg-red-50" : daysUntil <= 30 ? "border-amber-200 bg-amber-50" : ""}`}>
                    <div>
                      <p className="font-medium text-foreground text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.accountName} · PM: {p.pmName || "—"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{p.goLiveDate}</p>
                      <p className={`text-xs font-medium ${daysUntil <= 14 ? "text-red-600" : daysUntil <= 30 ? "text-amber-600" : "text-muted-foreground"}`}>{daysUntil} days</p>
                    </div>
                    <Link href={`/projects/${p.id}`}>
                      <Button size="sm" variant="outline" className="text-xs">View <ExternalLink className="h-3 w-3 ml-1" /></Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* At Risk */}
        <TabsContent value="atrisk">
          {atRiskProjects.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-3xl mb-2">✓</div>
              <p className="text-foreground font-medium text-sm">No at-risk projects</p>
              <p className="text-muted-foreground text-xs mt-1">All projects health score above 65</p>
            </div>
          ) : (
            <div className="space-y-2">
              {atRiskProjects.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-4 rounded-xl border border-red-200 bg-red-50">
                  <div>
                    <p className="font-medium text-foreground text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.accountName}</p>
                  </div>
                  <div className="w-32"><HealthBar score={p.healthScore || 0} /></div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Remaining value</p>
                    <p className="text-sm font-semibold text-red-600">{fmt(p.budgetValue - p.billedValue)}</p>
                  </div>
                  <Link href={`/projects/${p.id}`}>
                    <Button size="sm" variant="outline" className="text-xs">View <ExternalLink className="h-3 w-3 ml-1" /></Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Operations Tab — admin/delivery_director only */}
        {isOpsRole && (
          <TabsContent value="operations">
            {!operations ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
                <Activity className="h-4 w-4" />Operations data not available
              </div>
            ) : (
              <div className="space-y-6">
                {/* Revenue & Cash Flow */}
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                  <StatCard label="Total ARR" value={fmt(operations.totalARR)} icon={TrendingUp} iconColor="text-emerald-600" subtext="contracted revenue" />
                  <StatCard label="Collected" value={fmt(operations.invoiceCashFlow.paid)} icon={DollarSign} iconColor="text-emerald-600" subtext={`${operations.invoiceCashFlow.collectionRate}% rate`} />
                  <StatCard label="Outstanding" value={fmt(operations.invoiceCashFlow.outstanding)} icon={DollarSign} iconColor="text-blue-500" subtext="sent / pending" />
                  <StatCard label="Overdue" value={fmt(operations.invoiceCashFlow.overdue)} icon={AlertTriangle} iconColor={operations.invoiceCashFlow.overdue > 0 ? "text-red-600" : "text-muted-foreground"} subtext="past due" />
                  <StatCard label="Draft" value={fmt(operations.invoiceCashFlow.draft)} icon={DollarSign} iconColor="text-muted-foreground" subtext="not sent yet" />
                  <StatCard label="Collection Rate" value={`${operations.invoiceCashFlow.collectionRate}%`} icon={BarChart3} iconColor={operations.invoiceCashFlow.collectionRate >= 80 ? "text-emerald-600" : "text-amber-600"} subtext="paid / total" />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {/* Project Status Distribution */}
                  <SectionCard title="Project Status Distribution" actions={<Activity className="h-4 w-4 text-muted-foreground" />}>
                    <div className="space-y-3">
                      {operations.statusDistribution.map((s: any) => {
                        const total = operations.statusDistribution.reduce((acc: number, x: any) => acc + x.value, 0);
                        const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
                        return (
                          <div key={s.name} className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground w-20 shrink-0">{s.name}</span>
                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                            </div>
                            <span className="text-sm font-medium w-10 text-right">{s.value}</span>
                            <span className="text-xs text-muted-foreground w-8">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </SectionCard>

                  {/* Resource Capacity Pulse */}
                  <SectionCard title="Resource Capacity Pulse" actions={<Users className="h-4 w-4 text-muted-foreground" />}>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 p-3 text-center">
                        <p className="text-2xl font-bold text-orange-600">{operations.resourceCapacity.overallocated}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Overallocated (&gt;100%)</p>
                      </div>
                      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-3 text-center">
                        <p className="text-2xl font-bold text-blue-600">{operations.resourceCapacity.softBooked}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Active Allocations</p>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
                        <p className="text-2xl font-bold text-foreground">{operations.resourceCapacity.bench}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">On Bench</p>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
                        <p className="text-2xl font-bold text-foreground">{operations.resourceCapacity.total}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Total Headcount</p>
                      </div>
                    </div>
                  </SectionCard>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {/* Margin Watch */}
                  <SectionCard title="Margin Watch (Active Projects)" noPadding actions={<TrendingDown className="h-4 w-4 text-muted-foreground" />}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground bg-muted/30">
                          <th className="text-left px-4 py-2.5 font-medium">Project</th>
                          <th className="text-right px-4 py-2.5 font-medium">Budget</th>
                          <th className="text-right px-4 py-2.5 font-medium">Consumed</th>
                          <th className="text-right px-4 py-2.5 font-medium">Margin</th>
                          <th className="px-4 py-2.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {operations.marginWatch.map((p: any) => (
                          <tr key={p.id} className="hover:bg-muted/20">
                            <td className="px-4 py-2.5 font-medium text-sm">{p.name}</td>
                            <td className="px-4 py-2.5 text-right text-xs">{fmt(p.budget)}</td>
                            <td className="px-4 py-2.5 text-right text-xs">{fmt(p.consumedCost)}</td>
                            <td className="px-4 py-2.5 text-right">
                              {p.margin === null ? <span className="text-xs text-muted-foreground">—</span> : (
                                <span className={`text-xs font-semibold ${p.margin < 20 ? "text-red-600" : p.margin < 40 ? "text-amber-600" : "text-emerald-600"}`}>{p.margin}%</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <Link href={`/projects/${p.id}`}><ExternalLink className="h-3 w-3 text-muted-foreground/40 hover:text-primary" /></Link>
                            </td>
                          </tr>
                        ))}
                        {operations.marginWatch.length === 0 && (
                          <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs">No active projects</td></tr>
                        )}
                      </tbody>
                    </table>
                  </SectionCard>

                  {/* Data Health Alerts */}
                  <SectionCard title="Data Health Alerts" actions={<Info className="h-4 w-4 text-muted-foreground" />}>
                    {operations.dataHealthAlerts.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="text-2xl mb-1">✓</div>
                        <p className="text-sm text-muted-foreground">All data health checks passed</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {operations.dataHealthAlerts.map((a: any, i: number) => (
                          <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg text-xs border ${a.severity === "warn" ? "border-amber-200 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300" : "border-blue-200 bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300"}`}>
                            {a.severity === "warn" ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                            {a.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </SectionCard>
                </div>
              </div>
            )}
          </TabsContent>
        )}

        {/* Director View */}
        <TabsContent value="director">
          {directorLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!directorLoading && !directorData && (
            <div className="text-center py-12 text-muted-foreground text-sm">Click the tab to load Director data</div>
          )}
          {directorData && (() => {
            const { escalations = [], blockedProjects = [], summary = {} } = directorData;
            const conflictList: any[] = Array.isArray(directorData.staffingConflicts) ? directorData.staffingConflicts : (directorData.staffingConflicts?.overallocated ?? []);
            const conflictCount: number = directorData.staffingConflicts?.overallocatedCount ?? conflictList.length;
            const changeItems: any[] = Array.isArray(directorData.changeOrderAlerts) ? directorData.changeOrderAlerts : (directorData.changeOrderAlerts?.items ?? []);
            return (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatCard label="Escalations" value={summary.escalationCount ?? escalations.length} icon={AlertTriangle} iconColor={(summary.escalationCount ?? escalations.length) > 0 ? "text-red-600" : "text-muted-foreground"} />
                  <StatCard label="Blocked Projects" value={summary.blockedProjectCount ?? blockedProjects.length} icon={XCircle} iconColor={(summary.blockedProjectCount ?? blockedProjects.length) > 0 ? "text-red-600" : "text-muted-foreground"} />
                  <StatCard label="Overdue Milestones" value={summary.overdueMilestoneCount ?? 0} icon={AlertTriangle} iconColor={(summary.overdueMilestoneCount ?? 0) > 0 ? "text-amber-600" : "text-muted-foreground"} />
                  <StatCard label="Staffing Conflicts" value={conflictCount} icon={Users} iconColor={conflictCount > 0 ? "text-orange-600" : "text-muted-foreground"} />
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <SectionCard title={`Escalations (${escalations.length})`} noPadding actions={escalations.length > 0 ? <span className="text-xs text-red-600 font-medium">{escalations.length} active</span> : undefined}>
                    {escalations.length === 0
                      ? <div className="py-10 text-center text-muted-foreground text-sm">No escalations</div>
                      : <div className="divide-y divide-border">{escalations.map((e: any) => (
                          <div key={e.id} className="px-4 py-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium text-foreground text-sm truncate">{e.projectName || e.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{e.accountName}</p>
                              {e.description && <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">{e.description}</p>}
                            </div>
                            <div className="shrink-0 flex items-center gap-2">
                              <StatusBadge status={e.status || "at_risk"} />
                              <Link href={`/projects/${e.projectId || e.id}`}><ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 hover:text-primary" /></Link>
                            </div>
                          </div>
                        ))}</div>}
                  </SectionCard>
                  <SectionCard title={`Blocked Projects (${blockedProjects.length})`} noPadding actions={blockedProjects.length > 0 ? <span className="text-xs text-orange-600 font-medium">{blockedProjects.length} blocked</span> : undefined}>
                    {blockedProjects.length === 0
                      ? <div className="py-10 text-center text-muted-foreground text-sm">No blocked projects</div>
                      : <div className="divide-y divide-border">{blockedProjects.map((p: any) => (
                          <div key={p.id} className="px-4 py-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium text-foreground text-sm truncate">{p.name}</p>
                              <p className="text-xs text-muted-foreground">{p.accountName}</p>
                            </div>
                            <div className="shrink-0 flex items-center gap-2">
                              <StatusBadge status={p.status} />
                              <Link href={`/projects/${p.id}/command`}><ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 hover:text-primary" /></Link>
                            </div>
                          </div>
                        ))}</div>}
                  </SectionCard>
                </div>
                {conflictList.length > 0 && (
                  <SectionCard title={`Staffing Conflicts (${conflictList.length})`} noPadding>
                    <div className="divide-y divide-border">
                      {conflictList.map((c: any, i: number) => (
                        <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground text-sm truncate">{c.resourceName || c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.totalAllocation ? `${c.totalAllocation}% allocated` : ""}</p>
                          </div>
                          <Users className="h-4 w-4 text-orange-500" />
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}
                {changeItems.length > 0 && (
                  <SectionCard title={`Change Order Alerts (${changeItems.length})`} noPadding>
                    <div className="divide-y divide-border">
                      {changeItems.map((c: any, i: number) => (
                        <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground text-sm truncate">{c.title || c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.projectName}</p>
                          </div>
                          <Link href={`/projects/${c.projectId}`}><ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 hover:text-primary" /></Link>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
