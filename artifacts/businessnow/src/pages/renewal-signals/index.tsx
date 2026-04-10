import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Calendar, DollarSign, ExternalLink, RefreshCw, PlusCircle } from "lucide-react";
import { useAuthRole, hasPermission } from "@/lib/auth";

const API = "/api";

function fmt(v: number) {
  if (!v) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

const SIGNAL_LABELS: Record<string, string> = {
  renewal_due: "Renewal Due",
  new_work: "New Work",
  ams_expansion: "AMS Expansion",
  new_region: "New Region",
  custom_dev: "Custom Development",
  migration_phase2: "Migration Phase 2",
  low_csat: "Low CSAT Alert",
};

const SIGNAL_COLORS: Record<string, string> = {
  renewal_due: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  new_work: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  ams_expansion: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  new_region: "text-violet-400 bg-violet-500/10 border-violet-500/30",
  custom_dev: "text-pink-400 bg-pink-500/10 border-pink-500/30",
  migration_phase2: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
  low_csat: "text-red-400 bg-red-500/10 border-red-500/30",
};

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export default function RenewalSignalsPage() {
  const [, setLocation] = useLocation();
  const { role } = useAuthRole();
  const canAct = hasPermission(role, "actOnRenewalSignal");
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const load = () => {
    setLoading(true);
    fetch(`${API}/renewal-signals`).then(r => r.json()).then(d => { setSignals(d); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const types = Array.from(new Set(signals.map(s => s.signalType)));
  const filtered = filter === "all" ? signals : signals.filter(s => s.signalType === filter);
  const sorted = [...filtered].sort((a, b) => (PRIORITY_ORDER[a.priority] || 3) - (PRIORITY_ORDER[b.priority] || 3));

  const totalValue = signals.reduce((s, sig) => s + (sig.estimatedValue || 0), 0);
  const openSignals = signals.filter(s => s.status === "open").length;

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" /> Renewal Signals
            </h1>
            <p className="text-xs text-muted-foreground/70 mt-0.5">Track renewals, expansions, and upsell opportunities across all accounts</p>
          </div>
          <Button size="sm" variant="ghost" onClick={load} className="text-muted-foreground">
            <RefreshCw className="h-4 w-4 mr-2" />Refresh
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-3 mt-4">
          {[
            { label: "Total Signals", value: String(signals.length) },
            { label: "Open", value: String(openSignals), color: "text-emerald-400" },
            { label: "Est. Pipeline Value", value: fmt(totalValue), color: "text-foreground" },
            { label: "Signal Types", value: String(types.length) },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-muted/50 rounded-lg px-3 py-2.5">
              <p className="text-xs text-muted-foreground/70">{label}</p>
              <p className={`text-lg font-bold ${color || "text-foreground"} mt-0.5`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* Filter bar */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <Button size="sm" variant={filter === "all" ? "default" : "ghost"} onClick={() => setFilter("all")} className="h-7 text-xs">
            All ({signals.length})
          </Button>
          {types.map(t => (
            <Button key={t} size="sm" variant={filter === t ? "default" : "ghost"} onClick={() => setFilter(t)} className="h-7 text-xs">
              {SIGNAL_LABELS[t] || t} ({signals.filter(s => s.signalType === t).length})
            </Button>
          ))}
        </div>

        {sorted.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground/70">
            <TrendingUp className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">No signals yet</p>
            <p className="text-xs mt-1">Renewal and expansion signals will appear here as they're identified</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sorted.map(s => {
              const typeColor = SIGNAL_COLORS[s.signalType] || "text-muted-foreground bg-muted border-border";
              const daysUntil = s.dueDate ? Math.floor((new Date(s.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
              return (
                <Card key={s.id} className={`border ${typeColor.split(" ").slice(1).join(" ")}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Badge className={`text-[10px] ${typeColor} border`}>{SIGNAL_LABELS[s.signalType] || s.signalType}</Badge>
                        <p className="font-semibold text-foreground mt-2">{s.accountName || "Unknown Account"}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant="secondary" className="text-[10px] capitalize">{s.priority}</Badge>
                        <Badge variant="outline" className="text-[10px] capitalize border-border">{s.status}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}

                    <div className="flex items-center justify-between">
                      {s.dueDate && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Calendar className="h-3 w-3 text-muted-foreground/70" />
                          <span className={daysUntil !== null && daysUntil <= 30 ? "text-amber-400" : "text-muted-foreground"}>{s.dueDate}</span>
                          {daysUntil !== null && daysUntil <= 30 && <span className="text-amber-500">({daysUntil}d)</span>}
                        </div>
                      )}
                      {s.estimatedValue && (
                        <div className="flex items-center gap-1 text-emerald-400 font-semibold text-sm">
                          <DollarSign className="h-3.5 w-3.5" />{fmt(s.estimatedValue).replace("$", "")}
                        </div>
                      )}
                    </div>

                    {s.assignedTo && <p className="text-xs text-muted-foreground/70">Owner: <span className="text-foreground/70">{s.assignedTo}</span></p>}

                    {s.notes && <p className="text-xs text-muted-foreground/70 italic">{s.notes}</p>}

                    <div className="flex gap-2">
                      {s.status === "open" && canAct && (
                        <Button
                          size="sm"
                          variant="default"
                          className="flex-1 h-7 text-xs"
                          onClick={async () => {
                            const body = {
                              name: `${s.accountName} — ${SIGNAL_LABELS[s.signalType] || s.signalType}`,
                              accountId: s.accountId,
                              accountName: s.accountName,
                              stage: "discovery",
                              value: s.estimatedValue || 0,
                              probability: 50,
                              source: "renewal_signal",
                              notes: s.notes || s.description || "",
                            };
                            const res = await fetch(`${API}/opportunities`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                            if (res.ok) {
                              const opp = await res.json();
                              setLocation(`/opportunities/${opp.id || ""}`);
                            }
                          }}
                        >
                          <PlusCircle className="h-3 w-3 mr-1" /> Create Opp
                        </Button>
                      )}
                      <Link href={`/accounts/${s.accountId}`} className={s.status === "open" ? "" : "flex-1"}>
                        <Button size="sm" variant="ghost" className="w-full h-7 text-xs text-muted-foreground hover:text-foreground">
                          View Account <ExternalLink className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
