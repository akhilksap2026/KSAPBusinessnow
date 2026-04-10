import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { format, addDays, startOfWeek } from "date-fns";
import { User, Users, AlertTriangle, TrendingDown, Briefcase, MapPin, Star, Search, Plus, X } from "lucide-react";
import { useAuthRole, hasPermission } from "@/lib/auth";

const API = import.meta.env.BASE_URL + "api";

interface Resource {
  id: number; name: string; title?: string; practiceArea: string; employmentType: string;
  skills?: string[]; certifications?: string[]; specialties?: string[];
  currentUtilization: number; utilizationTarget: number; status: string;
  hourlyRate?: number; costRate?: number; location?: string; timezone?: string;
  isContractor?: boolean; availableFrom?: string; bio?: string;
}

interface WeekData { week: string; hard: number; soft: number; total: number; band: string; }
interface HeatmapResource { resource: Resource; weeks: WeekData[]; avgUtilization: number; }

const BAND_COLORS: Record<string, string> = {
  bench: "bg-slate-100 text-slate-400",
  available: "bg-emerald-100 text-emerald-600",
  optimal: "bg-blue-100 text-blue-700",
  booked: "bg-amber-100 text-amber-700",
  overbooked: "bg-red-100 text-red-700",
};
const BAND_BG: Record<string, string> = {
  bench: "bg-slate-100", available: "bg-emerald-200", optimal: "bg-blue-400",
  booked: "bg-amber-400", overbooked: "bg-red-500",
};

const PRACTICE_LABELS: Record<string, string> = {
  implementation: "Implementation", cloud_migration: "Cloud Migration", ams: "AMS",
  qa: "QA / Cert", data_migration: "Data Migration", custom_dev: "Custom Dev",
  rate_maintenance: "Rate Maintenance", solution_architect: "Solution Architecture",
  integration: "Integration", management: "Management",
};

function UtilizationBadge({ pct, target }: { pct: number; target: number }) {
  const cls = pct === 0 ? "bg-slate-100 text-slate-400" : pct <= target - 15 ? "bg-emerald-100 text-emerald-700" : pct <= target + 10 ? "bg-blue-100 text-blue-700" : pct <= 110 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>{pct}%</span>;
}

function UtilizationRing({ pct, size = 44 }: { pct: number; size?: number }) {
  const r = (size / 2) - 5;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  const capped = Math.min(pct, 130);
  const offset = circumference * (1 - capped / 130);
  const color = pct === 0 ? "#94a3b8" : pct < 75 ? "#22c55e" : pct <= 105 ? "#3b82f6" : "#ef4444";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#e2e8f0" strokeWidth={4} />
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${cx} ${cx})`} />
      <text x={cx} y={cx} textAnchor="middle" dominantBaseline="central"
        fontSize={9} fontWeight="700" fill={color}>{pct}%</text>
    </svg>
  );
}

function EmploymentBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    employee: "bg-slate-100 text-slate-600",
    contractor: "bg-purple-100 text-purple-700",
    partner: "bg-amber-100 text-amber-700",
  };
  return <span className={`text-xs px-2 py-0.5 rounded font-medium ${styles[type] || styles.employee}`}>{type}</span>;
}

// ─── Heatmap Tab ────────────────────────────────────────────────────────────
function HeatmapView({ weeks: numWeeks, granularity }: { weeks: number; granularity: "week" | "month" }) {
  const [data, setData] = useState<{ weeks: string[]; resources: HeatmapResource[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [fillOpen, setFillOpen] = useState(false);
  const [fillForm, setFillForm] = useState({ resourceId: "", projectId: "", startDate: "", endDate: "", allocationPct: "100", allocationType: "hard" });
  const [fillSaving, setFillSaving] = useState(false);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/resources/utilization?weeks=${numWeeks}&granularity=${granularity}`)
      .then(r => r.json()).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [numWeeks, granularity]);

  useEffect(() => {
    if (fillOpen && projects.length === 0) {
      fetch(`${API}/projects`).then(r => r.json()).then(d => setProjects(Array.isArray(d) ? d : [])).catch(() => {});
    }
  }, [fillOpen]);

  const handleFillRange = async () => {
    if (!fillForm.resourceId || !fillForm.projectId || !fillForm.startDate || !fillForm.endDate) return;
    setFillSaving(true);
    try {
      await fetch(`${API}/allocations/fill-range`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fillForm, resourceId: parseInt(fillForm.resourceId), projectId: parseInt(fillForm.projectId), allocationPct: parseFloat(fillForm.allocationPct) }) });
      setFillOpen(false);
      setFillForm({ resourceId: "", projectId: "", startDate: "", endDate: "", allocationPct: "100", allocationType: "hard" });
      setLoading(true);
      fetch(`${API}/resources/utilization?weeks=${numWeeks}&granularity=${granularity}`)
        .then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
    } finally { setFillSaving(false); }
  };

  if (loading) return <div className="p-8 animate-pulse space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-10 bg-muted rounded" />)}</div>;
  if (!data) return <div className="p-8 text-muted-foreground text-center">Could not load utilization data.</div>;

  const bands = [
    { key: "bench", label: "Bench / Idle", color: "bg-slate-200" },
    { key: "available", label: "Available (<60%)", color: "bg-emerald-300" },
    { key: "optimal", label: "Optimal (60–90%)", color: "bg-blue-400" },
    { key: "booked", label: "Booked (90–110%)", color: "bg-amber-400" },
    { key: "overbooked", label: "Overbooked (>110%)", color: "bg-red-500" },
  ];

  return (
    <div className="p-4">
      {/* Legend + Allocate Range */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Legend:</span>
        {bands.map(b => (
          <div key={b.key} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm ${b.color}`} />
            <span className="text-xs text-muted-foreground">{b.label}</span>
          </div>
        ))}
        <button onClick={() => setFillOpen(!fillOpen)}
          className={`ml-auto flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${fillOpen ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
          <Plus className="h-3.5 w-3.5" /> Allocate Range
        </button>
      </div>

      {/* Fill-range panel */}
      {fillOpen && (
        <div className="mb-4 p-4 border rounded-xl bg-card flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-[10px] text-muted-foreground block mb-0.5">Resource</label>
            <select value={fillForm.resourceId} onChange={e => setFillForm(f => ({ ...f, resourceId: e.target.value }))}
              className="h-8 rounded border border-border bg-background px-2 text-xs">
              <option value="">Select resource…</option>
              {(data?.resources ?? []).map(({ resource: r }) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-0.5">Project</label>
            <select value={fillForm.projectId} onChange={e => setFillForm(f => ({ ...f, projectId: e.target.value }))}
              className="h-8 rounded border border-border bg-background px-2 text-xs">
              <option value="">Select project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-0.5">Start Date</label>
            <input type="date" value={fillForm.startDate} onChange={e => setFillForm(f => ({ ...f, startDate: e.target.value }))}
              className="h-8 rounded border border-border bg-background px-2 text-xs" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-0.5">End Date</label>
            <input type="date" value={fillForm.endDate} onChange={e => setFillForm(f => ({ ...f, endDate: e.target.value }))}
              className="h-8 rounded border border-border bg-background px-2 text-xs" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-0.5">Allocation %</label>
            <input type="number" min="1" max="200" step="5" value={fillForm.allocationPct} onChange={e => setFillForm(f => ({ ...f, allocationPct: e.target.value }))}
              className="h-8 w-16 rounded border border-border bg-background px-2 text-xs" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-0.5">Type</label>
            <select value={fillForm.allocationType} onChange={e => setFillForm(f => ({ ...f, allocationType: e.target.value }))}
              className="h-8 rounded border border-border bg-background px-2 text-xs">
              <option value="hard">Hard</option>
              <option value="soft">Soft</option>
            </select>
          </div>
          <button onClick={handleFillRange} disabled={fillSaving || !fillForm.resourceId || !fillForm.projectId || !fillForm.startDate || !fillForm.endDate}
            className="h-8 px-4 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
            {fillSaving ? "Saving…" : "Apply"}
          </button>
          <button onClick={() => setFillOpen(false)} className="h-8 w-8 flex items-center justify-center rounded bg-muted text-muted-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}


      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-44 sticky left-0 bg-background z-10">Resource</th>
              {data.weeks.map(w => (
                <th key={w} className="px-1 py-2 font-medium text-muted-foreground text-center min-w-[52px]">
                  {granularity === "month" ? format(new Date(w + "T00:00:00"), "MMM yyyy") : format(new Date(w + "T00:00:00"), "MMM d")}
                </th>
              ))}
              <th className="px-3 py-2 font-medium text-muted-foreground text-center">Avg</th>
            </tr>
          </thead>
          <tbody>
            {data.resources.map(({ resource, weeks, avgUtilization }) => (
              <tr key={resource.id} className="border-t hover:bg-muted/20 transition-colors">
                <td className="px-3 py-2 sticky left-0 bg-background z-10">
                  <div className="font-medium truncate max-w-[160px]">{resource.name}</div>
                  <div className="text-muted-foreground text-xs truncate">{PRACTICE_LABELS[resource.practiceArea] || resource.practiceArea}</div>
                </td>
                {weeks.map(w => (
                  <td key={w.week} className="px-1 py-1 text-center">
                    <div className={`rounded text-xs font-bold py-1 px-0.5 ${BAND_BG[w.band]} ${w.band === "bench" ? "text-slate-400" : w.band === "overbooked" ? "text-foreground" : w.band === "booked" ? "text-amber-800" : w.band === "optimal" ? "text-foreground" : "text-emerald-700"}`}
                      title={`${resource.name}: ${w.hard}% hard, ${w.soft}% soft`}>
                      {w.hard > 0 ? `${w.hard}%` : "—"}
                    </div>
                  </td>
                ))}
                <td className="px-3 py-2 text-center">
                  <UtilizationBadge pct={avgUtilization} target={resource.utilizationTarget || 80} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Roster Tab ──────────────────────────────────────────────────────────────
function RosterView({ resources, onSelect }: { resources: Resource[]; onSelect: (id: number) => void }) {
  const [filter, setFilter] = useState<"all" | "bench" | "overbooked" | "contractor">("all");
  const [search, setSearch] = useState("");

  const filtered = resources.filter(r => {
    if (filter === "bench") { if (r.currentUtilization >= 20) return false; }
    else if (filter === "overbooked") { if (r.currentUtilization <= 100) return false; }
    else if (filter === "contractor") { if (r.employmentType === "employee") return false; }
    if (search) {
      const q = search.toLowerCase();
      if (!r.name.toLowerCase().includes(q) &&
          !(r.title || "").toLowerCase().includes(q) &&
          !(PRACTICE_LABELS[r.practiceArea] || r.practiceArea || "").toLowerCase().includes(q) &&
          !(r.skills || []).some(s => s.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const groups: Record<string, Resource[]> = {};
  filtered.forEach(r => {
    const key = r.practiceArea;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative flex-none">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search name, role, skill…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 h-7 text-xs border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-48"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "bench", "overbooked", "contractor"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
              {f === "all" ? "All" : f === "bench" ? "On Bench" : f === "overbooked" ? "Overbooked" : "Contractors"}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} of {resources.length}</span>
      </div>

      {Object.entries(groups).sort().map(([area, areaResources]) => (
        <div key={area} className="border rounded-xl overflow-hidden">
          <div className="bg-muted/50 px-4 py-2 flex items-center gap-2">
            <Briefcase size={13} className="text-muted-foreground" />
            <h3 className="font-semibold text-sm">{PRACTICE_LABELS[area] || area}</h3>
            <span className="text-xs text-muted-foreground">({areaResources.length})</span>
          </div>
          <div className="divide-y">
            {areaResources.map(r => {
              const util = r.currentUtilization || 0;
              const target = r.utilizationTarget || 80;
              const isBench = util < 20;
              const isOver = util > 100;
              return (
                <div key={r.id} className="px-4 py-3 flex items-center gap-4 hover:bg-muted/10 transition-colors cursor-pointer" onClick={() => onSelect(r.id)}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isOver ? "bg-red-100 text-red-700" : isBench ? "bg-slate-100 text-slate-500" : "bg-blue-100 text-blue-700"}`}>
                    {r.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{r.name}</p>
                      <EmploymentBadge type={r.employmentType || "employee"} />
                      {isOver && <AlertTriangle size={12} className="text-red-500" />}
                      {isBench && <TrendingDown size={12} className="text-amber-500" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{r.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {r.location && <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={9} />{r.location}</span>}
                      {(r.skills || []).slice(0, 3).map(s => (
                        <span key={s} className="text-xs bg-muted px-1.5 py-0.5 rounded">{s}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    <UtilizationRing pct={util} />
                    {r.hourlyRate && <p className="text-xs text-muted-foreground">${r.hourlyRate}/hr</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Staffing Requests ───────────────────────────────────────────────────────
function StaffingView() {
  const { role } = useAuthRole();
  const canCreate = hasPermission(role, "createStaffingRequest");
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ requestedRole: "", projectName: "", hoursPerWeek: 40, allocationPct: 100, startDate: "", priority: "medium", notes: "" });

  const load = () => fetch(`${API}/staffing-requests`).then(r => r.json()).then(setRequests).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    await fetch(`${API}/staffing-requests`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, projectId: 1 }) });
    setShowForm(false);
    load();
  };

  const PRIORITY_COLORS: Record<string, string> = { critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" };

  const STAFFING_COLS = [
    { id: "open",        label: "Open",       colClass: "border-b-blue-500",    dot: "bg-blue-500",    cardBorder: "border-blue-500/20" },
    { id: "in_progress", label: "In Review",  colClass: "border-b-purple-500",  dot: "bg-purple-500",  cardBorder: "border-purple-500/20" },
    { id: "filled",      label: "Filled",     colClass: "border-b-emerald-500", dot: "bg-emerald-500", cardBorder: "border-emerald-500/20" },
    { id: "cancelled",   label: "Cancelled",  colClass: "border-b-zinc-500",    dot: "bg-zinc-400",    cardBorder: "border-border" },
  ];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{requests.filter(r => r.status === "open").length} open · {requests.filter(r => r.status === "in_progress").length} in review</p>
        {canCreate && (
          <button onClick={() => setShowForm(s => !s)} className="px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded-lg font-medium hover:bg-primary/90 transition-colors">+ New Request</button>
        )}
      </div>

      {showForm && (
        <div className="border rounded-xl p-4 bg-muted/20 space-y-3">
          <h3 className="font-semibold text-sm">New Staffing Request</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Role Needed *</label>
              <select value={form.requestedRole} onChange={e => setForm(f => ({ ...f, requestedRole: e.target.value }))}
                className="w-full mt-1 border rounded px-2 py-1.5 text-sm bg-background">
                <option value="">Select role...</option>
                {["OTM Functional Consultant","OTM Technical Consultant","Solution Architect","Integration Developer","QA Automation Analyst","Release Certification Analyst","AMS Support Consultant","Data Migration Lead","Project Manager"].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Project</label>
              <input value={form.projectName} onChange={e => setForm(f => ({ ...f, projectName: e.target.value }))} placeholder="Project name" className="w-full mt-1 border rounded px-2 py-1.5 text-sm bg-background" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Start Date</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="w-full mt-1 border rounded px-2 py-1.5 text-sm bg-background" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full mt-1 border rounded px-2 py-1.5 text-sm bg-background">
                {["critical","high","medium","low"].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Hrs/Week</label>
              <input type="number" value={form.hoursPerWeek} onChange={e => setForm(f => ({ ...f, hoursPerWeek: parseInt(e.target.value) }))} className="w-full mt-1 border rounded px-2 py-1.5 text-sm bg-background" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Allocation %</label>
              <input type="number" value={form.allocationPct} onChange={e => setForm(f => ({ ...f, allocationPct: parseInt(e.target.value) }))} className="w-full mt-1 border rounded px-2 py-1.5 text-sm bg-background" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full mt-1 border rounded px-2 py-1.5 text-sm bg-background resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={submit} className="px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded font-medium">Submit</button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 border text-xs rounded">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex gap-3">
          {[1,2,3,4].map(i => <div key={i} className="w-56 h-40 animate-pulse bg-muted rounded-lg shrink-0"/>)}
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {STAFFING_COLS.map(col => {
              const items = requests.filter(r => r.status === col.id);
              return (
                <div key={col.id} className="w-60 shrink-0">
                  <div className={`flex items-center justify-between mb-3 pb-2 border-b-2 ${col.colClass}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                      <span className="text-xs font-semibold">{col.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map(r => (
                      <div key={r.id} className={`rounded-lg border p-3 space-y-2 bg-card ${col.cardBorder}`}>
                        <p className="text-xs font-semibold leading-snug">{r.requestedRole}</p>
                        {r.projectName && <p className="text-xs text-muted-foreground truncate">{r.projectName}</p>}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[r.priority] || PRIORITY_COLORS.medium}`}>{r.priority}</span>
                          {r.hoursPerWeek && <span className="text-[10px] text-muted-foreground">{r.hoursPerWeek}h/wk</span>}
                          {r.allocationPct && <span className="text-[10px] text-muted-foreground">{r.allocationPct}%</span>}
                        </div>
                        {r.startDate && (
                          <p className="text-[10px] text-muted-foreground border-t border-border/50 pt-1.5">
                            Starts {format(new Date(r.startDate), "MMM d, yyyy")}
                          </p>
                        )}
                        {r.notes && <p className="text-[10px] text-muted-foreground italic line-clamp-2">{r.notes}</p>}
                      </div>
                    ))}
                    {items.length === 0 && (
                      <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                        <p className="text-xs text-muted-foreground">No requests</p>
                      </div>
                    )}
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

// ─── Risk Alerts ──────────────────────────────────────────────────────────────
function RiskView({ resources }: { resources: Resource[] }) {
  const risks = [];
  const overbooked = resources.filter(r => r.currentUtilization > 100);
  const bench = resources.filter(r => r.currentUtilization < 20);
  const nearCapacity = resources.filter(r => r.currentUtilization >= 90 && r.currentUtilization <= 100);

  overbooked.forEach(r => risks.push({ type: "over_allocation", severity: "high", resource: r, message: `${r.name} is at ${r.currentUtilization}% — over-allocated` }));
  nearCapacity.forEach(r => risks.push({ type: "near_capacity", severity: "medium", resource: r, message: `${r.name} at ${r.currentUtilization}% — near capacity limit` }));
  bench.forEach(r => risks.push({ type: "underutilized", severity: "low", resource: r, message: `${r.name} at ${r.currentUtilization}% — bench risk` }));

  const SEVERITY = { high: "bg-red-50 border-red-200 text-red-700", medium: "bg-amber-50 border-amber-200 text-amber-700", low: "bg-slate-50 border-slate-200 text-slate-600" };
  const ICON = { high: "🔴", medium: "🟡", low: "⚪" };

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Overbooked", val: overbooked.length, color: "text-red-600", bg: "bg-red-50" },
          { label: "Near Capacity", val: nearCapacity.length, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "On Bench", val: bench.length, color: "text-slate-600", bg: "bg-slate-50" },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-xl p-4 text-center border`}>
            <p className={`text-3xl font-black ${s.color}`}>{s.val}</p>
            <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>
      {risks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users size={32} className="mx-auto mb-3 opacity-30" />
          <p>No staffing risks detected.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {risks.map((risk, i) => (
            <div key={i} className={`flex items-center gap-3 border rounded-xl px-4 py-3 ${SEVERITY[risk.severity as keyof typeof SEVERITY]}`}>
              <span className="text-base">{ICON[risk.severity as keyof typeof ICON]}</span>
              <div className="flex-1">
                <p className="text-sm font-medium">{risk.message}</p>
                <p className="text-xs opacity-70">{risk.resource.title} · {PRACTICE_LABELS[risk.resource.practiceArea]}</p>
              </div>
              <EmploymentBadge type={risk.resource.employmentType || "employee"} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ResourcesList() {
  const [, navigate] = useLocation();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"roster" | "heatmap" | "risks" | "staffing">("heatmap");
  const [heatmapWeeks, setHeatmapWeeks] = useState(12);
  const [heatmapGranularity, setHeatmapGranularity] = useState<"week" | "month">("week");

  useEffect(() => {
    fetch(`${API}/resources`).then(r => r.json()).then(setResources).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const totalUtil = resources.length > 0 ? Math.round(resources.reduce((s, r) => s + r.currentUtilization, 0) / resources.length) : 0;
  const bench = resources.filter(r => r.currentUtilization < 20).length;
  const overbooked = resources.filter(r => r.currentUtilization > 100).length;
  const employees = resources.filter(r => r.employmentType === "employee").length;
  const contractors = resources.filter(r => r.employmentType !== "employee").length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4 flex-shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">People</h1>
            <p className="text-sm text-muted-foreground">{resources.length} team members · {employees} employees · {contractors} contractors/partners</p>
          </div>
          <div className="flex gap-3">
            {[
              { val: `${totalUtil}%`, label: "Avg Utilization", color: totalUtil > 90 ? "text-red-600" : totalUtil < 40 ? "text-amber-600" : "text-blue-600" },
              { val: overbooked, label: "Overbooked", color: "text-red-600" },
              { val: bench, label: "On Bench", color: "text-amber-600" },
            ].map((kpi, i) => (
              <div key={i} className="text-center px-4 py-2 bg-muted/60 rounded-xl">
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.val}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mt-3">
          {([
            { key: "heatmap", label: "Utilization Heatmap" },
            { key: "roster", label: "Resource Roster" },
            { key: "risks", label: "Staffing Risks" },
            { key: "staffing", label: "Staffing Requests" },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              {t.label}
            </button>
          ))}
          {tab === "heatmap" && (
            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center gap-1">
                {(["week", "month"] as const).map(g => (
                  <button key={g} onClick={() => setHeatmapGranularity(g)}
                    className={`px-2.5 py-1 text-xs rounded font-medium capitalize ${heatmapGranularity === g ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {g}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground opacity-50">|</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Window:</span>
                {([4, 8, 12] as const).map(w => (
                  <button key={w} onClick={() => setHeatmapWeeks(w)}
                    className={`px-2 py-1 text-xs rounded font-medium ${heatmapWeeks === w ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {w}w
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 grid grid-cols-2 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>
        ) : (
          <>
            {tab === "heatmap" && <HeatmapView weeks={heatmapWeeks} granularity={heatmapGranularity} />}
            {tab === "roster" && <RosterView resources={resources} onSelect={id => navigate(`/resources/${id}`)} />}
            {tab === "risks" && <RiskView resources={resources} />}
            {tab === "staffing" && <StaffingView />}
          </>
        )}
      </div>
    </div>
  );
}
