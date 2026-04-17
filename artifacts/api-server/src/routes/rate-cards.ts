import { Router } from "express";
import { db, rateCardsTable } from "@workspace/db";
import { eq, and, or, isNull } from "drizzle-orm";

const router = Router();

router.get("/rate-cards", async (req, res) => {
  try {
    const { projectId, accountId } = req.query;
    const conditions = [];
    if (projectId) conditions.push(eq(rateCardsTable.projectId, parseInt(projectId as string)));
    if (accountId) conditions.push(eq(rateCardsTable.accountId, parseInt(accountId as string)));

    let rows;
    if (conditions.length > 0) {
      rows = await db.select().from(rateCardsTable).where(or(...conditions));
    } else {
      rows = await db.select().from(rateCardsTable);
    }
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/rate-cards", async (req, res) => {
  try {
    const [row] = await db.insert(rateCardsTable).values(req.body).returning();
    res.status(201).json(row);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.put("/rate-cards/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { id: _id, createdAt, ...body } = req.body;
    const [row] = await db.update(rateCardsTable).set(body).where(eq(rateCardsTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/rate-cards/:id", async (req, res) => {
  try {
    await db.delete(rateCardsTable).where(eq(rateCardsTable.id, parseInt(req.params.id)));
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
