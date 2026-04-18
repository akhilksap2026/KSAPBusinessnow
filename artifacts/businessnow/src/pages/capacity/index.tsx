import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { TrendingUp, Users, AlertTriangle, CheckCircle2 } from "lucide-react";

const API = import.meta.env.BASE_URL + "api";

const PRACTICE_LABELS: Record<string, string> = {
  implementation: "OTM Implementation", cloud_migration: "Cloud Migration", ams: "AMS Support",
  qa: "QA / Certification", data_migration: "Data Migration", custom_dev: "Custom Dev",
  rate_maintenance: "Rate Maintenance", solution_architect: "Solution Architecture",
  integration: "Integration Specialist", management: "Project Management",
};

const PRACTICE_COLORS: Record<string, string> = {
  implementation: "bg-violet-500", cloud_migration: "bg-blue-500", ams: "bg-teal-500",
  qa: "bg-emerald-500", data_migration: "bg-cyan-500", custom_dev: "bg-indigo-500",
  rate_maintenance: "bg-amber-500", solution_architect: "bg-purple-500",
  integration: "bg-rose-500", management: "bg-slate-500",
};

export default function CapacityPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [windowWeeks, setWindowWeeks] = useState(12);
  const [view, setView] = useState<"table" | "bars">("bars");
  const [includeSoft, setIncludeSoft] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/resources/capacity?weeks=${windowWeeks}&includeSoft=${includeSoft}`)
      .then(r => r.json()).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [windowWeeks, includeSoft]);

  if (loading) return (
    <div className="p-6 space-y-4">
      <div className="h-16 bg-muted rounded-xl animate-pulse" />
      {[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}
    </div>
  );
  if (!data) return <div className="p-8 text-center text-muted-foreground">Could not load capacity data.</div>;

  const { weeks, forecast } = data;

  // Summary stats
  const totalResources = forecast.reduce((s: number, f: any) => s + f.resourceCount, 0);
  const totalCapacityHrs = forecast.reduce((s: number, f: any) => s + (f.weeklyForecast[0]?.totalCapacity || 0), 0);
  const totalDemandHrs = forecast.reduce((s: number, f: any) => s + (f.weeklyForecast[0]?.hardDemand || 0), 0);
  const firmUtilization = totalCapacityHrs > 0 ? Math.round((totalDemandHrs / totalCapacityHrs) * 100) : 0;
  const constrained = forecast.filter((f: any) => f.avgAvailability < 10);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4 flex-shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Capacity Forecast</h1>
            <p className="text-sm text-muted-foreground">Firm-wide delivery capacity vs. demand · {windowWeeks}-week window</p>
          </div>
          <div className="flex gap-3">
            {[
              { val: totalResources, label: "Total Resources", color: "text-foreground" },
              { val: `${firmUtilization}%`, label: "Firm Utilization", color: firmUtilization > 90 ? "text-red-600" : "text-blue-600" },
              { val: constrained.length, label: "Constrained Roles", color: constrained.length > 0 ? "text-red-600" : "text-emerald-600" },
            ].map((kpi, i) => (
              <div key={i} className="text-center px-4 py-2 bg-muted/60 rounded-xl">
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.val}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3">
          <div className="flex gap-1">
            {([4, 8, 12] as const).map(w => (
              <button key={w} onClick={() => setWindowWeeks(w)}
                className={`px-3 py-1 text-xs rounded font-medium transition-colors ${windowWeeks === w ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {w} weeks
              </button>
            ))}
          </div>
          <div className="flex gap-1 ml-4">
            {(["bars", "table"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1 text-xs rounded font-medium capitalize transition-colors ${view === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {v}
              </button>
            ))}
          </div>
          <button onClick={() => setIncludeSoft(s => !s)}
            className={`ml-2 flex items-center gap-1.5 px-3 py-1 text-xs rounded font-medium transition-colors border ${includeSoft ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700" : "bg-muted text-muted-foreground border-transparent"}`}
            title="Toggle soft/pipeline allocations in utilization">
            {includeSoft ? "● Soft included" : "○ Soft excluded"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Constraint alerts */}
        {constrained.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-red-700 flex items-center gap-2 mb-2">
              <AlertTriangle size={14} />Capacity Constraints Detected
            </p>
            <div className="space-y-1">
              {constrained.map((f: any) => (
                <p key={f.practiceArea} className="text-xs text-red-600">
                  · {PRACTICE_LABELS[f.practiceArea] || f.practiceArea} — avg {Math.round(f.avgAvailability)}h/week available with {f.resourceCount} resource{f.resourceCount !== 1 ? "s" : ""}
                </p>
              ))}
            </div>
          </div>
        )}

        {view === "bars" && (
          <div className="space-y-4">
            {forecast.map((f: any) => {
              const color = PRACTICE_COLORS[f.practiceArea] || "bg-slate-500";
              const firstWeek = f.weeklyForecast[0] || {};
              const cap = firstWeek.totalCapacity || 0;
              const demand = firstWeek.hardDemand || 0;
              const soft = firstWeek.softDemand || 0;
              const utilPct = cap > 0 ? Math.round((demand / cap) * 100) : 0;
              const isConstrained = f.avgAvailability < 10;

              return (
                <div key={f.practiceArea} className="border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${color}`} />
                      <div>
                        <h3 className="font-semibold text-sm">{PRACTICE_LABELS[f.practiceArea] || f.practiceArea}</h3>
                        <p className="text-xs text-muted-foreground">{f.resourceCount} resource{f.resourceCount !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`text-lg font-bold ${utilPct > 95 ? "text-red-600" : utilPct > 80 ? "text-amber-600" : "text-blue-600"}`}>{utilPct}%</p>
                        <p className="text-xs text-muted-foreground">utilized</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{Math.round(f.avgAvailability)}h</p>
                        <p className="text-xs text-muted-foreground">avg free/wk</p>
                      </div>
                      {isConstrained ? <AlertTriangle size={16} className="text-red-500" /> : <CheckCircle2 size={16} className="text-emerald-500" />}
                    </div>
                  </div>

                  {/* Weekly capacity bars */}
                  <div className="p-3 overflow-x-auto">
                    <div className="flex gap-1.5 min-w-max">
                      {f.weeklyForecast.map((w: any) => {
                        const capH = w.totalCapacity || 1;
                        const demH = Math.min(w.hardDemand, capH);
                        const softH = Math.min(w.softDemand, capH - demH);
                        const demPct = (demH / capH) * 100;
                        const softPct = (softH / capH) * 100;
                        const isOver = demH >= capH * 0.95;
                        return (
                          <div key={w.week} className="text-center" style={{ minWidth: "48px" }}>
                            <div className="h-16 bg-muted rounded-md flex flex-col-reverse overflow-hidden mb-1" title={`${format(new Date(w.week), "MMM d")}: ${Math.round(demH)}h hard, ${Math.round(softH)}h soft, ${Math.round(w.available)}h free`}>
                              {demPct > 0 && <div className={`${isOver ? "bg-red-400" : color} opacity-90`} style={{ height: `${demPct}%` }} />}
                              {includeSoft && softPct > 0 && <div style={{ height: `${softPct}%`, background: "repeating-linear-gradient(45deg, #f59e0b, #f59e0b 3px, transparent 3px, transparent 8px)", opacity: 0.65 }} />}
                            </div>
                            <p className="text-xs text-muted-foreground">{format(new Date(w.week), "M/d")}</p>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-4 mt-2 text-xs">
                      <div className="flex items-center gap-1"><div className={`w-3 h-2 rounded ${color} opacity-80`} /><span className="text-muted-foreground">Confirmed demand</span></div>
                      <div className="flex items-center gap-1"><div className="w-3 h-2 rounded" style={{ background: "repeating-linear-gradient(45deg,#f59e0b,#f59e0b 3px,transparent 3px,transparent 8px)", opacity: 0.65 }} /><span className="text-muted-foreground">Pipeline (Soft)</span></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {view === "table" && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground sticky left-0 bg-muted/50 z-10 w-44">Practice Area</th>
                  <th className="px-2 py-2 font-medium text-muted-foreground text-center">Resources</th>
                  {weeks.map((w: string) => (
                    <th key={w} className="px-2 py-2 font-medium text-muted-foreground text-center min-w-[60px]">{format(new Date(w), "MMM d")}</th>
                  ))}
                  <th className="px-3 py-2 font-medium text-muted-foreground text-center">Avg Avail</th>
                </tr>
              </thead>
              <tbody>
                {forecast.map((f: any) => (
                  <tr key={f.practiceArea} className="border-t hover:bg-muted/10">
                    <td className="px-3 py-2 sticky left-0 bg-background z-10">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${PRACTICE_COLORS[f.practiceArea] || "bg-slate-400"}`} />
                        <span className="font-medium">{PRACTICE_LABELS[f.practiceArea] || f.practiceArea}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center">{f.resourceCount}</td>
                    {f.weeklyForecast.map((w: any) => {
                      const pct = w.totalCapacity > 0 ? Math.round((w.hardDemand / w.totalCapacity) * 100) : 0;
                      return (
                        <td key={w.week} className="px-2 py-1 text-center">
                          <span className={`font-bold ${pct > 95 ? "text-red-600" : pct > 80 ? "text-amber-600" : pct > 50 ? "text-blue-600" : "text-emerald-600"}`}>{pct}%</span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center font-bold">{Math.round(f.avgAvailability)}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
