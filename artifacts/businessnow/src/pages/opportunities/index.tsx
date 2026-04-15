import { useState, useMemo, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp, DollarSign, Target, CheckCircle2, Search,
  ChevronRight, Building2, User, Calendar, Handshake, BarChart3, Plus,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

const STAGES = ["lead", "qualified", "discovery", "proposal", "negotiation", "won", "lost", "parked"] as const;
type Stage = typeof STAGES[number];

const STAGE_LABELS: Record<Stage, string> = {
  lead: "Lead", qualified: "Qualified", discovery: "Discovery",
  proposal: "Proposal", negotiation: "Negotiation",
  won: "Won", lost: "Lost", parked: "Parked",
};

const STAGE_COLORS: Record<Stage, string> = {
  lead:        "bg-muted/60 text-muted-foreground border-border",
  qualified:   "bg-blue-950/40 text-blue-300 border-blue-500/30",
  discovery:   "bg-violet-950/40 text-violet-300 border-violet-500/30",
  proposal:    "bg-amber-950/40 text-amber-300 border-amber-500/30",
  negotiation: "bg-orange-950/40 text-orange-300 border-orange-500/30",
  won:         "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
  lost:        "bg-red-950/40 text-red-400 border-red-500/30",
  parked:      "bg-muted/30 text-muted-foreground border-border",
};

// Stage → default probability
const STAGE_PROB: Record<Stage, number> = {
  lead: 10, qualified: 20, discovery: 30, proposal: 50,
  negotiation: 70, won: 100, lost: 0, parked: 0,
};

const TYPE_LABELS: Record<string, string> = {
  implementation: "Implementation", cloud_migration: "Cloud Migration",
  ams: "AMS", certification: "Certification", rate_maintenance: "Rate Maintenance",
  custom_development: "Custom Dev", data_services: "Data Services",
};

const COMPLEXITY_LABELS: Record<string, string> = {
  low: "Low", medium: "Medium", high: "High", very_high: "Very High",
};

const COMPLEXITY_COLORS: Record<string, string> = {
  low: "text-emerald-400", medium: "text-amber-400",
  high: "text-orange-400", very_high: "text-red-400",
};

function fmt(v: string | number | null | undefined) {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  return n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `$${(n / 1_000).toFixed(0)}K`
    : `$${n.toFixed(0)}`;
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function KpiCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string; sub?: string; icon: React.ElementType; accent: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-xl font-bold text-foreground leading-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Add Opportunity Modal ─────────────────────────────────────────────────────

type OppForm = {
  name: string;
  accountId: string;
  stage: Stage;
  type: string;
  value: string;
  probability: string;
  expectedCloseDate: string;
  expectedStartDate: string;
  expectedDurationWeeks: string;
  ownerName: string;
  deliveryComplexity: string;
  summary: string;
};

const defaultOppForm = (): OppForm => ({
  name: "",
  accountId: "",
  stage: "lead",
  type: "implementation",
  value: "",
  probability: "10",
  expectedCloseDate: "",
  expectedStartDate: "",
  expectedDurationWeeks: "",
  ownerName: "",
  deliveryComplexity: "medium",
  summary: "",
});

function AddOpportunityModal({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<OppForm>(defaultOppForm());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof OppForm, string>>>({});
  const [accounts, setAccounts] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    if (open) {
      fetch(`${API_BASE}/accounts`)
        .then(r => r.json())
        .then(d => setAccounts(Array.isArray(d) ? d.map((a: any) => ({ id: a.id, name: a.name })) : []))
        .catch(() => setAccounts([]));
    }
  }, [open]);

  const set = <K extends keyof OppForm>(k: K, v: OppForm[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleStageChange = (stage: Stage) => {
    setForm(f => ({ ...f, stage, probability: String(STAGE_PROB[stage]) }));
  };

  const validate = () => {
    const e: typeof errors = {};
    if (!form.name.trim())    e.name = "Name is required";
    if (!form.accountId)      e.accountId = "Account is required";
    if (form.value && isNaN(parseFloat(form.value)))
      e.value = "Must be a valid number";
    if (form.probability) {
      const p = parseInt(form.probability);
      if (isNaN(p) || p < 0 || p > 100) e.probability = "Must be 0–100";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const selectedAccount = accounts.find(a => String(a.id) === form.accountId);
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        accountId: Number(form.accountId),
        accountName: selectedAccount?.name ?? "",
        stage: form.stage,
        type: form.type,
        probability: parseInt(form.probability) || 0,
        deliveryComplexity: form.deliveryComplexity,
      };
      if (form.value)                payload.value = parseFloat(form.value);
      if (form.expectedCloseDate)    payload.expectedCloseDate = form.expectedCloseDate;
      if (form.expectedStartDate)    payload.expectedStartDate = form.expectedStartDate;
      if (form.expectedDurationWeeks) payload.expectedDurationWeeks = parseInt(form.expectedDurationWeeks);
      if (form.ownerName)            payload.ownerName = form.ownerName.trim();
      if (form.summary)              payload.summary = form.summary.trim();

      const res = await fetch(`${API_BASE}/opportunities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to create opportunity");
      }
      const created = await res.json();
      toast({ title: `Opportunity "${created.name}" created` });
      setForm(defaultOppForm());
      setErrors({});
      onCreated();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setForm(defaultOppForm());
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Handshake className="h-5 w-5 text-primary" />
            Add New Opportunity
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Opportunity Name */}
          <div className="space-y-1.5">
            <Label htmlFor="opp-name">
              Opportunity Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="opp-name"
              placeholder="e.g. Apex Logistics — OTM Cloud Migration"
              value={form.name}
              onChange={e => set("name", e.target.value)}
              className={errors.name ? "border-red-500" : ""}
              autoFocus
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Account + Stage */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                Account <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.accountId || "__none__"}
                onValueChange={v => set("accountId", v === "__none__" ? "" : v)}
              >
                <SelectTrigger className={errors.accountId ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select account…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Select account —</SelectItem>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.accountId && <p className="text-xs text-red-500">{errors.accountId}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Stage</Label>
              <Select value={form.stage} onValueChange={v => handleStageChange(v as Stage)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map(s => (
                    <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Type + Complexity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Engagement Type</Label>
              <Select value={form.type} onValueChange={v => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Delivery Complexity</Label>
              <Select value={form.deliveryComplexity} onValueChange={v => set("deliveryComplexity", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(COMPLEXITY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Value + Probability */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="opp-value">Deal Value ($)</Label>
              <Input
                id="opp-value"
                placeholder="e.g. 450000"
                value={form.value}
                onChange={e => set("value", e.target.value)}
                className={errors.value ? "border-red-500" : ""}
              />
              {errors.value && <p className="text-xs text-red-500">{errors.value}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opp-prob">Win Probability (%)</Label>
              <Input
                id="opp-prob"
                placeholder="0–100"
                value={form.probability}
                onChange={e => set("probability", e.target.value)}
                className={errors.probability ? "border-red-500" : ""}
              />
              {errors.probability && <p className="text-xs text-red-500">{errors.probability}</p>}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="opp-close">Expected Close Date</Label>
              <Input
                id="opp-close"
                type="date"
                value={form.expectedCloseDate}
                onChange={e => set("expectedCloseDate", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opp-start">Expected Start Date</Label>
              <Input
                id="opp-start"
                type="date"
                value={form.expectedStartDate}
                onChange={e => set("expectedStartDate", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opp-dur">Duration (weeks)</Label>
              <Input
                id="opp-dur"
                placeholder="e.g. 24"
                value={form.expectedDurationWeeks}
                onChange={e => set("expectedDurationWeeks", e.target.value)}
              />
            </div>
          </div>

          {/* Owner */}
          <div className="space-y-1.5">
            <Label htmlFor="opp-owner">Opportunity Owner</Label>
            <Input
              id="opp-owner"
              placeholder="e.g. Rachel Kim"
              value={form.ownerName}
              onChange={e => set("ownerName", e.target.value)}
            />
          </div>

          {/* Summary */}
          <div className="space-y-1.5">
            <Label htmlFor="opp-summary">Summary / Notes</Label>
            <Textarea
              id="opp-summary"
              placeholder="Brief description of this opportunity…"
              value={form.summary}
              onChange={e => set("summary", e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-1.5">
            {saving ? (
              <span className="flex items-center gap-1.5">
                <span className="animate-spin inline-block w-3.5 h-3.5 border border-t-transparent border-white rounded-full" />
                Creating…
              </span>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Create Opportunity
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OpportunitiesPage() {
  const [opps, setOpps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const fetchOpps = () => {
    setLoading(true);
    fetch(`${API_BASE}/opportunities`)
      .then(r => r.json())
      .then(d => setOpps(Array.isArray(d) ? d : []))
      .catch(() => setOpps([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOpps(); }, []);

  const filtered = useMemo(() => {
    return opps.filter(o => {
      if (stageFilter !== "all" && o.stage !== stageFilter) return false;
      if (typeFilter !== "all" && o.type !== typeFilter) return false;
      if (q && !o.name.toLowerCase().includes(q.toLowerCase()) &&
          !(o.accountName ?? "").toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [opps, stageFilter, typeFilter, q]);

  const kpis = useMemo(() => {
    const active = opps.filter(o => !["won", "lost", "parked"].includes(o.stage));
    const won = opps.filter(o => o.stage === "won");
    const closedCount = opps.filter(o => o.stage === "won" || o.stage === "lost").length;
    const winRate = closedCount > 0 ? Math.round((won.length / closedCount) * 100) : 0;
    const pipeline = active.reduce((s, o) => s + parseFloat(o.value ?? "0"), 0);
    const weighted = active.reduce((s, o) => s + parseFloat(o.value ?? "0") * (o.probability ?? 0) / 100, 0);
    return { active: active.length, winRate, pipeline, weighted };
  }, [opps]);

  const stageCounts = useMemo(() => {
    const c: Record<string, number> = {};
    opps.forEach(o => { c[o.stage] = (c[o.stage] ?? 0) + 1; });
    return c;
  }, [opps]);

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Handshake className="h-6 w-6 text-primary" />
            Opportunity Pipeline
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track and manage sales opportunities across all accounts
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Add Opportunity
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Active Pipeline" value={fmt(kpis.pipeline)} sub={`${kpis.active} open opps`}
          icon={BarChart3} accent="bg-primary/10 text-primary" />
        <KpiCard label="Weighted Value" value={fmt(kpis.weighted)} sub="probability-adjusted"
          icon={TrendingUp} accent="bg-violet-500/10 text-violet-400" />
        <KpiCard label="Win Rate" value={`${kpis.winRate}%`} sub="closed deals"
          icon={CheckCircle2} accent="bg-emerald-500/10 text-emerald-400" />
        <KpiCard label="Total Opps" value={String(opps.length)} sub="all time"
          icon={Target} accent="bg-amber-500/10 text-amber-400" />
      </div>

      {/* Stage chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStageFilter("all")}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
            stageFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"
          }`}
        >
          All ({opps.length})
        </button>
        {STAGES.map(s => {
          const cnt = stageCounts[s] ?? 0;
          if (cnt === 0) return null;
          const active = stageFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStageFilter(active ? "all" : s)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
                active ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {STAGE_LABELS[s]} ({cnt})
            </button>
          );
        })}
      </div>

      {/* Filters bar */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search opportunities or accounts…"
            value={q}
            onChange={e => setQ(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 text-sm w-44">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(stageFilter !== "all" || typeFilter !== "all" || q) && (
          <Button variant="ghost" size="sm" onClick={() => { setStageFilter("all"); setTypeFilter("all"); setQ(""); }}
            className="text-xs h-9">
            Clear filters
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} of {opps.length} opportunities
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Target className="h-10 w-10 mx-auto opacity-20 mb-3" />
            <p className="text-sm font-medium">No opportunities found</p>
            <p className="text-xs mt-1">Try adjusting your filters or add a new opportunity</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-muted-foreground text-xs font-medium">
                  <th className="text-left px-4 py-3">Opportunity</th>
                  <th className="text-left px-3 py-3">Account</th>
                  <th className="text-left px-3 py-3">Stage</th>
                  <th className="text-left px-3 py-3">Type</th>
                  <th className="text-right px-3 py-3">Value</th>
                  <th className="text-center px-3 py-3">Prob.</th>
                  <th className="text-left px-3 py-3">Close Date</th>
                  <th className="text-left px-3 py-3">Owner</th>
                  <th className="text-left px-3 py-3">Complexity</th>
                  <th className="px-3 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(o => {
                  const stage = o.stage as Stage;
                  return (
                    <tr key={o.id} className="hover:bg-muted/10 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground leading-tight max-w-[220px]">{o.name}</div>
                        {o.summary && (
                          <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[220px]">{o.summary}</div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-foreground">
                          <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                          <Link href={`/accounts`} className="hover:underline truncate max-w-[120px]">
                            {o.accountName ?? "—"}
                          </Link>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STAGE_COLORS[stage] ?? STAGE_COLORS.lead}`}>
                          {STAGE_LABELS[stage] ?? stage}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {TYPE_LABELS[o.type] ?? o.type}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-sm tabular-nums text-foreground">
                        {fmt(o.value)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-xs font-medium text-foreground">{o.probability ?? 0}%</span>
                          <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                (o.probability ?? 0) >= 70 ? "bg-emerald-500" :
                                (o.probability ?? 0) >= 40 ? "bg-amber-500" : "bg-red-500/70"
                              }`}
                              style={{ width: `${o.probability ?? 0}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3 shrink-0" />
                          {fmtDate(o.expectedCloseDate)}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[90px]">{o.ownerName ?? "—"}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs font-medium capitalize">
                        <span className={COMPLEXITY_COLORS[o.deliveryComplexity] ?? "text-muted-foreground"}>
                          {(o.deliveryComplexity ?? "—").replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pipeline by stage summary */}
      {!loading && opps.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Pipeline by Stage
          </h3>
          <div className="space-y-2">
            {STAGES.filter(s => !["won", "lost", "parked"].includes(s)).map(s => {
              const stageOpps = opps.filter(o => o.stage === s);
              if (stageOpps.length === 0) return null;
              const total = stageOpps.reduce((sum, o) => sum + parseFloat(o.value ?? "0"), 0);
              const pipelineMax = opps
                .filter(o => !["won", "lost", "parked"].includes(o.stage))
                .reduce((sum, o) => sum + parseFloat(o.value ?? "0"), 0);
              const pct = pipelineMax > 0 ? (total / pipelineMax) * 100 : 0;
              return (
                <div key={s} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">{STAGE_LABELS[s]}</span>
                  <div className="flex-1 h-2 bg-muted/40 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        STAGE_COLORS[s].includes("blue") ? "bg-blue-500" :
                        STAGE_COLORS[s].includes("violet") ? "bg-violet-500" :
                        STAGE_COLORS[s].includes("amber") ? "bg-amber-500" :
                        STAGE_COLORS[s].includes("orange") ? "bg-orange-500" : "bg-primary"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-foreground w-16 text-right tabular-nums">{fmt(total)}</span>
                  <span className="text-xs text-muted-foreground w-8 text-right">{stageOpps.length}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Opportunity Modal */}
      <AddOpportunityModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={fetchOpps}
      />
    </div>
  );
}
