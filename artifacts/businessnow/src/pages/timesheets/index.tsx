import { useState, useMemo, useEffect, useCallback } from "react";
import { useListTimesheets, useListProjects } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  CheckCircle, CheckCircle2, XCircle, Clock, RotateCcw, Plus, Eye,
  Rocket, AlarmClock, ChevronLeft, ChevronRight, LayoutGrid, List, Receipt,
  Users, ShieldCheck, DollarSign,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "wouter";
import { format, startOfWeek, parseISO, addWeeks, addDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuthRole, ROLE_DEMO_RESOURCE, type Role } from "@/lib/auth";

const API_BASE = import.meta.env.BASE_URL + "api";
const BILLING_RATE = 125; // USD per hour for T&M invoice generation

const STATUS_BADGE: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  draft:     { variant: "outline",     label: "Draft" },
  submitted: { variant: "secondary",   label: "Submitted" },
  approved:  { variant: "default",     label: "Approved" },
  rejected:  { variant: "destructive", label: "Rejected" },
};

const CAN_LOG:     Role[] = ["admin", "delivery_director", "project_manager", "consultant"];
const CAN_APPROVE: Role[] = ["admin", "delivery_director", "project_manager"];
const CAN_VIEW_ALL:Role[] = ["admin", "delivery_director", "project_manager", "resource_manager", "finance_lead"];

async function timesheetAction(id: number, action: string, extra?: Record<string, string>) {
  const res = await fetch(`${API_BASE}/timesheets/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...extra }),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

interface LogTimeForm {
  projectId: string;
  projectName: string;
  taskId: string;
  taskName: string;
  categoryId: string;
  entryDate: string;
  hoursLogged: string;
  notes: string;
  isBillable: boolean;
}

const defaultForm = (): LogTimeForm => ({
  projectId:   "",
  projectName: "",
  taskId:      "",
  taskName:    "",
  categoryId:  "",
  entryDate:   format(new Date(), "yyyy-MM-dd"),
  hoursLogged: "8",
  notes:       "",
  isBillable:  true,
});

type Tab = "mine" | "review" | "billing";

// Per-cell entry data (stored in groupedRow.byDay)
interface CellEntry {
  id?: number;
  hours: string;
  status: string;
  notes?: string;
  dailyComment?: string;
  isBillable?: boolean;
  categoryId?: number;
}

// One row in the weekly grid (one project/task combination)
interface GroupedRow {
  key: string;
  projectId: number;
  projectName: string;
  taskId?: number;
  taskName?: string;
  categoryId?: number;
  isBillable: boolean;
  byDay: Record<string, CellEntry>;
}

const STEP = 0.25;
const SUBMIT_BYPASS_ROLES: Role[] = ["admin", "delivery_director"];

function roundToStep(v: number): number {
  return Math.min(24, Math.max(0, Math.round(v / STEP) * STEP));
}

function clientUTCMonday(): string {
  const now = new Date();
  const dow = now.getUTCDay();
  const back = dow === 0 ? 6 : dow - 1;
  const m = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - back));
  return m.toISOString().slice(0, 10);
}

// ── CellContextModal ──────────────────────────────────────────────────────────
// Opens when a consultant clicks a cell in the weekly grid.
// Enforces: mandatory description, 0.25h increments, task remaining-hours guardrail.
function CellContextModal({
  open, onClose, row, date, entry, taskMeta, taskNames, categories, resourceId, resourceName, weekStart, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  row: GroupedRow;
  date: string;
  entry?: CellEntry;
  taskMeta?: { etcHours: string | null; estimatedHours: string | null; loggedHours: number };
  taskNames: Record<number, string>;
  categories: { id: number; name: string; defaultBillable: boolean }[];
  resourceId: number;
  resourceName: string;
  weekStart: string;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const [isBillable, setIsBillable] = useState(true);
  const [catId, setCatId] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ hours?: string; notes?: string; task?: string }>({});

  // Reset state when modal opens with fresh entry data
  useEffect(() => {
    if (open) {
      const h = entry?.hours && parseFloat(entry.hours) > 0 ? entry.hours : "";
      setHours(h);
      setNotes(entry?.notes ?? "");
      setIsBillable(entry?.isBillable ?? row.isBillable ?? true);
      setCatId(entry?.categoryId ? String(entry.categoryId) : row.categoryId ? String(row.categoryId) : "");
      setErrors({});
    }
  }, [open, entry, row]);

  // Task remaining hours (approved entries only — draft not counted yet)
  const estimated = taskMeta?.estimatedHours ? parseFloat(taskMeta.estimatedHours) : null;
  const loggedApproved = taskMeta?.loggedHours ?? 0;
  const remaining = estimated !== null ? Math.max(0, estimated - loggedApproved) : null;

  const validate = () => {
    const errs: { hours?: string; notes?: string; task?: string } = {};
    const h = parseFloat(hours);
    if (!hours || isNaN(h) || h <= 0) {
      errs.hours = "Hours must be greater than 0";
    } else if (Math.abs(Math.round(h / 0.25) * 0.25 - h) > 0.001) {
      errs.hours = "Hours must be in 0.25 increments (e.g. 0.25, 0.5, 1.75, 2.0)";
    } else if (h > 24) {
      errs.hours = "Daily hours cannot exceed 24";
    }
    if (!notes.trim()) {
      errs.notes = "Description is required";
    }
    // Task remaining hours guardrail
    if (row.taskId && remaining !== null && !isNaN(h) && h > 0) {
      // Add back the current entry's hours since they aren't in loggedApproved yet
      const currentEntryHours = entry?.hours && parseFloat(entry.hours) > 0 ? parseFloat(entry.hours) : 0;
      const effectiveRemaining = remaining + currentEntryHours;
      if (h > effectiveRemaining) {
        errs.task = `Hours exceed remaining work on this task. Remaining: ${effectiveRemaining.toFixed(2)} hrs`;
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const h = parseFloat(hours);
      const categoryIdNum = catId ? parseInt(catId) : null;
      if (entry?.id) {
        await fetch(`${API_BASE}/timesheets/${entry.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hoursLogged: h, notes: notes.trim(), isBillable, categoryId: categoryIdNum }),
        });
      } else {
        await fetch(`${API_BASE}/timesheets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: row.projectId, projectName: row.projectName,
            resourceId, resourceName, weekStart, entryDate: date,
            hoursLogged: h, isBillable, taskId: row.taskId ?? null,
            categoryId: categoryIdNum, activityType: "consulting",
            notes: notes.trim(), dailyComment: notes.trim(), status: "draft",
          }),
        });
      }
      toast({ title: "Time entry saved" });
      onSaved();
      onClose();
    } catch {
      toast({ title: "Failed to save entry", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const dateLabel = (() => {
    try { return format(parseISO(date), "EEEE, MMM d"); } catch { return date; }
  })();
  const taskName = row.taskId ? (taskNames[row.taskId] ?? `Task #${row.taskId}`) : null;
  const currentEntryHours = entry?.hours && parseFloat(entry.hours) > 0 ? parseFloat(entry.hours) : 0;
  const effectiveRemaining = remaining !== null ? remaining + currentEntryHours : null;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-base">Log Time</DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            <span className="font-medium text-foreground">{row.projectName}</span> · {dateLabel}
          </p>
          {taskName && <p className="text-xs text-violet-400 mt-0.5">Task: {taskName}</p>}
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {/* Hours — 0.25 step, validated */}
          <div className="grid gap-1.5">
            <Label>Hours <span className="text-destructive">*</span></Label>
            <Input
              type="number" min="0.25" max="24" step="0.25"
              placeholder="e.g. 2.5"
              value={hours}
              onChange={e => { setHours(e.target.value); setErrors(prev => ({ ...prev, hours: undefined, task: undefined })); }}
              onBlur={e => {
                const parsed = parseFloat(e.target.value);
                if (!isNaN(parsed) && parsed > 0) setHours(String(roundToStep(parsed)));
              }}
            />
            {errors.hours && <p className="text-xs text-destructive">{errors.hours}</p>}
          </div>

          {/* Task remaining hours info */}
          {row.taskId && effectiveRemaining !== null && (
            <div className={`text-xs px-3 py-2 rounded-lg border ${
              effectiveRemaining <= 0
                ? "border-red-400/50 bg-red-950/20 text-red-400"
                : effectiveRemaining < 4
                  ? "border-amber-400/50 bg-amber-950/20 text-amber-400"
                  : "border-border bg-muted/30 text-muted-foreground"
            }`}>
              {effectiveRemaining <= 0
                ? "⚠ Task fully consumed — no remaining hours"
                : `${effectiveRemaining.toFixed(2)}h remaining on task · ${estimated}h estimated`
              }
            </div>
          )}
          {errors.task && <p className="text-xs text-destructive font-medium">⚠ {errors.task}</p>}

          {/* Daily Comment — mandatory */}
          <div className="grid gap-1.5">
            <Label>Daily Comment <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="Brief description of work done…"
              className="resize-none"
              rows={2}
              value={notes}
              onChange={e => { setNotes(e.target.value); setErrors(prev => ({ ...prev, notes: undefined })); }}
            />
            {errors.notes && <p className="text-xs text-destructive">{errors.notes}</p>}
          </div>

          {/* Time Category */}
          <div className="grid gap-1.5">
            <Label>Time Category</Label>
            <Select
              value={catId || "__none__"}
              onValueChange={val => {
                if (val === "__none__") { setCatId(""); return; }
                const cat = categories.find(c => String(c.id) === val);
                setCatId(val);
                if (cat) setIsBillable(cat.defaultBillable);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="— Select category —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Select category —</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Billable toggle — defaults from project/category */}
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Billable</p>
              <p className="text-xs text-muted-foreground">Include in client billing</p>
            </div>
            <Switch checked={isBillable} onCheckedChange={setIsBillable} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ADMIN_TASK_TYPES = ["Vacation / PTO", "Sick Leave", "Training", "Public Holidays", "Internal Meetings", "Business Development"];

// ── CollaborationModal ────────────────────────────────────────────────────────
function CollaborationModal({ open, onClose, projects, resourceId, resourceName, weekStart, onSaved }: {
  open: boolean; onClose: () => void;
  projects: any[]; resourceId: number; resourceName: string; weekStart: string;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [hours, setHours] = useState("1");
  const [comment, setComment] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [tasks, setTasks] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) { setProjectId(""); setTaskId(""); setHours("1"); setComment(""); setErrors({}); setDate(format(new Date(), "yyyy-MM-dd")); }
  }, [open]);
  useEffect(() => {
    if (!projectId) { setTasks([]); setTaskId(""); return; }
    fetch(`${API_BASE}/tasks?projectId=${projectId}&isLeaf=true`)
      .then(r => r.json()).then(d => setTasks(Array.isArray(d) ? d : []))
      .catch(() => setTasks([]));
  }, [projectId]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!projectId) e.projectId = "Project is required";
    const h = parseFloat(hours);
    if (!hours || isNaN(h) || h <= 0) e.hours = "Hours must be > 0";
    else if (Math.abs(Math.round(h / 0.25) * 0.25 - h) > 0.001) e.hours = "Must be 0.25 increments";
    if (!comment.trim()) e.comment = "Daily comment is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const ws = format(startOfWeek(parseISO(date), { weekStartsOn: 1 }), "yyyy-MM-dd");
      const selectedProject = projects.find(p => String(p.id) === projectId);
      const res = await fetch(`${API_BASE}/timesheets`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: parseInt(projectId), projectName: selectedProject?.name ?? "",
          resourceId, resourceName, weekStart: ws, entryDate: date,
          hoursLogged: parseFloat(hours), isBillable: false, isCollaboration: true,
          taskId: taskId ? parseInt(taskId) : null, activityType: "collaboration",
          notes: comment.trim(), dailyComment: comment.trim(), status: "draft",
        }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Failed"); }
      toast({ title: "Collaboration hours logged" });
      onSaved(); onClose();
    } catch (err: any) {
      toast({ title: err.message || "Failed to save", variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-base">Add Collaboration Hours</DialogTitle>
          <p className="text-xs text-muted-foreground">Log time spent collaborating on another team's project</p>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1.5">
            <Label>Project <span className="text-destructive">*</span></Label>
            <Select value={projectId || "__none__"} onValueChange={v => setProjectId(v === "__none__" ? "" : v)}>
              <SelectTrigger className={errors.projectId ? "border-destructive" : ""}><SelectValue placeholder="Select project…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select project…</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.projectId && <p className="text-xs text-destructive">{errors.projectId}</p>}
          </div>
          {tasks.length > 0 && (
            <div className="space-y-1.5">
              <Label>Task</Label>
              <Select value={taskId || "__none__"} onValueChange={v => setTaskId(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="— Optional task —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— No task —</SelectItem>
                  {tasks.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Hours <span className="text-destructive">*</span></Label>
              <Input type="number" min="0.25" step="0.25" value={hours} onChange={e => setHours(e.target.value)} className={errors.hours ? "border-destructive" : ""} />
              {errors.hours && <p className="text-xs text-destructive">{errors.hours}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Daily Comment <span className="text-destructive">*</span></Label>
            <Textarea rows={2} placeholder="Describe the collaboration work…" className={`resize-none ${errors.comment ? "border-destructive" : ""}`} value={comment} onChange={e => setComment(e.target.value)} />
            {errors.comment && <p className="text-xs text-destructive">{errors.comment}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Log Hours"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── WeeklyGrid ────────────────────────────────────────────────────────────────
// Mon–Sun columns. Cells are clickable — opens CellContextModal.
// allocatedProjectIds restricts the project picker for consultants.
function WeeklyGrid({ resourceId, resourceName, projects, categories, onRefetch, role, allocatedProjectIds, refreshKey }: {
  resourceId: number;
  resourceName: string;
  projects: any[];
  categories: { id: number; name: string; defaultBillable: boolean }[];
  onRefetch: () => void;
  role: Role | null;
  allocatedProjectIds?: number[];
  refreshKey?: number;
}) {
  const { toast } = useToast();
  const [weekOffset, setWeekOffset] = useState(0);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [cellModal, setCellModal] = useState<{ row: GroupedRow; date: string; entry?: CellEntry } | null>(null);
  // Pending rows: added locally via "Add project row" but not yet persisted to DB
  const [pendingRows, setPendingRows] = useState<Omit<GroupedRow, "byDay">[]>([]);
  const [addRow, setAddRow] = useState<{ projectId: string; projectName: string; taskId: string; taskName: string; categoryId: string; isBillable: boolean } | null>(null);
  const [addTasks, setAddTasks] = useState<any[]>([]);
  const [taskMeta, setTaskMeta] = useState<Record<number, { etcHours: string | null; estimatedHours: string | null; loggedHours: number }>>({});
  const [taskNames, setTaskNames] = useState<Record<number, string>>({});
  const [submitBusy, setSubmitBusy] = useState<string | null>(null);
  // Admin project row (always visible, not removable)
  const [adminProject, setAdminProject] = useState<{ id: number; name: string } | null>(null);
  // Collaboration modal
  const [collabOpen, setCollabOpen] = useState(false);

  const weekStart = format(addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset), "yyyy-MM-dd");
  const days = Array.from({ length: 7 }, (_, i) => addDays(parseISO(weekStart), i));
  const dayKeys = days.map(d => format(d, "yyyy-MM-dd"));
  const today = format(new Date(), "yyyy-MM-dd");
  const isFutureWeek = weekStart > clientUTCMonday();
  const canBypassFutureWeek = role !== null && (SUBMIT_BYPASS_ROLES as string[]).includes(role);
  const submitBlocked = isFutureWeek && !canBypassFutureWeek;

  // Project list filtered by allocations (for consultant role)
  const filteredProjects = useMemo(() => {
    if (!allocatedProjectIds) return projects;
    return projects.filter(p => allocatedProjectIds.includes(Number(p.id)));
  }, [projects, allocatedProjectIds]);

  const loadTaskMeta = useCallback((rows: any[]) => {
    const taskIds = [...new Set(rows.map((e: any) => e.taskId).filter(Boolean))] as number[];
    taskIds.forEach(taskId => {
      fetch(`${API_BASE}/tasks/${taskId}`)
        .then(r => r.json())
        .then(task => {
          if (!task || task.error) return;
          setTaskMeta(prev => ({
            ...prev,
            [taskId]: {
              etcHours: task.etcHours ?? null,
              estimatedHours: task.estimatedHours ?? null,
              loggedHours: parseFloat(task.loggedHours ?? "0") || 0,
            },
          }));
          if (task.name) setTaskNames(prev => ({ ...prev, [taskId]: task.name }));
        })
        .catch(() => {});
    });
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/timesheets?resourceId=${resourceId}&weekStart=${weekStart}`)
      .then(r => r.json())
      .then(d => {
        const rows = Array.isArray(d) ? d : [];
        setEntries(rows);
        loadTaskMeta(rows);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [resourceId, weekStart, loadTaskMeta]);

  useEffect(() => { load(); }, [load, refreshKey]);

  // Fetch the administrative project once
  useEffect(() => {
    fetch(`${API_BASE}/projects?isAdministrative=true`)
      .then(r => r.json())
      .then(d => {
        const projects = Array.isArray(d) ? d : [];
        if (projects.length > 0) setAdminProject({ id: projects[0].id, name: projects[0].name });
      })
      .catch(() => {});
  }, []);

  // Build grouped rows from entries — includes per-cell notes/isBillable/categoryId
  const groupedRows = useMemo<GroupedRow[]>(() => {
    const map = new Map<string, GroupedRow>();
    entries.forEach(e => {
      const key = `${e.projectId}-${e.taskId ?? ""}`;
      if (!map.has(key)) {
        map.set(key, {
          key, projectId: e.projectId, projectName: e.projectName,
          taskId: e.taskId ?? undefined, taskName: undefined,
          categoryId: e.categoryId ?? undefined, isBillable: e.isBillable ?? true,
          byDay: {},
        });
      }
      const row = map.get(key)!;
      if (e.entryDate) {
        row.byDay[e.entryDate] = {
          id: e.id, hours: String(e.hoursLogged ?? ""), status: e.status,
          notes: e.notes ?? "", dailyComment: e.dailyComment ?? undefined,
          isBillable: e.isBillable ?? true,
          categoryId: e.categoryId ?? undefined,
        };
      }
    });
    return Array.from(map.values());
  }, [entries]);

  // Remove pending rows that now have real DB entries
  useEffect(() => {
    setPendingRows(prev => prev.filter(p => !groupedRows.some(r => r.key === p.key)));
  }, [groupedRows]);

  // Combined display rows: always show every allocated project, then task-specific extras, then pending
  const allRows = useMemo<GroupedRow[]>(() => {
    // One row per allocated project (base, no-task rows)
    const baseRows: GroupedRow[] = filteredProjects.map(p => {
      const key = `${p.id}-`;
      const existing = groupedRows.find(r => r.key === key);
      return existing ?? {
        key, projectId: p.id, projectName: p.name,
        taskId: undefined, taskName: undefined,
        categoryId: undefined, isBillable: true, byDay: {},
      };
    });
    // Task-specific rows from DB that aren't covered by base rows
    const extraRows = groupedRows.filter(r => r.taskId && !baseRows.some(b => b.key === r.key));
    // Pending rows not yet persisted
    const pendingAsRows = pendingRows
      .filter(p => !baseRows.some(b => b.key === p.key) && !extraRows.some(e => e.key === p.key))
      .map(p => ({ ...p, byDay: {} as Record<string, CellEntry> }));
    return [...baseRows, ...extraRows, ...pendingAsRows];
  }, [filteredProjects, groupedRows, pendingRows]);

  const totalByDay = useMemo(() => {
    const totals: Record<string, number> = {};
    dayKeys.forEach(d => { totals[d] = 0; });
    entries.forEach(e => {
      if (e.entryDate && totals[e.entryDate] !== undefined)
        totals[e.entryDate] += parseFloat(String(e.hoursLogged ?? 0));
    });
    return totals;
  }, [entries, dayKeys]);

  const billableByDay = useMemo(() => {
    const totals: Record<string, number> = {};
    dayKeys.forEach(d => { totals[d] = 0; });
    entries.forEach(e => {
      if (e.entryDate && e.isBillable && totals[e.entryDate] !== undefined)
        totals[e.entryDate] += parseFloat(String(e.hoursLogged ?? 0));
    });
    return totals;
  }, [entries, dayKeys]);

  // Build admin project row from entries
  const adminRow = useMemo<GroupedRow | null>(() => {
    if (!adminProject) return null;
    const key = `${adminProject.id}-`;
    const byDay: Record<string, CellEntry> = {};
    entries.filter(e => e.projectId === adminProject.id && !e.taskId).forEach(e => {
      if (e.entryDate) byDay[e.entryDate] = { id: e.id, hours: String(e.hoursLogged ?? ""), status: e.status, notes: e.notes ?? "", isBillable: e.isBillable ?? false };
    });
    return { key, projectId: adminProject.id, projectName: adminProject.name, taskId: undefined, taskName: undefined, categoryId: undefined, isBillable: false, byDay };
  }, [adminProject, entries]);

  const weekTotal = Object.values(totalByDay).reduce((a, b) => a + b, 0);

  // Fetch tasks when project is chosen in the add-row form
  useEffect(() => {
    if (!addRow?.projectId) { setAddTasks([]); return; }
    fetch(`${API_BASE}/tasks?projectId=${addRow.projectId}`)
      .then(r => r.json()).then(d => setAddTasks(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [addRow?.projectId]);

  // Add a pending task-specific row
  const handleAddRow = () => {
    if (!addRow?.projectId) return;
    const key = `${addRow.projectId}-${addRow.taskId}`;
    if (allRows.some(r => r.key === key)) {
      toast({ title: "Row already exists for this project/task" });
      setAddRow(null);
      return;
    }
    setPendingRows(prev => [...prev, {
      key,
      projectId: parseInt(addRow.projectId),
      projectName: addRow.projectName,
      taskId: addRow.taskId ? parseInt(addRow.taskId) : undefined,
      taskName: addRow.taskName || undefined,
      categoryId: addRow.categoryId ? parseInt(addRow.categoryId) : undefined,
      isBillable: addRow.isBillable,
    }]);
    setAddRow(null);
  };

  // Toggle billable flag on a single entry
  const toggleBillable = useCallback(async (entryId: number, current: boolean) => {
    try {
      await fetch(`${API_BASE}/timesheets/${entryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBillable: !current }),
      });
      load();
    } catch {
      toast({ title: "Failed to update billable flag", variant: "destructive" });
    }
  }, [load, toast]);

  // Submit all draft entries for a single day across all project rows
  const submitDay = async (dayKey: string) => {
    const draftCells = allRows
      .map(row => row.byDay[dayKey])
      .filter((c): c is CellEntry => !!(c?.id && c?.status === "draft"));
    if (draftCells.length === 0) {
      toast({ title: "No draft entries for this day", variant: "destructive" }); return;
    }
    const missingDesc = draftCells.filter(c => !c.notes?.trim());
    if (missingDesc.length > 0) {
      toast({
        title: "Description required",
        description: `${missingDesc.length} entr${missingDesc.length > 1 ? "ies are" : "y is"} missing a description. Click each cell to add.`,
        variant: "destructive",
      });
      return;
    }
    setSubmitBusy(dayKey);
    try {
      for (const cell of draftCells) {
        const res = await fetch(`${API_BASE}/timesheets/${cell.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "submit", role: role ?? undefined }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (err.error === "FUTURE_WEEK_SUBMISSION") {
            toast({ title: "Cannot submit — future week", description: err.message, variant: "destructive" });
            return;
          }
        }
      }
      toast({ title: `${format(parseISO(dayKey), "EEE MMM d")} submitted for approval` });
    } finally {
      setSubmitBusy(null);
      load(); onRefetch();
    }
  };

  // Per-day draft counts and status summary
  const dayDraftCount = useMemo(() => {
    const counts: Record<string, number> = {};
    dayKeys.forEach(d => {
      counts[d] = allRows.filter(r => r.byDay[d]?.status === "draft" && r.byDay[d]?.id).length;
    });
    return counts;
  }, [allRows, dayKeys]);

  const dayAllApproved = useMemo(() => {
    const approved: Record<string, boolean> = {};
    dayKeys.forEach(d => {
      const logged = allRows.filter(r => r.byDay[d]);
      approved[d] = logged.length > 0 && logged.every(r => r.byDay[d]?.status === "approved");
    });
    return approved;
  }, [allRows, dayKeys]);

  return (
    <div className="space-y-0">
      {/* ── Week navigation bar ── */}
      <div className="flex items-center gap-2 py-2.5 px-4 border-b border-border bg-card">
        <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="Previous week">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold min-w-[160px] text-center">
          {format(parseISO(weekStart), "MMM d")} – {format(addDays(parseISO(weekStart), 6), "MMM d, yyyy")}
        </span>
        <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="Next week">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button onClick={() => setWeekOffset(0)} className="text-xs text-primary hover:underline ml-1">
          Today
        </button>
        {isFutureWeek && (
          <span className="text-[11px] text-amber-400 font-medium border border-amber-400/30 bg-amber-950/20 px-2 py-0.5 rounded-full">
            Future week
          </span>
        )}
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          {loading && <span className="animate-pulse">Loading…</span>}
          {!loading && weekTotal > 0 && (
            <span className="font-semibold text-foreground">{weekTotal}h this week</span>
          )}
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[860px] border-separate border-spacing-0">
          {/* Column headers */}
          <thead>
            <tr className="bg-muted/30">
              <th className="text-left px-4 py-3 w-52 font-medium text-muted-foreground border-b border-border sticky left-0 bg-muted/30 z-10">
                Project / Task
              </th>
              {days.map(d => {
                const dk = format(d, "yyyy-MM-dd");
                const isToday = dk === today;
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <th key={dk} className={`px-2 py-3 text-center font-medium border-b border-border w-[92px] ${
                    isToday ? "text-primary" : isWeekend ? "text-muted-foreground/40" : "text-muted-foreground"
                  }`}>
                    <div className={`text-[11px] font-semibold ${isToday ? "text-primary" : ""}`}>{format(d, "EEE")}</div>
                    <div className={`text-[10px] mt-0.5 ${isToday ? "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center mx-auto font-bold" : "font-normal"}`}>
                      {format(d, "d")}
                    </div>
                  </th>
                );
              })}
              <th className="px-3 py-3 text-center font-medium text-muted-foreground border-b border-border w-16 sticky right-0 bg-muted/30 z-10 border-l border-border shadow-[-4px_0_8px_rgba(0,0,0,0.08)]">
                Total
              </th>
            </tr>
          </thead>

          <tbody>
            {/* ── Project/Task rows ── */}
            {allRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto opacity-20 mb-2" />
                  <p className="text-sm">No projects allocated to you for this period.</p>
                </td>
              </tr>
            ) : allRows.map((row, rowIdx) => {
              const rowTotal = dayKeys.reduce((s, d) => s + (parseFloat(row.byDay[d]?.hours ?? "0") || 0), 0);
              const isLast = rowIdx === allRows.length - 1;

              return (
                <tr key={row.key} className="group hover:bg-muted/10 transition-colors">
                  {/* Project name cell */}
                  <td className={`px-4 py-2.5 sticky left-0 bg-card group-hover:bg-muted/10 transition-colors z-10 ${isLast ? "" : "border-b border-border/50"}`}>
                    <div className="font-medium text-foreground truncate max-w-[188px] leading-tight">{row.projectName}</div>
                    {row.taskId ? (
                      <div className="text-muted-foreground/60 truncate max-w-[188px] text-[10px] mt-0.5 flex items-center gap-1">
                        <span className="inline-block w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0" />
                        {taskNames[row.taskId] ?? row.taskName ?? `Task #${row.taskId}`}
                      </div>
                    ) : null}
                  </td>

                  {/* Day cells */}
                  {dayKeys.map(d => {
                    const cell = row.byDay[d];
                    const locked = cell?.status === "submitted" || cell?.status === "approved";
                    const isWeekend = parseISO(d).getDay() === 0 || parseISO(d).getDay() === 6;
                    const hasHours = !!(cell?.hours && parseFloat(cell.hours) > 0);
                    const cellStatus = cell?.status ?? null;
                    const badgeCls =
                      cellStatus === "submitted" ? "text-amber-300 bg-amber-950/40 border border-amber-400/40 ring-0" :
                      cellStatus === "approved"  ? "text-emerald-300 bg-emerald-950/40 border border-emerald-400/40" :
                      cellStatus === "rejected"  ? "text-red-300 bg-red-950/40 border border-red-400/40 line-through" :
                      "text-foreground bg-muted/50 border border-border";

                    const isCellBillable = cell?.isBillable !== false;
                    const nonBillableDraft = hasHours && !locked && !isCellBillable;
                    const nonBillableBadgeCls = "text-muted-foreground/70 bg-muted/30 border border-border/50 line-through";

                    return (
                      <td
                        key={d}
                        onClick={() => !locked && !isWeekend && setCellModal({ row, date: d, entry: cell })}
                        title={
                          isWeekend ? "Weekend" :
                          locked ? `${cellStatus} — click not available` :
                          hasHours ? `${cell!.hours}h · "${cell!.notes || "no description"}"${isCellBillable ? "" : " · non-billable"} — click to edit` :
                          "Click to log hours"
                        }
                        className={[
                          "px-1.5 py-2 text-center transition-all relative",
                          isLast ? "" : "border-b border-border/50",
                          isWeekend ? "bg-muted/5" : "",
                          nonBillableDraft ? "bg-muted/20" : "",
                          !locked && !isWeekend ? "cursor-pointer" : "",
                        ].join(" ")}
                      >
                        {isWeekend ? (
                          <span className="text-muted-foreground/15 text-[10px]">—</span>
                        ) : hasHours ? (
                          <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold rounded-md px-1.5 py-0.5 ${isCellBillable ? badgeCls : nonBillableBadgeCls}`}>
                            {!isCellBillable && (
                              <span className="relative inline-flex" title="Non-billable">
                                <DollarSign className="h-2.5 w-2.5 opacity-50" />
                                <span className="absolute inset-x-0 top-1/2 h-px bg-current opacity-70 -rotate-12" />
                              </span>
                            )}
                            {parseFloat(cell!.hours)}h
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-dashed border-border/40 text-muted-foreground/20 hover:border-primary/50 hover:text-primary/40 transition-colors">
                            <Plus className="h-3 w-3" />
                          </span>
                        )}
                        {/* Comment indicator — shown when dailyComment or notes exist */}
                        {hasHours && (cell?.dailyComment || cell?.notes) && (
                          <span
                            className="absolute bottom-0.5 left-0.5 text-[9px] leading-none text-primary/50"
                            title={cell?.dailyComment || cell?.notes || ""}
                          >
                            💬
                          </span>
                        )}
                        {/* Billable toggle button — draft cells only, visible on row hover */}
                        {hasHours && !locked && cell?.id && (
                          <button
                            onClick={e => { e.stopPropagation(); toggleBillable(cell!.id!, isCellBillable); }}
                            title={isCellBillable ? "Mark as non-billable" : "Mark as billable"}
                            className={[
                              "absolute top-0.5 right-0.5 flex items-center justify-center w-4 h-4 rounded-sm transition-all",
                              "opacity-0 group-hover:opacity-100",
                              isCellBillable
                                ? "text-muted-foreground/50 hover:text-amber-400"
                                : "text-amber-400 hover:text-primary opacity-100",
                            ].join(" ")}
                          >
                            <DollarSign className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </td>
                    );
                  })}

                  {/* Row total */}
                  <td className={`px-3 py-2 text-center font-semibold text-[11px] sticky right-0 bg-card z-10 border-l border-border/50 shadow-[-4px_0_8px_rgba(0,0,0,0.06)] ${isLast ? "" : "border-b border-border/50"} ${rowTotal > 0 ? "text-foreground" : "text-muted-foreground/30"}`}>
                    {rowTotal > 0 ? `${rowTotal}h` : "—"}
                  </td>
                </tr>
              );
            })}

            {/* ── Collaboration row — dashed, additive ── */}
            <tr className="border-t border-dashed border-amber-500/30 bg-amber-950/10">
              <td colSpan={9} className="px-4 py-1.5 sticky left-0 z-10 bg-amber-950/10">
                <button
                  onClick={() => setCollabOpen(true)}
                  className="flex items-center gap-1.5 text-[11px] text-amber-400 hover:text-amber-300 transition-colors font-medium"
                >
                  <Users className="h-3 w-3" />
                  + Add collaboration hours
                </button>
              </td>
            </tr>

            {/* ── Admin project row (always visible, not removable) ── */}
            {adminRow && (() => {
              const rowTotal = dayKeys.reduce((s, d) => s + (parseFloat(adminRow.byDay[d]?.hours ?? "0") || 0), 0);
              return (
                <tr key={adminRow.key} className="group hover:bg-muted/10 transition-colors border-t border-border/50 bg-muted/5">
                  <td className="px-4 py-2.5 sticky left-0 bg-muted/5 group-hover:bg-muted/10 transition-colors z-10">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                      <div className="font-medium text-foreground/70 truncate max-w-[160px] leading-tight text-[11px]">{adminRow.projectName}</div>
                    </div>
                    <div className="text-[10px] text-muted-foreground/40 ml-5">Administrative</div>
                  </td>
                  {dayKeys.map(d => {
                    const cell = adminRow.byDay[d];
                    const locked = cell?.status === "submitted" || cell?.status === "approved";
                    const isWeekend = parseISO(d).getDay() === 0 || parseISO(d).getDay() === 6;
                    const hasHours = !!(cell?.hours && parseFloat(cell.hours) > 0);
                    const badgeCls = cell?.status === "submitted" ? "text-amber-300 bg-amber-950/40 border border-amber-400/40" :
                      cell?.status === "approved" ? "text-emerald-300 bg-emerald-950/40 border border-emerald-400/40" :
                      "text-foreground/60 bg-muted/40 border border-border";
                    return (
                      <td key={d} onClick={() => !locked && !isWeekend && setCellModal({ row: adminRow, date: d, entry: cell })}
                        className={["px-1.5 py-2 text-center transition-all", isWeekend ? "bg-muted/5" : "", !locked && !isWeekend ? "cursor-pointer" : ""].join(" ")}
                      >
                        {isWeekend ? <span className="text-muted-foreground/15 text-[10px]">—</span>
                          : hasHours ? <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold rounded-md px-2 py-0.5 ${badgeCls}`}>{parseFloat(cell!.hours)}h</span>
                          : <span className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-dashed border-border/30 text-muted-foreground/20 hover:border-amber-500/40 hover:text-amber-400/40 transition-colors"><Plus className="h-3 w-3" /></span>}
                      </td>
                    );
                  })}
                  <td className={`px-3 py-2 text-center font-semibold text-[11px] sticky right-0 bg-card z-10 border-l border-border/50 shadow-[-4px_0_8px_rgba(0,0,0,0.06)] ${rowTotal > 0 ? "text-foreground/60" : "text-muted-foreground/30"}`}>
                    {rowTotal > 0 ? `${rowTotal}h` : "—"}
                  </td>
                </tr>
              );
            })()}

            {/* ── Day totals row ── */}
            <tr className="border-t-2 border-border bg-muted/20">
              <td className="px-4 py-2 text-[11px] font-semibold text-muted-foreground sticky left-0 bg-muted/20 z-10">
                Day Total
              </td>
              {dayKeys.map(d => {
                const isWeekend = parseISO(d).getDay() === 0 || parseISO(d).getDay() === 6;
                const total = totalByDay[d] ?? 0;
                const overLimit = total > 8;
                return (
                  <td key={d} className={`px-2 py-2 text-center text-[11px] font-bold ${
                    isWeekend ? "text-muted-foreground/20" :
                    overLimit ? "text-amber-400" :
                    total > 0 ? "text-foreground" : "text-muted-foreground/30"
                  }`}>
                    {total > 0 ? `${total}h` : "—"}
                    {overLimit && <span className="text-[8px] block text-amber-400/70">over</span>}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-center text-[11px] font-bold text-foreground sticky right-0 bg-muted/20 z-10 border-l-2 border-border shadow-[-4px_0_8px_rgba(0,0,0,0.08)]">
                {weekTotal > 0 ? `${weekTotal}h` : "—"}
              </td>
            </tr>

            {/* ── Billable Hours row ── */}
            <tr className="border-t border-border/40 bg-muted/10">
              <td className="px-4 py-1.5 text-[10px] font-medium text-muted-foreground/60 sticky left-0 bg-muted/10 z-10">
                Billable Hours
              </td>
              {dayKeys.map(d => {
                const isWeekend = parseISO(d).getDay() === 0 || parseISO(d).getDay() === 6;
                const billable = billableByDay[d] ?? 0;
                const dayTotal = totalByDay[d] ?? 0;
                const nonBillable = dayTotal - billable;
                return (
                  <td key={d} className={`px-2 py-1.5 text-center text-[10px] ${isWeekend ? "text-muted-foreground/15" : billable > 0 ? "text-emerald-400/80" : "text-muted-foreground/30"}`}>
                    {isWeekend ? "—" : billable > 0 ? (
                      <span>
                        {billable}h
                        {nonBillable > 0 && <span className="text-muted-foreground/40 block text-[9px]">({nonBillable}h NB)</span>}
                      </span>
                    ) : "—"}
                  </td>
                );
              })}
              <td className="px-3 py-1.5 text-center text-[10px] text-muted-foreground/50">
                {Object.values(billableByDay).reduce((a, b) => a + b, 0) > 0
                  ? `${Object.values(billableByDay).reduce((a, b) => a + b, 0)}h`
                  : "—"}
              </td>
            </tr>

            {/* ── Per-day submit buttons row ── */}
            <tr className="border-t border-border/60 bg-card">
              <td className="px-4 py-2.5 sticky left-0 bg-card z-10">
                <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-medium">Submit</span>
              </td>
              {dayKeys.map(d => {
                const isWeekend = parseISO(d).getDay() === 0 || parseISO(d).getDay() === 6;
                const count = dayDraftCount[d] ?? 0;
                const allApproved = dayAllApproved[d];
                const isBusy = submitBusy === d;

                if (isWeekend) return (
                  <td key={d} className="px-1.5 py-2.5 bg-muted/5" />
                );

                return (
                  <td key={d} className="px-1.5 py-2.5 text-center">
                    {count > 0 ? (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-block w-full">
                              <button
                                onClick={() => !submitBlocked && submitDay(d)}
                                disabled={submitBlocked || isBusy}
                                className="w-full text-[10px] font-semibold bg-primary text-primary-foreground px-1 py-1.5 rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors leading-none"
                              >
                                {isBusy ? (
                                  <span className="flex items-center justify-center gap-1">
                                    <span className="animate-spin inline-block w-2.5 h-2.5 border border-t-transparent border-white rounded-full" />
                                  </span>
                                ) : (
                                  <>Submit{count > 1 ? ` (${count})` : ""}</>
                                )}
                              </button>
                            </span>
                          </TooltipTrigger>
                          {submitBlocked ? (
                            <TooltipContent side="top" className="text-xs max-w-[180px]">
                              Cannot submit future week entries before {weekStart}
                            </TooltipContent>
                          ) : (
                            <TooltipContent side="top" className="text-xs">
                              Submit {count} entr{count > 1 ? "ies" : "y"} for {format(parseISO(d), "EEE MMM d")}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    ) : allApproved ? (
                      <span className="text-[10px] text-emerald-400 font-medium flex items-center justify-center gap-0.5">
                        <CheckCircle className="h-3 w-3" /> Done
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/20">—</span>
                    )}
                  </td>
                );
              })}
              <td className="px-3 py-2.5" />
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Add task-specific row footer ── */}
      <div className="px-4 py-2.5 border-t border-border/40 bg-card">
        {addRow ? (
          <div className="flex gap-2 items-end flex-wrap">
            <div>
              <label className="text-[10px] text-muted-foreground block mb-0.5">Project *</label>
              <Select
                value={addRow.projectId || "__none__"}
                onValueChange={val => {
                  if (val === "__none__") { setAddRow(r => r ? { ...r, projectId: "", projectName: "", taskId: "", taskName: "" } : r); return; }
                  const p = filteredProjects.find(x => String(x.id) === val);
                  setAddRow(r => r ? { ...r, projectId: val, projectName: p?.name ?? "", taskId: "", taskName: "" } : r);
                }}
              >
                <SelectTrigger className="h-8 text-xs w-48"><SelectValue placeholder="Select project…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select project…</SelectItem>
                  {filteredProjects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-0.5">Task</label>
              <Select
                value={addRow.taskId || "__none__"}
                onValueChange={val => {
                  if (val === "__none__") { setAddRow(r => r ? { ...r, taskId: "", taskName: "" } : r); return; }
                  const t = addTasks.find(t => String(t.id) === val);
                  setAddRow(r => r ? { ...r, taskId: val, taskName: t?.name ?? "" } : r);
                }}
              >
                <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="— No task —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— No task —</SelectItem>
                  {addTasks.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <button onClick={handleAddRow} disabled={!addRow.projectId} className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs disabled:opacity-50 hover:bg-primary/90">
              Add Row
            </button>
            <button onClick={() => setAddRow(null)} className="h-8 px-2 rounded-md bg-muted text-xs text-muted-foreground hover:bg-muted/80">
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddRow({ projectId: "", projectName: "", taskId: "", taskName: "", categoryId: "", isBillable: true })}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add task-specific row
          </button>
        )}
      </div>

      {/* Cell context modal */}
      {cellModal && (
        <CellContextModal
          open
          onClose={() => setCellModal(null)}
          row={cellModal.row}
          date={cellModal.date}
          entry={cellModal.entry}
          taskMeta={cellModal.row.taskId ? taskMeta[cellModal.row.taskId] : undefined}
          taskNames={taskNames}
          categories={categories}
          resourceId={resourceId}
          resourceName={resourceName}
          weekStart={weekStart}
          onSaved={load}
        />
      )}

      {/* Collaboration modal */}
      <CollaborationModal
        open={collabOpen}
        onClose={() => setCollabOpen(false)}
        projects={projects}
        resourceId={resourceId}
        resourceName={resourceName}
        weekStart={weekStart}
        onSaved={load}
      />
    </div>
  );
}

// ── TimesheetsList (main page) ─────────────────────────────────────────────────
export default function TimesheetsList() {
  const { role } = useAuthRole();
  const { data: timesheets, isLoading, refetch } = useListTimesheets();
  const { data: projects } = useListProjects();
  const { toast } = useToast();

  const canLog     = role ? CAN_LOG.includes(role)      : false;
  const canApprove = role ? CAN_APPROVE.includes(role)  : false;
  const canViewAll = role ? CAN_VIEW_ALL.includes(role) : false;
  const isFinance  = role === "finance_lead";

  const myResource = role ? ROLE_DEMO_RESOURCE[role] : undefined;

  // Default tab: finance goes to billing queue first
  const defaultTab: Tab = isFinance ? "billing" : canLog && !canViewAll ? "mine" : canViewAll ? "review" : "mine";
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  const [filterStatus, setFilterStatus]   = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [actingId, setActingId]           = useState<number | null>(null);
  const [logOpen, setLogOpen]             = useState(false);
  const [form, setForm]                   = useState<LogTimeForm>(defaultForm());
  const [submitting, setSubmitting]       = useState(false);
  const [rejectId, setRejectId]           = useState<number | null>(null);
  const [rejectReason, setRejectReason]   = useState("");
  const [rejectError, setRejectError]     = useState("");
  const [missingTimesheets, setMissingTimesheets] = useState<{
    missingCount: number; totalResources: number; weekStart: string;
    missingResources: { id: number; name: string }[];
  } | null>(null);
  const [categories, setCategories]   = useState<{ id: number; name: string; defaultBillable: boolean; isActive: boolean }[]>([]);
  const [projectTasks, setProjectTasks] = useState<{ id: number; name: string; assignedToId?: number }[]>([]);
  const [tsView, setTsView]           = useState<"list" | "grid">("grid");
  const [gridRefreshKey, setGridRefreshKey] = useState(0);

  // ── Consultant project access control ──────────────────────────────────────
  // Fetch allocations for consultant; filter project list to allocated only.
  const [allocatedProjectIds, setAllocatedProjectIds] = useState<number[] | null>(null);

  useEffect(() => {
    if (role !== "consultant" || !myResource) { setAllocatedProjectIds(null); return; }
    fetch(`${API_BASE}/allocations?resourceId=${myResource.id}`)
      .then(r => r.json())
      .then(d => {
        if (!Array.isArray(d)) return;
        setAllocatedProjectIds([...new Set(d.map((a: any) => Number(a.projectId)))]);
      })
      .catch(() => {});
  }, [role, myResource?.id]);

  useEffect(() => {
    fetch(`${API_BASE}/time-entry-categories`)
      .then(r => r.json())
      .then(d => setCategories(Array.isArray(d) ? d.filter((c: any) => c.isActive) : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.projectId) { setProjectTasks([]); return; }
    fetch(`${API_BASE}/tasks?projectId=${form.projectId}`)
      .then(r => r.json()).then(d => setProjectTasks(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [form.projectId]);

  useEffect(() => {
    if (!canViewAll) return;
    fetch(`${API_BASE}/timesheets/missing`)
      .then(r => r.json())
      .then(d => setMissingTimesheets(d && typeof d.missingCount === "number" ? d : null))
      .catch(() => {});
  }, [canViewAll]);

  // Projects visible to this user (consultants see only allocated projects)
  const consultantProjects = useMemo(() => {
    if (!projects) return [];
    const all = projects as any[];
    if (allocatedProjectIds === null) return all;
    return all.filter(p => allocatedProjectIds.includes(Number(p.id)));
  }, [projects, allocatedProjectIds]);

  const myEntries = useMemo(() => {
    if (!timesheets || !myResource) return timesheets ?? [];
    return (timesheets as any[]).filter((t: any) => t.resourceId === myResource.id);
  }, [timesheets, myResource]);

  const reviewEntries = useMemo(() => {
    if (!timesheets) return [];
    return (timesheets as any[])
      .filter((t: any) => filterStatus === "all" || t.status === filterStatus)
      .filter((t: any) => filterProject === "all" || t.projectName === filterProject);
  }, [timesheets, filterStatus, filterProject]);

  // Finance billing queue: approved + billable, grouped by project
  const billingGroups = useMemo(() => {
    if (!timesheets) return [];
    const approved = (timesheets as any[]).filter((t: any) => t.status === "approved" && t.isBillable);
    const map = new Map<number, { projectId: number; projectName: string; entries: any[]; totalHours: number }>();
    approved.forEach((t: any) => {
      if (!map.has(t.projectId)) map.set(t.projectId, { projectId: t.projectId, projectName: t.projectName, entries: [], totalHours: 0 });
      const g = map.get(t.projectId)!;
      g.entries.push(t);
      g.totalHours += t.hoursLogged || 0;
    });
    return Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours);
  }, [timesheets]);

  const displayEntries = activeTab === "mine" ? myEntries : reviewEntries;

  const projectNames = useMemo((): string[] => {
    if (!timesheets) return [];
    return [...new Set((timesheets as any[]).map((t: any) => t.projectName as string).filter(Boolean))];
  }, [timesheets]);

  const stats = useMemo(() => {
    const src = (activeTab === "mine" ? myEntries : (timesheets ?? [])) as any[];
    return {
      total:        src.length,
      submitted:    src.filter((t: any) => t.status === "submitted").length,
      approved:     src.filter((t: any) => t.status === "approved").length,
      rejected:     src.filter((t: any) => t.status === "rejected").length,
      totalHours:   Math.round(src.reduce((s: number, t: any) => s + (t.hoursLogged || 0), 0)),
      pendingHours: Math.round(src.filter((t: any) => t.status === "submitted").reduce((s: number, t: any) => s + (t.hoursLogged || 0), 0)),
    };
  }, [timesheets, myEntries, activeTab]);

  const handleAction = async (
    id: number,
    action: "approve" | "reject" | "submit" | "reset",
    extra?: Record<string, string>,
  ) => {
    setActingId(id);
    try {
      await timesheetAction(id, action, extra);
      await refetch();
      const labels = { approve: "Timesheet approved", reject: "Timesheet rejected", submit: "Submitted for approval", reset: "Reset to draft" };
      toast({ title: labels[action] });
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    } finally {
      setActingId(null);
      setRejectId(null);
      setRejectReason("");
      setRejectError("");
    }
  };

  const handleLogSubmit = async () => {
    if (!form.projectId) {
      toast({ title: "Project is required", variant: "destructive" }); return;
    }
    const hours = parseFloat(form.hoursLogged);
    if (!form.hoursLogged || isNaN(hours) || hours <= 0) {
      toast({ title: "Valid hours are required", variant: "destructive" }); return;
    }
    if (Math.abs(Math.round(hours / 0.25) * 0.25 - hours) > 0.001) {
      toast({ title: "Hours must be in 0.25 increments (e.g. 0.25, 0.5, 1.75)", variant: "destructive" }); return;
    }
    if (!form.notes.trim()) {
      toast({ title: "Description is required", variant: "destructive" }); return;
    }
    setSubmitting(true);
    try {
      const weekStart = format(startOfWeek(parseISO(form.entryDate), { weekStartsOn: 1 }), "yyyy-MM-dd");
      const res = await fetch(`${API_BASE}/timesheets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId:    parseInt(form.projectId),
          projectName:  form.projectName,
          resourceId:   myResource?.id ?? 1,
          resourceName: myResource?.name ?? "Unknown",
          weekStart,
          entryDate:    form.entryDate,
          hoursLogged:  hours,
          activityType: "consulting",
          notes:        form.notes.trim(),
          isBillable:   form.isBillable,
          status:       "draft",
          taskId:       form.taskId ? parseInt(form.taskId) : null,
          categoryId:   form.categoryId ? parseInt(form.categoryId) : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Server error");
      }
      await refetch();
      setGridRefreshKey(k => k + 1);
      toast({ title: "Time logged successfully" });
      setLogOpen(false);
      setForm(defaultForm());
      setActiveTab("mine");
    } catch {
      toast({ title: "Failed to log time", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Finance: generate a draft invoice from approved billable hours
  const generateInvoice = async (group: { projectId: number; projectName: string; entries: any[]; totalHours: number }) => {
    try {
      const amount = Math.round(group.totalHours * BILLING_RATE * 100) / 100;
      const project = (projects as any[])?.find(p => p.id === group.projectId);
      const res = await fetch(`${API_BASE}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId:   group.projectId,
          projectName: group.projectName,
          accountId:   project?.accountId ?? 1,
          accountName: project?.accountName ?? group.projectName,
          amount,
          currency:  "USD",
          issueDate: format(new Date(), "yyyy-MM-dd"),
          dueDate:   format(addDays(new Date(), 30), "yyyy-MM-dd"),
          status:    "draft",
          notes:     `T&M invoice: ${group.totalHours.toFixed(2)}h × $${BILLING_RATE}/hr (${group.entries.length} approved entries)`,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({
        title: "Draft invoice generated",
        description: `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} for ${group.projectName}`,
      });
    } catch {
      toast({ title: "Failed to generate invoice", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" />
        </div>
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  const showMineTab    = canLog || !!myResource;
  const showReviewTab  = canViewAll;
  const showBillingTab = isFinance;

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Time Logs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeTab === "mine"
              ? `${myEntries.length} entr${myEntries.length === 1 ? "y" : "ies"} · ${stats.totalHours}h logged`
              : activeTab === "billing"
                ? `${billingGroups.length} project${billingGroups.length !== 1 ? "s" : ""} with approved billable hours`
                : `${stats.submitted} pending approval · ${stats.pendingHours}h awaiting`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "mine" && canLog && (
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setTsView("grid")}
                title="Weekly grid"
                className={`px-2.5 py-1.5 ${tsView === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setTsView("list")}
                title="List view"
                className={`px-2.5 py-1.5 ${tsView === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          )}
          {canApprove && (
            <Link href="/timesheets/approval">
              <Button variant="outline" className="gap-2">
                <CheckCircle2 className="h-4 w-4" /> Review Queue
                {stats.submitted > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-semibold h-4 min-w-4 px-1">
                    {stats.submitted}
                  </span>
                )}
              </Button>
            </Link>
          )}
          {canLog && (
            <Button onClick={() => { setForm(defaultForm()); setLogOpen(true); }} className="gap-2">
              <Plus className="h-4 w-4" /> Log Time
            </Button>
          )}
        </div>
      </div>

      {/* Missing timesheet compliance banner (managers only) */}
      {canViewAll && missingTimesheets && missingTimesheets.missingCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/50 px-4 py-3">
          <AlarmClock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {missingTimesheets.missingCount} of {missingTimesheets.totalResources} team member{missingTimesheets.missingCount !== 1 ? "s have" : " has"} not submitted timesheets for this week ({missingTimesheets.weekStart}).
            </p>
            {missingTimesheets.missingResources.length <= 5 && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Missing: {missingTimesheets.missingResources.map(r => r.name).join(", ")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      {(showMineTab || showReviewTab || showBillingTab) && (
        <div className="flex gap-1 border-b border-border">
          {showMineTab && (
            <button
              onClick={() => setActiveTab("mine")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "mine" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              My Timesheets
            </button>
          )}
          {showReviewTab && (
            <button
              onClick={() => setActiveTab("review")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "review" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Review Queue
              {stats.submitted > 0 && (
                <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {stats.submitted}
                </span>
              )}
            </button>
          )}
          {showBillingTab && (
            <button
              onClick={() => setActiveTab("billing")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "billing" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Receipt className="h-3.5 w-3.5" />
              Billing Queue
              {billingGroups.length > 0 && (
                <span className="bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {billingGroups.length}
                </span>
              )}
            </button>
          )}
        </div>
      )}

      {/* Stats cards */}
      {activeTab !== "billing" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Hours",      value: `${stats.totalHours}h`, bg: "bg-card border-border",            text: "text-foreground" },
            { label: "Pending Approval", value: stats.submitted,         bg: "bg-amber-50 border-amber-200",     text: "text-amber-700" },
            { label: "Approved",         value: stats.approved,          bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
            { label: "Rejected",         value: stats.rejected,          bg: "bg-red-50 border-red-200",         text: "text-red-700" },
          ].map(s => (
            <div key={s.label} className={`border rounded-xl p-4 ${s.bg}`}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.text}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Finance Billing Queue ── */}
      {activeTab === "billing" && (
        <div className="space-y-4">
          {billingGroups.length === 0 ? (
            <div className="border rounded-xl bg-card p-12 text-center">
              <Receipt className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No approved billable timesheets pending invoicing.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Approved billable hours ready for invoicing at ${BILLING_RATE}/hr. Generating a draft invoice does not mark these timesheets as invoiced.
              </p>
              {billingGroups.map(group => {
                const amount = Math.round(group.totalHours * BILLING_RATE);
                return (
                  <div key={group.projectId} className="border rounded-xl bg-card p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground">{group.projectName}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {group.entries.length} approved entr{group.entries.length !== 1 ? "ies" : "y"} · {group.totalHours.toFixed(2)}h billable
                        </p>
                        <p className="text-xl font-bold text-emerald-400 mt-1">
                          ${amount.toLocaleString()}
                          <span className="text-xs font-normal text-muted-foreground ml-1">USD @ ${BILLING_RATE}/hr</span>
                        </p>
                      </div>
                      <Button
                        onClick={() => generateInvoice(group)}
                        className="shrink-0 gap-2"
                        variant="outline"
                      >
                        <Receipt className="h-4 w-4" />
                        Generate Draft Invoice
                      </Button>
                    </div>
                    <div className="mt-3 divide-y divide-border border-t border-border pt-3">
                      {group.entries.slice(0, 4).map(e => (
                        <div key={e.id} className="py-1.5 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {e.resourceName} ·{" "}
                            {e.entryDate ? format(new Date(e.entryDate + "T00:00:00"), "MMM d") : ""}
                          </span>
                          <span className="font-medium">{e.hoursLogged}h</span>
                        </div>
                      ))}
                      {group.entries.length > 4 && (
                        <p className="text-xs text-muted-foreground py-1.5">+{group.entries.length - 4} more entries</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ── Review Queue filters ── */}
      {activeTab === "review" && (
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-[240px] h-9"><SelectValue placeholder="All projects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projectNames.map(p => <SelectItem key={p} value={p!}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          {(filterStatus !== "all" || filterProject !== "all") && (
            <Button variant="ghost" size="sm" className="h-9 text-muted-foreground"
              onClick={() => { setFilterStatus("all"); setFilterProject("all"); }}>
              Clear
            </Button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{reviewEntries.length} records</span>
        </div>
      )}

      {/* ── Weekly Grid (my timesheets) ── */}
      {activeTab === "mine" && tsView === "grid" && myResource && (
        <div className="border rounded-xl overflow-hidden bg-card">
          <WeeklyGrid
            resourceId={myResource.id}
            resourceName={myResource.name}
            projects={consultantProjects}
            categories={categories}
            onRefetch={refetch}
            role={role}
            allocatedProjectIds={role === "consultant" ? (allocatedProjectIds ?? undefined) : undefined}
            refreshKey={gridRefreshKey}
          />
        </div>
      )}

      {/* ── Table view (list view or review tab) ── */}
      {(activeTab === "review" || (activeTab === "mine" && tsView === "list")) && (
        <div className="border rounded-xl overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {activeTab === "review" && <TableHead>Resource</TableHead>}
                <TableHead>Project</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Week</TableHead>
                <TableHead className="text-right">Logged</TableHead>
                <TableHead className="text-right">Billable</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(displayEntries as any[]).map((ts: any) => {
                const badgeCfg = STATUS_BADGE[ts.status] || STATUS_BADGE.draft;
                const isBusy = actingId === ts.id;
                const isMyOwn = myResource && ts.resourceId === myResource.id;
                return (
                  <TableRow key={ts.id} className="hover:bg-muted/30">
                    {activeTab === "review" && <TableCell className="font-medium">{ts.resourceName}</TableCell>}
                    <TableCell className="text-sm max-w-[180px]">
                      <div className="flex items-center gap-1.5">
                        <Link href={`/projects/${ts.projectId}`} className="text-muted-foreground hover:text-primary underline-offset-2 hover:underline truncate">
                          {ts.projectName || "—"}
                        </Link>
                        {ts.projectId && (
                          <Link href={`/projects/${ts.projectId}/command`} className="text-muted-foreground/50 hover:text-primary flex-shrink-0" title="Command Center">
                            <Rocket className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {ts.entryDate ? format(new Date(ts.entryDate + "T00:00:00"), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ts.weekStart ? format(new Date(ts.weekStart + "T00:00:00"), "MMM d") : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">{ts.hoursLogged}h</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {ts.isBillable
                        ? (ts.billableHours != null ? `${ts.billableHours}h` : `${ts.hoursLogged}h`)
                        : <span className="text-xs">Non-billable</span>}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground max-w-[140px] truncate block" title={ts.notes ?? ""}>
                        {ts.notes || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={badgeCfg.variant} className="text-xs">{badgeCfg.label}</Badge>
                      {ts.rejectedReason && (
                        <p className="text-xs text-destructive mt-0.5 max-w-[140px] truncate" title={ts.rejectedReason}>{ts.rejectedReason}</p>
                      )}
                      {ts.approvedByName && ts.status === "approved" && (
                        <p className="text-xs text-muted-foreground mt-0.5">by {ts.approvedByName}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        {ts.status === "draft" && canLog && isMyOwn && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={isBusy}
                            onClick={() => handleAction(ts.id, "submit")}>
                            <Clock className="h-3 w-3" /> Submit
                          </Button>
                        )}
                        {ts.status === "submitted" && canApprove && (
                          <>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                              disabled={isBusy}
                              onClick={() => handleAction(ts.id, "approve", { approvedByName: "Manager" })}>
                              <CheckCircle2 className="h-3 w-3" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-destructive text-destructive hover:bg-red-50"
                              disabled={isBusy}
                              onClick={() => setRejectId(ts.id)}>
                              <XCircle className="h-3 w-3" /> Reject
                            </Button>
                          </>
                        )}
                        {(ts.status === "approved" || ts.status === "rejected") && canApprove && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground"
                            disabled={isBusy}
                            onClick={() => handleAction(ts.id, "reset")}>
                            <RotateCcw className="h-3 w-3" /> Reset
                          </Button>
                        )}
                        {!canLog && !canApprove && <Eye className="h-3.5 w-3.5 text-muted-foreground/40" />}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {displayEntries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={activeTab === "review" ? 9 : 8} className="text-center h-32 text-muted-foreground">
                    {activeTab === "mine"
                      ? canLog
                        ? <div className="flex flex-col items-center gap-2">
                            <Clock className="h-8 w-8 opacity-20" />
                            <p>No time logged yet.</p>
                            <Button size="sm" variant="outline" onClick={() => setLogOpen(true)}>Log your first entry</Button>
                          </div>
                        : "No timesheet entries found."
                      : "No timesheets match the current filters."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Log Time Modal ── */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>Log Time</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Project — filtered for consultant */}
            <div className="grid gap-1.5">
              <Label htmlFor="ts-project">Project <span className="text-destructive">*</span></Label>
              <Select
                value={form.projectId}
                onValueChange={val => {
                  const p = consultantProjects.find(x => String(x.id) === val);
                  setForm(f => ({ ...f, projectId: val, projectName: p?.name ?? "", taskId: "", taskName: "" }));
                }}
              >
                <SelectTrigger id="ts-project">
                  <SelectValue placeholder="Select a project…" />
                </SelectTrigger>
                <SelectContent>
                  {consultantProjects.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {role === "consultant" && allocatedProjectIds !== null && consultantProjects.length === 0 && (
                <p className="text-xs text-amber-500">No active projects assigned to you.</p>
              )}
            </div>

            {/* Task */}
            {form.projectId && (
              <div className="grid gap-1.5">
                <Label htmlFor="ts-task">Task</Label>
                <Select
                  value={form.taskId || "__none__"}
                  onValueChange={val => {
                    if (val === "__none__") { setForm(f => ({ ...f, taskId: "", taskName: "" })); return; }
                    const t = projectTasks.find(t => String(t.id) === val);
                    setForm(f => ({ ...f, taskId: val, taskName: t?.name ?? "" }));
                  }}
                >
                  <SelectTrigger id="ts-task">
                    <SelectValue placeholder="— No specific task —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— No specific task —</SelectItem>
                    {projectTasks.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Category */}
            <div className="grid gap-1.5">
              <Label htmlFor="ts-category">Time Category</Label>
              <Select
                value={form.categoryId || "__none__"}
                onValueChange={val => {
                  if (val === "__none__") { setForm(f => ({ ...f, categoryId: "" })); return; }
                  const cat = categories.find(c => String(c.id) === val);
                  setForm(f => ({ ...f, categoryId: val, isBillable: cat ? cat.defaultBillable : f.isBillable }));
                }}
              >
                <SelectTrigger id="ts-category">
                  <SelectValue placeholder="— Select category —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Select category —</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Date + Hours — 0.25 step */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="ts-date">Date <span className="text-destructive">*</span></Label>
                <Input
                  id="ts-date"
                  type="date"
                  value={form.entryDate}
                  onChange={e => setForm(f => ({ ...f, entryDate: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ts-hours">Hours <span className="text-destructive">*</span></Label>
                <Input
                  id="ts-hours"
                  type="number"
                  min="0.25"
                  max="24"
                  step="0.25"
                  placeholder="e.g. 2.5"
                  value={form.hoursLogged}
                  onChange={e => setForm(f => ({ ...f, hoursLogged: e.target.value }))}
                  onBlur={e => {
                    const parsed = parseFloat(e.target.value);
                    if (!isNaN(parsed) && parsed > 0)
                      setForm(f => ({ ...f, hoursLogged: String(roundToStep(parsed)) }));
                  }}
                />
                <p className="text-[10px] text-muted-foreground">Increments of 0.25h</p>
              </div>
            </div>

            {/* Description — mandatory */}
            <div className="grid gap-1.5">
              <Label htmlFor="ts-notes">Description <span className="text-destructive">*</span></Label>
              <Textarea
                id="ts-notes"
                placeholder="Brief description of work done…"
                className="resize-none"
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {/* Billable toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Billable</p>
                <p className="text-xs text-muted-foreground">Include this time in client billing</p>
              </div>
              <Switch
                checked={form.isBillable}
                onCheckedChange={val => setForm(f => ({ ...f, isBillable: val }))}
              />
            </div>

            {/* Resource info */}
            {myResource && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                Logging as <span className="font-medium text-foreground">{myResource.name}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogOpen(false)}>Cancel</Button>
            <Button onClick={handleLogSubmit} disabled={submitting || !form.projectId}>
              {submitting ? "Saving…" : "Save as Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reject Reason Modal — reason is mandatory ── */}
      <Dialog open={rejectId !== null} onOpenChange={o => { if (!o) { setRejectId(null); setRejectReason(""); setRejectError(""); } }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Reject Timesheet</DialogTitle>
          </DialogHeader>
          <div className="py-2 grid gap-1.5">
            <Label htmlFor="reject-reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reject-reason"
              placeholder="e.g. Hours exceed project budget, please clarify…"
              rows={3}
              value={rejectReason}
              onChange={e => { setRejectReason(e.target.value); setRejectError(""); }}
            />
            {rejectError && <p className="text-xs text-destructive">{rejectError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectId(null); setRejectReason(""); setRejectError(""); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!rejectReason.trim()) {
                  setRejectError("A rejection reason is required.");
                  return;
                }
                if (rejectId) handleAction(rejectId, "reject", { rejectedReason: rejectReason });
              }}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
