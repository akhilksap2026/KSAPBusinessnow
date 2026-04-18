import { Router, type IRouter } from "express";
import { eq, sql, and, inArray } from "drizzle-orm";
import { db, timesheetsTable, resourcesTable, tasksTable, allocationsTable, rateCardsTable, usersTable } from "@workspace/db";
import { z } from "zod";
import {
  ListTimesheetsQueryParams,
} from "@workspace/api-zod";

// Full-fidelity schema for creating a timesheet entry.
// Accepts hoursLogged / billableHours as either string or number (Drizzle stores them as
// numeric strings in Postgres, but the frontend sends JS floats).
const CreateTimesheetInput = z.object({
  projectId:     z.number().int(),
  projectName:   z.string().optional().nullable(),
  resourceId:    z.number().int(),
  resourceName:  z.string().optional().nullable(),
  weekStart:     z.string(),
  entryDate:     z.string().optional().nullable(),
  hoursLogged:   z.union([z.string(), z.number()]).transform(v => String(v)),
  billableHours: z.union([z.string(), z.number(), z.null()]).optional().transform(v => (v != null ? String(v) : null)),
  status:        z.string().optional(),
  notes:         z.string().optional().nullable(),
  dailyComment:  z.string().optional().nullable(),
  taskId:        z.number().int().optional().nullable(),
  categoryId:    z.number().int().optional().nullable(),
  isBillable:    z.boolean().optional(),
  activityType:  z.string().optional(),
  isCollaboration: z.boolean().optional(),
});

function parseTimesheet(t: typeof timesheetsTable.$inferSelect) {
  return {
    ...t,
    hoursLogged: parseFloat(t.hoursLogged),
    billableHours: t.billableHours ? parseFloat(t.billableHours) : null,
  };
}

// ── loggedHours aggregation helper ───────────────────────────────────────────
// Adjusts tasks.loggedHours by `delta` (positive = add, negative = subtract).
// Uses GREATEST(0, ...) so the column never goes below 0.
// No-ops if taskId is null/undefined (entry not linked to a task).
async function adjustTaskLoggedHours(taskId: number | null | undefined, delta: number): Promise<void> {
  if (!taskId || delta === 0) return;
  await db
    .update(tasksTable)
    .set({
      loggedHours: sql`GREATEST(0, COALESCE(${tasksTable.loggedHours}, 0) + ${delta})`,
    })
    .where(eq(tasksTable.id, taskId));
}

const router: IRouter = Router();

router.get("/timesheets/missing", async (req, res): Promise<void> => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysToMonday);
  const weekStart = monday.toISOString().split("T")[0];

  const [allResources, weekTimesheets] = await Promise.all([
    db.select({ id: resourcesTable.id, name: resourcesTable.name })
      .from(resourcesTable)
      .where(eq(resourcesTable.status, "available")),
    db.select({ resourceId: timesheetsTable.resourceId, status: timesheetsTable.status })
      .from(timesheetsTable)
      .where(eq(timesheetsTable.weekStart, weekStart)),
  ]);

  const submittedResourceIds = new Set(
    weekTimesheets
      .filter(t => t.status === "submitted" || t.status === "approved")
      .map(t => t.resourceId)
  );

  const missingResources = allResources.filter(r => !submittedResourceIds.has(r.id));

  res.json({
    weekStart,
    missingCount: missingResources.length,
    totalResources: allResources.length,
    missingResources,
  });
});

async function resolveResourceIdForUser(dbUserId: number): Promise<number | null> {
  const [r] = await db.select({ id: resourcesTable.id }).from(resourcesTable)
    .where(eq(resourcesTable.userId, dbUserId)).limit(1);
  return r?.id ?? null;
}

router.get("/timesheets", async (req, res): Promise<void> => {
  const query = ListTimesheetsQueryParams.safeParse(req.query);
  const { contextUserId } = req.query as Record<string, string>;
  let timesheets = await db.select().from(timesheetsTable).orderBy(timesheetsTable.weekStart);

  let effectiveResourceId: number | null = null;
  if (query.success && query.data.resourceId) {
    effectiveResourceId = query.data.resourceId;
  } else if (contextUserId) {
    effectiveResourceId = await resolveResourceIdForUser(parseInt(contextUserId, 10));
  }

  if (query.success) {
    if (query.data.projectId) timesheets = timesheets.filter((t) => t.projectId === query.data.projectId);
    if (effectiveResourceId) timesheets = timesheets.filter((t) => t.resourceId === effectiveResourceId);
    if (query.data.status) timesheets = timesheets.filter((t) => t.status === query.data.status);
    if (query.data.weekStart) timesheets = timesheets.filter((t) => t.weekStart === query.data.weekStart);
  }
  const role = ((req.headers["x-user-role"] as string) || "consultant") as any;
  const SELL_RATE_ROLES = ["delivery_director", "project_manager", "finance_lead", "admin"];
  const COST_RATE_ROLES = ["delivery_director", "finance_lead", "admin"];
  const parsed = timesheets.map(parseTimesheet).map(t => {
    const out = { ...t };
    if (!SELL_RATE_ROLES.includes(role)) delete (out as any).sellRate;
    if (!COST_RATE_ROLES.includes(role)) delete (out as any).costRate;
    return out;
  });
  res.json(parsed);
});

router.post("/timesheets", async (req, res): Promise<void> => {
  // dailyComment is required
  if (!req.body?.dailyComment?.trim()) {
    res.status(400).json({ error: "dailyComment is required" });
    return;
  }
  const parsed = CreateTimesheetInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // ── Role auto-population ────────────────────────────────────────────────────
  // Attempt to auto-set billedRole, sellRate, costRate from resource + rate card.
  let billedRole: string | null = null;
  let sellRate: string | null = null;
  let costRate: string | null = null;
  try {
    const { projectId, resourceId } = parsed.data;
    // Get resource defaultRole + costRate
    const [resource] = await db.select({ defaultRole: resourcesTable.defaultRole, costRate: resourcesTable.costRate })
      .from(resourcesTable).where(eq(resourcesTable.id, resourceId));
    if (resource?.defaultRole) {
      billedRole = resource.defaultRole;
      costRate = resource.costRate ? String(resource.costRate) : null;
      // Find matching rate card (project-specific first, then template)
      const allCards = await db.select().from(rateCardsTable).where(eq(rateCardsTable.role, resource.defaultRole));
      const projectCard = allCards.find(c => c.projectId === projectId);
      const templateCard = allCards.find(c => c.isTemplate && !c.projectId);
      const card = projectCard ?? templateCard;
      if (card) {
        sellRate = card.sellRate ? String(card.sellRate) : card.billingRate ? String(card.billingRate) : null;
      }
    }
  } catch { /* non-blocking — proceed without rates */ }

  const values = { ...parsed.data, billedRole, sellRate, costRate } as any;
  const [timesheet] = await db.insert(timesheetsTable).values(values).returning();
  res.status(201).json(parseTimesheet(timesheet));
});

// Update timesheet hours / notes
router.put("/timesheets/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { hoursLogged, notes, isBillable, categoryId, taskId } = req.body as Record<string, any>;
  const updates: Record<string, any> = {};
  if (hoursLogged !== undefined) updates.hoursLogged = parseFloat(String(hoursLogged));
  if (notes !== undefined) updates.notes = notes;
  if (isBillable !== undefined) updates.isBillable = isBillable;
  if (categoryId !== undefined) updates.categoryId = categoryId ?? null;
  if (taskId !== undefined) updates.taskId = taskId ?? null;
  if (!Object.keys(updates).length) { res.status(400).json({ error: "No fields to update" }); return; }
  const [timesheet] = await db.update(timesheetsTable).set(updates).where(eq(timesheetsTable.id, id)).returning();
  if (!timesheet) { res.status(404).json({ error: "Not found" }); return; }
  res.json(parseTimesheet(timesheet));
});

// ── Future-week guard ────────────────────────────────────────────────────────
// Returns the ISO date string (YYYY-MM-DD) of the most recent Monday in UTC.
// Using UTC throughout avoids DST-induced off-by-one errors where e.g.
// "2026-04-13T00:00:00-04:00" (EDT) is actually "2026-04-13T04:00:00Z" (UTC
// Monday), and a naive local-time comparison would place it on the wrong day.
//
// Edge-case table (today = day-of-week, getUTCDay()):
//   Sunday  (0) → daysBack = 6  → subtract 6 days → previous Monday
//   Monday  (1) → daysBack = 0  → today IS Monday
//   Tuesday (2) → daysBack = 1
//   …
//   Saturday(6) → daysBack = 5
function currentUTCMonday(): string {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun … 6=Sat
  const daysBack = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysBack));
  return monday.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// Roles that are allowed to submit timesheets for future weeks on behalf of others.
const FUTURE_WEEK_BYPASS_ROLES = new Set(["admin", "pmo_manager", "delivery_director"]);

// Approve / reject / submit / reset a timesheet
// Also maintains tasks.loggedHours aggregate:
//   approve  → +hoursLogged on linked task
//   reject   → −hoursLogged if was previously approved
//   reset    → −hoursLogged if was previously approved
router.patch("/timesheets/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { action, rejectedReason, approvedByName, role } = req.body as {
    action: "approve" | "reject" | "submit" | "reset";
    rejectedReason?: string;
    approvedByName?: string;
    role?: string;
  };

  // Fetch current entry so we know the prior status and hours before updating.
  const [existing] = await db
    .select({ status: timesheetsTable.status, hoursLogged: timesheetsTable.hoursLogged, taskId: timesheetsTable.taskId })
    .from(timesheetsTable)
    .where(eq(timesheetsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const priorStatus = existing.status;
  const hours = parseFloat(existing.hoursLogged);

  const now = new Date().toISOString();
  let updates: Record<string, any> = {};

  if (action === "approve") {
    updates = { status: "approved", approvedAt: now, approvedByName: approvedByName || "Manager", rejectedAt: null, rejectedReason: null };
  } else if (action === "reject") {
    updates = { status: "rejected", rejectedAt: now, rejectedReason: rejectedReason || null, approvedAt: null };
  } else if (action === "submit") {
    // Block submission of entries whose week hasn't started yet, unless the
    // caller is an admin/PMO/director submitting on behalf of a consultant.
    if (!FUTURE_WEEK_BYPASS_ROLES.has(role ?? "")) {
      const [entry] = await db.select({ weekStart: timesheetsTable.weekStart })
        .from(timesheetsTable)
        .where(eq(timesheetsTable.id, id));
      if (!entry) { res.status(404).json({ error: "Not found" }); return; }

      const thisMonday = currentUTCMonday(); // e.g. "2026-04-13"
      if (entry.weekStart > thisMonday) {
        res.status(422).json({
          error: "FUTURE_WEEK_SUBMISSION",
          message: `You cannot submit time for a week that has not started yet. Save as draft and submit after ${entry.weekStart}.`,
        });
        return;
      }
    }
    updates = { status: "submitted" };
  } else if (action === "reset") {
    updates = { status: "draft", approvedAt: null, rejectedAt: null, rejectedReason: null };
  } else {
    res.status(400).json({ error: "action must be approve | reject | submit | reset" });
    return;
  }

  const [timesheet] = await db.update(timesheetsTable).set(updates).where(eq(timesheetsTable.id, id)).returning();
  if (!timesheet) { res.status(404).json({ error: "Not found" }); return; }

  // ── Maintain tasks.loggedHours aggregate ──────────────────────────────────
  // approve: entry now counts toward task progress → add hours
  if (action === "approve") {
    await adjustTaskLoggedHours(existing.taskId, hours);
  }
  // reject / reset: if the entry was previously approved, its hours were already
  // credited — remove them now that it's no longer approved.
  if ((action === "reject" || action === "reset") && priorStatus === "approved") {
    await adjustTaskLoggedHours(existing.taskId, -hours);
  }

  res.json(parseTimesheet(timesheet));
});

// ── Pending Approval — for managers/directors ────────────────────────────────
router.get("/timesheets/pending-approval", async (req, res): Promise<void> => {
  try {
    const { projectId, resourceId, startDate, endDate } = req.query as Record<string, string>;
    let rows = await db.select().from(timesheetsTable)
      .where(eq(timesheetsTable.status, "submitted"));
    if (projectId) rows = rows.filter(r => r.projectId === parseInt(projectId));
    if (resourceId) rows = rows.filter(r => r.resourceId === parseInt(resourceId));
    if (startDate) rows = rows.filter(r => !r.entryDate || r.entryDate >= startDate);
    if (endDate) rows = rows.filter(r => !r.entryDate || r.entryDate <= endDate);
    res.json(rows.map(parseTimesheet));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Bulk Approve ──────────────────────────────────────────────────────────────
router.post("/timesheets/approve", async (req, res): Promise<void> => {
  try {
    const { ids, approvedByName } = req.body as { ids: number[]; approvedByName?: string };
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "ids array required" }); return;
    }
    const now = new Date().toISOString();
    const updated = await db.update(timesheetsTable)
      .set({ status: "approved", approvedAt: now, approvedByName: approvedByName ?? "Manager", rejectedAt: null, rejectedReason: null })
      .where(inArray(timesheetsTable.id, ids))
      .returning();
    // Adjust loggedHours for each newly-approved entry
    for (const t of updated) {
      await adjustTaskLoggedHours(t.taskId, parseFloat(t.hoursLogged));
    }
    res.json({ approved: updated.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Bulk Reject ───────────────────────────────────────────────────────────────
router.post("/timesheets/reject", async (req, res): Promise<void> => {
  try {
    const { ids, reason } = req.body as { ids: number[]; reason?: string };
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "ids array required" }); return;
    }
    const now = new Date().toISOString();
    const updated = await db.update(timesheetsTable)
      .set({ status: "rejected", rejectedAt: now, rejectedReason: reason ?? null, approvedAt: null })
      .where(inArray(timesheetsTable.id, ids))
      .returning();
    // If any were previously approved, subtract hours from task
    for (const t of updated) {
      if (t.status === "approved") await adjustTaskLoggedHours(t.taskId, -parseFloat(t.hoursLogged));
    }
    res.json({ rejected: updated.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a timesheet entry.
// If the entry was approved and linked to a task, subtracts its hours from
// tasks.loggedHours so the task aggregate stays accurate.
router.delete("/timesheets/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db
    .select({ status: timesheetsTable.status, hoursLogged: timesheetsTable.hoursLogged, taskId: timesheetsTable.taskId })
    .from(timesheetsTable)
    .where(eq(timesheetsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  await db.delete(timesheetsTable).where(eq(timesheetsTable.id, id));

  // Compensate tasks.loggedHours if the deleted entry had been approved.
  if (existing.status === "approved") {
    await adjustTaskLoggedHours(existing.taskId, -parseFloat(existing.hoursLogged));
  }

  res.json({ ok: true });
});

export default router;
