import { useState } from "react";
import { RefreshCw, Sparkles, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AiSummary {
  title: string;
  summary: string;
  bullets: string[];
  risks: string[];
  recommendedActions: string[];
  generatedAt: string;
}

interface AiSummaryCardProps {
  endpoint: string;
  label?: string;
}

export function AiSummaryCard({ endpoint, label = "AI Summary" }: AiSummaryCardProps) {
  const [data, setData] = useState<AiSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState(false);

  const generate = () => {
    setLoading(true);
    setError(false);
    fetch(endpoint)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); setExpanded(true); })
      .catch(() => { setError(true); setLoading(false); });
  };

  const fmtTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    } catch { return iso; }
  };

  if (!data && !loading) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-4 w-4 text-primary/60" />
          <div>
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">Generate a narrative summary from live project data</p>
          </div>
        </div>
        <Button size="sm" onClick={generate} className="gap-1.5 shrink-0">
          <Sparkles className="h-3.5 w-3.5" />
          Generate
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-muted/10 px-5 py-4 flex items-center gap-3">
        <RefreshCw className="h-4 w-4 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Generating summary from live data…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 flex items-center justify-between gap-4">
        <p className="text-sm text-destructive">Failed to generate summary. Please try again.</p>
        <Button size="sm" variant="outline" onClick={generate} className="gap-1.5 shrink-0">
          <RefreshCw className="h-3.5 w-3.5" />Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const hasRisks = data.risks.length > 0 && data.risks[0] !== "No significant risks detected — project is progressing to plan" && !data.risks[0].startsWith("No significant");
  const riskFree = !hasRisks;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
          <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-px font-medium">Generated</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/60">Last generated: {fmtTime(data.generatedAt)}</span>
          <Button size="sm" variant="ghost" className="h-6 px-2 gap-1 text-xs text-muted-foreground" onClick={generate}>
            <RefreshCw className="h-3 w-3" />Refresh
          </Button>
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground transition-colors">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-5 space-y-4">
          {/* Title + Summary */}
          <div>
            <h3 className="text-sm font-bold text-foreground mb-1.5">{data.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{data.summary}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Highlights */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Highlights</p>
              <ul className="space-y-1.5">
                {data.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            {/* Risks */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                {riskFree ? <CheckCircle className="h-3 w-3 text-emerald-500" /> : <AlertTriangle className="h-3 w-3 text-amber-500" />}
                Risks
              </p>
              <ul className="space-y-1.5">
                {data.risks.map((r, i) => (
                  <li key={i} className={`flex items-start gap-2 text-xs ${riskFree ? "text-emerald-600" : "text-amber-700"}`}>
                    <span className={`mt-0.5 h-1.5 w-1.5 rounded-full shrink-0 ${riskFree ? "bg-emerald-400" : "bg-amber-400"}`} />
                    {r}
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommended Actions */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-blue-500" />
                Recommended Actions
              </p>
              <ul className="space-y-1.5">
                {data.recommendedActions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
