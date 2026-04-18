import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuthRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  DollarSign, TrendingUp, AlertTriangle, Clock, CheckCircle, FileText,
  RefreshCw, ChevronDown, ChevronRight, XCircle, BarChart3, Percent, Search, ExternalLink
} from "lucide-react";

const API = "/api";

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    paid: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    sent: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    draft: "bg-zinc-500/10 text-muted-foreground border-border/30",
    overdue: "bg-red-500/10 text-red-400 border-red-500/30",
    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    submitted: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    rejected: "bg-red-500/10 text-red-400 border-red-500/30",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${map[s] || "bg-muted text-muted-foreground border-border"}`}>{s}</span>;
}

// ── WIP Tab ──────────────────────────────────────────────────────────────────
function WIPTab() {
  const [, navigate] = useLocation();
  const [wip, setWip] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [wipSearch, setWipSearch] = useState("");

  useEffect(() => { fetch(`${API}/finance/wip`).then(r => r.json()).then(setWip); }, []);

  const toggle = (id: number) => {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const filteredWip = wipSearch
    ? wip.filter(p => p.projectName?.toLowerCase().includes(wipSearch.toLowerCase()))
    : wip;

  const total = wip.reduce((s, p) => s + p.estimatedValue, 0);
  const totalHours = wip.reduce((s, p) => s + p.billableHours, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">WIP Value</p>
            <p className="text-2xl font-bold text-foreground mt-1">{fmt(total)}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">estimated at blended rate</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Billable Hours</p>
            <p className="text-2xl font-bold text-foreground mt-1">{totalHours.toFixed(0)}h</p>
            <p className="text-xs text-muted-foreground/70 mt-1">approved, not yet invoiced</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Projects with WIP</p>
            <p className="text-2xl font-bold text-foreground mt-1">{wip.length}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">active this period</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm text-foreground">WIP by Project</CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search projects…"
                value={wipSearch}
                onChange={e => setWipSearch(e.target.value)}
                className="pl-8 pr-3 h-7 text-xs border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-44"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {wip.length === 0 ? (
            <p className="text-muted-foreground/70 text-sm p-6">No approved WIP entries found</p>
          ) : filteredWip.length === 0 ? (
            <p className="text-muted-foreground/70 text-sm p-6">No projects match your search</p>
          ) : (
            <div className="divide-y divide-border">
              {filteredWip.map(p => (
                <div key={p.projectId}>
                  <div onClick={() => toggle(p.projectId)} className="w-full flex items-center justify-between p-4 hover:bg-muted/50 text-left cursor-pointer select-none">
                    <div className="flex items-center gap-3">
                      {expanded.has(p.projectId) ? <ChevronDown className="h-4 w-4 text-muted-foreground/70" /> : <ChevronRight className="h-4 w-4 text-muted-foreground/70" />}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-foreground">{p.projectName}</p>
                          <span
                            onClick={e => { e.stopPropagation(); navigate(`/projects/${p.projectId}`); }}
                            className="opacity-40 hover:opacity-100 transition-opacity cursor-pointer"
                            title="Open project"
                          >
                            <ExternalLink className="h-3 w-3 text-primary" />
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground/70">{p.entries.length} entries · {p.billableHours.toFixed(1)}h billable</p>
                      </div>
                    </div>
                    <span className="text-emerald-400 font-semibold text-sm">{fmt(p.estimatedValue)}</span>
                  </div>
                  {expanded.has(p.projectId) && (
                    <div className="bg-background px-4 pb-3">
                      <table className="w-full text-xs text-muted-foreground">
                        <thead><tr className="border-b border-border">
                          <th className="text-left py-2 font-medium">Resource</th>
                          <th className="text-left py-2 font-medium">Week</th>
                          <th className="text-right py-2 font-medium">Hours</th>
                          <th className="text-right py-2 font-medium">Billable</th>
                          <th className="text-right py-2 font-medium">Status</th>
                        </tr></thead>
                        <tbody>
                          {p.entries.map((e: any) => (
                            <tr key={e.id} className="border-b border-border">
                              <td className="py-1.5">{e.resourceName}</td>
                              <td className="py-1.5">{e.weekStart}</td>
                              <td className="py-1.5 text-right">{e.hoursLogged}h</td>
                              <td className="py-1.5 text-right">{e.billableHours}h</td>
                              <td className="py-1.5 text-right"><StatusBadge s={e.status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Receivables Tab ──────────────────────────────────────────────────────────
function ReceivablesTab() {
  const [data, setData] = useState<any>(null);

  useEffect(() => { fetch(`${API}/finance/receivables`).then(r => r.json()).then(setData); }, []);
  if (!data) return <div className="text-muted-foreground/70 text-sm p-8">Loading...</div>;

  const buckets = [
    { key: "current", label: "Current", color: "bg-emerald-500" },
    { key: "1-30", label: "1–30 days", color: "bg-amber-500" },
    { key: "31-60", label: "31–60 days", color: "bg-orange-500" },
    { key: "61-90", label: "61–90 days", color: "bg-red-400" },
    { key: "90+", label: "90+ days", color: "bg-red-600" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-3">
        {buckets.map(b => (
          <Card key={b.key} className="bg-card border-border">
            <CardContent className="pt-4">
              <div className={`w-2 h-2 rounded-full ${b.color} mb-2`} />
              <p className="text-xs text-muted-foreground">{b.label}</p>
              <p className="text-lg font-bold text-foreground mt-1">{fmt(data.agingBuckets[b.key]?.amount || 0)}</p>
              <p className="text-xs text-muted-foreground/70">{data.agingBuckets[b.key]?.count || 0} invoices</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground">Outstanding Receivables — {fmt(data.totalOutstanding)}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.receivables.length === 0 ? (
            <p className="text-muted-foreground/70 text-sm p-6">No outstanding receivables</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground text-xs">
                <th className="text-left p-4">Invoice #</th>
                <th className="text-left p-4">Project</th>
                <th className="text-right p-4">Amount</th>
                <th className="text-right p-4">Days Past Due</th>
                <th className="text-center p-4">Bucket</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {data.receivables.map((i: any) => (
                  <tr key={i.id} className="hover:bg-muted/30">
                    <td className="p-4 font-mono text-xs text-foreground">{i.invoiceNumber}</td>
                    <td className="p-4 text-foreground">{i.projectName}</td>
                    <td className="p-4 text-right font-semibold text-foreground">{fmt(i.amount)}</td>
                    <td className={`p-4 text-right font-medium ${i.daysPastDue > 60 ? "text-red-400" : i.daysPastDue > 30 ? "text-amber-400" : "text-muted-foreground"}`}>
                      {i.daysPastDue > 0 ? `+${i.daysPastDue}d` : "Current"}
                    </td>
                    <td className="p-4 text-center"><StatusBadge s={i.bucket === "current" ? "sent" : "overdue"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Margin Tab ──────────────────────────────────────────────────────────────
function MarginTab() {
  const [margin, setMargin] = useState<any[]>([]);
  useEffect(() => { fetch(`${API}/finance/margin`).then(r => r.json()).then(setMargin); }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Avg Planned Margin</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {margin.filter(p => p.plannedMargin !== null).length > 0
                ? `${Math.round(margin.filter(p => p.plannedMargin !== null).reduce((s, p) => s + p.plannedMargin, 0) / margin.filter(p => p.plannedMargin !== null).length)}%`
                : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Avg Current Margin</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {margin.filter(p => p.currentMargin !== null).length > 0
                ? `${Math.round(margin.filter(p => p.currentMargin !== null).reduce((s, p) => s + p.currentMargin, 0) / margin.filter(p => p.currentMargin !== null).length)}%`
                : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Projects at Risk</p>
            <p className="text-2xl font-bold text-red-400 mt-1">
              {margin.filter(p => p.marginRisks.length > 0).length}
            </p>
          </CardContent>
        </Card>
      </div>
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-muted-foreground text-xs">
              <th className="text-left p-4">Project</th>
              <th className="text-right p-4">Budget</th>
              <th className="text-right p-4">Invoiced</th>
              <th className="text-right p-4">Hours Used</th>
              <th className="text-right p-4">Planned Margin</th>
              <th className="text-right p-4">Current Margin</th>
              <th className="text-left p-4">Risks</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {margin.map(p => (
                <tr key={p.project.id} className="hover:bg-muted/30">
                  <td className="p-4">
                    <p className="text-foreground font-medium">{p.project.name}</p>
                    <p className="text-xs text-muted-foreground/70">{p.project.status}</p>
                  </td>
                  <td className="p-4 text-right text-foreground">{fmt(p.budgetValue)}</td>
                  <td className="p-4 text-right text-emerald-400">{fmt(p.invoicedRevenue)}</td>
                  <td className="p-4 text-right text-muted-foreground">{p.consumedHours}/{p.budgetHours}h</td>
                  <td className="p-4 text-right">
                    <span className={p.plannedMargin !== null && p.plannedMargin < 20 ? "text-red-400" : "text-foreground"}>
                      {p.plannedMargin !== null ? `${p.plannedMargin}%` : "—"}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <span className={p.currentMargin !== null && p.currentMargin < 20 ? "text-red-400" : p.currentMargin !== null ? "text-emerald-400" : "text-muted-foreground/70"}>
                      {p.currentMargin !== null ? `${p.currentMargin}%` : "—"}
                    </span>
                  </td>
                  <td className="p-4">
                    {p.marginRisks.length > 0
                      ? <span className="text-xs text-amber-400">{p.marginRisks[0]}</span>
                      : <span className="text-xs text-muted-foreground/60">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Timesheets Approval Tab ───────────────────────────────────────────────────
function TimesheetQueueTab() {
  const { user } = useAuthRole();
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState<Set<number>>(new Set());
  const [, navigate] = useLocation();

  useEffect(() => {
    fetch(`${API}/timesheets/pending-approval`)
      .then(r => r.json()).then(d => setQueue(Array.isArray(d) ? d : []))
      .catch(() => {
        fetch(`${API}/finance/timesheet-queue`).then(r => r.json()).then(d => setQueue(Array.isArray(d) ? d : [])).catch(() => {});
      });
  }, []);

  const approverName = user?.name ?? "Finance";
  const approvableQueue = queue.filter(t => t.resourceName !== user?.name);

  const bulkApproveAll = async () => {
    if (approvableQueue.length === 0) return;
    const ids = approvableQueue.map(t => t.id);
    await fetch(`${API}/timesheets/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, approvedByName: approverName }) });
    setQueue(prev => prev.filter(t => !ids.includes(t.id)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Timesheets Pending Approval</h3>
          <p className="text-xs text-muted-foreground/70">{queue.length} entries awaiting review</p>
        </div>
        <div className="flex items-center gap-2">
          {approvableQueue.length > 0 && (
            <Button size="sm" variant="outline" onClick={bulkApproveAll} className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50">
              <CheckCircle className="h-3 w-3 mr-1" /> Approve All ({approvableQueue.length})
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => navigate("/timesheets/approval")} className="h-7 text-xs">
            Full Review Queue <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </div>
      {queue.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-foreground font-medium">No timesheets pending approval</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground text-xs">
                <th className="text-left p-4">Resource</th>
                <th className="text-left p-4">Project</th>
                <th className="text-left p-4">Week</th>
                <th className="text-right p-4">Hours</th>
                <th className="text-right p-4">Billable</th>
                <th className="text-right p-4">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {queue.map(t => {
                  const isOwnEntry = t.resourceName === user?.name;
                  return (
                    <tr key={t.id} className="hover:bg-muted/30">
                      <td className="p-4 text-foreground">
                        {t.resourceName}
                        {isOwnEntry && <span className="ml-1.5 text-[10px] text-muted-foreground/60 border border-border rounded px-1 py-0.5">Own entry</span>}
                      </td>
                      <td className="p-4 text-foreground">{t.projectName}</td>
                      <td className="p-4 text-muted-foreground">{t.weekStart}</td>
                      <td className="p-4 text-right text-foreground font-medium">{t.hoursLogged}h</td>
                      <td className="p-4 text-right text-emerald-400">{t.billableHours ? `${t.billableHours}h` : "—"}</td>
                      <td className="p-4 text-right">
                        {isOwnEntry ? (
                          <span className="text-xs text-muted-foreground/40 italic">Self-approval blocked</span>
                        ) : (
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="ghost"
                              onClick={async () => {
                                setLoading(prev => new Set([...prev, t.id]));
                                await fetch(`${API}/timesheets/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [t.id], approvedByName: approverName }) });
                                setQueue(prev => prev.filter(x => x.id !== t.id));
                                setLoading(prev => { const n = new Set(prev); n.delete(t.id); return n; });
                              }}
                              disabled={loading.has(t.id)}
                              className="h-7 px-3 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="ghost"
                              onClick={async () => {
                                setLoading(prev => new Set([...prev, t.id]));
                                await fetch(`${API}/timesheets/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [t.id], reason: "Rejected by finance" }) });
                                setQueue(prev => prev.filter(x => x.id !== t.id));
                                setLoading(prev => { const n = new Set(prev); n.delete(t.id); return n; });
                              }}
                              disabled={loading.has(t.id)}
                              className="h-7 px-3 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">
                              <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function FinancePage() {
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => { fetch(`${API}/finance/summary`).then(r => r.json()).then(setSummary); }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-400" /> Finance
            </h1>
            <p className="text-xs text-muted-foreground/70 mt-0.5">WIP · Receivables · Approvals · Margin</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => fetch(`${API}/finance/summary`).then(r => r.json()).then(setSummary)} className="text-muted-foreground hover:text-foreground">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>

        {summary && (
          <div className="grid grid-cols-6 gap-3 mt-4">
            {[
              { label: "WIP Value", value: fmt(summary.wipEstimatedValue), sub: `${summary.wipHours}h approved`, color: "text-emerald-400" },
              { label: "Total Invoiced", value: fmt(summary.totalInvoiced), sub: `${summary.draftInvoices} drafts`, color: "text-foreground" },
              { label: "Outstanding", value: fmt(summary.outstandingAmount), sub: "receivables", color: "text-amber-400" },
              { label: "Overdue", value: fmt(summary.overdueAmount), sub: `${summary.overdueCount} invoices`, color: "text-red-400" },
              { label: "Pending Review", value: summary.pendingTimesheets, sub: "timesheets", color: "text-blue-400" },
              { label: "Contract TCV", value: fmt(summary.totalContractValue), sub: "under management", color: "text-violet-400" },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="bg-muted/50 rounded-lg px-3 py-2.5">
                <p className="text-xs text-muted-foreground/70">{label}</p>
                <p className={`text-lg font-bold ${color} mt-0.5`}>{value}</p>
                <p className="text-xs text-muted-foreground/60">{sub}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-6">
        <Tabs defaultValue="wip">
          {/* Tabs are split into two groups: Transactional (daily ops) and Analytics (periodic review) */}
          <div className="mb-6 space-y-1">
            <div className="flex items-center gap-4">
              <TabsList className="bg-card border border-border h-auto p-1">
                <TabsTrigger value="wip" className="data-[state=active]:bg-muted text-xs">WIP</TabsTrigger>
                <TabsTrigger value="receivables" className="data-[state=active]:bg-muted text-xs">Receivables</TabsTrigger>
                <TabsTrigger value="queue" className="data-[state=active]:bg-muted text-xs">
                  Approvals
                  {summary?.pendingTimesheets > 0 && <span className="ml-1.5 bg-amber-500 text-foreground text-[10px] rounded-full px-1.5 py-0.5 leading-none">{summary.pendingTimesheets}</span>}
                </TabsTrigger>
              </TabsList>
              <div className="w-px h-6 bg-border" />
              <TabsList className="bg-card border border-border h-auto p-1">
                <TabsTrigger value="margin" className="data-[state=active]:bg-muted text-xs">Margin</TabsTrigger>
              </TabsList>
            </div>
            <div className="flex items-center gap-4 pl-0.5">
              <p className="text-[10px] text-muted-foreground/60 tracking-wide uppercase">Transactional</p>
              <div className="w-px h-3 invisible" />
              <p className="text-[10px] text-muted-foreground/60 tracking-wide uppercase">Analytics</p>
            </div>
          </div>
          <TabsContent value="wip"><WIPTab /></TabsContent>
          <TabsContent value="receivables"><ReceivablesTab /></TabsContent>
          <TabsContent value="margin"><MarginTab /></TabsContent>
          <TabsContent value="queue"><TimesheetQueueTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
