import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckSquare, ExternalLink, Clock } from "lucide-react";
import { useAuthRole } from "@/lib/auth";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress:  "bg-blue-100 text-blue-700",
  completed:    "bg-emerald-100 text-emerald-700",
  on_hold:      "bg-amber-100 text-amber-700",
  blocked:      "bg-red-100 text-red-700",
};

export default function PortalPage() {
  const { user } = useAuthRole();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/tasks?limit=50`)
      .then(r => r.json())
      .then(d => setTasks(Array.isArray(d) ? d : []))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <ExternalLink className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Project Portal</h1>
            <p className="text-xs text-muted-foreground/70">
              {user ? `Welcome, ${user.name.split(" ")[0]}` : "External access"} · Read-only view
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-4xl">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-primary" /> Assigned Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckSquare className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-foreground">No tasks assigned</p>
                <p className="text-xs text-muted-foreground mt-1">Tasks visible to you will appear here.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs">
                    <th className="text-left p-4">Task</th>
                    <th className="text-left p-4">Project</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-right p-4">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tasks.map(t => (
                    <tr key={t.id} className="hover:bg-muted/20">
                      <td className="p-4">
                        <p className="text-xs font-medium text-foreground">{t.name || t.title}</p>
                        {t.description && <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-xs">{t.description}</p>}
                      </td>
                      <td className="p-4 text-xs text-muted-foreground">{t.projectName || "—"}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[t.status] ?? "bg-muted text-muted-foreground"}`}>
                          {t.status?.replace(/_/g, " ") ?? "unknown"}
                        </span>
                      </td>
                      <td className="p-4 text-right text-xs text-muted-foreground">
                        {t.dueDate ? (
                          <span className="flex items-center gap-1 justify-end">
                            <Clock className="h-3 w-3" />
                            {new Date(t.dueDate).toLocaleDateString()}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
