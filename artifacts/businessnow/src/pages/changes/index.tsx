import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, GitMerge, AlertTriangle, Clock, Search, DollarSign, Timer, Rocket, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useAuthRole, hasPermission } from "@/lib/auth";

const API = "/api";

function fmt(v: number) {
  if (!v || isNaN(v)) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const STAGES = [
  { id: "draft",           label: "Draft",           dot: "bg-zinc-400",    line: "border-zinc-300" },
  { id: "submitted",       label: "Submitted",        dot: "bg-blue-500",    line: "border-blue-300" },
  { id: "estimating",      label: "Estimating",       dot: "bg-violet-500",  line: "border-violet-300" },
  { id: "internal_review", label: "Internal Review",  dot: "bg-amber-500",   line: "border-amber-300" },
  { id: "client_review",   label: "Client Review",    dot: "bg-orange-500",  line: "border-orange-300" },
  { id: "approved",        label: "Approved",         dot: "bg-emerald-500", line: "border-emerald-300" },
  { id: "rejected",        label: "Rejected",         dot: "bg-red-500",     line: "border-red-300" },
];

const STAGE_FLOW = ["draft", "submitted", "estimating", "internal_review", "client_review", "approved"];
const APPROVAL_STAGES = new Set(["internal_review", "client_review"]);

const CATEGORIES: Record<string, { label: string; color: string }> = {
  expanded_scope:    { label: "Expanded Scope",   color: "text-violet-400" },
  extra_integration: { label: "Extra Integration", color: "text-blue-400" },
  testing_cycle:     { label: "Testing Cycle",     color: "text-amber-400" },
  new_region:        { label: "New Region",        color: "text-emerald-400" },
  rate_uplift:       { label: "Rate Uplift",       color: "text-orange-400" },
  ams_enhancement:   { label: "AMS Enhancement",   color: "text-pink-400" },
  other:             { label: "Other",             color: "text-muted-foreground" },
};

const PRIORITIES: Record<string, string> = {
  critical: "border-red-500/60 bg-red-500/5",
  high:     "border-orange-500/40 bg-orange-500/5",
  medium:   "border-border bg-card",
  low:      "border-border bg-card/50",
};

// ─── Status Timeline Strip ────────────────────────────────────────────────────
function StatusTimeline({ status }: { status: string }) {
  const isRejected = status === "rejected";
  const activeFlow = isRejected
    ? [...STAGE_FLOW.slice(0, STAGE_FLOW.indexOf("approved")), "rejected"]
    : STAGE_FLOW;

  const currentIdx = activeFlow.indexOf(status);

  return (
    <div className="flex items-center gap-0.5 w-full overflow-hidden">
      {activeFlow.map((stageId, i) => {
        const stage = STAGES.find(s => s.id === stageId)!;
        const isPast    = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isFuture  = i > currentIdx;

        const dotColor = isCurrent
          ? stage.dot
          : isPast
          ? (isRejected && stageId === "rejected" ? "bg-red-500" : "bg-emerald-400")
          : "bg-muted-foreground/20";

        const labelColor = isCurrent
          ? "text-foreground font-semibold"
          : isPast
          ? "text-muted-foreground/60"
          : "text-muted-foreground/30";

        return (
          <div key={stageId} className="flex items-center min-w-0 flex-1">
            <div className="flex flex-col items-center gap-0.5 min-w-0">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor} ${isCurrent ? "ring-2 ring-offset-1 ring-current" : ""}`} />
              <span className={`text-[8px] leading-none truncate max-w-full ${labelColor}`}>{stage.label}</span>
            </div>
            {i < activeFlow.length - 1 && (
              <div className={`h-px flex-1 mx-0.5 mb-2 ${isPast ? "bg-emerald-300" : "bg-muted/60"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── CR Card ─────────────────────────────────────────────────────────────────
function CRCard({
  cr,
  onStageChange,
  onApprove,
  onReject,
  canAdvance,
}: {
  cr: any;
  onStageChange: (id: number, stage: string) => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  canAdvance: boolean;
}) {
  const cat = CATEGORIES[cr.category] || CATEGORIES.other;
  const stageIdx    = STAGES.findIndex(s => s.id === cr.status);
  const flowIdx     = STAGE_FLOW.indexOf(cr.status);
  const nextStage   = flowIdx >= 0 && flowIdx < STAGE_FLOW.length - 2 ? STAGES.find(s => s.id === STAGE_FLOW[flowIdx + 1]) : null;
  const prevStage   = flowIdx > 0 ? STAGES.find(s => s.id === STAGE_FLOW[flowIdx - 1]) : null;
  const canApprove  = canAdvance && APPROVAL_STAGES.has(cr.status);
  const isTerminal  = cr.status === "approved" || cr.status === "rejected";

  return (
    <div className={`rounded-lg border ${PRIORITIES[cr.priority] || "border-border bg-card"} p-3 space-y-2.5`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground leading-snug">{cr.title}</p>
          {cr.changeOrderNumber && (
            <p className="text-[10px] text-muted-foreground font-mono">{cr.changeOrderNumber}</p>
          )}
        </div>
        {cr.priority !== "medium" && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
            cr.priority === "critical" ? "bg-red-500/10 border-red-500/30 text-red-400"
            : cr.priority === "high"   ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
            : "bg-muted border-border text-muted-foreground"
          }`}>{cr.priority}</span>
        )}
      </div>

      {/* Project link */}
      <div>
        {cr.projectId ? (
          <div className="flex items-center gap-1">
            <Link href={`/projects/${cr.projectId}`}
              className="text-[10px] text-muted-foreground hover:text-primary underline-offset-2 hover:underline truncate">
              {cr.projectName}
            </Link>
            <Link href={`/projects/${cr.projectId}/command`}
              className="text-muted-foreground/40 hover:text-primary flex-shrink-0" title="Command Center">
              <Rocket className="h-2.5 w-2.5" />
            </Link>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground truncate">{cr.projectName}</p>
        )}
        <p className={`text-[10px] font-medium ${cat.color}`}>{cat.label}</p>
      </div>

      {/* Impact metrics */}
      <div className="grid grid-cols-2 gap-1.5">
        {cr.impactCost && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <DollarSign className="h-2.5 w-2.5 text-emerald-400" />{fmt(parseFloat(cr.impactCost))}
          </div>
        )}
        {cr.impactHours && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-2.5 w-2.5 text-blue-400" />{parseFloat(cr.impactHours).toFixed(0)}h
          </div>
        )}
        {cr.impactWeeks && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Timer className="h-2.5 w-2.5 text-amber-400" />+{cr.impactWeeks}w
          </div>
        )}
        {cr.deliveredBeforeApproval && (
          <div className="flex items-center gap-1 text-[10px] text-red-400">
            <AlertTriangle className="h-2.5 w-2.5" />Leakage risk
          </div>
        )}
      </div>

      {/* Status timeline */}
      <div className="pt-1 border-t border-border/50">
        <StatusTimeline status={cr.status} />
      </div>

      {/* Terminal state info */}
      {cr.status === "approved" && cr.approvedBy && (
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
          <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
          <span>Approved by <strong>{cr.approvedBy}</strong></span>
          {cr.approvedAt && <span className="text-emerald-500 ml-auto">{fmtDate(cr.approvedAt)}</span>}
        </div>
      )}
      {cr.status === "rejected" && cr.rejectedBy && (
        <div className="flex flex-col gap-0.5 text-[10px] text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
          <div className="flex items-center gap-1.5">
            <XCircle className="h-3 w-3 flex-shrink-0" />
            <span>Rejected by <strong>{cr.rejectedBy}</strong></span>
            {cr.rejectedAt && <span className="text-red-400 ml-auto">{fmtDate(cr.rejectedAt)}</span>}
          </div>
          {cr.rejectionReason && (
            <p className="text-red-500 pl-4 italic">"{cr.rejectionReason}"</p>
          )}
        </div>
      )}

      {/* Action buttons */}
      {canAdvance && !isTerminal && (
        <div className="flex gap-1 pt-0.5 border-t border-border">
          {/* Approve / Reject shown on decision stages */}
          {canApprove ? (
            <>
              <button
                onClick={() => onReject(cr.id)}
                className="flex items-center gap-1 text-[10px] text-red-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-500/10 border border-transparent hover:border-red-200 transition-colors">
                <XCircle className="h-3 w-3" /> Reject
              </button>
              <button
                onClick={() => onApprove(cr.id)}
                className="ml-auto flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded hover:bg-emerald-500/10 border border-transparent hover:border-emerald-200 transition-colors font-semibold">
                <CheckCircle2 className="h-3 w-3" /> Approve
              </button>
            </>
          ) : (
            /* Normal advance/retreat for non-decision stages */
            <>
              {prevStage && (
                <button
                  onClick={() => onStageChange(cr.id, prevStage.id)}
                  className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded hover:bg-muted transition-colors">
                  ← {prevStage.label}
                </button>
              )}
              {nextStage && (
                <button
                  onClick={() => onStageChange(cr.id, nextStage.id)}
                  className="ml-auto text-[10px] text-blue-600 hover:text-blue-700 px-2 py-0.5 rounded hover:bg-blue-500/10 transition-colors">
                  {nextStage.label} →
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Reject Modal ─────────────────────────────────────────────────────────────
function RejectModal({ onConfirm, onClose }: { onConfirm: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" /> Reject Change Request
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">Optionally add a reason for rejection. This will be visible on the change order.</p>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Out of scope per SOW section 3.2…"
            rows={3}
            autoFocus
            className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm text-foreground resize-none placeholder:text-muted-foreground/50"
          />
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1 text-muted-foreground">Cancel</Button>
            <Button
              type="button"
              onClick={() => onConfirm(reason)}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white">
              Confirm Rejection
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── New CR Modal ─────────────────────────────────────────────────────────────
function NewCRModal({ onClose, onSave }: { onClose: () => void; onSave: (cr: any) => void }) {
  const [form, setForm] = useState({
    title: "", projectId: "", projectName: "", category: "other",
    priority: "medium", description: "", impactHours: "", impactCost: "", impactWeeks: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API}/change-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, projectId: parseInt(form.projectId) || 1, requestedByName: "Current User" }),
    });
    const cr = await res.json();
    onSave(cr);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold text-foreground">New Change Order</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Title *</label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required className="bg-muted border-border text-foreground" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Project Name</label>
              <Input value={form.projectName} onChange={e => setForm(f => ({ ...f, projectName: e.target.value }))} className="bg-muted border-border text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Project ID</label>
              <Input type="number" value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} className="bg-muted border-border text-foreground" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full bg-muted border border-border rounded-md px-3 py-2 text-foreground text-sm">
                {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full bg-muted border border-border rounded-md px-3 py-2 text-foreground text-sm">
                {["low", "medium", "high", "critical"].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Hours Impact</label>
              <Input type="number" value={form.impactHours} onChange={e => setForm(f => ({ ...f, impactHours: e.target.value }))} className="bg-muted border-border text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Cost Impact ($)</label>
              <Input type="number" value={form.impactCost} onChange={e => setForm(f => ({ ...f, impactCost: e.target.value }))} className="bg-muted border-border text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Timeline (wks)</label>
              <Input type="number" value={form.impactWeeks} onChange={e => setForm(f => ({ ...f, impactWeeks: e.target.value }))} className="bg-muted border-border text-foreground" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full bg-muted border border-border rounded-md px-3 py-2 text-foreground text-sm resize-none" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1 text-muted-foreground">Cancel</Button>
            <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">Create</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ChangesPage() {
  const { role } = useAuthRole();
  const canCreate  = hasPermission(role, "createChangeOrder");
  const canAdvance = hasPermission(role, "advanceChangeOrderStage");
  const [changes, setChanges] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<number | null>(null);

  const load = useCallback(() => {
    fetch(`${API}/change-requests`).then(r => r.json()).then(setChanges);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStageChange = async (id: number, newStatus: string) => {
    await fetch(`${API}/change-requests/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setChanges(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
  };

  const handleApprove = async (id: number) => {
    const res = await fetch(`${API}/change-requests/${id}/approve`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvedBy: "Current User" }),
    });
    if (res.ok) {
      const cr = await res.json();
      setChanges(prev => prev.map(c => c.id === id ? cr : c));
    }
  };

  const handleRejectConfirm = async (reason: string) => {
    if (rejectTarget === null) return;
    const res = await fetch(`${API}/change-requests/${rejectTarget}/reject`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rejectedBy: "Current User", rejectionReason: reason }),
    });
    if (res.ok) {
      const cr = await res.json();
      setChanges(prev => prev.map(c => c.id === rejectTarget ? cr : c));
    }
    setRejectTarget(null);
  };

  const filtered = changes.filter(c =>
    !search ||
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    (c.projectName || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalImpact  = filtered.reduce((s, c) => s + parseFloat(c.impactCost || "0"), 0);
  const leakageCount = filtered.filter(c => c.deliveredBeforeApproval).length;
  const pendingApproval = filtered.filter(c => APPROVAL_STAGES.has(c.status)).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {showNew && (
        <NewCRModal
          onClose={() => setShowNew(false)}
          onSave={cr => { setChanges(prev => [cr, ...prev]); setShowNew(false); }}
        />
      )}
      {rejectTarget !== null && (
        <RejectModal
          onConfirm={handleRejectConfirm}
          onClose={() => setRejectTarget(null)}
        />
      )}

      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <GitMerge className="h-5 w-5 text-violet-400" /> Change Orders
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">7-stage pipeline — scope, cost, and timeline impact tracking</p>
          </div>
          {canCreate && (
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white" onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4 mr-2" /> New Change Order
            </Button>
          )}
        </div>

        <div className="grid grid-cols-4 gap-4 mt-4">
          {[
            { label: "Total Changes",      value: String(changes.length),      sub: "across all projects" },
            { label: "Total Cost Impact",  value: fmt(totalImpact),            sub: "if all approved" },
            { label: "Awaiting Decision",  value: String(pendingApproval),     sub: "internal or client review", color: pendingApproval > 0 ? "text-amber-400" : "text-foreground" },
            { label: "Leakage Risk",       value: String(leakageCount),        sub: "delivered before approval", color: leakageCount > 0 ? "text-red-400" : "text-foreground" },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-muted rounded-lg px-3 py-2.5">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`text-lg font-bold ${color || "text-foreground"} mt-0.5`}>{value}</p>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="px-6 pt-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search changes…"
            className="pl-9 bg-card border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Kanban board */}
      <div className="p-6 overflow-x-auto">
        <div className="flex gap-3 min-w-max">
          {STAGES.map(stage => {
            const stageCRs = filtered.filter(c => c.status === stage.id);
            const isDecision = APPROVAL_STAGES.has(stage.id);
            return (
              <div key={stage.id} className="w-64 shrink-0">
                <div className={`flex items-center justify-between mb-3 pb-2 border-b-2 ${stage.line.replace("border-", "border-b-")}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${stage.dot}`} />
                    <span className="text-xs font-semibold text-foreground">{stage.label}</span>
                    {isDecision && canAdvance && (
                      <span className="text-[9px] bg-amber-100 text-amber-600 border border-amber-200 px-1 py-px rounded font-medium">Action needed</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{stageCRs.length}</span>
                </div>
                <div className="space-y-2">
                  {stageCRs.map(cr => (
                    <CRCard
                      key={cr.id}
                      cr={cr}
                      onStageChange={handleStageChange}
                      onApprove={handleApprove}
                      onReject={id => setRejectTarget(id)}
                      canAdvance={canAdvance}
                    />
                  ))}
                  {stageCRs.length === 0 && (
                    <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                      <p className="text-xs text-muted-foreground">No items</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
