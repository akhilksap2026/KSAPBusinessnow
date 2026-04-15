import { useState, useMemo, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  TrendingUp, DollarSign, Target, CheckCircle2, Search,
  ChevronRight, Building2, User, Calendar, Handshake, BarChart3,
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

const TYPE_LABELS: Record<string, string> = {
  implementation: "Implementation", cloud_migration: "Cloud Migration",
  ams: "AMS", certification: "Certification", rate_maintenance: "Rate Maintenance",
  custom_development: "Custom Dev", data_services: "Data Services",
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

export default function OpportunitiesPage() {
  const [opps, setOpps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/opportunities`)
      .then(r => r.json())
      .then(d => setOpps(Array.isArray(d) ? d : []))
      .catch(() => setOpps([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return opps.filter(o => {
      if (stageFilter !== "all" && o.stage !== stageFilter) return false;
      if (typeFilter !== "all" && o.type !== typeFilter) return false;
      if (q && !o.name.toLowerCase().includes(q.toLowerCase()) &&
          !(o.accountName ?? "").toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [opps, stageFilter, typeFilter, q]);

  // KPI computations
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Handshake className="h-6 w-6 text-primary" />
            Opportunity Pipeline
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track and manage sales opportunities across all accounts
          </p>
        </div>
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
            <p className="text-xs mt-1">Try adjusting your filters</p>
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
                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground leading-tight max-w-[220px]">{o.name}</div>
                        {o.summary && (
                          <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[220px]">{o.summary}</div>
                        )}
                      </td>

                      {/* Account */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-foreground">
                          <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                          <Link href={`/accounts`} className="hover:underline truncate max-w-[120px]">
                            {o.accountName ?? "—"}
                          </Link>
                        </div>
                      </td>

                      {/* Stage */}
                      <td className="px-3 py-3">
                        <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STAGE_COLORS[stage] ?? STAGE_COLORS.lead}`}>
                          {STAGE_LABELS[stage] ?? stage}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {TYPE_LABELS[o.type] ?? o.type}
                      </td>

                      {/* Value */}
                      <td className="px-3 py-3 text-right font-semibold text-sm tabular-nums text-foreground">
                        {fmt(o.value)}
                      </td>

                      {/* Probability */}
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

                      {/* Close Date */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3 shrink-0" />
                          {fmtDate(o.expectedCloseDate)}
                        </div>
                      </td>

                      {/* Owner */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[90px]">{o.ownerName ?? "—"}</span>
                        </div>
                      </td>

                      {/* Complexity */}
                      <td className="px-3 py-3 text-xs font-medium capitalize">
                        <span className={COMPLEXITY_COLORS[o.deliveryComplexity] ?? "text-muted-foreground"}>
                          {(o.deliveryComplexity ?? "—").replace("_", " ")}
                        </span>
                      </td>

                      {/* Arrow */}
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
                      className={`h-full rounded-full ${STAGE_COLORS[s].includes("blue") ? "bg-blue-500" : STAGE_COLORS[s].includes("violet") ? "bg-violet-500" : STAGE_COLORS[s].includes("amber") ? "bg-amber-500" : STAGE_COLORS[s].includes("orange") ? "bg-orange-500" : "bg-primary"}`}
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
    </div>
  );
}
