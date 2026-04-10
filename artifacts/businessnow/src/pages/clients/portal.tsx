import { useState, useEffect, useCallback } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle, Clock, AlertTriangle, FileText, Truck, Calendar, Users,
  CheckSquare, Square, TrendingUp, DollarSign, Activity, RefreshCw, ThumbsUp, X,
} from "lucide-react";

const API = "/api";

function fmt(v: number) {
  if (!v) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function StatusPill({ s }: { s: string }) {
  const m: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-700",
    done: "bg-emerald-100 text-emerald-700",
    in_progress: "bg-blue-100 text-blue-700",
    active: "bg-blue-100 text-blue-700",
    on_track: "bg-emerald-100 text-emerald-700",
    at_risk: "bg-amber-100 text-amber-700",
    behind: "bg-red-100 text-red-700",
    pending: "bg-amber-100 text-amber-700",
    overdue: "bg-red-100 text-red-700",
    paid: "bg-emerald-100 text-emerald-700",
    sent: "bg-blue-100 text-blue-700",
    high: "bg-red-100 text-red-700",
    medium: "bg-amber-100 text-amber-700",
    low: "bg-slate-100 text-slate-700",
    todo: "bg-slate-100 text-slate-700",
    not_started: "bg-slate-100 text-slate-600",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m[s] || "bg-gray-100 text-gray-700"}`}>{s.replace(/_/g, " ")}</span>;
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-400" : "bg-red-500";
  const text = score >= 80 ? "text-emerald-700" : score >= 60 ? "text-amber-700" : "text-red-700";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-sm font-bold ${text}`}>{score}</span>
    </div>
  );
}

export default function ClientPortal() {
  const [, paramsWithId] = useRoute("/clients/:id/portal");
  const accountId = paramsWithId?.id ?? "1";
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<Set<number>>(new Set());
  const [statusReports, setStatusReports] = useState<Record<number, any[]>>({});
  const [approvalFormId, setApprovalFormId] = useState<number | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signing, setSigning] = useState<Set<number>>(new Set());

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/clients/${accountId}/portal`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!data?.projects) return;
    data.projects.forEach((p: any) => {
      fetch(`${API}/projects/${p.id}/status-reports`)
        .then(r => r.json())
        .then(reports => setStatusReports(prev => ({ ...prev, [p.id]: reports })))
        .catch(() => {});
    });
  }, [data?.projects]);

  const completeTask = async (taskId: number) => {
    setCompleting(prev => new Set([...prev, taskId]));
    await fetch(`${API}/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    load();
    setCompleting(prev => { const n = new Set(prev); n.delete(taskId); return n; });
  };

  const signMilestone = async (milestoneId: number) => {
    if (!signerName.trim()) return;
    setSigning(prev => new Set([...prev, milestoneId]));
    await fetch(`${API}/milestones/${milestoneId}/signoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signerName: signerName.trim() }),
    });
    setApprovalFormId(null);
    setSignerName("");
    setSigning(prev => { const n = new Set(prev); n.delete(milestoneId); return n; });
    load();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading your portal…</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-700 font-medium">Portal not available</p>
          <p className="text-slate-500 text-sm mt-1">Please contact your project manager</p>
        </div>
      </div>
    );
  }

  const { projects, milestones, actionNeeded, pendingApprovals, overdueMilestones, invoices, summary } = data;
  const completionPct = summary.totalMilestones > 0 ? (summary.completedMilestones / summary.totalMilestones) * 100 : 0;
  const allReports = Object.values(statusReports).flat().sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const hasAlerts = summary.actionsRequired > 0 || summary.overdueMilestones > 0 || summary.pendingApprovals > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-lg">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-lg">BUSINESSNow Client Portal</h1>
              <p className="text-xs text-slate-500">Your project delivery overview</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {hasAlerts && (
              <div className="flex items-center gap-1.5 bg-amber-100 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full">
                <AlertTriangle className="h-3.5 w-3.5" />
                {summary.actionsRequired + summary.pendingApprovals} items need attention
              </div>
            )}
            <button onClick={load} className="text-slate-400 hover:text-slate-600 transition-colors p-1.5">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Active Projects", value: summary.totalProjects, icon: Truck, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Milestones Done", value: `${summary.completedMilestones}/${summary.totalMilestones}`, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Actions Needed", value: summary.actionsRequired, icon: AlertTriangle, color: summary.actionsRequired > 0 ? "text-amber-600" : "text-slate-400", bg: "bg-amber-50" },
            { label: "Pending Approvals", value: summary.pendingApprovals, icon: FileText, color: summary.pendingApprovals > 0 ? "text-violet-600" : "text-slate-400", bg: "bg-violet-50" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label} className="bg-white border-slate-200 shadow-sm">
              <CardContent className="pt-4">
                <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-2`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <p className="text-2xl font-bold text-slate-900">{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Overall progress */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-700">Overall Delivery Progress</p>
              <span className="text-xl font-bold text-slate-900">{completionPct.toFixed(0)}%</span>
            </div>
            <Progress value={completionPct} className="h-2.5 bg-slate-100" />
            <p className="text-xs text-slate-400 mt-1.5">{summary.completedMilestones} of {summary.totalMilestones} milestones completed</p>
          </CardContent>
        </Card>

        {/* Main tabs */}
        <Tabs defaultValue="overview">
          <TabsList className="bg-white border border-slate-200 shadow-sm w-full justify-start">
            <TabsTrigger value="overview" className="data-[state=active]:bg-blue-600 data-[state=active]:text-foreground">
              Overview
            </TabsTrigger>
            <TabsTrigger value="tasks" className="data-[state=active]:bg-blue-600 data-[state=active]:text-foreground">
              My Tasks {summary.actionsRequired > 0 && <span className="ml-1.5 bg-amber-500 text-foreground text-xs rounded-full px-1.5">{summary.actionsRequired}</span>}
            </TabsTrigger>
            <TabsTrigger value="milestones" className="data-[state=active]:bg-blue-600 data-[state=active]:text-foreground">
              Milestones
            </TabsTrigger>
            <TabsTrigger value="invoices" className="data-[state=active]:bg-blue-600 data-[state=active]:text-foreground">
              Invoices
            </TabsTrigger>
            <TabsTrigger value="updates" className="data-[state=active]:bg-blue-600 data-[state=active]:text-foreground">
              Updates
            </TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Projects */}
            <div className="grid grid-cols-1 gap-3">
              {projects.map((p: any) => (
                <Card key={p.id} className="bg-white border-slate-200 shadow-sm">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900">{p.name}</h3>
                          <StatusPill s={p.status} />
                        </div>
                        {p.currentPhase && <p className="text-xs text-slate-500 mb-2">Current phase: {p.currentPhase}</p>}
                        <HealthBar score={p.healthScore || 75} />
                      </div>
                      <div className="text-right ml-4">
                        {p.endDate && (
                          <div>
                            <p className="text-xs text-slate-400">Est. completion</p>
                            <p className="text-sm font-semibold text-slate-700">{new Date(p.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Alerts */}
            {(summary.actionsRequired > 0 || summary.pendingApprovals > 0 || summary.overdueMilestones > 0) && (
              <div className="space-y-2">
                {summary.actionsRequired > 0 && (
                  <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-sm text-amber-800 font-medium">{summary.actionsRequired} action{summary.actionsRequired !== 1 ? "s" : ""} required — see the My Tasks tab</p>
                  </div>
                )}
                {summary.pendingApprovals > 0 && (
                  <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-lg px-4 py-3">
                    <FileText className="h-4 w-4 text-violet-600 shrink-0" />
                    <p className="text-sm text-violet-800 font-medium">{summary.pendingApprovals} change order{summary.pendingApprovals !== 1 ? "s" : ""} awaiting your approval</p>
                  </div>
                )}
                {summary.overdueMilestones > 0 && (
                  <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                    <Clock className="h-4 w-4 text-red-600 shrink-0" />
                    <p className="text-sm text-red-800 font-medium">{summary.overdueMilestones} milestone{summary.overdueMilestones !== 1 ? "s are" : " is"} overdue</p>
                  </div>
                )}
              </div>
            )}

            {/* Pending approvals (change orders) */}
            {pendingApprovals.length > 0 && (
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-violet-500" /> Change Orders Awaiting Your Approval
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pendingApprovals.map((cr: any) => (
                    <div key={cr.id} className="p-3 bg-violet-50 rounded-lg border border-violet-100">
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-medium text-slate-800">{cr.title}</p>
                        <Badge variant="outline" className="text-xs border-violet-300 text-violet-700 shrink-0">Review Required</Badge>
                      </div>
                      {cr.projectName && <p className="text-xs text-slate-500 mt-0.5">{cr.projectName}</p>}
                      <div className="flex gap-4 mt-1.5">
                        {cr.impactCost > 0 && <p className="text-xs text-slate-600">Cost impact: <span className="font-semibold">{fmt(cr.impactCost)}</span></p>}
                        {cr.impactHours > 0 && <p className="text-xs text-slate-600">Hours: <span className="font-semibold">{cr.impactHours}h</span></p>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* My Tasks */}
          <TabsContent value="tasks" className="mt-4">
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
                  <Users className="h-4 w-4 text-amber-500" /> Actions Required from Your Team
                </CardTitle>
              </CardHeader>
              <CardContent>
                {actionNeeded.length === 0 ? (
                  <div className="text-center py-10">
                    <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
                    <p className="font-semibold text-slate-700">All clear!</p>
                    <p className="text-sm text-slate-500 mt-1">No pending actions from your team at this time</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {actionNeeded.map((a: any) => (
                      <div key={a.id} className="flex items-start justify-between p-3 bg-amber-50 rounded-lg border border-amber-100 gap-3">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <Square className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 leading-tight">{a.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {a.dueDate ? `Due: ${new Date(a.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "No due date set"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <StatusPill s={a.priority || "medium"} />
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            disabled={completing.has(a.id)}
                            onClick={() => completeTask(a.id)}
                          >
                            {completing.has(a.id) ? "..." : <><CheckSquare className="h-3 w-3 mr-1" />Done</>}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Milestones */}
          <TabsContent value="milestones" className="mt-4">
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-500" /> Project Milestones
                  {overdueMilestones.length > 0 && (
                    <span className="ml-auto text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full font-medium">
                      {overdueMilestones.length} overdue
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100 text-xs text-slate-500">
                    <th className="text-left px-4 py-3">Milestone</th>
                    <th className="text-left px-4 py-3">Project</th>
                    <th className="text-left px-4 py-3">Due Date</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-center px-4 py-3">Billing</th>
                    <th className="text-center px-4 py-3">Approval</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {milestones.map((m: any) => {
                      const project = projects.find((p: any) => p.id === m.projectId);
                      const isOverdue = m.status !== "completed" && m.dueDate && m.dueDate < new Date().toISOString().split("T")[0];
                      const isApproved = m.approvalStatus === "approved";
                      const isFormOpen = approvalFormId === m.id;
                      const isSigning = signing.has(m.id);
                      return (
                        <tr key={m.id} className={`${isOverdue ? "bg-red-50" : isApproved ? "bg-emerald-50/40" : "hover:bg-slate-50"}`}>
                          <td className="px-4 py-3 font-medium text-slate-800">{m.name}</td>
                          <td className="px-4 py-3 text-slate-500">{project?.name || `Project ${m.projectId}`}</td>
                          <td className={`px-4 py-3 ${isOverdue ? "text-red-600 font-medium" : "text-slate-500"}`}>
                            {m.dueDate ? new Date(m.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "TBD"}
                            {isOverdue && " ⚠"}
                          </td>
                          <td className="px-4 py-3 text-center"><StatusPill s={m.status || "not_started"} /></td>
                          <td className="px-4 py-3 text-center">
                            {m.isBillable ? <span className="text-xs text-emerald-600 font-medium">Billable</span> : <span className="text-xs text-slate-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-center min-w-[180px]">
                            {isApproved ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                                  <ThumbsUp className="h-3 w-3" /> Client Approved
                                </span>
                                {m.signedBy && <span className="text-[10px] text-slate-400">by {m.signedBy}</span>}
                              </div>
                            ) : isFormOpen ? (
                              <div className="flex items-center gap-1.5 justify-center">
                                <input
                                  autoFocus
                                  type="text"
                                  placeholder="Your name"
                                  value={signerName}
                                  onChange={e => setSignerName(e.target.value)}
                                  onKeyDown={e => { if (e.key === "Enter") signMilestone(m.id); if (e.key === "Escape") { setApprovalFormId(null); setSignerName(""); } }}
                                  className="border border-slate-300 rounded px-2 py-1 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                  disabled={isSigning}
                                />
                                <button
                                  onClick={() => signMilestone(m.id)}
                                  disabled={isSigning || !signerName.trim()}
                                  className="text-xs bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                >
                                  {isSigning ? "…" : "Confirm"}
                                </button>
                                <button
                                  onClick={() => { setApprovalFormId(null); setSignerName(""); }}
                                  className="text-slate-400 hover:text-slate-600"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setApprovalFormId(m.id); setSignerName(""); }}
                                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-full transition-colors"
                              >
                                <ThumbsUp className="h-3 w-3" /> Approve
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {milestones.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">No milestones on record</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invoices */}
          <TabsContent value="invoices" className="mt-4">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Total Billed", value: invoices.reduce((s: number, i: any) => s + i.amount, 0), color: "text-slate-900" },
                  { label: "Paid", value: invoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + i.amount, 0), color: "text-emerald-600" },
                  { label: "Outstanding", value: invoices.filter((i: any) => ["sent", "overdue"].includes(i.status)).reduce((s: number, i: any) => s + i.amount, 0), color: "text-amber-600" },
                ].map(({ label, value, color }) => (
                  <Card key={label} className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="pt-4">
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className={`text-xl font-bold ${color} mt-1`}>{fmt(value)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardContent className="p-0">
                  {invoices.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>No invoices on record</p>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-slate-100 text-xs text-slate-500">
                        <th className="text-left px-4 py-3">Invoice #</th>
                        <th className="text-right px-4 py-3">Amount</th>
                        <th className="text-left px-4 py-3">Due Date</th>
                        <th className="text-center px-4 py-3">Status</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {invoices.map((i: any) => (
                          <tr key={i.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-mono text-xs text-slate-700">{i.invoiceNumber}</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmt(i.amount)}</td>
                            <td className="px-4 py-3 text-slate-500">{i.dueDate ? new Date(i.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</td>
                            <td className="px-4 py-3 text-center"><StatusPill s={i.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Updates */}
          <TabsContent value="updates" className="mt-4">
            {allReports.length === 0 ? (
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardContent className="py-12 text-center">
                  <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No status updates yet</p>
                  <p className="text-xs text-slate-400 mt-1">Updates will appear here as your project manager posts them</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {allReports.map((report: any, i: number) => {
                  const project = projects.find((p: any) => {
                    const reps = statusReports[p.id] || [];
                    return reps.some((r: any) => r.id === report.id);
                  });
                  const colorMap: Record<string, string> = {
                    green: "border-l-emerald-500 bg-emerald-50/40",
                    amber: "border-l-amber-500 bg-amber-50/40",
                    red: "border-l-red-500 bg-red-50/40",
                  };
                  const statusMap: Record<string, string> = {
                    on_track: "text-emerald-700 bg-emerald-100",
                    at_risk: "text-amber-700 bg-amber-100",
                    behind: "text-red-700 bg-red-100",
                  };
                  return (
                    <Card key={`${report.id}-${i}`} className={`bg-white border-slate-200 shadow-sm border-l-4 ${colorMap[report.color] || "border-l-slate-300"}`}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">{project?.name || "Project Update"}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusMap[report.status] || "bg-slate-100 text-slate-700"}`}>
                                {(report.status || "on_track").replace(/_/g, " ")}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {report.author} · {new Date(report.date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                              {report.isAutoGenerated && <span className="ml-1.5 text-muted-foreground">· Auto-generated</span>}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-slate-700 mb-3">{report.summary}</p>
                        {report.highlights?.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Highlights</p>
                            {report.highlights.map((h: string, j: number) => (
                              <div key={j} className="flex items-start gap-2 text-xs text-slate-600 py-0.5">
                                <CheckCircle className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                                {h}
                              </div>
                            ))}
                          </div>
                        )}
                        {report.risks?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Risks & Issues</p>
                            {report.risks.map((r: string, j: number) => (
                              <div key={j} className="flex items-start gap-2 text-xs text-red-600 py-0.5">
                                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                                {r}
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="text-center py-4 text-xs text-slate-400">
          <p>Powered by BUSINESSNow · Professional Services Automation</p>
          <p className="mt-1">For questions, contact your dedicated project manager</p>
        </div>
      </div>
    </div>
  );
}
