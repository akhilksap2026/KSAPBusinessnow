import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import {
  CheckCircle2, XCircle, ChevronLeft, Filter, RotateCcw, Clock, Users, ShieldAlert,
} from "lucide-react";
import { useAuthRole } from "@/lib/auth";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  approved:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  rejected:  "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800",
  draft:     "bg-muted text-muted-foreground border-border",
};

export default function TimesheetApprovalPage() {
  const { toast } = useToast();
  const { user } = useAuthRole();
  const approverResourceId = user?.resourceId ?? null;
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filterProject, setFilterProject] = useState("all");
  const [filterResource, setFilterResource] = useState("all");
  const [filterStatus, setFilterStatus] = useState("submitted");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState(false);
  const [collaboratorsMap, setCollaboratorsMap] = useState<Record<number, { resourceId: number; resourceName: string | null }[]>>({});

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterProject !== "all") params.set("projectId", filterProject);
    if (filterResource !== "all") params.set("resourceId", filterResource);
    if (filterStart) params.set("startDate", filterStart);
    if (filterEnd) params.set("endDate", filterEnd);

    // Load submitted + other statuses
    const url = filterStatus === "all"
      ? `${API_BASE}/timesheets`
      : filterStatus === "submitted"
        ? `${API_BASE}/timesheets/pending-approval?${params}`
        : `${API_BASE}/timesheets?status=${filterStatus}&${params}`;

    fetch(url)
      .then(r => r.json())
      .then(d => {
        const rows = Array.isArray(d) ? d : [];
        setEntries(rows);
        // TIME-06: Batch-fetch collaborators for all loaded entries
        if (rows.length > 0) {
          const ids = rows.map((r: any) => r.id).join(",");
          fetch(`${API_BASE}/timesheets/collaborators-batch?ids=${ids}`)
            .then(r => r.json())
            .then(cmap => setCollaboratorsMap(cmap ?? {}))
            .catch(() => {});
        } else {
          setCollaboratorsMap({});
        }
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [filterProject, filterResource, filterStatus, filterStart, filterEnd]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let rows = entries;
    if (filterStatus !== "all" && filterStatus !== "submitted") rows = rows.filter(r => r.status === filterStatus);
    if (filterStatus === "all") rows = rows.filter(r => r.status !== "draft");
    return rows;
  }, [entries, filterStatus]);

  const projects = useMemo(() => [...new Set(entries.map(e => e.projectName).filter(Boolean))], [entries]);
  const resources = useMemo(() => {
    const map = new Map<number, string>();
    entries.forEach(e => { if (e.resourceId && e.resourceName) map.set(e.resourceId, e.resourceName); });
    return Array.from(map.entries());
  }, [entries]);

  const useVirtual = filtered.length > 100;
  const tableParentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => tableParentRef.current,
    estimateSize: () => 56,
  });

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const submittedIds = filtered.filter(r => r.status === "submitted").map(r => r.id);
    if (selected.size === submittedIds.length) setSelected(new Set());
    else setSelected(new Set(submittedIds));
  };

  // Self-approval guard — returns true if the approver is the submitter of this entry
  const isSelfEntry = (entry: any) =>
    approverResourceId !== null && entry.resourceId === approverResourceId;

  const bulkApprove = async () => {
    if (selected.size === 0) return;
    setActing(true);
    try {
      // Filter out any self-submitted entries before sending
      const approvableIds = Array.from(selected).filter(id => {
        const entry = entries.find(e => e.id === id);
        return entry && !isSelfEntry(entry);
      });
      const blockedCount = selected.size - approvableIds.length;

      if (approvableIds.length === 0) {
        toast({ title: "Cannot self-approve", description: "You cannot approve your own timesheet submissions.", variant: "destructive" });
        return;
      }

      await fetch(`${API_BASE}/timesheets/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: approvableIds, approvedByName: user?.name ?? "Manager", approverResourceId }),
      });
      const msg = blockedCount > 0
        ? `${approvableIds.length} entries approved · ${blockedCount} skipped (self-approval blocked)`
        : `${approvableIds.length} entries approved`;
      toast({ title: msg });
      setSelected(new Set());
      load();
    } catch {
      toast({ title: "Approval failed", variant: "destructive" });
    } finally { setActing(false); }
  };

  const bulkReject = async () => {
    if (selected.size === 0 || !rejectReason.trim()) return;
    setActing(true);
    try {
      await fetch(`${API_BASE}/timesheets/reject`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), reason: rejectReason.trim() }),
      });
      toast({ title: `${selected.size} entries rejected` });
      setSelected(new Set()); setRejectOpen(false); setRejectReason("");
      load();
    } catch {
      toast({ title: "Rejection failed", variant: "destructive" });
    } finally { setActing(false); }
  };

  const singleApprove = async (id: number, entry: any) => {
    if (isSelfEntry(entry)) {
      toast({ title: "Cannot self-approve", description: "You cannot approve your own timesheet submissions.", variant: "destructive" });
      return;
    }
    setActing(true);
    try {
      await fetch(`${API_BASE}/timesheets/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id], approvedByName: user?.name ?? "Manager", approverResourceId }),
      });
      toast({ title: "Entry approved" }); load();
    } catch { toast({ title: "Failed", variant: "destructive" }); }
    finally { setActing(false); }
  };

  const singleReject = async (id: number) => {
    setActing(true);
    try {
      await fetch(`${API_BASE}/timesheets/reject`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id], reason: "Rejected by manager" }),
      });
      toast({ title: "Entry rejected" }); load();
    } catch { toast({ title: "Failed", variant: "destructive" }); }
    finally { setActing(false); }
  };

  const submittedCount = filtered.filter(r => r.status === "submitted").length;

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/timesheets">
            <button className="p-1.5 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Timesheet Approval</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {submittedCount} pending · {filtered.length} total visible
            </p>
          </div>
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{selected.size} selected</span>
            <Button size="sm" onClick={bulkApprove} disabled={acting} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Approve All
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setRejectOpen(true)} disabled={acting} className="gap-1.5">
              <XCircle className="h-3.5 w-3.5" /> Reject All
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end p-4 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 text-muted-foreground shrink-0">
          <Filter className="h-4 w-4" />
          <span className="text-sm font-medium">Filters</span>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Project</Label>
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="h-9 w-44"><SelectValue placeholder="All projects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map(p => <SelectItem key={p} value={p!}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Resource</Label>
          <Select value={filterResource} onValueChange={setFilterResource}>
            <SelectTrigger className="h-9 w-44"><SelectValue placeholder="All resources" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Resources</SelectItem>
              {resources.map(([id, name]) => <SelectItem key={id} value={String(id)}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Date From</Label>
          <Input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} className="h-9 w-36" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Date To</Label>
          <Input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} className="h-9 w-36" />
        </div>
        {(filterProject !== "all" || filterResource !== "all" || filterStart || filterEnd) && (
          <Button variant="ghost" size="sm" className="h-9 self-end text-muted-foreground gap-1.5"
            onClick={() => { setFilterProject("all"); setFilterResource("all"); setFilterStart(""); setFilterEnd(""); }}>
            <RotateCcw className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        {loading ? (
          <div className="p-6 space-y-2">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Clock className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No entries match the current filters</p>
          </div>
        ) : (
          <div
            ref={useVirtual ? tableParentRef : undefined}
            className="overflow-x-auto"
            style={useVirtual ? { overflowY: "auto", maxHeight: "600px" } : undefined}
          >
            <table className="w-full text-sm">
              <thead className={useVirtual ? "sticky top-0 z-10" : undefined}>
                <tr className="border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={selected.size === submittedCount && submittedCount > 0}
                      onChange={toggleAll}
                      className="rounded"
                    />
                  </th>
                  <th className="text-left px-3 py-3">Resource</th>
                  <th className="text-left px-3 py-3">Date</th>
                  <th className="text-left px-3 py-3">Project</th>
                  <th className="text-left px-3 py-3">Task</th>
                  <th className="text-right px-3 py-3">Hours</th>
                  <th className="text-center px-3 py-3">Billable</th>
                  <th className="text-left px-3 py-3 max-w-[200px]">Daily Comment</th>
                  <th className="text-left px-3 py-3">Billed Role</th>
                  <th className="text-center px-3 py-3">Collaborators</th>
                  <th className="text-center px-3 py-3">Status</th>
                  <th className="text-right px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody style={useVirtual ? { height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" } : undefined}>
                {(useVirtual ? rowVirtualizer.getVirtualItems().map(vr => ({ entry: filtered[vr.index], start: vr.start, key: filtered[vr.index].id })) : filtered.map((entry) => ({ entry, start: null, key: entry.id }))).map(({ entry, start, key }) => {
                  const isSelected = selected.has(entry.id);
                  const isSubmitted = entry.status === "submitted";
                  return (
                    <tr
                      key={key}
                      style={useVirtual && start !== null ? { position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${start}px)` } : undefined}
                      className={`border-b border-border/50 transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-muted/10"}`}
                    >
                      <td className="px-4 py-3">
                        {isSubmitted && (
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(entry.id)} className="rounded" />
                        )}
                      </td>
                      <td className="px-3 py-3 font-medium text-foreground">{entry.resourceName ?? "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                        {entry.entryDate ? format(parseISO(entry.entryDate), "MMM d, yyyy") : entry.weekStart ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground max-w-[140px] truncate">{entry.projectName ?? "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground max-w-[120px] truncate">{entry.taskId ? `#${entry.taskId}` : "—"}</td>
                      <td className="px-3 py-3 text-right font-semibold">{entry.hoursLogged}h</td>
                      <td className="px-3 py-3 text-center">
                        {entry.isBillable
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                          : <span className="text-muted-foreground/40 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3 max-w-[200px]">
                        <span className="text-xs text-muted-foreground truncate block">{entry.dailyComment || entry.notes || "—"}</span>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{entry.billedRole ?? "—"}</td>
                      <td className="px-3 py-3 text-center">
                        {(() => {
                          const collabs = collaboratorsMap[entry.id] ?? [];
                          if (collabs.length === 0) return <span className="text-muted-foreground/40 text-xs">—</span>;
                          return (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button className="inline-flex items-center gap-1 text-xs font-medium text-primary/80 bg-primary/10 px-2 py-0.5 rounded-full hover:bg-primary/20 transition-colors">
                                    <Users className="h-3 w-3" />
                                    +{collabs.length}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-[180px]">
                                  <p className="text-xs font-semibold mb-1">Collaborators (informational)</p>
                                  {collabs.map((c, i) => (
                                    <p key={i} className="text-xs text-muted-foreground">👥 {c.resourceName ?? `Resource #${c.resourceId}`}</p>
                                  ))}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[entry.status] ?? STATUS_COLORS.draft}`}>
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {isSubmitted && (
                          isSelfEntry(entry) ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center justify-end gap-1">
                                    <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium bg-amber-500/10 px-1.5 py-1 rounded">
                                      <ShieldAlert className="h-3 w-3 shrink-0" />
                                      Own entry
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                  <p className="text-xs">Self-approval is blocked — you cannot approve your own submissions under any role.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => singleApprove(entry.id, entry)} disabled={acting} title="Approve"
                                className="p-1 rounded hover:bg-emerald-500/10 text-emerald-500 disabled:opacity-40 transition-colors">
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                              <button onClick={() => singleReject(entry.id)} disabled={acting} title="Reject"
                                className="p-1 rounded hover:bg-red-500/10 text-red-500 disabled:opacity-40 transition-colors">
                                <XCircle className="h-4 w-4" />
                              </button>
                            </div>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={o => { if (!o) { setRejectOpen(false); setRejectReason(""); } }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Reject {selected.size} Entries</DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-2">
            <Label>Rejection Reason <span className="text-destructive">*</span></Label>
            <Textarea rows={3} placeholder="Explain why these entries are being rejected…" value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="resize-none" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={bulkReject} disabled={!rejectReason.trim() || acting}>
              {acting ? "Rejecting…" : "Reject All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
