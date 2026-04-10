import { Router, type IRouter } from "express";
import { eq, asc, inArray } from "drizzle-orm";
import { db, templateTasksTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/template-tasks", async (req, res): Promise<void> => {
  const { templateId } = req.query as Record<string, string>;
  if (!templateId) { res.status(400).json({ error: "templateId required" }); return; }
  const tasks = await db.select().from(templateTasksTable)
    .where(eq(templateTasksTable.templateId, parseInt(templateId)))
    .orderBy(asc(templateTasksTable.sortOrder), asc(templateTasksTable.id));
  res.json(tasks);
});

router.post("/template-tasks", async (req, res): Promise<void> => {
  const { templateId, parentId, name, taskType, sortOrder, estimatedHours, durationDays, resourceRole, depType, predecessorIds, notes } = req.body;
  if (!templateId || !name) { res.status(400).json({ error: "templateId and name required" }); return; }
  const [task] = await db.insert(templateTasksTable).values({
    templateId: parseInt(templateId),
    parentId: parentId ? parseInt(parentId) : null,
    name, taskType: taskType ?? "work",
    sortOrder: sortOrder ?? 0,
    estimatedHours: estimatedHours ? String(estimatedHours) : null,
    durationDays: durationDays ? parseInt(durationDays) : null,
    resourceRole: resourceRole ?? null,
    depType: depType ?? "FS",
    predecessorIds: predecessorIds ?? [],
    notes: notes ?? null,
  }).returning();
  res.status(201).json(task);
});

router.put("/template-tasks/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { name, taskType, parentId, sortOrder, estimatedHours, durationDays, resourceRole, depType, predecessorIds, notes } = req.body;
  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (taskType !== undefined) updates.taskType = taskType;
  if (parentId !== undefined) updates.parentId = parentId ? parseInt(parentId) : null;
  if (sortOrder !== undefined) updates.sortOrder = parseInt(sortOrder);
  if (estimatedHours !== undefined) updates.estimatedHours = estimatedHours ? String(estimatedHours) : null;
  if (durationDays !== undefined) updates.durationDays = durationDays ? parseInt(durationDays) : null;
  if (resourceRole !== undefined) updates.resourceRole = resourceRole || null;
  if (depType !== undefined) updates.depType = depType;
  if (predecessorIds !== undefined) updates.predecessorIds = predecessorIds;
  if (notes !== undefined) updates.notes = notes || null;
  const [updated] = await db.update(templateTasksTable).set(updates).where(eq(templateTasksTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/template-tasks/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  // Cascade: delete all descendants using BFS across full cursor set
  const toDelete = [id];
  let cursor = [id];
  while (cursor.length > 0) {
    const children = await db.select({ id: templateTasksTable.id })
      .from(templateTasksTable)
      .where(inArray(templateTasksTable.parentId, cursor));
    if (children.length > 0) {
      const childIds = children.map(c => c.id);
      toDelete.push(...childIds);
      cursor = childIds;
    } else { cursor = []; }
  }
  // Delete deepest first to avoid FK issues if any
  for (const tid of toDelete.reverse()) {
    await db.delete(templateTasksTable).where(eq(templateTasksTable.id, tid));
  }
  res.json({ ok: true });
});

export default router;
