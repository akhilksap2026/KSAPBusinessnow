import { useState, useCallback } from "react";
import { useListMilestones } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { LayoutGrid, List, Calendar, CheckCircle, Clock, AlertTriangle, Circle, Info, Rocket, DollarSign, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { useAuthRole, hasPermission } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

const COLUMNS = [
  { id: "overdue",     label: "Overdue",     icon: AlertTriangle, color: "border-t-red-500",     dot: "bg-red-500",     bg: "bg-red-500/5" },
  { id: "pending",     label: "Pending",     icon: Circle,        color: "border-t-zinc-500",    dot: "bg-zinc-400",    bg: "bg-muted/30" },
  { id: "in_progress", label: "In Progress", icon: Clock,         color: "border-t-blue-500",    dot: "bg-blue-500",    bg: "bg-blue-500/5" },
  { id: "completed",   label: "Completed",   icon: CheckCircle,   color: "border-t-emerald-500", dot: "bg-emerald-500", bg: "bg-emerald-500/5" },
];

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "MMM d, yyyy"); } catch { return d; }
}

function fmtMoney(v: number | string | null | undefined) {
  if (!v) return null;
  const n = Number(v);
  if (isNaN(n)) return null;
  return `$${n.toLocaleString()}`;
}

function MilestoneTypeBadge({ type }: { type: string | null | undefined }) {
  if (!type || type === "project") return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">Project</span>;
  if (type === "payment") return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">Payment</span>;
  if (type === "external") return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">External</span>;
  return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">{type}</span>;
}

function CompleteMilestoneDialog({ milestone, onClose, onCompleted }: {
  milestone: any; onClose: () => void; onCompleted: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const type = milestone?.milestoneType ?? "project";

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch(`${API}/milestones/${milestone.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed", completedDate: today }),
      });
      if (!res.ok) throw new Error("Failed to complete milestone");
      toast({ title: "Milestone completed" });
      onCompleted();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  if (!milestone) return null;
  const invoiceAmount = fmtMoney(milestone.invoiceAmount);

  return (
    <Dialog open={!!milestone} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-500" /> Complete Milestone
          </DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <p className="font-semibold text-foreground">{milestone.name}</p>
          {type === "payment" && invoiceAmount && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              Mark complete and alert PM to generate invoice?<br />
              <span className="font-semibold">Invoice Amount: {invoiceAmount}</span>
            </div>
          )}
          {type === "payment" && !invoiceAmount && (
            <p className="text-sm text-muted-foreground">Mark this payment milestone as complete?</p>
          )}
          {type === "external" && (
            <p className="text-sm text-muted-foreground">Confirm customer has signed off on this milestone?</p>
          )}
          {(!type || type === "project") && (
            <p className="text-sm text-muted-foreground">Mark this milestone as complete?</p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={loading} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
            {loading ? <span className="flex items-center gap-1.5"><span className="animate-spin w-3.5 h-3.5 border border-t-transparent border-white rounded-full inline-block" />Completing…</span>
              : <><CheckCircle className="h-4 w-4" />Confirm</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MilestoneKanban({ milestones, canViewBilling, onComplete }: {
  milestones: any[]; canViewBilling: boolean; onComplete: (m: any) => void;
}) {
  const now = new Date().toISOString().split("T")[0];

  function getCol(m: any) {
    if (m.status === "completed") return "completed";
    if (m.status === "in_progress") return "in_progress";
    if (m.dueDate && m.dueDate < now && m.status !== "completed") return "overdue";
    return "pending";
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {COLUMNS.map(col => {
          const items = milestones.filter(m => getCol(m) === col.id);
          const Icon = col.icon;
          return (
            <div key={col.id} className="w-72 shrink-0">
              <div className={`flex items-center justify-between mb-3 pb-2 border-b-2 ${col.color.replace("border-t-", "border-b-")}`}>
                <div className="flex items-center gap-2">
                  <Icon className={`h-3.5 w-3.5 ${col.id === "overdue" ? "text-red-500" : col.id === "completed" ? "text-emerald-500" : col.id === "in_progress" ? "text-blue-500" : "text-muted-foreground"}`} />
                  <span className="text-xs font-semibold">{col.label}</span>
                </div>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map(m => {
                  const type = m.milestoneType ?? "project";
                  const isExternal = type === "external";
                  const isPayment = type === "payment";
                  const showBanner = isExternal && (m.status === "pending" || m.status === "in_progress" || m.status === "not_started");
                  const invoiceAmount = fmtMoney(m.invoiceAmount);
                  return (
                    <div key={m.id} className={`rounded-lg border p-3 space-y-2 ${col.id === "overdue" ? "border-red-500/30 bg-red-500/5" : col.id === "completed" ? "border-emerald-500/20 bg-emerald-500/5" : "border-border bg-card"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug">{m.name}</p>
                        <MilestoneTypeBadge type={type} />
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link href={`/projects/${m.projectId}`} className="text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline truncate">{m.projectName || `Project ${m.projectId}`}</Link>
                        <Link href={`/projects/${m.projectId}/command`} className="text-[10px] text-muted-foreground/60 hover:text-primary flex items-center gap-0.5" title="Command Center">
                          <Rocket className="h-2.5 w-2.5" />
                        </Link>
                      </div>
                      {showBanner && (
                        <div className="rounded border border-violet-200 bg-violet-50 dark:bg-violet-950/20 dark:border-violet-900/50 px-2 py-1 text-[10px] text-violet-700 dark:text-violet-300 font-medium">
                          Awaiting Customer Sign-off
                        </div>
                      )}
                      {isPayment && invoiceAmount && (
                        <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                          <DollarSign className="h-3 w-3" />
                          <span className="font-semibold">{invoiceAmount}</span>
                          <span className="text-muted-foreground">· Alert: {m.invoiceAlertSent ? "Sent" : "Not sent"}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1 border-t border-border/50">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span className={col.id === "overdue" ? "text-red-500 font-medium" : ""}>{fmtDate(m.dueDate)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {canViewBilling && m.isBillable && m.billableAmount && (
                            <span className="text-xs font-semibold text-emerald-500">{fmtMoney(m.billableAmount)}</span>
                          )}
                          {col.id !== "completed" && (
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] gap-0.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                              onClick={() => onComplete(m)}>
                              <CheckCircle className="h-3 w-3" /> Complete
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <div className="border-2 border-dashed border-border rounded-lg p-5 text-center">
                    <p className="text-xs text-muted-foreground">No milestones</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MilestoneTable({ milestones, canViewBilling, onComplete }: {
  milestones: any[]; canViewBilling: boolean; onComplete: (m: any) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Milestone Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              {canViewBilling && <TableHead>Billable Amount</TableHead>}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {milestones.map((m) => {
              const type = m.milestoneType ?? "project";
              const invoiceAmount = fmtMoney(m.invoiceAmount);
              return (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    <Link href={`/projects/${m.projectId}`} className="hover:text-primary underline-offset-2 hover:underline transition-colors">
                      {m.name}
                    </Link>
                    {type === "external" && (m.status === "pending" || m.status === "in_progress" || m.status === "not_started") && (
                      <span className="ml-2 text-[10px] text-violet-600 dark:text-violet-400 font-medium">Awaiting Sign-off</span>
                    )}
                    {type === "payment" && invoiceAmount && (
                      <span className="ml-2 text-[10px] text-amber-600 dark:text-amber-400 font-medium">{invoiceAmount}</span>
                    )}
                  </TableCell>
                  <TableCell><MilestoneTypeBadge type={type} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link href={`/projects/${m.projectId}`} className="text-sm text-muted-foreground hover:text-primary underline-offset-2 hover:underline truncate max-w-[160px]">
                        {m.projectName || `Project ${m.projectId}`}
                      </Link>
                      <Link href={`/projects/${m.projectId}/command`} className="text-muted-foreground/50 hover:text-primary flex-shrink-0" title="Command Center">
                        <Rocket className="h-3 w-3" />
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      m.status === "completed" ? "default" :
                      m.status === "overdue" ? "destructive" :
                      m.status === "at_risk" ? "destructive" :
                      m.status === "in_progress" ? "secondary" : "outline"
                    } className="capitalize">
                      {m.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{fmtDate(m.dueDate)}</TableCell>
                  {canViewBilling && (
                    <TableCell className="font-medium">
                      {m.isBillable && m.billableAmount ? fmtMoney(m.billableAmount) : "—"}
                    </TableCell>
                  )}
                  <TableCell>
                    {m.status !== "completed" && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        onClick={() => onComplete(m)}>
                        <CheckCircle className="h-3.5 w-3.5" /> Complete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {milestones.length === 0 && (
              <TableRow>
                <TableCell colSpan={canViewBilling ? 7 : 6} className="text-center h-24 text-muted-foreground">No milestones found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function MilestonesList() {
  const { data: milestones, isLoading, refetch } = useListMilestones();
  const { role } = useAuthRole();
  const canViewBilling = hasPermission(role, "viewMilestoneBilling");
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [completingMilestone, setCompletingMilestone] = useState<any | null>(null);

  const handleComplete = useCallback((m: any) => setCompletingMilestone(m), []);
  const handleCompleted = useCallback(() => { refetch(); }, [refetch]);

  if (isLoading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-[600px] w-full" /></div>;
  }

  const data = milestones ?? [];
  const overdue = (data as any[]).filter((m: any) => m.status === "overdue" || (m.dueDate && m.dueDate < new Date().toISOString().split("T")[0] && m.status !== "completed")).length;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">All Milestones</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data.length} milestones across all projects
            {overdue > 0 && <span className="ml-2 text-red-500 font-medium">· {overdue} overdue</span>}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button
            variant={view === "kanban" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("kanban")}
            className="h-7 px-2.5"
          >
            <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> Kanban
          </Button>
          <Button
            variant={view === "table" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("table")}
            className="h-7 px-2.5"
          >
            <List className="h-3.5 w-3.5 mr-1.5" /> Table
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-900/50 px-4 py-3">
        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-300 flex-1">
          Cross-project milestone management — all projects in one view.
          For project-level execution, go to{" "}
          <Link href="/projects" className="font-semibold underline underline-offset-2 hover:text-blue-600">Projects</Link>
          {" "}and open the{" "}
          <span className="inline-flex items-center gap-0.5 font-semibold"><Rocket className="h-3 w-3" /> Command Center</span>
          {" "}for each project.
        </p>
      </div>

      {view === "kanban"
        ? <MilestoneKanban milestones={data} canViewBilling={canViewBilling} onComplete={handleComplete} />
        : <MilestoneTable milestones={data} canViewBilling={canViewBilling} onComplete={handleComplete} />}

      {completingMilestone && (
        <CompleteMilestoneDialog
          milestone={completingMilestone}
          onClose={() => setCompletingMilestone(null)}
          onCompleted={handleCompleted}
        />
      )}
    </div>
  );
}
