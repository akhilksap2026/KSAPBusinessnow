import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuthRole } from "@/lib/auth";
import {
  Search, Plus, UserCircle, Briefcase, CalendarRange,
  Clock, AlertTriangle, CheckCircle2, CircleDot, X,
} from "lucide-react";
import { format } from "date-fns";

const API = "/api";

type Priority = "critical" | "high" | "medium" | "low";
type Status = "open" | "in_review" | "fulfilled" | "cancelled";

interface StaffingRequest {
  id: number;
  projectId?: number;
  projectName?: string;
  opportunityId?: number;
  requestedRole: string;
  requiredSkills: string[];
  startDate?: string;
  endDate?: string;
  hoursPerWeek: number;
  allocationPct: number;
  priority: Priority;
  status: Status;
  notes?: string;
  requestedById?: number;
  requestedByName?: string;
  fulfilledByResourceId?: number;
  fulfilledByResourceName?: string;
  createdAt: string;
  practiceArea?: string;
}

const PRIORITY_CONFIG: Record<Priority, { label: string; className: string; icon: React.ElementType }> = {
  critical: { label: "Critical", className: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300", icon: AlertTriangle },
  high:     { label: "High",     className: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300", icon: AlertTriangle },
  medium:   { label: "Medium",   className: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300", icon: CircleDot },
  low:      { label: "Low",      className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", icon: CircleDot },
};

const STATUS_CONFIG: Record<Status, { label: string; className: string; icon: React.ElementType }> = {
  open:      { label: "Open",      className: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300", icon: CircleDot },
  in_review: { label: "In Review", className: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300", icon: Clock },
  fulfilled: { label: "Fulfilled", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground", icon: X },
};

function fmtDate(d?: string) {
  if (!d) return "—";
  try { return format(new Date(d), "MMM d, yyyy"); } catch { return d; }
}

export default function StaffingRequestsPage() {
  const [, navigate] = useLocation();
  const { role } = useAuthRole();
  const { toast } = useToast();
  const canManage = ["admin", "delivery_director", "resource_manager", "project_manager"].includes(role ?? "");

  const [requests, setRequests] = useState<StaffingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    requestedRole: "",
    practiceArea: "",
    requiredSkills: "",
    startDate: "",
    endDate: "",
    hoursPerWeek: "40",
    allocationPct: "100",
    priority: "medium" as Priority,
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetch(`${API}/staffing-requests`).then(r => r.json());
      setRequests(Array.isArray(data) ? data : []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return requests.filter(r => {
      const q = search.toLowerCase();
      if (q && !r.requestedRole.toLowerCase().includes(q) &&
          !r.projectName?.toLowerCase().includes(q) &&
          !r.practiceArea?.toLowerCase().includes(q) &&
          !(r.requiredSkills ?? []).some(s => s.toLowerCase().includes(q))) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (priorityFilter !== "all" && r.priority !== priorityFilter) return false;
      return true;
    });
  }, [requests, search, statusFilter, priorityFilter]);

  const stats = useMemo(() => ({
    open: requests.filter(r => r.status === "open").length,
    inReview: requests.filter(r => r.status === "in_review").length,
    critical: requests.filter(r => r.priority === "critical" && r.status === "open").length,
    fulfilled: requests.filter(r => r.status === "fulfilled").length,
  }), [requests]);

  const handleStatusChange = async (id: number, status: Status) => {
    try {
      await fetch(`${API}/staffing-requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await load();
      toast({ title: "Status updated" });
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    if (!form.requestedRole.trim()) return;
    setSaving(true);
    try {
      await fetch(`${API}/staffing-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedRole: form.requestedRole.trim(),
          practiceArea: form.practiceArea.trim() || null,
          requiredSkills: form.requiredSkills.split(",").map(s => s.trim()).filter(Boolean),
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          hoursPerWeek: parseInt(form.hoursPerWeek) || 40,
          allocationPct: parseInt(form.allocationPct) || 100,
          priority: form.priority,
          notes: form.notes.trim() || null,
          status: "open",
        }),
      });
      setShowNew(false);
      setForm({ requestedRole: "", practiceArea: "", requiredSkills: "", startDate: "", endDate: "", hoursPerWeek: "40", allocationPct: "100", priority: "medium", notes: "" });
      await load();
      toast({ title: "Staffing request created" });
    } catch {
      toast({ title: "Create failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staffing Requests</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Open roles and resource needs across projects</p>
        </div>
        {canManage && (
          <Button size="sm" className="gap-2" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4" /> New Request
          </Button>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Open Requests", value: stats.open, color: "text-blue-500" },
          { label: "In Review", value: stats.inReview, color: "text-violet-500" },
          { label: "Critical Priority", value: stats.critical, color: "text-red-500" },
          { label: "Fulfilled", value: stats.fulfilled, color: "text-emerald-500" },
        ].map(k => (
          <Card key={k.label} className="border border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search role, project, skills…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_review">In Review</SelectItem>
            <SelectItem value="fulfilled">Fulfilled</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={v => setPriorityFilter(v as any)}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        {(search || statusFilter !== "all" || priorityFilter !== "all") && (
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => { setSearch(""); setStatusFilter("all"); setPriorityFilter("all"); }}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} request{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="text-xs font-semibold">Role</TableHead>
              <TableHead className="text-xs font-semibold">Project</TableHead>
              <TableHead className="text-xs font-semibold">Skills</TableHead>
              <TableHead className="text-xs font-semibold">Timeline</TableHead>
              <TableHead className="text-xs font-semibold">Allocation</TableHead>
              <TableHead className="text-xs font-semibold">Priority</TableHead>
              <TableHead className="text-xs font-semibold">Status</TableHead>
              <TableHead className="text-xs font-semibold">Fulfilled By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(8)].map((_, j) => (
                    <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-48 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <UserCircle className="h-10 w-10 opacity-20" />
                    <div>
                      <p className="text-sm font-medium">No staffing requests found</p>
                      <p className="text-xs mt-0.5 opacity-70">
                        {requests.length === 0
                          ? "Create a staffing request when you need to source a resource for a project."
                          : "Try adjusting your filters."}
                      </p>
                    </div>
                    {canManage && requests.length === 0 && (
                      <Button size="sm" variant="outline" onClick={() => setShowNew(true)} className="gap-1 mt-1">
                        <Plus className="h-3.5 w-3.5" /> New Request
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : filtered.map(req => {
              const pCfg = PRIORITY_CONFIG[req.priority] || PRIORITY_CONFIG.medium;
              const sCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.open;
              const PIcon = pCfg.icon;
              const SIcon = sCfg.icon;
              return (
                <TableRow key={req.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Briefcase className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{req.requestedRole}</p>
                        {req.practiceArea && <p className="text-xs text-muted-foreground">{req.practiceArea}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {req.projectId ? (
                      <button
                        onClick={() => navigate(`/projects/${req.projectId}`)}
                        className="text-sm text-primary hover:underline underline-offset-2 text-left"
                      >
                        {req.projectName || `Project #${req.projectId}`}
                      </button>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {(req.requiredSkills ?? []).slice(0, 3).map((s, i) => (
                        <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{s}</span>
                      ))}
                      {(req.requiredSkills ?? []).length > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{req.requiredSkills.length - 3}</span>
                      )}
                      {(req.requiredSkills ?? []).length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarRange className="h-3.5 w-3.5 shrink-0" />
                      <span>{fmtDate(req.startDate)} — {fmtDate(req.endDate)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground">
                      <span>{req.allocationPct}%</span>
                      <span className="mx-1">·</span>
                      <span>{req.hoursPerWeek}h/wk</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] gap-1 font-medium border-0 ${pCfg.className}`}>
                      <PIcon className="h-2.5 w-2.5" />
                      {pCfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <Select value={req.status} onValueChange={v => handleStatusChange(req.id, v as Status)}>
                        <SelectTrigger className="h-6 w-28 text-[10px] border-0 p-0 bg-transparent">
                          <Badge className={`text-[10px] gap-1 font-medium border-0 ${sCfg.className}`}>
                            <SIcon className="h-2.5 w-2.5" />
                            {sCfg.label}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.entries(STATUS_CONFIG) as [Status, typeof STATUS_CONFIG[Status]][]).map(([k, v]) => (
                            <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className={`text-[10px] gap-1 font-medium border-0 ${sCfg.className}`}>
                        <SIcon className="h-2.5 w-2.5" />
                        {sCfg.label}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {req.fulfilledByResourceName ? (
                      <button
                        onClick={() => navigate(`/resources/${req.fulfilledByResourceId}`)}
                        className="text-xs text-primary hover:underline underline-offset-2"
                      >
                        {req.fulfilledByResourceName}
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Unfilled</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* New Request Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Staffing Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Role / Position *</Label>
                <Input
                  placeholder="e.g. OTM Functional Consultant"
                  value={form.requestedRole}
                  onChange={e => setForm(f => ({ ...f, requestedRole: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Practice Area</Label>
                <Input
                  placeholder="e.g. Implementation"
                  value={form.practiceArea}
                  onChange={e => setForm(f => ({ ...f, practiceArea: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as Priority }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End Date</Label>
                <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Hours / Week</Label>
                <Input type="number" min="1" max="40" value={form.hoursPerWeek} onChange={e => setForm(f => ({ ...f, hoursPerWeek: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Allocation %</Label>
                <Input type="number" min="10" max="100" value={form.allocationPct} onChange={e => setForm(f => ({ ...f, allocationPct: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Required Skills <span className="text-muted-foreground">(comma-separated)</span></Label>
                <Input placeholder="OTM, Groovy, SQL" value={form.requiredSkills} onChange={e => setForm(f => ({ ...f, requiredSkills: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Textarea rows={3} placeholder="Additional context for this request…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="text-sm resize-none" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !form.requestedRole.trim()}>
              {saving ? "Creating…" : "Create Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
