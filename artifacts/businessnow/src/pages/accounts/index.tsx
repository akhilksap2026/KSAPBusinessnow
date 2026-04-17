import { useState, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useDebounce } from "@/hooks/use-debounce";
import { useListAccounts } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Building2, TrendingUp, AlertTriangle, DollarSign,
  Cloud, Server, Calendar, CheckCircle2, Plus, X, LayoutList, Columns3,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

const SEGMENTS = ["enterprise", "mid_market", "smb", "strategic"] as const;
const STATUSES = ["active", "at_risk", "prospect", "inactive", "churned"] as const;

const INDUSTRIES = [
  "Transportation & Logistics", "Freight & Shipping", "Supply Chain", "Retail & E-commerce",
  "Manufacturing", "Healthcare", "Energy & Utilities", "Government", "Financial Services", "Other",
];

const SEGMENT_LABELS: Record<string, string> = {
  enterprise: "Enterprise", mid_market: "Mid Market", smb: "SMB", strategic: "Strategic",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active", at_risk: "At Risk", prospect: "Prospect", inactive: "Inactive", churned: "Churned",
};

type AddAccountForm = {
  name: string;
  industry: string;
  segment: string;
  status: string;
  region: string;
  otmVersion: string;
  cloudDeployment: boolean;
  annualContractValue: string;
  renewalDate: string;
  paymentTerms: string;
  contractHeader: string;
};

const defaultForm = (): AddAccountForm => ({
  name: "",
  industry: "",
  segment: "enterprise",
  status: "prospect",
  region: "",
  otmVersion: "",
  cloudDeployment: false,
  annualContractValue: "",
  renewalDate: "",
  paymentTerms: "",
  contractHeader: "",
});

function HealthBar({ score }: { score: number | null }) {
  if (score == null || score === 0) return <span className="text-muted-foreground text-xs">—</span>;
  const color = score >= 80 ? "bg-emerald-500" : score >= 65 ? "bg-amber-500" : "bg-red-500";
  const textColor = score >= 80 ? "text-emerald-600 dark:text-emerald-400" : score >= 65 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-semibold tabular-nums ${textColor}`}>{score}</span>
    </div>
  );
}

function RenewalBadge({ date }: { date: string | null | undefined }) {
  if (!date) return <span className="text-muted-foreground text-xs">—</span>;
  const d = new Date(date);
  const now = new Date();
  const daysLeft = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (daysLeft < 0) return <span className="text-xs text-muted-foreground">{label}</span>;
  if (daysLeft <= 60)  return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400"><AlertTriangle className="h-3 w-3" />{label}</span>;
  if (daysLeft <= 120) return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400"><Calendar className="h-3 w-3" />{label}</span>;
  return <span className="text-xs text-muted-foreground">{label}</span>;
}

function KpiCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; accent: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-xl font-bold text-foreground leading-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Add Customer Modal ─────────────────────────────────────────────────────────

function AddAccountModal({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<AddAccountForm>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof AddAccountForm, string>>>({});

  const set = <K extends keyof AddAccountForm>(k: K, v: AddAccountForm[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = "Customer name is required";
    if (form.annualContractValue && isNaN(parseFloat(form.annualContractValue)))
      e.annualContractValue = "Must be a valid number";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        segment: form.segment,
        status: form.status,
        cloudDeployment: form.cloudDeployment,
      };
      if (form.industry)            payload.industry = form.industry;
      if (form.region)              payload.region = form.region;
      if (form.otmVersion)          payload.otmVersion = form.otmVersion;
      if (form.annualContractValue) payload.annualContractValue = parseFloat(form.annualContractValue);
      if (form.renewalDate)         payload.renewalDate = form.renewalDate;
      if (form.paymentTerms)        payload.paymentTerms = form.paymentTerms;
      if (form.contractHeader)      payload.contractHeader = form.contractHeader;

      const res = await fetch(`${API_BASE}/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to create account");
      }
      const created = await res.json();
      toast({ title: `Customer "${created.name}" created successfully` });
      setForm(defaultForm());
      setErrors({});
      onCreated();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setForm(defaultForm());
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Add New Customer
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Customer Name */}
          <div className="space-y-1.5">
            <Label htmlFor="acc-name">
              Customer Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="acc-name"
              placeholder="e.g. GlobalTrans Corp"
              value={form.name}
              onChange={e => set("name", e.target.value)}
              className={errors.name ? "border-red-500" : ""}
              autoFocus
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Status + Segment */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Segment</Label>
              <Select value={form.segment} onValueChange={v => set("segment", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEGMENTS.map(s => (
                    <SelectItem key={s} value={s}>{SEGMENT_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Industry + Region */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Industry</Label>
              <Select value={form.industry || "__none__"} onValueChange={v => set("industry", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select industry…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {INDUSTRIES.map(i => (
                    <SelectItem key={i} value={i}>{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-region">Region</Label>
              <Input
                id="acc-region"
                placeholder="e.g. North America"
                value={form.region}
                onChange={e => set("region", e.target.value)}
              />
            </div>
          </div>

          {/* OTM Version + ACV */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="acc-otm">OTM Version</Label>
              <Input
                id="acc-otm"
                placeholder="e.g. 24.2"
                value={form.otmVersion}
                onChange={e => set("otmVersion", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-acv">Annual Contract Value ($)</Label>
              <Input
                id="acc-acv"
                placeholder="e.g. 120000"
                value={form.annualContractValue}
                onChange={e => set("annualContractValue", e.target.value)}
                className={errors.annualContractValue ? "border-red-500" : ""}
              />
              {errors.annualContractValue && <p className="text-xs text-red-500">{errors.annualContractValue}</p>}
            </div>
          </div>

          {/* Renewal Date */}
          <div className="space-y-1.5">
            <Label htmlFor="acc-renewal">Contract Renewal Date</Label>
            <Input
              id="acc-renewal"
              type="date"
              value={form.renewalDate}
              onChange={e => set("renewalDate", e.target.value)}
            />
          </div>

          {/* Payment Terms + Contract Header */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="acc-payment">Payment Terms</Label>
              <Input
                id="acc-payment"
                placeholder="e.g. Net 30"
                value={form.paymentTerms}
                onChange={e => set("paymentTerms", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-contract">Contract Header</Label>
              <Input
                id="acc-contract"
                placeholder="e.g. MSA 2024"
                value={form.contractHeader}
                onChange={e => set("contractHeader", e.target.value)}
              />
            </div>
          </div>

          {/* Cloud Deployment toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/20">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Cloud Deployment</Label>
              <p className="text-xs text-muted-foreground">Is this account on OTM SaaS / OCI cloud?</p>
            </div>
            <Switch
              checked={form.cloudDeployment}
              onCheckedChange={v => set("cloudDeployment", v)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-1.5">
            {saving ? (
              <span className="flex items-center gap-1.5">
                <span className="animate-spin inline-block w-3.5 h-3.5 border border-t-transparent border-white rounded-full" />
                Creating…
              </span>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Create Customer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type ViewMode = "table" | "kanban";

const KANBAN_COLUMNS = [
  { id: "active",   label: "Active",   color: "border-t-emerald-500" },
  { id: "at_risk",  label: "At Risk",  color: "border-t-red-500" },
  { id: "inactive", label: "Inactive", color: "border-t-slate-400" },
];

function CustomerKanban({ accounts, onStatusChange }: { accounts: any[]; onStatusChange: (id: number, status: string) => void }) {
  const byStatus: Record<string, any[]> = { active: [], at_risk: [], inactive: [] };
  accounts.forEach(a => { if (byStatus[a.status]) byStatus[a.status].push(a); });

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {KANBAN_COLUMNS.map(col => {
          const items = byStatus[col.id] ?? [];
          return (
            <div key={col.id} className="w-72 shrink-0">
              <div className={`flex items-center justify-between mb-3 pb-2 border-b-2 ${col.color.replace("border-t-", "border-b-")}`}>
                <span className="text-xs font-semibold">{col.label}</span>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map(a => (
                  <div key={a.id} className="bg-card border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/customers/${a.id}`} className="text-sm font-semibold text-primary hover:underline leading-tight line-clamp-2">{a.name}</Link>
                      <Select value={a.status} onValueChange={v => onStatusChange(a.id, v)}>
                        <SelectTrigger className="h-5 w-5 p-0 border-0 bg-transparent [&>svg]:hidden shrink-0 opacity-40 hover:opacity-100" />
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="at_risk">At Risk</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {a.annualContractValue && Number(a.annualContractValue) > 0 && (
                      <div className="flex items-center gap-1 text-xs font-semibold text-foreground">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        ${Number(a.annualContractValue).toLocaleString()}
                      </div>
                    )}
                    <HealthBar score={a.healthScore ?? null} />
                    {a.renewalDate && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <RenewalBadge date={a.renewalDate} />
                      </div>
                    )}
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                    <p className="text-xs text-muted-foreground">No accounts</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AccountsList() {
  const { data: accounts, isLoading, refetch } = useListAccounts();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSegment, setFilterSegment] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [view, setView] = useState<ViewMode>("table");

  const filtered = useMemo(() => {
    if (!accounts) return [];
    return accounts.filter(a => {
      if (filterStatus !== "all" && a.status !== filterStatus) return false;
      if (filterSegment !== "all" && a.segment !== filterSegment) return false;
      if (debouncedSearch) {
        const s = debouncedSearch.toLowerCase();
        if (!a.name.toLowerCase().includes(s) &&
            !(a.industry || "").toLowerCase().includes(s) &&
            !(a.region || "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [accounts, filterStatus, filterSegment, debouncedSearch]);

  const kpis = useMemo(() => {
    const all = accounts || [];
    const active    = all.filter(a => a.status === "active").length;
    const atRisk    = all.filter(a => a.status === "at_risk").length;
    const totalACV  = all.filter(a => a.status !== "churned" && a.status !== "prospect")
                        .reduce((s, a) => s + (a.annualContractValue || 0), 0);
    const avgHealth = (() => {
      const scored = all.filter(a => a.healthScore && a.healthScore > 0);
      return scored.length ? Math.round(scored.reduce((s, a) => s + (a.healthScore || 0), 0) / scored.length) : 0;
    })();
    return { total: all.length, active, atRisk, totalACV, avgHealth };
  }, [accounts]);

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await fetch(`${API_BASE}/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      refetch();
    } catch {
      toast({ title: "Error", description: "Failed to update account status.", variant: "destructive" });
    }
  };

  const statusConfig: Record<string, { label: string; className: string }> = {
    active:   { label: "Active",   className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" },
    at_risk:  { label: "At Risk",  className: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" },
    prospect: { label: "Prospect", className: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300" },
    inactive: { label: "Inactive", className: "bg-muted text-muted-foreground" },
    churned:  { label: "Churned",  className: "bg-muted text-muted-foreground" },
  };

  const useVirtual = filtered.length > 50;
  const tableParentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => tableParentRef.current,
    estimateSize: () => 56,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {kpis.total} accounts · {kpis.active} active · ${kpis.totalACV.toLocaleString()} total ACV
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border rounded-lg p-0.5 gap-0.5 bg-muted/30">
            <button
              onClick={() => setView("table")}
              className={`p-1.5 rounded-md transition-colors ${view === "table" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              title="Table view"
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("kanban")}
              className={`p-1.5 rounded-md transition-colors ${view === "kanban" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              title="Kanban view"
            >
              <Columns3 className="h-4 w-4" />
            </button>
          </div>
          <Button onClick={() => setAddOpen(true)} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Customers" value={kpis.total}  sub={`${kpis.active} active`}             icon={Building2}    accent="bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400" />
        <KpiCard label="Total ACV"      value={`$${(kpis.totalACV / 1000).toFixed(0)}K`} sub="active &amp; AMS accounts" icon={DollarSign}   accent="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400" />
        <KpiCard label="At Risk"        value={kpis.atRisk}  sub="need attention"                     icon={AlertTriangle} accent="bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400" />
        <KpiCard label="Avg Health"     value={kpis.avgHealth} sub="across scored customers"           icon={TrendingUp}   accent="bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, industry, region…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSegment} onValueChange={setFilterSegment}>
          <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Segment" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Segments</SelectItem>
            {SEGMENTS.map(s => <SelectItem key={s} value={s}>{SEGMENT_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        {(filterStatus !== "all" || filterSegment !== "all" || search) && (
          <Button variant="ghost" size="sm" className="h-9 text-muted-foreground"
            onClick={() => { setFilterStatus("all"); setFilterSegment("all"); setSearch(""); }}>
            Clear
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Kanban View */}
      {view === "kanban" && (
        <CustomerKanban accounts={filtered} onStatusChange={handleStatusChange} />
      )}

      {/* Table */}
      {view === "table" && (
        <div className="border rounded-xl overflow-hidden bg-card">
          {useVirtual ? (
            <div ref={tableParentRef} style={{ overflow: "auto", maxHeight: "600px" }}>
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0 z-10">
                  <tr className="border-b border-border text-xs font-medium text-muted-foreground">
                    <th className="text-left px-4 py-3 min-w-[180px]">Customer</th>
                    <th className="text-left px-4 py-3">Industry</th>
                    <th className="text-left px-4 py-3">Segment</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3 min-w-[120px]">Health</th>
                    <th className="text-left px-4 py-3">Region</th>
                    <th className="text-left px-4 py-3">OTM Version</th>
                    <th className="text-left px-4 py-3">Renewal</th>
                    <th className="text-right px-4 py-3">ACV</th>
                  </tr>
                </thead>
                <tbody style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
                  {rowVirtualizer.getVirtualItems().map(virtualRow => {
                    const account = filtered[virtualRow.index];
                    const sc = statusConfig[account.status] ?? { label: account.status, className: "bg-muted text-muted-foreground" };
                    return (
                      <tr
                        key={account.id}
                        style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${virtualRow.start}px)` }}
                        className="border-b border-border/50 hover:bg-muted/30 cursor-pointer"
                      >
                        <td className="px-4 py-3 font-medium">
                          <Link href={`/accounts/${account.id}`} className="hover:underline text-primary font-semibold">{account.name}</Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-sm">{account.industry || "—"}</td>
                        <td className="px-4 py-3"><span className="text-xs text-muted-foreground capitalize">{account.segment?.replace("_", " ") || "—"}</span></td>
                        <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sc.className}`}>{sc.label}</span></td>
                        <td className="px-4 py-3"><HealthBar score={account.healthScore ?? null} /></td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{(account as any).region || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {(account as any).cloudDeployment ? <Cloud className="h-3.5 w-3.5 text-blue-500" /> : <Server className="h-3.5 w-3.5 text-muted-foreground" />}
                            <span className="text-xs text-muted-foreground">{(account as any).otmVersion || "—"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3"><RenewalBadge date={(account as any).renewalDate} /></td>
                        <td className="px-4 py-3 text-right font-semibold text-sm">
                          {account.annualContractValue && Number(account.annualContractValue) > 0
                            ? `$${Number(account.annualContractValue).toLocaleString()}`
                            : <span className="text-muted-foreground font-normal">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="min-w-[180px]">Customer</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="min-w-[120px]">Health</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>OTM Version</TableHead>
                  <TableHead>Renewal</TableHead>
                  <TableHead className="text-right">ACV</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((account) => {
                  const sc = statusConfig[account.status] ?? { label: account.status, className: "bg-muted text-muted-foreground" };
                  return (
                    <TableRow key={account.id} className="hover:bg-muted/30 cursor-pointer">
                      <TableCell className="font-medium">
                        <Link href={`/accounts/${account.id}`} className="hover:underline text-primary font-semibold">
                          {account.name}
                        </Link>
                        {(account as any).region && (
                          <p className="text-xs text-muted-foreground font-normal">{(account as any).region}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{account.industry || "—"}</TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground capitalize">{account.segment?.replace("_", " ") || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sc.className}`}>
                          {sc.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <HealthBar score={account.healthScore ?? null} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{(account as any).region || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {(account as any).cloudDeployment
                            ? <Cloud className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                            : <Server className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          }
                          <span className="text-xs text-muted-foreground">
                            {(account as any).otmVersion || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <RenewalBadge date={(account as any).renewalDate} />
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-sm">
                          {account.annualContractValue && Number(account.annualContractValue) > 0
                            ? `$${Number(account.annualContractValue).toLocaleString()}`
                            : <span className="text-muted-foreground font-normal">—</span>}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center h-24 text-muted-foreground">
                      No customers match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1">
        <span className="flex items-center gap-1.5"><Cloud className="h-3.5 w-3.5 text-blue-500" /> Cloud deployment</span>
        <span className="flex items-center gap-1.5"><Server className="h-3.5 w-3.5" /> On-premise</span>
        <span className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Renewal within 60 days</span>
        <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-amber-500" /> Renewal within 120 days</span>
        <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Health ≥ 80</span>
      </div>

      {/* Add Customer Modal */}
      <AddAccountModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => refetch()}
      />
    </div>
  );
}
