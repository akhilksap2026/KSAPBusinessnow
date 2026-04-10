import { Router, type IRouter } from "express";
import { db, projectsTable, milestonesTable, tasksTable, timesheetsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/digest/me", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];

  const [projects, milestones, tasks, timesheets] = await Promise.all([
    db.select().from(projectsTable),
    db.select().from(milestonesTable),
    db.select().from(tasksTable),
    db.select().from(timesheetsTable),
  ]);

  const overdueMilestones = milestones
    .filter(m => m.dueDate && m.dueDate < today && m.status !== "completed")
    .map(m => ({
      id: m.id,
      name: m.name,
      dueDate: m.dueDate,
      projectId: m.projectId,
      projectName: (projects.find(p => p.id === m.projectId) as any)?.name ?? null,
      status: m.status,
    }));

  const blockedTasks = tasks
    .filter(t => t.status === "blocked")
    .map(t => ({
      id: t.id,
      name: t.name,
      projectId: t.projectId,
      projectName: (projects.find(p => p.id === t.projectId) as any)?.name ?? null,
      blockerNote: (t as any).blockerNote ?? null,
    }));

  const activeProjects = projects.filter(p => p.status === "active" || p.status === "in_progress");
  const projectsAtRisk = activeProjects
    .filter(p => (p.healthScore ?? 100) < 65)
    .map(p => ({
      id: p.id,
      name: p.name,
      healthScore: p.healthScore,
      accountName: (p as any).accountName ?? null,
      burnStatus: (() => {
        const b = p.budgetHours ? parseFloat(p.budgetHours) : 0;
        const c = p.consumedHours ? parseFloat(p.consumedHours) : 0;
        const pct = b > 0 ? (c / b) * 100 : 0;
        return pct >= 90 ? "critical" : pct >= 75 ? "warning" : "normal";
      })(),
    }));

  const pendingTimesheets = timesheets
    .filter(t => t.status === "submitted")
    .map(t => ({
      id: t.id,
      resourceName: t.resourceName,
      projectName: t.projectName,
      weekStart: t.weekStart,
      hoursLogged: t.hoursLogged ? parseFloat(t.hoursLogged) : 0,
    }));

  const weekStart = (() => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(d);
    mon.setDate(d.getDate() + diff);
    return mon.toISOString().split("T")[0];
  })();

  res.json({
    generatedAt: new Date().toISOString(),
    weekStart,
    summary: {
      overdueMilestoneCount: overdueMilestones.length,
      blockedTaskCount: blockedTasks.length,
      projectsAtRiskCount: projectsAtRisk.length,
      pendingTimesheetCount: pendingTimesheets.length,
    },
    overdueMilestones: overdueMilestones.slice(0, 10),
    blockedTasks: blockedTasks.slice(0, 10),
    projectsAtRisk: projectsAtRisk.slice(0, 10),
    pendingTimesheets: pendingTimesheets.slice(0, 10),
  });
});

export default router;
