import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, rateCardsTable } from "@workspace/db";

function parseRateCard(r: typeof rateCardsTable.$inferSelect) {
  return {
    ...r,
    billingRate: parseFloat(r.billingRate as string),
    costRate: r.costRate ? parseFloat(r.costRate as string) : null,
  };
}

const router: IRouter = Router();

router.get("/rate-cards", async (req, res): Promise<void> => {
  const { projectId, accountId, role } = req.query as Record<string, string>;
  let cards = await db.select().from(rateCardsTable).orderBy(rateCardsTable.role);
  if (projectId) cards = cards.filter(c => c.projectId === parseInt(projectId));
  if (accountId) cards = cards.filter(c => c.accountId === parseInt(accountId));
  if (role) cards = cards.filter(c => c.role === role);
  res.json(cards.map(parseRateCard));
});

router.post("/rate-cards", async (req, res): Promise<void> => {
  const { name, role, billingRate, costRate, ...rest } = req.body;
  if (!name || !role || !billingRate) {
    res.status(400).json({ error: "name, role, billingRate required" });
    return;
  }
  const [card] = await db.insert(rateCardsTable).values({ name, role, billingRate, costRate: costRate || null, ...rest }).returning();
  res.status(201).json(parseRateCard(card));
});

router.put("/rate-cards/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { id: _id, createdAt, ...updates } = req.body;
  const [card] = await db.update(rateCardsTable).set(updates).where(eq(rateCardsTable.id, id)).returning();
  if (!card) { res.status(404).json({ error: "Not found" }); return; }
  res.json(parseRateCard(card));
});

router.delete("/rate-cards/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(rateCardsTable).where(eq(rateCardsTable.id, id));
  res.json({ ok: true });
});

export default router;
