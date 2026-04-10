import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db,
  automationsTable,
  automationRunsTable,
  projectsTable,
  milestonesTable,
  invoicesTable,
  timesheetsTable,
  resourcesTable,
  opportunitiesTable,
  allocationsTable,
  notificationsTable,
  activityLogsTable,
  tasksTable,
} from "@workspace/db";

const router: IRouter = Router();

// ─── HELPERS ────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().split("T")[0];

type MatchedEntity = {
  id: number;
  name: string;
  entityType: string;
  notifyUserId: number;
  projectId?: number | null;
  extra?: Record<string, any>;
};

type RunSummary = {
  automationId: number;
  automationName: string;
  trigger: string;
  matchedCount: number;
  actionsExecuted: number;
  outcome: "success" | "no_match" | "error";
  message: string;
  affectedIds: number[];
};

// ─── TRIGGER EVALUATORS ─────────────────────────────────────────────────────

async function evalProjectHealthBelowThreshold(
  conditions: Record<string, any>,
): Promise<MatchedEntity[]> {
  const threshold = Number(conditions.threshold ?? 70);
  const projects = await db.select().from(projectsTable);
  return projects
    .filter(p => p.status === "active" && (p.healthScore ?? 100) < threshold)
    .map(p => ({
      id: p.id,
      name: p.name,
      entityType: "project",
      notifyUserId: p.pmId ?? 1,
      projectId: p.id,
      extra: { healthScore: p.healthScore, threshold },
    }));
}

async function evalMilestoneOverdue(): Promise<MatchedEntity[]> {
  const t = todayStr();
  const [milestones, projects] = await Promise.all([
    db.select().from(milestonesTable),
    db.select().from(projectsTable),
  ]);
  const pmByProject: Record<number, number> = {};
  for (const p of projects) pmByProject[p.id] = p.pmId ?? 1;

  return milestones
    .filter(m => m.dueDate && m.dueDate < t && !["completed", "cancelled"].includes(m.status))
    .map(m => ({
      id: m.id,
      name: m.name,
      entityType: "milestone",
      notifyUserId: pmByProject[m.projectId] ?? 1,
      projectId: m.projectId,
      extra: { dueDate: m.dueDate, status: m.status },
    }));
}

async function evalInvoiceOverdue30(): Promise<MatchedEntity[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  const invoices = await db.select().from(invoicesTable);
  return invoices
    .filter(i => i.dueDate && i.dueDate < cutoffStr && !["paid", "cancelled", "void"].includes(i.status))
    .map(i => ({
      id: i.id,
      name: i.invoiceNumber,
      entityType: "invoice",
      notifyUserId: 1,
      extra: { dueDate: i.dueDate, amount: i.amount, status: i.status },
    }));
}

async function evalTimesheetMissing(): Promise<MatchedEntity[]> {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(now.getFullYear(), now.getMonth(), diff)
    .toISOString()
    .split("T")[0];

  const [resources, timesheets] = await Promise.all([
    db.select().from(resourcesTable),
    db.select().from(timesheetsTable),
  ]);
  const submitted = new Set(
    timesheets.filter(t => t.weekStart === weekStart).map(t => t.resourceId),
  );
  return resources
    .filter(r => r.status !== "unavailable" && !submitted.has(r.id))
    .map(r => ({
      id: r.id,
      name: r.name,
      entityType: "resource",
      notifyUserId: r.userId ?? 1,
      extra: { weekStart },
    }));
}

// Inlined from opportunities.ts — kept in sync
const TYPE_DEFAULT_ROLES: Record<string, string[]> = {
  implementation:     ["OTM Consultant", "Project Manager", "Integration Specialist"],
  cloud_migration:    ["Cloud Architect", "OTM Consultant", "DevOps Engineer"],
  ams:                ["AMS Consultant", "Support Analyst"],
  certification:      ["OTM Consultant"],
  rate_maintenance:   ["Rate Analyst"],
  custom_development: ["OTM Developer", "QA Engineer"],
  data_services:      ["Data Analyst", "OTM Consultant"],
};

function roleMatchesResource(role: string, r: typeof resourcesTable.$inferSelect): boolean {
  const words = role.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (words.length === 0) return false;
  const haystack = [
    r.title?.toLowerCase() ?? "",
    (r.practiceArea ?? "").toLowerCase().replace(/_/g, " "),
    ...(r.skills ?? []).map(s => s.toLowerCase()),
  ].join(" ");
  return words.some(w => haystack.includes(w));
}

async function evalOpportunityProposalStaffingRisk(): Promise<MatchedEntity[]> {
  const t = todayStr();
  const [opps, resources, allocations] = await Promise.all([
    db.select().from(opportunitiesTable),
    db.select().from(resourcesTable),
    db.select().from(allocationsTable),
  ]);
  const proposalOpps = opps.filter(o => o.stage === "proposal");
  const futureAllocs = allocations.filter(a => !a.endDate || a.endDate >= t);

  const atRisk: MatchedEntity[] = [];
  for (const opp of proposalOpps) {
    const requiredRoles =
      opp.requiredRoles && opp.requiredRoles.length > 0
        ? opp.requiredRoles
        : (TYPE_DEFAULT_ROLES[opp.type] ?? ["OTM Consultant"]);

    const missing: string[] = [];
    for (const role of requiredRoles) {
      const matched = resources.filter(r => roleMatchesResource(role, r));
      const available = matched.filter(r => {
        if ((r.currentUtilization ?? 0) >= (r.utilizationTarget ?? 80)) return false;
        return !futureAllocs
          .filter(a => a.resourceId === r.id)
          .some(a => (a.allocationPct ?? 0) >= 80);
      });
      if (available.length === 0) missing.push(role);
    }
    if (missing.length > 0) {
      atRisk.push({
        id: opp.id,
        name: opp.name,
        entityType: "opportunity",
        notifyUserId: opp.ownerId ?? 1,
        extra: { missingRoles: missing, stage: opp.stage },
      });
    }
  }
  return atRisk;
}

async function evaluateTrigger(
  trigger: string,
  conditions: Record<string, any>,
): Promise<MatchedEntity[]> {
  switch (trigger) {
    case "project_health_below_threshold":
      return evalProjectHealthBelowThreshold(conditions);
    case "milestone_overdue":
      return evalMilestoneOverdue();
    case "invoice_overdue_30":
      return evalInvoiceOverdue30();
    case "timesheet_missing":
      return evalTimesheetMissing();
    case "opportunity_proposal_staffing_risk":
      return evalOpportunityProposalStaffingRisk();
    default:
      return [];
  }
}

// ─── ACTION EXECUTORS ────────────────────────────────────────────────────────

function buildNotificationMessage(trigger: string, entity: MatchedEntity): string {
  switch (trigger) {
    case "project_health_below_threshold":
      return `Project "${entity.name}" health score is ${entity.extra?.healthScore} (threshold: ${entity.extra?.threshold}). Immediate review required.`;
    case "milestone_overdue":
      return `Milestone "${entity.name}" was due on ${entity.extra?.dueDate} and is still ${entity.extra?.status}. Please update or escalate.`;
    case "invoice_overdue_30":
      return `Invoice ${entity.name} (due ${entity.extra?.dueDate}, $${entity.extra?.amount}) is 30+ days overdue with status "${entity.extra?.status}".`;
    case "timesheet_missing":
      return `${entity.name} has not submitted a timesheet for the week of ${entity.extra?.weekStart}.`;
    case "opportunity_proposal_staffing_risk":
      return `Opportunity "${entity.name}" (Proposal) has unmet staffing needs: ${(entity.extra?.missingRoles ?? []).join(", ")}.`;
    default:
      return `Automation triggered for ${entity.entityType} "${entity.name}".`;
  }
}

async function execCreateNotification(entity: MatchedEntity, automation: any): Promise<void> {
  await db.insert(notificationsTable).values({
    userId: entity.notifyUserId,
    title: automation.name,
    message: buildNotificationMessage(automation.trigger, entity),
    type: "warning",
    priority: "action_needed",
    entityType: entity.entityType,
    entityId: entity.id,
  });
}

async function execCreateActivityLog(entity: MatchedEntity, automation: any): Promise<void> {
  await db.insert(activityLogsTable).values({
    type: "automation_triggered",
    message: `[Automation] ${automation.name} — ${entity.entityType} "${entity.name}"`,
    userName: "System",
    entityType: entity.entityType,
    entityId: entity.id,
    entityName: entity.name,
  });
}

async function execFlagEntity(entity: MatchedEntity, automation: any): Promise<void> {
  if (entity.entityType === "project") {
    const [p] = await db.select().from(projectsTable).where(eq(projectsTable.id, entity.id));
    if (p && p.status === "active") {
      await db.update(projectsTable)
        .set({ status: "at_risk" })
        .where(eq(projectsTable.id, entity.id));
    }
  } else if (entity.entityType === "opportunity") {
    await db.insert(activityLogsTable).values({
      type: "staffing_risk_flagged",
      message: `[Automation] Staffing risk flagged for "${entity.name}" — missing: ${(entity.extra?.missingRoles ?? []).join(", ")}`,
      userName: "System",
      entityType: "opportunity",
      entityId: entity.id,
      entityName: entity.name,
    });
  }
}

async function execCreateTask(
  entity: MatchedEntity,
  automation: any,
  params: Record<string, string>,
): Promise<void> {
  if (!entity.projectId) return;
  await db.insert(tasksTable).values({
    projectId: entity.projectId,
    name: params.taskName ?? `Follow-up: ${automation.name}`,
    description: `Auto-created by automation "${automation.name}" for ${entity.entityType} "${entity.name}"`,
    status: "todo",
    priority: "high",
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
  });
}

async function executeAction(
  action: { type: string; params?: Record<string, string> },
  entity: MatchedEntity,
  automation: any,
): Promise<void> {
  const p = action.params ?? {};
  switch (action.type) {
    case "create_notification":
      await execCreateNotification(entity, automation); break;
    case "create_activity_log":
      await execCreateActivityLog(entity, automation); break;
    case "flag_entity":
      await execFlagEntity(entity, automation); break;
    case "create_task":
      await execCreateTask(entity, automation, p); break;
  }
}

// ─── CORE RUN LOGIC ─────────────────────────────────────────────────────────

async function runAutomation(automation: any): Promise<RunSummary> {
  const conditions = (automation.conditions ?? {}) as Record<string, any>;
  const actions = (automation.actions ?? []) as { type: string; params?: Record<string, string> }[];

  let entities: MatchedEntity[] = [];
  let outcome: "success" | "no_match" | "error" = "no_match";
  let message = "";
  let actionsExecuted = 0;

  try {
    entities = await evaluateTrigger(automation.trigger, conditions);

    if (entities.length === 0) {
      outcome = "no_match";
      message = "Trigger evaluated — no matching entities";
    } else {
      for (const entity of entities) {
        for (const action of actions) {
          await executeAction(action, entity, automation);
          actionsExecuted++;
        }
      }
      outcome = "success";
      message = `${entities.length} match${entities.length !== 1 ? "es" : ""}, ${actionsExecuted} action${actionsExecuted !== 1 ? "s" : ""} executed`;
    }
  } catch (err: any) {
    outcome = "error";
    message = String(err?.message ?? "Unknown error");
  }

  // Record execution
  await db.insert(automationRunsTable).values({
    automationId: automation.id,
    automationName: automation.name,
    trigger: automation.trigger,
    outcome,
    details: {
      matchedCount: String(entities.length),
      actionsExecuted: String(actionsExecuted),
      message,
    },
    entityType: entities.length === 1 ? entities[0].entityType : undefined,
    entityId: entities.length === 1 ? entities[0].id : undefined,
    entityName: entities.length === 1 ? entities[0].name : undefined,
  });

  // Update run stats
  await db.update(automationsTable)
    .set({ runCount: (automation.runCount ?? 0) + 1, lastRunAt: todayStr() })
    .where(eq(automationsTable.id, automation.id));

  return {
    automationId: automation.id,
    automationName: automation.name,
    trigger: automation.trigger,
    matchedCount: entities.length,
    actionsExecuted,
    outcome,
    message,
    affectedIds: entities.map(e => e.id),
  };
}

// ─── SEED NEW AUTOMATIONS ON STARTUP ────────────────────────────────────────

const SEED_AUTOMATIONS = [
  {
    name: "Low Health Score Alert",
    trigger: "project_health_below_threshold",
    description: "Notifies PM and logs activity when a project health score drops below 70",
    conditions: { threshold: 70 },
    actions: [{ type: "create_notification" }, { type: "create_activity_log" }],
    enabled: true,
  },
  {
    name: "Milestone Overdue Alert",
    trigger: "milestone_overdue",
    description: "Notifies PM when a milestone passes its due date without completion",
    conditions: {},
    actions: [{ type: "create_notification" }, { type: "create_activity_log" }],
    enabled: true,
  },
  {
    name: "Invoice Aging Escalation (30d)",
    trigger: "invoice_overdue_30",
    description: "Escalates invoices outstanding for more than 30 days to finance",
    conditions: {},
    actions: [{ type: "create_notification" }, { type: "create_activity_log" }],
    enabled: true,
  },
  {
    name: "Timesheet Missing Reminder",
    trigger: "timesheet_missing",
    description: "Reminds resources who have not submitted timesheets for the current week",
    conditions: {},
    actions: [{ type: "create_notification" }],
    enabled: true,
  },
  {
    name: "Staffing Risk on Proposal",
    trigger: "opportunity_proposal_staffing_risk",
    description: "Flags opportunities in Proposal stage with unmet staffing requirements",
    conditions: {},
    actions: [{ type: "create_notification" }, { type: "flag_entity" }],
    enabled: true,
  },
];

async function ensureNewAutomationsSeeded(): Promise<void> {
  try {
    const existing = await db.select().from(automationsTable);
    const existingTriggers = new Set(existing.map(a => a.trigger));
    for (const auto of SEED_AUTOMATIONS) {
      if (!existingTriggers.has(auto.trigger)) {
        await db.insert(automationsTable).values(auto as any);
      }
    }
  } catch (err) {
    console.error("[automations-seed]", err);
  }
}

ensureNewAutomationsSeeded();

// ─── ROUTES ─────────────────────────────────────────────────────────────────

router.get("/automations", async (_req, res): Promise<void> => {
  const automations = await db.select().from(automationsTable).orderBy(automationsTable.name);
  res.json(automations);
});

router.put("/automations/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { id: _id, createdAt, ...updates } = req.body;
  const [automation] = await db.update(automationsTable).set(updates).where(eq(automationsTable.id, id)).returning();
  if (!automation) { res.status(404).json({ error: "Not found" }); return; }
  res.json(automation);
});

router.post("/automations/:id/toggle", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [current] = await db.select().from(automationsTable).where(eq(automationsTable.id, id));
  if (!current) { res.status(404).json({ error: "Not found" }); return; }
  const [updated] = await db.update(automationsTable)
    .set({ enabled: !current.enabled })
    .where(eq(automationsTable.id, id))
    .returning();
  res.json(updated);
});

// ── Run-all MUST be before /:id/run to avoid Express matching "run" as an id
router.post("/automations/run", async (_req, res): Promise<void> => {
  const automations = await db.select().from(automationsTable);
  const active = automations.filter(a => a.enabled);

  const results: RunSummary[] = [];
  for (const automation of active) {
    const result = await runAutomation(automation);
    results.push(result);
  }

  res.json({
    ran: active.length,
    succeeded: results.filter(r => r.outcome === "success").length,
    noMatch: results.filter(r => r.outcome === "no_match").length,
    errors: results.filter(r => r.outcome === "error").length,
    results,
  });
});

// Run a single automation with real trigger evaluation
router.post("/automations/:id/run", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [automation] = await db.select().from(automationsTable).where(eq(automationsTable.id, id));
  if (!automation) { res.status(404).json({ error: "Not found" }); return; }
  const summary = await runAutomation(automation);
  res.json(summary);
});

// Execution log (spec-requested endpoint)
router.get("/automations/executions", async (req, res): Promise<void> => {
  const { automationId, limit = "100" } = req.query as Record<string, string>;
  let runs = await db.select().from(automationRunsTable).orderBy(desc(automationRunsTable.createdAt));
  if (automationId) runs = runs.filter(r => r.automationId === parseInt(automationId));
  res.json(runs.slice(0, parseInt(limit)));
});

// Legacy audit-log endpoint — kept for backward compat
router.get("/automation-runs", async (req, res): Promise<void> => {
  const { automationId, limit = "100" } = req.query as Record<string, string>;
  let runs = await db.select().from(automationRunsTable).orderBy(desc(automationRunsTable.createdAt));
  if (automationId) runs = runs.filter(r => r.automationId === parseInt(automationId));
  res.json(runs.slice(0, parseInt(limit)));
});

export default router;
