import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, fxRatesTable } from "@workspace/db";

const router: IRouter = Router();

const SEED_RATES = [
  { fromCurrency: "USD", toCurrency: "CAD", rate: "1.360000", effectiveDate: "2026-01-01" },
  { fromCurrency: "EUR", toCurrency: "CAD", rate: "1.470000", effectiveDate: "2026-01-01" },
  { fromCurrency: "INR", toCurrency: "CAD", rate: "0.016000", effectiveDate: "2026-01-01" },
  { fromCurrency: "MXN", toCurrency: "CAD", rate: "0.072000", effectiveDate: "2026-01-01" },
];

async function ensureSeeded() {
  const existing = await db.select().from(fxRatesTable).limit(1);
  if (existing.length === 0) {
    await db.insert(fxRatesTable).values(SEED_RATES);
  }
}

ensureSeeded().catch(err => console.error("[fx-rates] seed error:", err));

router.get("/fx-rates", async (_req, res): Promise<void> => {
  const rates = await db
    .select()
    .from(fxRatesTable)
    .orderBy(fxRatesTable.fromCurrency, fxRatesTable.effectiveDate);
  res.json(rates);
});

router.post("/fx-rates", async (req, res): Promise<void> => {
  const { fromCurrency, toCurrency, rate, effectiveDate } = req.body;
  if (!fromCurrency || !toCurrency || !rate || !effectiveDate) {
    res.status(400).json({ error: "fromCurrency, toCurrency, rate, effectiveDate required" });
    return;
  }

  const existing = await db
    .select()
    .from(fxRatesTable)
    .where(
      and(
        eq(fxRatesTable.fromCurrency, fromCurrency.toUpperCase()),
        eq(fxRatesTable.toCurrency, toCurrency.toUpperCase()),
        eq(fxRatesTable.effectiveDate, effectiveDate),
      ),
    );

  if (existing.length > 0) {
    res.status(409).json({ error: "Rate already exists for this currency pair and date. Use PUT to update." });
    return;
  }

  const [row] = await db
    .insert(fxRatesTable)
    .values({
      fromCurrency: fromCurrency.toUpperCase(),
      toCurrency: toCurrency.toUpperCase(),
      rate: String(rate),
      effectiveDate,
    })
    .returning();

  res.status(201).json(row);
});

router.put("/fx-rates/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { rate, effectiveDate } = req.body;
  const updates: Record<string, string> = {};
  if (rate !== undefined) updates.rate = String(rate);
  if (effectiveDate !== undefined) updates.effectiveDate = effectiveDate;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" }); return;
  }

  const [row] = await db
    .update(fxRatesTable)
    .set(updates)
    .where(eq(fxRatesTable.id, id))
    .returning();

  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/fx-rates/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(fxRatesTable).where(eq(fxRatesTable.id, id));
  res.json({ ok: true });
});

export default router;
