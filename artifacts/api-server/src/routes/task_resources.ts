import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, taskResourcesTable, resourcesTable, taskResourceDailyPlanTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/tasks/:taskId/resources", async (req, res): Promise<void> => {
  const taskId = parseInt(req.params.taskId);
  if (isNaN(taskId)) { res.status(400).json({ error: "Invalid taskId" }); return; }

  const rows = await db.select().from(taskResourcesTable).where(eq(taskResourcesTable.taskId, taskId));
  if (rows.length === 0) { res.json([]); return; }

  const resources = await db.select({ id: resourcesTable.id, name: resourcesTable.name })
    .from(resourcesTable);
  const resMap: Record<number, typeof resources[0]> = {};
  resources.forEach(r => { resMap[r.id] = r; });

  res.json(rows.map(r => ({
    id: r.id,
    taskId: r.taskId,
    resourceId: r.resourceId,
    resourceName: resMap[r.resourceId]?.name ?? "Unknown",
    resourceRole: r.role ?? null,
    estimatedHours: r.estimatedHours ? parseFloat(r.estimatedHours) : null,
    role: r.role,
  })));
});

router.post("/tasks/:taskId/resources", async (req, res): Promise<void> => {
  const taskId = parseInt(req.params.taskId);
  if (isNaN(taskId)) { res.status(400).json({ error: "Invalid taskId" }); return; }

  const { resourceId, estimatedHours, role } = req.body;
  if (!resourceId) { res.status(400).json({ error: "resourceId required" }); return; }

  const existing = await db.select().from(taskResourcesTable).where(
    and(eq(taskResourcesTable.taskId, taskId), eq(taskResourcesTable.resourceId, parseInt(resourceId)))
  );
  if (existing.length > 0) { res.status(409).json({ error: "Resource already assigned to this task" }); return; }

  const [row] = await db.insert(taskResourcesTable).values({
    taskId,
    resourceId: parseInt(resourceId),
    estimatedHours: estimatedHours ? String(estimatedHours) : null,
    role: role || null,
  }).returning();

  const [resource] = await db.select({ name: resourcesTable.name })
    .from(resourcesTable).where(eq(resourcesTable.id, row.resourceId));

  res.status(201).json({
    id: row.id,
    taskId: row.taskId,
    resourceId: row.resourceId,
    resourceName: resource?.name ?? "Unknown",
    resourceRole: row.role ?? null,
    estimatedHours: row.estimatedHours ? parseFloat(row.estimatedHours) : null,
    role: row.role,
  });
});

router.put("/tasks/:taskId/resources/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { estimatedHours, role } = req.body;
  const [row] = await db.update(taskResourcesTable).set({
    estimatedHours: estimatedHours !== undefined ? String(estimatedHours) : undefined,
    role: role !== undefined ? role : undefined,
  }).where(eq(taskResourcesTable.id, id)).returning();

  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ id: row.id, taskId: row.taskId, resourceId: row.resourceId, estimatedHours: row.estimatedHours ? parseFloat(row.estimatedHours) : null, role: row.role });
});

router.delete("/tasks/:taskId/resources/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(taskResourcesTable).where(eq(taskResourcesTable.id, id));
  res.json({ ok: true });
});

// ── Daily Plan endpoints ──────────────────────────────────────────────────────

// GET /tasks/:taskId/daily-plan?resourceId=X
router.get("/tasks/:taskId/daily-plan", async (req, res): Promise<void> => {
  const taskId = parseInt(req.params.taskId);
  const resourceId = parseInt(req.query.resourceId as string);
  if (isNaN(taskId) || isNaN(resourceId)) {
    res.status(400).json({ error: "taskId and resourceId are required" }); return;
  }

  const rows = await db
    .select({ planDate: taskResourceDailyPlanTable.planDate, plannedHours: taskResourceDailyPlanTable.plannedHours })
    .from(taskResourceDailyPlanTable)
    .where(and(
      eq(taskResourceDailyPlanTable.taskId, taskId),
      eq(taskResourceDailyPlanTable.resourceId, resourceId),
    ))
    .orderBy(taskResourceDailyPlanTable.planDate);

  res.json(rows.map(r => ({
    planDate: r.planDate,
    plannedHours: parseFloat(r.plannedHours),
  })));
});

// POST /tasks/:taskId/daily-plan — generate/upsert Mon–Fri rows, sync estimatedHours
router.post("/tasks/:taskId/daily-plan", async (req, res): Promise<void> => {
  const taskId = parseInt(req.params.taskId);
  if (isNaN(taskId)) { res.status(400).json({ error: "Invalid taskId" }); return; }

  const { resourceId, dailyHours, startDate, endDate } = req.body;
  if (!resourceId || dailyHours == null || !startDate || !endDate) {
    res.status(400).json({ error: "resourceId, dailyHours, startDate, endDate are required" }); return;
  }

  const resId = parseInt(resourceId);
  const hours = parseFloat(dailyHours);
  if (isNaN(resId) || isNaN(hours) || hours < 0) {
    res.status(400).json({ error: "Invalid resourceId or dailyHours" }); return;
  }

  // Generate one row per working day (Mon–Fri) between startDate and endDate inclusive
  const workingDays: string[] = [];
  const cursor = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  while (cursor <= end) {
    const dow = cursor.getDay(); // 0=Sun, 6=Sat
    if (dow !== 0 && dow !== 6) {
      workingDays.push(cursor.toISOString().split("T")[0]);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (workingDays.length === 0) {
    res.status(400).json({ error: "No working days found in the specified range" }); return;
  }

  // Upsert each working day using raw SQL ON CONFLICT DO UPDATE
  for (const planDate of workingDays) {
    await db.execute(sql`
      INSERT INTO task_resource_daily_plan (task_id, resource_id, plan_date, planned_hours)
      VALUES (${taskId}, ${resId}, ${planDate}, ${String(hours)})
      ON CONFLICT (task_id, resource_id, plan_date) DO UPDATE SET planned_hours = EXCLUDED.planned_hours
    `);
  }

  // Recompute estimatedHours = SUM of all daily plan rows for this resource on this task
  const sumResult = await db.execute<{ total: string }>(sql`
    SELECT COALESCE(SUM(planned_hours), 0) AS total
    FROM task_resource_daily_plan
    WHERE task_id = ${taskId} AND resource_id = ${resId}
  `);

  const total = parseFloat(sumResult.rows[0]?.total ?? "0");

  // Sync task_resources.estimated_hours — update existing row or insert a new one
  const existingTr = await db.select({ id: taskResourcesTable.id })
    .from(taskResourcesTable)
    .where(and(eq(taskResourcesTable.taskId, taskId), eq(taskResourcesTable.resourceId, resId)));

  if (existingTr.length > 0) {
    await db.update(taskResourcesTable)
      .set({ estimatedHours: String(total) })
      .where(eq(taskResourcesTable.id, existingTr[0].id));
  } else {
    await db.insert(taskResourcesTable).values({ taskId, resourceId: resId, estimatedHours: String(total) });
  }

  res.status(201).json({
    rowsCreated: workingDays.length,
    totalPlannedHours: total,
    planDates: workingDays,
  });
});

// DELETE /tasks/:taskId/daily-plan?resourceId=X — remove all plan rows, zero out estimatedHours
router.delete("/tasks/:taskId/daily-plan", async (req, res): Promise<void> => {
  const taskId = parseInt(req.params.taskId);
  const resourceId = parseInt(req.query.resourceId as string);
  if (isNaN(taskId) || isNaN(resourceId)) {
    res.status(400).json({ error: "taskId and resourceId are required" }); return;
  }

  await db.delete(taskResourceDailyPlanTable).where(
    and(
      eq(taskResourceDailyPlanTable.taskId, taskId),
      eq(taskResourceDailyPlanTable.resourceId, resourceId),
    )
  );

  // Zero out estimatedHours on the task_resources row (if it exists)
  await db.update(taskResourcesTable)
    .set({ estimatedHours: "0" })
    .where(and(eq(taskResourcesTable.taskId, taskId), eq(taskResourcesTable.resourceId, resourceId)));

  res.json({ ok: true });
});

export default router;
