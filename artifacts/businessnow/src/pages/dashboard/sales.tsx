import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetPipelineDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Target, Users, Briefcase, BarChart2, ArrowRight,
  TrendingUp, Zap, CheckCircle2, AlertTriangle, RefreshCw, Handshake,
} from "lucide-react";
import { format } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

const API = "/api";

function fmt$(v: number | undefined | null) {
  if (!v) return "$0";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

function stageColor(stage: string) {
  const s = stage?.toLowerCase();
  if (s?.includes("won") || s?.includes("close")) return "text-emerald-600";
  if (s?.includes("negotiat") || s?.includes("proposal")) return "text-amber-600";
  return "text-muted-foreground";
}

export default function SalesDashboard() {
  const { data: dashboard, isLoading } = useGetPipelineDashboard();
  const [, setLocation] = useLocation();
  const [opps, setOpps] = useState<any[]>([]);
  const [oppsLoading, setOppsLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/opportunities`).then(r => r.json()).then(d => {
      setOpps(Array.isArray(d) ? d : []);
      setOppsLoading(false);
    }).catch(() => { setOpps([]); setOppsLoading(false); });
  }, []);

  if (isLoading || oppsLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-[360px]" />
          <Skeleton className="h-[360px]" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-[240px]" />
          <Skeleton className="h-[240px]" />
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  const nearCloseOpps = opps
    .filter(o => (o.probability || 0) >= 70 && o.stage !== "won" && o.stage !== "lost" && o.stage !== "closed")
    .sort((a, b) => (b.value || 0) - (a.value || 0));

  const proposalOpps = opps.filter(o => {
    const s = (o.stage || "").toLowerCase();
    return (s.includes("proposal") || s.includes("negotiat") || s.includes("discovery")) && o.stage !== "won";
  }).sort((a, b) => (b.value || 0) - (a.value || 0));

  const handoffQueue = opps.filter(o => o.stage === "won" && !o.handoffProjectId);

  const totalPipeline = dashboard.totalPipelineValue ?? 0;
  const highRisk = dashboard.staffingRiskByOpp.filter(r => r.risk === "high").length;
  const nearCloseValue = nearCloseOpps.reduce((s, o) => s + (o.value || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Pipeline</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Pipeline funnel · Proposal momentum · Deals ready to close · Delivery handoff
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setLocation("/opportunities")}>
          All Opportunities <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Pipeline", value: fmt$(totalPipeline),
            sub: `${opps.filter(o => o.stage !== "won" && o.stage !== "lost").length} active deals`,
            icon: BarChart2, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/20",
          },
          {
            label: "Near-Close (≥70%)", value: fmt$(nearCloseValue),
            sub: `${nearCloseOpps.length} deal${nearCloseOpps.length !== 1 ? "s" : ""} likely to close`,
            icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/20",
          },
          {
            label: "Proposals Active", value: dashboard.proposalsPending,
            sub: "In proposal or negotiation",
            icon: Target, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20",
          },
          {
            label: "Staffing Risk", value: highRisk,
            sub: `${dashboard.staffingRiskByOpp.length} opps assessed`,
            icon: Users, color: highRisk > 0 ? "text-red-500" : "text-muted-foreground",
            bg: highRisk > 0 ? "bg-red-50 dark:bg-red-950/20" : "bg-muted/30",
          },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <k.icon className={`h-3.5 w-3.5 ${k.color}`} />
              {k.label}
            </div>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Main 2-col: Pipeline Funnel | Near-Close Deals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Pipeline Funnel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-blue-500" /> Pipeline Funnel
            </CardTitle>
            <CardDescription>Value by stage across all active opportunities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboard.pipelineByStage} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `$${v / 1000}k`} />
                  <YAxis dataKey="stage" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} width={90} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))" }}
                    contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    formatter={(val: number) => [`$${val.toLocaleString()}`, "Value"]}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {dashboard.pipelineByStage.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(var(--primary) / ${0.4 + index * 0.12})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Near-Close Deals */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-emerald-500" /> Near-Close Deals
                  {nearCloseOpps.length > 0 && <Badge variant="secondary" className="text-[10px]">{nearCloseOpps.length}</Badge>}
                </CardTitle>
                <CardDescription className="mt-0.5">Probability ≥ 70% · not yet won</CardDescription>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setLocation("/opportunities")}>
                All <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[320px] pr-2">
              {nearCloseOpps.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">No near-close deals</div>
              ) : (
                <div className="space-y-2">
                  {nearCloseOpps.map(o => {
                    const risk = dashboard.staffingRiskByOpp.find(r => r.opportunityId === o.id);
                    return (
                      <div key={o.id} className="p-3 rounded-lg border bg-card hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => setLocation(`/opportunities/${o.id}`)}>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{o.name}</p>
                            <p className="text-xs text-muted-foreground">{o.accountName}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-emerald-600">{fmt$(o.value)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${stageColor(o.stage)} bg-background`}>{o.stage}</span>
                          <span className="text-xs text-muted-foreground">{o.probability}% probability</span>
                          {o.expectedStartDate && <span className="text-xs text-muted-foreground">Start: {format(new Date(o.expectedStartDate), "MMM d")}</span>}
                          {risk && (
                            <Badge variant={risk.risk === "high" ? "destructive" : "secondary"} className="text-[10px] capitalize">
                              {risk.risk} staffing risk
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Secondary row: Proposal Momentum | Delivery Handoff Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Proposal Momentum */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-amber-500" /> Proposal Momentum
                  {proposalOpps.length > 0 && <Badge variant="secondary" className="text-[10px]">{proposalOpps.length}</Badge>}
                </CardTitle>
                <CardDescription className="mt-0.5">Deals in discovery, proposal, or negotiation</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[220px] pr-2">
              {proposalOpps.length === 0 ? (
                <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">No active proposals</div>
              ) : (
                <div className="space-y-2">
                  {proposalOpps.slice(0, 8).map(o => (
                    <div key={o.id} className="flex items-center justify-between p-2.5 rounded border hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => setLocation(`/opportunities/${o.id}`)}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{o.name}</p>
                        <p className="text-[10px] text-muted-foreground">{o.accountName}</p>
                      </div>
                      <div className="text-right ml-3 shrink-0">
                        <p className="text-xs font-bold text-foreground">{fmt$(o.value)}</p>
                        <p className={`text-[10px] font-medium capitalize ${stageColor(o.stage)}`}>{o.stage}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Delivery Handoff Queue */}
        <Card className={handoffQueue.length > 0 ? "border-emerald-200 dark:border-emerald-900/50" : "border-border"}>
          <CardHeader className="pb-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Handshake className="h-4 w-4 text-emerald-600" /> Delivery Handoff Queue
                {handoffQueue.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">{handoffQueue.length}</Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-0.5">Won deals awaiting project creation — ready for PM handoff</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[220px] pr-2">
              {handoffQueue.length === 0 ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="text-sm text-muted-foreground">No won deals awaiting handoff</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {handoffQueue.map(o => (
                    <div key={o.id} className="flex items-center justify-between p-2.5 rounded border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/10 hover:bg-emerald-50 cursor-pointer transition-colors" onClick={() => setLocation(`/opportunities/${o.id}`)}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{o.name}</p>
                        <p className="text-[10px] text-muted-foreground">{o.accountName}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        <span className="text-xs font-bold text-emerald-600">{fmt$(o.value)}</span>
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">Ready</Badge>
                        <ArrowRight className="h-3 w-3 text-emerald-500" />
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-center text-muted-foreground pt-1">Click a deal to open and convert to project</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
