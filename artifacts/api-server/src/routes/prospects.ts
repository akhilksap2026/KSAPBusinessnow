import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, pool, prospectsTable, accountsTable, opportunitiesTable } from "@workspace/db";

const router: IRouter = Router();

const AUTHORIZED_ROLES = ["account_manager", "delivery_director", "admin"];
const CONFIDENTIAL_FIELDS = ["primaryContactName", "primaryContactEmail", "linkedinUrl", "sentiment", "touchPoints"];

function stripConfidential(prospect: any, role: string) {
  if (AUTHORIZED_ROLES.includes(role)) return prospect;
  const safe = { ...prospect };
  CONFIDENTIAL_FIELDS.forEach(f => delete safe[f]);
  return safe;
}

function getRole(req: any): string {
  return (req as any).session?.role ?? (req as any).session?.user?.role ?? "consultant";
}

router.get("/prospects", async (req, res): Promise<void> => {
  const role = getRole(req);
  if (!AUTHORIZED_ROLES.includes(role)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  let prospects = await db.select().from(prospectsTable).orderBy(prospectsTable.createdAt);
  const { status, ownerId } = req.query as Record<string, string>;
  if (status) prospects = prospects.filter(p => p.status === status);
  if (ownerId) prospects = prospects.filter(p => p.ownerId === parseInt(ownerId));
  res.json(prospects.map(p => stripConfidential(p, role)));
});

router.get("/prospects/:id", async (req, res): Promise<void> => {
  const role = getRole(req);
  if (!AUTHORIZED_ROLES.includes(role)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [prospect] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, id));
  if (!prospect) { res.status(404).json({ error: "Not found" }); return; }

  const opportunities = await db.select().from(opportunitiesTable)
    .where(eq((opportunitiesTable as any).prospectId, id))
    .catch(() => []);

  let linkedAccount = null;
  if (prospect.convertedToAccountId) {
    const [acct] = await db.select().from(accountsTable).where(eq(accountsTable.id, prospect.convertedToAccountId));
    linkedAccount = acct ?? null;
  }

  res.json({ ...stripConfidential(prospect, role), opportunities, linkedAccount });
});

router.post("/prospects", async (req, res): Promise<void> => {
  const role = getRole(req);
  if (!AUTHORIZED_ROLES.includes(role)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const { name, type, industry, segment, primaryContactName, primaryContactEmail,
    linkedinUrl, sentiment, ownerId, notes } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const [prospect] = await db.insert(prospectsTable).values({
    name, type, industry, segment, primaryContactName, primaryContactEmail,
    linkedinUrl, sentiment, notes,
    ownerId: ownerId ? parseInt(String(ownerId)) : undefined,
    status: "active",
  }).returning();
  res.status(201).json(prospect);
});

router.put("/prospects/:id", async (req, res): Promise<void> => {
  const role = getRole(req);
  if (!AUTHORIZED_ROLES.includes(role)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { id: _id, createdAt, convertedAt, convertedToAccountId, ...updates } = req.body;
  const [prospect] = await db.update(prospectsTable).set(updates).where(eq(prospectsTable.id, id)).returning();
  if (!prospect) { res.status(404).json({ error: "Not found" }); return; }
  res.json(prospect);
});

router.delete("/prospects/:id", async (req, res): Promise<void> => {
  const role = getRole(req);
  if (!AUTHORIZED_ROLES.includes(role)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [existing] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status === "converted") {
    res.status(400).json({ error: "Cannot delete a converted prospect" });
    return;
  }
  await db.delete(prospectsTable).where(eq(prospectsTable.id, id));
  res.json({ success: true });
});

router.post("/prospects/:id/convert", async (req, res): Promise<void> => {
  const role = getRole(req);
  if (!AUTHORIZED_ROLES.includes(role)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const prospectRes = await client.query("SELECT * FROM prospects WHERE id = $1", [id]);
    if (prospectRes.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Prospect not found" });
      return;
    }
    const prospect = prospectRes.rows[0];
    if (prospect.status === "converted") {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Already converted" });
      return;
    }

    const { annualContractValue, paymentTerms, contractHeader } = req.body;

    const acctRes = await client.query(
      `INSERT INTO accounts (name, type, industry, segment, status, converted_from_prospect_id, payment_terms, contract_header, annual_contract_value)
       VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8) RETURNING id`,
      [
        prospect.name,
        prospect.type ?? null,
        prospect.industry ?? null,
        prospect.segment ?? "enterprise",
        id,
        paymentTerms ?? null,
        contractHeader ?? null,
        annualContractValue ? String(annualContractValue) : null,
      ]
    );
    const newAccountId = acctRes.rows[0].id;

    await client.query(
      `UPDATE prospects SET converted_to_account_id = $1, converted_at = NOW(), status = 'converted' WHERE id = $2`,
      [newAccountId, id]
    );

    await client.query("COMMIT");
    res.json({ accountId: newAccountId });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Convert prospect failed:", err);
    res.status(500).json({ error: "Conversion failed" });
  } finally {
    client.release();
  }
});

export default router;
