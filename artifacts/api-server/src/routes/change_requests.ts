import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, changeRequestsTable } from "@workspace/db";
import {
  CreateChangeRequestBody,
  UpdateChangeRequestBody,
  GetChangeRequestParams,
  UpdateChangeRequestParams,
  ListChangeRequestsQueryParams,
} from "@workspace/api-zod";

function parseCR(cr: typeof changeRequestsTable.$inferSelect) {
  return {
    ...cr,
    impactHours: cr.impactHours ? parseFloat(cr.impactHours) : null,
    impactCost: cr.impactCost ? parseFloat(cr.impactCost) : null,
  };
}

const router: IRouter = Router();

router.get("/change-requests", async (req, res): Promise<void> => {
  const query = ListChangeRequestsQueryParams.safeParse(req.query);
  let changeRequests = await db.select().from(changeRequestsTable).orderBy(changeRequestsTable.createdAt);
  if (query.success) {
    if (query.data.projectId) changeRequests = changeRequests.filter((cr) => cr.projectId === query.data.projectId);
    if (query.data.status) changeRequests = changeRequests.filter((cr) => cr.status === query.data.status);
  }
  res.json(changeRequests.map(parseCR));
});

router.post("/change-requests", async (req, res): Promise<void> => {
  const parsed = CreateChangeRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [cr] = await db.insert(changeRequestsTable).values(parsed.data).returning();
  res.status(201).json(parseCR(cr));
});

router.get("/change-requests/:id", async (req, res): Promise<void> => {
  const params = GetChangeRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [cr] = await db.select().from(changeRequestsTable).where(eq(changeRequestsTable.id, params.data.id));
  if (!cr) {
    res.status(404).json({ error: "Change request not found" });
    return;
  }
  res.json(parseCR(cr));
});

router.put("/change-requests/:id/approve", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(changeRequestsTable).where(eq(changeRequestsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Change request not found" }); return; }
  if (existing.status === "approved") { res.status(409).json({ error: "Already approved" }); return; }
  if (existing.status === "rejected") { res.status(409).json({ error: "Cannot approve a rejected change request" }); return; }

  const approvedBy: string = (req.body?.approvedBy as string) || "System";
  const approvedAt = new Date().toISOString();

  const [cr] = await db.update(changeRequestsTable)
    .set({ status: "approved", approvedBy, approvedAt, approvedDate: approvedAt.split("T")[0] })
    .where(eq(changeRequestsTable.id, id))
    .returning();

  res.json(parseCR(cr));
});

router.put("/change-requests/:id/reject", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(changeRequestsTable).where(eq(changeRequestsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Change request not found" }); return; }
  if (existing.status === "rejected") { res.status(409).json({ error: "Already rejected" }); return; }
  if (existing.status === "approved") { res.status(409).json({ error: "Cannot reject an already approved change request" }); return; }

  const rejectedBy: string = (req.body?.rejectedBy as string) || "System";
  const rejectedAt = new Date().toISOString();
  const rejectionReason: string = (req.body?.rejectionReason as string) || "";

  const [cr] = await db.update(changeRequestsTable)
    .set({ status: "rejected", rejectedBy, rejectedAt, rejectionReason })
    .where(eq(changeRequestsTable.id, id))
    .returning();

  res.json(parseCR(cr));
});

router.put("/change-requests/:id", async (req, res): Promise<void> => {
  const params = UpdateChangeRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateChangeRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [cr] = await db.update(changeRequestsTable).set(parsed.data).where(eq(changeRequestsTable.id, params.data.id)).returning();
  if (!cr) {
    res.status(404).json({ error: "Change request not found" });
    return;
  }
  res.json(parseCR(cr));
});

export default router;
