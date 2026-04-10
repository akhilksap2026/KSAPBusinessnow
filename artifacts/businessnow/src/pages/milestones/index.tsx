import { useState } from "react";
import { useListMilestones } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { LayoutGrid, List, Calendar, CheckCircle, Clock, AlertTriangle, Circle, Info, Rocket } from "lucide-react";
import { Link } from "wouter";
import { useAuthRole, hasPermission } from "@/lib/auth";

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

function MilestoneKanban({ milestones, canViewBilling }: { milestones: any[]; canViewBilling: boolean }) {
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
                {items.map(m => (
                  <div key={m.id} className={`rounded-lg border p-3 space-y-2 ${col.id === "overdue" ? "border-red-500/30 bg-red-500/5" : col.id === "completed" ? "border-emerald-500/20 bg-emerald-500/5" : "border-border bg-card"}`}>
                    <p className="text-sm font-medium leading-snug">{m.name}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Link href={`/projects/${m.projectId}`} className="text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline truncate">{m.projectName || `Project ${m.projectId}`}</Link>
                      <Link href={`/projects/${m.projectId}/command`} className="text-[10px] text-muted-foreground/60 hover:text-primary flex items-center gap-0.5" title="Command Center">
                        <Rocket className="h-2.5 w-2.5" />
                      </Link>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span className={col.id === "overdue" ? "text-red-500 font-medium" : ""}>{fmtDate(m.dueDate)}</span>
                      </div>
                      {canViewBilling && m.isBillable && m.billableAmount && (
                        <span className="text-xs font-semibold text-emerald-500">${Number(m.billableAmount).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                ))}
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

function MilestoneTable({ milestones, canViewBilling }: { milestones: any[]; canViewBilling: boolean }) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Milestone Name</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              {canViewBilling && <TableHead>Billable Amount</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {milestones.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">
                  <Link href={`/projects/${m.projectId}`} className="hover:text-primary underline-offset-2 hover:underline transition-colors">
                    {m.name}
                  </Link>
                </TableCell>
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
                    {m.isBillable && m.billableAmount ? `$${Number(m.billableAmount).toLocaleString()}` : "—"}
                  </TableCell>
                )}
              </TableRow>
            ))}
            {milestones.length === 0 && (
              <TableRow>
                <TableCell colSpan={canViewBilling ? 5 : 4} className="text-center h-24 text-muted-foreground">No milestones found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function MilestonesList() {
  const { data: milestones, isLoading } = useListMilestones();
  const { role } = useAuthRole();
  const canViewBilling = hasPermission(role, "viewMilestoneBilling");
  const [view, setView] = useState<"kanban" | "table">("kanban");

  if (isLoading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-[600px] w-full" /></div>;
  }

  const data = milestones ?? [];
  const overdue = data.filter(m => m.status === "overdue" || (m.dueDate && m.dueDate < new Date().toISOString().split("T")[0] && m.status !== "completed")).length;

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

      {/* Cross-project view notice */}
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

      {view === "kanban" ? <MilestoneKanban milestones={data} canViewBilling={canViewBilling} /> : <MilestoneTable milestones={data} canViewBilling={canViewBilling} />}
    </div>
  );
}
