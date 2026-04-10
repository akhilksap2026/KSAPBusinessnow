import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Zap, Play, Pause, CheckCircle, XCircle, Clock, RefreshCw, Lock,
  AlertTriangle, Loader2, ListChecks,
} from "lucide-react";
import { useAuthRole, hasPermission } from "@/lib/auth";

const API = "/api";

const TRIGGER_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  // ── Existing automation triggers ────────────────────────────────────────
  opportunity_threshold_reached:        { label: "Opportunity Threshold",       color: "text-blue-400",    icon: "🎯" },
  opportunity_won:                      { label: "Opportunity Won",              color: "text-emerald-400", icon: "🏆" },
  milestone_completed:                  { label: "Milestone Completed",          color: "text-violet-400",  icon: "✅" },
  client_approval_pending:              { label: "Client Approval Pending",      color: "text-amber-400",   icon: "⏳" },
  task_overdue:                         { label: "Task Overdue",                 color: "text-red-400",     icon: "⚠️" },
  timesheet_approved:                   { label: "Timesheet Approved",           color: "text-cyan-400",    icon: "📋" },
  approved_change:                      { label: "Change Approved",              color: "text-pink-400",    icon: "🔄" },
  stale_project_update:                 { label: "Stale Project",                color: "text-orange-400",  icon: "💤" },
  project_ready_for_close:              { label: "Ready for Closure",            color: "text-emerald-400", icon: "🎉" },
  invoice_overdue:                      { label: "Invoice Overdue",              color: "text-red-400",     icon: "🧾" },
  end_of_month:                         { label: "End of Month",                 color: "text-slate-400",   icon: "📅" },
  contract_renewal_approaching:         { label: "Contract Renewal",             color: "text-blue-400",    icon: "🔁" },
  allocation_threshold:                 { label: "Allocation Threshold",         color: "text-orange-400",  icon: "📊" },
  // ── New evaluation-backed triggers ──────────────────────────────────────
  project_health_below_threshold:       { label: "Low Health Score",             color: "text-red-400",     icon: "❤️‍🔥" },
  milestone_overdue:                    { label: "Milestone Overdue",            color: "text-orange-400",  icon: "🚩" },
  invoice_overdue_30:                   { label: "Invoice Aging (30d+)",         color: "text-red-400",     icon: "⏰" },
  timesheet_missing:                    { label: "Timesheet Missing",            color: "text-amber-400",   icon: "📝" },
  opportunity_proposal_staffing_risk:   { label: "Staffing Risk on Proposal",    color: "text-violet-400",  icon: "🧩" },
};

// Triggers that have real evaluation logic
const LIVE_TRIGGERS = new Set([
  "project_health_below_threshold",
  "milestone_overdue",
  "invoice_overdue_30",
  "timesheet_missing",
  "opportunity_proposal_staffing_risk",
]);

function OutcomePill({ outcome, matchedCount }: { outcome: string; matchedCount?: string }) {
  if (outcome === "success") {
    return (
      <span className="flex items-center gap-1 text-emerald-400">
        <CheckCircle className="h-3.5 w-3.5" />
        <span>{matchedCount ? `${matchedCount} matched` : "success"}</span>
      </span>
    );
  }
  if (outcome === "no_match") {
    return (
      <span className="flex items-center gap-1 text-muted-foreground/60">
        <CheckCircle className="h-3.5 w-3.5" />
        <span>no match</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-red-400">
      <XCircle className="h-3.5 w-3.5" />
      <span>error</span>
    </span>
  );
}

function AutomationCard({
  automation,
  onToggle,
  onRun,
  running,
  canToggle,
  canRun,
}: {
  automation: any;
  onToggle: () => void;
  onRun: () => void;
  running: boolean;
  canToggle: boolean;
  canRun: boolean;
}) {
  const cfg = TRIGGER_CONFIG[automation.trigger] ?? {
    label: automation.trigger,
    color: "text-muted-foreground",
    icon: "⚡",
  };
  const isLive = LIVE_TRIGGERS.has(automation.trigger);

  return (
    <Card
      className={`border transition-all ${
        automation.enabled ? "bg-card border-border" : "bg-background border-border opacity-60"
      }`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{cfg.icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground text-sm">{automation.name}</p>
                {isLive && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 font-medium uppercase tracking-wide">
                    Live
                  </span>
                )}
              </div>
              <p className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</p>
            </div>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full border ${
              automation.enabled
                ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                : "border-border text-muted-foreground/70 bg-muted"
            }`}
          >
            {automation.enabled ? "Active" : "Disabled"}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {automation.description && (
          <p className="text-xs text-muted-foreground/70">{automation.description}</p>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground/70">
          <span className="flex items-center gap-1">
            <Play className="h-3 w-3" />{automation.runCount ?? 0} runs
          </span>
          {automation.lastRunAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />Last: {automation.lastRunAt}
            </span>
          )}
        </div>

        {(automation.actions ?? []).length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground/60 font-medium uppercase tracking-wide">Actions</p>
            {automation.actions.map((a: any, i: number) => (
              <div key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="text-muted-foreground/60">→</span>
                <span className="capitalize">{a.type.replace(/_/g, " ")}</span>
                {a.params && Object.keys(a.params).length > 0 && (
                  <span className="text-muted-foreground/60">
                    ({Object.values(a.params).join(", ")})
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-border">
          {canToggle ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={onToggle}
              className={`flex-1 h-7 text-xs ${
                automation.enabled
                  ? "text-amber-400 hover:bg-amber-500/10"
                  : "text-emerald-400 hover:bg-emerald-500/10"
              }`}
            >
              {automation.enabled
                ? <><Pause className="h-3.5 w-3.5 mr-1" />Disable</>
                : <><Play className="h-3.5 w-3.5 mr-1" />Enable</>}
            </Button>
          ) : (
            <span className="flex-1 flex items-center gap-1 text-xs text-muted-foreground/50 px-2">
              <Lock className="h-3 w-3" /> Read only
            </span>
          )}
          {canRun && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onRun}
              disabled={!automation.enabled || running}
              className="flex-1 h-7 text-xs text-blue-400 hover:bg-blue-500/10 disabled:opacity-40"
            >
              {running
                ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Running…</>
                : isLive
                  ? <><Zap className="h-3.5 w-3.5 mr-1" />Run Now</>
                  : <><Play className="h-3.5 w-3.5 mr-1" />Simulate</>}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RunResultBanner({ result, onClose }: { result: any; onClose: () => void }) {
  if (!result) return null;
  const isRunAll = "ran" in result;

  return (
    <div
      className={`mb-4 rounded-lg border px-4 py-3 text-sm flex items-start justify-between gap-3 ${
        (isRunAll ? result.errors === 0 : result.outcome !== "error")
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-red-500/30 bg-red-500/10 text-red-300"
      }`}
    >
      <div className="space-y-1">
        {isRunAll ? (
          <>
            <p className="font-medium">Run All complete — {result.ran} automation{result.ran !== 1 ? "s" : ""} evaluated</p>
            <p className="text-xs opacity-80">
              {result.succeeded} triggered actions · {result.noMatch} no match · {result.errors} error{result.errors !== 1 ? "s" : ""}
            </p>
          </>
        ) : (
          <>
            <p className="font-medium">{result.automationName}</p>
            <p className="text-xs opacity-80">{result.message}</p>
            {result.affectedIds?.length > 0 && (
              <p className="text-xs opacity-60">Affected IDs: {result.affectedIds.join(", ")}</p>
            )}
          </>
        )}
      </div>
      <button onClick={onClose} className="text-current opacity-60 hover:opacity-100 shrink-0">✕</button>
    </div>
  );
}

function AuditLog({ runs }: { runs: any[] }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-0">
        {runs.length === 0 ? (
          <p className="text-muted-foreground/70 text-sm p-6">No automation runs yet. Use "Run Now" or "Run All Active" to start.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left p-4">Automation</th>
                  <th className="text-left p-4">Trigger</th>
                  <th className="text-left p-4 max-w-[220px]">Result</th>
                  <th className="text-center p-4">Outcome</th>
                  <th className="text-right p-4">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runs.map(r => {
                  const matchedCount = r.details?.matchedCount;
                  const msg = r.details?.message;
                  return (
                    <tr key={r.id} className="hover:bg-muted">
                      <td className="p-4 text-foreground text-xs font-medium">{r.automationName}</td>
                      <td className="p-4 text-muted-foreground text-xs">
                        {TRIGGER_CONFIG[r.trigger]?.label ?? r.trigger}
                      </td>
                      <td className="p-4 text-muted-foreground text-xs max-w-[220px] truncate" title={msg ?? ""}>
                        {msg ?? r.entityName ?? "—"}
                      </td>
                      <td className="p-4 text-center">
                        <OutcomePill outcome={r.outcome} matchedCount={matchedCount} />
                      </td>
                      <td className="p-4 text-right text-muted-foreground/70 text-xs whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AutomationsPage() {
  const { role } = useAuthRole();
  const canToggle = hasPermission(role, "enableAutomation");
  const canRun    = hasPermission(role, "triggerAutomation");

  const [automations, setAutomations] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const load = useCallback(() => {
    Promise.all([
      fetch(`${API}/automations`).then(r => r.json()),
      fetch(`${API}/automation-runs`).then(r => r.json()),
    ]).then(([a, r]) => {
      setAutomations(Array.isArray(a) ? a : []);
      setRuns(Array.isArray(r) ? r : []);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (id: number) => {
    await fetch(`${API}/automations/${id}/toggle`, { method: "POST" });
    load();
  };

  const runOne = async (automation: any) => {
    setRunningId(automation.id);
    setLastResult(null);
    try {
      const res = await fetch(`${API}/automations/${automation.id}/run`, { method: "POST" });
      const data = await res.json();
      setLastResult(data);
    } finally {
      setRunningId(null);
      load();
    }
  };

  const runAll = async () => {
    setRunningAll(true);
    setLastResult(null);
    try {
      const res = await fetch(`${API}/automations/run`, { method: "POST" });
      const data = await res.json();
      setLastResult(data);
    } finally {
      setRunningAll(false);
      load();
    }
  };

  const active      = automations.filter(a => a.enabled).length;
  const totalRuns   = automations.reduce((s, a) => s + (a.runCount ?? 0), 0);
  const liveCount   = automations.filter(a => LIVE_TRIGGERS.has(a.trigger)).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400" /> Automations
            </h1>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              Fixed-rule business automations — trigger evaluation with audit trail
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={load} className="text-muted-foreground h-8">
              <RefreshCw className="h-4 w-4 mr-2" />Refresh
            </Button>
            {canRun && (
              <Button
                size="sm"
                onClick={runAll}
                disabled={runningAll || active === 0}
                className="h-8 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40"
              >
                {runningAll
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running…</>
                  : <><ListChecks className="h-4 w-4 mr-2" />Run All Active</>}
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mt-4">
          {[
            { label: "Total Rules",   value: String(automations.length) },
            { label: "Active",        value: String(active),    color: "text-emerald-400" },
            { label: "Live Triggers", value: String(liveCount), color: "text-blue-400" },
            { label: "Total Runs",    value: String(totalRuns) },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-muted rounded-lg px-3 py-2.5">
              <p className="text-xs text-muted-foreground/70">{label}</p>
              <p className={`text-lg font-bold ${color ?? "text-foreground"} mt-0.5`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6">
        <RunResultBanner result={lastResult} onClose={() => setLastResult(null)} />

        <Tabs defaultValue="rules">
          <TabsList className="bg-card border border-border mb-6">
            <TabsTrigger value="rules" className="data-[state=active]:bg-muted">
              Rules ({automations.length})
            </TabsTrigger>
            <TabsTrigger value="audit" className="data-[state=active]:bg-muted">
              Execution Log ({runs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rules">
            {automations.length === 0 ? (
              <p className="text-muted-foreground/60 text-sm">Loading automation rules…</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {automations.map(a => (
                  <AutomationCard
                    key={a.id}
                    automation={a}
                    onToggle={() => toggle(a.id)}
                    onRun={() => runOne(a)}
                    running={runningId === a.id}
                    canToggle={canToggle}
                    canRun={canRun}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="audit">
            <AuditLog runs={runs} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
