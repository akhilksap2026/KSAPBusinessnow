import { useState, useEffect, useMemo } from "react";
import { useListTasks, useListProjects } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import {
  Search, ExternalLink, Circle, Clock, AlertTriangle, CheckCircle2,
  Ban, RefreshCw, Info, Rocket, LayoutGrid, List, GripVertical,
} from "lucide-react";
import { format } from "date-fns";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, useDroppable, useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  todo:        { label: "To Do",      color: "bg-slate-100 text-slate-700 border-slate-200",       icon: Circle },
  in_progress: { label: "In Progress",color: "bg-blue-100 text-blue-700 border-blue-200",          icon: RefreshCw },
  in_review:   { label: "In Review",  color: "bg-violet-100 text-violet-700 border-violet-200",    icon: Clock },
  blocked:     { label: "Blocked",    color: "bg-red-100 text-red-700 border-red-200",             icon: AlertTriangle },
  done:        { label: "Done",       color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  cancelled:   { label: "Cancelled",  color: "bg-gray-100 text-gray-500 border-gray-200",          icon: Ban },
};

const PRIORITY_CONFIG: Record<string, { label: string; dot: string }> = {
  critical: { label: "Critical", dot: "bg-red-500" },
  high:     { label: "High",     dot: "bg-orange-500" },
  medium:   { label: "Medium",   dot: "bg-amber-400" },
  low:      { label: "Low",      dot: "bg-slate-400" },
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  todo:        ["in_progress", "cancelled"],
  in_progress: ["in_review", "blocked", "done", "todo"],
  in_review:   ["done", "in_progress", "blocked"],
  blocked:     ["in_progress", "cancelled"],
  done:        ["in_progress"],
  cancelled:   ["todo"],
};

const BOARD_COLUMNS = [
  { id: "todo",        label: "To Do",      headerColor: "border-b-slate-400",  dropBg: "bg-slate-50/50 dark:bg-slate-900/20",  isOver: "ring-slate-300" },
  { id: "in_progress", label: "In Progress",headerColor: "border-b-blue-500",   dropBg: "bg-blue-50/50 dark:bg-blue-900/20",    isOver: "ring-blue-300" },
  { id: "in_review",   label: "In Review",  headerColor: "border-b-violet-500", dropBg: "bg-violet-50/50 dark:bg-violet-900/20",isOver: "ring-violet-300" },
  { id: "blocked",     label: "Blocked",    headerColor: "border-b-red-500",    dropBg: "bg-red-50/50 dark:bg-red-900/20",      isOver: "ring-red-300" },
  { id: "done",        label: "Done",       headerColor: "border-b-emerald-500",dropBg: "bg-emerald-50/50 dark:bg-emerald-900/20",isOver: "ring-emerald-300" },
];

async function patchTask(id: number, status: string) {
  const res = await fetch(`/api/tasks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return res.json();
}

function TaskCardContent({ task, ghost = false }: { task: any; ghost?: boolean }) {
  const sc = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
  const pc = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const isOverdue = task.dueDate && task.dueDate < new Date().toISOString().split("T")[0] && task.status !== "done" && task.status !== "cancelled";

  return (
    <div className={`rounded-lg border bg-card p-3 space-y-2 ${ghost ? "shadow-xl rotate-1 opacity-95 ring-2 ring-primary/30" : "hover:shadow-sm hover:border-primary/30 transition-all"}`}>
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0 mt-0.5 cursor-grab" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground line-clamp-2">{task.name}</p>
          {task.phase && <p className="text-xs text-muted-foreground mt-0.5">{task.phase}</p>}
          {task.blockerNote && (
            <p className="text-xs text-destructive mt-0.5 truncate">⚠ {task.blockerNote}</p>
          )}
        </div>
      </div>
      {(task as any).projectName && (
        <p className="text-xs text-muted-foreground truncate pl-6">{(task as any).projectName}</p>
      )}
      <div className="flex items-center justify-between pl-6">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />
          <span className="text-xs text-muted-foreground">{pc.label}</span>
        </div>
        {task.dueDate && (
          <span className={`text-[10px] font-medium ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
            {isOverdue ? "⚠ " : ""}{format(new Date(task.dueDate), "MMM d")}
          </span>
        )}
      </div>
      {task.assignedToName && (
        <p className="text-xs text-muted-foreground pl-6">{task.assignedToName}</p>
      )}
    </div>
  );
}

function DraggableTaskCard({ task }: { task: any }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.35 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none cursor-grab active:cursor-grabbing">
      <TaskCardContent task={task} />
    </div>
  );
}

function BoardColumn({ col, tasks }: { col: typeof BOARD_COLUMNS[0]; tasks: any[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <div className="flex-1 min-w-[220px] max-w-[280px] shrink-0">
      <div className={`flex items-center justify-between mb-3 pb-2 border-b-2 ${col.headerColor}`}>
        <span className="text-xs font-semibold">{col.label}</span>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-2 min-h-[200px] rounded-lg p-1 transition-all ${isOver ? `${col.dropBg} ring-2 ${col.isOver}` : ""}`}
      >
        {tasks.map(task => <DraggableTaskCard key={task.id} task={task} />)}
        {tasks.length === 0 && (
          <div className={`border-2 border-dashed rounded-lg p-5 text-center transition-colors ${isOver ? "border-primary/40 bg-primary/5" : "border-border"}`}>
            <p className="text-xs text-muted-foreground">{isOver ? `→ ${col.label}` : "No tasks"}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskBoard({ tasks, onStatusChange }: { tasks: any[]; onStatusChange: (id: number, status: string) => Promise<void> }) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const activeTask = tasks.find(t => t.id === activeId);

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as number);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const task = tasks.find(t => t.id === active.id);
    if (task && task.status !== over.id) {
      onStatusChange(task.id, over.id as string);
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {BOARD_COLUMNS.map(col => (
            <BoardColumn key={col.id} col={col} tasks={tasks.filter(t => t.status === col.id)} />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
        {activeTask ? (
          <div className="w-[260px] pointer-events-none">
            <TaskCardContent task={activeTask} ghost />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default function TasksPage() {
  const { data: tasksData, isLoading, refetch } = useListTasks();
  const { data: projects } = useListProjects();
  const [localTasks, setLocalTasks] = useState<any[]>([]);
  const [view, setView] = useState<"list" | "board">("list");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    if (tasksData) setLocalTasks(tasksData);
  }, [tasksData]);

  const handleStatusChange = async (taskId: number, newStatus: string) => {
    setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    try {
      await patchTask(taskId, newStatus);
      refetch();
    } catch {
      if (tasksData) setLocalTasks(tasksData);
    }
  };

  const handleListStatusChange = async (taskId: number, newStatus: string) => {
    setUpdatingId(taskId);
    await handleStatusChange(taskId, newStatus);
    setUpdatingId(null);
  };

  const filtered = useMemo(() => {
    if (!localTasks) return [];
    return localTasks.filter(t => {
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      if (filterProject !== "all" && String(t.projectId) !== filterProject) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!t.name.toLowerCase().includes(s) &&
            !(t.assignedToName || "").toLowerCase().includes(s) &&
            !((t as any).projectName || "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [localTasks, filterStatus, filterPriority, filterProject, search]);

  const counts = useMemo(() => {
    if (!localTasks) return {};
    return {
      total:       localTasks.length,
      todo:        localTasks.filter(t => t.status === "todo").length,
      in_progress: localTasks.filter(t => t.status === "in_progress").length,
      blocked:     localTasks.filter(t => t.status === "blocked").length,
      done:        localTasks.filter(t => t.status === "done").length,
    };
  }, [localTasks]);

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {counts.total} tasks across all projects
            {view === "board" && <span className="ml-2 text-xs text-muted-foreground/70">· drag cards to change status</span>}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 shrink-0">
          <Button variant={view === "list" ? "default" : "ghost"} size="sm" onClick={() => setView("list")} className="h-7 px-2.5">
            <List className="h-3.5 w-3.5 mr-1.5" /> List
          </Button>
          <Button variant={view === "board" ? "default" : "ghost"} size="sm" onClick={() => setView("board")} className="h-7 px-2.5">
            <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> Board
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-900/50 px-4 py-3">
        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-300 flex-1">
          Cross-project task queue — all projects in one view. Use individual project pages for full delivery context. Click any project name below to drill in, or{" "}
          <span className="inline-flex items-center gap-0.5 font-semibold"><Rocket className="h-3 w-3" /> Command Center</span>
          {" "}for the executive view.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "To Do",       value: "todo",        count: counts.todo,        color: "text-slate-600",   bg: "bg-slate-50 border-slate-200",   ring: "ring-slate-400" },
          { label: "In Progress", value: "in_progress", count: counts.in_progress, color: "text-blue-600",    bg: "bg-blue-50 border-blue-200",     ring: "ring-blue-400" },
          { label: "Blocked",     value: "blocked",     count: counts.blocked,     color: "text-red-600",     bg: "bg-red-50 border-red-200",       ring: "ring-red-400" },
          { label: "Done",        value: "done",        count: counts.done,        color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200",ring: "ring-emerald-400" },
        ].map(s => {
          const isActive = filterStatus === s.value;
          return (
            <button
              key={s.label}
              onClick={() => setFilterStatus(isActive ? "all" : s.value)}
              className={`border rounded-xl p-4 text-left transition-all ${s.bg} ${isActive ? `ring-2 ${s.ring}` : "hover:opacity-80"}`}
            >
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.count ?? 0}</p>
              {isActive && <p className="text-[10px] text-muted-foreground mt-1">Click to clear</p>}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks, assignees, projects…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        {view === "list" && (
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects?.map((p: { id: number; name: string }) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filterStatus !== "all" || filterPriority !== "all" || filterProject !== "all" || search) && (
          <Button variant="ghost" size="sm" className="h-9 text-muted-foreground"
            onClick={() => { setFilterStatus("all"); setFilterPriority("all"); setFilterProject("all"); setSearch(""); }}>
            Clear filters
          </Button>
        )}
      </div>

      {view === "board" ? (
        <TaskBoard tasks={filtered} onStatusChange={handleStatusChange} />
      ) : (
        <>
          <div className="border rounded-xl overflow-hidden bg-card">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <p className="font-medium">No tasks match your filters</p>
                <p className="text-sm mt-1">Try adjusting the filters above</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Task</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Project</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Assignee</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Priority</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Due Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Move To</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(task => {
                    const sc = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
                    const pc = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
                    const StatusIcon = sc.icon;
                    const transitions = STATUS_TRANSITIONS[task.status] || [];
                    const isToday = task.dueDate === new Date().toISOString().split("T")[0];
                    const isOverdue = task.dueDate && task.dueDate < new Date().toISOString().split("T")[0] && task.status !== "done" && task.status !== "cancelled";
                    return (
                      <tr key={task.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate max-w-[280px]">{task.name}</p>
                            {task.phase && <p className="text-xs text-muted-foreground mt-0.5">{task.phase}</p>}
                            {task.blockerNote && (
                              <p className="text-xs text-destructive mt-0.5 truncate max-w-[280px]">⚠ {task.blockerNote}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {(task as any).projectName ? (
                            <div className="flex items-center gap-2 w-fit">
                              <Link href={`/projects/${task.projectId}`} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 group">
                                <span className="truncate max-w-[140px]">{(task as any).projectName}</span>
                                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 shrink-0" />
                              </Link>
                              <Link href={`/projects/${task.projectId}/command`} className="text-muted-foreground/50 hover:text-primary" title="Command Center">
                                <Rocket className="h-3 w-3" />
                              </Link>
                            </div>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-sm text-muted-foreground">{task.assignedToName || "Unassigned"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${pc.dot}`} />
                            <span className="text-xs text-muted-foreground">{pc.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {task.dueDate ? (
                            <span className={`text-xs font-medium ${isOverdue ? "text-destructive" : isToday ? "text-amber-600" : "text-muted-foreground"}`}>
                              {isOverdue ? "⚠ " : ""}{format(new Date(task.dueDate), "MMM d")}
                            </span>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${sc.color}`}>
                            <StatusIcon className="h-3 w-3" />
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {updatingId === task.id ? (
                            <span className="text-xs text-muted-foreground">Updating…</span>
                          ) : (
                            <div className="flex gap-1 flex-wrap">
                              {transitions.slice(0, 2).map(next => {
                                const nc = STATUS_CONFIG[next];
                                return (
                                  <button
                                    key={next}
                                    onClick={() => handleListStatusChange(task.id, next)}
                                    className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                  >
                                    → {nc.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          {filtered.length > 0 && (
            <p className="text-xs text-muted-foreground text-right">{filtered.length} of {localTasks?.length} tasks</p>
          )}
        </>
      )}
    </div>
  );
}
