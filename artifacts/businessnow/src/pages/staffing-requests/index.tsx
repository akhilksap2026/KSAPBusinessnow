import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Users, PlusCircle, RefreshCw, Calendar, Building2,
  Clock, CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { useAuthRole, hasPermission } from "@/lib/auth";

const API = "/api";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 border-blue-200",
  fulfilled: "bg-green-100 text-green-700 border-green-200",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200",
  pending: "bg-amber-100 text-amber-700 border-amber-200",
};

const PRIORITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "fulfilled") return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
  if (status === "cancelled") return <XCircle className="h-3.5 w-3.5 text-gray-400" />;
  if (status === "open") return <Clock className="h-3.5 w-3.5 text-blue-500" />;
  return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
}

export default function StaffingRequestsPage() {
  const [, setLocation] = useLocation();
  const { role } = useAuthRole();
  const canCreate = hasPermission(role, "createStaffingRequest");
  const canApprove = hasPermission(role, "approveStaffingRequest");
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [newReq, setNewReq] = useState({
    role: "", projectName: "", requiredBy: "", priority: "medium", notes: "", seniority: "", allocationPct: ""
  });

  const load = () => {
    setLoading(true);
    fetch(`${API}/staffing-requests`)
      .then(r => r.json())
      .then(d => { setRequests(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => { setRequests([]); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const filtered = requests.filter(r => {
    const matchSearch = !search || r.role?.toLowerCase().includes(search.toLowerCase()) || r.projectName?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const open = requests.filter(r => r.status === "open").length;
  const critical = requests.filter(r => r.priority === "critical" && r.status === "open").length;

  async function submitRequest() {
    if (!newReq.role || !newReq.projectName) return;
    await fetch(`${API}/staffing-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newReq,
        allocationPct: newReq.allocationPct ? parseInt(newReq.allocationPct) : 100,
        status: "open",
      }),
    });
    setCreating(false);
    setNewReq({ role: "", projectName: "", requiredBy: "", priority: "medium", notes: "", seniority: "", allocationPct: "" });
    load();
  }

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-violet-500" /> Staffing Requests
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Track open resource needs across all active projects
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={load} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          {canCreate && (
            <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
              <PlusCircle className="h-3.5 w-3.5" /> New Request
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Requests", value: requests.length, color: "text-foreground" },
          { label: "Open Requests", value: open, color: "text-blue-600" },
          { label: "Critical / Urgent", value: critical, color: "text-red-600" },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* New Request Form */}
      {creating && (
        <Card className="border-primary/30 border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">New Staffing Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Role / Skill Required *</label>
                <Input
                  className="mt-1"
                  placeholder="e.g. Senior OTM Consultant"
                  value={newReq.role}
                  onChange={e => setNewReq(p => ({ ...p, role: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Project *</label>
                <Input
                  className="mt-1"
                  placeholder="Project name"
                  value={newReq.projectName}
                  onChange={e => setNewReq(p => ({ ...p, projectName: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Required By</label>
                <Input
                  type="date"
                  className="mt-1"
                  value={newReq.requiredBy}
                  onChange={e => setNewReq(p => ({ ...p, requiredBy: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Priority</label>
                <select
                  className="mt-1 w-full border rounded-md px-3 py-1.5 text-sm bg-background"
                  value={newReq.priority}
                  onChange={e => setNewReq(p => ({ ...p, priority: e.target.value }))}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Seniority</label>
                <select
                  className="mt-1 w-full border rounded-md px-3 py-1.5 text-sm bg-background"
                  value={newReq.seniority}
                  onChange={e => setNewReq(p => ({ ...p, seniority: e.target.value }))}
                >
                  <option value="">Any</option>
                  <option value="junior">Junior</option>
                  <option value="mid">Mid-level</option>
                  <option value="senior">Senior</option>
                  <option value="lead">Lead / Principal</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Allocation %</label>
                <Input
                  type="number"
                  className="mt-1"
                  placeholder="100"
                  value={newReq.allocationPct}
                  onChange={e => setNewReq(p => ({ ...p, allocationPct: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <textarea
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background resize-none"
                rows={2}
                placeholder="Skills, certification requirements, timeline notes..."
                value={newReq.notes}
                onChange={e => setNewReq(p => ({ ...p, notes: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setCreating(false)}>Cancel</Button>
              <Button size="sm" onClick={submitRequest} disabled={!newReq.role || !newReq.projectName}>
                Submit Request
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by role or project..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex gap-1">
          {["all", "open", "pending", "fulfilled", "cancelled"].map(s => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? "default" : "ghost"}
              className="h-8 text-xs capitalize"
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No staffing requests found</p>
                <Button size="sm" className="mt-3 gap-1.5" onClick={() => setCreating(true)}>
                  <PlusCircle className="h-3.5 w-3.5" /> Create First Request
                </Button>
              </CardContent>
            </Card>
          ) : filtered.map(r => (
            <Card key={r.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="mt-0.5">
                      <StatusIcon status={r.status} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{r.role}</p>
                        {r.seniority && <Badge variant="outline" className="text-[10px] capitalize">{r.seniority}</Badge>}
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${PRIORITY_STYLES[r.priority] || ""}`}>
                          {r.priority}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />{r.projectName || "—"}
                        </span>
                        {r.requiredBy && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Need by {format(new Date(r.requiredBy), "MMM d, yyyy")}
                          </span>
                        )}
                        {r.allocationPct && (
                          <span>{r.allocationPct}% allocation</span>
                        )}
                      </div>
                      {r.notes && <p className="text-xs text-muted-foreground mt-1.5 italic">{r.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${STATUS_STYLES[r.status] || ""}`}>
                      {r.status}
                    </span>
                    {r.status === "open" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setLocation("/resources")}
                      >
                        Find Resource
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
