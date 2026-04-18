import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard, Plus, Pencil, Trash2, Search, X, Globe, FolderOpen,
  DollarSign, RefreshCw, ChevronRight, Copy, ArrowDownToLine,
} from "lucide-react";
import { format, parseISO } from "date-fns";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "SGD", "CHF"] as const;
const ROLES = [
  "Senior Consultant", "Consultant", "Junior Consultant", "Architect",
  "Project Manager", "Business Analyst", "Technical Lead", "QA Engineer",
  "Data Engineer", "Integration Specialist",
] as const;

interface RateCard {
  id: number;
  name: string;
  notes: string | null;
  isTemplate: boolean;
  projectId: number | null;
  projectName: string | null;
  currency: string | null;
  sellRate: string | null;
  costRate: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  role: string | null;
  createdAt: string | null;
}

interface FormState {
  name: string;
  notes: string;
  isTemplate: boolean;
  projectId: string;
  currency: string;
  role: string;
  sellRate: string;
  costRate: string;
  effectiveDate: string;
  expiryDate: string;
}

const defaultForm = (): FormState => ({
  name: "", notes: "", isTemplate: true, projectId: "",
  currency: "USD", role: "", sellRate: "", costRate: "",
  effectiveDate: format(new Date(), "yyyy-MM-dd"), expiryDate: "",
});

function margin(sell: string | null, cost: string | null): string | null {
  const s = parseFloat(sell ?? "");
  const c = parseFloat(cost ?? "");
  if (isNaN(s) || isNaN(c) || s === 0) return null;
  return `${Math.round(((s - c) / s) * 100)}%`;
}

export default function RateCardsPage() {
  const { toast } = useToast();
  const [cards, setCards] = useState<RateCard[]>([]);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "template" | "project">("all");
  const [filterProject, setFilterProject] = useState("all");
  const [filterCurrency, setFilterCurrency] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCard, setEditCard] = useState<RateCard | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [copySource, setCopySource] = useState<RateCard | null>(null);
  const [copyProjectId, setCopyProjectId] = useState("");
  const [copying, setCopying] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/rate-cards`)
      .then(r => r.json()).then(d => setCards(Array.isArray(d) ? d : []))
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch(`${API_BASE}/projects?isAdministrative=false`)
      .then(r => r.json()).then(d => setProjects(Array.isArray(d) ? d.map((p: any) => ({ id: p.id, name: p.name })) : []))
      .catch(() => setProjects([]));
  }, []);

  const filtered = useMemo(() => {
    return cards.filter(c => {
      const q = search.toLowerCase();
      if (q && !c.name.toLowerCase().includes(q) && !(c.role ?? "").toLowerCase().includes(q) && !(c.projectName ?? "").toLowerCase().includes(q)) return false;
      if (filterType === "template" && !c.isTemplate) return false;
      if (filterType === "project" && c.isTemplate) return false;
      if (filterProject !== "all" && String(c.projectId ?? "") !== filterProject) return false;
      if (filterCurrency !== "all" && (c.currency ?? "") !== filterCurrency) return false;
      return true;
    });
  }, [cards, search, filterType, filterProject, filterCurrency]);

  const grouped = useMemo(() => {
    const templates = filtered.filter(c => c.isTemplate);
    const projectCards = filtered.filter(c => !c.isTemplate);
    const byProject = new Map<number, { name: string; cards: RateCard[] }>();
    projectCards.forEach(c => {
      if (!byProject.has(c.projectId!)) byProject.set(c.projectId!, { name: c.projectName ?? "Unknown", cards: [] });
      byProject.get(c.projectId!)!.cards.push(c);
    });
    return { templates, projectGroups: Array.from(byProject.entries()).map(([id, v]) => ({ projectId: id, ...v })) };
  }, [filtered]);

  const openCreate = () => { setEditCard(null); setForm(defaultForm()); setErrors({}); setDialogOpen(true); };
  const openEdit = (c: RateCard) => {
    setEditCard(c);
    setForm({
      name: c.name, notes: c.notes ?? "", isTemplate: c.isTemplate,
      projectId: String(c.projectId ?? ""), currency: c.currency ?? "USD",
      role: c.role ?? "", sellRate: c.sellRate ?? "", costRate: c.costRate ?? "",
      effectiveDate: c.effectiveDate ? c.effectiveDate.slice(0, 10) : format(new Date(), "yyyy-MM-dd"),
      expiryDate: c.expiryDate ? c.expiryDate.slice(0, 10) : "",
    });
    setErrors({});
    setDialogOpen(true);
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.isTemplate && !form.projectId) e.projectId = "Project is required for non-template cards";
    const s = parseFloat(form.sellRate);
    if (form.sellRate && (isNaN(s) || s < 0)) e.sellRate = "Invalid sell rate";
    const c = parseFloat(form.costRate);
    if (form.costRate && (isNaN(c) || c < 0)) e.costRate = "Invalid cost rate";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(), notes: form.notes.trim() || null,
        isTemplate: form.isTemplate, projectId: form.isTemplate ? null : parseInt(form.projectId) || null,
        currency: form.currency, role: form.role || null,
        sellRate: form.sellRate || null, costRate: form.costRate || null,
        effectiveDate: form.effectiveDate || null, expiryDate: form.expiryDate || null,
      };
      const url = editCard ? `${API_BASE}/rate-cards/${editCard.id}` : `${API_BASE}/rate-cards`;
      const method = editCard ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Save failed"); }
      toast({ title: editCard ? "Rate card updated" : "Rate card created" });
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast({ title: err.message || "Failed to save", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/rate-cards/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast({ title: "Rate card deleted" });
      setDeleteId(null);
      load();
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const handleCopyToProject = async () => {
    if (!copySource || !copyProjectId) return;
    setCopying(true);
    try {
      const proj = projects.find(p => String(p.id) === copyProjectId);
      const res = await fetch(`${API_BASE}/rate-cards/${copySource.id}/copy-to-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: parseInt(copyProjectId), projectName: proj?.name }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Failed"); }
      toast({ title: "Rate card copied to project" });
      setCopySource(null);
      setCopyProjectId("");
      load();
    } catch (err: any) {
      toast({ title: err.message || "Failed to copy", variant: "destructive" });
    } finally { setCopying(false); }
  };

  const currencies = useMemo(() => [...new Set(cards.map(c => c.currency).filter(Boolean))], [cards]);

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rate Cards</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {cards.filter(c => c.isTemplate).length} global templates · {cards.filter(c => !c.isTemplate).length} project-specific cards
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> New Rate Card
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search name, role, project…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 w-64" />
          {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
        </div>
        <Select value={filterType} onValueChange={v => setFilterType(v as any)}>
          <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="template">Templates</SelectItem>
            <SelectItem value="project">Project-Specific</SelectItem>
          </SelectContent>
        </Select>
        {filterType !== "template" && (
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="h-9 w-44"><SelectValue placeholder="All projects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={filterCurrency} onValueChange={setFilterCurrency}>
          <SelectTrigger className="h-9 w-28"><SelectValue placeholder="Currency" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {currencies.map(c => <SelectItem key={c!} value={c!}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {(search || filterType !== "all" || filterProject !== "all" || filterCurrency !== "all") && (
          <Button variant="ghost" size="sm" className="h-9 text-muted-foreground gap-1.5"
            onClick={() => { setSearch(""); setFilterType("all"); setFilterProject("all"); setFilterCurrency("all"); }}>
            <RefreshCw className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <CreditCard className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">No rate cards found</h3>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or create a new rate card.</p>
          </div>
          <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> New Rate Card</Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Global Templates */}
          {(filterType === "all" || filterType === "template") && grouped.templates.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Globe className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Global Templates</h2>
                <Badge variant="secondary" className="text-xs">{grouped.templates.length}</Badge>
              </div>
              <RateCardTable cards={grouped.templates} onEdit={openEdit} onDelete={setDeleteId} onCopyToProject={setCopySource} />
            </section>
          )}

          {/* Project-Specific */}
          {(filterType === "all" || filterType === "project") && grouped.projectGroups.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <FolderOpen className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-foreground">Project-Specific Cards</h2>
              </div>
              <div className="space-y-4">
                {grouped.projectGroups.map(group => (
                  <div key={group.projectId}>
                    <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <ChevronRight className="h-3 w-3" />
                      {group.name}
                      <Badge variant="outline" className="text-[10px]">{group.cards.length}</Badge>
                    </div>
                    <RateCardTable cards={group.cards} onEdit={openEdit} onDelete={setDeleteId} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={o => { if (!o) setDialogOpen(false); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {editCard
                ? editCard.projectId
                  ? `Rate Card — ${editCard.projectName ?? `Project #${editCard.projectId}`} (Override)`
                  : "Edit Rate Card"
                : "New Rate Card"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            {/* Override banner for project-specific cards */}
            {editCard?.projectId && editCard.notes?.startsWith("Copied from global template:") && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-amber-200 bg-amber-50/60 text-xs text-amber-800">
                <FolderOpen className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold">Project override</span> · {editCard.notes}. Rates set here take priority over the global template in all billing calculations.
                </div>
              </div>
            )}

            {/* Template toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/20">
              <div>
                <p className="text-sm font-medium">Global Template</p>
                <p className="text-xs text-muted-foreground">Applies across all projects</p>
              </div>
              <Switch checked={form.isTemplate} onCheckedChange={v => setForm(f => ({ ...f, isTemplate: v, projectId: "" }))} />
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Senior Consultant USD 2025" className={errors.name ? "border-destructive" : ""} />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            {/* Project (if not template) */}
            {!form.isTemplate && (
              <div className="space-y-1.5">
                <Label>Project <span className="text-destructive">*</span></Label>
                <Select value={form.projectId || "__none__"} onValueChange={v => setForm(f => ({ ...f, projectId: v === "__none__" ? "" : v }))}>
                  <SelectTrigger className={errors.projectId ? "border-destructive" : ""}><SelectValue placeholder="Select project…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select project…</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.projectId && <p className="text-xs text-destructive">{errors.projectId}</p>}
              </div>
            )}

            {/* Role + Currency */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={form.role || "__none__"} onValueChange={v => setForm(f => ({ ...f, role: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="— Any role —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Any role —</SelectItem>
                    {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Sell + Cost Rate */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Sell Rate / hr</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input type="number" min="0" step="0.01" value={form.sellRate} onChange={e => setForm(f => ({ ...f, sellRate: e.target.value }))} placeholder="0.00" className={`pl-7 ${errors.sellRate ? "border-destructive" : ""}`} />
                </div>
                {errors.sellRate && <p className="text-xs text-destructive">{errors.sellRate}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Cost Rate / hr</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input type="number" min="0" step="0.01" value={form.costRate} onChange={e => setForm(f => ({ ...f, costRate: e.target.value }))} placeholder="0.00" className={`pl-7 ${errors.costRate ? "border-destructive" : ""}`} />
                </div>
                {errors.costRate && <p className="text-xs text-destructive">{errors.costRate}</p>}
              </div>
            </div>
            {form.sellRate && form.costRate && (
              <p className="text-xs text-emerald-500">
                Margin: {margin(form.sellRate, form.costRate)} ·{" "}
                Markup: {parseFloat(form.sellRate) > 0 && parseFloat(form.costRate) > 0
                  ? `$${(parseFloat(form.sellRate) - parseFloat(form.costRate)).toFixed(2)}/hr`
                  : "—"}
              </p>
            )}

            {/* Effective / Expiry */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Effective Date</Label>
                <Input type="date" value={form.effectiveDate} onChange={e => setForm(f => ({ ...f, effectiveDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Expiry Date</Label>
                <Input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes about this rate card…" />
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editCard ? "Save Changes" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy to Project Modal */}
      <Dialog open={copySource !== null} onOpenChange={o => { if (!o) { setCopySource(null); setCopyProjectId(""); } }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="h-4 w-4 text-primary" />
              Copy to Project
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Cloning global template:</p>
              <p className="text-sm font-semibold mt-0.5 truncate">{copySource?.name}</p>
              {copySource?.role && <p className="text-xs text-muted-foreground mt-0.5">{copySource.role} · {copySource.currency}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Select Project</label>
              <Select value={copyProjectId || "__none__"} onValueChange={v => setCopyProjectId(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Choose a project…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Choose a project…</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              A copy of this rate card will be created for the selected project.
              Project-level rates take priority over global templates in all billing calculations.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCopySource(null); setCopyProjectId(""); }}>Cancel</Button>
            <Button onClick={handleCopyToProject} disabled={copying || !copyProjectId} className="gap-2">
              <Copy className="h-3.5 w-3.5" />
              {copying ? "Copying…" : "Copy to Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteId !== null} onOpenChange={o => { if (!o) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Delete Rate Card</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">This action cannot be undone. Are you sure you want to delete this rate card?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RateCardTable({ cards, onEdit, onDelete, onCopyToProject }: {
  cards: RateCard[];
  onEdit: (c: RateCard) => void;
  onDelete: (id: number) => void;
  onCopyToProject?: (c: RateCard) => void;
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground">
            <th className="text-left px-4 py-2.5">Name</th>
            <th className="text-left px-3 py-2.5">Role</th>
            <th className="text-right px-3 py-2.5">Sell Rate</th>
            <th className="text-right px-3 py-2.5">Cost Rate</th>
            <th className="text-center px-3 py-2.5">Margin</th>
            <th className="text-left px-3 py-2.5">Currency</th>
            <th className="text-left px-3 py-2.5">Effective</th>
            <th className="px-3 py-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {cards.map(card => {
            const m = margin(card.sellRate, card.costRate);
            const mNum = m ? parseInt(m) : null;
            const marginColor = mNum === null ? "" : mNum >= 40 ? "text-emerald-500" : mNum >= 25 ? "text-amber-500" : "text-red-500";
            return (
              <tr key={card.id} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                <td className="px-4 py-3 font-medium max-w-[220px]">
                  <div className="truncate">{card.name}</div>
                  {card.notes && <div className="text-[10px] text-muted-foreground truncate">{card.notes}</div>}
                  {card.projectName && (
                    <div className="text-[10px] text-amber-500 font-medium mt-0.5 flex items-center gap-0.5">
                      <FolderOpen className="h-2.5 w-2.5" /> {card.projectName}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 text-muted-foreground text-xs">{card.role ?? <span className="text-muted-foreground/40">—</span>}</td>
                <td className="px-3 py-3 text-right font-semibold">
                  {card.sellRate ? `$${parseFloat(card.sellRate).toFixed(2)}` : <span className="text-muted-foreground/40">—</span>}
                </td>
                <td className="px-3 py-3 text-right text-muted-foreground">
                  {card.costRate ? `$${parseFloat(card.costRate).toFixed(2)}` : <span className="text-muted-foreground/40">—</span>}
                </td>
                <td className={`px-3 py-3 text-center text-xs font-semibold ${marginColor}`}>
                  {m ?? <span className="text-muted-foreground/40">—</span>}
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground">{card.currency ?? "—"}</td>
                <td className="px-3 py-3 text-xs text-muted-foreground">
                  {card.effectiveDate ? format(parseISO(card.effectiveDate), "MMM d, yyyy") : "—"}
                  {card.expiryDate && <span className="text-muted-foreground/50"> → {format(parseISO(card.expiryDate), "MMM d, yyyy")}</span>}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {onCopyToProject && card.isTemplate && (
                      <button
                        onClick={() => onCopyToProject(card)}
                        className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                        title="Copy to Project"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => onEdit(card)} className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => onDelete(card.id)} className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors" title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
