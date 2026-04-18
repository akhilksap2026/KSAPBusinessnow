import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { format, addDays } from "date-fns";
import { Users, Calendar, Briefcase, AlertTriangle, Plus, Info, Rocket, LayoutGrid, List, X } from "lucide-react";
import { Link } from "wouter";
import { useAuthRole, hasPermission } from "@/lib/auth";

const API = import.meta.env.BASE_URL + "api";

interface Allocation {
  id: number; projectId: number; projectName?: string; resourceId: number; resourceName?: string;
  role?: string; allocationPct: number; startDate?: string; endDate?: string;
  status: string; allocationType: string; hoursPerWeek?: number; notes?: string;
}
interface Resource { id: number; name: string; title?: string; practiceArea: string; currentUtilization: number; }

const TYPE_STYLES: Record<string, string> = {
  hard: "bg-blue-100 text-blue-700 border-blue-200",
  soft: "bg-amber-100 text-amber-700 border-amber-200",
};
const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-emerald-100 text-emerald-700",
  tentative: "bg-amber-100 text-amber-700",
  ended: "bg-gray-100 text-gray-500",
};

// ─── Drag state ───────────────────────────────────────────────────────────────
interface DragState {
  allocationId: number;
  type: "body" | "left" | "right";
  startX: number;
  origStartDate: string;
  origEndDate: string;
  currentWeeksDelta: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getMondayOf(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const diff = (day + 6) % 7;
  const m = new Date(d);
  m.setDate(m.getDate() - diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function addWeeks(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n * 7);
  return r;
}

function toIso(d: Date): string {
  return d.toISOString().split("T")[0];
}

function fromIso(s: string): Date {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(y, m - 1, day);
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditAllocationModal({ allocation, onClose, onSaved }: { allocation: Allocation; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    startDate: allocation.startDate ?? "",
    endDate: allocation.endDate ?? "",
    allocationPct: allocation.allocationPct,
    allocationType: allocation.allocationType,
    status: allocation.status,
    hoursPerWeek: allocation.hoursPerWeek ?? 40,
    notes: allocation.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch(`${API}/allocations/${allocation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-gray-100">Edit Allocation</h3>
            <p className="text-sm text-gray-500">{allocation.resourceName} → {allocation.projectName || `Project #${allocation.projectId}`}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Start Date</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full border rounded-lg px-2 py-1.5 text-sm bg-background" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">End Date</label>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full border rounded-lg px-2 py-1.5 text-sm bg-background" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Allocation %</label>
              <input type="number" min="1" max="200" value={form.allocationPct} onChange={e => setForm(f => ({ ...f, allocationPct: parseInt(e.target.value) }))}
                className="w-full border rounded-lg px-2 py-1.5 text-sm bg-background" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Hrs/Week</label>
              <input type="number" value={form.hoursPerWeek} onChange={e => setForm(f => ({ ...f, hoursPerWeek: parseInt(e.target.value) }))}
                className="w-full border rounded-lg px-2 py-1.5 text-sm bg-background" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Type</label>
              <select value={form.allocationType} onChange={e => setForm(f => ({ ...f, allocationType: e.target.value }))}
                className="w-full border rounded-lg px-2 py-1.5 text-sm bg-background">
                <option value="hard">Hard</option>
                <option value="soft">Soft</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full border rounded-lg px-2 py-1.5 text-sm bg-background">
                <option value="confirmed">Confirmed</option>
                <option value="tentative">Tentative</option>
                <option value="ended">Ended</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Notes</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optional" className="w-full border rounded-lg px-2 py-1.5 text-sm bg-background" />
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2 bg-gray-50 dark:bg-gray-800 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-1.5 border text-sm rounded-lg">Cancel</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Allocation Grid (Gantt) ──────────────────────────────────────────────────
const COL_W = 88;   // px per week column
const ROW_H = 44;   // px per resource row
const LABEL_W = 180; // px for resource label column
const GRID_WEEKS = 18; // total weeks to show

function AllocationGrid({
  allocations, resources, conflictIds, onPatched, onClickBar,
}: {
  allocations: Allocation[];
  resources: Resource[];
  conflictIds: Set<number>;
  onPatched: () => void;
  onClickBar: (a: Allocation) => void;
}) {
  const today = new Date();

  // Grid starts at Monday 3 weeks before current Monday
  const gridStart = useMemo(() => {
    const m = getMondayOf(today);
    return addWeeks(m, -3);
  }, []);

  const weeks = useMemo(() =>
    Array.from({ length: GRID_WEEKS }, (_, i) => addWeeks(gridStart, i)),
    [gridStart]);

  // Group allocations by resourceId
  const byResource = useMemo(() => {
    const map = new Map<number, Allocation[]>();
    for (const a of allocations) {
      if (!map.has(a.resourceId)) map.set(a.resourceId, []);
      map.get(a.resourceId)!.push(a);
    }
    return map;
  }, [allocations]);

  // Only show resources that have at least one allocation with dates in the grid
  const visibleResources = useMemo(() =>
    resources.filter(r => {
      const ra = byResource.get(r.id);
      return ra && ra.some(a => a.startDate && a.endDate);
    }),
    [resources, byResource]);

  // Drag state
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragMoved = useRef(false);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

  // Convert date string to fractional column index from grid start
  const dateToCol = useCallback((dateStr: string): number => {
    const d = fromIso(dateStr);
    return (d.getTime() - gridStart.getTime()) / (7 * 24 * 3600 * 1000);
  }, [gridStart]);

  // PATCH and reload
  const patchAlloc = useCallback(async (id: number, body: object) => {
    await fetch(`${API}/allocations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    onPatched();
  }, [onPatched]);

  // Global pointer events for drag
  useEffect(() => {
    if (!drag) return;

    const onMove = (e: PointerEvent) => {
      const delta = e.clientX - drag.startX;
      if (Math.abs(delta) > 4) dragMoved.current = true;
      const weeksDelta = Math.round(delta / COL_W);
      setDrag(d => d ? { ...d, currentWeeksDelta: weeksDelta } : null);
    };

    const onUp = async (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const weeksDelta = Math.round((e.clientX - d.startX) / COL_W);
      setDrag(null);

      if (!dragMoved.current || weeksDelta === 0) return;

      const origStart = fromIso(d.origStartDate);
      const origEnd = fromIso(d.origEndDate);

      if (d.type === "body") {
        const newStart = toIso(addWeeks(origStart, weeksDelta));
        const newEnd = toIso(addWeeks(origEnd, weeksDelta));
        await patchAlloc(d.allocationId, { startDate: newStart, endDate: newEnd });
      } else if (d.type === "right") {
        let newEnd = addWeeks(origEnd, weeksDelta);
        // minimum 1 week duration
        const minEnd = addDays(origStart, 6);
        if (newEnd < minEnd) newEnd = minEnd;
        await patchAlloc(d.allocationId, { endDate: toIso(newEnd) });
      } else if (d.type === "left") {
        let newStart = addWeeks(origStart, weeksDelta);
        // minimum 1 week duration: start can't go past (end - 6 days)
        const maxStart = addDays(origEnd, -6);
        if (newStart > maxStart) newStart = maxStart;
        await patchAlloc(d.allocationId, { startDate: toIso(newStart) });
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, patchAlloc]);

  // Compute effective dates during drag for a given allocation
  const getEffectiveDates = (a: Allocation): { startDate: string; endDate: string } => {
    if (!drag || drag.allocationId !== a.id || !a.startDate || !a.endDate) {
      return { startDate: a.startDate ?? "", endDate: a.endDate ?? "" };
    }
    const wd = drag.currentWeeksDelta;
    const origStart = fromIso(a.startDate);
    const origEnd = fromIso(a.endDate);

    if (drag.type === "body") {
      return {
        startDate: toIso(addWeeks(origStart, wd)),
        endDate: toIso(addWeeks(origEnd, wd)),
      };
    } else if (drag.type === "right") {
      let newEnd = addWeeks(origEnd, wd);
      const minEnd = addDays(origStart, 6);
      if (newEnd < minEnd) newEnd = minEnd;
      return { startDate: a.startDate, endDate: toIso(newEnd) };
    } else {
      let newStart = addWeeks(origStart, wd);
      const maxStart = addDays(origEnd, -6);
      if (newStart > maxStart) newStart = maxStart;
      return { startDate: toIso(newStart), endDate: a.endDate };
    }
  };

  const renderBar = (a: Allocation) => {
    if (!a.startDate || !a.endDate) return null;
    const isDragging = drag?.allocationId === a.id;
    const { startDate: effStart, endDate: effEnd } = getEffectiveDates(a);

    const startCol = dateToCol(effStart);
    const endCol = dateToCol(effEnd) + 1; // end of day (add 1 day in weeks = 1/7)
    const endColFull = dateToCol(effEnd) + 1;

    const left = startCol * COL_W;
    const width = (endColFull - startCol) * COL_W;

    // Clip to visible grid
    if (left + width < 0 || left > GRID_WEEKS * COL_W) return null;

    const isConflict = conflictIds.has(a.resourceId);
    const barBg = a.allocationType === "soft"
      ? "bg-amber-400 border-amber-500"
      : isConflict
        ? "bg-red-400 border-red-500"
        : "bg-blue-500 border-blue-600";

    const clampedLeft = Math.max(0, left);
    const clampedWidth = Math.max(COL_W, width - Math.max(0, -left));

    return (
      <div
        key={a.id}
        style={{
          position: "absolute",
          left: clampedLeft,
          width: clampedWidth,
          top: 7,
          height: ROW_H - 14,
          transition: isDragging ? "none" : "left 0.15s ease, width 0.15s ease",
          zIndex: isDragging ? 10 : 1,
        }}
        className={`rounded border ${barBg} ${isDragging ? "opacity-50 shadow-lg" : "opacity-100"} group select-none`}
      >
        {/* Drag tooltip */}
        {isDragging && (
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap z-50 pointer-events-none shadow-lg">
            {format(fromIso(effStart), "MMM d")} – {format(fromIso(effEnd), "MMM d, yyyy")}
          </div>
        )}

        {/* Left edge handle */}
        <div
          className="absolute left-0 top-0 h-full w-2.5 cursor-ew-resize rounded-l z-10 hover:bg-white/20"
          onPointerDown={e => {
            e.stopPropagation();
            dragMoved.current = false;
            setDrag({
              allocationId: a.id, type: "left", startX: e.clientX,
              origStartDate: a.startDate!, origEndDate: a.endDate!, currentWeeksDelta: 0,
            });
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          title="Drag to resize start date"
        />

        {/* Bar body (drag + click) */}
        <div
          className="absolute left-2.5 right-2.5 top-0 h-full flex items-center px-1.5 overflow-hidden cursor-grab active:cursor-grabbing"
          onPointerDown={e => {
            dragMoved.current = false;
            setDrag({
              allocationId: a.id, type: "body", startX: e.clientX,
              origStartDate: a.startDate!, origEndDate: a.endDate!, currentWeeksDelta: 0,
            });
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onClick={e => {
            if (dragMoved.current) { e.stopPropagation(); return; }
            onClickBar(a);
          }}
        >
          <span className="text-white text-xs font-medium truncate leading-tight">
            {a.projectName || `#${a.projectId}`} · {a.allocationPct}%
            {isConflict && <span className="ml-1 opacity-80">⚠</span>}
          </span>
        </div>

        {/* Right edge handle */}
        <div
          className="absolute right-0 top-0 h-full w-2.5 cursor-ew-resize rounded-r z-10 hover:bg-white/20"
          onPointerDown={e => {
            e.stopPropagation();
            dragMoved.current = false;
            setDrag({
              allocationId: a.id, type: "right", startX: e.clientX,
              origStartDate: a.startDate!, origEndDate: a.endDate!, currentWeeksDelta: 0,
            });
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          title="Drag to resize end date"
        />
      </div>
    );
  };

  // Current week column index for "today" indicator
  const todayCol = (today.getTime() - gridStart.getTime()) / (7 * 24 * 3600 * 1000);
  const todayX = todayCol * COL_W;

  return (
    <div className="rounded-xl border overflow-hidden bg-white dark:bg-gray-900">
      <div className="flex">
        {/* Left: fixed resource labels */}
        <div style={{ width: LABEL_W, flexShrink: 0 }} className="border-r">
          {/* Header */}
          <div style={{ height: 40 }} className="bg-muted/50 border-b flex items-center px-3">
            <span className="text-xs font-medium text-muted-foreground">Resource</span>
          </div>
          {visibleResources.map(r => (
            <div key={r.id} style={{ height: ROW_H }} className="flex items-center px-3 border-b text-sm font-medium">
              {conflictIds.has(r.id) && <AlertTriangle size={11} className="text-red-500 mr-1 flex-shrink-0" />}
              <Link href={`/resources/${r.id}`} className="truncate hover:text-primary transition-colors">{r.name}</Link>
            </div>
          ))}
          {visibleResources.length === 0 && (
            <div style={{ height: 80 }} className="flex items-center justify-center text-muted-foreground text-xs px-3 text-center">
              No dated allocations to show
            </div>
          )}
        </div>

        {/* Right: scrollable grid */}
        <div style={{ flex: 1, overflowX: "auto" }}>
          {/* Week headers */}
          <div style={{ display: "flex", height: 40, position: "relative", minWidth: GRID_WEEKS * COL_W }} className="bg-muted/50 border-b">
            {weeks.map((w, i) => {
              const isCurrent = w <= today && today < addWeeks(w, 1);
              return (
                <div key={i} style={{ width: COL_W, flexShrink: 0, borderLeft: i > 0 ? "1px solid #e5e7eb" : undefined }}
                  className={`flex items-center justify-center text-xs font-medium ${isCurrent ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300" : "text-muted-foreground"}`}>
                  {format(w, "MMM d")}
                </div>
              );
            })}
          </div>

          {/* Resource rows */}
          <div style={{ position: "relative", minWidth: GRID_WEEKS * COL_W }}>
            {/* Today vertical line */}
            {todayX >= 0 && todayX <= GRID_WEEKS * COL_W && (
              <div style={{ position: "absolute", left: todayX, top: 0, bottom: 0, width: 2, background: "#3b82f6", opacity: 0.4, zIndex: 5, pointerEvents: "none" }} />
            )}

            {visibleResources.map(r => {
              const rowAllocs = (byResource.get(r.id) || []).filter(a => a.startDate && a.endDate);
              return (
                <div key={r.id} style={{ height: ROW_H, position: "relative", display: "flex" }} className="border-b">
                  {/* Week column backgrounds */}
                  {weeks.map((w, i) => {
                    const isCurrent = w <= today && today < addWeeks(w, 1);
                    return (
                      <div key={i} style={{ width: COL_W, flexShrink: 0, borderLeft: i > 0 ? "1px solid #e5e7eb" : undefined }}
                        className={isCurrent ? "bg-blue-50/50 dark:bg-blue-950/20" : i % 2 === 0 ? "" : "bg-muted/10"} />
                    );
                  })}
                  {/* Allocation bars */}
                  {rowAllocs.map(a => renderBar(a))}
                </div>
              );
            })}

            {visibleResources.length === 0 && (
              <div style={{ height: 80 }} className="flex items-center justify-center text-muted-foreground text-sm">
                No allocations with date ranges to display.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="border-t px-4 py-2 bg-muted/30 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-500" /> Hard allocation</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-400" /> Soft (pipeline)</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-400" /> Over-allocated</div>
        <span className="ml-auto">Drag bar to move · Drag edges to resize · Click to edit</span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AllocationsPage() {
  const { role } = useAuthRole();
  const canCreate = hasPermission(role, "createAllocation");
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "hard" | "soft" | "active" | "conflicts">("all");
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [editAlloc, setEditAlloc] = useState<Allocation | null>(null);
  const [form, setForm] = useState({ resourceId: "", projectId: "", projectName: "", role: "", allocationPct: 100, startDate: "", endDate: "", allocationType: "hard", hoursPerWeek: 40, notes: "" });

  const load = async () => {
    setLoading(true);
    const [a, r] = await Promise.all([
      fetch(`${API}/allocations`).then(res => res.json()),
      fetch(`${API}/resources`).then(res => res.json()),
    ]);
    setAllocations(a);
    setResources(r);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const today = new Date().toISOString().split("T")[0];

  const resourceLoads: Record<number, number> = {};
  allocations.filter(a => a.allocationType !== "soft" && (!a.endDate || a.endDate >= today)).forEach(a => {
    resourceLoads[a.resourceId] = (resourceLoads[a.resourceId] || 0) + a.allocationPct;
  });
  const conflictIds = new Set(Object.entries(resourceLoads).filter(([, v]) => v > 100).map(([k]) => parseInt(k)));

  const filtered = allocations.filter(a => {
    if (filter === "hard") return a.allocationType === "hard";
    if (filter === "soft") return a.allocationType === "soft";
    if (filter === "active") return (!a.endDate || a.endDate >= today) && (!a.startDate || a.startDate <= today);
    if (filter === "conflicts") return conflictIds.has(a.resourceId);
    return true;
  });

  const submit = async () => {
    if (!form.resourceId || !form.projectId) return;
    const resource = resources.find(r => r.id === parseInt(form.resourceId));
    await fetch(`${API}/allocations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, resourceId: parseInt(form.resourceId), projectId: parseInt(form.projectId), resourceName: resource?.name }),
    });
    setShowForm(false);
    load();
  };

  const remove = async (id: number) => {
    if (!confirm("Remove this allocation?")) return;
    await fetch(`${API}/allocations/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4 flex-shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Assignments</h1>
            <p className="text-sm text-muted-foreground">Cross-project staffing — who is assigned to what, at a glance</p>
          </div>
          <div className="flex gap-3">
            {[
              { val: allocations.filter(a => a.allocationType === "hard" && (!a.endDate || a.endDate >= today)).length, label: "Hard Allocations", color: "text-blue-600" },
              { val: allocations.filter(a => a.allocationType === "soft").length, label: "Soft (Pipeline)", color: "text-amber-600" },
              { val: conflictIds.size, label: "Conflicts", color: conflictIds.size > 0 ? "text-red-600" : "text-emerald-600" },
            ].map((kpi, i) => (
              <div key={i} className="text-center px-4 py-2 bg-muted/60 rounded-xl">
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.val}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            ))}
            {canCreate && (
              <button onClick={() => setShowForm(s => !s)} className="self-center px-4 py-2 bg-primary text-primary-foreground text-sm rounded-xl font-medium hover:bg-primary/90 transition-colors flex items-center gap-2">
                <Plus size={14} />New Allocation
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-3 items-center">
          {(["all", "hard", "soft", "active", "conflicts"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
              {f === "conflicts" ? `⚠️ Conflicts (${conflictIds.size})` : f}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} allocations</span>

          {/* View toggle */}
          <div className="flex rounded-lg border overflow-hidden">
            <button onClick={() => setViewMode("table")}
              className={`px-2.5 py-1.5 flex items-center gap-1 text-xs transition-colors ${viewMode === "table" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted/50"}`}>
              <List size={13} /> Table
            </button>
            <button onClick={() => setViewMode("grid")}
              className={`px-2.5 py-1.5 flex items-center gap-1 text-xs transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted/50"}`}>
              <LayoutGrid size={13} /> Grid
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* New allocation form */}
        {showForm && (
          <div className="border rounded-xl p-5 bg-muted/20 space-y-4">
            <h3 className="font-semibold">Create Allocation</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Resource *</label>
                <select value={form.resourceId} onChange={e => setForm(f => ({ ...f, resourceId: e.target.value }))} className="w-full mt-1 border rounded px-2 py-1.5 text-sm bg-background">
                  <option value="">Select resource...</option>
                  {resources.map(r => <option key={r.id} value={r.id}>{r.name} ({r.currentUtilization}% utilized)</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Project *</label>
                <input value={form.projectName} onChange={e => setForm(f => ({ ...f, projectName: e.target.value, projectId: e.target.value }))} placeholder="Project name or ID" className="w-full mt-1 border rounded px-2 py-1.5 text-sm bg-background" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Role</label>
                <input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. Solution Architect" className="w-full mt-1 border rounded px-2 py-1.5 text-sm bg-background" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Allocation %</label>
                <input type="number" min="1" max="200" value={form.allocationPct} onChange={e => setForm(f => ({ ...f, allocationPct: parseInt(e.target.value) }))} className="w-full mt-1 border rounded px-2 py-1.5 text-sm bg-background" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Type</label>
                <select value={form.allocationType} onChange={e => setForm(f => ({ ...f, allocationType: e.target.value }))} className="w-full mt-1 border rounded px-2 py-1.5 text-sm bg-background">
                  <option value="hard">Hard (Active project)</option>
                  <option value="soft">Soft (Pipeline / tentative)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Hrs/Week</label>
                <input type="number" value={form.hoursPerWeek} onChange={e => setForm(f => ({ ...f, hoursPerWeek: parseInt(e.target.value) }))} className="w-full mt-1 border rounded px-2 py-1.5 text-sm bg-background" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Start Date</label>
                <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="w-full mt-1 border rounded px-2 py-1.5 text-sm bg-background" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">End Date</label>
                <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className="w-full mt-1 border rounded px-2 py-1.5 text-sm bg-background" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional note" className="w-full mt-1 border rounded px-2 py-1.5 text-sm bg-background" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={submit} className="px-4 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg font-medium hover:bg-primary/90">Create</button>
              <button onClick={() => setShowForm(false)} className="px-4 py-1.5 border text-sm rounded-lg">Cancel</button>
            </div>
          </div>
        )}

        {/* Cross-project view notice */}
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-900/50 px-4 py-3">
          <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800 dark:text-blue-300 flex-1">
            Cross-project staffing visibility — all active allocations in one place. For project-level allocation management, use each project's <strong>Team tab</strong>. Click a project name below to open it, or the{" "}
            <span className="inline-flex items-center gap-0.5 font-semibold"><Rocket className="h-3 w-3" /> Command Center</span>
            {" "}for the executive view.
          </p>
        </div>

        {/* Conflict banner */}
        {conflictIds.size > 0 && filter !== "conflicts" && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 font-medium">{conflictIds.size} resource{conflictIds.size !== 1 ? "s" : ""} over-allocated. <button onClick={() => setFilter("conflicts")} className="underline">View conflicts →</button></p>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
        ) : viewMode === "grid" ? (
          <AllocationGrid
            allocations={filtered}
            resources={resources}
            conflictIds={conflictIds}
            onPatched={load}
            onClickBar={setEditAlloc}
          />
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Resource</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Project</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Allocation</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Period</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => {
                  const totalLoad = resourceLoads[a.resourceId] || 0;
                  const isConflict = conflictIds.has(a.resourceId);
                  const isActive = (!a.endDate || a.endDate >= today) && (!a.startDate || a.startDate <= today);
                  return (
                    <tr key={a.id} className={`border-t hover:bg-muted/10 transition-colors ${i % 2 === 0 ? "" : "bg-muted/5"}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isConflict && <AlertTriangle size={12} className="text-red-500 flex-shrink-0" aria-label={`${totalLoad}% total load`} />}
                          <div>
                            {a.resourceId ? (
                              <Link href={`/resources/${a.resourceId}`}
                                className="font-medium hover:text-primary underline-offset-2 hover:underline">
                                {a.resourceName || "—"}
                              </Link>
                            ) : <p className="font-medium">{a.resourceName || "—"}</p>}
                            {isConflict && <p className="text-xs text-red-500">{totalLoad}% total</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link href={`/projects/${a.projectId}`} className="font-medium text-foreground hover:text-primary underline-offset-2 hover:underline truncate max-w-[160px]">
                            {a.projectName || `Project #${a.projectId}`}
                          </Link>
                          <Link href={`/projects/${a.projectId}/command`} className="text-muted-foreground/50 hover:text-primary flex-shrink-0" title="Command Center">
                            <Rocket className="h-3 w-3" />
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{a.role || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded border font-medium ${TYPE_STYLES[a.allocationType] || TYPE_STYLES.hard}`}>
                          {a.allocationType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{a.allocationPct}%</span>
                          {a.hoursPerWeek && <span className="text-xs text-muted-foreground">{a.hoursPerWeek}h/wk</span>}
                        </div>
                        <div className="w-20 mt-1">
                          <div className="w-full bg-muted rounded-full h-1">
                            <div className={`h-1 rounded-full ${a.allocationType === "soft" ? "bg-amber-400" : isConflict ? "bg-red-500" : "bg-blue-500"}`} style={{ width: `${Math.min(a.allocationPct, 100)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <div>{a.startDate ? format(new Date(a.startDate), "MMM d, yyyy") : "—"}</div>
                        <div>{a.endDate ? format(new Date(a.endDate), "MMM d, yyyy") : "Ongoing"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_STYLES[a.status] || STATUS_STYLES.confirmed}`}>{a.status}</span>
                        {isActive && <span className="ml-1 text-xs text-emerald-600">●</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setEditAlloc(a)} className="text-xs text-blue-500 hover:text-blue-700 transition-colors">Edit</button>
                          <button onClick={() => remove(a.id)} className="text-xs text-red-500 hover:text-red-700 transition-colors">Remove</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No allocations matching this filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editAlloc && (
        <EditAllocationModal
          allocation={editAlloc}
          onClose={() => setEditAlloc(null)}
          onSaved={() => { setEditAlloc(null); load(); }}
        />
      )}
    </div>
  );
}
