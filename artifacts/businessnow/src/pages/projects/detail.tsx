import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { format, differenceInDays } from "date-fns";
import {
  AlertTriangle, AlertCircle, CheckCircle2, Clock, Users, DollarSign,
  Calendar, BarChart3, ChevronRight, Flag,
  User, ExternalLink, RefreshCw, Circle, CheckSquare, Square,
  MessageSquare, PlusCircle, TrendingUp, Receipt, FileText,
  ThumbsUp, ThumbsDown, Info, ChevronDown, Plus, Pencil, Trash2,
  Milestone, Layers, Grip, FolderOpen, CheckCheck, X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuthRole } from "@/lib/auth";

const API = import.meta.env.BASE_URL + "api";

type TabKey = "overview" | "team" | "milestones" | "tasks" | "worklogs" | "finance" | "gantt" | "baseline" | "updates" | "close" | "details";

interface Task {
  id: number; name: string; status: string; priority: string;
  assignedToId?: number; assignedToName?: string; dueDate?: string;
  estimatedHours?: number; loggedHours?: number; phase?: string;
  phaseId?: number; milestoneId?: number; isClientAction?: boolean;
  blockerNote?: string; notes?: string; visibility?: string;
  taskType?: string; parentId?: number | null;
  plannedStartDate?: string; plannedEndDate?: string;
  completionPct?: number; sortOrder?: number; etcHours?: number;
}
interface Milestone {
  id: number; name: string; status: string; phase?: string; phaseId?: number;
  dueDate?: string; startDate?: string; ownerName?: string; isBillable?: boolean;
  billableAmount?: number; invoiced?: boolean; approvalStatus?: string;
  clientAction?: string; sequence?: number; description?: string;
}
interface Phase {
  id: number; name: string; sequence: number; startDate?: string; endDate?: string; status: string;
}
interface Allocation {
  id: number; resourceId?: number; resourceName?: string; role?: string;
  allocationPct?: number; startDate?: string; endDate?: string;
  status?: string; hoursPerWeek?: number;
}
interface HealthReason { label: string; impact: number; severity: string; }

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-slate-100 text-slate-700 border-slate-200",
  in_progress: "bg-blue-100 text-blue-700 border-blue-200",
  in_review: "bg-purple-100 text-purple-700 border-purple-200",
  done: "bg-emerald-100 text-emerald-700 border-emerald-200",
  blocked: "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200",
  not_started: "bg-slate-100 text-slate-600 border-slate-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
  pending_approval: "bg-amber-100 text-amber-700 border-amber-200",
};
function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] || "bg-slate-100 text-slate-600 border-slate-200";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cls}`}>{status.replace(/_/g, " ")}</span>;
}
function HealthDot({ score }: { score: number }) {
  if (score >= 80) return <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />;
  if (score >= 60) return <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" />;
  return <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />;
}
function fmt$(n: number) { return n >= 1000 ? `$${(n/1000).toFixed(0)}k` : `$${n.toFixed(0)}`; }

// ─── Timeline View ─────────────────────────────────────────────────────────
function TimelineView({ phases, milestones, project }: { phases: Phase[]; milestones: Milestone[]; project: any }) {
  const startStr = project.startDate || project.baselineStartDate;
  const endStr = project.endDate || project.goLiveDate;
  if (!startStr || !endStr) {
    return <div className="p-8 text-center text-muted-foreground">No project dates set — assign start and end dates to see the timeline.</div>;
  }
  const projStart = new Date(startStr);
  const projEnd = new Date(endStr);
  const totalDays = Math.max(differenceInDays(projEnd, projStart), 1);
  const today = new Date();
  const todayPct = Math.min(Math.max((differenceInDays(today, projStart) / totalDays) * 100, 0), 100);
  const phaseColors = ["bg-violet-500","bg-blue-500","bg-cyan-500","bg-teal-500","bg-emerald-500","bg-amber-500","bg-orange-500"];
  return (
    <div className="p-4 space-y-6">
      <div className="relative h-8 bg-muted rounded-lg overflow-hidden flex items-center px-3">
        <span className="text-xs text-muted-foreground">{format(projStart,"MMM d")}</span>
        <span className="flex-1 text-center text-xs font-medium">Project Timeline · {totalDays} days</span>
        <span className="text-xs text-muted-foreground">{format(projEnd,"MMM d, yyyy")}</span>
        <div className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10" style={{left:`${todayPct}%`}}>
          <div className="absolute -top-0.5 -translate-x-1/2 w-2 h-2 rounded-full bg-red-400" />
        </div>
      </div>
      {phases.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phases</p>
          {phases.map((ph, i) => {
            const s = ph.startDate ? new Date(ph.startDate) : projStart;
            const e = ph.endDate ? new Date(ph.endDate) : projEnd;
            const left = (Math.max(differenceInDays(s,projStart),0)/totalDays)*100;
            const width = Math.max((differenceInDays(e,s)/totalDays)*100,2);
            const color = phaseColors[i % phaseColors.length];
            return (
              <div key={ph.id} className="flex items-center gap-3">
                <div className="w-36 text-xs text-right font-medium truncate">{ph.name}</div>
                <div className="flex-1 relative h-6 bg-muted rounded">
                  <div className={`absolute top-0 bottom-0 rounded ${color} opacity-80 flex items-center px-2`} style={{left:`${left}%`,width:`${width}%`}}>
                    <span className="text-foreground text-xs truncate font-medium">{ph.name}</span>
                  </div>
                  <div className="absolute top-0 bottom-0 w-px bg-red-300" style={{left:`${todayPct}%`}} />
                </div>
                <StatusBadge status={ph.status} />
              </div>
            );
          })}
        </div>
      )}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Milestones</p>
        {milestones.filter(m=>m.dueDate).map(ms => {
          const due = new Date(ms.dueDate!);
          const pct = Math.min(Math.max((differenceInDays(due,projStart)/totalDays)*100,0),100);
          const isOverdue = due < today && ms.status !== "completed";
          const isDone = ms.status === "completed";
          return (
            <div key={ms.id} className="flex items-center gap-3">
              <div className="w-36 text-xs text-right truncate text-muted-foreground">{ms.name}</div>
              <div className="flex-1 relative h-8 bg-muted/50 rounded">
                <div className="absolute top-0 bottom-0 w-px bg-red-300" style={{left:`${todayPct}%`}} />
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10" style={{left:`${pct}%`}}>
                  <div className={`w-4 h-4 rotate-45 border-2 ${isDone?"bg-emerald-500 border-emerald-500":isOverdue?"bg-red-500 border-red-500":"bg-white border-blue-500"}`} title={ms.name} />
                </div>
                <div className="absolute top-1/2 -translate-y-1/2 text-xs text-muted-foreground" style={{left:`${pct+1.5}%`}}>{format(due,"MMM d")}</div>
              </div>
              <StatusBadge status={ms.status} />
            </div>
          );
        })}
        {milestones.filter(m=>m.dueDate).length===0 && <p className="text-sm text-muted-foreground pl-40">No milestones with due dates.</p>}
      </div>
    </div>
  );
}

// ─── WBS Task Modal ───────────────────────────────────────────────────────────
function WbsTaskModal({
  task, projectId, allTasks, allocations, onClose, onSave,
}: {
  task: Partial<Task> | null;
  projectId: number;
  allTasks: Task[];
  allocations: { resourceId?: number; resourceName?: string }[];
  onClose: () => void;
  onSave: () => void;
}) {
  const isEdit = !!task?.id;
  const [form, setForm] = useState({
    name: task?.name ?? "",
    taskType: task?.taskType ?? "work",
    parentId: task?.parentId?.toString() ?? "",
    status: task?.status ?? "todo",
    priority: task?.priority ?? "medium",
    plannedStartDate: task?.plannedStartDate ?? "",
    plannedEndDate: task?.plannedEndDate ?? "",
    dueDate: task?.dueDate ?? "",
    estimatedHours: task?.estimatedHours?.toString() ?? "",
    etcHours: task?.etcHours?.toString() ?? "",
    completionPct: task?.completionPct?.toString() ?? "0",
    assignedToId: task?.assignedToId?.toString() ?? "",
    assignedToName: task?.assignedToName ?? "",
    notes: task?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [taskRes, setTaskRes] = useState<{ id?: number; resourceId: number; resourceName: string; estimatedHours: string; _new?: boolean; _delete?: boolean }[]>([]);
  const [addResId, setAddResId] = useState("");
  const [addResHours, setAddResHours] = useState("");
  const [loadingRes, setLoadingRes] = useState(false);
  const [breakdown, setBreakdown] = useState<{ resourceId: number; resourceName: string; role: string | null; estimatedHours: number | null; loggedHours: number }[]>([]);
  const [planHoursFor, setPlanHoursFor] = useState<number | null>(null);
  const [planForm, setPlanForm] = useState({ dailyHours: "4", startDate: "", endDate: "" });
  const [planSaving, setPlanSaving] = useState(false);

  const parentCandidates = allTasks.filter(t => t.taskType === "parent" && t.id !== task?.id);

  useEffect(() => {
    if (!isEdit || !task?.id) return;
    setLoadingRes(true);
    Promise.all([
      fetch(`${API}/tasks/${task.id}/resources`).then(r => r.json()),
      fetch(`${API}/tasks/${task.id}/resource-breakdown`).then(r => r.json()),
    ])
      .then(([resRows, bdRows]: [any[], any[]]) => {
        setTaskRes(resRows.map(r => ({ id: r.id, resourceId: r.resourceId, resourceName: r.resourceName, estimatedHours: r.estimatedHours?.toString() ?? "" })));
        setBreakdown(Array.isArray(bdRows) ? bdRows : []);
      })
      .catch(() => {})
      .finally(() => setLoadingRes(false));
  }, [task?.id, isEdit]);

  const refreshResources = async () => {
    if (!task?.id) return;
    const [resRows, bdRows] = await Promise.all([
      fetch(`${API}/tasks/${task.id}/resources`).then(r => r.json()),
      fetch(`${API}/tasks/${task.id}/resource-breakdown`).then(r => r.json()),
    ]);
    setTaskRes(resRows.map((r: any) => ({ id: r.id, resourceId: r.resourceId, resourceName: r.resourceName, estimatedHours: r.estimatedHours?.toString() ?? "" })));
    setBreakdown(Array.isArray(bdRows) ? bdRows : []);
  };

  const applyDailyPlan = async (resourceId: number) => {
    if (!task?.id || !planForm.startDate || !planForm.endDate) return;
    setPlanSaving(true);
    try {
      await fetch(`${API}/tasks/${task.id}/daily-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId,
          dailyHours: parseFloat(planForm.dailyHours) || 0,
          startDate: planForm.startDate,
          endDate: planForm.endDate,
        }),
      });
      await refreshResources();
      setPlanHoursFor(null);
    } finally {
      setPlanSaving(false);
    }
  };

  const clearDailyPlan = async (resourceId: number) => {
    if (!task?.id) return;
    await fetch(`${API}/tasks/${task.id}/daily-plan?resourceId=${resourceId}`, { method: "DELETE" });
    await refreshResources();
  };

  const setField = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleAssignee = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const alloc = allocations.find(a => a.resourceId?.toString() === e.target.value);
    setForm(f => ({ ...f, assignedToId: e.target.value, assignedToName: alloc?.resourceName ?? "" }));
  };

  const addResource = () => {
    if (!addResId) return;
    if (taskRes.some(r => r.resourceId === parseInt(addResId) && !r._delete)) return;
    const alloc = allocations.find(a => a.resourceId?.toString() === addResId);
    setTaskRes(prev => [...prev.filter(r => !(r.resourceId === parseInt(addResId) && r._delete)), {
      resourceId: parseInt(addResId),
      resourceName: alloc?.resourceName ?? "Unknown",
      estimatedHours: addResHours,
      _new: true,
    }]);
    setAddResId(""); setAddResHours("");
  };

  const removeResource = (resourceId: number) => {
    setTaskRes(prev => prev.map(r => r.resourceId === resourceId ? { ...r, _delete: true } : r));
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload: any = {
      name: form.name.trim(), taskType: form.taskType,
      parentId: form.parentId ? parseInt(form.parentId) : null,
      status: form.status, priority: form.priority,
      plannedStartDate: form.plannedStartDate || null, plannedEndDate: form.plannedEndDate || null,
      dueDate: form.dueDate || null,
      estimatedHours: form.estimatedHours ? parseFloat(form.estimatedHours) : null,
      etcHours: form.etcHours ? parseFloat(form.etcHours) : null,
      completionPct: parseInt(form.completionPct) || 0,
      assignedToId: form.assignedToId ? parseInt(form.assignedToId) : null,
      assignedToName: form.assignedToName || null,
      notes: form.notes || null, projectId,
    };
    try {
      let savedTaskId = task?.id;
      if (isEdit) {
        await fetch(`${API}/tasks/${task!.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      } else {
        const resp = await fetch(`${API}/tasks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const saved = await resp.json();
        savedTaskId = saved.id;
      }
      if (savedTaskId) {
        for (const r of taskRes) {
          if (r._delete && r.id) await fetch(`${API}/tasks/${savedTaskId}/resources/${r.id}`, { method: "DELETE" });
          else if (r._new) await fetch(`${API}/tasks/${savedTaskId}/resources`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resourceId: r.resourceId, estimatedHours: r.estimatedHours ? parseFloat(r.estimatedHours) : null }) });
        }
      }
      onSave(); onClose();
    } finally { setSaving(false); }
  };

  const visibleRes = taskRes.filter(r => !r._delete);
  const assignedResIds = new Set(visibleRes.map(r => r.resourceId));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">{isEdit ? "Edit Task" : "Add Task"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
            <Input value={form.name} onChange={setField("name")} className="bg-background border-border" placeholder="Task name" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
            <select value={form.taskType} onChange={setField("taskType")} className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground">
              <option value="work">Work</option>
              <option value="parent">Parent / Phase</option>
              <option value="milestone">Milestone</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Parent Task</label>
            <select value={form.parentId} onChange={setField("parentId")} className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground">
              <option value="">— Top level —</option>
              {parentCandidates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
            <select value={form.status} onChange={setField("status")} className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground">
              {["todo","in_progress","in_review","done","blocked","cancelled"].map(s => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Priority</label>
            <select value={form.priority} onChange={setField("priority")} className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground">
              {["low","medium","high","critical"].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Planned Start</label>
            <Input type="date" value={form.plannedStartDate} onChange={setField("plannedStartDate")} className="bg-background border-border" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Planned End</label>
            <Input type="date" value={form.plannedEndDate} onChange={setField("plannedEndDate")} className="bg-background border-border" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Due Date</label>
            <Input type="date" value={form.dueDate} onChange={setField("dueDate")} className="bg-background border-border" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Est. Hours (total)</label>
            <Input type="number" value={form.estimatedHours} onChange={setField("estimatedHours")} className="bg-background border-border" placeholder="0" min="0" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">ETC Hours</label>
            <Input type="number" value={form.etcHours} onChange={setField("etcHours")} className="bg-background border-border" placeholder="0" min="0" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">% Complete</label>
            <div className="flex items-center gap-2">
              <input type="range" min="0" max="100" step="5" value={form.completionPct}
                onChange={setField("completionPct")} className="flex-1 h-2 accent-violet-500" />
              <span className="text-xs w-8 text-right text-foreground">{form.completionPct}%</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Primary Assignee</label>
            <select value={form.assignedToId} onChange={handleAssignee} className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground">
              <option value="">— Unassigned —</option>
              {allocations.filter(a => a.resourceId).map(a => (
                <option key={a.resourceId} value={a.resourceId}>{a.resourceName}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Resources &amp; Hours</label>
            {loadingRes && <p className="text-xs text-muted-foreground">Loading…</p>}
            {visibleRes.length > 0 && (
              <div className="space-y-1 mb-2">
                {visibleRes.map(r => (
                  <div key={r.resourceId}>
                    <div className="flex items-center gap-2 bg-muted/30 rounded px-2 py-1">
                      <span className="text-xs text-foreground flex-1">{r.resourceName}</span>
                      <span className="text-xs text-muted-foreground">{r.estimatedHours ? `${r.estimatedHours}h` : "—"}</span>
                      {isEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            if (planHoursFor === r.resourceId) { setPlanHoursFor(null); return; }
                            setPlanHoursFor(r.resourceId);
                            setPlanForm({ dailyHours: "4", startDate: "", endDate: "" });
                          }}
                          className="text-[10px] px-1.5 py-0.5 rounded border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors font-medium"
                          title="Plan daily hours for this resource"
                        >
                          Plan Hours
                        </button>
                      )}
                      <button onClick={() => removeResource(r.resourceId)} className="text-red-400 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                    </div>
                    {planHoursFor === r.resourceId && (
                      <div className="mt-1 ml-2 p-2 bg-blue-50 border border-blue-200 rounded-lg space-y-1.5">
                        <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide">Daily Hours Plan — {r.resourceName}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <label className="text-xs text-blue-700 whitespace-nowrap">h/day</label>
                          <input
                            type="number" min="0" max="24" step="0.5"
                            value={planForm.dailyHours}
                            onChange={e => setPlanForm(f => ({ ...f, dailyHours: e.target.value }))}
                            className="w-16 h-7 rounded border border-blue-300 px-1.5 text-xs text-center bg-white"
                          />
                          <label className="text-xs text-blue-700">from</label>
                          <input
                            type="date"
                            value={planForm.startDate}
                            onChange={e => setPlanForm(f => ({ ...f, startDate: e.target.value }))}
                            className="h-7 rounded border border-blue-300 px-1.5 text-xs bg-white"
                          />
                          <label className="text-xs text-blue-700">to</label>
                          <input
                            type="date"
                            value={planForm.endDate}
                            onChange={e => setPlanForm(f => ({ ...f, endDate: e.target.value }))}
                            className="h-7 rounded border border-blue-300 px-1.5 text-xs bg-white"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={planSaving || !planForm.startDate || !planForm.endDate}
                            onClick={() => applyDailyPlan(r.resourceId)}
                            className="h-7 px-3 text-xs rounded bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            {planSaving ? "Applying…" : "Apply"}
                          </button>
                          <button
                            type="button"
                            onClick={() => clearDailyPlan(r.resourceId)}
                            className="h-7 px-3 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                          >
                            Clear Plan
                          </button>
                          <button
                            type="button"
                            onClick={() => setPlanHoursFor(null)}
                            className="h-7 px-2 text-xs rounded border border-gray-300 text-gray-500 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-1.5">
              <select value={addResId} onChange={e => setAddResId(e.target.value)} className="flex-1 h-8 rounded border border-border bg-background px-2 text-xs text-foreground">
                <option value="">Add resource…</option>
                {allocations.filter(a => a.resourceId && !assignedResIds.has(a.resourceId!)).map(a => (
                  <option key={a.resourceId} value={a.resourceId}>{a.resourceName}</option>
                ))}
              </select>
              <Input type="number" value={addResHours} onChange={e => setAddResHours(e.target.value)}
                placeholder="hrs" className="w-16 h-8 bg-background border-border text-xs" min="0" />
              <button onClick={addResource} disabled={!addResId}
                className="h-8 px-2.5 rounded bg-muted text-xs text-foreground hover:bg-muted/60 disabled:opacity-40">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {/* Team Progress — multi-resource breakdown (read-only, only shown for 2+ resources) */}
          {breakdown.length > 1 && (
            <div className="col-span-2">
              <label className="text-xs font-semibold text-muted-foreground mb-2 block uppercase tracking-wide">Team Progress</label>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">Resource</th>
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">Role</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">Planned (h)</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">Logged (h)</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">Remaining (h)</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map((row, i) => {
                      const planned = row.estimatedHours ?? 0;
                      const logged = row.loggedHours;
                      const remaining = Math.max(0, planned - logged);
                      const pct = planned > 0 ? (logged / planned) : 0;
                      let statusLabel = "On Track";
                      let statusClass = "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30";
                      if (logged > planned) {
                        statusLabel = "Over";
                        statusClass = "bg-red-500/15 text-red-400 border border-red-500/30";
                      } else if (pct >= 0.8) {
                        statusLabel = "At Risk";
                        statusClass = "bg-amber-500/15 text-amber-400 border border-amber-500/30";
                      }
                      return (
                        <tr key={row.resourceId} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                          <td className="px-3 py-2 font-medium text-foreground">{row.resourceName}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.role ?? "—"}</td>
                          <td className="px-3 py-2 text-right text-foreground">{planned > 0 ? planned : "—"}</td>
                          <td className="px-3 py-2 text-right text-foreground">{logged > 0 ? logged : "0"}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{planned > 0 ? remaining : "—"}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusClass}`}>
                              {statusLabel}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
            <textarea value={form.notes} onChange={setField("notes")}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground min-h-[60px] resize-none"
              placeholder="Optional notes…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border">Cancel</Button>
          <Button onClick={save} disabled={saving || !form.name.trim()}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── WBS Tree View ────────────────────────────────────────────────────────────
// ─── Task Slide-In Panel ──────────────────────────────────────────────────────
function TaskSlidePanel({ task, projectId, onClose, onSave }: {
  task: Task; projectId: number; onClose: () => void; onSave: () => void;
}) {
  const [form, setForm] = useState({
    name: task.name,
    status: task.status,
    priority: task.priority,
    etcHours: task.etcHours?.toString() ?? "",
    estimatedHours: task.estimatedHours?.toString() ?? "",
    dueDate: task.dueDate ?? "",
    notes: task.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [deps, setDeps] = useState<{ predecessors: any[]; successors: any[] }>({ predecessors: [], successors: [] });
  const [addDepOpen, setAddDepOpen] = useState(false);
  const [depTaskId, setDepTaskId] = useState("");
  const [depType, setDepType] = useState("FS");
  const [allProjectTasks, setAllProjectTasks] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/task-comments?taskId=${task.id}`).then(r => r.json()).catch(() => []),
      fetch(`${API}/task-assignments?taskId=${task.id}`).then(r => r.json()).catch(() => []),
      fetch(`${API}/task-dependencies?taskId=${task.id}`).then(r => r.json()).catch(() => ({ predecessors: [], successors: [] })),
      fetch(`${API}/resources`).then(r => r.json()).catch(() => []),
      fetch(`${API}/tasks?projectId=${projectId}`).then(r => r.json()).catch(() => []),
    ]).then(([cmts, asgns, depsData, resrs, ptasks]) => {
      setComments(Array.isArray(cmts) ? cmts : []);
      setAssignments(Array.isArray(asgns) ? asgns : []);
      setDeps(depsData && typeof depsData === 'object' && 'predecessors' in depsData ? depsData : { predecessors: [], successors: [] });
      setResources(Array.isArray(resrs) ? resrs : []);
      setAllProjectTasks(Array.isArray(ptasks) ? ptasks.filter((t: any) => t.id !== task.id) : []);
    });
  }, [task.id, projectId]);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`${API}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          status: form.status,
          priority: form.priority,
          etcHours: form.etcHours ? parseFloat(form.etcHours) : null,
          estimatedHours: form.estimatedHours ? parseFloat(form.estimatedHours) : null,
          dueDate: form.dueDate || null,
          notes: form.notes || null,
        }),
      });
      onSave();
    } finally { setSaving(false); }
  }

  async function handlePostComment() {
    if (!commentBody.trim()) return;
    setPostingComment(true);
    try {
      const res = await fetch(`${API}/task-comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, authorId: 1, body: commentBody.trim() }),
      });
      const newComment = await res.json();
      setComments(prev => [...prev, newComment]);
      setCommentBody("");
    } finally { setPostingComment(false); }
  }

  async function handleAddDep() {
    if (!depTaskId) return;
    await fetch(`${API}/task-dependencies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ predecessorTaskId: parseInt(depTaskId), successorTaskId: task.id, dependencyType: depType }),
    });
    const updated = await fetch(`${API}/task-dependencies?taskId=${task.id}`).then(r => r.json());
    setDeps(updated);
    setAddDepOpen(false);
    setDepTaskId("");
  }

  async function handleRemoveDep(id: number) {
    await fetch(`${API}/task-dependencies/${id}`, { method: "DELETE" });
    const updated = await fetch(`${API}/task-dependencies?taskId=${task.id}`).then(r => r.json());
    setDeps(updated);
  }

  const DEP_TYPE_BADGE: Record<string, string> = {
    FS: "bg-blue-100 text-blue-700", SS: "bg-violet-100 text-violet-700",
    FF: "bg-amber-100 text-amber-700", SF: "bg-rose-100 text-rose-700",
  };

  return (
    <Sheet open onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent className="w-[520px] sm:max-w-[520px] overflow-y-auto flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <SheetTitle className="text-base">{task.name}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground">
                {["todo","in_progress","in_review","done","blocked","cancelled"].map(s =>
                  <option key={s} value={s}>{s.replace(/_/g," ")}</option>
                )}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground">
                {["low","medium","high","critical"].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Est. Hours</label>
              <Input type="number" step="0.5" min="0" value={form.estimatedHours}
                onChange={e => setForm(f => ({ ...f, estimatedHours: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">ETC (hrs) — remaining estimate</label>
              <Input type="number" step="0.5" min="0" value={form.etcHours}
                onChange={e => setForm(f => ({ ...f, etcHours: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Due Date</label>
              <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
              <Textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>

          {assignments.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Assignees</p>
              <div className="flex flex-wrap gap-1.5">
                {assignments.map((a: any) => (
                  <span key={a.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs font-medium">
                    {a.resourceName || "Unknown"}
                    {a.roleOnTask && <span className="text-muted-foreground">· {a.roleOnTask}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Dependencies */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dependencies</p>
              <button onClick={() => setAddDepOpen(v => !v)} className="text-xs text-primary hover:underline">+ Add</button>
            </div>
            {addDepOpen && (
              <div className="flex gap-2 mb-2 p-2 border rounded-md bg-muted/30">
                <select value={depTaskId} onChange={e => setDepTaskId(e.target.value)}
                  className="flex-1 h-8 text-xs rounded border border-input bg-background px-2 text-foreground">
                  <option value="">Predecessor task…</option>
                  {allProjectTasks.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <select value={depType} onChange={e => setDepType(e.target.value)}
                  className="w-16 h-8 text-xs rounded border border-input bg-background px-2 text-foreground">
                  {["FS","SS","FF","SF"].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button onClick={handleAddDep} disabled={!depTaskId}
                  className="px-2 h-8 text-xs rounded bg-primary text-primary-foreground disabled:opacity-50">Add</button>
              </div>
            )}
            {(deps.predecessors.length > 0 || deps.successors.length > 0) ? (
              <div className="space-y-1">
                {deps.predecessors.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium mb-1">Predecessors</p>
                    {deps.predecessors.map((d: any) => (
                      <div key={d.id} className="flex items-center gap-2 text-xs py-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${DEP_TYPE_BADGE[d.dependencyType] || "bg-muted"}`}>{d.dependencyType}</span>
                        <span className="flex-1 truncate">{d.taskName}</span>
                        {d.lagDays > 0 && <span className="text-muted-foreground">+{d.lagDays}d lag</span>}
                        <button onClick={() => handleRemoveDep(d.id)} className="text-muted-foreground hover:text-red-500">×</button>
                      </div>
                    ))}
                  </div>
                )}
                {deps.successors.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium mb-1">Successors</p>
                    {deps.successors.map((d: any) => (
                      <div key={d.id} className="flex items-center gap-2 text-xs py-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${DEP_TYPE_BADGE[d.dependencyType] || "bg-muted"}`}>{d.dependencyType}</span>
                        <span className="flex-1 truncate">{d.taskName}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No dependencies</p>
            )}
          </div>

          {/* Comments */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Comments ({comments.length})</p>
            <div className="space-y-2.5 mb-3 max-h-48 overflow-y-auto">
              {comments.map((c: any) => (
                <div key={c.id} className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                    {(c.authorName || "?")[0]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{c.authorName || "Unknown"}</span>
                      <span className="text-[10px] text-muted-foreground">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ""}</span>
                      {c.isExternal && <span className="text-[10px] px-1.5 py-0 rounded-full bg-blue-100 text-blue-700 border border-blue-200">Visible to customer</span>}
                    </div>
                    <p className="text-xs text-foreground mt-0.5 whitespace-pre-wrap">{c.body}</p>
                  </div>
                </div>
              ))}
              {comments.length === 0 && <p className="text-xs text-muted-foreground italic">No comments yet</p>}
            </div>
            <div className="flex gap-2">
              <Textarea
                rows={2}
                placeholder="Add a comment… use @name to mention"
                value={commentBody}
                onChange={e => setCommentBody(e.target.value)}
                className="flex-1 text-sm resize-none"
              />
              <Button size="sm" onClick={handlePostComment} disabled={postingComment || !commentBody.trim()} className="self-end">
                {postingComment ? "…" : "Post"}
              </Button>
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function WbsView({ tasks, allocations, projectId, onRefresh, pctFromHours = false }: {
  tasks: Task[];
  allocations: { resourceId?: number; resourceName?: string }[];
  projectId: number;
  onRefresh: () => void;
  pctFromHours?: boolean;
}) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState<Partial<Task> | null | false>(false);
  const [defaultParent, setDefaultParent] = useState<number | null>(null);
  const [slideTask, setSlideTask] = useState<Task | null>(null);

  const toggle = (id: number) => setCollapsed(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const deleteTask = async (id: number) => {
    const children = tasks.filter(t => t.parentId === id);
    if (children.length > 0 && !confirm(`This parent has ${children.length} child task(s). Delete all?`)) return;
    await fetch(`${API}/tasks/${id}`, { method: "DELETE" });
    onRefresh();
  };

  // Build tree
  type TaskNode = Task & { children: TaskNode[] };
  function buildTree(parentId: number | null | undefined): TaskNode[] {
    return tasks
      .filter(t => (t.parentId ?? null) === (parentId ?? null))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id)
      .map(t => ({ ...t, children: buildTree(t.id) }));
  }
  const tree = buildTree(null);

  // Rollup helpers
  function rollupPct(node: TaskNode): number {
    if (node.children.length === 0) return node.completionPct ?? 0;
    const pcts = node.children.map(rollupPct);
    return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  }
  function rollupStart(node: TaskNode): string | undefined {
    if (node.children.length === 0) return node.plannedStartDate;
    const dates = node.children.map(rollupStart).filter(Boolean) as string[];
    if (node.plannedStartDate) dates.push(node.plannedStartDate);
    return dates.length ? dates.sort()[0] : undefined;
  }
  function rollupEnd(node: TaskNode): string | undefined {
    if (node.children.length === 0) return node.plannedEndDate;
    const dates = node.children.map(rollupEnd).filter(Boolean) as string[];
    if (node.plannedEndDate) dates.push(node.plannedEndDate);
    return dates.length ? dates.sort().reverse()[0] : undefined;
  }

  const typeIcon = (type?: string) => {
    if (type === "parent") return <FolderOpen className="h-3.5 w-3.5 text-violet-400 flex-shrink-0" />;
    if (type === "milestone") return <Milestone className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />;
    return <Layers className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />;
  };

  const statusColor: Record<string, string> = {
    todo: "text-slate-400", in_progress: "text-blue-400", in_review: "text-purple-400",
    done: "text-emerald-400", blocked: "text-red-400", cancelled: "text-gray-500",
  };

  function hoursBasedPct(node: TaskNode): number {
    const logged = node.loggedHours ?? 0;
    const est = node.estimatedHours ?? 0;
    return est > 0 ? Math.min(100, Math.round((logged / est) * 100)) : (node.completionPct ?? 0);
  }
  function rollupHoursPct(node: TaskNode): number {
    if (node.children.length === 0) return hoursBasedPct(node);
    const pcts = node.children.map(rollupHoursPct);
    return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  }

  function renderNode(node: TaskNode, depth: number): React.ReactNode {
    const isParent = node.taskType === "parent";
    const isMilestone = node.taskType === "milestone";
    const isCollapsed = collapsed.has(node.id);
    const etcHrs = (node as any).etcHours;
    const commentCount = (node as any).commentCount ?? 0;
    const pct = pctFromHours
      ? (isParent ? rollupHoursPct(node) : hoursBasedPct(node))
      : (isParent ? rollupPct(node) : (node.completionPct ?? 0));
    const startD = isParent ? rollupStart(node) : node.plannedStartDate;
    const endD = isParent ? rollupEnd(node) : node.plannedEndDate;
    const hasChildren = node.children.length > 0;

    return (
      <React.Fragment key={node.id}>
        <tr
          className={`border-t border-border group hover:bg-muted/30 cursor-pointer ${isParent ? "bg-muted/10" : ""}`}
          onClick={() => setSlideTask(node as Task)}
        >
          <td className="px-3 py-2 w-8 text-muted-foreground/30" onClick={e => e.stopPropagation()}>
            <Grip className="h-3 w-3" />
          </td>
          <td className="px-1 py-2" style={{ paddingLeft: `${depth * 20 + 4}px` }}>
            <div className="flex items-center gap-1.5">
              {hasChildren ? (
                <button onClick={() => toggle(node.id)} className="p-0.5 rounded hover:bg-muted">
                  {isCollapsed
                    ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              ) : <span className="w-5" />}
              {typeIcon(node.taskType)}
              <span className={`text-sm ${isParent ? "font-semibold text-foreground" : isMilestone ? "font-medium text-amber-300" : "text-foreground"}`}>
                {node.name}
              </span>
              {node.isClientAction && <Users className="h-3 w-3 text-orange-400" />}
            </div>
          </td>
          <td className="px-3 py-2 w-24">
            <span className={`text-xs ${statusColor[node.status] ?? "text-muted-foreground"}`}>
              {node.status.replace(/_/g, " ")}
            </span>
          </td>
          <td className="px-3 py-2 w-28">
            <div className="flex items-center gap-1.5">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
            </div>
          </td>
          <td className="px-3 py-2 w-24 text-xs text-muted-foreground">
            {startD ? format(new Date(startD), "MMM d") : "—"}
          </td>
          <td className="px-3 py-2 w-24 text-xs text-muted-foreground">
            {endD ? format(new Date(endD), "MMM d") : "—"}
          </td>
          <td className="px-3 py-2 w-28 text-xs text-muted-foreground">
            {node.assignedToName || "—"}
          </td>
          <td className="px-3 py-2 w-24 text-xs text-muted-foreground text-right">
            {node.estimatedHours ? `${node.loggedHours ?? 0}/${node.estimatedHours}h` : "—"}
          </td>
          <td className="px-3 py-2 w-20 text-xs text-right">
            {etcHrs != null ? (
              <span className={`font-medium ${etcHrs > (node.estimatedHours ?? 0) * 0.5 ? "text-amber-500" : "text-muted-foreground"}`}>
                {etcHrs}h
              </span>
            ) : "—"}
          </td>
          <td className="px-3 py-2 w-16 text-center">
            {commentCount > 0 ? (
              <button onClick={(e) => { e.stopPropagation(); setSlideTask(node as Task); }}
                className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium hover:bg-blue-200 transition-colors">
                <MessageSquare className="h-2.5 w-2.5" /> {commentCount}
              </button>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); setSlideTask(node as Task); }}
                className="text-muted-foreground/30 hover:text-muted-foreground transition-colors">
                <MessageSquare className="h-3 w-3" />
              </button>
            )}
          </td>
          <td className="px-3 py-2 w-20" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
              {isParent && (
                <button title="Add child task" onClick={() => { setDefaultParent(node.id); setModal({}); }}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
              <button title="Edit" onClick={() => { setDefaultParent(null); setModal(node); }}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button title="Delete" onClick={() => deleteTask(node.id)}
                className="p-1 rounded hover:bg-muted text-red-400 hover:text-red-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </td>
        </tr>
        {!isCollapsed && node.children.map(child => renderNode(child, depth + 1))}
      </React.Fragment>
    );
  }

  const openNew = (parentId?: number) => { setDefaultParent(parentId ?? null); setModal({}); };

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <span className="text-xs text-muted-foreground">{tasks.length} tasks</span>
        <button onClick={() => openNew()}
          className="ml-auto flex items-center gap-1 text-xs bg-primary text-primary-foreground px-2.5 py-1.5 rounded-md hover:bg-primary/90 transition-colors font-medium">
          <Plus className="h-3.5 w-3.5" /> Add Task
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground/60 text-sm">
          No tasks yet. <button onClick={() => openNew()} className="text-primary hover:underline">Add the first task</button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 w-8"></th>
                <th className="text-left px-1 py-2">Task</th>
                <th className="text-left px-3 py-2 w-24">Status</th>
                <th className="text-left px-3 py-2 w-28">Progress</th>
                <th className="text-left px-3 py-2 w-24">Start</th>
                <th className="text-left px-3 py-2 w-24">End</th>
                <th className="text-left px-3 py-2 w-28">Assignee</th>
                <th className="text-right px-3 py-2 w-24">Hours</th>
                <th className="text-right px-3 py-2 w-20">ETC</th>
                <th className="text-center px-3 py-2 w-16">Cmts</th>
                <th className="px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {tree.map(node => renderNode(node, 0))}
            </tbody>
          </table>
        </div>
      )}

      {modal !== false && (
        <WbsTaskModal
          task={modal === null ? null : { ...modal, parentId: modal.parentId ?? defaultParent ?? null }}
          projectId={projectId}
          allTasks={tasks}
          allocations={allocations}
          onClose={() => { setModal(false); setDefaultParent(null); }}
          onSave={onRefresh}
        />
      )}
      {slideTask && (
        <TaskSlidePanel
          task={slideTask}
          projectId={projectId}
          onClose={() => setSlideTask(null)}
          onSave={() => { setSlideTask(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ─── Kanban View ──────────────────────────────────────────────────────────
function KanbanView({ tasks, onStatusChange, depMap, onAddDep, onRemoveDep }: {
  tasks: Task[];
  onStatusChange: (id:number,status:string)=>void;
  depMap?: Record<number, any[]>;
  onAddDep?: (taskId:number, dependsOnTaskId:number, dependencyType:string, lagDays:number)=>void;
  onRemoveDep?: (taskId:number, depId:number)=>void;
}) {
  const [addDepTask, setAddDepTask] = useState<number|null>(null);
  const [addDepVal, setAddDepVal] = useState<string>("");
  const [addDepType, setAddDepType] = useState<string>("FS");
  const [addDepLag, setAddDepLag] = useState<string>("0");

  const columns = [
    {key:"todo",label:"To Do",color:"border-t-slate-400"},
    {key:"in_progress",label:"In Progress",color:"border-t-blue-500"},
    {key:"in_review",label:"In Review",color:"border-t-purple-500"},
    {key:"blocked",label:"Blocked",color:"border-t-red-500"},
    {key:"done",label:"Done",color:"border-t-emerald-500"},
  ];
  return (
    <div className="flex gap-3 p-4 overflow-x-auto min-h-[500px] pb-6">
      {columns.map(col => {
        const colTasks = tasks.filter(t=>t.status===col.key);
        return (
          <div key={col.key} className={`flex-shrink-0 w-60 bg-muted/40 rounded-xl border-t-4 ${col.color} p-3 space-y-2`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">{col.label}</span>
              <span className="text-xs bg-muted rounded-full px-2 py-0.5 font-medium">{colTasks.length}</span>
            </div>
            {colTasks.map(task => {
              const deps = depMap?.[task.id] ?? [];
              const incompleteDeps = deps.filter(d => d.dependsOnStatus !== "done" && d.dependsOnStatus !== "cancelled");
              return (
                <div key={task.id} className="bg-white rounded-lg border p-3 space-y-2 shadow-sm hover:shadow transition-shadow">
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-sm font-medium leading-tight">{task.name}</p>
                    {task.isClientAction && <Users size={12} className="text-orange-500 flex-shrink-0 mt-0.5" aria-label="Client action" />}
                  </div>
                  {task.phase && <p className="text-xs text-muted-foreground">{task.phase}</p>}
                  {task.assignedToName && <div className="flex items-center gap-1 text-xs text-muted-foreground"><User size={10}/>{task.assignedToName}</div>}
                  {task.dueDate && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Calendar size={10}/>{format(new Date(task.dueDate),"MMM d")}</div>}
                  {task.blockerNote && <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{task.blockerNote}</p>}
                  {task.estimatedHours && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock size={10}/>{task.loggedHours||0}/{task.estimatedHours}h</div>}
                  {/* Dependencies */}
                  {deps.length > 0 && (
                    <div className="space-y-0.5 border-t pt-1.5">
                      {deps.map(d => (
                        <div key={d.id} className={`flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 ${d.dependsOnStatus === "done" || d.dependsOnStatus === "cancelled" ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"}`}>
                          <span className="font-mono bg-black/10 rounded px-0.5">{d.dependencyType ?? "FS"}</span>
                          <span className="flex-1 truncate">{d.dependsOnStatus === "done" || d.dependsOnStatus === "cancelled" ? "✓" : "⏳"} {d.dependsOnName}</span>
                          {(d.lagDays > 0) && <span className="text-[9px] opacity-60">+{d.lagDays}d</span>}
                          {onRemoveDep && <button onClick={() => onRemoveDep(task.id, d.id)} className="opacity-40 hover:opacity-100 ml-1">×</button>}
                        </div>
                      ))}
                    </div>
                  )}
                  {incompleteDeps.length > 0 && (
                    <p className="text-[10px] text-amber-700 font-semibold">Blocked by {incompleteDeps.length} task{incompleteDeps.length > 1 ? "s" : ""}</p>
                  )}
                  {/* Add dependency inline */}
                  {addDepTask === task.id ? (
                    <div className="border-t pt-1.5 space-y-1">
                      <select value={addDepVal} onChange={e=>setAddDepVal(e.target.value)} className="w-full text-[10px] border rounded px-1 py-0.5 bg-background">
                        <option value="">Pick task…</option>
                        {tasks.filter(t=>t.id!==task.id).map(t=>(
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      <div className="flex gap-1">
                        <select value={addDepType} onChange={e=>setAddDepType(e.target.value)} className="text-[10px] border rounded px-1 py-0.5 bg-background font-mono">
                          {["FS","FF","SS","SF"].map(t=><option key={t} value={t}>{t}</option>)}
                        </select>
                        <input type="number" value={addDepLag} onChange={e=>setAddDepLag(e.target.value)} min="0" max="999"
                          placeholder="lag" className="w-12 text-[10px] border rounded px-1 py-0.5 bg-background" title="Lag days" />
                      </div>
                      <div className="flex gap-1">
                        <button onClick={()=>{ if(addDepVal&&onAddDep){onAddDep(task.id,parseInt(addDepVal),addDepType,parseInt(addDepLag)||0);setAddDepTask(null);setAddDepVal("");setAddDepType("FS");setAddDepLag("0");} }} className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded">Add</button>
                        <button onClick={()=>{setAddDepTask(null);setAddDepVal("");setAddDepType("FS");setAddDepLag("0");}} className="text-[10px] text-muted-foreground hover:underline">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={()=>{setAddDepTask(task.id);setAddDepVal("");}} className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1">
                      <span>+ Depends on…</span>
                    </button>
                  )}
                  <div className="flex gap-2 flex-wrap mt-1">
                    {col.key!=="done" && <button onClick={()=>onStatusChange(task.id,"done")} className="text-xs text-emerald-600 hover:underline">✓ Done</button>}
                    {col.key!=="in_progress"&&col.key!=="done" && <button onClick={()=>onStatusChange(task.id,"in_progress")} className="text-xs text-blue-600 hover:underline">▶ Start</button>}
                    {col.key!=="blocked"&&col.key!=="done" && <button onClick={()=>onStatusChange(task.id,"blocked")} className="text-xs text-red-500 hover:underline">⛔ Block</button>}
                  </div>
                </div>
              );
            })}
            {colTasks.length===0 && <p className="text-xs text-muted-foreground text-center py-4">Empty</p>}
          </div>
        );
      })}
    </div>
  );
}

// ─── List View ─────────────────────────────────────────────────────────────
function ListView({ tasks, milestones, onStatusChange, depMap }: { tasks:Task[]; milestones:Milestone[]; onStatusChange:(id:number,status:string)=>void; depMap?: Record<number,any[]> }) {
  const [filter, setFilter] = useState<"all"|"client"|"blocked"|"overdue">("all");
  const today = new Date().toISOString().split("T")[0];
  const filtered = tasks.filter(t => {
    if (filter==="client") return t.isClientAction;
    if (filter==="blocked") return t.status==="blocked";
    if (filter==="overdue") return t.dueDate && t.dueDate<today && t.status!=="done";
    return true;
  });
  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2 items-center">
        {(["all","client","blocked","overdue"] as const).map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter===f?"bg-primary text-primary-foreground":"bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} tasks</span>
      </div>
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Task</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Phase / Milestone</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Owner</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Due</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Hours</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((task,i) => {
              const ms = milestones.find(m=>m.id===task.milestoneId);
              const isOverdue = task.dueDate && task.dueDate<today && task.status!=="done";
              const deps = depMap?.[task.id] ?? [];
              const incompleteDeps = deps.filter(d => d.dependsOnStatus !== "done" && d.dependsOnStatus !== "cancelled");
              return (
                <tr key={task.id} className={`border-t hover:bg-muted/20 ${i%2===0?"":"bg-muted/10"}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {task.status==="done"?<CheckSquare size={13} className="text-emerald-500 flex-shrink-0"/>:<Square size={13} className="text-muted-foreground flex-shrink-0"/>}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={task.status==="done"?"line-through text-muted-foreground":"font-medium"}>{task.name}</span>
                          {task.isClientAction && <Users size={11} className="text-orange-500"/>}
                          {task.blockerNote && <AlertCircle size={11} className="text-red-500" aria-label={task.blockerNote}/>}
                        </div>
                        {incompleteDeps.length > 0 && (
                          <p className="text-[10px] text-amber-700 mt-0.5">⏳ Blocked by: {incompleteDeps.map((d:any) => d.dependsOnName).join(", ")}</p>
                        )}
                        {incompleteDeps.length === 0 && deps.length > 0 && (
                          <p className="text-[10px] text-emerald-600 mt-0.5">✓ {deps.length} dep{deps.length>1?"s":""} satisfied</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {task.phase&&<div>{task.phase}</div>}
                    {ms&&<div className="text-slate-400">{ms.name}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{task.assignedToName||"—"}</td>
                  <td className={`px-4 py-3 text-xs ${isOverdue?"text-red-600 font-medium":"text-muted-foreground"}`}>
                    {task.dueDate?format(new Date(task.dueDate),"MMM d"):"—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {task.estimatedHours?`${task.loggedHours||0}/${task.estimatedHours}h`:"—"}
                  </td>
                  <td className="px-4 py-3">
                    <select value={task.status} onChange={e=>onStatusChange(task.id,e.target.value)} className="text-xs border rounded px-1.5 py-0.5 bg-background">
                      {["todo","in_progress","in_review","done","blocked","cancelled"].map(s=>(
                        <option key={s} value={s}>{s.replace(/_/g," ")}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
            {filtered.length===0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">No tasks matching this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Milestone Comments ─────────────────────────────────────────────────────

function renderMentionText(body: string): React.ReactNode {
  const parts = body.split(/(@[A-Za-z][A-Za-z ]*)/g);
  return parts.map((part, i) =>
    part.startsWith("@")
      ? <span key={i} className="text-primary font-semibold">{part}</span>
      : part
  );
}

function MilestoneCommentsPanel({ milestoneId, projectId }: { milestoneId: number; projectId: number }) {
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/milestones/${milestoneId}/comments`)
      .then(r => r.json()).then(d => { setComments(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [milestoneId]);

  useEffect(() => {
    fetch(`${API}/users?active=true`)
      .then(r => r.json())
      .then(d => setUsers(Array.isArray(d) ? d.map((u: any) => ({ id: u.id, name: u.name })) : []))
      .catch(() => {});
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setText(val);
    const match = val.match(/(^|\s)@(\S*)$/);
    setMentionQuery(match ? match[2] : null);
  };

  const selectMention = (name: string) => {
    const newText = text.replace(/(^|\s)@\S*$/, (m, prefix) => `${prefix}@${name} `);
    setText(newText);
    setMentionQuery(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const filteredUsers = mentionQuery !== null
    ? users.filter(u => u.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6)
    : [];

  const post = async () => {
    if (!text.trim()) return;
    setPosting(true);
    setMentionQuery(null);
    const res = await fetch(`${API}/milestones/${milestoneId}/comments`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text, authorName: "Project Manager", projectId }),
    });
    if (res.ok) { const c = await res.json(); setComments(prev => [...prev, c]); setText(""); }
    setPosting(false);
  };

  return (
    <div className="mt-2 ml-6 border rounded-lg bg-muted/20 p-3 space-y-2">
      {loading ? <p className="text-xs text-muted-foreground">Loading…</p>
        : comments.length === 0 ? <p className="text-xs text-muted-foreground italic">No comments yet.</p>
        : <div className="space-y-2 max-h-40 overflow-y-auto">
          {comments.map((c,i)=>(
            <div key={i} className="flex gap-2">
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[9px] font-bold text-primary">{(c.authorName||"U").charAt(0)}</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold">{c.authorName||"User"}</span>
                  <span className="text-[10px] text-muted-foreground">{c.createdAt?format(new Date(c.createdAt),"MMM d, h:mm a"):""}</span>
                </div>
                <p className="text-xs text-foreground/80 mt-0.5">{renderMentionText(c.body||c.comment||"")}</p>
              </div>
            </div>
          ))}
        </div>
      }
      <div className="flex gap-1.5 relative">
        {filteredUsers.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 w-56 bg-popover border rounded-lg shadow-lg z-50 py-1 overflow-hidden">
            <p className="text-[10px] text-muted-foreground px-2.5 pt-1 pb-0.5 font-medium">Mention a teammate</p>
            {filteredUsers.map(u => (
              <button
                key={u.id}
                onMouseDown={e => { e.preventDefault(); selectMention(u.name); }}
                className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent flex items-center gap-2"
              >
                <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-[9px] font-bold text-primary">
                  {u.name.charAt(0)}
                </span>
                {u.name}
              </button>
            ))}
          </div>
        )}
        <input
          ref={inputRef}
          value={text}
          onChange={handleChange}
          onKeyDown={e => {
            if (e.key === "Escape") { setMentionQuery(null); return; }
            if (e.key === "Enter" && !e.shiftKey && mentionQuery === null) post();
          }}
          placeholder="Add a comment… type @ to mention"
          className="flex-1 text-xs border rounded px-2.5 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Button size="sm" className="h-7 text-xs px-3" onClick={post} disabled={posting||!text.trim()}>{posting?"…":"Post"}</Button>
      </div>
    </div>
  );
}

// ─── Phase Board (Milestones tab) ───────────────────────────────────────────
function PhaseBoardView({ phases, milestones, tasks, onMilestoneStatus, project, onDraftInvoice }: {
  phases:Phase[]; milestones:Milestone[]; tasks:Task[];
  onMilestoneStatus:(id:number,status:string)=>void;
  project?: any; onDraftInvoice?: (ms: Milestone) => void;
}) {
  const [expandedComments, setExpandedComments] = useState<number | null>(null);
  const today = new Date().toISOString().split("T")[0];
  const phaseList = phases.length > 0 ? phases : [{id:0,name:"All Milestones",sequence:1,status:"in_progress"} as Phase];

  // Build a set of phase IDs (as numbers) and names for lookup
  const phaseIds = new Set(phases.map(p => p.id));
  const phaseNames = new Set(phases.map(p => p.name?.toLowerCase()));

  // Milestones not matched to any known phase
  const orphanMilestones = phases.length > 0
    ? milestones.filter(m => {
        const mid = m.phaseId != null ? Number(m.phaseId) : null;
        return (mid == null || !phaseIds.has(mid)) && !(m.phase && phaseNames.has(m.phase.toLowerCase()));
      })
    : [];

  return (
    <div className="p-4 space-y-5">
      {phaseList.map(ph => {
        const phaseMilestones = phases.length > 0
          ? milestones.filter(m => Number(m.phaseId) === ph.id || m.phase?.toLowerCase() === ph.name?.toLowerCase())
          : milestones;
        const msDone = phaseMilestones.filter(m=>m.status==="completed").length;
        const msTotal = phaseMilestones.length;
        const pct = msTotal > 0 ? Math.round((msDone/msTotal)*100) : 0;
        return (
          <div key={ph.id} className="border rounded-xl overflow-hidden shadow-sm">
            <div className="bg-muted/60 px-4 py-3 flex items-center gap-3">
              <div className={`w-1.5 h-8 rounded-full ${ph.status==="completed"?"bg-emerald-500":ph.status==="in_progress"?"bg-blue-500":"bg-slate-300"}`} />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold">{ph.name}</h3>
                  <StatusBadge status={ph.status} />
                  <span className="text-xs text-muted-foreground">{msDone}/{msTotal} complete</span>
                </div>
                {(ph.startDate||ph.endDate) && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ph.startDate?format(new Date(ph.startDate),"MMM d"):"—"} → {ph.endDate?format(new Date(ph.endDate),"MMM d, yyyy"):"TBD"}
                  </p>
                )}
              </div>
              <div className="w-28 text-right">
                <div className="text-sm font-bold">{pct}%</div>
                <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                  <div className={`h-1.5 rounded-full ${pct===100?"bg-emerald-500":pct>50?"bg-blue-500":"bg-slate-400"}`} style={{width:`${pct}%`}} />
                </div>
              </div>
            </div>
            <div className="divide-y">
              {phaseMilestones.map(ms => {
                const msTasks = tasks.filter(t=>t.milestoneId===ms.id);
                const doneTasks = msTasks.filter(t=>t.status==="done").length;
                const isOverdue = ms.dueDate && ms.dueDate<today && ms.status!=="completed";
                const blockedTasks = msTasks.filter(t=>t.status==="blocked");
                return (
                  <div key={ms.id} className="px-4 py-3 hover:bg-muted/10 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        {ms.status==="completed"?<CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5"/>
                          :isOverdue?<AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5"/>
                          :<Circle size={16} className="text-muted-foreground flex-shrink-0 mt-0.5"/>}
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{ms.name}</p>
                          {ms.description && <p className="text-xs text-muted-foreground mt-0.5">{ms.description}</p>}
                          {ms.clientAction && <p className="text-xs text-orange-600 mt-1 flex items-center gap-1"><Users size={10}/>Client: {ms.clientAction}</p>}
                          {blockedTasks.length > 0 && (
                            <p className="text-xs text-red-500 mt-1">{blockedTasks.length} blocked task{blockedTasks.length>1?"s":""}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                        {ms.ownerName && <span className="text-xs text-muted-foreground flex items-center gap-1"><User size={10}/>{ms.ownerName}</span>}
                        {ms.dueDate && (
                          <span className={`text-xs flex items-center gap-1 ${isOverdue?"text-red-600 font-medium":"text-muted-foreground"}`}>
                            <Calendar size={10}/>{format(new Date(ms.dueDate),"MMM d")}
                          </span>
                        )}
                        {ms.isBillable && ms.billableAmount && (
                          <span className="text-xs text-emerald-600 flex items-center gap-1"><DollarSign size={10}/>{fmt$(ms.billableAmount)}</span>
                        )}
                        {ms.isBillable && ms.status==="completed" && !ms.invoiced && onDraftInvoice && (
                          <Button size="sm" variant="outline"
                            className="h-6 text-[10px] px-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                            onClick={e=>{e.stopPropagation();onDraftInvoice(ms);}}>
                            Draft Invoice
                          </Button>
                        )}
                        <Button size="sm" variant="ghost"
                          className={`h-6 text-[10px] px-2 gap-1 ${expandedComments===ms.id?"text-primary":"text-muted-foreground"}`}
                          onClick={()=>setExpandedComments(v=>v===ms.id?null:ms.id)}>
                          <MessageSquare size={11}/>{expandedComments===ms.id?"Hide":"Notes"}
                        </Button>
                        {ms.status!=="completed" && (
                          <Button size="sm" variant="outline"
                            className="h-6 text-[10px] px-2 text-emerald-700 border-emerald-300"
                            onClick={()=>onMilestoneStatus(ms.id,"completed")}>
                            ✓ Complete
                          </Button>
                        )}
                        <select value={ms.status} onChange={e=>onMilestoneStatus(ms.id,e.target.value)}
                          className="text-[10px] border rounded px-1.5 py-0.5 bg-background">
                          {["pending","in_progress","completed","overdue","at_risk"].map(s=>(
                            <option key={s} value={s}>{s.replace(/_/g," ")}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {msTasks.length>0 && (
                      <div className="mt-1.5 ml-6 flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full h-1">
                          <div className="h-1 rounded-full bg-blue-500 transition-all" style={{width:`${msTotal>0?(doneTasks/msTasks.length)*100:0}%`}} />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{doneTasks}/{msTasks.length} tasks</span>
                      </div>
                    )}
                    {expandedComments===ms.id && <MilestoneCommentsPanel milestoneId={ms.id} projectId={project?.id??0} />}
                  </div>
                );
              })}
              {phaseMilestones.length===0 && <div className="px-4 py-4 text-sm text-muted-foreground/60 italic">No milestones assigned to this phase.</div>}
            </div>
          </div>
        );
      })}

      {/* Orphan milestones not matched to any phase */}
      {orphanMilestones.length > 0 && (
        <div className="border rounded-xl overflow-hidden shadow-sm">
          <div className="bg-muted/60 px-4 py-3 flex items-center gap-3">
            <div className="w-1.5 h-8 rounded-full bg-slate-300" />
            <div className="flex-1">
              <h3 className="font-semibold">Unassigned Milestones</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{orphanMilestones.filter(m=>m.status==="completed").length}/{orphanMilestones.length} complete</p>
            </div>
          </div>
          <div className="divide-y">
            {orphanMilestones.map(ms => {
              const msTasks = tasks.filter(t=>t.milestoneId===ms.id);
              const doneTasks = msTasks.filter(t=>t.status==="done").length;
              const today = new Date().toISOString().split("T")[0];
              const isOverdue = ms.dueDate && ms.dueDate<today && ms.status!=="completed";
              return (
                <div key={ms.id} className="px-4 py-3 hover:bg-muted/10 transition-colors">
                  <div className="flex items-start gap-2">
                    {ms.status==="completed"?<CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5"/>
                      :isOverdue?<AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5"/>
                      :<Circle size={16} className="text-muted-foreground flex-shrink-0 mt-0.5"/>}
                    <div>
                      <p className="font-medium text-sm">{ms.name}</p>
                      {ms.description && <p className="text-xs text-muted-foreground mt-0.5">{ms.description}</p>}
                      {msTasks.length>0 && (
                        <p className="text-xs text-muted-foreground mt-1">{doneTasks}/{msTasks.length} tasks</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Overview Tab ───────────────────────────────────────────────────────────
function OverviewTab({ data, timesheets, invoices, marginForecast, projection }: { data: any; timesheets: any[]; invoices: any[]; marginForecast?: any; projection?: any }) {
  const { project, phases, milestones, tasks, allocations, health, nextMilestone, budgetBurn, changeRequests } = data;
  const today = new Date().toISOString().split("T")[0];
  const thisWeek = new Date(); thisWeek.setDate(thisWeek.getDate() - 7);
  const thisWeekStr = thisWeek.toISOString().split("T")[0];
  const blocked = tasks.filter((t:Task) => t.status === "blocked");
  const overdue = milestones.filter((m:Milestone) => m.dueDate && m.dueDate < today && m.status !== "completed");
  const totalBillableThisWeek = timesheets
    .filter((t:any) => t.weekStartDate >= thisWeekStr)
    .reduce((s:number, t:any) => s + parseFloat(t.billableHours||0), 0);
  const invoicePaid = invoices.filter((i:any) => i.status==="paid").reduce((s:number,i:any)=>s+parseFloat(i.amount||0),0);
  const invoiceOutstanding = invoices.filter((i:any) => ["sent","overdue"].includes(i.status)).reduce((s:number,i:any)=>s+parseFloat(i.amount||0),0);
  const openCRs = (changeRequests||[]).filter((cr:any) => ["pending_review","open","client_review"].includes(cr.status)).length;
  const budgetValue = parseFloat(project.budgetValue||0);
  const billedValue = parseFloat(project.billedValue||0);
  const budgetHours = parseFloat(project.budgetHours||0);
  const consumedHours = parseFloat(project.consumedHours||0);
  const burnPct = budgetHours > 0 ? Math.round((consumedHours/budgetHours)*100) : 0;
  const marginEst = budgetValue > 0 ? Math.round(((budgetValue - consumedHours * 150) / budgetValue) * 100) : 0;
  const hColor = health.color==="green"?"bg-emerald-500":health.color==="yellow"?"bg-amber-400":"bg-red-500";
  const hTextColor = health.color==="green"?"text-emerald-600":health.color==="yellow"?"text-amber-500":"text-red-600";

  return (
    <div className="p-5 space-y-5 overflow-y-auto max-h-full">
      {/* Risk callouts */}
      {(blocked.length > 0 || overdue.length > 0 || openCRs > 0) && (
        <div className="flex flex-wrap gap-2">
          {blocked.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertTriangle size={14} className="shrink-0"/>
              <span className="font-medium">{blocked.length} blocked task{blocked.length>1?"s":""}</span>
              <span className="text-red-400 text-xs">{blocked.slice(0,2).map((t:Task)=>t.name).join(", ")}{blocked.length>2?" …":""}</span>
            </div>
          )}
          {overdue.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              <Clock size={14} className="shrink-0"/>
              <span className="font-medium">{overdue.length} overdue milestone{overdue.length>1?"s":""}</span>
            </div>
          )}
          {openCRs > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm">
              <Info size={14} className="shrink-0"/>
              <span className="font-medium">{openCRs} open change order{openCRs>1?"s":""}</span>
            </div>
          )}
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {/* Health */}
        <Card
          className="col-span-1"
          title="Health score based on schedule, budget, and milestone adherence"
        >
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1">
              Health
            </p>
            <div className="flex items-end gap-2">
              <span className={`text-3xl font-bold ${hTextColor}`}>{health.score}</span>
              <span className="text-xs text-muted-foreground mb-1">/100</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 mt-2">
              <div className={`h-1.5 rounded-full transition-all ${hColor}`} style={{width:`${health.score}%`}} />
            </div>
            {health.reasons?.slice(0,2).map((r:HealthReason,i:number)=>(
              <p key={i} className="text-[10px] text-muted-foreground mt-1.5 leading-tight">↳ {r.label}</p>
            ))}
          </CardContent>
        </Card>

        {/* Budget burn */}
        <Card className="col-span-1">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium mb-2">Budget Burn</p>
            <div className="flex items-end gap-1">
              <span className={`text-2xl font-bold ${burnPct>90?"text-red-600":burnPct>70?"text-amber-500":"text-foreground"}`}>{burnPct}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 mt-2">
              <div className={`h-1.5 rounded-full transition-all ${burnPct>90?"bg-red-500":burnPct>70?"bg-amber-400":"bg-blue-500"}`} style={{width:`${Math.min(burnPct,100)}%`}} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">{consumedHours.toFixed(0)} / {budgetHours.toFixed(0)} hrs</p>
          </CardContent>
        </Card>

        {/* Progress */}
        <Card className="col-span-1">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium mb-2">Progress</p>
            <span className="text-2xl font-bold">{project.completionPct||0}%</span>
            <div className="w-full bg-muted rounded-full h-1.5 mt-2">
              <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{width:`${project.completionPct||0}%`}} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {milestones.filter((m:Milestone)=>m.status==="completed").length}/{milestones.length} milestones
            </p>
          </CardContent>
        </Card>

        {/* Margin Forecast */}
        <Card className="col-span-1">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium mb-2">Margin Forecast</p>
            {marginForecast ? (
              <>
                <span className={`text-2xl font-bold ${
                  marginForecast.marginStatus === "good" ? "text-emerald-600"
                  : marginForecast.marginStatus === "warning" ? "text-amber-500"
                  : "text-red-600"
                }`}>
                  {marginForecast.forecastMarginPct !== null ? `${marginForecast.forecastMarginPct}%` : "—"}
                </span>
                <div className={`inline-flex items-center text-[10px] font-semibold mt-1.5 px-1.5 py-0.5 rounded-full border block w-fit ${
                  marginForecast.marginStatus === "good" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : marginForecast.marginStatus === "warning" ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-red-50 text-red-700 border-red-200"
                }`}>
                  {marginForecast.marginStatus === "good" ? "✓ Good" : marginForecast.marginStatus === "warning" ? "⚠ Warning" : "⚑ Critical"}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{fmt$(marginForecast.forecastMargin)} forecast</p>
              </>
            ) : (
              <>
                <span className={`text-2xl font-bold ${marginEst < 20 ? "text-red-600" : marginEst < 30 ? "text-amber-500" : "text-emerald-600"}`}>{marginEst}%</span>
                <p className="text-[10px] text-muted-foreground mt-2">Est. at $150/hr blended</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Time this week */}
        <Card className="col-span-1">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium mb-2">Billed This Week</p>
            <span className="text-2xl font-bold">{totalBillableThisWeek.toFixed(0)}</span>
            <span className="text-sm text-muted-foreground ml-1">hrs</span>
            <p className="text-[10px] text-muted-foreground mt-2">{timesheets.filter((t:any)=>t.weekStartDate>=thisWeekStr).length} timesheet{timesheets.length!==1?"s":""}</p>
          </CardContent>
        </Card>

        {/* Invoice status */}
        <Card className="col-span-1">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium mb-2">Invoices</p>
            <span className="text-2xl font-bold text-emerald-600">{fmt$(invoicePaid)}</span>
            <p className="text-[10px] text-muted-foreground mt-1">paid</p>
            {invoiceOutstanding > 0 && (
              <p className="text-[10px] text-amber-600 font-medium mt-0.5">{fmt$(invoiceOutstanding)} outstanding</p>
            )}
          </CardContent>
        </Card>

        {/* ETC Projection */}
        <Card className="col-span-1">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium mb-2">Projected End</p>
            {projection?.projectedEnd ? (() => {
              const slipDays = project.endDate
                ? Math.round((new Date(projection.projectedEnd).getTime() - new Date(project.endDate).getTime()) / 86400000)
                : null;
              return (
                <>
                  <span className={`text-xl font-bold ${
                    slipDays != null && slipDays > 14 ? "text-red-600"
                    : slipDays != null && slipDays > 0 ? "text-amber-500"
                    : "text-emerald-600"
                  }`}>
                    {format(new Date(projection.projectedEnd), "MMM d, yyyy")}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {slipDays == null ? "No planned end set"
                      : slipDays > 0 ? `+${slipDays}d vs planned`
                      : slipDays < 0 ? `${Math.abs(slipDays)}d ahead of plan`
                      : "On schedule"}
                  </p>
                  {projection.totalEtc != null && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{Number(projection.totalEtc).toFixed(0)} hrs ETC remaining</p>
                  )}
                </>
              );
            })() : (
              <span className="text-sm text-muted-foreground">No ETC data</span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4-Dimension Health RAG Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: "healthBudget", label: "Budget" },
          { key: "healthHours", label: "Hours" },
          { key: "healthTimeline", label: "Timeline" },
          { key: "healthRisks", label: "Risks" },
        ].map(dim => {
          const val: string = (project as any)[dim.key] || "green";
          const colorCls = val === "green" ? "bg-emerald-500" : val === "amber" ? "bg-amber-500" : "bg-red-500";
          const textCls = val === "green" ? "text-emerald-600" : val === "amber" ? "text-amber-600" : "text-red-600";
          const labelCls = val === "green" ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/40"
            : val === "amber" ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/40"
            : "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800/40";
          return (
            <Card key={dim.key} className={`border ${labelCls}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${colorCls}`} />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{dim.label}</p>
                </div>
                <p className={`text-sm font-bold capitalize ${textCls}`}>{val}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Next milestone + Blocked tasks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {nextMilestone && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Next Milestone</p>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{nextMilestone.name}</p>
                  {nextMilestone.description && <p className="text-xs text-muted-foreground mt-0.5">{nextMilestone.description}</p>}
                </div>
                {nextMilestone.dueDate && (
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{format(new Date(nextMilestone.dueDate),"MMM d")}</p>
                    <p className="text-xs text-muted-foreground">{new Date(nextMilestone.dueDate).getFullYear()}</p>
                  </div>
                )}
              </div>
              {nextMilestone.isBillable && nextMilestone.billableAmount && (
                <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
                  <DollarSign size={11}/> Billable: {fmt$(nextMilestone.billableAmount)}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {health.reasons?.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/30">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">Health Factors</p>
              <div className="space-y-1.5">
                {health.reasons.map((r:HealthReason,i:number)=>(
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span>{r.severity==="high"?"🔴":r.severity==="medium"?"🟡":"🟢"}</span>
                    <span className="flex-1">{r.label}</span>
                    <span className="text-muted-foreground font-mono font-medium">-{r.impact}pts</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Phase timeline (compact) */}
      {phases.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Phase Progress</p>
            <div className="space-y-2">
              {phases.map((ph:Phase) => {
                const phaseMilestones = milestones.filter((m:Milestone)=>Number(m.phaseId)===ph.id||m.phase?.toLowerCase()===ph.name?.toLowerCase());
                const done = phaseMilestones.filter((m:Milestone)=>m.status==="completed").length;
                const pct = phaseMilestones.length > 0 ? Math.round((done/phaseMilestones.length)*100) : 0;
                return (
                  <div key={ph.id} className="flex items-center gap-3">
                    <div className={`w-1.5 h-4 rounded-full shrink-0 ${ph.status==="completed"?"bg-emerald-500":ph.status==="in_progress"?"bg-blue-500":"bg-slate-300"}`} />
                    <span className="text-sm font-medium w-48 truncate">{ph.name}</span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${pct===100?"bg-emerald-500":"bg-blue-500"}`} style={{width:`${pct}%`}} />
                    </div>
                    <span className="text-xs text-muted-foreground w-16 text-right">{done}/{phaseMilestones.length} · {pct}%</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Team Tab ───────────────────────────────────────────────────────────────
function TeamTab({ allocations, tasks }: { allocations: Allocation[]; tasks: Task[] }) {
  const [, nav] = useLocation();
  const totalHoursPerWeek = allocations.reduce((s,a) => s + (parseFloat(String(a.hoursPerWeek||0))), 0);
  const overAllocated = allocations.filter(a => (a.allocationPct||0) > 100);
  const clientActions = tasks.filter(t=>t.isClientAction && t.status!=="done");
  const blockers = tasks.filter(t=>t.status==="blocked");

  return (
    <div className="p-5 space-y-5">
      {/* Summary header */}
      <div className="flex items-center gap-4 p-4 bg-muted/40 rounded-xl border">
        <div className="text-center px-4 border-r border-border">
          <p className="text-2xl font-bold">{allocations.length}</p>
          <p className="text-xs text-muted-foreground">Team members</p>
        </div>
        <div className="text-center px-4 border-r border-border">
          <p className="text-2xl font-bold">{totalHoursPerWeek.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground">Planned hrs / week</p>
        </div>
        <div className="text-center px-4">
          <p className={`text-2xl font-bold ${overAllocated.length > 0 ? "text-red-600" : "text-emerald-600"}`}>
            {overAllocated.length === 0 ? "✓" : overAllocated.length}
          </p>
          <p className="text-xs text-muted-foreground">{overAllocated.length === 0 ? "No conflicts" : "Over-allocated"}</p>
        </div>
      </div>

      {/* Over-allocation warning */}
      {overAllocated.length > 0 && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700">
          <AlertTriangle size={15} className="mt-0.5 shrink-0"/>
          <div>
            <p className="text-sm font-semibold">Over-allocation detected</p>
            <p className="text-xs mt-0.5">{overAllocated.map(a=>a.resourceName).join(", ")} {overAllocated.length===1?"is":"are"} allocated above 100%</p>
          </div>
        </div>
      )}

      {/* Allocation table */}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Resource</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Role</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Allocation</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Hrs / Week</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Period</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {allocations.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">No team allocations on record.</td></tr>
            )}
            {allocations.map((a, i) => {
              const isOver = (a.allocationPct||0) > 100;
              return (
                <tr key={a.id} className={`border-t hover:bg-muted/20 ${i%2===0?"":"bg-muted/10"}`}>
                  <td className="px-4 py-3">
                    <button onClick={()=>nav(a.resourceId?`/resources/${a.resourceId}`:"/resources")}
                      className="flex items-center gap-1.5 hover:text-primary transition-colors font-medium">
                      {a.resourceName||"Resource"}
                      <ExternalLink size={10} className="text-muted-foreground/50"/>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{a.role||"—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-muted rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${isOver?"bg-red-500":"bg-blue-500"}`} style={{width:`${Math.min(a.allocationPct||0,100)}%`}} />
                      </div>
                      <span className={`text-xs font-medium ${isOver?"text-red-600":""}`}>{a.allocationPct||0}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{parseFloat(String(a.hoursPerWeek||0)).toFixed(0)} hrs</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {a.startDate?format(new Date(a.startDate),"MMM d"):"—"} → {a.endDate?format(new Date(a.endDate),"MMM d, yy"):"TBD"}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={a.status||"confirmed"}/></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Blockers + Client actions */}
      {(clientActions.length > 0 || blockers.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {blockers.length > 0 && (
            <Card className="border-red-200 bg-red-50/30">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">Active Blockers</p>
                {blockers.map((t:Task)=>(
                  <div key={t.id} className="flex items-start gap-2 py-1.5 border-b last:border-0 border-red-100">
                    <AlertTriangle size={11} className="text-red-500 mt-0.5 shrink-0"/>
                    <div><p className="text-xs font-medium">{t.name}</p>{t.blockerNote&&<p className="text-xs text-red-500">{t.blockerNote}</p>}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {clientActions.length > 0 && (
            <Card className="border-orange-200 bg-orange-50/30">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-2">Pending Client Actions</p>
                {clientActions.map((t:Task)=>(
                  <div key={t.id} className="flex items-start gap-2 py-1.5 border-b last:border-0 border-orange-100">
                    <Users size={11} className="text-orange-500 mt-0.5 shrink-0"/>
                    <div><p className="text-xs font-medium">{t.name}</p>{t.dueDate&&<p className="text-xs text-muted-foreground">Due {format(new Date(t.dueDate),"MMM d")}</p>}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Work Logs Tab ───────────────────────────────────────────────────────────
function WorkLogsTab({ timesheets, onApprove, onReject, canApprove }: {
  timesheets: any[]; onApprove: (id:number)=>void; onReject: (id:number)=>void; canApprove: boolean;
}) {
  const totalBillable = timesheets.reduce((s,t)=>s+parseFloat(t.billableHours||0),0);
  const totalRegular = timesheets.reduce((s,t)=>s+parseFloat(t.regularHours||0),0);
  const totalOT = timesheets.reduce((s,t)=>s+parseFloat(t.overtimeHours||0),0);
  const statusCount = timesheets.reduce((acc:Record<string,number>,t:any)=>{ acc[t.status]=(acc[t.status]||0)+1; return acc; },{});

  return (
    <div className="p-5 space-y-4">
      {/* Summary header */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Billable Hours", val: totalBillable.toFixed(1), color: "text-emerald-600" },
          { label: "Regular Hours", val: totalRegular.toFixed(1), color: "text-foreground" },
          { label: "Overtime Hours", val: totalOT.toFixed(1), color: totalOT>0?"text-amber-600":"text-foreground" },
          { label: "Submitted", val: String(statusCount.submitted||0), color: "text-blue-600" },
          { label: "Approved", val: String(statusCount.approved||0), color: "text-emerald-600" },
        ].map(kpi=>(
          <div key={kpi.label} className="p-3 bg-muted/40 rounded-xl border text-center">
            <p className={`text-xl font-bold ${kpi.color}`}>{kpi.val}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Timesheets table */}
      {timesheets.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed">
          <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3"/>
          <p className="text-muted-foreground font-medium">No timesheets logged for this project yet</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Resource</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Week Start</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Billable</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Regular</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Overtime</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                {canApprove && <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {timesheets.map((ts:any, i:number) => (
                <tr key={ts.id} className={`border-t hover:bg-muted/20 ${i%2===0?"":"bg-muted/10"}`}>
                  <td className="px-4 py-3 font-medium">{ts.resourceName||"—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {ts.weekStartDate ? format(new Date(ts.weekStartDate),"MMM d, yyyy") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-medium">{parseFloat(ts.billableHours||0).toFixed(1)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{parseFloat(ts.regularHours||0).toFixed(1)}</td>
                  <td className={`px-4 py-3 text-right ${parseFloat(ts.overtimeHours||0)>0?"text-amber-600":"text-muted-foreground"}`}>
                    {parseFloat(ts.overtimeHours||0).toFixed(1)}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={ts.status}/></td>
                  {canApprove && (
                    <td className="px-4 py-3">
                      {ts.status === "submitted" && (
                        <div className="flex items-center gap-1.5">
                          <button onClick={()=>onApprove(ts.id)}
                            className="flex items-center gap-1 text-xs text-emerald-700 hover:bg-emerald-50 px-2 py-1 rounded border border-emerald-200 transition-colors">
                            <ThumbsUp size={11}/> Approve
                          </button>
                          <button onClick={()=>onReject(ts.id)}
                            className="flex items-center gap-1 text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded border border-red-200 transition-colors">
                            <ThumbsDown size={11}/> Reject
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Gantt Tab ───────────────────────────────────────────────────────────────
const GANTT_STATUS_COLOR: Record<string, string> = {
  todo: "bg-slate-300", in_progress: "bg-blue-400", in_review: "bg-purple-400",
  done: "bg-emerald-400", blocked: "bg-red-400", cancelled: "bg-gray-200",
  completed: "bg-emerald-400", not_started: "bg-slate-200", active: "bg-blue-300",
};
const DONE_STATUSES = new Set(["done", "completed"]);
// Row heights (px) matching Tailwind h-9 / h-8 / h-7
const ROW_H: Record<string, number> = { phase: 36, milestone: 32, task: 28 };
const SVG_W = 1000; // logical units 0-1000 == 0-100% of timeline width

function GanttTab({ projectId }: { projectId: number }) {
  const [gantt, setGantt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ lines: string[]; x: number; y: number } | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/projects/${projectId}/gantt`)
      .then(r => r.json()).then(setGantt).catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <div className="p-8 text-center text-muted-foreground text-sm animate-pulse">Building timeline…</div>;
  if (!gantt || !gantt.rows?.length) return <div className="p-8 text-center text-muted-foreground text-sm">No timeline data. Add phases, milestones, or due dates to tasks.</div>;

  const { timelineStart, timelineEnd, rows, dependencies = [] } = gantt;
  const tStart = new Date(timelineStart);
  const tEnd   = new Date(timelineEnd);
  const totalDays = Math.max(1, differenceInDays(tEnd, tStart));
  const today = new Date();
  const todayPct = Math.min(100, Math.max(0, (differenceInDays(today, tStart) / totalDays) * 100));

  // Month header markers
  const months: { label: string; pct: number }[] = [];
  const cur = new Date(tStart.getFullYear(), tStart.getMonth(), 1);
  while (cur <= tEnd) {
    const pct = (differenceInDays(cur, tStart) / totalDays) * 100;
    if (pct >= 0) months.push({ label: format(cur, "MMM yy"), pct });
    cur.setMonth(cur.getMonth() + 1);
  }

  function barLeft(start: string | null): number {
    if (!start) return 0;
    return Math.max(0, Math.min(100, (differenceInDays(new Date(start), tStart) / totalDays) * 100));
  }
  function barWidth(start: string | null, end: string | null): number {
    if (!start || !end) return 0;
    const days = differenceInDays(new Date(end), new Date(start));
    return Math.max(0.4, Math.min((days / totalDays) * 100, 100));
  }
  // Convert a % position to SVG logical units
  function toSvgX(pct: number): number { return (pct / 100) * SVG_W; }

  // ── Precompute task positions ──────────────────────────────────────────
  const taskMidY    = new Map<number, number>(); // taskId → center Y px
  const taskBarX    = new Map<number, { left: number; right: number }>(); // SVG X (0-1000)
  const taskNameMap = new Map<number, string>();
  const taskStatusMap = new Map<number, string>();
  let runningY = 0;
  for (const row of rows) {
    const h = ROW_H[row.type] ?? 28;
    if (row.type === "task" && row.id != null) {
      taskMidY.set(row.id, runningY + h / 2);
      const l = barLeft(row.start);
      const w = barWidth(row.start, row.end);
      taskBarX.set(row.id, { left: toSvgX(l), right: toSvgX(l + w) });
      taskNameMap.set(row.id, row.name);
      taskStatusMap.set(row.id, row.status);
    }
    runningY += h;
  }
  const totalRowHeight = Math.max(runningY, 1);

  // ── Dependency-derived sets ────────────────────────────────────────────
  // blockedTaskIds: tasks whose prerequisite is not yet done
  const blockedTaskIds = new Set<number>();
  const chainTaskIds   = new Set<number>(); // tasks in any dep chain
  for (const dep of dependencies) {
    chainTaskIds.add(dep.fromTaskId);
    chainTaskIds.add(dep.toTaskId);
    const prereqStatus = taskStatusMap.get(dep.fromTaskId);
    if (prereqStatus && !DONE_STATUSES.has(prereqStatus)) {
      blockedTaskIds.add(dep.toTaskId);
    }
  }
  // Only draw lines where both tasks are visible in the rows
  const validDeps = (dependencies as any[]).filter(
    d => taskMidY.has(d.fromTaskId) && taskMidY.has(d.toTaskId)
  );

  const LEFT = 220;

  return (
    <div className="flex flex-col h-full overflow-hidden select-none">
      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-popover border border-border shadow-lg rounded-lg px-3 py-2 text-[11px] text-foreground pointer-events-none space-y-0.5 max-w-xs"
          style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}
        >
          {tooltip.lines.map((l, i) => (
            <div key={i} className={i === 0 ? "font-semibold" : "text-muted-foreground"}>{l}</div>
          ))}
        </div>
      )}

      {/* Timeline header */}
      <div className="flex flex-shrink-0 border-b bg-muted/40 text-[10px] font-semibold text-muted-foreground">
        <div style={{ width: LEFT, flexShrink: 0 }} className="px-3 py-2 border-r text-xs font-semibold">Phase / Item</div>
        <div className="relative flex-1 overflow-hidden" style={{ height: 32 }}>
          {months.map((m, i) => (
            <div key={i} className="absolute top-0 bottom-0 border-l border-border/60 px-1 flex items-center whitespace-nowrap"
              style={{ left: `${m.pct}%` }}>
              {m.label}
            </div>
          ))}
          <div className="absolute top-0 bottom-0 w-px bg-red-400 opacity-70" style={{ left: `${todayPct}%` }} />
        </div>
      </div>

      {/* Rows + SVG overlay */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative">

        {/* SVG dependency arrows — sits above rows, pointer-events-none */}
        {validDeps.length > 0 && (
          <div
            className="absolute pointer-events-none z-20"
            style={{ left: LEFT, top: 0, right: 0, height: totalRowHeight }}
          >
            <svg
              viewBox={`0 0 ${SVG_W} ${totalRowHeight}`}
              preserveAspectRatio="none"
              style={{ width: "100%", height: totalRowHeight, display: "block" }}
            >
              <defs>
                <marker id="dep-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#f59e0b" opacity="0.85" />
                </marker>
                <marker id="dep-arrow-blocked" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#f97316" opacity="0.9" />
                </marker>
              </defs>
              {validDeps.map((dep: any, i: number) => {
                const prereqX = taskBarX.get(dep.fromTaskId)!;
                const depXPos = taskBarX.get(dep.toTaskId)!;
                const y1 = taskMidY.get(dep.fromTaskId)!;
                const y2 = taskMidY.get(dep.toTaskId)!;
                const x1 = prereqX.right;
                const x2 = Math.max(depXPos.left - 1, x1 + 6);
                const isBlocking = blockedTaskIds.has(dep.toTaskId);
                // Horizontal S-curve bezier
                const cx = x1 + (x2 - x1) * 0.55;
                return (
                  <path
                    key={i}
                    d={`M ${x1} ${y1} C ${cx} ${y1} ${cx} ${y2} ${x2} ${y2}`}
                    fill="none"
                    stroke={isBlocking ? "#f97316" : "#f59e0b"}
                    strokeWidth={isBlocking ? 2 : 1.5}
                    strokeDasharray={isBlocking ? "5 3" : undefined}
                    opacity="0.8"
                    markerEnd={isBlocking ? "url(#dep-arrow-blocked)" : "url(#dep-arrow)"}
                  />
                );
              })}
            </svg>
          </div>
        )}

        {/* Rows */}
        {rows.map((row: any, i: number) => {
          if (row.type === "phase") {
            return (
              <div key={i} className="flex items-center bg-slate-50 border-b sticky top-0 z-10">
                <div style={{ width: LEFT, flexShrink: 0 }} className="px-3 py-2 border-r font-semibold text-xs text-slate-700 truncate">{row.name}</div>
                <div className="relative flex-1 h-9">
                  <div className="absolute inset-0 opacity-10 bg-slate-400" />
                  <div className="absolute top-0 bottom-0 w-px bg-red-400/60" style={{ left: `${todayPct}%` }} />
                  {row.start && row.end && (
                    <div className="absolute top-2.5 h-4 rounded bg-slate-300 border border-slate-400 opacity-70"
                      style={{ left: `${barLeft(row.start)}%`, width: `${barWidth(row.start, row.end)}%` }}
                      title={`${row.start} → ${row.end}`}
                    />
                  )}
                </div>
              </div>
            );
          }

          if (row.type === "milestone") {
            const dPct = row.dueDate ? Math.min(100, Math.max(0, (differenceInDays(new Date(row.dueDate), tStart) / totalDays) * 100)) : null;
            const isDone = DONE_STATUSES.has(row.status);
            return (
              <div key={i} className="flex items-center border-b hover:bg-violet-50/30">
                <div style={{ width: LEFT, flexShrink: 0 }} className="px-3 py-1.5 border-r text-[11px] text-violet-700 truncate pl-6 flex items-center gap-1">
                  <span className={`inline-block w-2 h-2 rotate-45 flex-shrink-0 ${isDone ? "bg-emerald-500" : "bg-violet-500"}`} />
                  <span className="truncate">{row.name}</span>
                </div>
                <div className="relative flex-1 h-8">
                  <div className="absolute top-0 bottom-0 w-px bg-red-400/40" style={{ left: `${todayPct}%` }} />
                  {dPct !== null && (
                    <div className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rotate-45 border-2 ${isDone ? "bg-emerald-400 border-emerald-600" : "bg-violet-400 border-violet-600"}`}
                      style={{ left: `${dPct}%` }}
                      title={`${row.name} — due ${row.dueDate}`}
                    />
                  )}
                </div>
              </div>
            );
          }

          if (row.type === "task") {
            const isBlocked = blockedTaskIds.has(row.id);
            const isChained = chainTaskIds.has(row.id);
            const hasBar    = row.start && row.end;
            const barColor  = GANTT_STATUS_COLOR[row.status] || "bg-slate-300";

            // Build tooltip lines
            const prereqNames = (dependencies as any[])
              .filter(d => d.toTaskId === row.id)
              .map(d => taskNameMap.get(d.fromTaskId))
              .filter(Boolean) as string[];
            const tooltipLines = [
              row.name,
              row.start && row.end ? `${row.start}  →  ${row.end}` : null,
              prereqNames.length > 0 ? `Blocked by: ${prereqNames.join(", ")}` : null,
            ].filter(Boolean) as string[];

            return (
              <div
                key={i}
                className={`flex items-center border-b ${
                  isBlocked ? "bg-orange-50/50" : isChained ? "hover:bg-amber-50/20" : "hover:bg-muted/10"
                }`}
                onMouseMove={e => setTooltip({ lines: tooltipLines, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setTooltip(null)}
              >
                {/* Sidebar */}
                <div style={{ width: LEFT, flexShrink: 0 }}
                  className={`px-3 py-1 border-r text-[11px] truncate pl-9 flex items-center gap-1 min-w-0 ${isBlocked ? "text-orange-600" : "text-muted-foreground"}`}>
                  {isBlocked && (
                    <span className="text-[9px] bg-orange-100 text-orange-600 border border-orange-200 px-1 py-px rounded font-bold flex-shrink-0">Blocked</span>
                  )}
                  <span className="truncate">{row.name}</span>
                </div>

                {/* Bar */}
                <div className="relative flex-1 h-7">
                  <div className="absolute top-0 bottom-0 w-px bg-red-400/30" style={{ left: `${todayPct}%` }} />
                  {hasBar && (
                    <div
                      className={`absolute top-1.5 h-4 rounded-full transition-all ${
                        isBlocked
                          ? `${barColor} opacity-35 grayscale`
                          : isChained
                          ? `${barColor} opacity-90 ring-1 ring-amber-400/50 ring-offset-0`
                          : `${barColor} opacity-80`
                      }`}
                      style={{ left: `${barLeft(row.start)}%`, width: `${barWidth(row.start, row.end)}%` }}
                    />
                  )}
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>

      {/* Legend */}
      <div className="flex-shrink-0 border-t px-4 py-2 flex gap-4 items-center bg-muted/20 flex-wrap">
        {[
          { cls: "bg-blue-400", label: "In Progress" },
          { cls: "bg-emerald-400", label: "Done" },
          { cls: "bg-purple-400", label: "In Review" },
          { cls: "bg-red-400", label: "Blocked" },
          { cls: "bg-slate-300", label: "To Do" },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <div className={`w-4 h-2.5 rounded-full ${l.cls}`} />
            {l.label}
          </div>
        ))}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <div className="w-3 h-3 rotate-45 bg-violet-400 border border-violet-600" />
          Milestone
        </div>
        {validDeps.length > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <svg width="26" height="10" style={{ overflow: "visible" }}>
              <line x1="0" y1="5" x2="19" y2="5" stroke="#f59e0b" strokeWidth="1.5" />
              <polygon points="19,2 25,5 19,8" fill="#f59e0b" opacity="0.85" />
            </svg>
            Dependency
          </div>
        )}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
          <div className="w-px h-3 bg-red-400" />
          Today
        </div>
      </div>
    </div>
  );
}

// ─── Finance Tab ─────────────────────────────────────────────────────────────
function FinanceTab({ data, invoices, revenue, marginForecast }: { data: any; invoices: any[]; revenue?: any; marginForecast?: any }) {
  const { project, changeRequests, allocations = [] } = data;
  const [rateCards, setRateCards] = useState<any[]>([]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (project.id) params.set("projectId", String(project.id));
    if (project.accountId) params.set("accountId", String(project.accountId));
    fetch(`${API}/rate-cards?${params}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setRateCards(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [project.id, project.accountId]);

  const budgetValue = parseFloat(project.budgetValue||0);
  const billedValue = parseFloat(project.billedValue||0);
  const budgetHours = parseFloat(project.budgetHours||0);
  const consumedHours = parseFloat(project.consumedHours||0);
  const marginEst = budgetValue > 0 ? Math.round(((budgetValue - consumedHours * 150) / budgetValue) * 100) : 0;
  const burnPct = budgetHours > 0 ? Math.min(Math.round((consumedHours/budgetHours)*100),100) : 0;
  const openCRs = (changeRequests||[]).filter((cr:any) => ["pending_review","open","client_review"].includes(cr.status));
  const invoicePaid = invoices.filter(i=>i.status==="paid").reduce((s,i)=>s+parseFloat(i.amount||0),0);
  const invoiceOutstanding = invoices.filter(i=>["sent","overdue"].includes(i.status)).reduce((s,i)=>s+parseFloat(i.amount||0),0);
  const invoiceDraft = invoices.filter(i=>i.status==="draft").reduce((s,i)=>s+parseFloat(i.amount||0),0);

  const hasConversion = marginForecast?.hasConversion ?? false;
  const missingCurrencies: string[] = marginForecast?.missingCurrencies ?? [];
  const baseCurrency = marginForecast?.baseCurrency ?? "CAD";

  return (
    <div className="p-5 space-y-6 overflow-y-auto max-h-full">
      {/* FX warning banner */}
      {missingCurrencies.length > 0 && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-800">
          <span className="mt-0.5">⚠</span>
          <span>FX rate missing for <strong>{missingCurrencies.join(", ")}</strong> — figures may be incomplete. Add the rate in PMO Settings → FX Rates.</span>
        </div>
      )}

      {/* Budget KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Budget Value", val: fmt$(budgetValue), sub: `Billed ${fmt$(billedValue)}`, color: "" },
          { label: "Budget Hours", val: `${budgetHours.toFixed(0)} hrs`, sub: `${consumedHours.toFixed(0)} consumed`, color: "" },
          { label: "Burn Rate", val: `${burnPct}%`, sub: `${(budgetHours-consumedHours).toFixed(0)} hrs remaining`, color: burnPct > 90 ? "text-red-600" : burnPct > 70 ? "text-amber-500" : "" },
          { label: "Margin Est.", val: `${marginEst}%`, sub: "at $150/hr blended", color: marginEst < 20 ? "text-red-600" : marginEst < 30 ? "text-amber-500" : "text-emerald-600" },
        ].map(kpi=>(
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-medium mb-1">{kpi.label}</p>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.val}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* FX Margin Analysis */}
      {marginForecast && (hasConversion || marginForecast.projectedCost > 0) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Margin Analysis</p>
              {hasConversion && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 font-medium">
                  converted to {baseCurrency}
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Projected Cost", val: fmt$(marginForecast.projectedCost), color: "text-foreground" },
                { label: "Forecast Margin", val: fmt$(marginForecast.forecastMargin), color: marginForecast.marginStatus === "good" ? "text-emerald-600" : marginForecast.marginStatus === "warning" ? "text-amber-500" : "text-red-600" },
                { label: "Margin %", val: marginForecast.forecastMarginPct !== null ? `${marginForecast.forecastMarginPct}%` : "—", color: marginForecast.marginStatus === "good" ? "text-emerald-600" : marginForecast.marginStatus === "warning" ? "text-amber-500" : "text-red-600" },
              ].map(item => (
                <div key={item.label} className="text-center p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                  <p className={`text-lg font-bold tabular-nums ${item.color}`}>{item.val}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Earned vs Billed */}
      {revenue && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Earned vs Billed</p>
              {Math.abs(revenue.gap) > revenue.budgetValue * 0.1 && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${revenue.gap > 0 ? "bg-amber-100 text-amber-700 border border-amber-300" : "bg-blue-100 text-blue-700 border border-blue-300"}`}>
                  {revenue.gap > 0 ? "⚠ Billing lag" : "↑ Ahead of earned"}
                </span>
              )}
            </div>
            <div className="space-y-3">
              {[
                { label: "Earned Revenue", val: revenue.earned, color: "bg-violet-500", track: "bg-violet-100" },
                { label: "Billed Revenue",  val: revenue.billed, color: "bg-emerald-500", track: "bg-emerald-100" },
              ].map(row => (
                <div key={row.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">{row.label}</span>
                    <span className="text-sm font-bold tabular-nums">{fmt$(row.val)}</span>
                  </div>
                  <div className={`w-full ${row.track} rounded-full h-3`}>
                    <div
                      className={`h-3 rounded-full ${row.color} transition-all`}
                      style={{ width: `${revenue.budgetValue > 0 ? Math.min((row.val / revenue.budgetValue) * 100, 100) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className={`flex items-center justify-between rounded-lg px-3 py-2 border text-sm ${
              revenue.gap === 0 ? "bg-slate-50 border-slate-200"
              : revenue.gap > 0 ? "bg-amber-50 border-amber-200"
              : "bg-blue-50 border-blue-200"
            }`}>
              <span className="text-xs font-medium text-muted-foreground">Gap (Earned − Billed)</span>
              <span className={`font-bold tabular-nums ${revenue.gap > 0 ? "text-amber-700" : revenue.gap < 0 ? "text-blue-700" : "text-muted-foreground"}`}>
                {revenue.gap >= 0 ? "+" : ""}{fmt$(revenue.gap)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-Resource Margin Table */}
      {allocations.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Users size={14}/> Resource Labor Analysis
          </p>
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Resource</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Role</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Alloc %</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Hrs/Wk</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((alloc: any, i: number) => {
                  const matchedRC = rateCards.find((rc: any) =>
                    rc.role?.toLowerCase() === alloc.role?.toLowerCase() ||
                    rc.resourceId === alloc.resourceId
                  );
                  const billingRate = matchedRC ? parseFloat(matchedRC.billingRate) : null;
                  const hoursPerWk = parseFloat(alloc.hoursPerWeek || 0);
                  return (
                    <tr key={alloc.id} className={`border-t hover:bg-muted/20 ${i%2===0?"":"bg-muted/10"}`}>
                      <td className="px-4 py-2.5 font-medium text-sm">{alloc.resourceName || "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">{alloc.role || "—"}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`text-xs font-medium ${(alloc.allocationPct||0) > 100 ? "text-red-600" : (alloc.allocationPct||0) >= 80 ? "text-amber-600" : "text-muted-foreground"}`}>
                          {alloc.allocationPct || 0}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-muted-foreground hidden md:table-cell">
                        {hoursPerWk > 0 ? `${hoursPerWk}h/wk` : "—"}
                        {billingRate && hoursPerWk > 0 && (
                          <span className="ml-2 text-emerald-600 font-medium">@ {fmt$(billingRate)}/hr</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          alloc.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : alloc.status === "confirmed" ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-muted text-muted-foreground border-muted-foreground/20"
                        }`}>
                          {alloc.status || "pending"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rateCards.length === 0 && (
            <p className="text-[10px] text-muted-foreground mt-1.5 ml-1">
              No rate cards configured for this project — billing rates not shown. Add rate cards in Settings.
            </p>
          )}
        </div>
      )}

      {/* Rate Card Section */}
      {rateCards.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-2 flex items-center gap-2">
            <DollarSign size={14}/> Rate Card
          </p>
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Practice</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Billing Rate</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Cost Rate</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Margin</th>
                </tr>
              </thead>
              <tbody>
                {rateCards.map((rc: any, i: number) => {
                  const billing = parseFloat(rc.billingRate || 0);
                  const cost = rc.costRate ? parseFloat(rc.costRate) : null;
                  const margin = cost && billing > 0 ? Math.round(((billing - cost) / billing) * 100) : null;
                  return (
                    <tr key={rc.id} className={`border-t hover:bg-muted/20 ${i%2===0?"":"bg-muted/10"}`}>
                      <td className="px-4 py-2.5 font-medium text-sm">{rc.name || rc.role}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">{rc.practiceArea || "—"}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-emerald-600">{fmt$(billing)}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-muted-foreground hidden md:table-cell">
                        {cost ? fmt$(cost) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right hidden md:table-cell">
                        {margin !== null ? (
                          <span className={`text-xs font-medium ${margin < 20 ? "text-red-600" : margin < 30 ? "text-amber-500" : "text-emerald-600"}`}>
                            {margin}%
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Paid", val: fmt$(invoicePaid), color: "text-emerald-600", border: "border-emerald-200 bg-emerald-50/30" },
          { label: "Outstanding", val: fmt$(invoiceOutstanding), color: invoiceOutstanding>0?"text-amber-600":"text-muted-foreground", border: invoiceOutstanding>0?"border-amber-200 bg-amber-50/30":"" },
          { label: "Draft", val: fmt$(invoiceDraft), color: "text-muted-foreground", border: "" },
        ].map(s=>(
          <Card key={s.label} className={s.border}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Readiness indicators */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Lifecycle Readiness</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              { key: "kickoffComplete", label: "Kickoff" },
              { key: "billingReadiness", label: "Billing Ready" },
            ].map(f=>{
              const done = !!project[f.key];
              return (
                <div key={f.key} className={`rounded-lg border p-3 text-center ${done?"bg-emerald-50 border-emerald-200":"bg-muted/30 border-muted-foreground/20"}`}>
                  {done?<CheckCircle2 size={14} className="mx-auto mb-1 text-emerald-600"/>:<Circle size={14} className="mx-auto mb-1 text-muted-foreground"/>}
                  <p className={`text-[10px] font-medium ${done?"text-emerald-700":"text-muted-foreground"}`}>{f.label}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Invoice table */}
      <div>
        <p className="text-sm font-semibold mb-2 flex items-center gap-2"><Receipt size={14}/> Invoices ({invoices.length})</p>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center bg-muted/20 rounded-xl border border-dashed">No invoices for this project</p>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Invoice #</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Issued</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Due</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv:any,i:number)=>(
                  <tr key={inv.id} className={`border-t hover:bg-muted/20 ${i%2===0?"":"bg-muted/10"}`}>
                    <td className="px-4 py-3 font-medium text-xs">{inv.invoiceNumber||`INV-${inv.id}`}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmt$(parseFloat(inv.amount||0))}</td>
                    <td className="px-4 py-3"><StatusBadge status={inv.status}/></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{inv.issuedDate?format(new Date(inv.issuedDate),"MMM d, yyyy"):"—"}</td>
                    <td className={`px-4 py-3 text-xs ${inv.status==="overdue"?"text-red-600 font-medium":"text-muted-foreground"}`}>
                      {inv.dueDate?format(new Date(inv.dueDate),"MMM d, yyyy"):"—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Change Requests */}
      {openCRs.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-2 flex items-center gap-2"><FileText size={14}/> Open Change Orders ({openCRs.length})</p>
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Priority</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Impact Hours</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Impact Cost</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {openCRs.map((cr:any,i:number)=>(
                  <tr key={cr.id} className={`border-t hover:bg-muted/20 ${i%2===0?"":"bg-muted/10"}`}>
                    <td className="px-4 py-3 font-medium text-sm">{cr.title}</td>
                    <td className="px-4 py-3"><StatusBadge status={cr.priority||"medium"}/></td>
                    <td className="px-4 py-3 text-right text-muted-foreground text-xs">{cr.impactHours?`${parseFloat(cr.impactHours).toFixed(0)} hrs`:"—"}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground text-xs">{cr.impactCost?fmt$(parseFloat(cr.impactCost)):"—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={cr.status}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Details Tab ────────────────────────────────────────────────────────────
function DetailsTab({ project, onToggle }: { project: any; onToggle: (updates: Record<string,any>)=>void }) {
  const typeLabel: Record<string,string> = {
    implementation:"OTM Implementation", cloud_migration:"Cloud Migration", ams:"AMS Managed Services",
    qa_certification:"QA / Certification", rate_maintenance:"Rate Maintenance", data_migration:"Data Migration",
    custom_dev:"Custom Development", pre_sales:"Pre-Sales Scoping",
  };
  const CURRENCIES = ["CAD","USD","EUR","GBP","AUD","MXN","BRL","JPY","SGD","INR"];
  const fields = [
    ["Account", project.accountName],
    ["Type", typeLabel[project.type]||project.type],
    ["Status", project.status],
    ["PM", project.pmName||"—"],
    ["Current Phase", project.currentPhase||"—"],
    ["Start Date", project.startDate ? format(new Date(project.startDate),"MMM d, yyyy") : "—"],
    ["End Date", project.endDate ? format(new Date(project.endDate),"MMM d, yyyy") : "—"],
    ["Go-Live", project.goLiveDate ? format(new Date(project.goLiveDate),"MMM d, yyyy") : "—"],
    ["Visibility", project.visibility||"internal_only"],
  ];
  const lifecycle = [
    { key:"kickoffComplete",label:"Kickoff Complete" },
    { key:"billingReadiness",label:"Billing Readiness" },
  ];
  return (
    <div className="p-5 space-y-6 max-w-2xl">
      <Card>
        <CardContent className="p-4 divide-y">
          {fields.map(([label, val])=>(
            <div key={label} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
              <p className="text-xs text-muted-foreground font-medium w-36">{label}</p>
              <p className="text-sm font-medium text-right">{val}</p>
            </div>
          ))}
          <div className="flex items-center justify-between py-2.5">
            <p className="text-xs text-muted-foreground font-medium w-36">Currency</p>
            <select
              value={project.currency || "CAD"}
              onChange={e => onToggle({ currency: e.target.value })}
              className="text-sm font-medium bg-background border border-border rounded px-2 py-0.5 text-right"
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {project.description && (
            <div className="py-2.5">
              <p className="text-xs text-muted-foreground font-medium mb-1.5">Description</p>
              <p className="text-sm text-foreground/80 leading-relaxed">{project.description}</p>
            </div>
          )}
        </CardContent>
      </Card>
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Lifecycle Flags</p>
        <div className="grid grid-cols-2 gap-2">
          {lifecycle.map(f=>{
            const done = !!project[f.key];
            return (
              <button key={f.key} onClick={()=>onToggle({[f.key]:!done})}
                className={`rounded-lg border p-3 text-center transition-all hover:shadow-sm ${done?"bg-emerald-50 border-emerald-300":"bg-muted/30 border-muted-foreground/20 hover:bg-muted/50"}`}>
                {done?<CheckCircle2 size={16} className="mx-auto mb-1 text-emerald-600"/>:<Circle size={16} className="mx-auto mb-1 text-muted-foreground"/>}
                <p className={`text-xs font-medium ${done?"text-emerald-700":"text-muted-foreground"}`}>{f.label}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Updates View ──────────────────────────────────────────────────────────
function UpdatesView({ projectId, onRefresh }: { projectId: number; onRefresh: () => void }) {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ status: "on_track", summary: "", highlights: "", risks: "" });

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/projects/${projectId}/status-reports`)
      .then(r => r.json()).then(d => { setReports(d); setLoading(false); }).catch(() => setLoading(false));
  }, [projectId]);

  const submitReport = async () => {
    if (!form.summary.trim()) return;
    setSubmitting(true);
    await fetch(`${API}/projects/${projectId}/status-reports`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        highlights: form.highlights.split("\n").map(s => s.trim()).filter(Boolean),
        risks: form.risks.split("\n").map(s => s.trim()).filter(Boolean),
        date: new Date().toISOString().split("T")[0], author: "Project Manager",
      }),
    });
    setForm({ status: "on_track", summary: "", highlights: "", risks: "" });
    setShowForm(false); setSubmitting(false);
    const d = await fetch(`${API}/projects/${projectId}/status-reports`).then(r => r.json());
    setReports(d); onRefresh();
  };

  const colorMap: Record<string,string> = { on_track:"border-l-emerald-500", at_risk:"border-l-amber-500", behind:"border-l-red-500" };
  const labelMap: Record<string,{cls:string;label:string}> = {
    on_track:{cls:"text-emerald-600 bg-emerald-50",label:"On Track"},
    at_risk:{cls:"text-amber-600 bg-amber-50",label:"At Risk"},
    behind:{cls:"text-red-600 bg-red-50",label:"Behind"},
  };
  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-base">Status Updates</h2>
        <Button size="sm" onClick={()=>setShowForm(v=>!v)} variant="outline" className="gap-1.5">
          <PlusCircle size={13}/> New Update
        </Button>
      </div>
      {showForm && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Post Status Update</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Overall Status</label>
              <select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}
                className="w-full rounded-lg border bg-background text-sm px-3 py-2">
                <option value="on_track">On Track</option>
                <option value="at_risk">At Risk</option>
                <option value="behind">Behind</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Summary <span className="text-destructive">*</span></label>
              <Textarea value={form.summary} onChange={e=>setForm(p=>({...p,summary:e.target.value}))} rows={3} className="text-sm" placeholder="Progress summary…"/>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Highlights <span className="text-muted-foreground/50">(one per line)</span></label>
              <Textarea value={form.highlights} onChange={e=>setForm(p=>({...p,highlights:e.target.value}))} rows={2} className="text-sm" placeholder="Completed discovery…"/>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Risks <span className="text-muted-foreground/50">(one per line)</span></label>
              <Textarea value={form.risks} onChange={e=>setForm(p=>({...p,risks:e.target.value}))} rows={2} className="text-sm" placeholder="Resource constraint…"/>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={()=>setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={submitReport} disabled={submitting||!form.summary.trim()}>{submitting?"Posting…":"Post update"}</Button>
            </div>
          </CardContent>
        </Card>
      )}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-24 bg-muted/50 rounded-lg animate-pulse"/>)}</div>
      ) : reports.length===0 ? (
        <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed">
          <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3"/>
          <p className="font-medium text-muted-foreground">No updates yet</p>
          <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={()=>setShowForm(true)}>
            <PlusCircle size={13}/> Post first update
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r:any)=>(
            <Card key={r.id} className={`border-l-4 ${colorMap[r.status]||"border-l-slate-300"}`}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${labelMap[r.status]?.cls||"text-muted-foreground bg-muted"}`}>
                      {labelMap[r.status]?.label||r.status}
                    </span>
                    <span className="text-xs text-muted-foreground">{r.author} · {new Date(r.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
                  </div>
                </div>
                <p className="text-sm mb-2">{r.summary}</p>
                {r.highlights?.length>0&&<div className="space-y-1">{r.highlights.map((h:string,i:number)=><div key={i} className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 size={10} className="text-emerald-500 shrink-0"/>{h}</div>)}</div>}
                {r.risks?.length>0&&<div className="space-y-1 mt-2">{r.risks.map((risk:string,i:number)=><div key={i} className="flex items-center gap-2 text-xs text-red-500"><AlertTriangle size={10} className="shrink-0"/>{risk}</div>)}</div>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Close View ─────────────────────────────────────────────────────────────
function CloseView({ project, onToggle }: { project: any; onToggle: (updates: Record<string,any>)=>void }) {
  const checks = [
    {key:"kickoffComplete",label:"Kickoff completed"},
    {key:"billingReadiness",label:"All invoices sent"},
  ];
  const done = checks.filter(c=>!!project[c.key]).length;
  const pct = Math.round((done/checks.length)*100);
  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h2 className="font-semibold text-base mb-1">Close &amp; Handover Checklist</h2>
        <p className="text-sm text-muted-foreground">Track all closure activities before marking the project complete</p>
      </div>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Completion</p>
            <span className={`text-sm font-bold ${pct===100?"text-emerald-500":pct>=60?"text-amber-500":"text-muted-foreground"}`}>{pct}%</span>
          </div>
          <Progress value={pct} className="h-2"/>
          <p className="text-xs text-muted-foreground mt-1.5">{done} of {checks.length} items complete</p>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {checks.map(c=>{
          const isComplete = !!project[c.key];
          return (
            <button key={c.key} onClick={()=>onToggle({[c.key]:!isComplete})}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all hover:shadow-sm ${isComplete?"bg-emerald-50 border-emerald-200":"bg-muted/30 border-border hover:bg-muted/50"}`}>
              {isComplete?<CheckCircle2 size={16} className="text-emerald-600 shrink-0"/>:<Circle size={16} className="text-muted-foreground/50 shrink-0"/>}
              <span className={`text-sm font-medium ${isComplete?"text-emerald-700 line-through decoration-emerald-400/50":"text-foreground"}`}>{c.label}</span>
              {isComplete&&<span className="ml-auto text-xs text-emerald-600 font-medium">Done</span>}
            </button>
          );
        })}
      </div>
      {pct===100&&(
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2"/>
          <p className="font-semibold text-emerald-700">Ready to close</p>
          <p className="text-sm text-emerald-600 mt-1">All checklist items complete. This project is ready for final closure.</p>
        </div>
      )}
    </div>
  );
}

// ─── MAIN ───────────────────────────────────────────────────────────────────
export default function ProjectDetail() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { role } = useAuthRole();
  const projectId = Number(params.id);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [marginForecast, setMarginForecast] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [taskDepsRaw, setTaskDepsRaw] = useState<any[]>([]);
  const [taskView, setTaskView] = useState<"wbs"|"kanban"|"list">("wbs");
  const [pctFromHours, setPctFromHours] = useState(false);
  const [baselineSaving, setBaselineSaving] = useState(false);
  const [baselineMsg, setBaselineMsg] = useState<string | null>(null);
  const [baselineData, setBaselineData] = useState<any>(null);
  const [baselineLoading, setBaselineLoading] = useState(false);
  const [baselineLabelInput, setBaselineLabelInput] = useState("");
  const [showBaselineInput, setShowBaselineInput] = useState(false);
  const [etcEditing, setEtcEditing] = useState<Record<number, string>>({});
  const [projection, setProjection] = useState<any>(null);
  const [scheduleRecalculating, setScheduleRecalculating] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [recalcSaving, setRecalcSaving] = useState(false);

  const canApprove = ["admin","delivery_director","project_manager","resource_manager"].includes(role||"");
  const isPM = ["admin","delivery_director","project_manager"].includes(role||"");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [proj, ts, inv] = await Promise.all([
        fetch(`${API}/projects/${projectId}/full`).then(r => { if(!r.ok) throw new Error(); return r.json(); }),
        fetch(`${API}/timesheets?projectId=${projectId}`).then(r => r.json()).catch(()=>[]),
        fetch(`${API}/invoices?projectId=${projectId}`).then(r => r.json()).catch(()=>[]),
      ]);
      setData(proj);
      setTimesheets(Array.isArray(ts) ? ts : []);
      setInvoices(Array.isArray(inv) ? inv : []);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!projectId) return;
    Promise.all([
      fetch(`${API}/projects/${projectId}/margin-forecast`).then(r => r.json()).catch(() => null),
      fetch(`${API}/projects/${projectId}/revenue`).then(r => r.json()).catch(() => null),
      fetch(`${API}/tasks/dependencies?projectId=${projectId}`).then(r => r.json()).catch(() => []),
    ]).then(([mf, rev, deps]) => {
      setMarginForecast(mf);
      setRevenue(rev);
      setTaskDepsRaw(Array.isArray(deps) ? deps : []);
    });
  }, [projectId]);

  useEffect(() => {
    if (!scheduleRecalculating || !projectId) return;
    const interval = setInterval(async () => {
      try {
        await load();
        setScheduleRecalculating(false);
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [scheduleRecalculating, projectId, load]);

  const recalculateSchedule = async () => {
    setRecalcSaving(true);
    setScheduleError(null);
    try {
      const r = await fetch(`${API}/projects/${projectId}/recalculate-schedule`, { method: "POST" });
      const data = await r.json();
      if (!r.ok) {
        setScheduleError(data.error || "Schedule recalculation failed");
      } else {
        await load();
      }
    } catch {
      setScheduleError("Network error during schedule recalculation");
    } finally {
      setRecalcSaving(false);
    }
  };

  const reloadDeps = useCallback(() => {
    fetch(`${API}/tasks/dependencies?projectId=${projectId}`).then(r => r.json()).then(d => setTaskDepsRaw(Array.isArray(d) ? d : [])).catch(() => {});
  }, [projectId]);

  const addTaskDependency = async (taskId: number, dependsOnTaskId: number, dependencyType = "FS", lagDays = 0) => {
    await fetch(`${API}/tasks/${taskId}/dependencies`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dependsOnTaskId, dependencyType, lagDays }) });
    reloadDeps();
  };

  const removeTaskDependency = async (taskId: number, depId: number) => {
    await fetch(`${API}/tasks/${taskId}/dependencies/${depId}`, { method: "DELETE" });
    reloadDeps();
  };

  const handleTaskStatusChange = async (taskId: number, status: string) => {
    if (status === "done") {
      const blockers = taskDepsRaw.filter(d => d.taskId === taskId && d.dependsOnStatus !== "done" && d.dependsOnStatus !== "cancelled");
      if (blockers.length > 0) {
        const names = blockers.map((b: any) => b.dependsOnName).join(", ");
        if (!window.confirm(`This task depends on:\n• ${names}\n\nThose tasks aren't done yet. Mark complete anyway?`)) return;
      }
    }
    await updateTaskStatus(taskId, status);
    reloadDeps();
  };

  const updateTaskStatus = async (taskId:number, status:string) => {
    await fetch(`${API}/tasks/${taskId}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({status}) });
    load();
  };
  const updateMilestoneStatus = async (msId:number, status:string) => {
    await fetch(`${API}/milestones/${msId}/status`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({status}) });
    load();
  };
  const updateProjectField = async (updates:Record<string,any>) => {
    await fetch(`${API}/projects/${projectId}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(updates) });
    load();
  };

  const loadBaselineData = async () => {
    setBaselineLoading(true);
    try {
      const r = await fetch(`${API}/projects/${projectId}/baselines`);
      const d = await r.json();
      setBaselineData(Array.isArray(d) && d.length === 0 ? null : d);
    } catch { setBaselineData(null); }
    finally { setBaselineLoading(false); }
  };

  const handleSetBaseline = async () => {
    const lbl = (baselineLabelInput.trim() || `Baseline ${new Date().toLocaleDateString("en-CA")}`);
    setBaselineSaving(true);
    setShowBaselineInput(false);
    try {
      const r = await fetch(`${API}/projects/${projectId}/baseline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: lbl }),
      });
      const d = await r.json();
      setBaselineMsg(`"${d.label}" saved — ${d.tasksSnapshotted ?? 0} task(s) snapshotted.`);
      setTimeout(() => setBaselineMsg(null), 5000);
      setBaselineLabelInput("");
      if (activeTab === "baseline") await loadBaselineData();
    } finally { setBaselineSaving(false); }
  };

  const handleSaveEtc = async (taskId: number, value: string) => {
    const etcVal = value === "" ? null : parseFloat(value);
    await fetch(`${API}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ etcHours: etcVal }),
    });
    setEtcEditing(prev => { const n = { ...prev }; delete n[taskId]; return n; });
    if (activeTab === "baseline") await loadBaselineData();
  };

  useEffect(() => {
    if (activeTab === "baseline" && projectId) loadBaselineData();
  }, [activeTab, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!projectId) return;
    fetch(`${API}/projects/${projectId}/projection`).then(r => r.json()).then(setProjection).catch(() => {});
  }, [projectId, data]);
  const approveTimesheet = async (id:number) => {
    await fetch(`${API}/timesheets/${id}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({status:"approved"}) });
    const ts = await fetch(`${API}/timesheets?projectId=${projectId}`).then(r=>r.json()).catch(()=>[]);
    setTimesheets(Array.isArray(ts)?ts:[]);
  };
  const rejectTimesheet = async (id:number) => {
    await fetch(`${API}/timesheets/${id}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({status:"rejected"}) });
    const ts = await fetch(`${API}/timesheets?projectId=${projectId}`).then(r=>r.json()).catch(()=>[]);
    setTimesheets(Array.isArray(ts)?ts:[]);
  };

  if (loading) return (
    <div className="p-6 space-y-4">
      <div className="h-20 bg-muted rounded-xl animate-pulse"/>
      <div className="h-10 bg-muted rounded-xl animate-pulse"/>
      <div className="h-96 bg-muted rounded-xl animate-pulse"/>
    </div>
  );
  if (!data) return <div className="p-8 text-center text-muted-foreground">Project not found.</div>;

  const { project, phases, milestones, tasks, allocations, health, nextMilestone, budgetBurn, changeRequests } = data;
  const openCRCount = (changeRequests||[]).filter((cr:any)=>["pending_review","client_review","open"].includes(cr.status)).length;
  const typeLabel: Record<string,string> = {
    implementation:"OTM Implementation", cloud_migration:"Cloud Migration", ams:"AMS Managed Services",
    qa_certification:"QA / Certification", rate_maintenance:"Rate Maintenance", data_migration:"Data Migration",
    custom_dev:"Custom Development", pre_sales:"Pre-Sales Scoping",
  };

  const TABS: { key: TabKey; label: string; badge?: number }[] = [
    { key: "overview",   label: "Overview" },
    { key: "team",       label: "Team",       badge: allocations.length },
    { key: "milestones", label: "Milestones", badge: milestones.length },
    { key: "tasks",      label: "Tasks",      badge: tasks.filter((t:Task)=>t.status==="blocked").length || undefined },
    { key: "worklogs",   label: "Time Logs",  badge: timesheets.filter(t=>t.status==="submitted").length || undefined },
    { key: "finance",    label: "Finance" },
    { key: "gantt",      label: "Gantt" },
    { key: "baseline",   label: "Baseline" },
    { key: "updates",    label: "Updates" },
    { key: "close",      label: "Close" },
    { key: "details",    label: "Details" },
  ];

  return (
    <div className="flex flex-col" style={{height:"calc(100vh - 56px)"}}>
      {/* ── Header ── */}
      <div className="border-b bg-card px-5 py-3 flex-shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <button onClick={()=>navigate("/projects")} className="hover:text-foreground transition-colors">Projects</button>
              <ChevronRight size={11}/>
              {project.accountId ? (
                <button onClick={()=>navigate(`/accounts/${project.accountId}`)} className="hover:text-foreground transition-colors">
                  {project.accountName}
                </button>
              ) : <span>{project.accountName}</span>}
              <ChevronRight size={11}/>
              <span className="text-foreground font-medium truncate max-w-[200px]">{project.name}</span>
            </div>
            <h1 className="text-lg font-bold tracking-tight truncate">{project.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-xs border rounded px-2 py-0.5 bg-muted/40">{typeLabel[project.type]||project.type}</span>
              {project.pmName && <span className="text-xs text-muted-foreground flex items-center gap-1"><User size={10}/>{project.pmName}</span>}
              {project.currentPhase && <span className="text-xs text-muted-foreground flex items-center gap-1"><Flag size={10}/>Phase: {project.currentPhase}</span>}
              <StatusBadge status={project.status}/>
              {openCRCount > 0 && (
                <button onClick={()=>navigate("/changes")}
                  className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200 transition-colors">
                  {openCRCount} change order{openCRCount!==1?"s":""} open
                </button>
              )}
            </div>
          </div>
          <div className="flex items-stretch gap-2 flex-shrink-0">
            {[
              {val:health.score, label:"Health", dot:true, clickable:true},
              {val:`${project.completionPct||0}%`, label:"Complete", dot:false, clickable:false},
              {val:`${budgetBurn?.burnRate||0}%`, label:"Burn", dot:false, clickable:false},
            ].map((kpi,i)=>(
              <div
                key={i}
                className="text-center px-3 py-2 bg-muted/50 rounded-lg min-w-[64px]"
                title={kpi.clickable ? "Health score based on schedule, budget, and milestone adherence" : undefined}
              >
                <div className="flex items-center justify-center gap-1">
                  {kpi.dot&&<HealthDot score={health.score}/>}
                  <span className="text-lg font-bold">{kpi.val}</span>
                </div>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            ))}
            {nextMilestone && (
              <div className="text-center px-3 py-2 bg-muted/50 rounded-lg max-w-[120px]">
                <p className="text-xs font-bold truncate">{nextMilestone.name}</p>
                <p className="text-xs text-muted-foreground">{nextMilestone.dueDate?format(new Date(nextMilestone.dueDate),"MMM d"):""}</p>
                <p className="text-xs text-muted-foreground">Next milestone</p>
              </div>
            )}
            {project.goLiveDate && (
              <div className="text-center px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-sm font-bold text-emerald-700">{format(new Date(project.goLiveDate),"MMM d")}</p>
                <p className="text-xs text-emerald-600">{new Date(project.goLiveDate).getFullYear()}</p>
                <p className="text-xs text-emerald-600">Go Live</p>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <button onClick={()=>navigate(`/projects/${projectId}/command`)}
                className="flex items-center gap-1 text-xs border rounded px-2 py-1 hover:bg-muted transition-colors font-medium text-primary border-primary/30 bg-primary/5">
                <BarChart3 size={11}/>Command
              </button>
              {showBaselineInput ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={baselineLabelInput}
                    onChange={e => setBaselineLabelInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSetBaseline(); if (e.key === "Escape") setShowBaselineInput(false); }}
                    placeholder={`Baseline ${new Date().toLocaleDateString("en-CA")}`}
                    className="text-xs border rounded px-2 py-1 w-36 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button onClick={handleSetBaseline} disabled={baselineSaving} className="text-xs border rounded px-2 py-1 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    {baselineSaving ? "…" : "Save"}
                  </button>
                  <button onClick={() => setShowBaselineInput(false)} className="text-xs border rounded px-2 py-1 hover:bg-muted">✕</button>
                </div>
              ) : (
                <button onClick={() => setShowBaselineInput(true)} disabled={baselineSaving}
                  className="flex items-center gap-1 text-xs border rounded px-2 py-1 hover:bg-muted transition-colors disabled:opacity-50"
                  title="Snapshot current planned hours as a named baseline">
                  <Flag size={11}/>{baselineSaving ? "Saving…" : "📌 Baseline"}
                </button>
              )}
              <button onClick={load} className="flex items-center gap-1 text-xs border rounded px-2 py-1 hover:bg-muted transition-colors">
                <RefreshCw size={11}/>Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Health / Risk Warning Banner ── */}
      {(health.score < 60 || project.status === "at_risk" || project.status === "behind") && (
        <div className={`border-b px-5 py-2 flex items-center gap-2 text-xs font-medium flex-shrink-0 ${
          health.score < 40 || project.status === "behind"
            ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-800/50 dark:text-red-400"
            : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-800/50 dark:text-amber-400"
        }`}>
          <AlertTriangle size={12} className="flex-shrink-0" />
          <span>
            {health.score < 40 || project.status === "behind"
              ? `Project is behind — health score ${health.score}/100. Immediate attention required.`
              : `Project at risk — health score ${health.score}/100. Review the Overview tab for details.`}
            {health.reasons?.length > 0 && (
              <span className="ml-1 opacity-70">· {health.reasons[0]?.label}</span>
            )}
          </span>
          <button onClick={() => setActiveTab("overview")} className="ml-auto underline underline-offset-2 opacity-80 hover:opacity-100 whitespace-nowrap">
            See overview →
          </button>
        </div>
      )}

      {/* ── Budget Burn Alert Banner ── */}
      {budgetBurn && budgetBurn.budgetHours > 0 && budgetBurn.burnRate >= 75 && (
        <div className={`border-b px-5 py-2 flex items-center gap-2 text-xs font-medium flex-shrink-0 ${
          budgetBurn.burnRate >= 90
            ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-800/50 dark:text-red-400"
            : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-800/50 dark:text-amber-400"
        }`}>
          <TrendingUp size={12} className="flex-shrink-0" />
          <span>
            Budget consumption is at {budgetBurn.burnRate}%.{" "}
            {budgetBurn.burnRate >= 90 ? "Critical — immediate review required." : "Review resource allocation."}
          </span>
          <button onClick={() => setActiveTab("finance" as any)} className="ml-auto underline underline-offset-2 opacity-80 hover:opacity-100 whitespace-nowrap">
            See Finance →
          </button>
        </div>
      )}

      {/* ── Tab Nav ── */}
      <div className="border-b bg-card px-5 flex-shrink-0 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              }`}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none ${
                  tab.key === "tasks" ? "bg-red-100 text-red-700" :
                  tab.key === "worklogs" ? "bg-amber-100 text-amber-700" :
                  "bg-muted text-muted-foreground"
                }`}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Baseline Saved Notification ── */}
      {baselineMsg && (
        <div className="border-b px-5 py-2 flex items-center gap-2 text-xs font-medium flex-shrink-0 bg-emerald-50 border-emerald-200 text-emerald-700">
          <Flag size={12} className="flex-shrink-0" />
          <span>{baselineMsg}</span>
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "overview" && (
          <OverviewTab data={data} timesheets={timesheets} invoices={invoices} marginForecast={marginForecast} projection={projection} />
        )}

        {activeTab === "team" && (
          <TeamTab allocations={allocations} tasks={tasks} />
        )}

        {activeTab === "milestones" && (
          <PhaseBoardView
            phases={phases} milestones={milestones} tasks={tasks}
            onMilestoneStatus={updateMilestoneStatus}
            project={project}
          />
        )}

        {activeTab === "tasks" && (
          <div>
            <div className="flex items-center gap-2 px-4 pt-3 border-b pb-2.5 bg-card">
              <div className="flex gap-1">
                {(["wbs","kanban","list"] as const).map(v=>(
                  <button key={v} onClick={()=>setTaskView(v)}
                    className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${taskView===v?"bg-primary text-primary-foreground":"bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                    {v === "wbs" ? "WBS" : v.charAt(0).toUpperCase()+v.slice(1)}
                  </button>
                ))}
              </div>
              {taskView === "wbs" && (
                <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                  <span>% from hours</span>
                  <button
                    role="switch"
                    aria-checked={pctFromHours}
                    onClick={() => setPctFromHours(v => !v)}
                    className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${pctFromHours ? "bg-primary" : "bg-muted-foreground/30"}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${pctFromHours ? "translate-x-3.5" : "translate-x-0.5"}`}/>
                  </button>
                </label>
              )}
              {isPM && (
                <button
                  onClick={recalculateSchedule}
                  disabled={recalcSaving}
                  className={`${taskView === "wbs" ? "" : "ml-auto"} flex items-center gap-1.5 px-3 py-1 text-xs rounded-full font-medium border transition-colors ${recalcSaving ? "opacity-50 cursor-not-allowed border-muted text-muted-foreground" : "border-primary/30 text-primary hover:bg-primary/10"}`}
                >
                  {recalcSaving ? "Recalculating…" : scheduleRecalculating ? "Refreshing…" : "Recalculate Schedule"}
                </button>
              )}
            </div>
            {scheduleError && (
              <div className="mx-4 mt-2 px-3 py-2 text-xs rounded-md bg-destructive/10 text-destructive border border-destructive/20 flex items-center justify-between">
                <span>{scheduleError}</span>
                <button onClick={() => setScheduleError(null)} className="ml-2 text-destructive/70 hover:text-destructive font-medium">✕</button>
              </div>
            )}
            {(() => {
              const depMap: Record<number, any[]> = {};
              taskDepsRaw.forEach(d => { if (!depMap[d.taskId]) depMap[d.taskId] = []; depMap[d.taskId].push(d); });
              if (taskView === "wbs") return <WbsView tasks={tasks} allocations={allocations} projectId={projectId} onRefresh={load} pctFromHours={pctFromHours} />;
              if (taskView === "kanban") return <KanbanView tasks={tasks} onStatusChange={handleTaskStatusChange} depMap={depMap} onAddDep={addTaskDependency} onRemoveDep={removeTaskDependency}/>;
              return <ListView tasks={tasks} milestones={milestones} onStatusChange={handleTaskStatusChange} depMap={depMap}/>;
            })()}
          </div>
        )}

        {activeTab === "worklogs" && (
          <WorkLogsTab
            timesheets={timesheets}
            onApprove={approveTimesheet}
            onReject={rejectTimesheet}
            canApprove={canApprove}
          />
        )}

        {activeTab === "finance" && (
          <FinanceTab data={data} invoices={invoices} revenue={revenue} marginForecast={marginForecast} />
        )}

        {activeTab === "gantt" && (
          <GanttTab projectId={projectId} />
        )}

        {activeTab === "baseline" && (
          <div className="flex-1 overflow-auto p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Baseline Variance</h3>
                {baselineData?.latest && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Comparing against <strong>{baselineData.latest.label}</strong>
                    {" "}({new Date(baselineData.latest.baselinedAt).toLocaleDateString("en-CA")})
                    {baselineData.baselines?.length > 1 && ` · ${baselineData.baselines.length} snapshots`}
                  </p>
                )}
              </div>
              <button onClick={loadBaselineData} disabled={baselineLoading}
                className="flex items-center gap-1 text-xs border rounded px-2 py-1 hover:bg-muted disabled:opacity-50">
                <RefreshCw size={11}/>{baselineLoading ? "Loading…" : "Refresh"}
              </button>
            </div>

            {baselineMsg && (
              <div className="px-3 py-2 text-xs rounded-md bg-primary/10 text-primary border border-primary/20">{baselineMsg}</div>
            )}

            {baselineLoading ? (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading baseline data…</div>
            ) : !baselineData ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-sm text-muted-foreground">
                <Flag size={28} className="opacity-30"/>
                <p>No baseline snapshot yet.</p>
                <p className="text-xs">Use the <strong>📌 Baseline</strong> button in the header to snapshot current planned hours.</p>
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/60 border-b">
                      <th className="text-left px-3 py-2 font-medium">Task</th>
                      <th className="text-right px-3 py-2 font-medium">Baseline h</th>
                      <th className="text-right px-3 py-2 font-medium">Actual h</th>
                      <th className="text-right px-3 py-2 font-medium">ETC h</th>
                      <th className="text-right px-3 py-2 font-medium">Forecast h</th>
                      <th className="text-right px-3 py-2 font-medium">Variance</th>
                      <th className="text-center px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(baselineData.tasks ?? []).map((row: any) => {
                      const variance = row.variance ?? 0;
                      const forecast = (row.actualHours ?? 0) + (row.etcHours ?? 0);
                      const isEditing = etcEditing[row.taskId] !== undefined;
                      return (
                        <tr key={row.taskId} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2 font-medium max-w-[220px] truncate" title={row.taskName}>{row.taskName}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.baselineHours?.toFixed(1)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.actualHours?.toFixed(1)}</td>
                          <td className="px-3 py-2 text-right">
                            {isEditing ? (
                              <span className="flex items-center justify-end gap-1">
                                <input
                                  autoFocus
                                  type="number" min="0" step="0.5"
                                  value={etcEditing[row.taskId]}
                                  onChange={e => setEtcEditing(prev => ({ ...prev, [row.taskId]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === "Enter") handleSaveEtc(row.taskId, etcEditing[row.taskId]); if (e.key === "Escape") setEtcEditing(prev => { const n = { ...prev }; delete n[row.taskId]; return n; }); }}
                                  className="w-16 border rounded px-1 py-0.5 text-right bg-background focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
                                />
                                <button onClick={() => handleSaveEtc(row.taskId, etcEditing[row.taskId])} className="text-primary hover:underline">✓</button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setEtcEditing(prev => ({ ...prev, [row.taskId]: String(row.etcHours ?? "") }))}
                                className="tabular-nums hover:text-primary hover:underline cursor-pointer w-full text-right"
                                title="Click to edit ETC">
                                {(row.etcHours ?? 0).toFixed(1)}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{forecast.toFixed(1)}</td>
                          <td className={`px-3 py-2 text-right tabular-nums font-semibold ${variance > 0 ? "text-destructive" : variance < 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                            {variance === 0 ? "±0.0" : variance > 0 ? `+${variance.toFixed(1)}` : variance.toFixed(1)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              row.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                              : row.status === "in_progress" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                              : row.status === "blocked" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                              : "bg-muted text-muted-foreground"
                            }`}>
                              {row.status?.replace(/_/g, " ")}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {(baselineData.tasks ?? []).length > 0 && (() => {
                    const tasks: any[] = baselineData.tasks;
                    const totalBase    = tasks.reduce((s: number, r: any) => s + (r.baselineHours ?? 0), 0);
                    const totalActual  = tasks.reduce((s: number, r: any) => s + (r.actualHours ?? 0), 0);
                    const totalEtc     = tasks.reduce((s: number, r: any) => s + (r.etcHours ?? 0), 0);
                    const totalFcast   = totalActual + totalEtc;
                    const totalVar     = totalFcast - totalBase;
                    return (
                      <tfoot>
                        <tr className="bg-muted/60 border-t font-semibold">
                          <td className="px-3 py-2">Total</td>
                          <td className="px-3 py-2 text-right tabular-nums">{totalBase.toFixed(1)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{totalActual.toFixed(1)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{totalEtc.toFixed(1)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{totalFcast.toFixed(1)}</td>
                          <td className={`px-3 py-2 text-right tabular-nums ${totalVar > 0 ? "text-destructive" : totalVar < 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                            {totalVar === 0 ? "±0.0" : totalVar > 0 ? `+${totalVar.toFixed(1)}` : totalVar.toFixed(1)}
                          </td>
                          <td/>
                        </tr>
                      </tfoot>
                    );
                  })()}
                </table>
              </div>
            )}

            {baselineData?.baselines?.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground py-1 select-none">
                  All snapshots ({baselineData.baselines.length})
                </summary>
                <div className="mt-2 border rounded-md overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/60 border-b">
                        <th className="text-left px-3 py-2 font-medium">Label</th>
                        <th className="text-left px-3 py-2 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {baselineData.baselines.map((b: any, i: number) => (
                        <tr key={b.id} className={`border-b last:border-0 ${i === 0 ? "font-medium" : ""}`}>
                          <td className="px-3 py-1.5">{b.label}{i === 0 ? " (latest)" : ""}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{new Date(b.baselinedAt).toLocaleString("en-CA")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>
        )}

        {activeTab === "updates" && (
          <UpdatesView projectId={projectId} onRefresh={load} />
        )}

        {activeTab === "close" && (
          <CloseView project={project} onToggle={updateProjectField} />
        )}

        {activeTab === "details" && (
          <DetailsTab project={project} onToggle={updateProjectField} />
        )}
      </div>

    </div>
  );
}
