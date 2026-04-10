import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, allocationsTable, resourcesTable } from "@workspace/db";

function parseAllocation(a: typeof allocationsTable.$inferSelect) {
  return { ...a, hoursPerWeek: a.hoursPerWeek ? parseFloat(a.hoursPerWeek) : null };
}

const router: IRouter = Router();

router.get("/allocations", async (req, res): Promise<void> => {
  const { projectId, resourceId, status, allocationType } = req.query as Record<string, string>;
  let allocations = await db.select().from(allocationsTable).orderBy(allocationsTable.startDate);
  if (projectId) allocations = allocations.filter(a => a.projectId === parseInt(projectId));
  if (resourceId) allocations = allocations.filter(a => a.resourceId === parseInt(resourceId));
  if (status) allocations = allocations.filter(a => a.status === status);
  if (allocationType) allocations = allocations.filter(a => a.allocationType === allocationType);
  res.json(allocations.map(parseAllocation));
});

router.post("/allocations", async (req, res): Promise<void> => {
  const { projectId, resourceId, allocationPct, ...rest } = req.body;
  if (!projectId || !resourceId) { res.status(400).json({ error: "projectId and resourceId required" }); return; }
  const [allocation] = await db.insert(allocationsTable).values({
    projectId: parseInt(projectId), resourceId: parseInt(resourceId),
    allocationPct: allocationPct || 100, ...rest,
  }).returning();
  res.status(201).json(parseAllocation(allocation));
});

// Fill-range: create one allocation record spanning the given date range
router.post("/allocations/fill-range", async (req, res): Promise<void> => {
  const { projectId, resourceId, startDate, endDate, allocationPct, allocationType, roleOnProject, notes } = req.body;
  if (!projectId || !resourceId || !startDate || !endDate) {
    res.status(400).json({ error: "projectId, resourceId, startDate, endDate required" }); return;
  }
  const pct = parseFloat(String(allocationPct ?? 100));
  if (isNaN(pct) || pct <= 0 || pct > 200) {
    res.status(400).json({ error: "allocationPct must be between 1 and 200" }); return;
  }
  const resource = await db.select({ name: resourcesTable.name }).from(resourcesTable).where(eq(resourcesTable.id, parseInt(resourceId))).then(r => r[0]);
  const [allocation] = await db.insert(allocationsTable).values({
    projectId: parseInt(projectId),
    resourceId: parseInt(resourceId),
    resourceName: resource?.name ?? null,
    startDate,
    endDate,
    allocationPct: pct,
    allocationType: allocationType ?? "hard",
    roleOnProject: roleOnProject ?? null,
    notes: notes ?? null,
    status: "confirmed",
  }).returning();
  res.status(201).json(parseAllocation(allocation));
});

router.put("/allocations/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { id: _id, createdAt, ...updates } = req.body;
  const [allocation] = await db.update(allocationsTable).set(updates).where(eq(allocationsTable.id, id)).returning();
  if (!allocation) { res.status(404).json({ error: "Not found" }); return; }
  res.json(parseAllocation(allocation));
});

router.patch("/allocations/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { id: _id, createdAt, ...updates } = req.body;
  const [allocation] = await db.update(allocationsTable).set(updates).where(eq(allocationsTable.id, id)).returning();
  if (!allocation) { res.status(404).json({ error: "Not found" }); return; }
  res.json(parseAllocation(allocation));
});

router.delete("/allocations/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(allocationsTable).where(eq(allocationsTable.id, id));
  res.json({ ok: true });
});

export default router;
