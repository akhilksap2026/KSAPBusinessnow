import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Settings2, Tag, CreditCard, GripVertical, Layout, ChevronRight, ChevronDown, Folder, Square, DollarSign, Check, X, Sun, Moon, Monitor } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const API = import.meta.env.BASE_URL + "api";

// ── Time Entry Categories Tab ─────────────────────────────────────────────────

interface Category {
  id: number;
  name: string;
  code: string | null;
  defaultBillable: boolean;
  sortOrder: number;
  isActive: boolean;
}

function CategoryModal({ cat, onClose, onSave }: { cat: Partial<Category> | null; onClose: () => void; onSave: () => void }) {
  const { toast } = useToast();
  const isEdit = !!cat?.id;
  const [form, setForm] = useState({ name: cat?.name ?? "", code: cat?.code ?? "", defaultBillable: cat?.defaultBillable ?? true, isActive: cat?.isActive ?? true });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const url = isEdit ? `${API}/time-entry-categories/${cat!.id}` : `${API}/time-entry-categories`;
      const method = isEdit ? "PUT" : "POST";
      await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      onSave();
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">{isEdit ? "Edit" : "New"} Time Entry Category</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-background border-border" placeholder="e.g. Development" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Code (short)</label>
            <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} className="bg-background border-border" placeholder="e.g. DEV" maxLength={10} />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-foreground">Default Billable</label>
            <Switch checked={form.defaultBillable} onCheckedChange={v => setForm(f => ({ ...f, defaultBillable: v }))} />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-foreground">Active</label>
            <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border">Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TimeEntryCategoriesTab() {
  const { toast } = useToast();
  const [cats, setCats] = useState<Category[]>([]);
  const [modal, setModal] = useState<Partial<Category> | null | false>(false);

  const load = () => fetch(`${API}/time-entry-categories`).then(r => r.json()).then(setCats).catch(() => {});

  useEffect(() => { load(); }, []);

  const remove = async (id: number) => {
    if (!confirm("Delete this category?")) return;
    await fetch(`${API}/time-entry-categories/${id}`, { method: "DELETE" });
    toast({ title: "Category deleted" });
    load();
  };

  const toggleBillable = async (cat: Category) => {
    await fetch(`${API}/time-entry-categories/${cat.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ defaultBillable: !cat.defaultBillable }) });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Time Entry Categories</h3>
          <p className="text-xs text-muted-foreground/70 mt-0.5">Categories consultants select when logging time. Default billable pre-fills the billable toggle.</p>
        </div>
        <Button size="sm" onClick={() => setModal({})} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Category
        </Button>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {cats.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground/60 text-sm">
              No categories yet. Add one to get started.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left p-4 w-8"></th>
                  <th className="text-left p-4">Name</th>
                  <th className="text-left p-4">Code</th>
                  <th className="text-center p-4">Default Billable</th>
                  <th className="text-center p-4">Status</th>
                  <th className="text-right p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cats.map(cat => (
                  <tr key={cat.id} className="hover:bg-muted/30">
                    <td className="p-4"><GripVertical className="h-4 w-4 text-muted-foreground/40" /></td>
                    <td className="p-4 font-medium text-foreground">{cat.name}</td>
                    <td className="p-4">
                      {cat.code ? <Badge variant="outline" className="text-xs font-mono">{cat.code}</Badge> : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="p-4 text-center">
                      <Switch checked={cat.defaultBillable} onCheckedChange={() => toggleBillable(cat)} />
                    </td>
                    <td className="p-4 text-center">
                      <Badge variant={cat.isActive ? "default" : "secondary"} className="text-xs">
                        {cat.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setModal(cat)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-500" onClick={() => remove(cat.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {modal !== false && (
        <CategoryModal
          cat={modal}
          onClose={() => setModal(false)}
          onSave={load}
        />
      )}
    </div>
  );
}

// ── Rate Cards Tab ────────────────────────────────────────────────────────────

interface RateCard {
  id: number;
  name: string;
  role: string;
  practiceArea: string | null;
  billingRate: number;
  costRate: number | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  notes: string | null;
}

function RateCardModal({ card, onClose, onSave }: { card: Partial<RateCard> | null; onClose: () => void; onSave: () => void }) {
  const { toast } = useToast();
  const isEdit = !!card?.id;
  const [form, setForm] = useState({ name: card?.name ?? "", role: card?.role ?? "", practiceArea: card?.practiceArea ?? "", billingRate: card?.billingRate?.toString() ?? "", costRate: card?.costRate?.toString() ?? "", effectiveDate: card?.effectiveDate ?? "", expiryDate: card?.expiryDate ?? "", notes: card?.notes ?? "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim() || !form.role.trim() || !form.billingRate) {
      toast({ title: "Name, role, and billing rate are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const url = isEdit ? `${API}/rate-cards/${card!.id}` : `${API}/rate-cards`;
      const method = isEdit ? "PUT" : "POST";
      await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, billingRate: parseFloat(form.billingRate), costRate: form.costRate ? parseFloat(form.costRate) : null }),
      });
      onSave();
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">{isEdit ? "Edit" : "New"} Rate Card</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-background border-border" placeholder="e.g. Senior Consultant Rate" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Role *</label>
            <Input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="bg-background border-border" placeholder="e.g. Senior Consultant" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Practice Area</label>
            <Input value={form.practiceArea} onChange={e => setForm(f => ({ ...f, practiceArea: e.target.value }))} className="bg-background border-border" placeholder="e.g. ERP" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Billing Rate ($/hr) *</label>
            <Input type="number" value={form.billingRate} onChange={e => setForm(f => ({ ...f, billingRate: e.target.value }))} className="bg-background border-border" placeholder="200" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Cost Rate ($/hr)</label>
            <Input type="number" value={form.costRate} onChange={e => setForm(f => ({ ...f, costRate: e.target.value }))} className="bg-background border-border" placeholder="120" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Effective Date</label>
            <Input type="date" value={form.effectiveDate} onChange={e => setForm(f => ({ ...f, effectiveDate: e.target.value }))} className="bg-background border-border" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Expiry Date</label>
            <Input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} className="bg-background border-border" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="bg-background border-border" placeholder="Optional notes" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border">Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RateCardsTab() {
  const { toast } = useToast();
  const [cards, setCards] = useState<RateCard[]>([]);
  const [modal, setModal] = useState<Partial<RateCard> | null | false>(false);

  const load = () => fetch(`${API}/rate-cards`).then(r => r.json()).then(setCards).catch(() => {});

  useEffect(() => { load(); }, []);

  const remove = async (id: number) => {
    if (!confirm("Delete this rate card?")) return;
    await fetch(`${API}/rate-cards/${id}`, { method: "DELETE" });
    toast({ title: "Rate card deleted" });
    load();
  };

  const fmt = (v: number) => `$${v.toFixed(0)}/hr`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Rate Cards</h3>
          <p className="text-xs text-muted-foreground/70 mt-0.5">Standard billing and cost rates by role and practice area. These are global defaults — projects can have their own overrides.</p>
        </div>
        <Button size="sm" onClick={() => setModal({})} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Rate Card
        </Button>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {cards.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground/60 text-sm">
              No rate cards yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left p-4">Name</th>
                  <th className="text-left p-4">Role</th>
                  <th className="text-left p-4">Practice Area</th>
                  <th className="text-right p-4">Billing Rate</th>
                  <th className="text-right p-4">Cost Rate</th>
                  <th className="text-center p-4">Effective</th>
                  <th className="text-right p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cards.map(card => (
                  <tr key={card.id} className="hover:bg-muted/30">
                    <td className="p-4 font-medium text-foreground">{card.name}</td>
                    <td className="p-4 text-muted-foreground">{card.role}</td>
                    <td className="p-4 text-muted-foreground">{card.practiceArea || "—"}</td>
                    <td className="p-4 text-right font-medium text-emerald-400">{fmt(card.billingRate)}</td>
                    <td className="p-4 text-right text-muted-foreground">{card.costRate ? fmt(card.costRate) : "—"}</td>
                    <td className="p-4 text-center text-muted-foreground text-xs">{card.effectiveDate || "—"}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setModal(card)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-500" onClick={() => remove(card.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {modal !== false && (
        <RateCardModal
          card={modal}
          onClose={() => setModal(false)}
          onSave={load}
        />
      )}
    </div>
  );
}

// ── Templates Tab ─────────────────────────────────────────────────────────────

interface Template { id: number; name: string; type: string; description?: string | null; }
interface TmplTask {
  id: number; templateId: number; parentId: number | null;
  name: string; taskType: string; sortOrder: number;
  estimatedHours: string | null; durationDays: number | null;
  resourceRole: string | null; depType: string;
}

const TASK_TYPE_LABELS: Record<string, string> = { parent: "Summary", work: "Work", milestone: "Milestone" };
const TEMPLATE_TYPES = ["implementation","cloud_migration","ams","release_cert","rate_maintenance","data_migration","custom_dev"];
const TEMPLATE_TYPE_LABELS: Record<string,string> = {
  implementation: "OTM Implementation", cloud_migration: "Cloud Migration", ams: "AMS Managed Services",
  release_cert: "Release Certification", rate_maintenance: "Rate Maintenance",
  data_migration: "Data Migration", custom_dev: "Custom Development",
};

function TemplateTaskRow({ task, allTasks, depth, onEdit, onDelete, onAddChild }: {
  task: TmplTask; allTasks: TmplTask[]; depth: number;
  onEdit: (t: TmplTask) => void; onDelete: (id: number) => void; onAddChild: (parentId: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = allTasks.filter(t => t.parentId === task.id);
  const isParent = task.taskType === "parent";
  const Icon = isParent ? Folder : task.taskType === "milestone" ? Square : ChevronRight;

  return (
    <>
      <tr className="hover:bg-muted/20 group">
        <td className="px-3 py-1.5">
          <div className="flex items-center gap-1" style={{ paddingLeft: depth * 20 }}>
            {isParent ? (
              <button onClick={() => setExpanded(e => !e)} className="p-0.5 rounded text-muted-foreground hover:text-foreground">
                {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
            ) : <div className="w-4" />}
            <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${isParent ? "text-violet-400" : task.taskType === "milestone" ? "text-amber-400" : "text-muted-foreground"}`} />
            <span className="text-sm text-foreground ml-1">{task.name}</span>
          </div>
        </td>
        <td className="px-3 py-1.5">
          <Badge variant="outline" className="text-[10px]">{TASK_TYPE_LABELS[task.taskType] || task.taskType}</Badge>
        </td>
        <td className="px-3 py-1.5 text-xs text-muted-foreground text-right">{task.estimatedHours ? `${task.estimatedHours}h` : "—"}</td>
        <td className="px-3 py-1.5 text-xs text-muted-foreground text-right">{task.durationDays ? `${task.durationDays}d` : "—"}</td>
        <td className="px-3 py-1.5 text-xs text-muted-foreground">{task.resourceRole || "—"}</td>
        <td className="px-3 py-1.5 text-right">
          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            {isParent && (
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-violet-400" onClick={() => onAddChild(task.id)} title="Add child task">
                <Plus className="h-3 w-3" />
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onEdit(task)}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:text-red-500" onClick={() => onDelete(task.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </td>
      </tr>
      {expanded && children.sort((a,b) => (a.sortOrder??0)-(b.sortOrder??0)).map(child => (
        <TemplateTaskRow key={child.id} task={child} allTasks={allTasks} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} onAddChild={onAddChild} />
      ))}
    </>
  );
}

function TemplateTaskModal({ templateId, task, onClose, onSave }: {
  templateId: number; task: Partial<TmplTask> | null; onClose: () => void; onSave: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!task?.id;
  const [form, setForm] = useState({
    name: task?.name ?? "", taskType: task?.taskType ?? "work",
    estimatedHours: task?.estimatedHours ?? "", durationDays: task?.durationDays?.toString() ?? "",
    resourceRole: task?.resourceRole ?? "", depType: task?.depType ?? "FS",
    sortOrder: task?.sortOrder?.toString() ?? "0",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const url = isEdit ? `${API}/template-tasks/${task!.id}` : `${API}/template-tasks`;
      const method = isEdit ? "PUT" : "POST";
      const body: any = { ...form, templateId, estimatedHours: form.estimatedHours || null, durationDays: form.durationDays || null };
      if (!isEdit && task?.parentId) body.parentId = task.parentId;
      await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      onSave(); onClose();
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">{isEdit ? "Edit" : "New"} Template Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-background border-border" placeholder="e.g. System Configuration" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Task Type</label>
              <select value={form.taskType} onChange={e => setForm(f => ({ ...f, taskType: e.target.value }))}
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm">
                <option value="parent">Summary (Parent)</option>
                <option value="work">Work Task</option>
                <option value="milestone">Milestone</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Dep Type</label>
              <select value={form.depType} onChange={e => setForm(f => ({ ...f, depType: e.target.value }))}
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm">
                <option value="FS">Finish-to-Start</option>
                <option value="SS">Start-to-Start</option>
                <option value="FF">Finish-to-Finish</option>
                <option value="SF">Start-to-Finish</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Est. Hours</label>
              <Input type="number" value={form.estimatedHours} onChange={e => setForm(f => ({ ...f, estimatedHours: e.target.value }))} className="bg-background border-border" placeholder="e.g. 40" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Duration (days)</label>
              <Input type="number" value={form.durationDays} onChange={e => setForm(f => ({ ...f, durationDays: e.target.value }))} className="bg-background border-border" placeholder="e.g. 5" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Resource Role</label>
              <Input value={form.resourceRole} onChange={e => setForm(f => ({ ...f, resourceRole: e.target.value }))} className="bg-background border-border" placeholder="e.g. Senior Consultant" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Sort Order</label>
              <Input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))} className="bg-background border-border" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border">Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateEditor({ template }: { template: Template }) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<TmplTask[]>([]);
  const [modal, setModal] = useState<Partial<TmplTask> | null | false>(false);

  const load = () => fetch(`${API}/template-tasks?templateId=${template.id}`).then(r => r.json()).then(setTasks).catch(() => {});

  useEffect(() => { load(); }, [template.id]);

  const remove = async (id: number) => {
    if (!confirm("Delete this task?")) return;
    await fetch(`${API}/template-tasks/${id}`, { method: "DELETE" });
    toast({ title: "Task deleted" });
    load();
  };

  const roots = tasks.filter(t => !t.parentId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const totalHours = tasks.reduce((s, t) => s + (parseFloat(t.estimatedHours ?? "0") || 0), 0);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-muted/30 flex items-center justify-between border-b">
        <div>
          <p className="text-sm font-semibold text-foreground">{template.name}</p>
          <p className="text-xs text-muted-foreground">{TEMPLATE_TYPE_LABELS[template.type] || template.type} · {tasks.length} tasks · {totalHours}h total</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-border" onClick={() => setModal({ taskType: "parent", sortOrder: roots.length })}>
            <Folder className="h-3 w-3" /> Add Summary
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setModal({ taskType: "work", sortOrder: tasks.length })}>
            <Plus className="h-3 w-3" /> Add Task
          </Button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground/60 text-sm">
          No tasks yet. Add a Summary task to create a WBS hierarchy, or add Work tasks directly.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] text-muted-foreground">
              <th className="text-left px-3 py-2">Task Name</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-right px-3 py-2">Est. Hours</th>
              <th className="text-right px-3 py-2">Duration</th>
              <th className="text-left px-3 py-2">Role</th>
              <th className="px-3 py-2 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {roots.map(task => (
              <TemplateTaskRow
                key={task.id} task={task} allTasks={tasks} depth={0}
                onEdit={t => setModal(t)}
                onDelete={remove}
                onAddChild={parentId => setModal({ taskType: "work", parentId, templateId: template.id, sortOrder: tasks.filter(t => t.parentId === parentId).length })}
              />
            ))}
          </tbody>
        </table>
      )}

      {modal !== false && (
        <TemplateTaskModal
          templateId={template.id}
          task={modal}
          onClose={() => setModal(false)}
          onSave={load}
        />
      )}
    </div>
  );
}

function TemplateFormModal({ tmpl, onClose, onSave }: { tmpl: Partial<Template> | null; onClose: () => void; onSave: () => void }) {
  const { toast } = useToast();
  const isEdit = !!tmpl?.id;
  const [form, setForm] = useState({ name: tmpl?.name ?? "", type: tmpl?.type ?? "implementation", description: tmpl?.description ?? "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const url = isEdit ? `${API}/templates/${tmpl!.id}` : `${API}/templates`;
      const method = isEdit ? "PUT" : "POST";
      await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      onSave(); onClose();
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">{isEdit ? "Edit" : "New"} Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-background border-border" placeholder="e.g. OTM Standard Implementation" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm">
              {TEMPLATE_TYPES.map(t => <option key={t} value={t}>{TEMPLATE_TYPE_LABELS[t] || t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-background border-border" placeholder="Optional description" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border">Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplatesTab() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [tmplModal, setTmplModal] = useState<Partial<Template> | null | false>(false);

  const load = () => fetch(`${API}/templates`).then(r => r.json()).then(setTemplates).catch(() => {});

  useEffect(() => { load(); }, []);

  const remove = async (id: number) => {
    if (!confirm("Delete this template and all its tasks? This cannot be undone.")) return;
    await fetch(`${API}/templates/${id}`, { method: "DELETE" });
    toast({ title: "Template deleted" });
    if (selected?.id === id) setSelected(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Project Templates (WBS)</h3>
          <p className="text-xs text-muted-foreground/70 mt-0.5">Define reusable WBS task hierarchies that get stamped into new projects. Use Summary tasks to create parent groups.</p>
        </div>
        <Button size="sm" onClick={() => setTmplModal({})} className="gap-1.5">
          <Plus className="h-4 w-4" /> New Template
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {templates.map(t => (
          <button key={t.id} onClick={() => setSelected(s => s?.id === t.id ? null : t)}
            className={`text-left rounded-lg border p-3 transition-all hover:shadow-sm ${selected?.id === t.id ? "border-violet-500 bg-violet-50/10" : "border-border hover:border-muted-foreground/40"}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground line-clamp-1">{t.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{TEMPLATE_TYPE_LABELS[t.type] || t.type}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={e => { e.stopPropagation(); setTmplModal(t); }}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:text-red-500" onClick={e => { e.stopPropagation(); remove(t.id); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            {t.description && <p className="text-xs text-muted-foreground/70 mt-1.5 line-clamp-2">{t.description}</p>}
          </button>
        ))}
        {templates.length === 0 && (
          <div className="col-span-3 py-12 text-center text-muted-foreground/60 text-sm">
            No templates yet. Create one to define a reusable WBS structure.
          </div>
        )}
      </div>

      {selected && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">WBS Tasks — {selected.name}</p>
          <TemplateEditor template={selected} />
        </div>
      )}

      {tmplModal !== false && (
        <TemplateFormModal tmpl={tmplModal} onClose={() => setTmplModal(false)} onSave={() => { load(); setSelected(null); }} />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

// ── FX Rates Tab ──────────────────────────────────────────────────────────────

interface FxRate {
  id: number;
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  effectiveDate: string;
}

function FxRatesTab() {
  const { toast } = useToast();
  const [rates, setRates] = useState<FxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRate, setEditRate] = useState("");
  const [editDate, setEditDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ fromCurrency: "", toCurrency: "CAD", rate: "", effectiveDate: new Date().toISOString().slice(0,10) });
  const [addSaving, setAddSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/fx-rates`);
      setRates(await r.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const startEdit = (rate: FxRate) => {
    setEditingId(rate.id);
    setEditRate(rate.rate);
    setEditDate(rate.effectiveDate);
  };

  const cancelEdit = () => { setEditingId(null); };

  const saveEdit = async (id: number) => {
    setSaving(true);
    try {
      const r = await fetch(`${API}/fx-rates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rate: editRate, effectiveDate: editDate }),
      });
      if (!r.ok) { toast({ title: "Failed to save", variant: "destructive" }); return; }
      toast({ title: "Rate updated" });
      setEditingId(null);
      load();
    } finally { setSaving(false); }
  };

  const deleteRate = async (id: number) => {
    if (!confirm("Delete this FX rate?")) return;
    await fetch(`${API}/fx-rates/${id}`, { method: "DELETE" });
    load();
  };

  const addRate = async () => {
    if (!addForm.fromCurrency.trim() || !addForm.rate || !addForm.effectiveDate) {
      toast({ title: "All fields required", variant: "destructive" }); return;
    }
    setAddSaving(true);
    try {
      const r = await fetch(`${API}/fx-rates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const d = await r.json();
      if (!r.ok) { toast({ title: d.error || "Failed to add rate", variant: "destructive" }); return; }
      toast({ title: "Rate added" });
      setShowAdd(false);
      setAddForm({ fromCurrency: "", toCurrency: "CAD", rate: "", effectiveDate: new Date().toISOString().slice(0,10) });
      load();
    } finally { setAddSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">FX Exchange Rates</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Rates used to convert resource costs and revenue to CAD in Finance reports. The most recent rate on or before the report date is applied.</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Rate
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground py-4">Loading rates…</p>
      ) : rates.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4">No FX rates configured.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">From</th>
                <th className="text-left px-4 py-2.5">To</th>
                <th className="text-left px-4 py-2.5">Rate</th>
                <th className="text-left px-4 py-2.5">Effective Date</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r, i) => (
                <tr key={r.id} className={`border-t border-border ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                  <td className="px-4 py-2.5 font-medium">{r.fromCurrency}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.toCurrency}</td>
                  <td className="px-4 py-2.5">
                    {editingId === r.id ? (
                      <Input type="number" step="0.000001" value={editRate}
                        onChange={e => setEditRate(e.target.value)}
                        className="h-7 w-32 text-xs bg-background" />
                    ) : (
                      <span className="tabular-nums">{parseFloat(r.rate).toFixed(6)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {editingId === r.id ? (
                      <Input type="date" value={editDate}
                        onChange={e => setEditDate(e.target.value)}
                        className="h-7 w-36 text-xs bg-background" />
                    ) : r.effectiveDate}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      {editingId === r.id ? (
                        <>
                          <button onClick={() => saveEdit(r.id)} disabled={saving}
                            className="p-1 rounded text-emerald-600 hover:bg-emerald-50 disabled:opacity-50" title="Save">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={cancelEdit}
                            className="p-1 rounded text-muted-foreground hover:bg-muted" title="Cancel">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(r)}
                            className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground" title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => deleteRate(r.id)}
                            className="p-1 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <Dialog open onOpenChange={() => setShowAdd(false)}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">Add FX Rate</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">From Currency *</label>
                  <Input value={addForm.fromCurrency}
                    onChange={e => setAddForm(f => ({ ...f, fromCurrency: e.target.value.toUpperCase() }))}
                    className="bg-background border-border" placeholder="USD, INR, EUR…" maxLength={5} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">To Currency</label>
                  <Input value={addForm.toCurrency}
                    onChange={e => setAddForm(f => ({ ...f, toCurrency: e.target.value.toUpperCase() }))}
                    className="bg-background border-border" placeholder="CAD" maxLength={5} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Rate * (1 {addForm.fromCurrency || "FROM"} = ? {addForm.toCurrency})
                </label>
                <Input type="number" step="0.000001" value={addForm.rate}
                  onChange={e => setAddForm(f => ({ ...f, rate: e.target.value }))}
                  className="bg-background border-border" placeholder="e.g. 1.360000" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Effective Date *</label>
                <Input type="date" value={addForm.effectiveDate}
                  onChange={e => setAddForm(f => ({ ...f, effectiveDate: e.target.value }))}
                  className="bg-background border-border" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={addRate} disabled={addSaving}>{addSaving ? "Adding…" : "Add Rate"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ── Appearance Tab ────────────────────────────────────────────────────────────

type ThemeMode = "light" | "dark" | "system";

function AppearanceTab() {
  const { toast } = useToast();
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try { return (localStorage.getItem("theme") as ThemeMode) ?? "system"; } catch { return "system"; }
  });

  const applyTheme = (t: ThemeMode) => {
    setTheme(t);
    try { localStorage.setItem("theme", t); } catch { }
    const root = document.documentElement;
    if (t === "dark") {
      root.classList.add("dark");
    } else if (t === "light") {
      root.classList.remove("dark");
    } else {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) root.classList.add("dark");
      else root.classList.remove("dark");
    }
    toast({ title: "Appearance updated", description: `Theme set to ${t}` });
  };

  const options: { value: ThemeMode; label: string; icon: React.ElementType; desc: string }[] = [
    { value: "light", label: "Light",  icon: Sun,     desc: "Always use light mode" },
    { value: "dark",  label: "Dark",   icon: Moon,    desc: "Always use dark mode" },
    { value: "system", label: "System", icon: Monitor, desc: "Match your OS setting" },
  ];

  return (
    <div className="space-y-6 max-w-lg">
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">Appearance</CardTitle>
          <p className="text-xs text-muted-foreground">Choose how BUSINESSNow looks for you.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {options.map(opt => {
              const active = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => applyTheme(opt.value)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                    active ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
                  )}
                >
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                    <opt.icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="text-center">
                    <p className={cn("text-xs font-semibold", active ? "text-primary" : "text-foreground")}>{opt.label}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{opt.desc}</p>
                  </div>
                  {active && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PMOSettingsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          <Settings2 className="h-5 w-5 text-violet-400" />
          <div>
            <h1 className="text-xl font-bold text-foreground">PMO Settings</h1>
            <p className="text-xs text-muted-foreground/70 mt-0.5">Configure time entry categories, rate cards, project templates, and delivery defaults</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <Tabs defaultValue="categories">
          <TabsList className="bg-card border border-border h-auto p-1 mb-6 flex-wrap gap-1">
            <TabsTrigger value="categories" className="data-[state=active]:bg-muted text-xs gap-1.5">
              <Tag className="h-3.5 w-3.5" /> Time Entry Categories
            </TabsTrigger>
            <TabsTrigger value="rate-cards" className="data-[state=active]:bg-muted text-xs gap-1.5">
              <CreditCard className="h-3.5 w-3.5" /> Rate Cards
            </TabsTrigger>
            <TabsTrigger value="templates" className="data-[state=active]:bg-muted text-xs gap-1.5">
              <Layout className="h-3.5 w-3.5" /> Templates (WBS)
            </TabsTrigger>
            <TabsTrigger value="fx-rates" className="data-[state=active]:bg-muted text-xs gap-1.5">
              <DollarSign className="h-3.5 w-3.5" /> FX Rates
            </TabsTrigger>
            <TabsTrigger value="appearance" className="data-[state=active]:bg-muted text-xs gap-1.5">
              <Sun className="h-3.5 w-3.5" /> Appearance
            </TabsTrigger>
          </TabsList>
          <TabsContent value="categories"><TimeEntryCategoriesTab /></TabsContent>
          <TabsContent value="rate-cards"><RateCardsTab /></TabsContent>
          <TabsContent value="templates"><TemplatesTab /></TabsContent>
          <TabsContent value="fx-rates"><FxRatesTab /></TabsContent>
          <TabsContent value="appearance"><AppearanceTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
