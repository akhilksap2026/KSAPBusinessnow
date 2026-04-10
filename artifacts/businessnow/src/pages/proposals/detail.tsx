import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  ArrowLeft, ChevronRight, FileText, DollarSign, CheckCircle2,
  Clock, Send, ThumbsUp, ThumbsDown, History, Layers, Plus,
} from "lucide-react";

const PRICING_MODEL_LABELS: Record<string, string> = {
  milestone: "Fixed Milestone",
  retainer: "Monthly Retainer",
  time_and_materials: "Time & Materials",
  blended: "Blended Fee",
};

const INTERNAL_STATE_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-slate-100 text-slate-700" },
  in_review: { label: "In Review", color: "bg-amber-100 text-amber-700" },
  approved: { label: "Approved", color: "bg-green-100 text-green-700" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700" },
};

const CLIENT_STATE_CONFIG: Record<string, { label: string; color: string }> = {
  not_sent: { label: "Not Sent", color: "bg-slate-100 text-slate-700" },
  sent: { label: "Sent to Client", color: "bg-blue-100 text-blue-700" },
  in_negotiation: { label: "In Negotiation", color: "bg-amber-100 text-amber-700" },
  accepted: { label: "Accepted ✓", color: "bg-green-100 text-green-700" },
  declined: { label: "Declined", color: "bg-red-100 text-red-700" },
};

export default function ProposalDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [proposal, setProposal] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    fetch(`/api/proposals/${id}`)
      .then((r) => r.json())
      .then((d) => { setProposal(d); setLoading(false); });
  };

  useEffect(() => { load(); }, [id]);

  async function updateInternalState(state: string) {
    await fetch(`/api/proposals/${id}/approve`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, approvedBy: "Current User" }),
    });
    toast({ title: `Proposal marked: ${state}` });
    load();
  }

  async function updateClientState(state: string) {
    await fetch(`/api/proposals/${id}/client-response`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });
    if (state === "accepted") {
      toast({ title: "Proposal accepted — opportunity marked Won", description: "Ready for handoff to delivery." });
    } else {
      toast({ title: `Client response: ${state}` });
    }
    load();
  }

  if (loading || !proposal) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  const opp = proposal.opportunity;
  const milestones: any[] = proposal.milestoneOutline || [];
  const pricing: any[] = proposal.pricingSummary || [];
  const addOns: any[] = proposal.addOns || [];
  const versions: any[] = proposal.versions || [];
  const intCfg = INTERNAL_STATE_CONFIG[proposal.internalApprovalState] || INTERNAL_STATE_CONFIG.draft;
  const cliCfg = CLIENT_STATE_CONFIG[proposal.clientAcceptanceState] || CLIENT_STATE_CONFIG.not_sent;

  const totalBase = pricing.reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const totalOptional = addOns.filter((a: any) => a.optional).reduce((s: number, a: any) => s + (a.amount || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/opportunities")} className="gap-1.5 h-7">
          <ArrowLeft className="h-3.5 w-3.5" /> Pipeline
        </Button>
        {opp && (
          <>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <button onClick={() => setLocation(`/opportunities/${opp.id}`)} className="text-muted-foreground hover:text-foreground transition-colors">
              {opp.name}
            </button>
          </>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="text-foreground font-medium">Proposal</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Main content */}
        <div className="space-y-5">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="capitalize">{proposal.proposalType?.replace("_", " ")}</Badge>
              <Badge className={`capitalize text-xs ${intCfg.color} border-0`}>{intCfg.label}</Badge>
              <Badge className={`capitalize text-xs ${cliCfg.color} border-0`}>{cliCfg.label}</Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight mt-2">{proposal.title}</h1>
            {opp && <p className="text-muted-foreground text-sm mt-0.5">{opp.accountName} · {opp.name}</p>}
          </div>

          {/* Scope summary */}
          {proposal.scopeSummary && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-500" /> Scope Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm">{proposal.scopeSummary}</p>
              </CardContent>
            </Card>
          )}

          {/* Milestone outline */}
          {milestones.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" /> Milestone Outline
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-2">
                  {milestones.map((ms: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                          {i + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{ms.name}</p>
                          <p className="text-xs text-muted-foreground">{ms.deliverable}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {ms.billableAmount && (
                          <p className="text-sm font-bold">${ms.billableAmount.toLocaleString()}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{ms.weeks}w</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pricing */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" /> Pricing Summary
                <Badge variant="secondary" className="ml-auto text-xs capitalize">
                  {PRICING_MODEL_LABELS[proposal.pricingModel] || proposal.pricingModel}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {pricing.length > 0 ? (
                <div className="space-y-2">
                  {pricing.map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div>
                        <span>{p.label}</span>
                        {p.notes && <span className="text-xs text-muted-foreground ml-2">({p.notes})</span>}
                      </div>
                      <span className="font-semibold">${p.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex items-center justify-between font-bold">
                    <span>Base Total</span>
                    <span className="text-lg">${totalBase.toLocaleString()}</span>
                  </div>
                </div>
              ) : proposal.totalValue ? (
                <div className="flex items-center justify-between font-bold text-lg">
                  <span>Total Value</span>
                  <span>${proposal.totalValue.toLocaleString()}</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No pricing details entered.</p>
              )}

              {addOns.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Add-ons & Options</p>
                  {addOns.map((a: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Plus className="h-3 w-3" />
                        <span>{a.name}</span>
                        {a.optional && <Badge variant="outline" className="text-[10px]">Optional</Badge>}
                      </div>
                      <span>+${a.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  {totalOptional > 0 && (
                    <p className="text-xs text-muted-foreground pt-1">
                      Optional add-ons: +${totalOptional.toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {proposal.effortEstimate && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Effort estimate: <strong className="text-foreground">{proposal.effortEstimate} hours</strong></span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Version history */}
          {versions.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" /> Version History
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {[...versions].reverse().map((v: any, i: number) => (
                  <div key={i} className="flex items-start justify-between text-sm py-1.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] shrink-0">v{v.version}</Badge>
                      <span>{v.summary}</span>
                    </div>
                    <div className="text-right shrink-0 text-xs text-muted-foreground">
                      <p>{v.authorName}</p>
                      <p>{format(new Date(v.createdAt), "MMM d")}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar — approval workflow */}
        <div className="space-y-4">
          {/* Internal approval */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Internal Approval</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className={`text-center py-2 rounded-lg text-sm font-medium ${intCfg.color}`}>
                {intCfg.label}
              </div>
              {proposal.internalApprovalState !== "approved" && (
                <div className="space-y-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs gap-1.5"
                    onClick={() => updateInternalState("in_review")}
                  >
                    Submit for Review
                  </Button>
                  <Button
                    size="sm"
                    className="w-full text-xs gap-1.5 bg-green-600 hover:bg-green-700"
                    onClick={() => updateInternalState("approved")}
                  >
                    <ThumbsUp className="h-3 w-3" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full text-xs gap-1.5"
                    onClick={() => updateInternalState("rejected")}
                  >
                    <ThumbsDown className="h-3 w-3" /> Reject
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Client acceptance */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Client Response</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className={`text-center py-2 rounded-lg text-sm font-medium ${cliCfg.color}`}>
                {cliCfg.label}
              </div>
              {proposal.clientAcceptanceState !== "accepted" && (
                <div className="space-y-1.5">
                  {proposal.clientAcceptanceState === "not_sent" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs gap-1.5"
                      onClick={() => updateClientState("sent")}
                      disabled={proposal.internalApprovalState !== "approved"}
                    >
                      <Send className="h-3 w-3" /> Mark as Sent
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs gap-1.5"
                    onClick={() => updateClientState("in_negotiation")}
                  >
                    In Negotiation
                  </Button>
                  <Button
                    size="sm"
                    className="w-full text-xs gap-1.5 bg-green-600 hover:bg-green-700"
                    onClick={() => updateClientState("accepted")}
                  >
                    <CheckCircle2 className="h-3 w-3" /> Client Accepted
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full text-xs gap-1.5"
                    onClick={() => updateClientState("declined")}
                  >
                    Client Declined
                  </Button>
                </div>
              )}
              {proposal.clientAcceptanceState === "accepted" && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Proposal accepted. Proceed to delivery handoff.
                  </p>
                  {opp && (
                    <Button
                      size="sm"
                      className="w-full text-xs bg-green-600 hover:bg-green-700"
                      onClick={() => setLocation(`/handoff/${opp.id}`)}
                    >
                      Begin Handoff →
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Meta */}
          <Card>
            <CardContent className="p-4 space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Version</span>
                <span className="font-medium text-foreground">v{proposal.currentVersion}</span>
              </div>
              {proposal.createdByName && (
                <div className="flex justify-between">
                  <span>Created by</span>
                  <span className="font-medium text-foreground">{proposal.createdByName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Created</span>
                <span>{format(new Date(proposal.createdAt), "MMM d, yyyy")}</span>
              </div>
              {proposal.sentAt && (
                <div className="flex justify-between">
                  <span>Sent</span>
                  <span>{format(new Date(proposal.sentAt), "MMM d, yyyy")}</span>
                </div>
              )}
              {proposal.acceptedAt && (
                <div className="flex justify-between">
                  <span>Accepted</span>
                  <span className="text-green-600 font-medium">{format(new Date(proposal.acceptedAt), "MMM d, yyyy")}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
