import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, contractsTable } from "@workspace/db";

function parseContract(c: typeof contractsTable.$inferSelect) {
  return {
    ...c,
    totalValue: c.totalValue ? parseFloat(c.totalValue) : null,
    remainingValue: c.remainingValue ? parseFloat(c.remainingValue) : null,
    invoicedValue: c.invoicedValue ? parseFloat(c.invoicedValue) : 0,
    billingMilestones: c.billingMilestones ?? [],
    slaConfig: c.slaConfig ?? {},
  };
}

const router: IRouter = Router();

router.get("/contracts", async (req, res): Promise<void> => {
  const { projectId, accountId, status } = req.query as Record<string, string>;
  let contracts = await db.select().from(contractsTable).orderBy(contractsTable.startDate);
  if (projectId) contracts = contracts.filter(c => c.projectId === parseInt(projectId));
  if (accountId) contracts = contracts.filter(c => c.accountId === parseInt(accountId));
  if (status) contracts = contracts.filter(c => c.status === status);
  res.json(contracts.map(parseContract));
});

router.post("/contracts", async (req, res): Promise<void> => {
  const { name, billingModel, ...rest } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const count = await db.select().from(contractsTable);
  const contractNumber = `CTR-${String(count.length + 1).padStart(4, "0")}`;
  const [contract] = await db.insert(contractsTable).values({ name, billingModel: billingModel || "time_and_materials", contractNumber, ...rest }).returning();
  res.status(201).json(parseContract(contract));
});

router.get("/contracts/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, id));
  if (!contract) { res.status(404).json({ error: "Not found" }); return; }
  res.json(parseContract(contract));
});

router.put("/contracts/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { id: _id, createdAt, ...updates } = req.body;
  const [contract] = await db.update(contractsTable).set(updates).where(eq(contractsTable.id, id)).returning();
  if (!contract) { res.status(404).json({ error: "Not found" }); return; }
  res.json(parseContract(contract));
});

export default router;
