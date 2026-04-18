import React, { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { format, differenceInDays, subDays } from "date-fns";
import {
  AlertTriangle, AlertCircle, CheckCircle2, Clock, Users, DollarSign,
  Calendar, ChevronRight, Flag, User, ExternalLink, RefreshCw,
  Circle, TrendingUp, Receipt, FileText, Zap, ArrowUpRight,
  Shield, Package, Activity,
} from "lucide-react";
import { useAuthRole } from "@/lib/auth";
import { AiSummaryCard } from "@/components/workspace/AiSummaryCard";

const API = import.meta.env.BASE_URL + "api";

function fmt$(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-white/20 rounded-full h-1.5">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-sm font-bold tabular-nums" style={{ color }}>{score}</span>
    </div>
  );
}

function SectionHeader({ icon: Icon, label, color = "text-foreground" }: { icon: any; label: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={14} className={color} />
      <span className={`text-xs font-bold uppercase tracking-widest ${color}`}>{label}</span>
    </div>
  );
}

function KpiChip({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white/10 backdrop-blur rounded-lg px-3 py-2 min-w-[80px]">
      <div className={`text-lg font-bold leading-none ${accent || "text-white"}`}>{value}</div>
      <div className="text-[10px] text-white/60 mt-0.5">{label}</div>
      {sub && <div className={`text-[10px] mt-0.5 ${accent || "text-white/50"}`}>{sub}</div>}
    </div>
  );
}

function RiskRow({ icon: Icon, title, detail, severity }: { icon: any; title: string; detail?: string; severity: "high" | "medium" | "low" | "info" }) {
  const cls = {
    high:   { bg: "bg-red-50 border-red-200",   ic: "text-red-500",    label: "High" },
    medium: { bg: "bg-amber-50 border-amber-200", ic: "text-amber-500", label: "Medium" },
    low:    { bg: "bg-blue-50 border-blue-200",   ic: "text-blue-500",  label: "Low" },
    info:   { bg: "bg-slate-50 border-slate-200", ic: "text-slate-500", label: "Info" },
  }[severity];
  return (
    <div className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${cls.bg}`}>
      <Icon size={13} className={`${cls.ic} mt-0.5 shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-tight">{title}</p>
        {detail && <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{detail}</p>}
      </div>
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cls.ic} bg-white border ${cls.bg.replace("bg-","border-").replace("50","200")}`}>
        {cls.label}
      </span>
    </div>
  );
}

export default function ProjectCommand() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { role } = useAuthRole();
  const projectId = Number(params.id);

  const [data, setData] = useState<any>(null);
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [statusReports, setStatusReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [marginForecast, setMarginForecast] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [proj, ts, inv, sr, mf, rev, sum] = await Promise.all([
        fetch(`${API}/projects/${projectId}/full`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
        fetch(`${API}/timesheets?projectId=${projectId}`).then(r => r.json()).catch(() => []),
        fetch(`${API}/invoices?projectId=${projectId}`).then(r => r.json()).catch(() => []),
        fetch(`${API}/projects/${projectId}/status-reports`).then(r => r.json()).catch(() => []),
        fetch(`${API}/projects/${projectId}/margin-forecast`).then(r => r.json()).catch(() => null),
        fetch(`${API}/projects/${projectId}/revenue`).then(r => r.json()).catch(() => null),
        fetch(`${API}/projects/${projectId}/summary`).then(r => r.json()).catch(() => null),
      ]);
      setData(proj);
      setTimesheets(Array.isArray(ts) ? ts : []);
      setInvoices(Array.isArray(inv) ? inv : []);
      setStatusReports(Array.isArray(sr) ? sr : []);
      setMarginForecast(mf);
      setRevenue(rev);
      setSummary(sum);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="text-white/50 text-sm animate-pulse">Loading command center…</div>
    </div>
  );
  if (!data) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="text-white/50 text-sm">Project not found.</div>
    </div>
  );

  const { project, phases, milestones, tasks, allocations, health, nextMilestone, budgetBurn, changeRequests } = data;

  // ── Derived metrics ──────────────────────────────────────────────────────
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const oneWeekAgo = subDays(today, 7).toISOString().split("T")[0];

  const overdueMilestones = milestones.filter((m: any) => m.dueDate && m.dueDate < todayStr && m.status !== "completed");
  const blockedTasks = tasks.filter((t: any) => t.status === "blocked");
  const doneTasks = tasks.filter((t: any) => t.status === "done").length;
  const openCRs = (changeRequests || []).filter((cr: any) => ["pending_review", "open", "client_review"].includes(cr.status));

  const thisWeekTs = timesheets.filter((t: any) => t.weekStartDate >= oneWeekAgo);
  const billableHrsWeek = thisWeekTs.reduce((s: number, t: any) => s + parseFloat(t.billableHours || 0), 0);
  const regularHrsWeek = thisWeekTs.reduce((s: number, t: any) => s + parseFloat(t.regularHours || 0), 0);
  const otHrsWeek = thisWeekTs.reduce((s: number, t: any) => s + parseFloat(t.overtimeHours || 0), 0);
  const totalHrsWeek = billableHrsWeek + regularHrsWeek + otHrsWeek;
  const pendingTs = timesheets.filter((t: any) => t.status === "submitted").length;

  const budgetValue = parseFloat(project.budgetValue || 0);
  const billedValue = parseFloat(project.billedValue || 0);
  const budgetHours = parseFloat(project.budgetHours || 0);
  const consumedHours = parseFloat(project.consumedHours || 0);
  const burnPct = budgetHours > 0 ? Math.round((consumedHours / budgetHours) * 100) : 0;
  const blendedRate = 150;
  const laborCost = consumedHours * blendedRate;
  const marginEst = budgetValue > 0 ? Math.round(((budgetValue - laborCost) / budgetValue) * 100) : 0;

  const invoicePaid = invoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + parseFloat(i.amount || 0), 0);
  const invoiceOutstanding = invoices.filter((i: any) => ["sent", "overdue"].includes(i.status)).reduce((s: number, i: any) => s + parseFloat(i.amount || 0), 0);

  // Billing blockers: completed billable milestones not yet invoiced
  const billingBlockers = milestones.filter((m: any) => m.isBillable && m.status === "completed" && !m.invoiced);

  // Closure blockers
  const closureFields = ["kickoffComplete", "clientPortalActivated", "billingReadiness", "closureReadiness", "handoverReadiness"];
  const closureIncomplete = closureFields.filter(f => !project[f]);
  const closureNames: Record<string, string> = {
    kickoffComplete: "Kickoff", clientPortalActivated: "Client Portal",
    billingReadiness: "Billing Ready", closureReadiness: "Closure Sign-off",
    handoverReadiness: "Handover Package",
  };

  // Missing status update (no update in past 7 days)
  const lastReport = statusReports[0];
  const daysSinceUpdate = lastReport ? differenceInDays(today, new Date(lastReport.date)) : null;
  const statusUpdateMissing = daysSinceUpdate === null || daysSinceUpdate > 7;

  // Health color
  const hColor = health.color === "green" ? "#10b981" : health.color === "yellow" ? "#f59e0b" : "#ef4444";
  const hBg = health.color === "green" ? "from-emerald-900 to-emerald-800" : health.color === "yellow" ? "from-amber-900 to-amber-800" : "from-red-900 to-red-800";
  const headerBg = `bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900`;

  const typeLabel: Record<string, string> = {
    implementation: "OTM Implementation", cloud_migration: "Cloud Migration", ams: "AMS Managed Services",
    qa_certification: "QA / Certification", rate_maintenance: "Rate Maintenance", data_migration: "Data Migration",
    custom_dev: "Custom Development", pre_sales: "Pre-Sales Scoping",
  };

  // Build risks list
  const risks: { icon: any; title: string; detail?: string; severity: "high" | "medium" | "low" | "info" }[] = [];

  if (statusUpdateMissing) {
    risks.push({ icon: Activity, severity: "medium", title: "No status update in 7+ days", detail: lastReport ? `Last update ${daysSinceUpdate} days ago` : "No status reports posted yet" });
  }
  overdueMilestones.slice(0, 3).forEach((m: any) => {
    risks.push({ icon: AlertCircle, severity: "high", title: `Overdue milestone: ${m.name}`, detail: m.dueDate ? `Was due ${format(new Date(m.dueDate), "MMM d")}` : undefined });
  });
  blockedTasks.slice(0, 3).forEach((t: any) => {
    risks.push({ icon: AlertTriangle, severity: "high", title: `Blocked task: ${t.name}`, detail: t.blockerNote || undefined });
  });
  if (burnPct > 90) {
    risks.push({ icon: TrendingUp, severity: "high", title: `Budget burn at ${burnPct}%`, detail: `${(budgetHours - consumedHours).toFixed(0)} hours remaining` });
  } else if (burnPct > 75) {
    risks.push({ icon: TrendingUp, severity: "medium", title: `Budget burn at ${burnPct}%`, detail: `Monitor closely — ${(budgetHours - consumedHours).toFixed(0)} hrs left` });
  }
  billingBlockers.slice(0, 3).forEach((m: any) => {
    risks.push({ icon: Receipt, severity: "medium", title: `Uninvoiced milestone: ${m.name}`, detail: m.billableAmount ? `${fmt$(parseFloat(m.billableAmount))} ready to invoice` : "Ready to invoice" });
  });
  if (invoiceOutstanding > 0) {
    risks.push({ icon: DollarSign, severity: "medium", title: `${fmt$(invoiceOutstanding)} outstanding AR`, detail: "Invoices sent but not paid" });
  }
  closureIncomplete.slice(0, 3).forEach(f => {
    risks.push({ icon: Shield, severity: "low", title: `Closure blocker: ${closureNames[f]}`, detail: "Not yet completed" });
  });
  openCRs.slice(0, 2).forEach((cr: any) => {
    risks.push({ icon: FileText, severity: "info", title: `Open change order: ${cr.title}`, detail: `Status: ${cr.status.replace(/_/g, " ")}` });
  });
  health.reasons?.forEach((r: any) => {
    if (!risks.find(rk => rk.title.includes(r.label))) {
      risks.push({ icon: AlertTriangle, severity: r.severity === "high" ? "high" : r.severity === "medium" ? "medium" : "low", title: r.label, detail: `-${r.impact} health points` });
    }
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ─── Hero Header ─────────────────────────────────────────────────── */}
      <div className={`${headerBg} text-white px-6 py-4 flex-shrink-0`}>
        <div className="flex items-start justify-between gap-4 max-w-screen-2xl mx-auto">
          {/* Left: breadcrumb + title */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-white/40 mb-1">
              <button onClick={() => navigate("/projects")} className="hover:text-white/70 transition-colors">Projects</button>
              <ChevronRight size={10} />
              <span>{project.accountName}</span>
              <ChevronRight size={10} />
              <span className="text-white/70">Command Center</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight">{project.name}</h1>
              <span className="text-xs border border-white/20 rounded px-2 py-0.5 text-white/70">{typeLabel[project.type] || project.type}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                project.status === "active" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                project.status === "at_risk" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" :
                "bg-slate-500/20 text-slate-300 border border-slate-500/30"
              }`}>{project.status.replace(/_/g, " ")}</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-white/50">
              {project.pmName && <span className="flex items-center gap-1"><User size={10}/>{project.pmName}</span>}
              {project.currentPhase && <span className="flex items-center gap-1"><Flag size={10}/>Phase: {project.currentPhase}</span>}
              {project.goLiveDate && <span className="flex items-center gap-1"><Calendar size={10}/>Go-live: {format(new Date(project.goLiveDate), "MMM d, yyyy")}</span>}
            </div>
          </div>

          {/* Right: KPI chips */}
          <div className="flex items-start gap-2 flex-shrink-0 flex-wrap justify-end">
            <KpiChip label="Health" value={String(health.score)}
              accent={health.score >= 80 ? "text-emerald-400" : health.score >= 60 ? "text-amber-400" : "text-red-400"} />
            <KpiChip label="Complete" value={`${project.completionPct || 0}%`} />
            <div className="flex items-center gap-1.5">
              <KpiChip label="Burn" value={`${burnPct}%`}
                accent={burnPct > 90 ? "text-red-400" : burnPct > 75 ? "text-amber-400" : "text-white"} />
              {burnPct >= 90 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">Critical</span>
              )}
              {burnPct >= 75 && burnPct < 90 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">Warning</span>
              )}
            </div>
            <KpiChip label="Margin Est." value={`${marginEst}%`}
              accent={marginEst < 20 ? "text-red-400" : marginEst < 30 ? "text-amber-400" : "text-emerald-400"} />
            {project.goLiveDate && (() => {
              const days = differenceInDays(new Date(project.goLiveDate), today);
              return <KpiChip label="Days to Go-Live" value={days < 0 ? "Past" : String(days)} accent={days < 30 && days >= 0 ? "text-amber-400" : "text-white"} />;
            })()}

            {/* Nav links */}
            <div className="flex flex-col gap-1.5 ml-2">
              <button onClick={() => navigate(`/projects/${projectId}`)}
                className="flex items-center gap-1 text-xs text-white/60 hover:text-white border border-white/20 rounded px-2.5 py-1.5 hover:bg-white/10 transition-all">
                <ExternalLink size={10}/> Full Detail
              </button>
              <button onClick={load}
                className="flex items-center gap-1 text-xs text-white/60 hover:text-white border border-white/20 rounded px-2.5 py-1.5 hover:bg-white/10 transition-all">
                <RefreshCw size={10}/> Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Health bar under the header */}
        <div
          className="max-w-screen-2xl mx-auto mt-3"
        >
          <HealthBar score={health.score} />
        </div>
      </div>

      {/* ─── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 max-w-screen-2xl mx-auto w-full space-y-5">

        {/* Row 1: Delivery | People | Work */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── 1. DELIVERY ── */}
          <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
            <SectionHeader icon={Package} label="Delivery" color="text-blue-600" />

            {/* Phase progress */}
            {phases.length > 0 && (
              <div className="space-y-2">
                {phases.map((ph: any) => {
                  const phaseMilestones = milestones.filter((m: any) => Number(m.phaseId) === ph.id || m.phase?.toLowerCase() === ph.name?.toLowerCase());
                  const done = phaseMilestones.filter((m: any) => m.status === "completed").length;
                  const pct = phaseMilestones.length > 0 ? Math.round((done / phaseMilestones.length) * 100) : 0;
                  const isActive = ph.status === "in_progress";
                  return (
                    <div key={ph.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${ph.status === "completed" ? "bg-emerald-500" : isActive ? "bg-blue-500" : "bg-slate-300"}`} />
                          <span className={`text-xs font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{ph.name}</span>
                          {isActive && <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-200 font-medium">Active</span>}
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums">{done}/{phaseMilestones.length} · {pct}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : isActive ? "bg-blue-500" : "bg-slate-300"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Task summary */}
            <div className="grid grid-cols-4 gap-2 pt-1 border-t">
              {[
                { label: "Total", val: tasks.length, color: "" },
                { label: "Done", val: doneTasks, color: "text-emerald-600" },
                { label: "Blocked", val: blockedTasks.length, color: blockedTasks.length > 0 ? "text-red-600" : "" },
                { label: "Overdue MS", val: overdueMilestones.length, color: overdueMilestones.length > 0 ? "text-amber-600" : "" },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Next milestone */}
            {nextMilestone && (
              <div className="bg-slate-50 rounded-xl border p-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Next Milestone</p>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold leading-tight">{nextMilestone.name}</p>
                    {nextMilestone.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{nextMilestone.description}</p>}
                  </div>
                  {nextMilestone.dueDate && (
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-blue-600">{format(new Date(nextMilestone.dueDate), "MMM d")}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(nextMilestone.dueDate).getFullYear()}</p>
                    </div>
                  )}
                </div>
                {nextMilestone.isBillable && nextMilestone.billableAmount && (
                  <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
                    <DollarSign size={10}/> Billable: {fmt$(parseFloat(nextMilestone.billableAmount))}
                  </p>
                )}
              </div>
            )}

            {/* Blocked tasks (first 3) */}
            {blockedTasks.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wider mb-1.5">Blocked Tasks</p>
                <div className="space-y-1.5">
                  {blockedTasks.slice(0, 3).map((t: any) => (
                    <div key={t.id} className="flex items-start gap-2 text-xs">
                      <AlertTriangle size={10} className="text-red-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">{t.name}</p>
                        {t.blockerNote && <p className="text-red-500 text-[10px]">{t.blockerNote}</p>}
                      </div>
                    </div>
                  ))}
                  {blockedTasks.length > 3 && <p className="text-[10px] text-muted-foreground">+{blockedTasks.length - 3} more</p>}
                </div>
              </div>
            )}
          </div>

          {/* ── 2. PEOPLE ── */}
          <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
            <SectionHeader icon={Users} label="People" color="text-violet-600" />

            {/* Allocation summary */}
            <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border">
              <div className="text-center">
                <p className="text-2xl font-bold">{allocations.length}</p>
                <p className="text-[10px] text-muted-foreground">Members</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {allocations.reduce((s: number, a: any) => s + parseFloat(String(a.hoursPerWeek || 0)), 0).toFixed(0)}
                </p>
                <p className="text-[10px] text-muted-foreground">Hrs / week</p>
              </div>
              {(() => {
                const overAllocated = allocations.filter((a: any) => (a.allocationPct || 0) > 100);
                return (
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${overAllocated.length > 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {overAllocated.length > 0 ? overAllocated.length : "✓"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{overAllocated.length > 0 ? "Over-alloc" : "No conflicts"}</p>
                  </div>
                );
              })()}
            </div>

            {/* Team list */}
            {allocations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No team allocated</p>
            ) : (
              <div className="space-y-2">
                {allocations.map((a: any) => {
                  const isOver = (a.allocationPct || 0) > 100;
                  const hrs = parseFloat(String(a.hoursPerWeek || 0));
                  return (
                    <div key={a.id} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-violet-700">
                          {(a.resourceName || "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{a.resourceName || "Resource"}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{a.role || "—"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-xs font-bold tabular-nums ${isOver ? "text-red-600" : "text-foreground"}`}>{a.allocationPct || 0}%</p>
                        <p className="text-[10px] text-muted-foreground">{hrs.toFixed(0)}h/wk</p>
                      </div>
                      <div className="w-14">
                        <div className="w-full bg-slate-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${isOver ? "bg-red-500" : "bg-violet-500"}`} style={{ width: `${Math.min(a.allocationPct || 0, 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Client actions */}
            {(() => {
              const clientActions = tasks.filter((t: any) => t.isClientAction && t.status !== "done");
              if (clientActions.length === 0) return null;
              return (
                <div className="border-t pt-3">
                  <p className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider mb-2">Pending Client Actions ({clientActions.length})</p>
                  {clientActions.slice(0, 3).map((t: any) => (
                    <div key={t.id} className="flex items-start gap-2 text-xs mb-1.5">
                      <Users size={10} className="text-orange-500 mt-0.5 shrink-0" />
                      <span className="font-medium">{t.name}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* ── 3. WORK ── */}
          <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
            <SectionHeader icon={Clock} label="Work" color="text-cyan-600" />

            {/* Hours this week */}
            <div className="text-center py-3 bg-slate-50 rounded-xl border">
              <p className="text-4xl font-bold text-cyan-600 tabular-nums">{totalHrsWeek.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground mt-1">Total hours logged this week</p>
            </div>

            {/* Breakdown */}
            <div className="space-y-2">
              {[
                { label: "Billable", val: billableHrsWeek, total: totalHrsWeek, color: "bg-emerald-500", textColor: "text-emerald-600" },
                { label: "Regular", val: regularHrsWeek, total: totalHrsWeek, color: "bg-blue-500", textColor: "text-blue-600" },
                { label: "Overtime", val: otHrsWeek, total: totalHrsWeek, color: "bg-amber-500", textColor: "text-amber-600" },
              ].map(row => (
                <div key={row.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{row.label}</span>
                    <span className={`text-xs font-bold tabular-nums ${row.textColor}`}>{row.val.toFixed(1)}h</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${row.color}`} style={{ width: `${row.total > 0 ? (row.val / row.total) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Timesheet stats */}
            <div className="grid grid-cols-2 gap-2 border-t pt-3">
              <div className="text-center bg-slate-50 rounded-lg p-2.5 border">
                <p className="text-xl font-bold">{timesheets.length}</p>
                <p className="text-[10px] text-muted-foreground">Total timesheets</p>
              </div>
              <div className={`text-center rounded-lg p-2.5 border ${pendingTs > 0 ? "bg-amber-50 border-amber-200" : "bg-slate-50"}`}>
                <p className={`text-xl font-bold ${pendingTs > 0 ? "text-amber-600" : ""}`}>{pendingTs}</p>
                <p className="text-[10px] text-muted-foreground">Awaiting approval</p>
              </div>
            </div>

            {/* Cumulative */}
            <div className="border-t pt-3 grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-muted-foreground">Total consumed</p>
                <p className="text-lg font-bold">{consumedHours.toFixed(0)}<span className="text-xs text-muted-foreground ml-1">hrs</span></p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Budget hours</p>
                <p className="text-lg font-bold">{budgetHours.toFixed(0)}<span className="text-xs text-muted-foreground ml-1">hrs</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Money | Risks & Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* ── 4. MONEY ── */}
          <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm p-5 space-y-4">
            <SectionHeader icon={DollarSign} label="Money" color="text-emerald-600" />

            {/* Budget vs Billed gauge */}
            <div className="space-y-3">
              {[
                { label: "Budget Value", val: budgetValue, max: budgetValue, color: "bg-slate-200", bar: "bg-slate-400", show: false },
                { label: "Billed to Client", val: billedValue, max: budgetValue, color: "bg-emerald-100", bar: "bg-emerald-500", show: true },
                { label: "Labor Cost Est.", val: laborCost, max: budgetValue, color: "bg-blue-50", bar: "bg-blue-500", show: true },
              ].filter(r => r.show).map(row => (
                <div key={row.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">{row.label}</span>
                    <span className="text-sm font-bold tabular-nums">{fmt$(row.val)}</span>
                  </div>
                  <div className={`w-full ${row.color} rounded-full h-2`}>
                    <div className={`h-2 rounded-full ${row.bar}`} style={{ width: `${budgetValue > 0 ? Math.min((row.val / budgetValue) * 100, 100) : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Earned vs Billed */}
            {revenue && (
              <div className="border-t pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Earned vs Billed</p>
                  {Math.abs(revenue.gap) > revenue.budgetValue * 0.1 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${revenue.gap > 0 ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                      {revenue.gap > 0 ? "⚠ Billing lag" : "↑ Ahead"}
                    </span>
                  )}
                </div>
                {[
                  { label: "Earned", val: revenue.earned, bar: "bg-violet-500", track: "bg-violet-100" },
                  { label: "Billed",  val: revenue.billed, bar: "bg-emerald-500", track: "bg-emerald-100" },
                ].map(row => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-muted-foreground">{row.label}</span>
                      <span className="text-xs font-bold tabular-nums">{fmt$(row.val)}</span>
                    </div>
                    <div className={`w-full ${row.track} rounded-full h-2`}>
                      <div className={`h-2 rounded-full ${row.bar}`} style={{ width: `${revenue.budgetValue > 0 ? Math.min((row.val / revenue.budgetValue) * 100, 100) : 0}%` }} />
                    </div>
                  </div>
                ))}
                <div className={`flex items-center justify-between rounded px-2 py-1 text-[10px] font-semibold ${revenue.gap > 0 ? "bg-amber-50 text-amber-700" : revenue.gap < 0 ? "bg-blue-50 text-blue-700" : "bg-slate-50 text-muted-foreground"}`}>
                  <span>Gap</span>
                  <span>{revenue.gap >= 0 ? "+" : ""}{fmt$(revenue.gap)}</span>
                </div>
              </div>
            )}

            {/* KPI grid */}
            <div className="grid grid-cols-2 gap-2 border-t pt-3">
              <div className="bg-slate-50 rounded-lg p-3 border text-center">
                <p className="text-[10px] text-muted-foreground">Budget</p>
                <p className="text-lg font-bold">{fmt$(budgetValue)}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border text-center">
                <p className="text-[10px] text-muted-foreground">Billed</p>
                <p className="text-lg font-bold text-emerald-600">{fmt$(billedValue)}</p>
              </div>
              <div className={`rounded-lg p-3 border text-center ${burnPct > 90 ? "bg-red-50 border-red-200" : burnPct > 75 ? "bg-amber-50 border-amber-200" : "bg-slate-50"}`}>
                <p className="text-[10px] text-muted-foreground">Burn Rate</p>
                <p className={`text-lg font-bold ${burnPct > 90 ? "text-red-600" : burnPct > 75 ? "text-amber-600" : ""}`}>{burnPct}%</p>
              </div>
              {marginForecast ? (
                <div className={`rounded-lg p-3 border text-center ${
                  marginForecast.marginStatus === "good" ? "bg-emerald-50 border-emerald-200"
                  : marginForecast.marginStatus === "warning" ? "bg-amber-50 border-amber-200"
                  : "bg-red-50 border-red-200"
                }`}>
                  <p className="text-[10px] text-muted-foreground">Margin Forecast</p>
                  <p className={`text-lg font-bold ${
                    marginForecast.marginStatus === "good" ? "text-emerald-600"
                    : marginForecast.marginStatus === "warning" ? "text-amber-600"
                    : "text-red-600"
                  }`}>{marginForecast.forecastMarginPct !== null ? `${marginForecast.forecastMarginPct}%` : "—"}</p>
                  <p className="text-[10px] font-semibold mt-0.5 text-muted-foreground">
                    {marginForecast.marginStatus === "good" ? "✓ Good" : marginForecast.marginStatus === "warning" ? "⚠ Warning" : "⚑ Critical"}
                  </p>
                </div>
              ) : (
                <div className={`rounded-lg p-3 border text-center ${marginEst < 20 ? "bg-red-50 border-red-200" : marginEst < 30 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
                  <p className="text-[10px] text-muted-foreground">Margin Est.</p>
                  <p className={`text-lg font-bold ${marginEst < 20 ? "text-red-600" : marginEst < 30 ? "text-amber-600" : "text-emerald-600"}`}>{marginEst}%</p>
                </div>
              )}
            </div>

            {/* Invoice summary */}
            <div className="border-t pt-3 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Invoices ({invoices.length})</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center">
                  <p className="text-base font-bold text-emerald-600">{fmt$(invoicePaid)}</p>
                  <p className="text-[10px] text-muted-foreground">Collected</p>
                </div>
                <div className="text-center">
                  <p className={`text-base font-bold ${invoiceOutstanding > 0 ? "text-amber-600" : "text-muted-foreground"}`}>{fmt$(invoiceOutstanding)}</p>
                  <p className="text-[10px] text-muted-foreground">Outstanding</p>
                </div>
              </div>
            </div>

            {/* Change orders */}
            {openCRs.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1.5">{openCRs.length} Open Change Order{openCRs.length !== 1 ? "s" : ""}</p>
                {openCRs.slice(0, 2).map((cr: any) => (
                  <div key={cr.id} className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium truncate flex-1 mr-2">{cr.title}</span>
                    {cr.impactCost && <span className="text-muted-foreground shrink-0">{fmt$(parseFloat(cr.impactCost))}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 5. RISKS & ACTIONS ── */}
          <div className="lg:col-span-3 bg-white rounded-2xl border shadow-sm p-5">
            <SectionHeader icon={Zap} label="Risks & Actions" color="text-red-600" />

            {risks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 size={32} className="text-emerald-500 mb-3" />
                <p className="font-semibold text-emerald-700">All clear</p>
                <p className="text-sm text-muted-foreground mt-1">No risks or action items detected</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {risks.map((r, i) => (
                  <RiskRow key={i} icon={r.icon} title={r.title} detail={r.detail} severity={r.severity} />
                ))}
              </div>
            )}

            {/* Quick action footer */}
            {risks.length > 0 && (
              <div className="border-t pt-3 mt-3 flex flex-wrap gap-2">
                <button onClick={() => navigate(`/projects/${projectId}?tab=updates`)}
                  className="flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors">
                  <Activity size={11}/> Post Status Update
                </button>
                <button onClick={() => navigate(`/projects/${projectId}?tab=finance`)}
                  className="flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors">
                  <Receipt size={11}/> View Invoices
                </button>
                <button onClick={() => navigate(`/projects/${projectId}?tab=worklogs`)}
                  className="flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors">
                  <Clock size={11}/> Review Timesheets
                </button>
                <button onClick={() => navigate(`/projects/${projectId}?tab=close`)}
                  className="flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors">
                  <Shield size={11}/> Closure Checklist
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── PROJECT SUMMARY ── */}
        {summary && (
          <div className={`rounded-2xl border shadow-sm p-5 ${
            summary.status === "on_track" ? "bg-emerald-50 border-emerald-200"
            : summary.status === "at_risk"  ? "bg-amber-50 border-amber-200"
            : "bg-red-50 border-red-200"
          }`}>
            {/* Header row */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <FileText size={14} className={
                  summary.status === "on_track" ? "text-emerald-600"
                  : summary.status === "at_risk" ? "text-amber-600"
                  : "text-red-600"
                } />
                <span className={`text-xs font-bold uppercase tracking-widest ${
                  summary.status === "on_track" ? "text-emerald-700"
                  : summary.status === "at_risk" ? "text-amber-700"
                  : "text-red-700"
                }`}>Project Summary</span>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                summary.status === "on_track" ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                : summary.status === "at_risk"  ? "bg-amber-100 text-amber-700 border-amber-300"
                : "bg-red-100 text-red-700 border-red-300"
              }`}>
                {summary.status === "on_track" ? "✓ On Track" : summary.status === "at_risk" ? "⚠ At Risk" : "⚑ Critical"}
              </span>
            </div>

            {/* Headline */}
            <p className={`text-sm font-semibold leading-relaxed mb-4 ${
              summary.status === "on_track" ? "text-emerald-900"
              : summary.status === "at_risk" ? "text-amber-900"
              : "text-red-900"
            }`}>{summary.headline}</p>

            {/* Meta chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { label: "Health", value: `${summary.meta.healthScore}`, icon: "♥" },
                { label: "Complete", value: `${summary.meta.completionPct}%`, icon: "✓" },
                { label: "Burn", value: `${summary.meta.burnPct}%`, icon: "🔥" },
                summary.meta.overdueCount > 0 && { label: "Overdue", value: String(summary.meta.overdueCount), icon: "⏰" },
                summary.meta.blockedCount > 0 && { label: "Blocked", value: String(summary.meta.blockedCount), icon: "🚫" },
                summary.meta.openCRCount > 0 && { label: "Open CRs", value: String(summary.meta.openCRCount), icon: "📋" },
                summary.meta.marginPct !== null && { label: "Margin", value: `${summary.meta.marginPct}%`, icon: "%" },
              ].filter(Boolean).map((chip: any) => (
                <div key={chip.label} className="flex items-center gap-1 bg-white/70 border border-white/80 rounded-full px-2.5 py-1 text-[10px] font-medium text-slate-700">
                  <span>{chip.icon}</span>
                  <span className="text-muted-foreground">{chip.label}</span>
                  <span className="font-bold">{chip.value}</span>
                </div>
              ))}
            </div>

            {/* Two-column: Concerns + Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Key Concerns</p>
                <ul className="space-y-1.5">
                  {summary.keyConcerns.map((concern: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
                      <AlertTriangle size={11} className={`mt-0.5 flex-shrink-0 ${
                        summary.status === "on_track" ? "text-emerald-500"
                        : summary.status === "at_risk" ? "text-amber-500"
                        : "text-red-500"
                      }`} />
                      {concern}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Recommended Actions</p>
                <ul className="space-y-1.5">
                  {summary.recommendedActions.map((action: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
                      <ChevronRight size={11} className="mt-0.5 flex-shrink-0 text-blue-500" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ── AI NARRATIVE SUMMARY ── */}
        <AiSummaryCard
          endpoint={`${API}/projects/${projectId}/ai-summary`}
          label="AI Project Narrative"
        />

        {/* Footer: generated timestamp */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground pb-2 border-t pt-3">
          <span>BUSINESSNow · Project Command Center</span>
          <span>Generated {format(today, "MMM d, yyyy 'at' h:mm a")}</span>
        </div>
      </div>

    </div>
  );
}
