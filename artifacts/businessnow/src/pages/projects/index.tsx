import { useState, useEffect, useMemo } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useListProjects } from "@workspace/api-client-react";
import { useAuthRole } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format, addMonths, startOfMonth, differenceInDays, parseISO } from "date-fns";
import { Link, useLocation } from "wouter";
import { LayoutGrid, List, GanttChartSquare, Search, X, GripVertical, Plus, Copy, FileText } from "lucide-react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, useDroppable, useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

const COLUMNS = [
  { id: "on_hold",   label: "On Hold",   colorBorder: "border-b-zinc-500",   dot: "bg-zinc-400",    cardBorder: "border-border" },
  { id: "active",    label: "Active",    colorBorder: "border-b-blue-500",   dot: "bg-blue-500",    cardBorder: "border-blue-500/20" },
  { id: "at_risk",   label: "At Risk",   colorBorder: "border-b-red-500",    dot: "bg-red-500",     cardBorder: "border-red-500/30" },
  { id: "completed", label: "Completed", colorBorder: "border-b-emerald-500",dot: "bg-emerald-500", cardBorder: "border-emerald-500/20" },
];

const STATUS_PILLS = [
  { id: "all",       label: "All" },
  { id: "active",    label: "Active",    dot: "bg-blue-500" },
  { id: "at_risk",   label: "At Risk",   dot: "bg-red-500" },
  { id: "on_hold",   label: "On Hold",   dot: "bg-zinc-400" },
  { id: "completed", label: "Completed", dot: "bg-emerald-500" },
];

const TYPE_LABELS: Record<string, string> = {
  implementation: "Implementation",
  cloud_migration: "Cloud Migration",
  ams: "AMS",
  certification: "Certification",
  rate_maintenance: "Rate Maintenance",
  data_acceleration: "Data Acceleration",
};

function HealthBar({ score, onClick }: { score: number; onClick?: (e: React.MouseEvent) => void }) {
  const color = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div
      className={`flex items-center gap-1.5 ${onClick ? "cursor-pointer group" : ""}`}
      onClick={onClick}
      title={onClick ? "Click to see health breakdown" : undefined}
    >
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className={`text-xs w-7 text-right tabular-nums ${onClick ? "text-primary group-hover:underline font-medium" : "text-muted-foreground"}`}>{score}</span>
    </div>
  );
}

function ProjectCardContent({ p, col, ghost = false }: { p: any; col: typeof COLUMNS[0]; ghost?: boolean }) {
  const burnPct = Math.round((p.consumedHours || 0) / (p.budgetHours || 1) * 100);
  return (
    <div className={`rounded-lg border p-3 space-y-2.5 bg-card ${col.cardBorder} ${ghost ? "shadow-xl rotate-1 opacity-90" : ""}`}>
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5 cursor-grab" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-foreground">{p.name}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{p.accountName}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap pl-6">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">
          {TYPE_LABELS[p.type] || p.type}
        </span>
        {p.currentPhase && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{p.currentPhase}</span>
        )}
      </div>
      {p.healthScore && (
        <div className="pl-6">
          <p className="text-[10px] text-muted-foreground mb-1">Health Score</p>
          <HealthBar score={p.healthScore} />
        </div>
      )}
      <div className="flex items-center justify-between pt-1 border-t border-border/50 pl-6">
        <span className="text-xs text-muted-foreground">Budget Used</span>
        <div className="flex items-center gap-1.5">
          {p.burnStatus === "critical" && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/50">Critical</span>
          )}
          {p.burnStatus === "warning" && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50">Warning</span>
          )}
          <span className={`text-xs font-semibold ${burnPct > 90 ? "text-red-500" : burnPct > 75 ? "text-amber-500" : "text-muted-foreground"}`}>
            {burnPct}%
          </span>
        </div>
      </div>
    </div>
  );
}

function DraggableCard({ project, col }: { project: any; col: typeof COLUMNS[0] }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: project.id });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
      <Link href={`/projects/${project.id}`}>
        <div className="hover:bg-accent/40 transition-colors rounded-lg cursor-grab active:cursor-grabbing">
          <ProjectCardContent p={project} col={col} />
        </div>
      </Link>
    </div>
  );
}

function DroppableColumn({ col, projects }: { col: typeof COLUMNS[0]; projects: any[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <div className="w-72 shrink-0">
      <div className={`flex items-center justify-between mb-3 pb-2 border-b-2 ${col.colorBorder}`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${col.dot}`} />
          <span className="text-xs font-semibold">{col.label}</span>
        </div>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{projects.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-2 min-h-[160px] rounded-lg p-1 transition-all ${isOver ? "bg-primary/5 ring-2 ring-primary/20" : ""}`}
      >
        {projects.map(p => <DraggableCard key={p.id} project={p} col={col} />)}
        {projects.length === 0 && (
          <div className={`border-2 border-dashed rounded-lg p-5 text-center transition-colors ${isOver ? "border-primary/40 bg-primary/5" : "border-border"}`}>
            <p className="text-xs text-muted-foreground">
              {isOver ? `Move here → ${col.label}` : `No ${col.label.toLowerCase()} projects`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectKanban({ projects, onStatusChange }: { projects: any[]; onStatusChange: (id: number, status: string) => Promise<void> }) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const activeProject = projects.find(p => p.id === activeId);
  const activeCol = activeProject ? COLUMNS.find(c => c.id === activeProject.status) ?? COLUMNS[1] : null;

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as number);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const project = projects.find(p => p.id === active.id);
    if (project && project.status !== over.id) {
      onStatusChange(project.id, over.id as string);
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {COLUMNS.map(col => (
            <DroppableColumn key={col.id} col={col} projects={projects.filter(p => p.status === col.id)} />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
        {activeProject && activeCol ? (
          <div className="w-72 pointer-events-none">
            <ProjectCardContent p={activeProject} col={activeCol} ghost />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

const RAG_DOT: Record<string, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

function HealthDots({ project }: { project: any }) {
  const dims = [
    { key: "healthBudget", label: "Budget" },
    { key: "healthHours", label: "Hours" },
    { key: "healthTimeline", label: "Timeline" },
    { key: "healthRisks", label: "Risks" },
  ];
  return (
    <div className="flex items-center gap-1.5">
      {dims.map(d => {
        const val = project[d.key] || "green";
        const color = RAG_DOT[val] || "bg-emerald-500";
        return (
          <div key={d.key} title={`${d.label}: ${val}`} className={`w-2 h-2 rounded-full ${color}`} />
        );
      })}
    </div>
  );
}

function ProjectTable({ projects, onCopy, onSaveTemplate }: { projects: any[]; onCopy: (id: number) => void; onSaveTemplate: (id: number, name: string) => void }) {
  const [, navigate] = useLocation();
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project Name</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Health</TableHead>
              <TableHead>Budget Used</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.id} className="cursor-pointer" onClick={() => navigate(`/projects/${project.id}`)}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-primary hover:underline">{project.name}</span>
                    {project.isInternal && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Internal</Badge>}
                  </div>
                </TableCell>
                <TableCell>{project.accountName}</TableCell>
                <TableCell className="capitalize">{(project.type || "").replace(/_/g, " ")}</TableCell>
                <TableCell>
                  <Badge variant={
                    project.status === "active" ? "default" :
                    project.status === "at_risk" ? "destructive" :
                    project.status === "completed" ? "secondary" : "outline"
                  } className="capitalize">
                    {(project.status || "").replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <HealthDots project={project} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium tabular-nums ${project.burnStatus === "critical" ? "text-red-600" : project.burnStatus === "warning" ? "text-amber-600" : ""}`}>
                      {Math.round((project.consumedHours || 0) / (project.budgetHours || 1) * 100)}%
                    </span>
                    {project.burnStatus === "critical" && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/50">Critical</span>
                    )}
                    {project.burnStatus === "warning" && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50">Warning</span>
                    )}
                  </div>
                </TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <button
                      title="Copy project"
                      onClick={() => onCopy(project.id)}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      title="Save as template"
                      onClick={() => onSaveTemplate(project.id, project.name)}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {projects.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                  No projects match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Status helpers reused in Gantt ─────────────────────────────────────────
const STATUS_BAR: Record<string, string> = {
  active:    "bg-blue-500",
  at_risk:   "bg-red-500",
  on_hold:   "bg-zinc-400",
  completed: "bg-emerald-500",
};
const STATUS_BAR_LIGHT: Record<string, string> = {
  active:    "bg-blue-100 dark:bg-blue-950/40",
  at_risk:   "bg-red-100 dark:bg-red-950/40",
  on_hold:   "bg-zinc-100 dark:bg-zinc-800/40",
  completed: "bg-emerald-100 dark:bg-emerald-950/40",
};
const MS_COLOR: Record<string, string> = {
  completed:   "bg-emerald-500 border-emerald-600",
  in_progress: "bg-blue-500 border-blue-600",
  overdue:     "bg-red-500 border-red-600",
  not_started: "bg-zinc-300 border-zinc-400 dark:bg-zinc-600 dark:border-zinc-500",
};

function datePct(d: string, start: Date, totalDays: number): number {
  return Math.max(0, Math.min(100, (differenceInDays(parseISO(d), start) / totalDays) * 100));
}

function buildMonths(start: Date, end: Date): { label: string; pctLeft: number; pctWidth: number }[] {
  const totalDays = differenceInDays(end, start) || 1;
  const months: { label: string; pctLeft: number; pctWidth: number }[] = [];
  let cursor = startOfMonth(start);
  while (cursor <= end) {
    const next = addMonths(cursor, 1);
    const mStart = cursor < start ? start : cursor;
    const mEnd   = next > end   ? end   : next;
    const pctLeft  = (differenceInDays(mStart, start) / totalDays) * 100;
    const pctWidth = (differenceInDays(mEnd, mStart) / totalDays) * 100;
    months.push({ label: format(cursor, "MMM yy"), pctLeft, pctWidth });
    cursor = next;
  }
  return months;
}

function ConsolidatedGanttView({ filterStatus, search }: { filterStatus: string; search: string }) {
  const [ganttData, setGanttData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    setLoading(true);
    fetch("/api/projects/gantt")
      .then(r => r.json())
      .then(d => { setGanttData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3 mt-2">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
      </div>
    );
  }

  if (!ganttData || !ganttData.projects?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <GanttChartSquare className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">No active projects to display</p>
        <p className="text-xs mt-1 opacity-70">Active, At Risk, and On Hold projects appear here.</p>
      </div>
    );
  }

  const tlStart = parseISO(ganttData.timelineStart);
  const tlEnd   = parseISO(ganttData.timelineEnd);
  const totalDays = differenceInDays(tlEnd, tlStart) || 1;
  const todayPct = datePct(new Date().toISOString().split("T")[0], tlStart, totalDays);
  const months = buildMonths(tlStart, tlEnd);

  const filteredProjects = ganttData.projects.filter((p: any) => {
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !(p.accountName || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (!filteredProjects.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-sm">No projects match the current filters.</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card relative">
      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none px-2.5 py-1.5 rounded-lg bg-popover border border-border shadow-lg text-xs font-medium text-popover-foreground whitespace-nowrap"
          style={{ top: tooltip.y - 36, left: tooltip.x - 60 }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Month header */}
      <div className="flex border-b border-border bg-muted/40">
        <div className="w-56 shrink-0 border-r border-border px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Project
        </div>
        <div className="flex-1 relative h-8 overflow-hidden">
          {months.map((m, i) => (
            <div
              key={i}
              className="absolute top-0 h-full flex items-center border-r border-border/50 text-[10px] text-muted-foreground font-medium px-1.5"
              style={{ left: `${m.pctLeft}%`, width: `${m.pctWidth}%` }}
            >
              <span className="truncate">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Project rows */}
      {filteredProjects.map((p: any, idx: number) => {
        const barColor  = STATUS_BAR[p.status]  || "bg-zinc-400";
        const bgColor   = STATUS_BAR_LIGHT[p.status] || "bg-zinc-50 dark:bg-zinc-900";
        const hasDates  = p.startDate && p.endDate;
        const barLeft   = hasDates ? datePct(p.startDate, tlStart, totalDays) : null;
        const barRight  = hasDates ? datePct(p.endDate,   tlStart, totalDays) : null;
        const barWidth  = hasDates && barLeft !== null && barRight !== null
          ? Math.max(barRight - barLeft, 0.5)
          : null;

        return (
          <div
            key={p.id}
            className={`flex items-center border-b border-border/50 last:border-b-0 hover:bg-muted/30 transition-colors ${idx % 2 === 1 ? "bg-muted/10" : ""}`}
          >
            {/* Label */}
            <div className="w-56 shrink-0 border-r border-border/50 px-3 py-3">
              <button
                className="text-left w-full group"
                onClick={() => navigate(`/projects/${p.id}`)}
              >
                <p className="text-xs font-semibold text-foreground leading-tight group-hover:text-primary transition-colors truncate">{p.name}</p>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">{p.accountName || ""}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${barColor}`} />
                  <span className="text-[10px] text-muted-foreground capitalize">{(p.status || "").replace("_", " ")}</span>
                  {p.healthScore !== null && (
                    <span className={`ml-1 text-[10px] font-semibold ${p.healthScore >= 80 ? "text-emerald-600" : p.healthScore >= 60 ? "text-amber-600" : "text-red-600"}`}>
                      {p.healthScore}
                    </span>
                  )}
                </div>
              </button>
            </div>

            {/* Timeline */}
            <div className="flex-1 relative h-14 overflow-visible">
              {/* Vertical month separators */}
              {months.map((m, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full border-r border-border/20"
                  style={{ left: `${m.pctLeft}%` }}
                />
              ))}

              {/* Today line */}
              <div
                className="absolute top-0 h-full w-px bg-red-500/60 z-10"
                style={{ left: `${todayPct}%` }}
              />

              {/* Project bar */}
              {hasDates && barLeft !== null && barWidth !== null && (
                <div
                  className={`absolute top-1/2 -translate-y-1/2 rounded-full h-3 ${bgColor} border border-border/50 cursor-pointer`}
                  style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
                  onClick={() => navigate(`/projects/${p.id}`)}
                  onMouseMove={e => setTooltip({ text: `${p.name}: ${p.startDate} → ${p.endDate}`, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <div className={`h-full rounded-full ${barColor} opacity-60`} style={{ width: "100%" }} />
                </div>
              )}
              {!hasDates && (
                <div className="absolute inset-0 flex items-center px-3">
                  <span className="text-[10px] text-muted-foreground/50 italic">No dates set</span>
                </div>
              )}

              {/* Milestone markers */}
              {(p.milestones || []).map((ms: any) => {
                if (!ms.dueDate) return null;
                const pct = datePct(ms.dueDate, tlStart, totalDays);
                const today = new Date().toISOString().split("T")[0];
                const isOverdue = ms.dueDate < today && ms.status !== "completed";
                const colorKey = isOverdue ? "overdue" : ms.status || "not_started";
                const dotColor = MS_COLOR[colorKey] || MS_COLOR.not_started;
                return (
                  <button
                    key={ms.id}
                    className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border z-20 ${dotColor} hover:scale-125 transition-transform`}
                    style={{ left: `${pct}%` }}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    onMouseMove={e => setTooltip({ text: `${ms.name} · ${ms.dueDate}`, x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="px-4 py-2.5 border-t border-border bg-muted/20 flex items-center gap-4 flex-wrap">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Legend</span>
        {[
          { label: "Active",    color: "bg-blue-500" },
          { label: "At Risk",   color: "bg-red-500" },
          { label: "On Hold",   color: "bg-zinc-400" },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div className={`w-3 h-1.5 rounded-full ${s.color}`} />
            <span className="text-[10px] text-muted-foreground">{s.label}</span>
          </div>
        ))}
        <div className="w-px h-3 bg-border mx-1" />
        {[
          { label: "Done",       color: "bg-emerald-500" },
          { label: "In Progress",color: "bg-blue-500" },
          { label: "Overdue",    color: "bg-red-500" },
          { label: "Planned",    color: "bg-zinc-300" },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rotate-45 border border-current ${s.color}`} style={{ borderColor: "transparent" }} />
            <span className="text-[10px] text-muted-foreground">{s.label} (milestone)</span>
          </div>
        ))}
        <div className="w-px h-3 bg-border mx-1" />
        <div className="flex items-center gap-1.5">
          <div className="w-px h-3 bg-red-500/60" />
          <span className="text-[10px] text-muted-foreground">Today</span>
        </div>
      </div>
    </div>
  );
}

const PROJECT_TYPES = [
  { value: "implementation",     label: "Implementation" },
  { value: "cloud_migration",    label: "Cloud Migration" },
  { value: "ams",                label: "AMS" },
  { value: "certification",      label: "Certification" },
  { value: "rate_maintenance",   label: "Rate Maintenance" },
  { value: "data_acceleration",  label: "Data Acceleration" },
];

function NewProjectDialog({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [, navigate] = useLocation();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [pms, setPms] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    accountId: "",
    type: "implementation",
    status: "active",
    startDate: "",
    endDate: "",
    budgetHours: "",
    budgetValue: "",
    pmId: "",
    description: "",
  });

  useEffect(() => {
    if (!open) return;
    fetch("/api/accounts").then(r => r.json()).then(setAccounts).catch(() => {});
    fetch("/api/users").then(r => r.json())
      .then((users: any[]) => setPms(users.filter(u => ["project_manager", "delivery_director", "admin"].includes(u.role))))
      .catch(() => {});
  }, [open]);

  function set(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Project name is required."); return; }
    if (!form.accountId) { setError("Please select an account."); return; }

    const account = accounts.find(a => String(a.id) === form.accountId);
    const pm = pms.find(u => String(u.id) === form.pmId);

    setSaving(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          accountId: parseInt(form.accountId),
          accountName: account?.name ?? undefined,
          type: form.type,
          status: form.status,
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
          budgetHours: form.budgetHours || undefined,
          budgetValue: form.budgetValue || undefined,
          pmId: form.pmId && form.pmId !== "__none__" ? parseInt(form.pmId) : undefined,
          pmName: pm?.name ?? undefined,
          description: form.description || undefined,
          completionPct: 0,
          healthScore: 80,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error ?? "Failed to create project.");
        return;
      }
      const project = await res.json();
      onCreated();
      onClose();
      setForm({ name: "", accountId: "", type: "implementation", status: "active", startDate: "", endDate: "", budgetHours: "", budgetValue: "", pmId: "", description: "" });
      navigate(`/projects/${project.id}`);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          <div className="space-y-1.5">
            <Label htmlFor="proj-name">Project Name <span className="text-destructive">*</span></Label>
            <Input id="proj-name" placeholder="e.g. GlobalTrans Phase 3 Implementation" value={form.name} onChange={e => set("name", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Account <span className="text-destructive">*</span></Label>
            <Select value={form.accountId} onValueChange={v => set("accountId", v)}>
              <SelectTrigger><SelectValue placeholder="Select account…" /></SelectTrigger>
              <SelectContent>
                {accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Initial Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="proj-start">Start Date</Label>
              <Input id="proj-start" type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-end">End Date</Label>
              <Input id="proj-end" type="date" value={form.endDate} onChange={e => set("endDate", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="proj-hours">Budget Hours</Label>
              <Input id="proj-hours" type="number" min={0} placeholder="e.g. 1200" value={form.budgetHours} onChange={e => set("budgetHours", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-value">Budget Value ($)</Label>
              <Input id="proj-value" type="number" min={0} placeholder="e.g. 350000" value={form.budgetValue} onChange={e => set("budgetValue", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Project Manager (optional)</Label>
            <Select value={form.pmId} onValueChange={v => set("pmId", v)}>
              <SelectTrigger><SelectValue placeholder="Assign PM…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— No PM assigned —</SelectItem>
                {pms.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proj-desc">Description (optional)</Label>
            <Textarea id="proj-desc" placeholder="Brief scope or project overview…" rows={3} value={form.description} onChange={e => set("description", e.target.value)} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create Project"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SaveAsTemplateDialog({ projectId, projectName, open, onClose }: { projectId: number; projectName: string; open: boolean; onClose: () => void }) {
  const [templateName, setTemplateName] = useState(projectName);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSave() {
    if (!templateName.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/projects/${projectId}/save-as-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateName: templateName.trim() }),
      });
      setDone(true);
      setTimeout(() => { onClose(); setDone(false); setTemplateName(projectName); }, 1200);
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Save as Template</DialogTitle></DialogHeader>
        {done ? (
          <p className="text-sm text-emerald-600 py-4 text-center font-medium">Template saved!</p>
        ) : (
          <div className="space-y-4 mt-1">
            <div className="space-y-1.5">
              <Label>Template Name</Label>
              <Input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Template name…" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !templateName.trim()}>{saving ? "Saving…" : "Save Template"}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ProjectsList() {
  const { role } = useAuthRole();
  const { data: projectsData, isLoading, refetch } = useListProjects();
  const [localProjects, setLocalProjects] = useState<any[]>([]);
  const [view, setView] = useState<"kanban" | "table" | "gantt">("kanban");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [filterStatus, setFilterStatus] = useState("all");
  const [showNewProject, setShowNewProject] = useState(false);
  const [saveTemplateFor, setSaveTemplateFor] = useState<{ id: number; name: string } | null>(null);
  const [, navigate] = useLocation();
  useEffect(() => {
    if (projectsData) setLocalProjects(projectsData);
  }, [projectsData]);

  async function handleCopyProject(id: number) {
    try {
      const res = await fetch(`/api/projects/${id}/copy`, { method: "POST" });
      const data = await res.json();
      refetch();
      if (data.id) navigate(`/projects/${data.id}`);
    } catch {}
  }

  const handleStatusChange = async (id: number, status: string) => {
    setLocalProjects(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    try {
      await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      refetch();
    } catch {
      if (projectsData) setLocalProjects(projectsData);
    }
  };

  const filtered = useMemo(() => {
    return localProjects.filter(p => {
      if (role === "client_stakeholder" && !p.isExternal) return false;
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        if (!p.name.toLowerCase().includes(q) &&
            !(p.accountName || "").toLowerCase().includes(q) &&
            !(TYPE_LABELS[p.type] || p.type || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [localProjects, filterStatus, debouncedSearch, role]);

  const counts = useMemo(() => ({
    all:       localProjects.length,
    active:    localProjects.filter(p => p.status === "active").length,
    at_risk:   localProjects.filter(p => p.status === "at_risk").length,
    on_hold:   localProjects.filter(p => p.status === "on_hold").length,
    completed: localProjects.filter(p => p.status === "completed").length,
  }), [localProjects]);

  const hasFilters = filterStatus !== "all" || search !== "";

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="flex gap-2"><Skeleton className="h-9 w-32" /><Skeleton className="h-9 w-24" /><Skeleton className="h-9 w-24" /></div>
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <>
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Projects Directory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length}{filtered.length !== localProjects.length ? ` of ${localProjects.length}` : ""} projects
            {counts.at_risk > 0 && <span className="ml-2 text-red-600 font-medium">· {counts.at_risk} at risk</span>}
            {view === "kanban" && <span className="ml-2 text-xs text-muted-foreground/70">· drag cards to change status</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" className="gap-1.5" onClick={() => setShowNewProject(true)}>
            <Plus className="h-3.5 w-3.5" /> New Project
          </Button>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button variant={view === "kanban" ? "default" : "ghost"} size="sm" onClick={() => setView("kanban")} className="h-7 px-2.5">
              <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> Kanban
            </Button>
            <Button variant={view === "table" ? "default" : "ghost"} size="sm" onClick={() => setView("table")} className="h-7 px-2.5">
              <List className="h-3.5 w-3.5 mr-1.5" /> Table
            </Button>
            <Button variant={view === "gantt" ? "default" : "ghost"} size="sm" onClick={() => setView("gantt")} className="h-7 px-2.5">
              <GanttChartSquare className="h-3.5 w-3.5 mr-1.5" /> Gantt
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-none">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search projects or accounts…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-8 w-[240px] text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {STATUS_PILLS.map(pill => {
            const count = counts[pill.id as keyof typeof counts];
            const isActive = filterStatus === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setFilterStatus(pill.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  isActive
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
                }`}
              >
                {pill.dot && <span className={`w-1.5 h-1.5 rounded-full ${pill.dot}`} />}
                {pill.label}
                {count !== undefined && (
                  <span className={`ml-0.5 ${isActive ? "text-background/70" : "text-muted-foreground/70"}`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {hasFilters && (
          <button
            onClick={() => { setSearch(""); setFilterStatus("all"); }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {view === "kanban" && (
        <ProjectKanban projects={filtered} onStatusChange={handleStatusChange} />
      )}
      {view === "table" && (
        <ProjectTable
          projects={filtered}
          onCopy={handleCopyProject}
          onSaveTemplate={(id, name) => setSaveTemplateFor({ id, name })}
        />
      )}
      {view === "gantt" && (
        <ConsolidatedGanttView filterStatus={filterStatus} search={search} />
      )}

    </div>

    <NewProjectDialog
      open={showNewProject}
      onClose={() => setShowNewProject(false)}
      onCreated={() => refetch()}
    />
    {saveTemplateFor && (
      <SaveAsTemplateDialog
        projectId={saveTemplateFor.id}
        projectName={saveTemplateFor.name}
        open={true}
        onClose={() => setSaveTemplateFor(null)}
      />
    )}
    </>
  );
}
