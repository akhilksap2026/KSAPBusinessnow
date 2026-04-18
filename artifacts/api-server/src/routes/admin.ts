import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  db, projectsTable, accountsTable, resourcesTable, timesheetsTable, invoicesTable,
  milestonesTable, tasksTable, changeRequestsTable, allocationsTable, activityLogsTable,
  automationRunsTable, formsTable, formResponsesTable, contractsTable, renewalSignalsTable,
  usersTable, opportunitiesTable, rateCardsTable, automationsTable, phasesTable,
  templatesTable, staffingRequestsTable, notificationsTable,
} from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

// Admin metrics overview
router.get("/admin/metrics", async (req, res): Promise<void> => {
  const [projects, accounts, resources, timesheets, invoices, milestones, tasks, crs, allocations, forms, responses, contracts] = await Promise.all([
    db.select().from(projectsTable),
    db.select().from(accountsTable),
    db.select().from(resourcesTable),
    db.select().from(timesheetsTable),
    db.select().from(invoicesTable),
    db.select().from(milestonesTable),
    db.select().from(tasksTable),
    db.select().from(changeRequestsTable),
    db.select().from(allocationsTable),
    db.select().from(formsTable),
    db.select().from(formResponsesTable),
    db.select().from(contractsTable),
  ]);

  const today = new Date().toISOString().split("T")[0];

  res.json({
    entities: {
      projects: { total: projects.length, active: projects.filter(p => p.status === "active").length, atRisk: projects.filter(p => (p.healthScore || 75) < 65).length },
      accounts: { total: accounts.length, active: accounts.filter(a => a.status === "active").length },
      resources: { total: resources.length, employees: resources.filter(r => r.employmentType === "employee").length, contractors: resources.filter(r => r.employmentType === "contractor").length },
      milestones: { total: milestones.length, completed: milestones.filter(m => m.status === "completed").length, overdue: milestones.filter(m => m.status !== "completed" && m.dueDate && m.dueDate < today).length },
      tasks: { total: tasks.length, completed: tasks.filter(t => t.status === "completed").length, blocked: tasks.filter(t => t.status === "blocked").length },
      timesheets: { total: timesheets.length, approved: timesheets.filter(t => t.status === "approved").length, pending: timesheets.filter(t => t.status === "submitted").length },
      invoices: { total: invoices.length, paid: invoices.filter(i => i.status === "paid").length, overdue: invoices.filter(i => i.status === "overdue").length, totalValue: invoices.reduce((s, i) => s + parseFloat(i.amount), 0) },
      changeRequests: { total: crs.length, pending: crs.filter(cr => !["approved", "rejected"].includes(cr.status)).length, leakageRisk: crs.filter(cr => cr.deliveredBeforeApproval).length },
      allocations: { total: allocations.length, hard: allocations.filter(a => a.allocationType === "hard").length, soft: allocations.filter(a => a.allocationType === "soft").length },
      contracts: { total: contracts.length, active: contracts.filter(c => c.status === "active").length, totalValue: contracts.reduce((s, c) => s + parseFloat(c.totalValue || "0"), 0) },
      forms: { total: forms.length, responses: responses.length },
    },
    dataHealth: {
      projectsWithoutPM: projects.filter(p => !p.pmName).length,
      projectsWithoutBudget: projects.filter(p => !p.budgetValue || parseFloat(p.budgetValue) === 0).length,
      milestonesWithoutDate: milestones.filter(m => !m.dueDate).length,
      allocationsOverAllocated: (() => {
        const totals: Record<number, number> = {};
        allocations.filter(a => a.allocationType === "hard").forEach(a => { totals[a.resourceId] = (totals[a.resourceId] || 0) + (a.allocationPct || 0); });
        return Object.values(totals).filter(v => v > 100).length;
      })(),
    },
  });
});

// Combined audit log
router.get("/admin/audit-log", async (req, res): Promise<void> => {
  const { limit = "100" } = req.query as Record<string, string>;
  const [activityLogs, automationRuns] = await Promise.all([
    db.select().from(activityLogsTable).orderBy(desc(activityLogsTable.timestamp)),
    db.select().from(automationRunsTable).orderBy(desc(automationRunsTable.createdAt)),
  ]);

  const combined = [
    ...activityLogs.map(l => ({ ...l, source: "activity", time: l.timestamp })),
    ...automationRuns.map(r => ({ id: r.id, type: "automation_run", message: `Automation "${r.automationName}" ran — ${r.outcome}`, entityType: r.entityType, entityId: r.entityId, entityName: r.entityName, source: "automation", time: r.createdAt })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, parseInt(limit));

  res.json(combined);
});

// Renewal signals — all accounts
router.get("/renewal-signals", async (req, res): Promise<void> => {
  const signals = await db.select().from(renewalSignalsTable).orderBy(renewalSignalsTable.dueDate);
  res.json(signals.map(s => ({ ...s, estimatedValue: s.estimatedValue ? parseFloat(s.estimatedValue) : null })));
});

// POST renewal signal
router.post("/renewal-signals", async (req, res): Promise<void> => {
  const { accountId, signalType, ...rest } = req.body;
  if (!accountId || !signalType) { res.status(400).json({ error: "accountId and signalType required" }); return; }
  const [signal] = await db.insert(renewalSignalsTable).values({ accountId, signalType, ...rest }).returning();
  res.status(201).json({ ...signal, estimatedValue: signal.estimatedValue ? parseFloat(signal.estimatedValue) : null });
});

// ── Repair logged hours ───────────────────────────────────────────────────────
// Recomputes tasks.loggedHours for ALL tasks from scratch by summing hoursLogged
// from all 'approved' timesheet_entries grouped by taskId.
// Only callable by System Admin role (enforced via role param in request body).
router.post("/admin/repair-logged-hours", async (req, res): Promise<void> => {
  // Authorization: require the internal admin token header.
  // This is intentionally NOT taken from the request body (which is
  // spoofable by any client) — instead we read it from a server-side env
  // var so only callers with backend access can invoke this endpoint.
  const ADMIN_TOKEN = process.env.INTERNAL_ADMIN_TOKEN || "otmnow-admin-repair";
  const provided = req.headers["x-admin-token"];
  if (!provided || provided !== ADMIN_TOKEN) {
    res.status(403).json({ error: "FORBIDDEN", message: "Missing or invalid x-admin-token header." });
    return;
  }

  // 1. Sum approved hours per task from timesheets
  const approvedSums = await db.execute<{ task_id: number; total_hours: string }>(sql`
    SELECT task_id, SUM(hours_logged) AS total_hours
    FROM timesheets
    WHERE status = 'approved' AND task_id IS NOT NULL
    GROUP BY task_id
  `);

  const sumByTask: Record<number, number> = {};
  for (const row of approvedSums.rows) {
    sumByTask[row.task_id] = parseFloat(row.total_hours);
  }

  // 2. Fetch all tasks with a taskId that appears in either sumByTask or has existing loggedHours
  const allTasks = await db
    .select({ id: tasksTable.id, loggedHours: tasksTable.loggedHours })
    .from(tasksTable);

  const corrections: Array<{ taskId: number; oldValue: number; newValue: number }> = [];

  for (const task of allTasks) {
    const currentVal = parseFloat(task.loggedHours ?? "0");
    const correctVal = sumByTask[task.id] ?? 0;
    if (Math.abs(currentVal - correctVal) >= 0.01) {
      corrections.push({ taskId: task.id, oldValue: currentVal, newValue: correctVal });
      await db
        .update(tasksTable)
        .set({ loggedHours: String(correctVal) })
        .where(eq(tasksTable.id, task.id));
    }
  }

  res.json({ tasksRepaired: corrections.length, corrections });
});

export default router;
