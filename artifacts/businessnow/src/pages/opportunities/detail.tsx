import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, addWeeks } from "date-fns";
import {
  ArrowLeft, ChevronRight, AlertTriangle, CheckCircle2,
  Clock, Building2, User, DollarSign, Calendar, Layers,
  Users, ShieldCheck, ExternalLink, FileText, Zap, PlusCircle, TrendingUp,
  Rocket, Link2, Trophy, Circle, ArrowRight,
} from "lucide-react";

const STAGE_COLORS: Record<string, string> = {
  lead: "bg-slate-500",
  qualified: "bg-blue-500",
  discovery: "bg-indigo-500",
  proposal: "bg-violet-500",
  negotiation: "bg-amber-500",
  won: "bg-green-500",
  closed_won: "bg-green-500",
  lost: "bg-red-400",
  parked: "bg-slate-400",
};

const TYPE_LABELS: Record<string, string> = {
  implementation: "Implementation",
  cloud_migration: "Cloud Migration",
  ams: "AMS Retainer",
  certification: "Certification",
  rate_maintenance: "Rate Maintenance",
  custom_development: "Custom Development",
  data_services: "Data Services",
};

const PROJECT_TYPES = [
  { val: "implementation", label: "Implementation" },
  { val: "cloud_migration", label: "Cloud Migration" },
  { val: "ams", label: "AMS Retainer" },
  { val: "certification", label: "Certification" },
  { val: "rate_maintenance", label: "Rate Maintenance" },
  { val: "custom_development", label: "Custom Development" },
  { val: "data_services", label: "Data Services" },
];

const ACTIVITY_ICONS: Record<string, any> = {
  discovery_call: Clock,
  workshop: Users,
  scope_clarification: Layers,
  client_commitment: CheckCircle2,
  internal_approval: ShieldCheck,
  proposal_sent: FileText,
  negotiation_note: DollarSign,
  go_nogo_decision: ShieldCheck,
  general_note: FileText,
};

function fmt(val: number | null | undefined) {
  if (!val) return "TBD";
  return val >= 1_000_000 ? `$${(val / 1_000_000).toFixed(2)}M` : `$${val.toLocaleString()}`;
}

// ─── Progression Panel ───────────────────────────────────────────────────────

function ProgressionPanel({ opp }: { opp: any }) {
  const proposals = opp.proposals || [];
  const acceptedProposal = proposals.find((p: any) => p.clientAcceptanceState === "accepted");
  const bestProposal = acceptedProposal || proposals[0];

  const isWon = opp.stage === "won" || opp.stage === "closed_won";
  const proposalWon = acceptedProposal != null || bestProposal?.clientAcceptanceState === "accepted";
  const hasHandoff = !!opp.handoffProjectId;
  const staffingOk = !opp.staffingRisk || opp.staffingRisk === "none";

  const steps = [
    {
      label: "Opportunity Stage",
      value: opp.stage?.replace("_", " ") || "lead",
      ok: isWon,
      icon: Trophy,
      color: isWon ? "text-green-600" : "text-muted-foreground",
    },
    {
      label: "Proposal Status",
      value: proposalWon ? "Accepted" : bestProposal ? bestProposal.clientAcceptanceState?.replace("_", " ") : "No proposal",
      ok: proposalWon,
      icon: FileText,
      color: proposalWon ? "text-green-600" : "text-muted-foreground",
    },
    {
      label: "Staffing Risk",
      value: opp.staffingRisk || "none",
      ok: staffingOk,
      icon: Users,
      color: staffingOk ? "text-green-600" : opp.staffingRisk === "high" ? "text-red-500" : "text-amber-500",
    },
    {
      label: "Handoff Status",
      value: hasHandoff ? "Complete" : isWon ? "Pending" : "Not started",
      ok: hasHandoff,
      icon: ArrowRight,
      color: hasHandoff ? "text-green-600" : isWon ? "text-amber-500" : "text-muted-foreground",
    },
    {
      label: "Project Conversion",
      value: hasHandoff ? `Project #${opp.handoffProjectId}` : "Not started",
      ok: hasHandoff,
      icon: Rocket,
      color: hasHandoff ? "text-green-600" : "text-muted-foreground",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-indigo-500" />
          Deal Progression
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {steps.map((s) => (
          <div key={s.label} className="flex items-center gap-2.5">
            {s.ok ? (
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            ) : (
              <Circle className={`h-4 w-4 shrink-0 ${s.color}`} />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground leading-none mb-0.5">{s.label}</p>
              <p className={`text-xs font-medium capitalize truncate ${s.color}`}>{s.value}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Won Deal Banner ──────────────────────────────────────────────────────────

function WonDealBanner({
  opp,
  onCreateProject,
  onLinkProject,
  setLocation,
}: {
  opp: any;
  onCreateProject: () => void;
  onLinkProject: () => void;
  setLocation: (path: string) => void;
}) {
  if (opp.handoffProjectId) {
    return (
      <div className="rounded-xl border border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-green-500/10">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="font-semibold text-green-800 dark:text-green-200 text-sm">Project Created — Deal Converted</p>
            <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
              This won opportunity has been converted to Project #{opp.handoffProjectId}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 gap-1.5"
            onClick={() => setLocation(`/projects/${opp.handoffProjectId}/command`)}
          >
            <Rocket className="h-3.5 w-3.5" /> Open Command Center
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLocation(`/projects/${opp.handoffProjectId}`)}
          >
            Full Detail
          </Button>
        </div>
      </div>
    );
  }

  const isWon = opp.stage === "won" || opp.stage === "closed_won";
  const proposals = opp.proposals || [];
  const hasAcceptedProposal = proposals.some((p: any) => p.clientAcceptanceState === "accepted");

  if (!isWon && !hasAcceptedProposal) return null;

  return (
    <div className="rounded-xl border-2 border-green-400 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/40 p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-green-500/15">
            <Trophy className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="font-bold text-green-800 dark:text-green-200">
              {isWon ? "Deal Won — Ready to Deliver" : "Proposal Accepted — Awaiting Stage Update"}
            </p>
            <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
              Create a delivery project to begin resourcing, milestones, and billing
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 gap-1.5 font-semibold"
            onClick={onCreateProject}
          >
            <Rocket className="h-3.5 w-3.5" /> Create Project
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 border-green-400" onClick={onLinkProject}>
            <Link2 className="h-3.5 w-3.5" /> Link Existing
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-green-700 gap-1.5"
            onClick={() => setLocation(`/handoff/${opp.id}`)}
          >
            Full Handoff Flow <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Create Project Modal ─────────────────────────────────────────────────────

function CreateProjectModal({
  open,
  onClose,
  opp,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  opp: any;
  onSuccess: (projectId: number) => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [pms, setPms] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);

  // compute default end date from expectedDurationWeeks
  const defaultEnd = opp.expectedStartDate && opp.expectedDurationWeeks
    ? format(addWeeks(parseISO(opp.expectedStartDate), opp.expectedDurationWeeks), "yyyy-MM-dd")
    : "";

  const [form, setForm] = useState({
    name: opp?.name || "",
    type: opp?.type || "implementation",
    startDate: opp?.expectedStartDate || "",
    endDate: defaultEnd,
    pmId: "",
    pmName: "",
    budgetHours: "",
    budgetValue: opp?.value ? String(Math.round(opp.value)) : "",
    templateId: "",
    description: opp?.scopeSummary || "",
  });

  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/templates").then((r) => r.json()),
    ]).then(([users, tmpl]) => {
      setPms(users.filter((u: any) => ["project_manager", "delivery_director", "admin"].includes(u.role)));
      setTemplates(tmpl);
    });
    // reset form when opp changes
    setForm({
      name: opp?.name || "",
      type: opp?.type || "implementation",
      startDate: opp?.expectedStartDate || "",
      endDate: defaultEnd,
      pmId: "",
      pmName: "",
      budgetHours: "",
      budgetValue: opp?.value ? String(Math.round(opp.value)) : "",
      templateId: "",
      description: opp?.scopeSummary || "",
    });
  }, [open]);

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handlePmChange(val: string) {
    const pm = pms.find((p) => String(p.id) === val);
    setForm((f) => ({ ...f, pmId: val, pmName: pm ? pm.name : "" }));
  }

  async function submit() {
    if (!form.name.trim()) { toast({ title: "Project name required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/opportunities/${opp.id}/convert-to-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
          pmId: form.pmId ? parseInt(form.pmId) : undefined,
          pmName: form.pmName || undefined,
          budgetHours: form.budgetHours ? parseFloat(form.budgetHours) : undefined,
          budgetValue: form.budgetValue ? parseFloat(form.budgetValue) : undefined,
          description: form.description || undefined,
          createdBy: "Current User",
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (r.status === 409 && d.projectId) {
          toast({ title: "Already converted", description: `Linked to project #${d.projectId}` });
          onSuccess(d.projectId);
        } else {
          toast({ title: d.error || "Error", variant: "destructive" });
        }
        return;
      }
      toast({ title: "Project created!", description: `${d.project.name} is ready in the command center.` });
      onSuccess(d.project.id);
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full text-sm border rounded-md px-3 py-2 bg-background focus:ring-1 focus:ring-primary/40 focus:outline-none";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-green-600" />
            Create Project from Won Deal
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Account info (read-only) */}
          <div className="rounded-lg bg-muted/40 px-3 py-2 flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Account:</span>
            <span className="font-medium">{opp.accountName}</span>
            {opp.value && (
              <>
                <span className="text-muted-foreground ml-2">·</span>
                <span className="text-muted-foreground">Deal value:</span>
                <span className="font-medium text-green-600">{fmt(opp.value)}</span>
              </>
            )}
          </div>

          {/* Project name */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Project Name *</label>
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Project name..."
            />
          </div>

          {/* Type + PM */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Project Type</label>
              <select className={inputCls} value={form.type} onChange={(e) => set("type", e.target.value)}>
                {PROJECT_TYPES.map((t) => <option key={t.val} value={t.val}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Project Manager</label>
              <select className={inputCls} value={form.pmId} onChange={(e) => handlePmChange(e.target.value)}>
                <option value="">Select PM...</option>
                {pms.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Start Date</label>
              <input type="date" className={inputCls} value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">End Date (Go-Live)</label>
              <input type="date" className={inputCls} value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
            </div>
          </div>

          {/* Budget */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Budget Hours</label>
              <input
                type="number"
                className={inputCls}
                placeholder="e.g. 1200"
                value={form.budgetHours}
                onChange={(e) => set("budgetHours", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Budget Value ($)</label>
              <input
                type="number"
                className={inputCls}
                placeholder="e.g. 250000"
                value={form.budgetValue}
                onChange={(e) => set("budgetValue", e.target.value)}
              />
            </div>
          </div>

          {/* Template */}
          {templates.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Template (Optional)</label>
              <select className={inputCls} value={form.templateId} onChange={(e) => set("templateId", e.target.value)}>
                <option value="">No template — start blank</option>
                {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description / Scope Notes</label>
            <Textarea
              placeholder="Scope summary, key requirements..."
              rows={3}
              className="text-sm resize-none"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          {/* Prefill notice if opp has handoff data */}
          {(opp.risks?.length > 0 || opp.stakeholders?.length > 0) && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <strong>Carried over from opportunity:</strong>{" "}
              {[
                opp.risks?.length > 0 && `${opp.risks.length} risk(s)`,
                opp.stakeholders?.length > 0 && `${opp.stakeholders.length} stakeholder(s)`,
                opp.scopeSummary && "scope summary",
              ].filter(Boolean).join(", ")}
              {" "}will be available in project detail.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="bg-green-600 hover:bg-green-700 gap-1.5" onClick={submit} disabled={saving}>
            <Rocket className="h-3.5 w-3.5" />
            {saving ? "Creating…" : "Create Project → Command Center"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Link Existing Project Dialog ────────────────────────────────────────────

function LinkProjectDialog({
  open,
  onClose,
  opp,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  opp: any;
  onSuccess: (projectId: number) => void;
}) {
  const { toast } = useToast();
  const [projects, setProjects] = useState<any[]>([]);
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/projects?accountId=${opp.accountId}`)
      .then((r) => r.json())
      .then((d) => setProjects(d.filter((p: any) => !p.handoffProjectId)));
    setSelected("");
  }, [open]);

  async function submit() {
    if (!selected) { toast({ title: "Select a project", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/opportunities/${opp.id}/link-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: parseInt(selected), linkedBy: "Current User" }),
      });
      const d = await r.json();
      if (!r.ok) { toast({ title: d.error || "Error", variant: "destructive" }); return; }
      toast({ title: "Project linked!", description: `Opportunity now linked to ${d.project.name}` });
      onSuccess(d.project.id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-blue-500" />
            Link to Existing Project
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Select an existing project under <strong>{opp.accountName}</strong> to link to this won opportunity.
          </p>

          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-4 text-center">
              No unlinked projects found for this account.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {projects.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(String(p.id))}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-colors ${
                    selected === String(p.id)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{p.status} · {p.type?.replace("_", " ")}</p>
                  </div>
                  {selected === String(p.id) && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !selected}>
            <Link2 className="h-3.5 w-3.5 mr-1.5" />
            {saving ? "Linking…" : "Link Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Activity Feed ────────────────────────────────────────────────────────────

function ActivityFeed({ activity, oppId, onRefresh }: { activity: any[]; oppId: number; onRefresh: () => void }) {
  const [note, setNote] = useState("");
  const [type, setType] = useState("general_note");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const TYPES = [
    { val: "general_note", label: "Note" },
    { val: "discovery_call", label: "Discovery Call" },
    { val: "workshop", label: "Workshop" },
    { val: "scope_clarification", label: "Scope Clarification" },
    { val: "client_commitment", label: "Client Commitment" },
    { val: "internal_approval", label: "Internal Approval" },
    { val: "negotiation_note", label: "Negotiation" },
  ];

  async function addEntry() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/opportunities/${oppId}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityType: type, title: title.trim(), body: note.trim(), authorName: "Current User" }),
      });
      setTitle(""); setNote(""); setType("general_note");
      toast({ title: "Activity logged" });
      onRefresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-dashed">
        <CardContent className="p-4 space-y-3">
          <div className="flex gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="text-xs border rounded-md px-2 py-1.5 bg-background"
            >
              {TYPES.map((t) => <option key={t.val} value={t.val}>{t.label}</option>)}
            </select>
            <input
              className="flex-1 text-sm border rounded-md px-3 py-1.5 bg-background"
              placeholder="Entry title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <Textarea
            placeholder="Notes, commitments, outcomes..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="text-sm"
          />
          <Button size="sm" onClick={addEntry} disabled={saving || !title.trim()} className="gap-1.5">
            <PlusCircle className="h-3.5 w-3.5" /> Log Entry
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {activity.map((a) => {
          const Icon = ACTIVITY_ICONS[a.activityType] || FileText;
          return (
            <div key={a.id} className="flex gap-3">
              <div className="mt-1 p-1.5 rounded-full bg-muted shrink-0">
                <Icon className="h-3 w-3 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{a.title}</p>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {format(new Date(a.createdAt), "MMM d, HH:mm")}
                  </span>
                </div>
                {a.body && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{a.body}</p>}
                {a.authorName && (
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{a.authorName}</p>
                )}
              </div>
            </div>
          );
        })}
        {activity.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No activity logged yet.</p>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [opp, setOpp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [triggeringTentative, setTriggeringTentative] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  const loadOpp = useCallback(() => {
    setLoading(true);
    fetch(`/api/opportunities/${id}`)
      .then((r) => r.json())
      .then((d) => { setOpp(d); setLoading(false); });
  }, [id]);

  useEffect(() => { loadOpp(); }, [loadOpp]);

  const doRefresh = useCallback(() => {
    fetch(`/api/opportunities/${id}`)
      .then((r) => r.json())
      .then((d) => setOpp(d));
  }, [id]);

  async function triggerTentativeProject() {
    setTriggeringTentative(true);
    try {
      const r = await fetch(`/api/opportunities/${id}/trigger-tentative`, { method: "POST" });
      const d = await r.json();
      if (r.ok) {
        toast({ title: "Tentative project shell created", description: `Project #${d.project.id} created — Resource Manager alerted.` });
        doRefresh();
      } else {
        toast({ title: "Error", description: d.error, variant: "destructive" });
      }
    } finally {
      setTriggeringTentative(false);
    }
  }

  function handleConversionSuccess(projectId: number) {
    setShowCreateModal(false);
    setShowLinkDialog(false);
    doRefresh();
    setTimeout(() => setLocation(`/projects/${projectId}/command`), 600);
  }

  if (loading || !opp) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-[300px] col-span-2" />
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    );
  }

  const isWon = opp.stage === "won" || opp.stage === "closed_won";
  const proposals = opp.proposals || [];
  const activity = opp.activity || [];
  const probabilityColor = opp.probability >= 70 ? "text-green-600" : opp.probability >= 40 ? "text-amber-500" : "text-muted-foreground";
  const hasAcceptedProposal = proposals.some((p: any) => p.clientAcceptanceState === "accepted");
  const showWonBanner = (isWon || hasAcceptedProposal);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Back + breadcrumb */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/opportunities")} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Pipeline
        </Button>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{opp.accountName}</span>
      </div>

      {/* Won deal banner (full width) */}
      {showWonBanner && (
        <WonDealBanner
          opp={opp}
          onCreateProject={() => setShowCreateModal(true)}
          onLinkProject={() => setShowLinkDialog(true)}
          setLocation={setLocation}
        />
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* ── Left column ── */}
        <div className="space-y-5">
          {/* Title + stage */}
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className={`w-2.5 h-2.5 rounded-full ${STAGE_COLORS[opp.stage] || "bg-slate-400"}`} />
              <Badge variant="outline" className="capitalize text-xs">{opp.stage?.replace("_", " ")}</Badge>
              <Badge variant="secondary" className="text-xs">{TYPE_LABELS[opp.type] || opp.type}</Badge>
              {opp.deliveryComplexity && (
                <Badge variant="outline" className="text-xs capitalize">{opp.deliveryComplexity} complexity</Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight mt-2">{opp.name}</h1>
            {opp.summary && <p className="text-muted-foreground mt-1">{opp.summary}</p>}
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: DollarSign, label: "Est. Value", value: opp.value ? `$${opp.value.toLocaleString()}` : "TBD", color: "text-green-500" },
              { icon: Calendar, label: "Expected Start", value: opp.expectedStartDate ? format(parseISO(opp.expectedStartDate), "MMM d, yyyy") : "TBD", color: "text-blue-500" },
              { icon: Clock, label: "Duration", value: opp.expectedDurationWeeks ? `${opp.expectedDurationWeeks} weeks` : "TBD", color: "text-indigo-500" },
              { icon: TrendingUp, label: "Win Probability", value: `${opp.probability || 0}%`, color: probabilityColor },
            ].map((m) => (
              <Card key={m.label} className="p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <m.icon className={`h-3.5 w-3.5 ${m.color}`} />
                  {m.label}
                </div>
                <p className="text-lg font-bold mt-1">{m.value}</p>
              </Card>
            ))}
          </div>

          {/* Owner + staffing */}
          <div className="flex items-center gap-4 text-sm flex-wrap">
            {opp.ownerName && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                <span>Owner: <strong className="text-foreground">{opp.ownerName}</strong></span>
              </div>
            )}
            {opp.accountName && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
                <span>{opp.accountName}</span>
              </div>
            )}
            {opp.staffingRisk && opp.staffingRisk !== "none" && (
              <div className="flex items-center gap-1.5 text-orange-500 font-medium">
                <AlertTriangle className="h-3.5 w-3.5" />
                {opp.staffingRisk} staffing risk
              </div>
            )}
          </div>

          {/* Scope & Assumptions */}
          {(opp.scopeSummary || opp.assumptions) && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-500" /> Scope & Assumptions
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {opp.scopeSummary && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Scope Summary</p>
                    <p className="text-sm">{opp.scopeSummary}</p>
                  </div>
                )}
                {opp.assumptions && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Assumptions</p>
                    <p className="text-sm">{opp.assumptions}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Modules + Roles */}
          {((opp.otmModules && opp.otmModules.length > 0) || (opp.requiredRoles && opp.requiredRoles.length > 0)) && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-violet-500" /> Modules & Required Skills
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {opp.otmModules && opp.otmModules.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-2">OTM Modules Involved</p>
                    <div className="flex flex-wrap gap-1.5">
                      {opp.otmModules.map((m: string) => (
                        <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {opp.requiredRoles && opp.requiredRoles.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Required Roles</p>
                    <div className="flex flex-wrap gap-1.5">
                      {opp.requiredRoles.map((r: string) => (
                        <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {opp.staffingDemandSummary && (
                  <p className="text-sm text-muted-foreground">{opp.staffingDemandSummary}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Stakeholders */}
          {opp.stakeholders && opp.stakeholders.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-amber-500" /> Stakeholders
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-2">
                  {opp.stakeholders.map((s: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{s.name}</span>
                      <div className="flex items-center gap-2 text-muted-foreground text-xs">
                        <Badge variant="outline" className="text-[10px]">{s.role}</Badge>
                        {s.email && <span>{s.email}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Risks */}
          {(opp.logisticsEnvironmentNotes || (opp.risks && opp.risks.length > 0)) && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-400" /> Risks & Environment
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {opp.logisticsEnvironmentNotes && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Logistics Environment</p>
                    <p className="text-sm">{opp.logisticsEnvironmentNotes}</p>
                  </div>
                )}
                {opp.risks && opp.risks.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Risks & Dependencies</p>
                    <div className="space-y-1.5">
                      {opp.risks.map((r: any, i: number) => (
                        <div key={i} className="flex items-start gap-2">
                          <Badge variant={r.severity === "high" ? "destructive" : "secondary"} className="text-[10px] mt-0.5 shrink-0 capitalize">
                            {r.severity}
                          </Badge>
                          <p className="text-sm">{r.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Proposals */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-green-500" /> Proposals ({proposals.length})
                </CardTitle>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setLocation(`/proposals/new?opportunityId=${opp.id}`)}>
                  <PlusCircle className="h-3 w-3" /> New Proposal
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {proposals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No proposals yet.</p>
              ) : (
                proposals.map((p: any) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border hover:border-primary/40 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setLocation(`/proposals/${p.id}`)}
                  >
                    <div>
                      <p className="text-sm font-medium">{p.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="secondary" className="text-[10px]">{p.proposalType}</Badge>
                        <Badge variant="outline" className={`text-[10px] ${p.internalApprovalState === "approved" ? "border-green-400 text-green-600" : ""}`}>
                          {p.internalApprovalState}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] ${p.clientAcceptanceState === "accepted" ? "border-green-400 text-green-600" : ""}`}>
                          Client: {p.clientAcceptanceState?.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.totalValue && <span className="text-sm font-bold">${p.totalValue.toLocaleString()}</span>}
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Activity */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" /> Activity & Communication History
            </h3>
            <ActivityFeed activity={activity} oppId={opp.id} onRefresh={doRefresh} />
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-4">
          {/* Progression Panel */}
          <ProgressionPanel opp={opp} />

          {/* Tentative project trigger */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Tentative Project
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {opp.tentativeProjectTriggered ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-600 text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-medium">Project shell created</span>
                  </div>
                  {opp.tentativeProjectId && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => setLocation(`/projects/${opp.tentativeProjectId}`)}
                    >
                      View Project #{opp.tentativeProjectId}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    At ≥60% probability, create a tentative project shell to allow soft resource allocations.
                  </p>
                  <div className={`text-xs font-medium ${(opp.probability || 0) >= 60 ? "text-green-600" : "text-muted-foreground"}`}>
                    Current probability: {opp.probability || 0}%
                    {(opp.probability || 0) >= 60 ? " ✓ Threshold met" : ` (need 60%)`}
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={(opp.probability || 0) < 60 || triggeringTentative}
                    onClick={triggerTentativeProject}
                  >
                    <Zap className="h-3.5 w-3.5 mr-1.5" />
                    {triggeringTentative ? "Creating..." : "Trigger Tentative Project"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Project Conversion — the main CTA for won deals */}
          <Card className={showWonBanner ? "border-green-300 dark:border-green-700" : ""}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Rocket className={`h-4 w-4 ${showWonBanner ? "text-green-600" : "text-muted-foreground"}`} />
                Project Conversion
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {opp.handoffProjectId ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4" /> Converted to project
                  </div>
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 gap-1.5 text-xs"
                    size="sm"
                    onClick={() => setLocation(`/projects/${opp.handoffProjectId}/command`)}
                  >
                    <Rocket className="h-3 w-3" /> Open Command Center
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setLocation(`/projects/${opp.handoffProjectId}`)}
                  >
                    Full Project Detail <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              ) : showWonBanner ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    This deal is won. Create or link a delivery project to begin execution.
                  </p>
                  <Button
                    size="sm"
                    className="w-full bg-green-600 hover:bg-green-700 gap-1.5"
                    onClick={() => setShowCreateModal(true)}
                  >
                    <Rocket className="h-3.5 w-3.5" /> Create Project
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5"
                    onClick={() => setShowLinkDialog(true)}
                  >
                    <Link2 className="h-3.5 w-3.5" /> Link Existing Project
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full text-xs text-muted-foreground"
                    onClick={() => setLocation(`/handoff/${opp.id}`)}
                  >
                    Full Handoff Flow →
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Mark opportunity as <strong>Won</strong> or get a proposal accepted to enable project conversion.
                  </p>
                  {(opp.stage === "negotiation") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      onClick={() => setLocation(`/handoff/${opp.id}`)}
                    >
                      Begin Handoff Flow →
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {opp.notes && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">Internal Notes</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm text-muted-foreground leading-relaxed">{opp.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && opp && (
        <CreateProjectModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          opp={opp}
          onSuccess={handleConversionSuccess}
        />
      )}
      {showLinkDialog && opp && (
        <LinkProjectDialog
          open={showLinkDialog}
          onClose={() => setShowLinkDialog(false)}
          opp={opp}
          onSuccess={handleConversionSuccess}
        />
      )}
    </div>
  );
}
