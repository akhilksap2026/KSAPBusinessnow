import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, AlertTriangle, FileText, ExternalLink, ArrowRight } from "lucide-react";

const API = "/api";

type Step = {
  key: keyof typeof STEP_META;
  label: string;
  description: string;
  required: boolean;
};

const STEP_META = {
  deliveryComplete: { label: "Delivery Complete", description: "All project deliverables have been completed and validated", required: true },
  clientSignOff: { label: "Client Sign-Off", description: "Client has formally approved and accepted the delivery", required: true },
  billingComplete: { label: "Billing Complete", description: "All invoices raised and outstanding balances cleared", required: true },
  changeOrdersReconciled: { label: "Change Orders Reconciled", description: "All change requests finalized, approved or rejected", required: true },
  documentationComplete: { label: "Documentation Complete", description: "All technical and project documentation submitted", required: false },
  handoverReady: { label: "Handover Ready", description: "AMS/support handover document prepared and reviewed", required: true },
  archived: { label: "Archive Project", description: "Project archived — status will be set to Completed", required: false },
} as const;

const STEPS: Step[] = Object.entries(STEP_META).map(([key, meta]) => ({ key: key as any, ...meta }));

export default function ClosurePage() {
  const params = useParams();
  const projectId = Number(params.id);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localChecklist, setLocalChecklist] = useState<Record<string, boolean>>({});

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/projects/${projectId}/closure`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLocalChecklist(d.checklist);
        setLoading(false);
      });
  }, [projectId]);

  useEffect(() => { if (projectId) load(); }, [load, projectId]);

  const toggle = async (key: string) => {
    const newValue = !localChecklist[key];
    const updated = { ...localChecklist, [key]: newValue };
    setLocalChecklist(updated);
    setSaving(true);
    await fetch(`${API}/projects/${projectId}/closure`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: newValue }),
    });
    setSaving(false);
  };

  if (loading || !data) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const { checklist, context } = data;
  const { project, milestones, changeRequests, invoices, suggestions, handoverExists, handoverId } = context;

  const completed = STEPS.filter(s => localChecklist[s.key]).length;
  const requiredCompleted = STEPS.filter(s => s.required && localChecklist[s.key]).length;
  const requiredTotal = STEPS.filter(s => s.required).length;
  const pct = Math.round((completed / STEPS.length) * 100);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground/70">
            <Link href="/projects" className="hover:text-foreground/70">Projects</Link>
            <span>/</span>
            <Link href={`/projects/${projectId}`} className="hover:text-foreground/70">{project.name}</Link>
            <span>/</span>
            <span className="text-foreground">Closure Workflow</span>
          </div>
          <div className="flex gap-2">
            {handoverExists ? (
              <Link href={`/handover/${projectId}`}>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                  <FileText className="h-4 w-4 mr-1.5" />View Handover
                </Button>
              </Link>
            ) : (
              <Link href={`/handover/${projectId}`}>
                <Button size="sm" variant="outline" className="border-border">
                  <FileText className="h-4 w-4 mr-1.5" />Create Handover
                </Button>
              </Link>
            )}
            {saving && <span className="text-xs text-muted-foreground/70 self-center">Saving…</span>}
          </div>
        </div>

        <div className="mt-4">
          <h1 className="text-xl font-bold text-foreground">{project.name} — Closure</h1>
          <p className="text-xs text-muted-foreground/70 mt-0.5">{project.accountName} · End date: {project.endDate || "—"}</p>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground/70">Closure Progress</span>
              <span className="text-xs text-muted-foreground">{completed}/{STEPS.length} steps · {requiredCompleted}/{requiredTotal} required</span>
            </div>
            <Progress value={pct} className="h-2 bg-muted" />
          </div>
          <div className={`text-2xl font-black ${pct === 100 ? "text-emerald-400" : pct >= 70 ? "text-amber-400" : "text-foreground/70"}`}>{pct}%</div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-3 gap-6 max-w-[1400px] mx-auto">
        {/* Checklist */}
        <div className="col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Closure Steps</h2>
          {STEPS.map(step => {
            const done = !!localChecklist[step.key];
            return (
              <button
                key={step.key}
                onClick={() => toggle(step.key)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${done ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-card hover:border-border"}`}
              >
                <div className="flex items-start gap-3">
                  {done
                    ? <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
                    : <Circle className="h-5 w-5 text-muted-foreground/60 mt-0.5 shrink-0" />}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium ${done ? "text-emerald-600" : "text-foreground"}`}>{step.label}</p>
                      {step.required && !done && <span className="text-[10px] text-red-400 border border-red-500/30 rounded-full px-1.5">Required</span>}
                      {done && checklist[`${step.key}At`] && <span className="text-xs text-muted-foreground/70">{checklist[`${step.key}At`]}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">{step.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Context Panel */}
        <div className="space-y-4">
          {/* Suggestions */}
          {suggestions.length > 0 && (
            <Card className="bg-amber-500/5 border-amber-500/20">
              <CardHeader className="pb-2"><CardTitle className="text-xs text-amber-400 uppercase tracking-wide flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" />Blockers to Closure</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {suggestions.map((s: string, i: number) => (
                  <p key={i} className="text-xs text-amber-600 flex items-start gap-1.5">
                    <span className="text-amber-600 mt-0.5">·</span>{s}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Milestone Status */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Milestones</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground/70">Completed</span>
                <span className="text-foreground font-medium">{milestones.completed}/{milestones.total}</span>
              </div>
              {milestones.overdue > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-red-400">
                  <AlertTriangle className="h-3 w-3" />{milestones.overdue} still overdue
                </div>
              )}
              <Progress value={milestones.total > 0 ? (milestones.completed / milestones.total) * 100 : 0} className="h-1.5 bg-muted" />
            </CardContent>
          </Card>

          {/* Change Orders */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Change Orders</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground/70">Total</span><span className="text-foreground">{changeRequests.total}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground/70">Approved</span><span className="text-emerald-400">{changeRequests.approved}</span></div>
              {changeRequests.open > 0 && <div className="flex justify-between"><span className="text-muted-foreground/70">Still Open</span><span className="text-red-400">{changeRequests.open}</span></div>}
            </CardContent>
          </Card>

          {/* Invoices */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Invoices</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground/70">Total</span><span className="text-foreground">{invoices.total}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground/70">Outstanding</span><span className={invoices.unpaid > 0 ? "text-amber-400" : "text-muted-foreground"}>{invoices.unpaid}</span></div>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card className="bg-card border-border">
            <CardContent className="pt-4 space-y-2">
              <Link href={`/projects/${projectId}`}>
                <Button size="sm" variant="ghost" className="w-full justify-between text-muted-foreground h-8">
                  Project Detail <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <Link href={`/handover/${projectId}`}>
                <Button size="sm" variant="ghost" className="w-full justify-between text-muted-foreground h-8">
                  {handoverExists ? "View Handover Doc" : "Create Handover Doc"} <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
