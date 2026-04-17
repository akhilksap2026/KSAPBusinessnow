import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuthRole } from "@/lib/auth";
import {
  Target, Building2, ExternalLink, Lock, Mail, Linkedin,
  ArrowRight, RefreshCw, Calendar, TrendingUp, User,
} from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";
const AUTHORIZED_ROLES = ["account_manager", "delivery_director", "admin"];

const STATUS_BADGE: Record<string, string> = {
  active:    "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  qualified: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  converted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  dead:      "bg-muted text-muted-foreground",
};
const SENTIMENT_BADGE: Record<string, string> = {
  positive: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  neutral:  "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  negative: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
};
const STAGE_LABELS: Record<string, string> = {
  lead: "Lead", qualified: "Qualified", discovery: "Discovery", proposal: "Proposal",
  negotiation: "Negotiation", won: "Won", lost: "Lost", parked: "Parked",
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return String(d); }
}
function fmt(v: number | string | null | undefined) {
  if (!v) return "—";
  const n = Number(v);
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

function ConvertModal({ open, prospect, onClose, onConverted }: {
  open: boolean; prospect: any; onClose: () => void; onConverted: (accountId: number) => void;
}) {
  const { toast } = useToast();
  const [acv, setAcv] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [contractHeader, setContractHeader] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (open) { setAcv(""); setPaymentTerms(""); setContractHeader(""); } }, [open]);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const payload: Record<string, any> = {};
      if (acv) payload.annualContractValue = parseFloat(acv);
      if (paymentTerms) payload.paymentTerms = paymentTerms;
      if (contractHeader) payload.contractHeader = contractHeader;
      const res = await fetch(`${API}/prospects/${prospect.id}/convert`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Failed"); }
      const { accountId } = await res.json();
      toast({ title: "Converted successfully" });
      onConverted(accountId);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  if (!prospect) return null;
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Convert {prospect.name} to Customer
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">{prospect.name}</span></div>
            {prospect.type && <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium capitalize">{prospect.type.replace("_", " ")}</span></div>}
            {prospect.industry && <div className="flex justify-between"><span className="text-muted-foreground">Industry</span><span className="font-medium">{prospect.industry}</span></div>}
          </div>
          <div className="space-y-1.5">
            <Label>Annual Contract Value ($)</Label>
            <Input value={acv} onChange={e => setAcv(e.target.value)} placeholder="e.g. 120000" />
          </div>
          <div className="space-y-1.5">
            <Label>Payment Terms</Label>
            <Input value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} placeholder="e.g. Net 30" />
          </div>
          <div className="space-y-1.5">
            <Label>Contract Header</Label>
            <Input value={contractHeader} onChange={e => setContractHeader(e.target.value)} placeholder="e.g. Master Services Agreement" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={loading} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
            {loading ? <span className="flex items-center gap-1.5"><span className="animate-spin w-3.5 h-3.5 border border-t-transparent border-white rounded-full inline-block" />Converting…</span>
              : <><ArrowRight className="h-4 w-4" />Confirm Conversion</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProspectDetail() {
  const params = useParams();
  const prospectId = Number(params.id);
  const [, navigate] = useLocation();
  const { role } = useAuthRole();
  const { toast } = useToast();

  if (role && !AUTHORIZED_ROLES.includes(role)) {
    navigate("/");
    return null;
  }

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [convertOpen, setConvertOpen] = useState(false);

  const load = useCallback(() => {
    if (!prospectId) return;
    setLoading(true);
    fetch(`${API}/prospects/${prospectId}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [prospectId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-10 w-64" /><Skeleton className="h-6 w-48" />
      <div className="grid grid-cols-2 gap-6"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Prospect not found.</p>
    </div>
  );

  const { opportunities = [], linkedAccount } = data;
  const canSeeConfidential = role && AUTHORIZED_ROLES.includes(role);

  const touchPoints: any[] = data.touchPoints ?? [];
  const sortedTouchPoints = [...touchPoints].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-5">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center gap-3 mb-1 text-sm">
            <Link href="/prospects" className="text-muted-foreground hover:text-foreground">Prospects</Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-semibold">{data.name}</span>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{data.name}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {data.type && (
                  <span className="text-xs bg-muted px-2 py-0.5 rounded capitalize">{data.type.replace("_", " ")}</span>
                )}
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[data.status] ?? "bg-muted text-muted-foreground"}`}>
                  {data.status}
                </span>
                {data.ownerId && <span className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" />Owner #{data.ownerId}</span>}
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(data.createdAt)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(data.status === "active" || data.status === "qualified") && (
                <Button onClick={() => setConvertOpen(true)} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                  <Building2 className="h-4 w-4" /> Convert to Customer
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={load}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        {/* Converted customer link */}
        {data.status === "converted" && linkedAccount && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900/50 px-4 py-3">
            <Building2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="text-sm text-emerald-800 dark:text-emerald-300">
              Converted to customer:{" "}
              <Link href={`/customers/${linkedAccount.id}`} className="font-semibold underline underline-offset-2">
                {linkedAccount.name}
              </Link>
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* General Info */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-foreground flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> General Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                ["Name", data.name],
                ["Type", data.type ? data.type.replace("_", " ") : "—"],
                ["Industry", data.industry ?? "—"],
                ["Segment", data.segment ? data.segment.replace("_", " ") : "—"],
                ["Status", data.status],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground/70">{label}</span>
                  <span className="font-medium capitalize">{value}</span>
                </div>
              ))}
              {data.notes && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground/70 mb-1">Notes</p>
                  <p className="text-sm text-foreground">{data.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Confidential Info */}
          {canSeeConfidential ? (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-foreground flex items-center gap-2">
                  <Lock className="h-4 w-4 text-amber-500" /> Confidential Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {data.primaryContactName && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground/70">Primary Contact</p>
                    <p className="font-medium">{data.primaryContactName}</p>
                    {data.primaryContactEmail && (
                      <a href={`mailto:${data.primaryContactEmail}`}
                        className="flex items-center gap-1 text-primary hover:underline text-xs">
                        <Mail className="h-3 w-3" />{data.primaryContactEmail}
                      </a>
                    )}
                  </div>
                )}
                {data.linkedinUrl && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground/70">LinkedIn</p>
                    <a href={data.linkedinUrl.startsWith("http") ? data.linkedinUrl : `https://${data.linkedinUrl}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline text-xs">
                      <Linkedin className="h-3 w-3" />{data.linkedinUrl}
                    </a>
                  </div>
                )}
                {data.sentiment && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground/70">Sentiment</p>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${SENTIMENT_BADGE[data.sentiment] ?? "bg-muted text-muted-foreground"}`}>
                      {data.sentiment}
                    </span>
                  </div>
                )}
                {sortedTouchPoints.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground/70 font-medium uppercase tracking-wide">Touch Points</p>
                    <div className="space-y-2">
                      {sortedTouchPoints.map((tp, i) => (
                        <div key={i} className="flex gap-3 text-xs">
                          <span className="text-muted-foreground shrink-0 w-24">{fmtDate(tp.date)}</span>
                          <div>
                            <span className="font-medium capitalize">{tp.type ?? "Contact"}</span>
                            {tp.notes && <p className="text-muted-foreground mt-0.5">{tp.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!data.primaryContactName && !data.linkedinUrl && !data.sentiment && sortedTouchPoints.length === 0 && (
                  <p className="text-muted-foreground text-sm">No confidential data recorded yet.</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border-amber-200 dark:border-amber-900/40">
              <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
                <Lock className="h-8 w-8 text-amber-400 opacity-60" />
                <p className="font-semibold text-foreground">Confidential — access restricted</p>
                <p className="text-xs text-muted-foreground text-center max-w-xs">
                  Contact information, LinkedIn, sentiment, and touch points are only visible to account managers, delivery directors, and admins.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Linked Opportunities */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Linked Opportunities ({opportunities.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {opportunities.length === 0 ? (
              <p className="text-sm text-muted-foreground px-6 pb-6">No opportunities linked to this prospect.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left px-6 py-3">Name</th>
                    <th className="text-left px-3 py-3">Stage</th>
                    <th className="text-right px-3 py-3">Value</th>
                    <th className="text-left px-3 py-3">Close Date</th>
                    <th className="text-left px-3 py-3">Owner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {opportunities.map((o: any) => (
                    <tr key={o.id} className="hover:bg-muted/10">
                      <td className="px-6 py-3 font-medium">{o.name}</td>
                      <td className="px-3 py-3">
                        <span className="text-xs bg-muted px-2 py-0.5 rounded capitalize">
                          {STAGE_LABELS[o.stage] ?? o.stage}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold">{fmt(o.value)}</td>
                      <td className="px-3 py-3 text-muted-foreground text-xs">{fmtDate(o.expectedCloseDate)}</td>
                      <td className="px-3 py-3 text-muted-foreground text-xs">{o.ownerName ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <ConvertModal
        open={convertOpen}
        prospect={data}
        onClose={() => setConvertOpen(false)}
        onConverted={(accountId) => {
          setConvertOpen(false);
          navigate(`/customers/${accountId}`);
        }}
      />
    </div>
  );
}
