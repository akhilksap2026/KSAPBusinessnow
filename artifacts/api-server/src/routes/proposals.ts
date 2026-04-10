import { Router, type IRouter } from "express";
import { db, proposalsTable, opportunitiesTable, opportunityActivityTable, projectsTable, milestonesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

function parseProp(p: typeof proposalsTable.$inferSelect) {
  return { ...p, totalValue: p.totalValue ? parseFloat(p.totalValue) : null };
}

const router: IRouter = Router();

router.get("/proposals", async (req, res): Promise<void> => {
  const { opportunityId } = req.query as Record<string, string>;
  let proposals = await db.select().from(proposalsTable);
  if (opportunityId) proposals = proposals.filter((p) => p.opportunityId === parseInt(opportunityId));
  res.json(proposals.map(parseProp));
});

router.get("/proposals/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [prop] = await db.select().from(proposalsTable).where(eq(proposalsTable.id, id));
  if (!prop) { res.status(404).json({ error: "Not found" }); return; }

  const [opp] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, prop.opportunityId));
  res.json({ ...parseProp(prop), opportunity: opp ? { id: opp.id, name: opp.name, accountName: opp.accountName, stage: opp.stage } : null });
});

router.post("/proposals", async (req, res): Promise<void> => {
  const { opportunityId, proposalType, title, pricingModel, ...rest } = req.body;
  if (!opportunityId || !title) { res.status(400).json({ error: "opportunityId and title required" }); return; }

  const initialVersion = { version: 1, createdAt: new Date().toISOString(), summary: "Initial draft", authorName: req.body.createdByName || "Unknown" };
  const [prop] = await db.insert(proposalsTable).values({
    opportunityId, proposalType: proposalType || "implementation", title,
    pricingModel: pricingModel || "milestone",
    versions: [initialVersion], currentVersion: 1,
    ...rest,
  }).returning();

  await db.insert(opportunityActivityTable).values({
    opportunityId, activityType: "proposal_sent",
    title: `Proposal created: ${title}`,
    body: `Proposal type: ${proposalType || "implementation"}, Pricing model: ${pricingModel || "milestone"}`,
    authorName: req.body.createdByName || "Unknown",
  });

  res.status(201).json(parseProp(prop));
});

router.put("/proposals/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(proposalsTable).where(eq(proposalsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const { id: _id, createdAt, ...updates } = req.body;

  // Version bump if significant changes
  const versions = (existing.versions as any[]) || [];
  if (updates.versionNote) {
    versions.push({
      version: (existing.currentVersion || 1) + 1,
      createdAt: new Date().toISOString(),
      summary: updates.versionNote,
      authorName: updates.updatedByName || "Unknown",
    });
    updates.currentVersion = (existing.currentVersion || 1) + 1;
    delete updates.versionNote;
  }
  updates.versions = versions;

  const [prop] = await db.update(proposalsTable).set({ ...updates, updatedAt: new Date() }).where(eq(proposalsTable.id, id)).returning();
  res.json(parseProp(prop));
});

router.put("/proposals/:id/approve", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { state, approvedBy } = req.body;
  const [prop] = await db.update(proposalsTable).set({
    internalApprovalState: state || "approved", updatedAt: new Date(),
  }).where(eq(proposalsTable.id, id)).returning();

  await db.insert(opportunityActivityTable).values({
    opportunityId: prop.opportunityId, activityType: "internal_approval",
    title: `Proposal ${state || "approved"} internally`,
    body: `Approved by: ${approvedBy || "Unknown"}`,
    authorName: approvedBy || "Unknown",
  });

  res.json(parseProp(prop));
});

router.put("/proposals/:id/client-response", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { state, notes } = req.body;
  const update: Record<string, any> = { clientAcceptanceState: state, updatedAt: new Date() };
  if (state === "accepted") update.acceptedAt = new Date();

  const [prop] = await db.update(proposalsTable).set(update).where(eq(proposalsTable.id, id)).returning();

  if (state === "accepted") {
    await db.update(opportunitiesTable).set({ stage: "won", updatedAt: new Date() }).where(eq(opportunitiesTable.id, prop.opportunityId));
    await db.insert(opportunityActivityTable).values({
      opportunityId: prop.opportunityId, activityType: "client_commitment",
      title: "Proposal accepted by client — opportunity Won",
      body: notes || "",
      authorName: "System",
    });
  }

  res.json(parseProp(prop));
});

export default router;
