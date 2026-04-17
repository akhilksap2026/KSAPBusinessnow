import { Router, type IRouter } from "express";
import { eq, or, sql } from "drizzle-orm";
import { db, savedFiltersTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/saved-filters", async (req, res): Promise<void> => {
  const { context } = req.query as Record<string, string>;
  const currentUserId = parseInt(req.headers["x-user-id"] as string) || 1;

  let filters;
  if (context) {
    filters = await db.select().from(savedFiltersTable)
      .where(
        sql`(${savedFiltersTable.ownerId} = ${currentUserId} OR ${savedFiltersTable.isShared} = true) AND ${savedFiltersTable.filterContext} = ${context}`
      )
      .orderBy(savedFiltersTable.name);
  } else {
    filters = await db.select().from(savedFiltersTable)
      .where(
        or(
          eq(savedFiltersTable.ownerId, currentUserId),
          eq(savedFiltersTable.isShared, true)
        )
      )
      .orderBy(savedFiltersTable.name);
  }

  res.json(filters.map(f => ({
    ...f,
    isOwner: f.ownerId === currentUserId,
  })));
});

router.post("/saved-filters", async (req, res): Promise<void> => {
  const { name, ownerId, isShared = false, filterContext, filterJson } = req.body;
  if (!name || !ownerId || !filterContext || !filterJson) {
    res.status(400).json({ error: "name, ownerId, filterContext, filterJson required" }); return;
  }

  const [filter] = await db.insert(savedFiltersTable).values({
    name,
    ownerId: parseInt(ownerId),
    isShared: Boolean(isShared),
    filterContext,
    filterJson,
  }).returning();

  res.status(201).json(filter);
});

router.delete("/saved-filters/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const currentUserId = parseInt(req.headers["x-user-id"] as string) || 1;
  const [filter] = await db.select().from(savedFiltersTable).where(eq(savedFiltersTable.id, id));

  if (!filter) { res.status(404).json({ error: "Not found" }); return; }
  if (filter.ownerId !== currentUserId) {
    res.status(403).json({ error: "Not authorized" }); return;
  }

  await db.delete(savedFiltersTable).where(eq(savedFiltersTable.id, id));
  res.json({ ok: true });
});

export default router;
