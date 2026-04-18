import { Router } from "express";
import { db, rateCardsTable } from "@workspace/db";
import { eq, and, or, isNull, isNotNull } from "drizzle-orm";
import { getRoleFromHeader, stripRateCardFields } from "../middleware/field-access";

const router = Router();

const BUY_RATE_ROLES = ["delivery_director", "finance_lead", "admin"];

router.get("/rate-cards", async (req, res) => {
  try {
    const { projectId, accountId, isTemplate } = req.query as Record<string, string>;
    let rows = await db.select().from(rateCardsTable);
    if (projectId) rows = rows.filter(r => r.projectId === parseInt(projectId));
    if (accountId) rows = rows.filter(r => r.accountId === parseInt(accountId));
    if (isTemplate !== undefined) {
      const flag = isTemplate === "true";
      rows = rows.filter(r => !!r.isTemplate === flag);
    }
    const role = getRoleFromHeader(req as any);
    res.json(stripRateCardFields(rows, role));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/rate-cards", async (req, res) => {
  try {
    const body = {
      ...req.body,
      role: req.body.role ?? "",
      billingRate: req.body.billingRate ?? req.body.sellRate ?? "0",
    };
    const [row] = await db.insert(rateCardsTable).values(body).returning();
    res.status(201).json(row);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.put("/rate-cards/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { id: _id, createdAt, ...rawBody } = req.body;
    const body = {
      ...rawBody,
      role: rawBody.role ?? "",
      billingRate: rawBody.billingRate ?? rawBody.sellRate ?? "0",
    };
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

// POST /rate-cards/:id/copy-to-project — clone a global template as a project-level override
router.post("/rate-cards/:id/copy-to-project", async (req, res) => {
  try {
    const sourceId = parseInt(req.params.id);
    const { projectId, projectName } = req.body as { projectId: number; projectName?: string };
    if (!projectId) return res.status(400).json({ error: "projectId is required" });

    const [source] = await db.select().from(rateCardsTable).where(eq(rateCardsTable.id, sourceId));
    if (!source) return res.status(404).json({ error: "Source rate card not found" });

    const { id: _id, createdAt: _ca, ...rest } = source;
    const [created] = await db.insert(rateCardsTable).values({
      ...rest,
      name: `${source.name} (${projectName ?? `Project #${projectId}`} Override)`,
      projectId,
      isTemplate: false,
      notes: `Copied from global template: "${source.name}"`,
    }).returning();

    res.status(201).json(created);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
