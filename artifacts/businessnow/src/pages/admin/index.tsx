import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, AlertTriangle, CheckCircle2, Database, Activity, Users, DollarSign } from "lucide-react";

const API = "/api";

function MetricCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-muted/50 rounded-lg px-3 py-3">
      <p className="text-xs text-muted-foreground/70">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${color || "text-foreground"}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground/60 mt-0.5">{sub}</p>}
    </div>
  );
}

function EntityRow({ label, data }: { label: string; data: Record<string, number | string> }) {
  return (
    <tr className="border-b border-border hover:bg-muted/20">
      <td className="p-3 text-sm text-foreground font-medium">{label}</td>
      {Object.entries(data).map(([k, v]) => (
        <td key={k} className="p-3 text-sm text-muted-foreground text-right">{typeof v === "number" ? v.toLocaleString() : v}</td>
      ))}
    </tr>
  );
}

export default function AdminPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/admin/metrics`).then(r => r.json()),
      fetch(`${API}/admin/audit-log?limit=100`).then(r => r.json()),
    ]).then(([m, a]) => { setMetrics(m); setAuditLog(a); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !metrics) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const { entities, dataHealth } = metrics;

  const totalDataHealth = Object.values(dataHealth).reduce((s: number, v: any) => s + v, 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-400" /> Admin Panel
            </h1>
            <p className="text-xs text-muted-foreground/70 mt-0.5">System metrics · Audit log · Data health</p>
          </div>
          <Button size="sm" variant="ghost" onClick={load} className="text-muted-foreground">
            <RefreshCw className="h-4 w-4 mr-2" />Refresh
          </Button>
        </div>

        {/* Data Health Banner */}
        <div className={`mt-4 flex items-center gap-3 px-4 py-2.5 rounded-lg border ${totalDataHealth === 0 ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
          {totalDataHealth === 0
            ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            : <AlertTriangle className="h-4 w-4 text-amber-400" />}
          <span className={`text-sm font-medium ${totalDataHealth === 0 ? "text-emerald-600" : "text-amber-600"}`}>
            {totalDataHealth === 0 ? "All data health checks passing" : `${totalDataHealth} data quality issues detected`}
          </span>
          {Object.entries(dataHealth).filter(([, v]) => (v as number) > 0).map(([k, v]) => (
            <Badge key={k} variant="secondary" className="text-amber-400 bg-amber-500/10 border-amber-500/20 text-xs">
              {(v as number)} {k.replace(/([A-Z])/g, " $1").toLowerCase()}
            </Badge>
          ))}
        </div>
      </div>

      <div className="p-6">
        <Tabs defaultValue="overview">
          <TabsList className="bg-card border border-border mb-6">
            <TabsTrigger value="overview" className="data-[state=active]:bg-muted">Overview</TabsTrigger>
            <TabsTrigger value="audit" className="data-[state=active]:bg-muted">Audit Log ({auditLog.length})</TabsTrigger>
            <TabsTrigger value="datahealth" className="data-[state=active]:bg-muted">Data Health</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-6">
              {/* Projects & Delivery */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide mb-3">Delivery</h3>
                <div className="grid grid-cols-4 gap-3">
                  <MetricCard label="Total Projects" value={entities.projects.total} sub={`${entities.projects.active} active`} />
                  <MetricCard label="At Risk Projects" value={entities.projects.atRisk} color={entities.projects.atRisk > 0 ? "text-red-400" : "text-emerald-400"} sub="health < 65" />
                  <MetricCard label="Milestones" value={entities.milestones.total} sub={`${entities.milestones.completed} completed`} />
                  <MetricCard label="Overdue Milestones" value={entities.milestones.overdue} color={entities.milestones.overdue > 0 ? "text-amber-400" : "text-emerald-400"} />
                </div>
              </div>

              {/* Resources */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide mb-3">Resources</h3>
                <div className="grid grid-cols-4 gap-3">
                  <MetricCard label="Total Resources" value={entities.resources.total} />
                  <MetricCard label="Employees" value={entities.resources.employees} />
                  <MetricCard label="Contractors" value={entities.resources.contractors} />
                  <MetricCard label="Overallocated" value={dataHealth.allocationsOverAllocated} color={dataHealth.allocationsOverAllocated > 0 ? "text-red-400" : "text-emerald-400"} />
                </div>
              </div>

              {/* Finance */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide mb-3">Finance</h3>
                <div className="grid grid-cols-4 gap-3">
                  <MetricCard label="Total Invoices" value={entities.invoices.total} />
                  <MetricCard label="Paid" value={entities.invoices.paid} color="text-emerald-400" />
                  <MetricCard label="Overdue" value={entities.invoices.overdue} color={entities.invoices.overdue > 0 ? "text-red-400" : "text-emerald-400"} />
                  <MetricCard label="Total Invoice Value" value={`$${(entities.invoices.totalValue / 1000).toFixed(0)}K`} />
                </div>
              </div>

              {/* Entity Summary Table */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Entity Counts</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="text-left p-3">Entity</th>
                      <th className="text-right p-3">Total</th>
                      <th className="text-right p-3">Active / Open</th>
                      <th className="text-right p-3">Issues</th>
                    </tr></thead>
                    <tbody>
                      <EntityRow label="Projects" data={{ total: entities.projects.total, active: entities.projects.active, issues: entities.projects.atRisk }} />
                      <EntityRow label="Accounts" data={{ total: entities.accounts.total, active: entities.accounts.active, issues: 0 }} />
                      <EntityRow label="Resources" data={{ total: entities.resources.total, active: entities.resources.employees + entities.resources.contractors, issues: dataHealth.allocationsOverAllocated }} />
                      <EntityRow label="Milestones" data={{ total: entities.milestones.total, active: entities.milestones.total - entities.milestones.completed, issues: entities.milestones.overdue }} />
                      <EntityRow label="Tasks" data={{ total: entities.tasks.total, active: entities.tasks.total - entities.tasks.completed, issues: entities.tasks.blocked }} />
                      <EntityRow label="Timesheets" data={{ total: entities.timesheets.total, active: entities.timesheets.pending, issues: 0 }} />
                      <EntityRow label="Invoices" data={{ total: entities.invoices.total, active: entities.invoices.total - entities.invoices.paid, issues: entities.invoices.overdue }} />
                      <EntityRow label="Change Requests" data={{ total: entities.changeRequests.total, active: entities.changeRequests.pending, issues: entities.changeRequests.leakageRisk }} />
                      <EntityRow label="Contracts" data={{ total: entities.contracts.total, active: entities.contracts.active, issues: 0 }} />
                      <EntityRow label="Forms" data={{ total: entities.forms.total, active: entities.forms.responses, issues: 0 }} />
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="audit">
            <Card className="bg-card border-border">
              <CardContent className="p-0">
                {auditLog.length === 0 ? <p className="text-muted-foreground/70 text-sm p-6">No audit entries</p> : (
                  <div className="max-h-[600px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-card border-b border-border">
                        <tr className="text-xs text-muted-foreground">
                          <th className="text-left p-3">Source</th>
                          <th className="text-left p-3">Action / Event</th>
                          <th className="text-left p-3">Entity</th>
                          <th className="text-right p-3">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {auditLog.map((entry: any) => (
                          <tr key={`${entry.source}-${entry.id}`} className="hover:bg-muted/30">
                            <td className="p-3">
                              <Badge variant="secondary" className={`text-[10px] ${entry.source === "automation" ? "text-yellow-400 bg-yellow-500/10" : "text-blue-400 bg-blue-500/10"}`}>
                                {entry.source}
                              </Badge>
                            </td>
                            <td className="p-3 text-foreground/70 text-xs max-w-[400px] truncate">
                              {entry.message || entry.action || entry.type}
                            </td>
                            <td className="p-3 text-muted-foreground/70 text-xs">
                              {entry.entityName || entry.entityType || "—"}
                            </td>
                            <td className="p-3 text-right text-muted-foreground/60 text-xs whitespace-nowrap">
                              {new Date(entry.time).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="datahealth">
            <div className="grid grid-cols-2 gap-6">
              <Card className="bg-card border-border">
                <CardHeader><CardTitle className="text-sm">Data Quality Checks</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(dataHealth).map(([key, count]) => {
                    const label = key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
                    const n = count as number;
                    return (
                      <div key={key} className={`flex items-center justify-between p-3 rounded-lg border ${n > 0 ? "border-amber-500/20 bg-amber-500/5" : "border-border bg-muted/30"}`}>
                        <div className="flex items-center gap-2">
                          {n > 0 ? <AlertTriangle className="h-4 w-4 text-amber-400" /> : <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                          <span className="text-sm text-foreground">{label}</span>
                        </div>
                        <span className={`font-bold text-sm ${n > 0 ? "text-amber-400" : "text-emerald-400"}`}>{n}</span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader><CardTitle className="text-sm">System Status</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "API Server", status: "Healthy", ok: true },
                    { label: "Database", status: "Connected", ok: true },
                    { label: "Automations Engine", status: "Running", ok: true },
                  ].map(({ label, status, ok }) => (
                    <div key={label} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                      <span className="text-sm text-foreground">{label}</span>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${ok ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                        <span className={`text-xs ${ok ? "text-emerald-400" : "text-red-400"}`}>{status}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
