import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, DollarSign, Calendar, ExternalLink, RefreshCw, CheckCircle, XCircle, Plus } from "lucide-react";
const API = "/api";

function fmt(v: number) {
  if (!v) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

function SeverityIcon({ s }: { s: string }) {
  return s === "critical" ? <XCircle className="h-4 w-4 text-red-400 shrink-0" />
    : s === "high" ? <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0" />
    : <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />;
}


export default function AccountDetail() {
  const params = useParams();
  const accountId = Number(params.id);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch(`${API}/accounts/${accountId}/health`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { if (accountId) load(); }, [accountId]);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!data || !data.account) return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <p className="text-muted-foreground/70">Account not found.</p>
    </div>
  );

  const { account, healthScore, healthReasons, projects, avgProjectHealth, overdueMilestones, clientActions, upcomingGoLives, invoiceSummary, csatAvg, changeRequests } = data;

  const healthColor = healthScore >= 80 ? "text-emerald-400" : healthScore >= 65 ? "text-amber-400" : "text-red-400";
  const healthBg = healthScore >= 80 ? "bg-emerald-500" : healthScore >= 65 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-5">
        <div className="flex items-start justify-between max-w-[1600px] mx-auto">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/accounts" className="text-muted-foreground/70 text-sm hover:text-foreground/70">Accounts</Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-foreground font-semibold">{account.name}</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">{account.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{account.industry || "—"} · {account.region || "—"} · OTM {account.otmVersion || "—"}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center px-4 py-2 bg-muted rounded-xl">
              <p className={`text-4xl font-black ${healthColor}`}>{healthScore}</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">Health Score</p>
            </div>
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={load}>
              <RefreshCw className="h-4 w-4 mr-1.5" />Refresh
            </Button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-6 gap-3 mt-4 max-w-[1600px] mx-auto">
          {[
            { label: "ACV", value: fmt(account.annualContractValue), color: "text-foreground" },
            { label: "Avg Project Health", value: `${avgProjectHealth}/100`, color: avgProjectHealth >= 80 ? "text-emerald-400" : avgProjectHealth >= 65 ? "text-amber-400" : "text-red-400" },
            { label: "CSAT", value: csatAvg ? `${csatAvg}/5.0` : "—", color: csatAvg && csatAvg >= 4 ? "text-emerald-400" : csatAvg && csatAvg >= 3 ? "text-amber-400" : "text-red-400" },
            { label: "Total Billed", value: fmt(invoiceSummary.total), color: "text-foreground" },
            { label: "Outstanding", value: fmt(invoiceSummary.outstanding), color: invoiceSummary.outstanding > 0 ? "text-amber-400" : "text-muted-foreground" },
            { label: "Overdue Items", value: String(invoiceSummary.overdueCount + overdueMilestones.length), color: (invoiceSummary.overdueCount + overdueMilestones.length) > 0 ? "text-red-400" : "text-muted-foreground" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-muted/50 rounded-lg px-3 py-2.5">
              <p className="text-xs text-muted-foreground/70">{label}</p>
              <p className={`text-sm font-bold ${color} mt-0.5`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 max-w-[1600px] mx-auto">
        <Tabs defaultValue="health">
          <TabsList className="bg-card border border-border mb-6">
            <TabsTrigger value="health" className="data-[state=active]:bg-muted">Health Analysis</TabsTrigger>
            <TabsTrigger value="projects" className="data-[state=active]:bg-muted">
              Projects ({projects.length})
              {projects.some((p: any) => p.healthScore < 65) && <span className="ml-1.5 w-2 h-2 bg-red-400 rounded-full inline-block" />}
            </TabsTrigger>
            <TabsTrigger value="changes" className="data-[state=active]:bg-muted">
              Change Orders ({changeRequests.length})
            </TabsTrigger>
            <TabsTrigger value="info" className="data-[state=active]:bg-muted">Account Info</TabsTrigger>
          </TabsList>

          {/* Health Tab */}
          <TabsContent value="health">
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 space-y-4">
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-foreground">Health Score Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-4">
                      <div className={`text-5xl font-black ${healthColor}`}>{healthScore}</div>
                      <div className="flex-1">
                        <div className="bg-muted rounded-full h-3 overflow-hidden">
                          <div className={`${healthBg} h-3 rounded-full transition-all`} style={{ width: `${healthScore}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground/70 mt-1">Base 100 — deductions applied for risk factors</p>
                      </div>
                    </div>

                    {healthReasons.length === 0 ? (
                      <div className="text-center py-6">
                        <CheckCircle className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                        <p className="text-emerald-400 font-medium">Excellent Account Health</p>
                        <p className="text-muted-foreground/70 text-sm">No risk factors detected</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {healthReasons.map((r: any, i: number) => (
                          <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${r.severity === "critical" ? "border-red-500/30 bg-red-500/5" : r.severity === "high" ? "border-orange-500/30 bg-orange-500/5" : "border-amber-500/20 bg-amber-500/5"}`}>
                            <SeverityIcon s={r.severity} />
                            <div className="flex-1">
                              <p className="text-sm text-foreground">{r.detail}</p>
                              <p className="text-xs text-muted-foreground/70 capitalize mt-0.5">{r.type.replace(/_/g, " ")}</p>
                            </div>
                            <span className="text-xs font-semibold text-red-400">−{r.deduction}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {overdueMilestones.length > 0 && (
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-foreground">Overdue Milestones</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {overdueMilestones.map((m: any) => (
                        <div key={m.id} className="flex items-center justify-between text-sm p-2 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                          <span className="text-foreground">{m.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-amber-400 text-xs">{m.dueDate}</span>
                            <Link href={`/projects/${m.projectId}`}><ExternalLink className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-foreground/70" /></Link>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="space-y-4">
                {/* Upcoming Go-Lives */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-foreground">Upcoming Go-Lives</CardTitle></CardHeader>
                  <CardContent>
                    {upcomingGoLives.length === 0 ? <p className="text-muted-foreground/70 text-sm">None in 90 days</p> : upcomingGoLives.map((p: any) => (
                      <div key={p.id} className="flex justify-between text-sm py-2 border-b border-border last:border-0">
                        <span className="text-foreground">{p.name}</span>
                        <span className="text-amber-400 text-xs">{p.goLiveDate}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Invoice Summary */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-foreground">Invoice Summary</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {[
                      { label: "Total Billed", value: fmt(invoiceSummary.total), color: "text-foreground" },
                      { label: "Collected", value: fmt(invoiceSummary.paid), color: "text-emerald-400" },
                      { label: "Outstanding", value: fmt(invoiceSummary.outstanding), color: invoiceSummary.outstanding > 0 ? "text-amber-400" : "text-muted-foreground" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex justify-between text-sm">
                        <span className="text-muted-foreground/70">{label}</span>
                        <span className={`font-medium ${color}`}>{value}</span>
                      </div>
                    ))}
                    {invoiceSummary.overdueCount > 0 && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400 bg-red-50 px-2 py-1.5 rounded">
                        <AlertTriangle className="h-3 w-3" />{invoiceSummary.overdueCount} overdue
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Client Actions */}
                {clientActions.length > 0 && (
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-foreground">Pending Client Actions</CardTitle></CardHeader>
                    <CardContent className="space-y-1.5">
                      {clientActions.slice(0, 4).map((t: any) => (
                        <div key={t.id} className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${t.priority === "high" ? "bg-red-400" : "bg-amber-400"}`} />
                          {t.title}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects">
            <Card className="bg-card border-border">
              <CardContent className="p-0">
                {projects.length === 0 ? (
                  <p className="text-muted-foreground/70 text-sm p-6">No projects for this account</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="text-left p-4">Project</th>
                      <th className="text-left p-4">Type</th>
                      <th className="text-left p-4">Phase</th>
                      <th className="text-center p-4">Progress</th>
                      <th className="text-left p-4 w-36">Health</th>
                      <th className="text-right p-4">Budget</th>
                      <th className="text-right p-4">Billed</th>
                      <th className="text-left p-4">Status</th>
                      <th className="p-4" />
                    </tr></thead>
                    <tbody className="divide-y divide-border">
                      {projects.map((p: any) => (
                        <tr key={p.id} className="hover:bg-muted/30">
                          <td className="p-4 font-medium text-foreground">{p.name}</td>
                          <td className="p-4 text-muted-foreground capitalize text-xs">{p.type}</td>
                          <td className="p-4 text-muted-foreground/70 text-xs">{p.currentPhase || "—"}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Progress value={p.completionPct || 0} className="h-1.5 w-16 bg-muted" />
                              <span className="text-xs text-muted-foreground/70">{p.completionPct || 0}%</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-muted rounded-full h-1.5 w-16">
                                <div className={`${(p.healthScore||75) >= 80 ? "bg-emerald-500" : (p.healthScore||75) >= 65 ? "bg-amber-500" : "bg-red-500"} h-1.5 rounded-full`} style={{ width: `${p.healthScore || 75}%` }} />
                              </div>
                              <span className={`text-xs font-bold ${(p.healthScore||75) >= 80 ? "text-emerald-400" : (p.healthScore||75) >= 65 ? "text-amber-400" : "text-red-400"}`}>{p.healthScore || 75}</span>
                            </div>
                          </td>
                          <td className="p-4 text-right text-foreground/70">{fmt(p.budgetValue)}</td>
                          <td className="p-4 text-right text-emerald-400">{fmt(p.billedValue)}</td>
                          <td className="p-4">
                            <Badge variant="secondary" className="text-xs capitalize">{p.status}</Badge>
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              <Link href={`/projects/${p.id}`}><ExternalLink className="h-4 w-4 text-muted-foreground/60 hover:text-foreground/70" /></Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Change Orders Tab */}
          <TabsContent value="changes">
            <Card className="bg-card border-border">
              <CardContent className="p-0">
                {changeRequests.length === 0 ? (
                  <p className="text-muted-foreground/70 text-sm p-6">No change orders for this account</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="text-left p-4">Change Order</th>
                      <th className="text-center p-4">Status</th>
                      <th className="text-right p-4">Impact Cost</th>
                      <th className="text-center p-4">Leakage Risk</th>
                    </tr></thead>
                    <tbody className="divide-y divide-border">
                      {changeRequests.map((cr: any) => (
                        <tr key={cr.id} className="hover:bg-muted/30">
                          <td className="p-4 text-foreground">{cr.title}</td>
                          <td className="p-4 text-center"><Badge variant="secondary" className="text-xs capitalize">{cr.status.replace(/_/g, " ")}</Badge></td>
                          <td className="p-4 text-right text-foreground/70">{fmt(cr.impactCost)}</td>
                          <td className="p-4 text-center">
                            {cr.deliveredBeforeApproval
                              ? <span className="text-xs text-red-400 flex items-center justify-center gap-1"><AlertTriangle className="h-3 w-3" />Yes</span>
                              : <span className="text-xs text-muted-foreground/60">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="info">
            <div className="grid grid-cols-2 gap-6">
              <Card className="bg-card border-border">
                <CardHeader><CardTitle className="text-sm text-foreground">Account Details</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {[
                    ["Segment", (account.segment || "—").replace(/_/g, " ")],
                    ["Industry", account.industry || "—"],
                    ["Region", account.region || "—"],
                    ["Status", account.status || "—"],
                    ["Annual Contract Value", fmt(account.annualContractValue || 0)],
                    ["Renewal Date", account.renewalDate || "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-muted-foreground/70">{label}</span>
                      <span className="text-foreground font-medium capitalize">{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardHeader><CardTitle className="text-sm text-foreground">Technical Environment</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {[
                    ["OTM Version", account.otmVersion || "—"],
                    ["Deployment", account.cloudDeployment ? "Oracle Cloud" : "On-Premise"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-muted-foreground/70">{label}</span>
                      <span className="text-foreground font-medium">{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
