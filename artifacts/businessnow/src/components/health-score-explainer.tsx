import React, { useEffect, useState, useCallback } from "react";
import { X, TrendingUp, TrendingDown, Minus, Lightbulb, AlertTriangle, Activity } from "lucide-react";

const API = import.meta.env.BASE_URL + "api";

interface Factor {
  label: string;
  value: number;
  status: "good" | "warning" | "critical";
}

interface HealthExplainerData {
  score: number;
  factors: Factor[];
  reasons: string[];
  recommendedActions: string[];
}

interface Props {
  projectId: number;
  onClose: () => void;
}

function scoreColor(score: number) {
  return score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-500" : "text-red-600";
}

function scoreBgGradient(score: number) {
  if (score >= 80) return "from-emerald-50 to-emerald-100/60 border-emerald-200";
  if (score >= 60) return "from-amber-50 to-amber-100/60 border-amber-200";
  return "from-red-50 to-red-100/60 border-red-200";
}

function scoreLabel(score: number) {
  return score >= 80 ? "Healthy" : score >= 60 ? "At Risk" : "Critical";
}

function barColor(status: Factor["status"]) {
  return status === "good" ? "bg-emerald-500" : status === "warning" ? "bg-amber-400" : "bg-red-500";
}

function StatusIcon({ status }: { status: Factor["status"] }) {
  if (status === "good") return <TrendingUp size={11} className="text-emerald-600 shrink-0" />;
  if (status === "warning") return <Minus size={11} className="text-amber-500 shrink-0" />;
  return <TrendingDown size={11} className="text-red-500 shrink-0" />;
}

function factorValueColor(status: Factor["status"]) {
  return status === "good" ? "text-emerald-600" : status === "warning" ? "text-amber-500" : "text-red-600";
}

export function HealthScoreExplainer({ projectId, onClose }: Props) {
  const [data, setData] = useState<HealthExplainerData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/projects/${projectId}/health-explainer`);
      if (r.ok) setData(await r.json());
    } catch {
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="fixed right-0 top-0 bottom-0 z-50 w-[340px] bg-white shadow-2xl flex flex-col border-l"
        role="dialog"
        aria-modal="true"
        aria-label="Health Score Explainer"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-primary" />
            <span className="font-semibold text-sm">Health Score Explainer</span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors rounded p-0.5 hover:bg-muted"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <span className="text-sm">Analyzing project…</span>
          </div>
        ) : !data ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground px-5 text-center">
            Could not load health explainer. Try again.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            <div className={`rounded-xl border bg-gradient-to-br ${scoreBgGradient(data.score)} p-5 text-center`}>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Overall Health Score</p>
              <p className={`text-6xl font-bold tabular-nums leading-none ${scoreColor(data.score)}`}>{data.score}</p>
              <p className="text-xs text-muted-foreground mt-1">/100</p>
              <span className={`inline-block mt-3 text-xs font-semibold px-3 py-1 rounded-full border ${
                data.score >= 80
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                  : data.score >= 60
                    ? "bg-amber-100 text-amber-700 border-amber-200"
                    : "bg-red-100 text-red-700 border-red-200"
              }`}>
                {scoreLabel(data.score)}
              </span>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Factor Breakdown</p>
              <div className="space-y-3">
                {data.factors.map((f, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <StatusIcon status={f.status} />
                        <span className="text-xs font-medium">{f.label}</span>
                      </div>
                      <span className={`text-xs font-bold tabular-nums ${factorValueColor(f.status)}`}>
                        {f.value}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${barColor(f.status)}`}
                        style={{ width: `${Math.min(f.value, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {data.reasons.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Top Risk Factors</p>
                <div className="space-y-2">
                  {data.reasons.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs bg-amber-50 rounded-lg p-2.5 border border-amber-100">
                      <AlertTriangle size={11} className="text-amber-500 mt-0.5 shrink-0" />
                      <span className="text-foreground/80 leading-snug">{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.recommendedActions.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recommended Actions</p>
                <div className="space-y-2">
                  {data.recommendedActions.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs bg-blue-50 rounded-lg p-2.5 border border-blue-100">
                      <Lightbulb size={11} className="text-blue-600 mt-0.5 shrink-0" />
                      <span className="text-foreground/80 leading-snug">{a}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </aside>
    </>
  );
}
