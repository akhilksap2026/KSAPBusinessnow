import { Router } from "express";
import { db } from "@workspace/db";
import { opportunitiesTable } from "@workspace/db/schema";
import { eq, desc, and, ilike } from "drizzle-orm";

const router = Router();

// GET /api/opportunities — list, optional ?stage=&accountId=&type=&q=
router.get("/opportunities", async (req, res) => {
  try {
    const { stage, accountId, type, q } = req.query as Record<string, string>;
    const conditions = [];
    if (stage && stage !== "all") conditions.push(eq(opportunitiesTable.stage, stage));
    if (accountId) conditions.push(eq(opportunitiesTable.accountId, Number(accountId)));
    if (type && type !== "all") conditions.push(eq(opportunitiesTable.type, type));
    if (q) conditions.push(ilike(opportunitiesTable.name, `%${q}%`));

    const rows = await db
      .select()
      .from(opportunitiesTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(opportunitiesTable.updatedAt));

    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/opportunities/:id — single
router.get("/opportunities/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/opportunities — create
router.post("/opportunities", async (req, res) => {
  try {
    const [row] = await db.insert(opportunitiesTable).values(req.body).returning();
    res.status(201).json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/opportunities/:id — update
router.patch("/opportunities/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db
      .update(opportunitiesTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(opportunitiesTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/opportunities/:id — delete
router.delete("/opportunities/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(opportunitiesTable).where(eq(opportunitiesTable.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
