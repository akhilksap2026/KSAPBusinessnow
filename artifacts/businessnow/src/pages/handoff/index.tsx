import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useAuthRole, hasPermission } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, ChevronRight, CheckCircle2, ArrowRight,
  Building2, Layers, DollarSign, Users, AlertTriangle,
  FileText, Calendar, Zap,
} from "lucide-react";

type HandoffSection = { icon: any; label: string; value: any; type?: string };

function CheckRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm">{label}</span>
      {value ? (
        <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
          <CheckCircle2 className="h-3.5 w-3.5" /> Carried over
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
    </div>
  );
}

export default function HandoffPage() {
  const { opportunityId } = useParams<{ opportunityId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { role } = useAuthRole();
  const canExecute = hasPermission(role, "executeHandoff");
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [done, setDone] = useState(false);
  const [createdProject, setCreatedProject] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/handoff/${opportunityId}`)
      .then((r) => r.json())
      .then((d) => { setPreview(d); setLoading(false); if (d.alreadyHandedOff) setDone(true); });
  }, [opportunityId]);

  async function executeHandoff() {
    setExecuting(true);
    try {
      const r = await fetch(`/api/handoff/${opportunityId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handoffBy: "Current User" }),
      });
      const d = await r.json();
      if (r.ok) {
        setCreatedProject(d.project);
        setDone(true);
        toast({
          title: "Handoff complete!",
          description: `Project "${d.project.name}" is now live with ${d.milestonesCreated} milestone(s).`,
        });
      } else {
        toast({ title: "Handoff failed", description: d.error, variant: "destructive" });
      }
    } finally {
      setExecuting(false);
    }
  }

  if (loading || !preview) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  const opp = preview.opportunity;
  const proposal = preview.acceptedProposal;
  const carry = preview.willCarryOver;
  const milestones: any[] = carry.milestoneOutline || [];

  return (
    <div className="p-6 space-y-6 max-w-[900px] mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Button variant="ghost" size="sm" onClick={() => setLocation(`/opportunities/${opportunityId}`)} className="gap-1.5 h-7">
          <ArrowLeft className="h-3.5 w-3.5" /> {opp.name}
        </Button>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="text-foreground font-medium">Delivery Handoff</span>
      </div>

      {/* Status banner */}
      {done ? (
        <Card className="border-green-400 dark:border-green-700 bg-green-50 dark:bg-green-950/30">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-green-700 dark:text-green-400">Handoff Complete</h2>
              <p className="text-sm text-green-600 dark:text-green-500 mt-0.5">
                All scope, milestones, and pricing have been carried into delivery. No re-entry required.
              </p>
            </div>
            <div className="ml-auto">
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => setLocation(`/projects/${createdProject?.id || preview.handoffProjectId}`)}
              >
                Open Project <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Delivery Handoff</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Review what will be carried over from pre-sales into a live delivery project. No data re-entry required.
          </p>
        </div>
      )}

      {/* Opportunity summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" /> Pre-Sales Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Client</p>
              <p className="font-semibold">{opp.accountName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Project Type</p>
              <p className="font-semibold capitalize">{opp.type?.replace("_", " ")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Value</p>
              <p className="font-semibold">{carry.pricingBaseline ? `$${carry.pricingBaseline.toLocaleString()}` : "TBD"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Stage</p>
              <Badge variant="outline" className="capitalize text-xs">{opp.stage}</Badge>
            </div>
          </div>
          {proposal && (
            <div className="flex items-center gap-2 text-sm pt-1 text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              <span>Based on proposal: <strong className="text-foreground">{proposal.title}</strong></span>
              <Badge variant="secondary" className="text-[10px]">{proposal.clientAcceptanceState}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* What carries over */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-blue-500" /> What Carries Over
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <CheckRow label="Account & client name" value={!!carry.accountName} />
          <CheckRow label="Project type & service line tags" value={!!carry.projectType} />
          <CheckRow label="Scope summary" value={!!carry.scopeSummary} />
          <CheckRow label="Milestone outline" value={milestones.length > 0} />
          <CheckRow label="Pricing baseline / budget" value={!!carry.pricingBaseline} />
          <CheckRow label="Required roles & skills" value={!!(carry.requiredRoles && carry.requiredRoles.length > 0)} />
          <CheckRow label="Risks & dependencies" value={!!(carry.risks && carry.risks.length > 0)} />
          <CheckRow label="Proposal assumptions" value={!!carry.assumptions} />
          <CheckRow label="Stakeholder list" value={!!(carry.stakeholders && carry.stakeholders.length > 0)} />
        </CardContent>
      </Card>

      {/* Milestone preview */}
      {milestones.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" /> Milestones to Create ({milestones.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {milestones.map((ms: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                    <div>
                      <p className="font-medium">{ms.name}</p>
                      <p className="text-xs text-muted-foreground">{ms.deliverable}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {ms.billableAmount && <p className="font-bold">${ms.billableAmount.toLocaleString()}</p>}
                    <p className="text-xs text-muted-foreground">{ms.weeks}w</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Required roles */}
      {carry.requiredRoles && carry.requiredRoles.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-violet-500" /> Required Roles / Placeholders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {carry.requiredRoles.map((r: string) => (
                <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Resource Manager will be prompted to review these allocations after handoff.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Execute handoff */}
      {!done && (
        <Card className={canExecute ? "border-primary/20" : "border-border"}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Ready to hand off to delivery?</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  This will create a live project and {milestones.length} milestone(s). The opportunity will be marked Won.
                </p>
              </div>
              {canExecute ? (
                <Button
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 gap-2 ml-6 shrink-0"
                  disabled={executing}
                  onClick={executeHandoff}
                >
                  {executing ? "Creating project..." : "Execute Handoff"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <span className="ml-6 shrink-0 text-xs text-muted-foreground flex items-center gap-1.5 border border-border rounded-lg px-4 py-2">
                  <span className="opacity-60">🔒</span> Delivery Director or Sales can execute
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
