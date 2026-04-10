import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrendingUp, Users, AlertTriangle, CheckCircle2, Star,
  Calendar, RefreshCw, PlusCircle, ArrowRight, Building2,
  DollarSign, Briefcase, ShieldAlert,
} from "lucide-react";
import { format } from "date-fns";

const API = "/api";

function fmt(v: number) {
  if (!v) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

function healthColor(score: number) {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-amber-500";
  return "text-red-500";
}

function healthBg(score: number) {
  if (score >= 80) return "bg-green-100 text-green-700 border-green-300";
  if (score >= 60) return "bg-amber-100 text-amber-700 border-amber-300";
  return "bg-red-100 text-red-700 border-red-300";
}

function healthLabel(score: number) {
  if (score >= 80) return "Healthy";
  if (score >= 60) return "At Risk";
  return "Critical";
}

export default function AMDashboard() {
  const [, setLocation] = useLocation();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [signals, setSignals] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [accs, sigs, projs] = await Promise.all([
      fetch(`${API}/accounts`).then(r => r.json()).catch(() => []),
      fetch(`${API}/renewal-signals`).then(r => r.json()).catch(() => []),
      fetch(`${API}/projects`).then(r => r.json()).catch(() => []),
    ]);
    setAccounts(Array.isArray(accs) ? accs : []);
    setSignals(Array.isArray(sigs) ? sigs : []);
    setProjects(Array.isArray(projs) ? projs : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}</div>
        <div className="grid grid-cols-[1fr_360px] gap-6">
          <Skeleton className="h-[420px]" />
          <Skeleton className="h-[420px]" />
        </div>
        <Skeleton className="h-[220px]" />
      </div>
    );
  }

  const atRisk = accounts.filter(a => (a.healthScore || 0) < 60);
  const openSignals = signals.filter(s => s.status === "open");
  const criticalSignals = signals.filter(s => s.priority === "critical" && s.status === "open");
  const totalArr = accounts.reduce((s: number, a: any) => s + (a.annualRevenue || 0), 0);

  // Project concerns: at-risk or overdue projects, grouped by account
  const concernProjects = projects.filter(p => (p.healthScore ?? 100) < 70 || p.status === "at_risk");
  const concernsByAccount: Record<string, { account: any; projects: any[] }> = {};
  concernProjects.forEach(p => {
    const acct = accounts.find(a => a.id === p.accountId) || { id: p.accountId, name: p.accountName || "Unknown Account" };
    const key = acct.id || acct.name;
    if (!concernsByAccount[key]) concernsByAccount[key] = { account: acct, projects: [] };
    concernsByAccount[key].projects.push(p);
  });
  const concernAccountList = Object.values(concernsByAccount).sort((a, b) => b.projects.length - a.projects.length);

  const metrics = [
    { label: "Accounts Managed", value: accounts.length, icon: Building2, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/20" },
    { label: "At-Risk Accounts", value: atRisk.length, icon: AlertTriangle, color: atRisk.length > 0 ? "text-red-500" : "text-muted-foreground", bg: atRisk.length > 0 ? "bg-red-50 dark:bg-red-950/20" : "bg-muted/30" },
    { label: "Open Renewal Signals", value: openSignals.length, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
    { label: "Total ARR", value: fmt(totalArr), icon: Star, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950/20" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Account Management</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Account health · Renewal signals · Revenue status · Project concerns</p>
        </div>
        <Button size="sm" variant="outline" onClick={load} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map(m => (
          <div key={m.label} className={`rounded-xl border p-4 ${m.bg}`}>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
              <m.icon className={`h-3.5 w-3.5 ${m.color}`} />
              {m.label}
            </div>
            <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Main 2-col: Account Health | Renewal Signals + Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">

        {/* Account Health Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" /> Account Health
                </CardTitle>
                <CardDescription className="mt-0.5">Health score, industry, and tier</CardDescription>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setLocation("/accounts")}>
                All Accounts <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[380px] pr-2">
              <div className="space-y-1.5">
                {accounts.slice(0, 15).map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border hover:border-primary/30 hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => setLocation(`/accounts/${a.id}`)}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                        {a.name?.[0] || "?"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{a.name}</p>
                          {a.tier && <Badge variant="outline" className="text-[10px] capitalize shrink-0">{a.tier}</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 capitalize">{a.industry || "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4 shrink-0">
                      <div className="text-right hidden sm:block">
                        <div className={`text-sm font-bold ${healthColor(a.healthScore || 0)}`}>{a.healthScore || 0}</div>
                        <div className="w-16 mt-1">
                          <Progress value={a.healthScore || 0} className="h-1" />
                        </div>
                      </div>
                      <Badge className={`text-[10px] border ${healthBg(a.healthScore || 0)}`}>
                        {healthLabel(a.healthScore || 0)}
                      </Badge>
                    </div>
                  </div>
                ))}
                {accounts.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No accounts found.</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-4">

          {/* Renewal Signals */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" /> Renewal Signals
                  {criticalSignals.length > 0 && (
                    <Badge variant="destructive" className="text-[10px]">{criticalSignals.length} critical</Badge>
                  )}
                </CardTitle>
                <Button size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={() => setLocation("/renewal-signals")}>
                  All <ArrowRight className="h-2.5 w-2.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {openSignals.slice(0, 5).map((s: any) => (
                  <div key={s.id} className="p-2.5 rounded-lg border text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-xs">{s.accountName}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{s.signalType?.replace("_", " ")}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold">{fmt(s.estimatedValue)}</p>
                        <Badge variant={s.priority === "critical" ? "destructive" : "secondary"} className="text-[10px]">{s.priority}</Badge>
                      </div>
                    </div>
                    {s.renewalDate && (
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                        <Calendar className="h-2.5 w-2.5" />
                        Renewal: {format(new Date(s.renewalDate), "MMM d, yyyy")}
                      </div>
                    )}
                    <Button size="sm" variant="outline" className="h-5 text-[10px] mt-2 gap-1 w-full" onClick={() => setLocation(`/opportunities/new?signalId=${s.id}&accountId=${s.accountId}`)}>
                      <PlusCircle className="h-2.5 w-2.5" /> Create Opportunity
                    </Button>
                  </div>
                ))}
                {openSignals.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No open renewal signals</p>}
              </div>
            </CardContent>
          </Card>

          {/* Revenue Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-violet-500" /> Revenue Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {accounts.slice(0, 6).map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between cursor-pointer hover:bg-muted/30 rounded p-1 transition-colors" onClick={() => setLocation(`/accounts/${a.id}`)}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${(a.healthScore || 0) >= 80 ? "bg-emerald-500" : (a.healthScore || 0) >= 60 ? "bg-amber-400" : "bg-red-500"}`} />
                      <span className="text-xs text-muted-foreground truncate">{a.name}</span>
                    </div>
                    <span className="text-xs font-semibold shrink-0 ml-2">{fmt(a.annualRevenue || a.annualContractValue)}</span>
                  </div>
                ))}
                {accounts.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No revenue data</p>}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Project Concerns by Account */}
      {concernAccountList.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-900/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                  Project Concerns by Account
                  <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">{concernProjects.length} project{concernProjects.length !== 1 ? "s" : ""}</Badge>
                </CardTitle>
                <CardDescription className="mt-0.5">At-risk or below-health-threshold projects grouped by account — requires AM attention</CardDescription>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setLocation("/projects")}>
                All Projects <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {concernAccountList.slice(0, 6).map(({ account, projects: acctProjects }) => (
                <div key={account.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">
                      {account.name?.[0] || "?"}
                    </div>
                    <button className="text-sm font-semibold text-left hover:text-primary transition-colors truncate" onClick={() => setLocation(`/accounts/${account.id}`)}>
                      {account.name}
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {acctProjects.map((p: any) => (
                      <button key={p.id} className="w-full flex items-center justify-between p-2 rounded bg-muted/40 hover:bg-muted/70 transition-colors text-left" onClick={() => setLocation(`/projects/${p.id}/command`)}>
                        <div className="flex items-center gap-2 min-w-0">
                          <Briefcase className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-xs font-medium truncate">{p.name}</span>
                        </div>
                        <span className={`text-xs font-bold ml-2 shrink-0 ${(p.healthScore ?? 100) < 50 ? "text-red-500" : "text-amber-500"}`}>
                          {p.healthScore ?? "—"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* At-risk quick view (standalone if no project concerns) */}
      {concernAccountList.length === 0 && atRisk.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" /> At-Risk Accounts ({atRisk.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {atRisk.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between p-2 rounded hover:bg-red-50 cursor-pointer transition-colors" onClick={() => setLocation(`/accounts/${a.id}`)}>
                  <span className="font-medium text-sm truncate">{a.name}</span>
                  <span className="text-red-600 font-bold text-xs shrink-0 ml-2">{a.healthScore || 0}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
