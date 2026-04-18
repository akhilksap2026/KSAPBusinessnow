import { Router, type IRouter } from "express";
import { eq, inArray, and, lte, desc, sql } from "drizzle-orm";
import { db, projectsTable, milestonesTable, tasksTable, phasesTable, allocationsTable, changeRequestsTable, activityLogsTable, resourcesTable, taskDependenciesTable, timesheetsTable, fxRatesTable, usersTable, projectBaselinesTable, baselineTasksTable } from "@workspace/db";
import { scheduleProject } from "../lib/scheduler";

const BASE_CURRENCY = "CAD";
const today = () => new Date().toISOString().slice(0, 10);

async function fxConvert(amount: number, fromCurrency: string, date: string): Promise<number | null> {
  if (!fromCurrency || fromCurrency === BASE_CURRENCY) return amount;
  const rows = await db.select().from(fxRatesTable)
    .where(and(
      eq(fxRatesTable.fromCurrency, fromCurrency),
      eq(fxRatesTable.toCurrency, BASE_CURRENCY),
      lte(fxRatesTable.effectiveDate, date),
    ))
    .orderBy(desc(fxRatesTable.effectiveDate))
    .limit(1);
  if (rows.length === 0) {
    console.warn(`[FX] No rate for ${fromCurrency}→${BASE_CURRENCY} on ${date}`);
    return null;
  }
  return amount * parseFloat(rows[0].rate);
}

function computeBurnStatus(consumedHours: number | null, budgetHours: number | null): "normal" | "warning" | "critical" {
  if (!budgetHours || budgetHours === 0 || consumedHours === null || consumedHours === undefined) return "normal";
  const pct = (consumedHours / budgetHours) * 100;
  if (pct >= 90) return "critical";
  if (pct >= 75) return "warning";
  return "normal";
}

function parseProject(p: typeof projectsTable.$inferSelect) {
  const budgetHours = p.budgetHours ? parseFloat(p.budgetHours) : null;
  const consumedHours = p.consumedHours ? parseFloat(p.consumedHours) : null;
  return {
    ...p,
    budgetHours,
    consumedHours,
    budgetValue: p.budgetValue ? parseFloat(p.budgetValue) : null,
    billedValue: p.billedValue ? parseFloat(p.billedValue) : null,
    burnStatus: computeBurnStatus(consumedHours, budgetHours),
  };
}

function parseMilestone(m: typeof milestonesTable.$inferSelect) {
  return { ...m, billableAmount: m.billableAmount ? parseFloat(m.billableAmount) : null };
}

function parseTask(t: typeof tasksTable.$inferSelect) {
  return {
    ...t,
    estimatedHours: t.estimatedHours ? parseFloat(t.estimatedHours) : null,
    loggedHours: t.loggedHours ? parseFloat(t.loggedHours) : null,
  };
}

function computeSpI(project: any): { spi: number; plannedProgressPct: number; actualProgressPct: number; timelineScore: number } {
  const today = new Date().toISOString().split("T")[0];
  const completionPct = project.completionPct || 0;
  const actualProgressPct = completionPct / 100;

  // No dates → cannot compute SPI, assume on track
  if (!project.startDate || !project.endDate) {
    return { spi: 1, plannedProgressPct: 0, actualProgressPct, timelineScore: 1 };
  }

  const startMs = new Date(project.startDate).getTime();
  const endMs = new Date(project.endDate).getTime();
  const todayMs = new Date(today).getTime();

  const totalDuration = endMs - startMs;

  // Project not yet started
  if (todayMs <= startMs || totalDuration <= 0) {
    return { spi: 1, plannedProgressPct: 0, actualProgressPct, timelineScore: 1 };
  }

  // How far through the calendar should we be? Clamp 0–1.
  const rawPlanned = (todayMs - startMs) / totalDuration;
  const plannedProgressPct = Math.min(1, Math.max(0, rawPlanned));

  // SPI: ratio of actual to planned (if plannedProgressPct = 0, spi = 1)
  const spi = plannedProgressPct === 0 ? 1 : actualProgressPct / plannedProgressPct;

  // Convert SPI to 0–1 health score (25% weight)
  // SPI >= 1.0 → on or ahead → 1.0
  // SPI 0.8–1.0 → slightly behind → scale 0.5–1.0
  // SPI < 0.8 → significantly behind → heavy penalty
  const timelineScore = spi >= 1.0
    ? 1.0
    : spi >= 0.8
      ? 0.5 + (spi - 0.8) * 2.5
      : spi * 0.5;

  return { spi: Math.round(spi * 100) / 100, plannedProgressPct, actualProgressPct, timelineScore };
}

function computeHealth(project: any, milestones: any[], tasks: any[]) {
  let score = 100;
  const reasons: { label: string; impact: number; severity: string }[] = [];
  const today = new Date().toISOString().split("T")[0];

  // ── Timeline dimension (25% weight = up to 25 pts) ─────────────────────────
  const { spi, plannedProgressPct, actualProgressPct, timelineScore } = computeSpI(project);
  if (timelineScore < 1.0) {
    const impact = Math.round((1 - timelineScore) * 25);
    if (impact > 0) {
      score -= impact;
      const severity = timelineScore < 0.5 ? "high" : timelineScore < 0.8 ? "medium" : "low";
      reasons.push({ label: `Schedule SPI ${spi.toFixed(2)} — ${Math.round(actualProgressPct * 100)}% complete vs ${Math.round(plannedProgressPct * 100)}% planned`, impact, severity });
    }
  }

  const overdue = milestones.filter((m) => m.dueDate && m.dueDate < today && !["completed"].includes(m.status));
  if (overdue.length > 0) {
    const impact = Math.min(overdue.length * 12, 30);
    score -= impact;
    reasons.push({ label: `${overdue.length} overdue milestone${overdue.length > 1 ? "s" : ""}`, impact, severity: overdue.length > 2 ? "high" : "medium" });
  }

  const budgetHours = parseFloat(project.budgetHours || "0");
  const consumedHours = parseFloat(project.consumedHours || "0");
  const completionPct = project.completionPct || 0;
  if (budgetHours > 0) {
    const burnRate = (consumedHours / budgetHours) * 100;
    if (burnRate > completionPct + 20 && burnRate > 40) {
      const impact = 12;
      score -= impact;
      reasons.push({ label: `Budget burn ${Math.round(burnRate)}% vs ${completionPct}% completion`, impact, severity: "medium" });
    }
  }

  const blockedTasks = tasks.filter((t) => t.status === "blocked");
  if (blockedTasks.length > 0) {
    const impact = Math.min(blockedTasks.length * 8, 20);
    score -= impact;
    reasons.push({ label: `${blockedTasks.length} blocked task${blockedTasks.length > 1 ? "s" : ""}`, impact, severity: "high" });
  }

  const overdueClientActions = tasks.filter((t) => t.isClientAction && t.status !== "done" && t.dueDate && t.dueDate < today);
  if (overdueClientActions.length > 0) {
    const impact = Math.min(overdueClientActions.length * 8, 16);
    score -= impact;
    reasons.push({ label: `${overdueClientActions.length} overdue client action${overdueClientActions.length > 1 ? "s" : ""}`, impact, severity: "high" });
  }

  const pendingApprovals = milestones.filter((m) => m.approvalStatus === "pending");
  if (pendingApprovals.length > 0) {
    const impact = 8;
    score -= impact;
    reasons.push({ label: `${pendingApprovals.length} milestone${pendingApprovals.length > 1 ? "s" : ""} pending approval`, impact, severity: "medium" });
  }

  if (!project.kickoffComplete && project.status === "active") {
    score -= 5;
    reasons.push({ label: "Kickoff not marked complete", impact: 5, severity: "low" });
  }

  const finalScore = Math.max(0, Math.min(100, score));
  const color = finalScore >= 80 ? "green" : finalScore >= 60 ? "yellow" : "red";
  return { score: finalScore, color, reasons, spi, plannedProgressPct, actualProgressPct, timelineScore };
}

async function resolveResourceId(dbUserId: number): Promise<number | null> {
  const [resource] = await db
    .select({ id: resourcesTable.id })
    .from(resourcesTable)
    .where(eq(resourcesTable.userId, dbUserId))
    .limit(1);
  return resource?.id ?? null;
}

const router: IRouter = Router();

router.get("/projects", async (req, res): Promise<void> => {
  const { status, type, accountId, pmId, isAdministrative, contextUserId } = req.query as Record<string, string>;
  let projects = await db.select().from(projectsTable).orderBy(projectsTable.createdAt);
  if (status) projects = projects.filter((p) => p.status === status);
  if (type) projects = projects.filter((p) => p.type === type);
  if (accountId) projects = projects.filter((p) => p.accountId === parseInt(accountId));

  // contextUserId: DB user ID — resolve to resource ID then filter by pmId
  const effectivePmFilter = pmId || (contextUserId ? await resolveResourceId(parseInt(contextUserId, 10)) : null);
  if (effectivePmFilter) projects = projects.filter((p) => p.pmId === parseInt(String(effectivePmFilter)));

  if (isAdministrative !== undefined) {
    const flag = isAdministrative === "true";
    projects = projects.filter((p) => !!(p as any).isAdministrative === flag);
  }
  res.json(projects.map(parseProject));
});

router.post("/projects", async (req, res): Promise<void> => {
  const { name, accountId, type, ...rest } = req.body;
  if (!name || !accountId) { res.status(400).json({ error: "name and accountId required" }); return; }
  const [project] = await db.insert(projectsTable).values({ name, accountId: parseInt(accountId), type: type || "implementation", ...rest }).returning();
  res.status(201).json(parseProject(project));
});

// ─── Consolidated Gantt — ALL active/at_risk/on_hold projects ─────────────────
router.get("/projects/gantt", async (req, res): Promise<void> => {
  const allProjects = await db.select().from(projectsTable).orderBy(projectsTable.startDate);
  const planningProjects = allProjects.filter(p => ["active", "at_risk", "on_hold"].includes(p.status as string));

  // Fetch milestones for all these projects in one query
  const projectIds = planningProjects.map(p => p.id);
  const allMilestones = projectIds.length > 0
    ? await db.select().from(milestonesTable).where(inArray(milestonesTable.projectId, projectIds))
    : [];

  const milestonesByProject: Record<number, typeof milestonesTable.$inferSelect[]> = {};
  for (const ms of allMilestones) {
    if (!milestonesByProject[ms.projectId]) milestonesByProject[ms.projectId] = [];
    milestonesByProject[ms.projectId].push(ms);
  }

  // Compute global timeline bounds
  const allDates: number[] = [];
  const tryDate = (d: string | null | undefined) => { if (d) { const t = new Date(d).getTime(); if (!isNaN(t)) allDates.push(t); } };

  for (const p of planningProjects) {
    tryDate(p.startDate);
    tryDate(p.endDate);
    tryDate(p.goLiveDate);
  }
  for (const ms of allMilestones) {
    tryDate(ms.dueDate);
  }

  const today = new Date();
  const rawStart = allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const rawEnd   = allDates.length > 0 ? new Date(Math.max(...allDates)) : new Date(today.getFullYear(), today.getMonth() + 5, 1);

  // Ensure at least 3 months shown
  const minEnd = new Date(rawStart.getTime() + 90 * 86400000);
  const effectiveEnd = rawEnd > minEnd ? rawEnd : minEnd;

  // Pad 3%
  const span = effectiveEnd.getTime() - rawStart.getTime();
  const pad = Math.max(span * 0.03, 10 * 86400000);
  const timelineStart = new Date(rawStart.getTime() - pad).toISOString().split("T")[0];
  const timelineEnd   = new Date(effectiveEnd.getTime() + pad).toISOString().split("T")[0];

  const projects = planningProjects.map(p => {
    const parsed = parseProject(p);
    const milestones = (milestonesByProject[p.id] || []).map(m => ({
      id:     m.id,
      name:   m.name,
      dueDate: m.dueDate || null,
      status: m.status,
    }));
    return {
      id:          p.id,
      name:        p.name,
      status:      p.status,
      type:        p.type,
      accountName: (p as any).accountName ?? null,
      startDate:   p.startDate ?? null,
      endDate:     p.goLiveDate ?? p.endDate ?? null,
      healthScore: (p as any).healthScore ?? null,
      milestones,
    };
  });

  res.json({ projects, timelineStart, timelineEnd });
});

router.get("/projects/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  res.json(parseProject(project));
});

router.get("/projects/:id/full", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const [phases, milestones, tasks, allocations, changeRequests, activity] = await Promise.all([
    db.select().from(phasesTable).where(eq(phasesTable.projectId, id)),
    db.select().from(milestonesTable).where(eq(milestonesTable.projectId, id)),
    db.select().from(tasksTable).where(eq(tasksTable.projectId, id)),
    db.select().from(allocationsTable).where(eq(allocationsTable.projectId, id)),
    db.select().from(changeRequestsTable).where(eq(changeRequestsTable.projectId, id)),
    db.select().from(activityLogsTable).where(eq(activityLogsTable.entityId, id)),
  ]);

  const parsedMilestones = milestones.map(parseMilestone);
  const parsedTasks = tasks.map(parseTask);
  const health = computeHealth(project, parsedMilestones, parsedTasks);

  const today = new Date().toISOString().split("T")[0];
  const alerts: { type: string; message: string; severity: string }[] = [];

  milestones.filter((m) => m.dueDate && m.dueDate < today && m.status !== "completed")
    .forEach((m) => alerts.push({ type: "overdue_milestone", message: `"${m.name}" is overdue`, severity: "high" }));

  tasks.filter((t) => t.status === "blocked")
    .forEach((t) => alerts.push({ type: "blocker", message: `Blocker: ${(t as any).blockerNote || t.name}`, severity: "high" }));

  tasks.filter((t) => (t as any).isClientAction && t.status !== "done" && t.dueDate && t.dueDate < today)
    .forEach((t) => alerts.push({ type: "client_delay", message: `Client action overdue: "${t.name}"`, severity: "high" }));

  milestones.filter((m) => (m as any).approvalStatus === "pending")
    .forEach((m) => alerts.push({ type: "approval_needed", message: `Awaiting approval: "${m.name}"`, severity: "medium" }));

  const openCRs = changeRequests.filter((cr) => cr.status === "pending_review");
  if (openCRs.length > 0) alerts.push({ type: "change_request", message: `${openCRs.length} open change request${openCRs.length > 1 ? "s" : ""}`, severity: "medium" });

  const budgetHours = parseFloat(project.budgetHours || "0");
  const consumedHours = parseFloat(project.consumedHours || "0");
  const burnRate = budgetHours > 0 ? (consumedHours / budgetHours) * 100 : 0;
  if (burnRate > (project.completionPct || 0) + 25 && burnRate > 40) {
    alerts.push({ type: "budget_risk", message: `Budget ${Math.round(burnRate)}% burned vs ${project.completionPct}% done`, severity: "high" });
  }

  const nextMilestone = parsedMilestones
    .filter((m) => m.status !== "completed" && m.dueDate)
    .sort((a, b) => (a.dueDate! > b.dueDate! ? 1 : -1))[0] || null;

  const billingQueue = parsedMilestones.filter((m) => m.isBillable && !m.invoiced && m.status === "completed");

  // Build task tree
  interface TaskNode { [key: string]: any; children: TaskNode[] }
  const taskMap: Record<number, TaskNode> = {};
  parsedTasks.forEach(t => { taskMap[t.id] = { ...t, children: [] }; });
  const taskTree: TaskNode[] = [];
  parsedTasks.forEach(t => {
    if (t.parentId && taskMap[t.parentId]) {
      taskMap[t.parentId].children.push(taskMap[t.id]);
    } else {
      taskTree.push(taskMap[t.id]);
    }
  });

  res.json({
    project: parseProject(project),
    phases: phases.sort((a, b) => a.sequence - b.sequence),
    milestones: parsedMilestones,
    tasks: parsedTasks,
    taskTree,
    allocations,
    changeRequests,
    activity: activity.slice(0, 20),
    health,
    alerts,
    nextMilestone,
    billingQueue,
    budgetBurn: {
      burnRate: Math.round(burnRate),
      consumedHours: Math.round(consumedHours),
      budgetHours: Math.round(budgetHours),
      budgetValue: parseFloat(project.budgetValue || "0"),
      billedValue: parseFloat(project.billedValue || "0"),
    },
  });
});

router.get("/projects/:id/health-explainer", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const [milestones, tasks] = await Promise.all([
    db.select().from(milestonesTable).where(eq(milestonesTable.projectId, id)),
    db.select().from(tasksTable).where(eq(tasksTable.projectId, id)),
  ]);

  const parsedMilestones = milestones.map(parseMilestone);
  const parsedTasks = tasks.map(parseTask);
  const { score, spi, plannedProgressPct, actualProgressPct, timelineScore } = computeHealth(project, parsedMilestones, parsedTasks);

  const today = new Date().toISOString().split("T")[0];
  const budgetHours = parseFloat(project.budgetHours || "0");
  const consumedHours = parseFloat(project.consumedHours || "0");
  const completionPct = project.completionPct || 0;
  const burnRate = budgetHours > 0 ? Math.round((consumedHours / budgetHours) * 100) : 0;

  const overdueMilestones = parsedMilestones.filter(m => m.dueDate && m.dueDate < today && m.status !== "completed");
  const blockedTasks = parsedTasks.filter(t => t.status === "blocked");
  const overdueClientActions = parsedTasks.filter(t => t.isClientAction && t.status !== "done" && t.dueDate && t.dueDate < today);
  const pendingApprovals = parsedMilestones.filter(m => (m as any).approvalStatus === "pending");

  const totalMs = parsedMilestones.length;
  const completedMs = parsedMilestones.filter(m => m.status === "completed").length;
  const msProgressPct = totalMs > 0 ? Math.round((completedMs / totalMs) * 100) : 100;

  const budgetHealthVal = budgetHours === 0 ? 100
    : burnRate <= completionPct + 10 ? 100
    : Math.max(0, 100 - (burnRate - completionPct - 10) * 2);

  const timelineFactorValue = Math.round(timelineScore * 100);
  const timelineStatus: "good" | "warning" | "critical" =
    timelineScore >= 1.0 ? "good" : timelineScore >= 0.8 ? "warning" : "critical";
  const plannedPct = Math.round(plannedProgressPct * 100);
  const actualPct = Math.round(actualProgressPct * 100);

  const factors = [
    {
      label: `Timeline: Planned progress ${plannedPct}% vs. Actual progress ${actualPct}% — SPI: ${spi.toFixed(2)}`,
      value: timelineFactorValue,
      status: timelineStatus,
    },
    {
      label: "Milestone Progress",
      value: msProgressPct,
      status: (msProgressPct >= 60 ? "good" : msProgressPct >= 30 ? "warning" : "critical") as "good" | "warning" | "critical",
    },
    {
      label: "Budget Health",
      value: Math.round(budgetHealthVal),
      status: (budgetHealthVal >= 80 ? "good" : budgetHealthVal >= 50 ? "warning" : "critical") as "good" | "warning" | "critical",
    },
    {
      label: "Task Flow",
      value: blockedTasks.length === 0 ? 100 : Math.max(0, 100 - blockedTasks.length * 20),
      status: (blockedTasks.length === 0 ? "good" : blockedTasks.length <= 2 ? "warning" : "critical") as "good" | "warning" | "critical",
    },
    {
      label: "Client Actions",
      value: overdueClientActions.length === 0 ? 100 : Math.max(0, 100 - overdueClientActions.length * 25),
      status: (overdueClientActions.length === 0 ? "good" : "critical") as "good" | "warning" | "critical",
    },
    {
      label: "Approvals",
      value: pendingApprovals.length === 0 ? 100 : Math.max(0, 100 - pendingApprovals.length * 20),
      status: (pendingApprovals.length === 0 ? "good" : "warning") as "good" | "warning" | "critical",
    },
  ];

  const reasons: string[] = [];
  if (overdueMilestones.length > 0) {
    const names = overdueMilestones.slice(0, 2).map(m => m.name).join(", ");
    reasons.push(`${overdueMilestones.length} milestone${overdueMilestones.length > 1 ? "s are" : " is"} overdue: ${names}${overdueMilestones.length > 2 ? ` +${overdueMilestones.length - 2} more` : ""}`);
  }
  if (budgetHours > 0 && burnRate > completionPct + 15) {
    reasons.push(`Budget burn (${burnRate}%) is running ${burnRate - completionPct}% ahead of project completion (${completionPct}%)`);
  }
  if (blockedTasks.length > 0) {
    reasons.push(`${blockedTasks.length} task${blockedTasks.length > 1 ? "s are" : " is"} blocked and slowing delivery`);
  }
  if (overdueClientActions.length > 0) {
    reasons.push(`${overdueClientActions.length} overdue client action${overdueClientActions.length > 1 ? "s" : ""} — client input required`);
  }
  if (pendingApprovals.length > 0) {
    reasons.push(`${pendingApprovals.length} milestone${pendingApprovals.length > 1 ? "s are" : " is"} waiting for approval`);
  }
  if (reasons.length === 0) {
    reasons.push("All key indicators are on track — project is healthy");
  }

  const recommendedActions: string[] = [];
  if (overdueMilestones.length > 0) {
    recommendedActions.push(`Review and re-schedule the ${overdueMilestones.length} overdue milestone${overdueMilestones.length > 1 ? "s" : ""} in the next team meeting`);
  }
  if (budgetHours > 0 && burnRate > completionPct + 15) {
    recommendedActions.push("Initiate a scope or resource review to prevent budget over-run");
  }
  if (blockedTasks.length > 0) {
    recommendedActions.push(`Resolve ${blockedTasks.length} blocked task${blockedTasks.length > 1 ? "s" : ""} — assign owners and escalate in the next stand-up`);
  }
  if (overdueClientActions.length > 0) {
    recommendedActions.push("Chase client for outstanding actions — consider escalating to account manager");
  }
  if (pendingApprovals.length > 0) {
    recommendedActions.push("Send reminder to approvers for pending milestone sign-offs");
  }
  if (!project.kickoffComplete && project.status === "active") {
    recommendedActions.push("Mark kickoff as complete to unlock full project tracking");
  }
  if (recommendedActions.length === 0) {
    recommendedActions.push("Continue current delivery cadence", "Keep client updated with regular status reports");
  }

  res.json({
    score,
    factors,
    reasons: reasons.slice(0, 3),
    recommendedActions: recommendedActions.slice(0, 3),
  });
});

router.get("/projects/:id/presentation", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const [phases, milestones, tasks] = await Promise.all([
    db.select().from(phasesTable).where(eq(phasesTable.projectId, id)),
    db.select().from(milestonesTable).where(eq(milestonesTable.projectId, id)),
    db.select().from(tasksTable).where(eq(tasksTable.projectId, id)),
  ]);

  res.json({
    project: parseProject(project),
    phases: phases.sort((a, b) => a.sequence - b.sequence),
    milestones: milestones.map(parseMilestone),
    clientActions: tasks.map(parseTask).filter((t) => t.isClientAction),
    generatedAt: new Date().toISOString(),
  });
});

router.put("/projects/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { id: _id, createdAt, updatedAt, ...updates } = req.body;

  // ── Closure Gate guard ────────────────────────────────────────────────────
  if (updates.status === "completed") {
    const [existing] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }

    const actualDate = updates.actualCompletionDate ?? existing.actualCompletionDate;
    const rating = updates.performanceRating ?? existing.performanceRating;

    if (!actualDate) {
      res.status(400).json({ error: "CLOSURE_GATE", message: "Actual completion date is required before marking a project complete." });
      return;
    }
    if (!rating) {
      res.status(400).json({ error: "CLOSURE_GATE", message: "Performance rating (1–5) is required before marking a project complete." });
      return;
    }

    const pendingTs = await db.select({ id: timesheetsTable.id })
      .from(timesheetsTable)
      .where(and(eq(timesheetsTable.projectId, id), inArray(timesheetsTable.status, ["draft", "submitted"])));
    if (pendingTs.length > 0) {
      res.status(400).json({ error: "CLOSURE_GATE", message: `All time must be approved first. ${pendingTs.length} entry(s) still pending approval.` });
      return;
    }

    // Capture profitability snapshot timestamp if not already set
    if (!existing.profitabilitySnapshotAt) {
      updates.profitabilitySnapshotAt = new Date();
    }
  }

  const [project] = await db.update(projectsTable).set({ ...updates, updatedAt: new Date() }).where(eq(projectsTable.id, id)).returning();
  if (!project) { res.status(404).json({ error: "Not found" }); return; }
  res.json(parseProject(project));
});

// ── Phase PATCH — status + entry/exit criteria ────────────────────────────
router.patch("/phases/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { status, entryCriteria, exitCriteria } = req.body;
  const updates: Record<string, any> = {};
  if (status !== undefined) updates.status = status;
  if (entryCriteria !== undefined) updates.entryCriteria = entryCriteria;
  if (exitCriteria !== undefined) updates.exitCriteria = exitCriteria;
  if (!Object.keys(updates).length) { res.status(400).json({ error: "No fields to update" }); return; }
  const [phase] = await db.update(phasesTable).set(updates).where(eq(phasesTable.id, id)).returning();
  if (!phase) { res.status(404).json({ error: "Not found" }); return; }
  res.json(phase);
});

// Set Baseline — snapshot planned dates → baseline dates
router.post("/projects/:id/set-baseline", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: "Not found" }); return; }
  const baselineAt = new Date().toISOString();
  const [updated] = await db.update(projectsTable).set({
    baselineStartDate: project.startDate ?? project.baselineStartDate,
    baselineEndDate: project.endDate ?? project.baselineEndDate,
    updatedAt: new Date(),
  }).where(eq(projectsTable.id, id)).returning();
  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.projectId, id));
  for (const t of tasks) {
    if (t.plannedStartDate || t.plannedEndDate) {
      await db.update(tasksTable).set({
        baselineStartDate: t.plannedStartDate ?? t.baselineStartDate,
        baselineEndDate: t.plannedEndDate ?? t.baselineEndDate,
      }).where(eq(tasksTable.id, t.id));
    }
  }
  res.json({ ok: true, project: parseProject(updated), tasksUpdated: tasks.filter(t => t.plannedStartDate || t.plannedEndDate).length, baselineAt });
});

// ─── Named Baseline — multi-snapshot baseline per project ────────────────────
router.post("/projects/:id/baseline", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { label = "Baseline", baselinedBy } = req.body ?? {};
  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.projectId, id));
  if (tasks.length === 0) { res.status(400).json({ error: "No tasks to baseline" }); return; }
  const [baseline] = await db.insert(projectBaselinesTable).values({
    projectId: id,
    label: String(label).slice(0, 120),
    baselinedBy: baselinedBy ?? null,
  }).returning();
  const rows = tasks.map(t => ({
    baselineId:   baseline.id,
    taskId:       t.id,
    plannedStart: t.plannedStartDate ?? null,
    plannedEnd:   t.plannedEndDate   ?? null,
    plannedHours: t.estimatedHours   ?? null,
  }));
  if (rows.length > 0) await db.insert(baselineTasksTable).values(rows);
  res.json({ ok: true, baselineId: baseline.id, label: baseline.label, tasksSnapshotted: rows.length });
});

router.get("/projects/:id/baselines", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const baselines = await db.select().from(projectBaselinesTable)
    .where(eq(projectBaselinesTable.projectId, id))
    .orderBy(desc(projectBaselinesTable.baselinedAt));
  if (baselines.length === 0) { res.json([]); return; }
  const latestId = baselines[0].id;
  const [bTasks, allTasks, timesheetRows] = await Promise.all([
    db.select().from(baselineTasksTable).where(eq(baselineTasksTable.baselineId, latestId)),
    db.select().from(tasksTable).where(eq(tasksTable.projectId, id)),
    db.select().from(timesheetsTable).where(
      and(eq(timesheetsTable.projectId, id), eq(timesheetsTable.status, "approved"))
    ),
  ]);
  const actualByTask: Record<number, number> = {};
  for (const ts of timesheetRows) {
    if (!ts.taskId) continue;
    actualByTask[ts.taskId] = (actualByTask[ts.taskId] ?? 0) + parseFloat(String(ts.hoursLogged ?? 0));
  }
  const taskMap: Record<number, typeof allTasks[0]> = {};
  allTasks.forEach(t => { taskMap[t.id] = t; });
  const taskRows = bTasks.map(bt => {
    const task = taskMap[bt.taskId];
    const baselineHours = parseFloat(String(bt.plannedHours ?? 0));
    const actualHours   = actualByTask[bt.taskId] ?? 0;
    const etcHours      = task ? parseFloat(String(task.etcHours ?? 0)) : 0;
    const variance      = actualHours + etcHours - baselineHours;
    return {
      taskId:        bt.taskId,
      taskName:      task?.name ?? "(deleted)",
      plannedStart:  bt.plannedStart,
      plannedEnd:    bt.plannedEnd,
      baselineHours,
      actualHours,
      etcHours,
      variance,
      status:        task?.status ?? "unknown",
    };
  });
  res.json({
    baselines,
    latest: { id: latestId, label: baselines[0].label, baselinedAt: baselines[0].baselinedAt },
    tasks: taskRows,
  });
});

// Projection — ETC-based projected end date
router.get("/projects/:id/projection", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: "Not found" }); return; }
  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.projectId, id));
  const totalEstimated = tasks.reduce((s, t) => s + parseFloat(String(t.estimatedHours ?? 0)), 0);
  const totalLogged = tasks.reduce((s, t) => s + parseFloat(String(t.loggedHours ?? 0)), 0);
  const totalEtc = tasks.reduce((s, t) => {
    if (t.etcHours !== null && t.etcHours !== undefined) return s + parseFloat(String(t.etcHours));
    const est = parseFloat(String(t.estimatedHours ?? 0));
    const logged = parseFloat(String(t.loggedHours ?? 0));
    const pct = (t.completionPct ?? 0) / 100;
    return s + Math.max(0, est * (1 - pct) - (est * pct > 0 ? 0 : logged));
  }, 0);
  const DAILY_HOURS = 8;
  const workingDaysRemaining = Math.ceil(totalEtc / DAILY_HOURS);
  const today = new Date();
  let projectedEnd: string | null = null;
  if (workingDaysRemaining >= 0) {
    let d = new Date(today); let added = 0;
    while (added < workingDaysRemaining) {
      d.setDate(d.getDate() + 1);
      const day = d.getDay();
      if (day !== 0 && day !== 6) added++;
    }
    projectedEnd = d.toISOString().split("T")[0];
  }
  const overallPct = totalEstimated > 0 ? Math.round((totalLogged / totalEstimated) * 100) : 0;
  res.json({ totalEstimated, totalLogged, totalEtc, workingDaysRemaining, projectedEnd, pctFromHours: Math.min(overallPct, 100), taskCount: tasks.length });
});

// Phases
router.get("/projects/:id/phases", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const phases = await db.select().from(phasesTable).where(eq(phasesTable.projectId, id));
  res.json(phases.sort((a, b) => a.sequence - b.sequence));
});

router.post("/projects/:id/phases", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { name, sequence, startDate, endDate, description } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const [phase] = await db.insert(phasesTable).values({ projectId: id, name, sequence: sequence || 1, startDate, endDate, description }).returning();
  res.status(201).json(phase);
});

// ── Status Reports (computed from project state, stored in activityLogs) ──────
router.get("/projects/:id/status-reports", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: "Not found" }); return; }

  const [milestones, tasks] = await Promise.all([
    db.select().from(milestonesTable).where(eq(milestonesTable.projectId, id)),
    db.select().from(tasksTable).where(eq(tasksTable.projectId, id)),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const doneTasks = tasks.filter(t => t.status === "done").length;
  const blockedTasks = tasks.filter(t => t.status === "blocked").length;
  const completedMs = milestones.filter(m => m.status === "completed").length;
  const overdueMs = milestones.filter(m => m.status !== "completed" && m.dueDate && m.dueDate < today);
  const health = project.healthScore || 75;
  const statusColor = health >= 80 ? "green" : health >= 60 ? "amber" : "red";

  const logs = await db.select().from(activityLogsTable)
    .where(eq(activityLogsTable.entityId, id));

  const storedReports = logs
    .filter((l: any) => l.type === "status_report" && l.entityType === "project")
    .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .map((l: any) => {
      let details: any = {};
      try { details = l.message ? JSON.parse(l.message) : {}; } catch { details = { summary: l.message || "" }; }
      return {
        id: l.id,
        date: l.timestamp ? new Date(l.timestamp).toISOString().split("T")[0] : today,
        author: l.userName || "Project Manager",
        status: details.status || "on_track",
        color: details.color || "green",
        summary: details.summary || l.message || "",
        highlights: details.highlights || [],
        risks: details.risks || [],
        nextSteps: details.nextSteps || [],
      };
    });

  const autoReport = {
    id: 0,
    date: today,
    author: project.pmName || "System",
    status: overdueMs.length > 0 ? "at_risk" : "on_track",
    color: statusColor,
    summary: `${completedMs}/${milestones.length} milestones complete. ${doneTasks} tasks done${blockedTasks > 0 ? `, ${blockedTasks} blocked` : ""}. Health score: ${health}/100.`,
    highlights: [
      `${completedMs} of ${milestones.length} milestones completed`,
      `${doneTasks} tasks completed this period`,
      project.completionPct ? `Overall project ${project.completionPct}% complete` : null,
    ].filter(Boolean),
    risks: [
      ...overdueMs.map(m => `Overdue milestone: ${m.name} (was due ${m.dueDate})`),
      ...(blockedTasks > 0 ? [`${blockedTasks} blocked task${blockedTasks !== 1 ? "s" : ""} require attention`] : []),
    ],
    nextSteps: [],
    isAutoGenerated: true,
  };

  res.json([autoReport, ...storedReports]);
});

router.post("/projects/:id/status-reports", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: "Not found" }); return; }

  const { author, summary, status, color, highlights, risks, nextSteps } = req.body;
  if (!summary) { res.status(400).json({ error: "summary required" }); return; }

  const payload = { summary, status: status || "on_track", color: color || "green", highlights: highlights || [], risks: risks || [], nextSteps: nextSteps || [] };
  const [log] = await db.insert(activityLogsTable).values({
    type: "status_report",
    message: JSON.stringify(payload),
    entityType: "project",
    entityId: id,
    entityName: project.name,
    userName: author || project.pmName || "Project Manager",
  }).returning();

  res.status(201).json({
    id: log.id,
    date: new Date().toISOString().split("T")[0],
    author: log.userName,
    ...payload,
  });
});

// ─── Project Summary ─────────────────────────────────────────────────────────
router.get("/projects/:id/summary", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: "Not found" }); return; }

  const [milestones, tasks, changeRequests] = await Promise.all([
    db.select().from(milestonesTable).where(eq(milestonesTable.projectId, id)),
    db.select().from(tasksTable).where(eq(tasksTable.projectId, id)),
    db.select().from(changeRequestsTable).where(eq(changeRequestsTable.projectId, id)),
  ]);

  const today = new Date().toISOString().split("T")[0];

  // ── Metrics ──────────────────────────────────────────────────────────────
  const overdueMilestones = milestones.filter(m => m.dueDate && m.dueDate < today && m.status !== "completed");
  const blockedTasks      = tasks.filter(t => t.status === "blocked");
  const doneTasks         = tasks.filter(t => t.status === "done").length;
  const totalTasks        = tasks.length;
  const completionPct     = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const budgetHours    = parseFloat(project.budgetHours || "0");
  const consumedHours  = parseFloat(project.consumedHours || "0");
  const burnPct        = budgetHours > 0 ? Math.round((consumedHours / budgetHours) * 100) : 0;
  const budgetValue    = parseFloat(project.budgetValue || "0");
  const blendedRate    = 85;
  const laborCost      = consumedHours * blendedRate;
  const marginPct      = budgetValue > 0 ? Math.round(((budgetValue - laborCost) / budgetValue) * 100) : null;

  const openCRs        = changeRequests.filter(cr => !["approved", "rejected"].includes(cr.status));
  const highBurn       = burnPct > completionPct + 20 && burnPct > 40;
  const lowMargin      = marginPct !== null && marginPct < 20;

  // ── Health score (simplified inline) ─────────────────────────────────────
  let healthScore = 100;
  if (overdueMilestones.length > 0) healthScore -= Math.min(overdueMilestones.length * 12, 30);
  if (blockedTasks.length > 0)      healthScore -= Math.min(blockedTasks.length * 8, 20);
  if (highBurn)                      healthScore -= 15;
  if (lowMargin)                     healthScore -= 10;
  if (openCRs.length > 2)           healthScore -= 5;
  healthScore = Math.max(0, healthScore);

  const status: "on_track" | "at_risk" | "critical" =
    healthScore >= 80 ? "on_track" : healthScore >= 60 ? "at_risk" : "critical";

  // ── Headline ─────────────────────────────────────────────────────────────
  let headline: string;
  if (status === "on_track") {
    headline = `${project.name} is progressing well — ${completionPct}% of tasks complete with no critical issues detected.`;
  } else if (status === "at_risk") {
    const topRisk = overdueMilestones.length > 0
      ? `${overdueMilestones.length} overdue milestone${overdueMilestones.length > 1 ? "s" : ""}`
      : blockedTasks.length > 0 ? `${blockedTasks.length} blocked task${blockedTasks.length > 1 ? "s" : ""}`
      : highBurn ? `budget burn at ${burnPct}% vs ${completionPct}% completion`
      : "elevated risk factors";
    headline = `${project.name} is at risk due to ${topRisk}. Immediate attention recommended.`;
  } else {
    headline = `${project.name} is in critical condition — multiple risk factors require urgent action.`;
  }

  // ── Key Concerns ─────────────────────────────────────────────────────────
  const keyConcerns: string[] = [];
  if (overdueMilestones.length > 0) {
    const names = overdueMilestones.slice(0, 2).map(m => `"${m.name}"`).join(", ");
    keyConcerns.push(`${overdueMilestones.length} milestone${overdueMilestones.length > 1 ? "s are" : " is"} overdue (${names}${overdueMilestones.length > 2 ? ` +${overdueMilestones.length - 2} more` : ""}) — the project timeline is at risk of slipping.`);
  }
  if (blockedTasks.length > 0) {
    const names = blockedTasks.slice(0, 2).map(t => `"${t.name}"`).join(", ");
    keyConcerns.push(`${blockedTasks.length} task${blockedTasks.length > 1 ? "s are" : " is"} blocked (${names}${blockedTasks.length > 2 ? ` +${blockedTasks.length - 2} more` : ""}), preventing forward progress.`);
  }
  if (highBurn) {
    keyConcerns.push(`Budget burn is at ${burnPct}% while the project is only ${completionPct}% complete — resources are being consumed faster than work is delivered.`);
  }
  if (lowMargin && marginPct !== null) {
    keyConcerns.push(`Estimated margin is ${marginPct}% — below the healthy 20% threshold. Profitability is at risk.`);
  }
  if (openCRs.length > 0) {
    keyConcerns.push(`${openCRs.length} change order${openCRs.length > 1 ? "s are" : " is"} pending approval — unresolved scope and cost impacts may affect billing.`);
  }
  if (keyConcerns.length === 0) {
    keyConcerns.push(`No significant concerns detected. All milestones and tasks are tracking to plan.`);
  }

  // ── Recommended Actions ───────────────────────────────────────────────────
  const recommendedActions: string[] = [];
  if (overdueMilestones.length > 0) {
    recommendedActions.push(`Schedule a recovery session to address ${overdueMilestones.length > 1 ? "the overdue milestones" : `"${overdueMilestones[0].name}"`} — update the delivery date or escalate to the client.`);
  }
  if (blockedTasks.length > 0) {
    recommendedActions.push(`Assign ownership to each blocked task and set a resolution deadline within 48 hours.`);
  }
  if (highBurn) {
    recommendedActions.push(`Audit active resource allocations. Reduce discretionary hours and align remaining scope to budget.`);
  }
  if (lowMargin && marginPct !== null) {
    recommendedActions.push(`Review the SOW for scope creep opportunities and consider raising a change order for any out-of-scope work delivered.`);
  }
  if (openCRs.length > 0) {
    recommendedActions.push(`Drive change order approvals before the next billing cycle. ${openCRs.length > 1 ? `${openCRs.length} orders require` : "1 order requires"} a decision.`);
  }
  if (status === "on_track" && recommendedActions.length === 0) {
    recommendedActions.push(`Maintain cadence — post a status update and keep the client informed of upcoming milestones.`);
    recommendedActions.push(`Proactively review the closure checklist to ensure a smooth project wrap-up.`);
  }

  res.json({
    status,
    headline,
    keyConcerns,
    recommendedActions,
    meta: {
      healthScore,
      completionPct,
      overdueCount: overdueMilestones.length,
      blockedCount: blockedTasks.length,
      burnPct,
      marginPct,
      openCRCount: openCRs.length,
    },
  });
});

// ─── Gantt Data ───────────────────────────────────────────────────────────────
router.get("/projects/:id/gantt", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: "Not found" }); return; }

  const [phases, milestones, tasks] = await Promise.all([
    db.select().from(phasesTable).where(eq(phasesTable.projectId, id)),
    db.select().from(milestonesTable).where(eq(milestonesTable.projectId, id)),
    db.select().from(tasksTable).where(eq(tasksTable.projectId, id)),
  ]);

  // Fetch task dependencies for all project tasks
  const taskIds = tasks.map(t => t.id);
  const rawDeps = taskIds.length > 0
    ? await db.select().from(taskDependenciesTable).where(inArray(taskDependenciesTable.taskId, taskIds))
    : [];
  const taskIdSet = new Set(taskIds);
  // fromTaskId = prerequisite (must finish first), toTaskId = dependent (starts after)
  const dependencies = rawDeps
    .filter(d => taskIdSet.has(d.dependsOnTaskId))
    .map(d => ({ fromTaskId: d.dependsOnTaskId, toTaskId: d.taskId }));

  // Compute timeline bounds from all available dates
  const allDates: number[] = [];
  const tryDate = (d: string | null | undefined) => { if (d) { const t = new Date(d).getTime(); if (!isNaN(t)) allDates.push(t); } };
  tryDate(project.startDate); tryDate(project.endDate);
  phases.forEach(p => { tryDate(p.startDate); tryDate(p.endDate); });
  milestones.forEach(m => { tryDate(m.startDate); tryDate(m.dueDate); });
  tasks.forEach(t => { tryDate(t.dueDate); });

  const today = new Date();
  const rawStart = project.startDate
    ? new Date(project.startDate)
    : allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const rawEnd = project.endDate
    ? new Date(project.endDate)
    : allDates.length > 0 ? new Date(Math.max(...allDates)) : new Date(today.getFullYear(), today.getMonth() + 3, 1);

  // Add 3% padding on each side
  const span = rawEnd.getTime() - rawStart.getTime();
  const pad = Math.max(span * 0.03, 7 * 86400000);
  const timelineStart = new Date(rawStart.getTime() - pad).toISOString().split("T")[0];
  const timelineEnd   = new Date(rawEnd.getTime()   + pad).toISOString().split("T")[0];

  const phaseMap: Record<number, typeof phasesTable.$inferSelect> = {};
  phases.forEach(p => { phaseMap[p.id] = p; });

  const rows: any[] = [];
  const sortedPhases = [...phases].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

  const todayStr = today.toISOString().split("T")[0];
  const projectStart = project.startDate || todayStr;

  for (const phase of sortedPhases) {
    rows.push({ type: "phase", id: phase.id, name: phase.name, start: phase.startDate, end: phase.endDate, status: phase.status });

    const phaseMilestones = milestones
      .filter(m => m.phaseId === phase.id)
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

    for (const ms of phaseMilestones) {
      rows.push({ type: "milestone", id: ms.id, name: ms.name, dueDate: ms.dueDate, status: ms.status });
      const msTasks = tasks.filter(t => t.milestoneId === ms.id);
      for (const task of msTasks) {
        const taskStart = ms.startDate || phase.startDate || projectStart;
        const taskEnd   = task.dueDate || ms.dueDate || phase.endDate;
        rows.push({ type: "task", id: task.id, name: task.name, start: taskStart, end: taskEnd, status: task.status });
      }
    }

    // Phase tasks without a milestone
    const phaseTasks = tasks.filter(t => t.phaseId === phase.id && !t.milestoneId);
    for (const task of phaseTasks) {
      const taskStart = phase.startDate || projectStart;
      const taskEnd   = task.dueDate || phase.endDate;
      rows.push({ type: "task", id: task.id, name: task.name, start: taskStart, end: taskEnd, status: task.status });
    }
  }

  // Orphan tasks (no phase, no milestone)
  const orphans = tasks.filter(t => !t.phaseId && !t.milestoneId);
  if (orphans.length > 0) {
    rows.push({ type: "phase", id: -1, name: "Uncategorized", start: null, end: null, status: "active" });
    for (const task of orphans) {
      rows.push({ type: "task", id: task.id, name: task.name, start: projectStart, end: task.dueDate, status: task.status });
    }
  }

  res.json({ timelineStart, timelineEnd, projectName: project.name, rows, dependencies });
});

// ─── Earned vs Billed Revenue ────────────────────────────────────────────────
router.get("/projects/:id/revenue", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: "Not found" }); return; }

  const budgetValue = parseFloat(project.budgetValue ?? "0");
  const billedValue = parseFloat(project.billedValue ?? "0");
  const completionPct = project.completionPct ?? 0;

  const earned = Math.round((completionPct / 100) * budgetValue);
  const billed = Math.round(billedValue);
  const gap = earned - billed;

  res.json({ earned, billed, gap, completionPct, budgetValue: Math.round(budgetValue) });
});

// ─── Margin Forecast (FX-aware) ───────────────────────────────────────────────
router.get("/projects/:id/margin-forecast", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: "Not found" }); return; }

  const asOf = today();
  const projectCurrency = project.currency ?? BASE_CURRENCY;

  const [allocs, allResources, tsRows] = await Promise.all([
    db.select().from(allocationsTable).where(eq(allocationsTable.projectId, id)),
    db.select().from(resourcesTable),
    db.execute<{ resource_id: number; total_hours: string }>(sql`
      SELECT resource_id, SUM(hours_logged) AS total_hours
      FROM timesheets
      WHERE project_id = ${id} AND status = 'approved'
      GROUP BY resource_id
    `),
  ]);

  const resourceMap: Record<number, typeof allResources[0]> = {};
  allResources.forEach(r => { resourceMap[r.id] = r; });

  const hoursMap: Record<number, number> = {};
  tsRows.rows.forEach((r: any) => { hoursMap[r.resource_id] = parseFloat(r.total_hours); });

  const allocResourceIds = new Set(allocs.map(a => a.resourceId));

  const missingCurrencies = new Set<string>();
  let totalCostRaw = 0;
  let totalCostInCAD = 0;
  let hasConversion = projectCurrency !== BASE_CURRENCY;

  for (const rid of allocResourceIds) {
    const resource = resourceMap[rid];
    if (!resource) continue;
    const hours = hoursMap[rid] ?? 0;
    if (hours === 0) continue;
    const costRate = parseFloat(resource.costRate ?? "85");
    const currency = resource.currency ?? BASE_CURRENCY;
    const rawCost = costRate * hours;
    totalCostRaw += rawCost;
    const converted = await fxConvert(rawCost, currency, asOf);
    if (converted === null) {
      missingCurrencies.add(currency);
      totalCostInCAD += rawCost;
    } else {
      totalCostInCAD += converted;
      if (currency !== BASE_CURRENCY) hasConversion = true;
    }
  }

  if (totalCostRaw === 0) {
    const projectResources = allResources.filter(r => allocResourceIds.has(r.id));
    const costRates = projectResources.map(r => parseFloat(r.costRate ?? "85")).filter(v => !isNaN(v) && v > 0);
    const avgCostRate = costRates.length > 0 ? costRates.reduce((s, c) => s + c, 0) / costRates.length : 85;
    const consumedHours = parseFloat(project.consumedHours ?? "0");
    totalCostRaw = avgCostRate * consumedHours;
    totalCostInCAD = totalCostRaw;
  }

  const budgetValue = parseFloat(project.budgetValue ?? "0");
  const billedValue = parseFloat(project.billedValue ?? "0");

  const budgetInCAD = await fxConvert(budgetValue, projectCurrency, asOf) ?? budgetValue;
  const billedInCAD = await fxConvert(billedValue, projectCurrency, asOf) ?? billedValue;
  if (projectCurrency !== BASE_CURRENCY && budgetInCAD === budgetValue) missingCurrencies.add(projectCurrency);

  const projectedCost = Math.round(totalCostInCAD);
  const currentMargin = Math.round(billedInCAD - totalCostInCAD);
  const forecastMargin = Math.round(budgetInCAD - totalCostInCAD);

  const forecastMarginPct = budgetInCAD > 0 ? (forecastMargin / budgetInCAD) * 100 : null;
  const currentMarginPct = billedInCAD > 0 ? (currentMargin / billedInCAD) * 100 : null;

  const marginStatus: "good" | "warning" | "critical" =
    forecastMarginPct === null ? "good"
    : forecastMarginPct >= 30 ? "good"
    : forecastMarginPct >= 15 ? "warning"
    : "critical";

  res.json({
    currentMargin,
    forecastMargin,
    currentMarginPct: currentMarginPct !== null ? Math.round(currentMarginPct * 10) / 10 : null,
    forecastMarginPct: forecastMarginPct !== null ? Math.round(forecastMarginPct * 10) / 10 : null,
    projectedCost,
    budgetValue: Math.round(budgetInCAD),
    billedValue: Math.round(billedInCAD),
    marginStatus,
    baseCurrency: BASE_CURRENCY,
    hasConversion,
    missingCurrencies: Array.from(missingCurrencies),
  });
});

// ─── Copy Project ─────────────────────────────────────────────────────────────
router.post("/projects/:id/copy", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: "Not found" }); return; }

  const [milestones, tasks] = await Promise.all([
    db.select().from(milestonesTable).where(eq(milestonesTable.projectId, id)),
    db.select().from(tasksTable).where(eq(tasksTable.projectId, id)).orderBy(tasksTable.hierarchyLevel),
  ]);

  const { id: _id, createdAt, updatedAt, ...projectData } = project;
  const [newProject] = await db.insert(projectsTable).values({
    ...projectData,
    name: `${project.name} — Copy`,
    status: "active" as any,
    completionPct: 0,
    consumedHours: "0",
    billedValue: "0",
  }).returning();

  // Copy milestones
  if (milestones.length > 0) {
    await Promise.all(milestones.map(m => {
      const { id: _mid, createdAt: _mca, updatedAt: _mua, ...mData } = m;
      return db.insert(milestonesTable).values({ ...mData, projectId: newProject.id, status: "not_started" as any });
    }));
  }

  // Copy tasks, preserving parentId relationships with new IDs
  const oldIdToNew: Record<number, number> = {};
  const sortedTasks = [...tasks].sort((a, b) => (a.hierarchyLevel ?? 0) - (b.hierarchyLevel ?? 0));
  for (const t of sortedTasks) {
    const { id: _tid, createdAt: _tca, updatedAt: _tua, ...tData } = t;
    const newParentId = t.parentId ? oldIdToNew[t.parentId] ?? null : null;
    const [newTask] = await db.insert(tasksTable).values({
      ...tData,
      projectId: newProject.id,
      parentId: newParentId,
      status: "todo" as any,
      loggedHours: "0",
      completionPct: 0,
      commentCount: 0,
    }).returning();
    oldIdToNew[t.id] = newTask.id;
  }

  res.status(201).json({ id: newProject.id });
});

// ─── Save as Template ─────────────────────────────────────────────────────────
router.post("/projects/:id/save-as-template", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { templateName, description } = req.body;
  if (!templateName) { res.status(400).json({ error: "templateName required" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: "Not found" }); return; }

  const [milestones, tasks] = await Promise.all([
    db.select().from(milestonesTable).where(eq(milestonesTable.projectId, id)),
    db.select().from(tasksTable).where(eq(tasksTable.projectId, id)),
  ]);

  const { templatesTable } = await import("@workspace/db");

  // Build template data with sequential slugs
  const taskSlugs: Record<number, string> = {};
  tasks.forEach((t, i) => { taskSlugs[t.id] = `task_${i + 1}`; });

  const templateData = {
    projectType: project.type,
    milestones: milestones.map((m, i) => ({
      slug: `milestone_${i + 1}`,
      name: m.name,
      phase: m.phase,
      sequence: m.sequence,
      isBillable: m.isBillable,
    })),
    tasks: tasks.map(t => ({
      slug: taskSlugs[t.id],
      name: t.name,
      taskType: t.taskType,
      parentSlug: t.parentId ? taskSlugs[t.parentId] : null,
      hierarchyLevel: t.hierarchyLevel,
      isLeaf: t.isLeaf,
      estimatedHours: t.estimatedHours,
      priority: t.priority,
      phase: t.phase,
    })),
  };

  const [template] = await db.insert(templatesTable).values({
    name: templateName,
    description: description || null,
    templateData: templateData as any,
    projectType: project.type as any,
  } as any).returning();

  res.status(201).json({ id: template.id });
});

// ─── Schedule: manual recalculate (synchronous, PM-only) ─────────────────────
router.post("/projects/:id/recalculate-schedule", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const result = await scheduleProject(id);
  if ("type" in result && result.type === "cycle") {
    res.status(422).json({ error: result.message }); return;
  }
  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.projectId, id));
  res.json({ ok: true, updated: (result as { updated: number }).updated, tasks });
});

// ─── Schedule: poll current task dates (for frontend refresh after cascade) ───
router.get("/projects/:id/schedule", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const tasks = await db
    .select({ id: tasksTable.id, plannedStartDate: tasksTable.plannedStartDate, plannedEndDate: tasksTable.plannedEndDate })
    .from(tasksTable)
    .where(eq(tasksTable.projectId, id));
  res.json(tasks);
});

export default router;
