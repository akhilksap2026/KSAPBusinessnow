import { useState, useEffect, useMemo, useCallback } from "react";
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
  MessageSquare, Bookmark, BookmarkPlus, ChevronRight, ChevronDown,
  FolderOpen, Layers, Milestone as MilestoneIcon, X,
} from "lucide-react";
import { format } from "date-fns";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, useDroppable, useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

const API = import.meta.env.BASE_URL + "api";

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
  const res = await fetch(`${API}/tasks/${id}`, {
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
  const commentCount = task.commentCount ?? 0;

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
      {task.projectName && (
        <p className="text-xs text-muted-foreground truncate pl-6">{task.projectName}</p>
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
      <div className="flex items-center justify-between pl-6">
        {task.assignedToName && (
          <p className="text-xs text-muted-foreground">{task.assignedToName}</p>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {task.etcHours != null && (
            <span className="text-[10px] text-amber-600 font-medium">{task.etcHours}h ETC</span>
          )}
          {commentCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
              <MessageSquare className="h-2.5 w-2.5" /> {commentCount}
            </span>
          )}
        </div>
      </div>
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

  function handleDragStart({ active }: DragStartEvent) { setActiveId(active.id as number); }
  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const task = tasks.find(t => t.id === active.id);
    if (task && task.status !== over.id) onStatusChange(task.id, over.id as string);
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

type HierarchyNode = any & { children: HierarchyNode[] };

function buildHierarchy(tasks: any[]): HierarchyNode[] {
  const map: Record<number, HierarchyNode> = {};
  tasks.forEach(t => { map[t.id] = { ...t, children: [] }; });
  const roots: HierarchyNode[] = [];
  tasks.forEach(t => {
    if (t.parentId && map[t.parentId]) map[t.parentId].children.push(map[t.id]);
    else roots.push(map[t.id]);
  });
  return roots;
}

function HierarchyRow({ node, depth, onStatusChange, updatingId }: {
  node: HierarchyNode; depth: number; onStatusChange: (id:number, status:string) => Promise<void>; updatingId: number | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const sc = STATUS_CONFIG[node.status] || STATUS_CONFIG.todo;
  const pc = PRIORITY_CONFIG[node.priority] || PRIORITY_CONFIG.medium;
  const StatusIcon = sc.icon;
  const commentCount = node.commentCount ?? 0;
  const hasChildren = node.children.length > 0;

  return (
    <>
      <tr className="hover:bg-muted/30 transition-colors border-b border-border">
        <td className="px-4 py-2" style={{ paddingLeft: `${depth * 24 + 16}px` }}>
          <div className="flex items-center gap-1.5 min-w-0">
            {hasChildren ? (
              <button onClick={() => setCollapsed(v => !v)} className="p-0.5 rounded hover:bg-muted shrink-0">
                {collapsed ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
            ) : <span className="w-5 shrink-0" />}
            {node.taskType === "parent" ? <FolderOpen className="h-3.5 w-3.5 text-violet-400 shrink-0" />
              : node.taskType === "milestone" ? <MilestoneIcon className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              : <Layers className="h-3.5 w-3.5 text-blue-400 shrink-0" />}
            <span className={`text-sm truncate max-w-[260px] ${node.taskType === "parent" ? "font-semibold" : ""}`}>{node.name}</span>
            {commentCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium shrink-0">
                <MessageSquare className="h-2.5 w-2.5" /> {commentCount}
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-2 hidden lg:table-cell">
          {node.projectName ? (
            <Link href={`/projects/${node.projectId}`} className="text-xs text-muted-foreground hover:text-primary truncate max-w-[120px] block">
              {node.projectName}
            </Link>
          ) : <span className="text-muted-foreground text-xs">—</span>}
        </td>
        <td className="px-4 py-2 hidden md:table-cell">
          <span className="text-xs text-muted-foreground">{node.assignedToName || "—"}</span>
        </td>
        <td className="px-4 py-2">
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />
            <span className="text-xs text-muted-foreground">{pc.label}</span>
          </div>
        </td>
        <td className="px-4 py-2 hidden md:table-cell">
          {node.dueDate ? <span className="text-xs text-muted-foreground">{format(new Date(node.dueDate), "MMM d")}</span>
            : <span className="text-muted-foreground text-xs">—</span>}
        </td>
        <td className="px-4 py-2 hidden md:table-cell">
          {node.estimatedHours ? (
            <span className="text-xs text-muted-foreground">{node.loggedHours ?? 0}/{node.estimatedHours}h</span>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </td>
        <td className="px-4 py-2 hidden md:table-cell">
          {node.etcHours != null ? (
            <span className={`text-xs font-medium ${node.etcHours > (node.estimatedHours ?? 0) * 0.5 ? "text-amber-500" : "text-muted-foreground"}`}>
              {node.etcHours}h
            </span>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </td>
        <td className="px-4 py-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${sc.color}`}>
            <StatusIcon className="h-2.5 w-2.5" />{sc.label}
          </span>
        </td>
      </tr>
      {!collapsed && node.children.map((child: HierarchyNode) => (
        <HierarchyRow key={child.id} node={child} depth={depth + 1} onStatusChange={onStatusChange} updatingId={updatingId} />
      ))}
    </>
  );
}

export default function TasksPage() {
  const { data: tasksData, isLoading, refetch } = useListTasks();
  const { data: projects } = useListProjects();
  const [localTasks, setLocalTasks] = useState<any[]>([]);
  const [view, setView] = useState<"list" | "board" | "hierarchy">("list");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Saved filters
  const [savedFilters, setSavedFilters] = useState<any[]>([]);
  const [saveFilterName, setSaveFilterName] = useState("");
  const [showSaveFilter, setShowSaveFilter] = useState(false);
  const [selectedSavedFilter, setSelectedSavedFilter] = useState("__none__");

  useEffect(() => {
    if (tasksData) setLocalTasks(tasksData);
  }, [tasksData]);

  useEffect(() => {
    fetch(`${API}/saved-filters?resourceType=task`)
      .then(r => r.json())
      .then(data => Array.isArray(data) ? setSavedFilters(data) : setSavedFilters([]))
      .catch(() => setSavedFilters([]));
  }, []);

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

  const handleLoadSavedFilter = useCallback((filterId: string) => {
    setSelectedSavedFilter(filterId);
    if (filterId === "__none__") return;
    const sf = savedFilters.find((f: any) => String(f.id) === filterId);
    if (sf?.filterCriteria) {
      const c = typeof sf.filterCriteria === "string" ? JSON.parse(sf.filterCriteria) : sf.filterCriteria;
      if (c.status) setFilterStatus(c.status);
      if (c.priority) setFilterPriority(c.priority);
      if (c.projectId) setFilterProject(String(c.projectId));
      if (c.search) setSearch(c.search);
    }
  }, [savedFilters]);

  const handleSaveFilter = async () => {
    if (!saveFilterName.trim()) return;
    const criteria = {
      status: filterStatus !== "all" ? filterStatus : undefined,
      priority: filterPriority !== "all" ? filterPriority : undefined,
      projectId: filterProject !== "all" ? parseInt(filterProject) : undefined,
      search: search || undefined,
    };
    const res = await fetch(`${API}/saved-filters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: saveFilterName.trim(), resourceType: "task", filterCriteria: criteria, userId: 1 }),
    });
    const newFilter = await res.json();
    setSavedFilters(prev => [...prev, newFilter]);
    setSaveFilterName("");
    setShowSaveFilter(false);
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

  const hierarchyRoots = useMemo(() => buildHierarchy(filtered), [filtered]);
  const hasActiveFilters = filterStatus !== "all" || filterPriority !== "all" || filterProject !== "all" || search;

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
          <Button variant={view === "hierarchy" ? "default" : "ghost"} size="sm" onClick={() => setView("hierarchy")} className="h-7 px-2.5">
            <Layers className="h-3.5 w-3.5 mr-1.5" /> Hierarchy
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

        {/* Saved Filters */}
        {savedFilters.length > 0 && (
          <Select value={selectedSavedFilter} onValueChange={handleLoadSavedFilter}>
            <SelectTrigger className="w-[170px] h-9">
              <Bookmark className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Saved filters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Saved filters…</SelectItem>
              {savedFilters.map((sf: any) => (
                <SelectItem key={sf.id} value={String(sf.id)}>{sf.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hasActiveFilters && !showSaveFilter && (
          <button
            onClick={() => setShowSaveFilter(true)}
            className="flex items-center gap-1 h-9 px-2 text-xs text-muted-foreground hover:text-foreground rounded-md border border-dashed border-border hover:border-primary/50 transition-colors"
            title="Save current filters"
          >
            <BookmarkPlus className="h-3.5 w-3.5" /> Save
          </button>
        )}
        {showSaveFilter && (
          <div className="flex items-center gap-1">
            <Input
              value={saveFilterName}
              onChange={e => setSaveFilterName(e.target.value)}
              placeholder="Filter name…"
              className="h-9 w-36 text-sm"
              onKeyDown={e => { if (e.key === "Enter") handleSaveFilter(); if (e.key === "Escape") setShowSaveFilter(false); }}
              autoFocus
            />
            <Button size="sm" className="h-9" onClick={handleSaveFilter} disabled={!saveFilterName.trim()}>Save</Button>
            <Button size="sm" variant="ghost" className="h-9" onClick={() => setShowSaveFilter(false)}><X className="h-3.5 w-3.5" /></Button>
          </div>
        )}

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-9 text-muted-foreground"
            onClick={() => { setFilterStatus("all"); setFilterPriority("all"); setFilterProject("all"); setSearch(""); setSelectedSavedFilter("__none__"); }}>
            Clear filters
          </Button>
        )}
      </div>

      {view === "board" ? (
        <TaskBoard tasks={filtered} onStatusChange={handleStatusChange} />
      ) : view === "hierarchy" ? (
        <div className="border rounded-xl overflow-hidden bg-card">
          {hierarchyRoots.length === 0 ? (
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
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Due</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Hours</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">ETC</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {hierarchyRoots.map(node => (
                  <HierarchyRow key={node.id} node={node} depth={0} onStatusChange={handleListStatusChange} updatingId={updatingId} />
                ))}
              </tbody>
            </table>
          )}
        </div>
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
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Hours</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">ETC</th>
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
                    const commentCount = task.commentCount ?? 0;
                    return (
                      <tr key={task.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-foreground truncate max-w-[260px]">{task.name}</p>
                              {commentCount > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium shrink-0">
                                  <MessageSquare className="h-2.5 w-2.5" /> {commentCount}
                                </span>
                              )}
                            </div>
                            {task.phase && <p className="text-xs text-muted-foreground mt-0.5">{task.phase}</p>}
                            {task.blockerNote && (
                              <p className="text-xs text-destructive mt-0.5 truncate max-w-[280px]">⚠ {task.blockerNote}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {task.projectName ? (
                            <div className="flex items-center gap-2 w-fit">
                              <Link href={`/projects/${task.projectId}`} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 group">
                                <span className="truncate max-w-[140px]">{task.projectName}</span>
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
                        <td className="px-4 py-3 hidden md:table-cell">
                          {task.estimatedHours ? (
                            <span className="text-xs text-muted-foreground">{task.loggedHours ?? 0}/{task.estimatedHours}h</span>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {task.etcHours != null ? (
                            <span className={`text-xs font-medium ${task.etcHours > (task.estimatedHours ?? 0) * 0.5 ? "text-amber-500" : "text-muted-foreground"}`}>
                              {task.etcHours}h
                            </span>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
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
