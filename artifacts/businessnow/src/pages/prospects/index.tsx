import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuthRole } from "@/lib/auth";
import {
  Target, Plus, Search, Users, CheckCircle2, TrendingUp, ArrowRight,
  Trash2, Edit2, Building2, X,
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

const INDUSTRIES = [
  "Transportation & Logistics","Freight & Shipping","Supply Chain","Retail & E-commerce",
  "Manufacturing","Healthcare","Energy & Utilities","Government","Financial Services","Other",
];

function getQuarterStart() {
  const now = new Date();
  return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return String(d); }
}

function lastTouchDate(touchPoints: any[]): string {
  if (!touchPoints?.length) return "—";
  const sorted = [...touchPoints].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return fmtDate(sorted[0]?.date);
}

type Prospect = {
  id: number; name: string; type: string | null; industry: string | null;
  segment: string | null; status: string; sentiment?: string; touchPoints?: any[];
  ownerId: number | null; notes: string | null;
  convertedToAccountId: number | null; convertedAt: string | null; createdAt: string;
};
type Resource = { id: number; name: string };
type ProspectForm = {
  name: string; type: string; industry: string; segment: string;
  ownerId: string; primaryContactName: string; primaryContactEmail: string;
  linkedinUrl: string; sentiment: string; notes: string;
};

const defaultForm = (): ProspectForm => ({
  name: "", type: "", industry: "", segment: "", ownerId: "",
  primaryContactName: "", primaryContactEmail: "", linkedinUrl: "", sentiment: "", notes: "",
});

function AddProspectModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<ProspectForm>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [resources, setResources] = useState<Resource[]>([]);

  useEffect(() => {
    if (open) {
      fetch(`${API}/resources`).then(r => r.json()).then(d => setResources(Array.isArray(d) ? d : [])).catch(() => {});
      setForm(defaultForm());
    }
  }, [open]);

  const set = <K extends keyof ProspectForm>(k: K, v: ProspectForm[K]) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast({ title: "Prospect name is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload: Record<string, any> = { name: form.name.trim() };
      if (form.type) payload.type = form.type;
      if (form.industry) payload.industry = form.industry;
      if (form.segment) payload.segment = form.segment;
      if (form.ownerId && form.ownerId !== "__none__") payload.ownerId = parseInt(form.ownerId);
      if (form.primaryContactName) payload.primaryContactName = form.primaryContactName;
      if (form.primaryContactEmail) payload.primaryContactEmail = form.primaryContactEmail;
      if (form.linkedinUrl) payload.linkedinUrl = form.linkedinUrl;
      if (form.sentiment && form.sentiment !== "__none__") payload.sentiment = form.sentiment;
      if (form.notes) payload.notes = form.notes;
      const res = await fetch(`${API}/prospects`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Failed"); }
      toast({ title: "Prospect added" });
      onCreated(); onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> Add Prospect</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Prospect Name <span className="text-red-500">*</span></Label>
            <Input autoFocus value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. TransWest Global" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type || "__none__"} onValueChange={v => set("type", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  <SelectItem value="new_logo">New Logo</SelectItem>
                  <SelectItem value="expansion">Expansion</SelectItem>
                  <SelectItem value="reactivation">Reactivation</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Segment</Label>
              <Select value={form.segment || "__none__"} onValueChange={v => set("segment", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select segment…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                  <SelectItem value="mid_market">Mid Market</SelectItem>
                  <SelectItem value="smb">SMB</SelectItem>
                  <SelectItem value="strategic">Strategic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Industry</Label>
              <Select value={form.industry || "__none__"} onValueChange={v => set("industry", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select industry…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Owner</Label>
              <Select value={form.ownerId || "__none__"} onValueChange={v => set("ownerId", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select owner…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {resources.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="border-t border-border pt-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Confidential Fields</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Primary Contact Name</Label>
                <Input value={form.primaryContactName} onChange={e => set("primaryContactName", e.target.value)} placeholder="Jane Smith" />
              </div>
              <div className="space-y-1.5">
                <Label>Primary Contact Email</Label>
                <Input value={form.primaryContactEmail} onChange={e => set("primaryContactEmail", e.target.value)} placeholder="jane@company.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>LinkedIn URL</Label>
                <Input value={form.linkedinUrl} onChange={e => set("linkedinUrl", e.target.value)} placeholder="linkedin.com/company/…" />
              </div>
              <div className="space-y-1.5">
                <Label>Sentiment</Label>
                <Select value={form.sentiment || "__none__"} onValueChange={v => set("sentiment", v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    <SelectItem value="positive">Positive</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="negative">Negative</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} className="resize-none" placeholder="Additional context…" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-1.5">
            {saving ? <span className="flex items-center gap-1.5"><span className="animate-spin w-3.5 h-3.5 border border-t-transparent border-white rounded-full inline-block" />Creating…</span>
              : <><Plus className="h-4 w-4" />Add Prospect</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProspectsPage() {
  const { role } = useAuthRole();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (role && !AUTHORIZED_ROLES.includes(role)) navigate("/");
  }, [role, navigate]);

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/prospects`).then(r => r.json()).catch(() => []),
      fetch(`${API}/resources`).then(r => r.json()).catch(() => []),
    ]).then(([p, r]) => {
      setProspects(Array.isArray(p) ? p : []);
      setResources(Array.isArray(r) ? r : []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const quarterStart = useMemo(() => getQuarterStart(), []);
  const kpis = useMemo(() => ({
    total: prospects.length,
    active: prospects.filter(p => p.status === "active").length,
    qualified: prospects.filter(p => p.status === "qualified").length,
    converted: prospects.filter(p => p.status === "converted" && p.convertedAt && new Date(p.convertedAt) >= quarterStart).length,
  }), [prospects, quarterStart]);

  const getOwnerName = (id: number | null) => resources.find(r => r.id === id)?.name ?? "—";

  const filtered = useMemo(() => prospects.filter(p => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (ownerFilter !== "all" && String(p.ownerId) !== ownerFilter) return false;
    if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [prospects, statusFilter, ownerFilter, q]);

  const handleDelete = async (p: Prospect) => {
    if (!confirm(`Delete prospect "${p.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API}/prospects/${p.id}`, { method: "DELETE" });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Failed"); }
      toast({ title: "Prospect deleted" });
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const canSeeConfidential = role && AUTHORIZED_ROLES.includes(role);

  if (loading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}</div>
      <Skeleton className="h-64" />
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" /> Prospects
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Pre-customer pipeline — track prospects and conversions</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Prospect
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Prospects", value: kpis.total, Icon: Target, accent: "bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400" },
          { label: "Active", value: kpis.active, Icon: TrendingUp, accent: "bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400" },
          { label: "Qualified", value: kpis.qualified, Icon: CheckCircle2, accent: "bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400" },
          { label: "Converted This Qtr", value: kpis.converted, Icon: ArrowRight, accent: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400" },
        ].map(({ label, value, Icon, accent }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{label}</p>
              <p className="text-2xl font-bold text-foreground">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search prospects…" value={q} onChange={e => setQ(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="qualified">Qualified</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
            <SelectItem value="dead">Dead</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger className="h-9 w-36"><SelectValue placeholder="All owners" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Owners</SelectItem>
            {resources.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {(statusFilter !== "all" || ownerFilter !== "all" || q) && (
          <Button variant="ghost" size="sm" className="h-9" onClick={() => { setStatusFilter("all"); setOwnerFilter("all"); setQ(""); }}>
            <X className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} of {prospects.length}</span>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-muted-foreground text-xs font-medium">
                <th className="text-left px-4 py-3">Prospect Name</th>
                <th className="text-left px-3 py-3">Owner</th>
                <th className="text-left px-3 py-3">Status</th>
                {canSeeConfidential && <th className="text-left px-3 py-3">Sentiment</th>}
                <th className="text-left px-3 py-3">Last Touch</th>
                <th className="text-left px-3 py-3">Created</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={canSeeConfidential ? 7 : 6} className="text-center py-12 text-muted-foreground">
                    <Target className="h-8 w-8 mx-auto opacity-20 mb-2" />
                    <p className="text-sm">No prospects found</p>
                  </td>
                </tr>
              ) : filtered.map(p => (
                <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/prospects/${p.id}`} className="font-semibold text-primary hover:underline">{p.name}</Link>
                    {p.industry && <p className="text-xs text-muted-foreground">{p.industry}</p>}
                  </td>
                  <td className="px-3 py-3 text-sm">
                    <div className="flex items-center gap-1.5 text-foreground">
                      <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                      {getOwnerName(p.ownerId)}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[p.status] ?? "bg-muted text-muted-foreground"}`}>
                      {p.status}
                    </span>
                  </td>
                  {canSeeConfidential && (
                    <td className="px-3 py-3">
                      {p.sentiment
                        ? <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${SENTIMENT_BADGE[p.sentiment] ?? "bg-muted text-muted-foreground"}`}>{p.sentiment}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                  )}
                  <td className="px-3 py-3 text-xs text-muted-foreground">{lastTouchDate(p.touchPoints ?? [])}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{fmtDate(p.createdAt)}</td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      {(p.status === "active" || p.status === "qualified") && (
                        <Link href={`/prospects/${p.id}`}>
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-900 dark:hover:bg-emerald-950/30">
                            <Building2 className="h-3 w-3" /> Convert
                          </Button>
                        </Link>
                      )}
                      <Link href={`/prospects/${p.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Edit2 className="h-3.5 w-3.5" /></Button>
                      </Link>
                      {p.status !== "converted" && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() => handleDelete(p)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AddProspectModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={load} />
    </div>
  );
}
