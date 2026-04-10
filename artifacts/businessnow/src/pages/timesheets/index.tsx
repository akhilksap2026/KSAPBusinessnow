import { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
import { CheckCircle2, XCircle, Clock, RotateCcw, Plus, Eye, Info, Rocket, AlarmClock, ChevronLeft, ChevronRight, LayoutGrid, List } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "wouter";
import { format, startOfWeek, parseISO, addWeeks, addDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuthRole, ROLE_DEMO_RESOURCE, type Role } from "@/lib/auth";

const API_BASE = import.meta.env.BASE_URL + "api";

const STATUS_BADGE: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  draft:     { variant: "outline",     label: "Draft" },
  submitted: { variant: "secondary",   label: "Submitted" },
  approved:  { variant: "default",     label: "Approved" },
  rejected:  { variant: "destructive", label: "Rejected" },
};


const CAN_LOG:     Role[] = ["admin","delivery_director","project_manager","consultant"];
const CAN_APPROVE: Role[] = ["admin","delivery_director","project_manager"];
const CAN_VIEW_ALL:Role[] = ["admin","delivery_director","project_manager","resource_manager","finance_lead"];

async function timesheetAction(id: number, action: string, extra?: Record<string, string>) {
  const res = await fetch(`/api/timesheets/${id}`, {
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

type Tab = "mine" | "review";

// ── HoursStepperCell ─────────────────────────────────────────────────────────
// Rounds any typed value to the nearest 0.25h increment using:
//   Math.round(raw / 0.25) * 0.25
// This maps e.g. 1.3 → 1.25, 2.8 → 2.75, 0.1 → 0.0, 0.13 → 0.25.
// Min: 0h, Max: 24h (mirrors the server-side daily cap).
const STEP = 0.25;
const MIN_H = 0;
const MAX_H = 24;

function roundToStep(v: number): number {
  return Math.min(MAX_H, Math.max(MIN_H, Math.round(v / STEP) * STEP));
}

function HoursStepperCell({
  value,
  onCommit,
  disabled,
  status,
}: {
  value: string;
  onCommit: (hours: string) => void;
  disabled: boolean;
  status?: string;
}) {
  // Derive the canonical numeric value from the prop (empty/missing → 0)
  const propNum = parseFloat(value) || 0;
  // Local display string: empty string when 0 so the placeholder shows
  const [display, setDisplay] = useState<string>(propNum > 0 ? String(propNum) : "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync when the external value prop changes (e.g. after a save/load cycle)
  useEffect(() => {
    const n = parseFloat(value) || 0;
    setDisplay(n > 0 ? String(n) : "");
  }, [value]);

  const commit = useCallback((raw: string) => {
    const parsed = parseFloat(raw);
    const rounded = isNaN(parsed) ? 0 : roundToStep(parsed);
    const next = rounded > 0 ? String(rounded) : "";
    setDisplay(next);
    const numericStr = String(rounded);
    const prevNum = parseFloat(value) || 0;
    if (rounded !== prevNum) onCommit(numericStr);
  }, [value, onCommit]);

  const adjust = useCallback((delta: number) => {
    const current = parseFloat(display) || 0;
    const next = roundToStep(current + delta);
    const nextStr = next > 0 ? String(next) : "";
    setDisplay(nextStr);
    const prevNum = parseFloat(value) || 0;
    if (next !== prevNum) onCommit(String(next));
  }, [display, value, onCommit]);

  const borderCls =
    status === "submitted" ? "border-amber-400/50 text-amber-400" :
    status === "approved"  ? "border-emerald-400/50 text-emerald-400" :
    "border-border";

  const btnCls =
    "flex items-center justify-center w-[18px] h-[18px] rounded text-[10px] font-bold leading-none " +
    "text-muted-foreground hover:text-foreground hover:bg-muted transition-colors " +
    "disabled:opacity-30 disabled:cursor-not-allowed select-none shrink-0";

  return (
    <div className="flex items-center gap-[2px] w-full">
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label="Decrease by 0.25h"
        onClick={() => adjust(-STEP)}
        className={btnCls}
      >−</button>

      <input
        ref={inputRef}
        type="number"
        min={MIN_H}
        max={MAX_H}
        step={STEP}
        value={display}
        disabled={disabled}
        placeholder="—"
        onChange={e => setDisplay(e.target.value)}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => {
          if (e.key === "ArrowUp")   { e.preventDefault(); adjust(+STEP); }
          if (e.key === "ArrowDown") { e.preventDefault(); adjust(-STEP); }
        }}
        className={
          "min-w-0 flex-1 h-[26px] rounded border px-0.5 text-center text-xs bg-background " +
          "focus:outline-none focus:ring-1 focus:ring-primary/50 " +
          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none " +
          borderCls
        }
      />

      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label="Increase by 0.25h"
        onClick={() => adjust(+STEP)}
        className={btnCls}
      >+</button>
    </div>
  );
}

// ── Weekly Grid Component ────────────────────────────────────────────────────
// Roles that can submit timesheets for future weeks (mirrors server-side FUTURE_WEEK_BYPASS_ROLES).
const SUBMIT_BYPASS_ROLES: Role[] = ["admin", "delivery_director"];

// Returns the Monday of the current week as a "YYYY-MM-DD" string, using UTC
// to match the server-side currentUTCMonday() and avoid DST edge cases.
function clientUTCMonday(): string {
  const now = new Date();
  const dow = now.getUTCDay(); // 0=Sun … 6=Sat
  const back = dow === 0 ? 6 : dow - 1;
  const m = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - back));
  return m.toISOString().slice(0, 10);
}

function WeeklyGrid({ resourceId, resourceName, projects, categories, onRefetch, role }: {
  resourceId: number;
  resourceName: string;
  projects: any[];
  categories: { id: number; name: string; defaultBillable: boolean }[];
  onRefetch: () => void;
  role: Role | null;
}) {
  const { toast } = useToast();
  const [weekOffset, setWeekOffset] = useState(0);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [addRow, setAddRow] = useState<{ projectId: string; projectName: string; taskId: string; taskName: string; categoryId: string; isBillable: boolean } | null>(null);
  const [addTasks, setAddTasks] = useState<any[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  // ETC state: taskId → { etcHours, estimatedHours, loggedHours }
  const [taskMeta, setTaskMeta] = useState<Record<number, { etcHours: string | null; estimatedHours: string | null; loggedHours: number }>>({});
  const [taskNames, setTaskNames] = useState<Record<number, string>>({});

  const weekStart = format(addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset), "yyyy-MM-dd");
  const days = Array.from({ length: 7 }, (_, i) => addDays(parseISO(weekStart), i));

  // Future-week guard: disable Submit when the grid is showing a week that hasn't started.
  // Uses UTC Monday comparison to stay in sync with the server-side check.
  const isFutureWeek = weekStart > clientUTCMonday();
  const canBypassFutureWeek = role !== null && (SUBMIT_BYPASS_ROLES as string[]).includes(role);
  const submitBlocked = isFutureWeek && !canBypassFutureWeek;
  const dayKeys = days.map(d => format(d, "yyyy-MM-dd"));

  // Load task meta (etcHours, estimatedHours, loggedHours) for all task rows
  const loadTaskMeta = (rows: any[]) => {
    const taskIds = [...new Set(rows.map((e: any) => e.taskId).filter(Boolean))];
    taskIds.forEach((taskId: number) => {
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
  };

  const load = () => {
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
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [weekStart, resourceId]);

  const saveEtcHours = async (taskId: number, value: string) => {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0) return;
    await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ etcHours: parsed }),
    });
    setTaskMeta(prev => ({ ...prev, [taskId]: { ...(prev[taskId] || { estimatedHours: null, loggedHours: 0 }), etcHours: value } }));
  };

  const groupedRows = useMemo(() => {
    const map = new Map<string, { key: string; projectId: number; projectName: string; taskId?: number; taskName?: string; categoryId?: number; isBillable: boolean; byDay: Record<string, { id?: number; hours: string; status: string }> }>();
    entries.forEach(e => {
      const key = `${e.projectId}-${e.taskId ?? ""}`;
      if (!map.has(key)) {
        map.set(key, { key, projectId: e.projectId, projectName: e.projectName, taskId: e.taskId, taskName: undefined, categoryId: e.categoryId, isBillable: e.isBillable ?? true, byDay: {} });
      }
      const row = map.get(key)!;
      const d = e.entryDate;
      if (d) row.byDay[d] = { id: e.id, hours: String(e.hoursLogged ?? ""), status: e.status };
    });
    return Array.from(map.values());
  }, [entries]);

  const totalByDay = useMemo(() => {
    const totals: Record<string, number> = {};
    dayKeys.forEach(d => { totals[d] = 0; });
    entries.forEach(e => {
      if (e.entryDate && totals[e.entryDate] !== undefined) totals[e.entryDate] += parseFloat(String(e.hoursLogged ?? 0));
    });
    return totals;
  }, [entries, dayKeys]);

  const saveCell = async (row: typeof groupedRows[0], date: string, hours: string) => {
    const key = `${row.key}:${date}`;
    setSaving(key);
    try {
      const existing = row.byDay[date];
      if (existing?.id) {
        await fetch(`${API_BASE}/timesheets/${existing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hoursLogged: parseFloat(hours) }) });
      } else if (parseFloat(hours) > 0) {
        await fetch(`${API_BASE}/timesheets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          projectId: row.projectId, projectName: row.projectName, resourceId, resourceName,
          weekStart, entryDate: date, hoursLogged: parseFloat(hours), isBillable: row.isBillable,
          taskId: row.taskId ?? null, categoryId: row.categoryId ?? null,
          activityType: "consulting", status: "draft",
        })});
      }
      load();
    } finally { setSaving(null); }
  };

  const submitRow = async (row: typeof groupedRows[0]) => {
    const toSubmit = Object.values(row.byDay).filter(c => c.id && c.status === "draft");
    let blocked = false;
    for (const cell of toSubmit) {
      const res = await fetch(`${API_BASE}/timesheets/${cell.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Pass the current role so the server can apply the bypass check for admin/director.
        body: JSON.stringify({ action: "submit", role: role ?? undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.error === "FUTURE_WEEK_SUBMISSION") {
          toast({ title: "Cannot submit — future week", description: err.message, variant: "destructive" });
          blocked = true;
          break;
        }
      }
    }
    if (!blocked) toast({ title: "Row submitted for approval" });
    load(); onRefetch();
  };

  const addNewRow = async () => {
    if (!addRow?.projectId) return;
    setSaving("new");
    try {
      const firstDay = dayKeys[0];
      await fetch(`${API_BASE}/timesheets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        projectId: parseInt(addRow.projectId), projectName: addRow.projectName, resourceId, resourceName,
        weekStart, entryDate: firstDay, hoursLogged: 0, isBillable: addRow.isBillable,
        taskId: addRow.taskId ? parseInt(addRow.taskId) : null,
        categoryId: addRow.categoryId ? parseInt(addRow.categoryId) : null,
        activityType: "consulting", status: "draft",
      })});
      setAddRow(null); load();
    } finally { setSaving(null); }
  };

  useEffect(() => {
    if (!addRow?.projectId) { setAddTasks([]); return; }
    fetch(`${API_BASE}/tasks?projectId=${addRow.projectId}`)
      .then(r => r.json()).then(d => setAddTasks(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [addRow?.projectId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 py-2 px-4 border-b border-border">
        <button onClick={() => setWeekOffset(w => w - 1)} className="p-1 rounded hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
        <span className="text-sm font-semibold">{format(parseISO(weekStart), "MMM d")} – {format(addDays(parseISO(weekStart), 6), "MMM d, yyyy")}</span>
        <button onClick={() => setWeekOffset(w => w + 1)} className="p-1 rounded hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
        <button onClick={() => setWeekOffset(0)} className="text-xs text-muted-foreground hover:text-foreground">This week</button>
        <span className="ml-auto text-xs text-muted-foreground">{loading ? "Loading…" : `${entries.length} entries`}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[950px]">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left px-3 py-2 w-40">Project / Task</th>
              <th className="text-left px-2 py-2 w-20">Category</th>
              {days.map(d => (
                <th key={format(d, "yyyy-MM-dd")} className={`px-2 py-2 w-16 text-center ${format(d, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") ? "text-violet-400 font-semibold" : ""}`}>
                  <div>{format(d, "EEE")}</div>
                  <div className="text-[10px] font-normal">{format(d, "M/d")}</div>
                </th>
              ))}
              <th className="px-2 py-2 w-12 text-center text-muted-foreground">Total</th>
              <th className="px-2 py-2 w-20 text-center text-violet-400 font-semibold" title="Estimate to Complete">ETC (h)</th>
              <th className="px-2 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {groupedRows.map(row => {
              const rowTotal = dayKeys.reduce((s, d) => s + (parseFloat(row.byDay[d]?.hours ?? "0") || 0), 0);
              const allDraft = Object.values(row.byDay).every(c => c.status === "draft");
              const meta = row.taskId ? taskMeta[row.taskId] : undefined;
              const plannedRemaining = meta
                ? Math.max(0, (parseFloat(meta.estimatedHours ?? "0") || 0) - meta.loggedHours)
                : null;
              const etcVal = meta?.etcHours ? parseFloat(meta.etcHours) : null;
              const variance = etcVal !== null && plannedRemaining !== null ? etcVal - plannedRemaining : null;
              return (
                <tr key={row.key} className="hover:bg-muted/20">
                  <td className="px-3 py-1.5">
                    <div className="font-medium text-foreground truncate max-w-[140px]">{row.projectName}</div>
                    {row.taskId && <div className="text-muted-foreground/70 truncate max-w-[140px]">{taskNames[row.taskId] ?? row.taskName ?? `Task #${row.taskId}`}</div>}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[80px]">
                    {categories.find(c => c.id === row.categoryId)?.name ?? "—"}
                  </td>
                  {dayKeys.map(d => {
                    const cell = row.byDay[d];
                    const isSaving = saving === `${row.key}:${d}`;
                    return (
                      <td key={d} className={`px-1 py-1${isSaving ? " opacity-50" : ""}`}>
                        <HoursStepperCell
                          value={cell?.hours ?? ""}
                          disabled={cell?.status === "submitted" || cell?.status === "approved" || isSaving}
                          status={cell?.status}
                          onCommit={hours => saveCell(row, d, hours)}
                        />
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-center font-semibold text-foreground">{rowTotal > 0 ? rowTotal : "—"}</td>
                  <td className="px-1 py-1">
                    {row.taskId ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <input
                          key={`etc-${row.taskId}-${meta?.etcHours}`}
                          type="number" min="0" step="1"
                          defaultValue={meta?.etcHours ?? ""}
                          onBlur={e => { if (row.taskId) saveEtcHours(row.taskId, e.target.value); }}
                          className="w-full h-7 rounded border border-violet-400/40 px-1 text-center text-xs bg-background focus:border-violet-400"
                          placeholder="ETC"
                          title={plannedRemaining !== null ? `Planned remaining: ${plannedRemaining.toFixed(0)}h` : "Estimate to Complete"}
                        />
                        {variance !== null && (
                          <span className={`text-[9px] leading-none ${variance > 0 ? "text-red-400" : variance < 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
                            {variance > 0 ? `+${variance.toFixed(0)}` : variance.toFixed(0)}h
                          </span>
                        )}
                      </div>
                    ) : <span className="text-xs text-muted-foreground/30 block text-center">—</span>}
                  </td>
                  <td className="px-2 py-1 text-right">
                    {allDraft && rowTotal > 0 && (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-block">
                              <button
                                onClick={() => !submitBlocked && submitRow(row)}
                                disabled={submitBlocked}
                                className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                              >Submit</button>
                            </span>
                          </TooltipTrigger>
                          {submitBlocked && (
                            <TooltipContent side="left" className="max-w-[200px] text-center text-xs">
                              Available to submit from {weekStart}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </td>
                </tr>
              );
            })}
            {/* Total row */}
            <tr className="border-t-2 border-border bg-muted/20 font-semibold text-foreground">
              <td className="px-3 py-1.5 text-xs text-muted-foreground" colSpan={2}>Total</td>
              {dayKeys.map(d => (
                <td key={d} className="px-2 py-1.5 text-center text-xs">{totalByDay[d] > 0 ? totalByDay[d] : "—"}</td>
              ))}
              <td className="px-2 py-1.5 text-center text-xs">{Object.values(totalByDay).reduce((a, b) => a + b, 0) || "—"}</td>
              <td />
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Add row */}
      {addRow ? (
        <div className="flex gap-2 px-3 items-end pb-2">
          <div>
            <label className="text-[10px] text-muted-foreground block mb-0.5">Project</label>
            <select value={addRow.projectId} onChange={e => { const p = projects.find((x: any) => String(x.id) === e.target.value); setAddRow(r => r ? { ...r, projectId: e.target.value, projectName: p?.name ?? "" } : r); }}
              className="h-8 rounded border border-border bg-background px-2 text-xs">
              <option value="">Select…</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-0.5">Task (optional)</label>
            <select value={addRow.taskId} onChange={e => { const t = addTasks.find((t: any) => String(t.id) === e.target.value); setAddRow(r => r ? { ...r, taskId: e.target.value, taskName: t?.name ?? "" } : r); }}
              className="h-8 rounded border border-border bg-background px-2 text-xs">
              <option value="">— None —</option>
              {addTasks.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-0.5">Category</label>
            <select value={addRow.categoryId} onChange={e => { const c = categories.find(c => String(c.id) === e.target.value); setAddRow(r => r ? { ...r, categoryId: e.target.value, isBillable: c ? c.defaultBillable : r.isBillable } : r); }}
              className="h-8 rounded border border-border bg-background px-2 text-xs">
              <option value="">— None —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button onClick={addNewRow} disabled={!addRow.projectId || saving === "new"}
            className="h-8 px-3 rounded bg-primary text-primary-foreground text-xs">Add</button>
          <button onClick={() => setAddRow(null)} className="h-8 px-2 rounded bg-muted text-xs text-muted-foreground">Cancel</button>
        </div>
      ) : (
        <div className="px-3 pb-2">
          <button onClick={() => setAddRow({ projectId: "", projectName: "", taskId: "", taskName: "", categoryId: "", isBillable: true })}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <Plus className="h-3.5 w-3.5" /> Add project row
          </button>
        </div>
      )}
    </div>
  );
}

export default function TimesheetsList() {
  const { role } = useAuthRole();
  const { data: timesheets, isLoading, refetch } = useListTimesheets();
  const { data: projects } = useListProjects();
  const { toast } = useToast();

  const canLog     = role ? CAN_LOG.includes(role)      : false;
  const canApprove = role ? CAN_APPROVE.includes(role)  : false;
  const canViewAll = role ? CAN_VIEW_ALL.includes(role) : false;

  const myResource = role ? ROLE_DEMO_RESOURCE[role] : undefined;

  const defaultTab: Tab = canLog && !canViewAll ? "mine" : canViewAll ? "review" : "mine";
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [actingId, setActingId] = useState<number | null>(null);

  const [logOpen, setLogOpen] = useState(false);
  const [form, setForm] = useState<LogTimeForm>(defaultForm());
  const [submitting, setSubmitting] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [missingTimesheets, setMissingTimesheets] = useState<{ missingCount: number; totalResources: number; weekStart: string; missingResources: { id: number; name: string }[] } | null>(null);
  const [categories, setCategories] = useState<{ id: number; name: string; defaultBillable: boolean; isActive: boolean }[]>([]);
  const [projectTasks, setProjectTasks] = useState<{ id: number; name: string; assignedToId?: number }[]>([]);
  const [tsView, setTsView] = useState<"list"|"grid">("grid");

  useEffect(() => {
    fetch(`${API_BASE}/time-entry-categories`)
      .then(r => r.json()).then(d => setCategories(Array.isArray(d) ? d.filter((c: any) => c.isActive) : []))
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

  const myEntries = useMemo(() => {
    if (!timesheets || !myResource) return timesheets ?? [];
    return timesheets.filter(t => t.resourceId === myResource.id);
  }, [timesheets, myResource]);

  const reviewEntries = useMemo(() => {
    if (!timesheets) return [];
    return timesheets.filter(t => filterStatus === "all" || t.status === filterStatus)
      .filter(t => filterProject === "all" || t.projectName === filterProject);
  }, [timesheets, filterStatus, filterProject]);

  const displayEntries = activeTab === "mine" ? myEntries : reviewEntries;

  const projectNames = useMemo(() => {
    if (!timesheets) return [];
    return [...new Set(timesheets.map(t => t.projectName).filter(Boolean))];
  }, [timesheets]);

  const stats = useMemo(() => {
    const src = activeTab === "mine" ? myEntries : (timesheets ?? []);
    return {
      total:        src.length,
      submitted:    src.filter(t => t.status === "submitted").length,
      approved:     src.filter(t => t.status === "approved").length,
      rejected:     src.filter(t => t.status === "rejected").length,
      totalHours:   Math.round(src.reduce((s, t) => s + (t.hoursLogged || 0), 0)),
      pendingHours: Math.round(src.filter(t => t.status === "submitted").reduce((s, t) => s + (t.hoursLogged || 0), 0)),
    };
  }, [timesheets, myEntries, activeTab]);

  const handleAction = async (id: number, action: "approve" | "reject" | "submit" | "reset", extra?: Record<string, string>) => {
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
    }
  };

  const handleLogSubmit = async () => {
    if (!form.projectId || !form.hoursLogged || parseFloat(form.hoursLogged) <= 0) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
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
          hoursLogged:  parseFloat(form.hoursLogged),
          activityType: "consulting",
          notes:        form.notes || null,
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

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  const showMineTab   = canLog || !!myResource;
  const showReviewTab = canViewAll;

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Time Logs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeTab === "mine"
              ? `${myEntries.length} entr${myEntries.length === 1 ? "y" : "ies"} · ${stats.totalHours}h logged`
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
          {canLog && (
            <Button onClick={() => { setForm(defaultForm()); setLogOpen(true); }} className="gap-2">
              <Plus className="h-4 w-4" /> Log Time
            </Button>
          )}
        </div>
      </div>

      {/* Missing timesheet reminder banner */}
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

      {/* Cross-project view notice — removed per PSA alignment */}
      <div className="hidden">
        <Info className="h-4 w-4" />
        <p className="text-sm">
          Cross-project work log approval — all projects in one view. Project-specific logs and approval are also available inside each project's{" "}
          <strong>Work Logs tab</strong>. Click any project name below to go directly to that project, or the{" "}
          <span className="inline-flex items-center gap-0.5 font-semibold"><Rocket className="h-3 w-3" /> Command Center</span>
          {" "}for the executive view.
        </p>
      </div>

      {/* Tabs */}
      {(showMineTab && showReviewTab) && (
        <div className="flex gap-1 border-b border-border">
          {showMineTab && (
            <button
              onClick={() => setActiveTab("mine")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "mine"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              My Timesheets
            </button>
          )}
          {showReviewTab && (
            <button
              onClick={() => setActiveTab("review")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "review"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
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
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Hours",      value: `${stats.totalHours}h`,  bg: "bg-card border-border",            text: "text-foreground" },
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

      {/* Filters (review only) */}
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
            <SelectTrigger className="w-[220px] h-9"><SelectValue placeholder="All projects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projectNames.map(p => <SelectItem key={p} value={p!}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          {(filterStatus !== "all" || filterProject !== "all") && (
            <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" onClick={() => { setFilterStatus("all"); setFilterProject("all"); }}>
              Clear
            </Button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{reviewEntries.length} records</span>
        </div>
      )}

      {/* Weekly Grid (mine tab only) */}
      {activeTab === "mine" && tsView === "grid" && myResource && (
        <div className="border rounded-xl overflow-hidden bg-card">
          <WeeklyGrid
            resourceId={myResource.id}
            resourceName={myResource.name}
            projects={projects ?? []}
            categories={categories}
            onRefetch={refetch}
            role={role}
          />
        </div>
      )}

      {/* Table (list view or review tab) */}
      {(activeTab === "review" || tsView === "list") && (
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
            {displayEntries.map((ts) => {
              const badgeCfg = STATUS_BADGE[ts.status] || STATUS_BADGE.draft;
              const isBusy = actingId === ts.id;
              const isMyOwn = myResource && ts.resourceId === myResource.id;
              return (
                <TableRow key={ts.id} className="hover:bg-muted/30">
                  {activeTab === "review" && (
                    <TableCell className="font-medium">{ts.resourceName}</TableCell>
                  )}
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
                    {ts.isBillable ? (ts.billableHours != null ? `${ts.billableHours}h` : `${ts.hoursLogged}h`) : <span className="text-xs">Non-billable</span>}
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
                      {/* Loggers can submit their own drafts */}
                      {ts.status === "draft" && canLog && isMyOwn && (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={isBusy} onClick={() => handleAction(ts.id, "submit")}>
                          <Clock className="h-3 w-3" /> Submit
                        </Button>
                      )}
                      {/* Approvers can approve/reject submitted entries */}
                      {ts.status === "submitted" && canApprove && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-emerald-500 text-emerald-600 hover:bg-emerald-50" disabled={isBusy} onClick={() => handleAction(ts.id, "approve", { approvedByName: "Manager" })}>
                            <CheckCircle2 className="h-3 w-3" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-destructive text-destructive hover:bg-red-50" disabled={isBusy} onClick={() => setRejectId(ts.id)}>
                            <XCircle className="h-3 w-3" /> Reject
                          </Button>
                        </>
                      )}
                      {/* Approvers can reset */}
                      {(ts.status === "approved" || ts.status === "rejected") && canApprove && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" disabled={isBusy} onClick={() => handleAction(ts.id, "reset")}>
                          <RotateCcw className="h-3 w-3" /> Reset
                        </Button>
                      )}
                      {/* Finance / RM see read-only indicator */}
                      {!canLog && !canApprove && (
                        <Eye className="h-3.5 w-3.5 text-muted-foreground/40" />
                      )}
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
                      ? <div className="flex flex-col items-center gap-2"><Clock className="h-8 w-8 opacity-20" /><p>No time logged yet.</p><Button size="sm" variant="outline" onClick={() => setLogOpen(true)}>Log your first entry</Button></div>
                      : "No timesheet entries found."
                    : "No timesheets match the current filters."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      )}

      {/* Log Time Modal */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>Log Time</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Project */}
            <div className="grid gap-1.5">
              <Label htmlFor="ts-project">Project <span className="text-destructive">*</span></Label>
              <Select
                value={form.projectId}
                onValueChange={(val) => {
                  const p = projects?.find((x: any) => String(x.id) === val);
                  setForm(f => ({ ...f, projectId: val, projectName: p?.name ?? "", taskId: "", taskName: "" }));
                }}
              >
                <SelectTrigger id="ts-project">
                  <SelectValue placeholder="Select a project…" />
                </SelectTrigger>
                <SelectContent>
                  {(projects ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Task */}
            {form.projectId && (
              <div className="grid gap-1.5">
                <Label htmlFor="ts-task">Task</Label>
                <select
                  id="ts-task"
                  value={form.taskId}
                  onChange={e => {
                    const t = projectTasks.find(t => String(t.id) === e.target.value);
                    setForm(f => ({ ...f, taskId: e.target.value, taskName: t?.name ?? "" }));
                  }}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">— No specific task —</option>
                  {projectTasks
                    .filter(t => !myResource || !t.assignedToId || t.assignedToId === myResource.id)
                    .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}

            {/* Category */}
            <div className="grid gap-1.5">
              <Label htmlFor="ts-category">Category</Label>
              <select
                id="ts-category"
                value={form.categoryId}
                onChange={e => {
                  const cat = categories.find(c => String(c.id) === e.target.value);
                  setForm(f => ({ ...f, categoryId: e.target.value, isBillable: cat ? cat.defaultBillable : f.isBillable }));
                }}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— Select category —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Date + Hours side by side */}
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
                  min="0.5"
                  max="24"
                  step="0.5"
                  placeholder="8"
                  value={form.hoursLogged}
                  onChange={e => setForm(f => ({ ...f, hoursLogged: e.target.value }))}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="grid gap-1.5">
              <Label htmlFor="ts-notes">Description</Label>
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

            {/* Resource info (read-only) */}
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

      {/* Reject Reason Modal */}
      <Dialog open={rejectId !== null} onOpenChange={(o) => { if (!o) { setRejectId(null); setRejectReason(""); } }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Reject Timesheet</DialogTitle>
          </DialogHeader>
          <div className="py-2 grid gap-1.5">
            <Label htmlFor="reject-reason">Reason (optional)</Label>
            <Textarea
              id="reject-reason"
              placeholder="e.g. Hours exceed project budget, please clarify…"
              rows={3}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectId(null); setRejectReason(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectId && handleAction(rejectId, "reject", { rejectedReason: rejectReason })}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
