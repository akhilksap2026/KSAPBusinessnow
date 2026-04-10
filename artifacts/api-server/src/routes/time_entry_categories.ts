import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, timeEntryCategoriesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/time-entry-categories", async (_req, res): Promise<void> => {
  const cats = await db.select().from(timeEntryCategoriesTable).orderBy(asc(timeEntryCategoriesTable.sortOrder), asc(timeEntryCategoriesTable.name));
  res.json(cats);
});

router.post("/time-entry-categories", async (req, res): Promise<void> => {
  const { name, code, defaultBillable, sortOrder, isActive } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const [cat] = await db.insert(timeEntryCategoriesTable).values({ name, code: code || null, defaultBillable: defaultBillable ?? true, sortOrder: sortOrder ?? 0, isActive: isActive ?? true }).returning();
  res.status(201).json(cat);
});

router.put("/time-entry-categories/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { id: _id, createdAt, ...updates } = req.body;
  const [cat] = await db.update(timeEntryCategoriesTable).set(updates).where(eq(timeEntryCategoriesTable.id, id)).returning();
  if (!cat) { res.status(404).json({ error: "Not found" }); return; }
  res.json(cat);
});

router.delete("/time-entry-categories/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(timeEntryCategoriesTable).where(eq(timeEntryCategoriesTable.id, id));
  res.json({ ok: true });
});

export default router;
