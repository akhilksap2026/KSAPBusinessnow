import { Router, type IRouter } from "express";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db, tasksTable, taskDependenciesTable, taskResourcesTable, taskAssignmentsTable, resourcesTable, timesheetsTable } from "@workspace/db";
import { scheduleProject } from "../lib/scheduler";

const SCHEDULE_DATE_FIELDS = new Set(["plannedStartDate", "plannedEndDate", "durationDays"]);

function triggerSchedule(projectId: number) {
  scheduleProject(projectId).catch(err =>
    console.error("[scheduler] Error scheduling project", projectId, err)
  );
}

function parseTask(t: typeof tasksTable.$inferSelect) {
  return {
    ...t,
    estimatedHours: t.estimatedHours ? parseFloat(t.estimatedHours) : null,
    loggedHours: t.loggedHours ? parseFloat(t.loggedHours) : null,
    etcHours: t.etcHours ? parseFloat(t.etcHours) : null,
    hierarchyLevel: t.hierarchyLevel ?? 0,
    isLeaf: t.isLeaf ?? true,
    commentCount: t.commentCount ?? 0,
    parentId: t.parentId ?? null,
  };
}

const router: IRouter = Router();

router.get("/tasks", async (req, res): Promise<void> => {
  const { projectId, milestoneId, assignedTo, status, phaseId, priority, parentTaskId } = req.query as Record<string, string>;
  let tasks = await db.select().from(tasksTable).orderBy(tasksTable.createdAt);
  if (projectId) tasks = tasks.filter((t) => t.projectId === parseInt(projectId));
  if (milestoneId) tasks = tasks.filter((t) => t.milestoneId === parseInt(milestoneId));
  if (assignedTo) tasks = tasks.filter((t) => t.assignedToId === parseInt(assignedTo));
  if (status) tasks = tasks.filter((t) => t.status === status);
  if (priority) tasks = tasks.filter((t) => t.priority === priority);
  if (phaseId) tasks = tasks.filter((t) => (t as any).phaseId === parseInt(phaseId));
  if (parentTaskId === "null" || parentTaskId === "") {
    tasks = tasks.filter((t) => t.parentId === null);
  } else if (parentTaskId) {
    tasks = tasks.filter((t) => t.parentId === parseInt(parentTaskId));
  }

  const { projectsTable } = await import("@workspace/db");
  const projects = await db.select({ id: projectsTable.id, name: projectsTable.name }).from(projectsTable);
  const projectMap: Record<number, string> = {};
  projects.forEach((p) => { projectMap[p.id] = p.name; });

  res.json(tasks.map((t) => ({ ...parseTask(t), projectName: projectMap[t.projectId] || null })));
});

// ─── All deps for a project (used by frontend to build depMap) ────────────────
router.get("/tasks/dependencies", async (req, res): Promise<void> => {
  const { projectId } = req.query as Record<string, string>;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  const projectTasks = await db.select().from(tasksTable)
    .where(eq(tasksTable.projectId, parseInt(projectId)));

  if (projectTasks.length === 0) { res.json([]); return; }

  const taskIds = projectTasks.map(t => t.id);
  const taskMap: Record<number, typeof tasksTable.$inferSelect> = {};
  projectTasks.forEach(t => { taskMap[t.id] = t; });

  const deps = await db.select().from(taskDependenciesTable)
    .where(inArray(taskDependenciesTable.taskId, taskIds));

  res.json(deps.map(d => ({
    id: d.id,
    taskId: d.taskId,
    dependsOnTaskId: d.dependsOnTaskId,
    dependsOnName: taskMap[d.dependsOnTaskId]?.name ?? "Unknown task",
    dependsOnStatus: taskMap[d.dependsOnTaskId]?.status ?? "unknown",
    dependencyType: d.dependencyType ?? "FS",
    lagDays: d.lagDays ?? 0,
  })));
});

router.post("/tasks", async (req, res): Promise<void> => {
  const { name, projectId, parentId, etcHours, ...rest } = req.body;
  if (!name || !projectId) { res.status(400).json({ error: "name and projectId required" }); return; }

  let hierarchyLevel = 0;
  let isLeaf = true;

  if (parentId) {
    const [parent] = await db.select().from(tasksTable).where(eq(tasksTable.id, parseInt(parentId)));
    if (parent) {
      hierarchyLevel = (parent.hierarchyLevel ?? 0) + 1;
      // Mark parent as non-leaf
      await db.update(tasksTable).set({ isLeaf: false }).where(eq(tasksTable.id, parseInt(parentId)));
    }
  }

  const [task] = await db.insert(tasksTable).values({
    name,
    projectId: parseInt(projectId),
    parentId: parentId ? parseInt(parentId) : null,
    etcHours: etcHours ? String(etcHours) : null,
    hierarchyLevel,
    isLeaf,
    ...rest,
  }).returning();

  res.status(201).json(parseTask(task));
});

router.get("/tasks/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
  if (!task) { res.status(404).json({ error: "Not found" }); return; }
  res.json(parseTask(task));
});

router.put("/tasks/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { id: _id, createdAt, updatedAt, ...updates } = req.body;

  // Soft warning: check if marking done while unfinished deps exist
  let dependencyWarning: string | null = null;
  if (updates.status === "done") {
    const deps = await db.select().from(taskDependenciesTable)
      .where(eq(taskDependenciesTable.taskId, id));
    if (deps.length > 0) {
      const depTaskIds = deps.map(d => d.dependsOnTaskId);
      const depTasks = await db.select().from(tasksTable)
        .where(inArray(tasksTable.id, depTaskIds));
      const incomplete = depTasks.filter(t => t.status !== "done" && t.status !== "cancelled");
      if (incomplete.length > 0) {
        dependencyWarning = `Depends on incomplete: ${incomplete.map(t => t.name).join(", ")}`;
      }
    }
  }

  const [task] = await db.update(tasksTable).set({ ...updates, updatedAt: new Date() }).where(eq(tasksTable.id, id)).returning();
  if (!task) { res.status(404).json({ error: "Not found" }); return; }

  const touchedSchedule = Object.keys(updates).some(k => SCHEDULE_DATE_FIELDS.has(k));
  const scheduleRecalculating = touchedSchedule;
  if (touchedSchedule) triggerSchedule(task.projectId);

  res.json({ ...parseTask(task), dependencyWarning, scheduleRecalculating });
});

// ─── PATCH /tasks/:id — partial update (same logic, always triggers scheduler) ──
router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { id: _id, createdAt, updatedAt, ...updates } = req.body;

  const [task] = await db.update(tasksTable).set({ ...updates, updatedAt: new Date() }).where(eq(tasksTable.id, id)).returning();
  if (!task) { res.status(404).json({ error: "Not found" }); return; }

  const touchedSchedule = Object.keys(updates).some(k => SCHEDULE_DATE_FIELDS.has(k));
  const scheduleRecalculating = touchedSchedule;
  if (touchedSchedule) triggerSchedule(task.projectId);

  res.json({ ...parseTask(task), scheduleRecalculating });
});

router.delete("/tasks/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(tasksTable).where(eq(tasksTable.id, id));
  res.json({ ok: true });
});

// ─── Resource Breakdown ───────────────────────────────────────────────────────
// Returns per-resource planned vs. actual hours for a task.
// loggedHours = SUM of approved timesheet entries for this task + resource.
router.get("/tasks/:id/resource-breakdown", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const resourceRows = await db
    .select()
    .from(taskResourcesTable)
    .where(eq(taskResourcesTable.taskId, id));

  if (resourceRows.length === 0) { res.json([]); return; }

  const resourceIds = resourceRows.map(r => r.resourceId);

  const [resources, approvedSums] = await Promise.all([
    // resourcesTable has no 'role' column — role comes from taskResourcesTable.role
    db.select({ id: resourcesTable.id, name: resourcesTable.name })
      .from(resourcesTable)
      .where(inArray(resourcesTable.id, resourceIds)),
    db.execute<{ resource_id: number; total_hours: string }>(sql`
      SELECT resource_id, SUM(hours_logged) AS total_hours
      FROM timesheets
      WHERE task_id = ${id}
        AND status = 'approved'
        AND resource_id = ANY(ARRAY[${sql.raw(resourceIds.join(","))}]::int[])
      GROUP BY resource_id
    `),
  ]);

  const resMap: Record<number, { name: string }> = {};
  resources.forEach(r => { resMap[r.id] = { name: r.name }; });

  const hoursMap: Record<number, number> = {};
  approvedSums.rows.forEach(row => { hoursMap[row.resource_id] = parseFloat(row.total_hours); });

  res.json(resourceRows.map(r => ({
    resourceId: r.resourceId,
    resourceName: resMap[r.resourceId]?.name ?? "Unknown",
    role: r.role ?? null,
    estimatedHours: r.estimatedHours ? parseFloat(r.estimatedHours) : null,
    loggedHours: hoursMap[r.resourceId] ?? 0,
  })));
});

// ─── Task Dependencies ────────────────────────────────────────────────────────
router.get("/tasks/:id/dependencies", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const deps = await db.select().from(taskDependenciesTable)
    .where(eq(taskDependenciesTable.taskId, id));

  if (deps.length === 0) { res.json([]); return; }

  const depTaskIds = deps.map(d => d.dependsOnTaskId);
  const depTasks = await db.select().from(tasksTable)
    .where(inArray(tasksTable.id, depTaskIds));
  const taskMap: Record<number, typeof tasksTable.$inferSelect> = {};
  depTasks.forEach(t => { taskMap[t.id] = t; });

  res.json(deps.map(d => ({
    id: d.id,
    dependsOnTaskId: d.dependsOnTaskId,
    dependsOnName: taskMap[d.dependsOnTaskId]?.name ?? "Unknown",
    dependsOnStatus: taskMap[d.dependsOnTaskId]?.status ?? "unknown",
  })));
});

router.post("/tasks/:id/dependencies", async (req, res): Promise<void> => {
  const taskId = parseInt(req.params.id);
  if (isNaN(taskId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { dependsOnTaskId, dependencyType = "FS", lagDays = 0 } = req.body;
  if (!dependsOnTaskId) { res.status(400).json({ error: "dependsOnTaskId required" }); return; }

  if (taskId === parseInt(dependsOnTaskId)) {
    res.status(400).json({ error: "A task cannot depend on itself" }); return;
  }

  const existing = await db.select().from(taskDependenciesTable)
    .where(and(
      eq(taskDependenciesTable.taskId, taskId),
      eq(taskDependenciesTable.dependsOnTaskId, parseInt(dependsOnTaskId))
    ));

  if (existing.length > 0) {
    res.status(409).json({ error: "Dependency already exists" }); return;
  }

  const [dep] = await db.insert(taskDependenciesTable)
    .values({ taskId, dependsOnTaskId: parseInt(dependsOnTaskId), dependencyType, lagDays: parseInt(String(lagDays)) || 0 })
    .returning();

  const [depTask] = await db.select().from(tasksTable).where(eq(tasksTable.id, dep.dependsOnTaskId));
  res.status(201).json({
    id: dep.id,
    taskId: dep.taskId,
    dependsOnTaskId: dep.dependsOnTaskId,
    dependsOnName: depTask?.name ?? "Unknown",
    dependsOnStatus: depTask?.status ?? "unknown",
    dependencyType: dep.dependencyType ?? "FS",
    lagDays: dep.lagDays ?? 0,
  });
});

router.delete("/tasks/:taskId/dependencies/:depId", async (req, res): Promise<void> => {
  const depId = parseInt(req.params.depId);
  if (isNaN(depId)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(taskDependenciesTable).where(eq(taskDependenciesTable.id, depId));
  res.json({ ok: true });
});

// ─── Task Assignments ─────────────────────────────────────────────────────────
router.get("/task-assignments", async (req, res): Promise<void> => {
  const { taskId } = req.query as Record<string, string>;
  if (!taskId) { res.status(400).json({ error: "taskId required" }); return; }

  const assignments = await db
    .select({
      id: taskAssignmentsTable.id,
      taskId: taskAssignmentsTable.taskId,
      resourceId: taskAssignmentsTable.resourceId,
      roleOnTask: taskAssignmentsTable.roleOnTask,
      estimatedHours: taskAssignmentsTable.estimatedHours,
      createdAt: taskAssignmentsTable.createdAt,
      resourceName: resourcesTable.name,
      resourceTitle: resourcesTable.title,
    })
    .from(taskAssignmentsTable)
    .leftJoin(resourcesTable, eq(taskAssignmentsTable.resourceId, resourcesTable.id))
    .where(eq(taskAssignmentsTable.taskId, parseInt(taskId)));

  res.json(assignments.map(a => ({
    ...a,
    estimatedHours: a.estimatedHours ? parseFloat(a.estimatedHours) : null,
  })));
});

router.post("/task-assignments", async (req, res): Promise<void> => {
  const { taskId, resourceId, roleOnTask, estimatedHours } = req.body;
  if (!taskId || !resourceId) { res.status(400).json({ error: "taskId and resourceId required" }); return; }

  const [assignment] = await db.insert(taskAssignmentsTable).values({
    taskId: parseInt(taskId),
    resourceId: parseInt(resourceId),
    roleOnTask: roleOnTask || null,
    estimatedHours: estimatedHours ? String(estimatedHours) : null,
  }).returning();

  const [resource] = await db.select({ name: resourcesTable.name, title: resourcesTable.title })
    .from(resourcesTable).where(eq(resourcesTable.id, assignment.resourceId));

  res.status(201).json({
    ...assignment,
    estimatedHours: assignment.estimatedHours ? parseFloat(assignment.estimatedHours) : null,
    resourceName: resource?.name,
    resourceTitle: resource?.title,
  });
});

router.delete("/task-assignments/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(taskAssignmentsTable).where(eq(taskAssignmentsTable.id, id));
  res.json({ ok: true });
});

// ─── Task Dependencies (flat, by taskId predecessor/successor format) ─────────
router.get("/task-dependencies", async (req, res): Promise<void> => {
  const { taskId } = req.query as Record<string, string>;
  if (!taskId) { res.status(400).json({ error: "taskId required" }); return; }
  const tid = parseInt(taskId);

  const [predsRaw, succsRaw] = await Promise.all([
    db.select().from(taskDependenciesTable).where(eq(taskDependenciesTable.dependsOnTaskId, tid)),
    db.select().from(taskDependenciesTable).where(eq(taskDependenciesTable.taskId, tid)),
  ]);

  const allTaskIds = [
    ...predsRaw.map(d => d.taskId),
    ...succsRaw.map(d => d.dependsOnTaskId),
  ].filter(Boolean);

  const taskRows = allTaskIds.length > 0
    ? await db.select({ id: tasksTable.id, name: tasksTable.name }).from(tasksTable).where(inArray(tasksTable.id, allTaskIds))
    : [];
  const taskMap: Record<number, string> = {};
  taskRows.forEach(t => { taskMap[t.id] = t.name; });

  res.json({
    predecessors: predsRaw.map(d => ({
      id: d.id,
      taskId: d.taskId,
      taskName: taskMap[d.taskId] ?? "Unknown",
      dependencyType: d.dependencyType ?? "FS",
      lagDays: d.lagDays ?? 0,
    })),
    successors: succsRaw.map(d => ({
      id: d.id,
      taskId: d.dependsOnTaskId,
      taskName: taskMap[d.dependsOnTaskId] ?? "Unknown",
      dependencyType: d.dependencyType ?? "FS",
      lagDays: d.lagDays ?? 0,
    })),
  });
});

router.post("/task-dependencies", async (req, res): Promise<void> => {
  const { predecessorTaskId, successorTaskId, dependencyType = "FS", lagDays = 0 } = req.body;
  if (!predecessorTaskId || !successorTaskId) {
    res.status(400).json({ error: "predecessorTaskId and successorTaskId required" }); return;
  }

  const valid = ["FS", "SS", "FF", "SF"];
  if (!valid.includes(dependencyType)) {
    res.status(400).json({ error: "dependencyType must be FS|SS|FF|SF" }); return;
  }

  const [dep] = await db.insert(taskDependenciesTable).values({
    taskId: parseInt(successorTaskId),
    dependsOnTaskId: parseInt(predecessorTaskId),
    dependencyType,
    lagDays: parseInt(String(lagDays)) || 0,
  }).returning();

  res.status(201).json({ ...dep, lagDays: dep.lagDays ?? 0 });
});

router.delete("/task-dependencies/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(taskDependenciesTable).where(eq(taskDependenciesTable.id, id));
  res.json({ ok: true });
});

export default router;
