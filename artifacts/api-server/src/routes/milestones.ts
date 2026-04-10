import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, milestonesTable, milestoneSignoffsTable } from "@workspace/db";

function parseMilestone(m: typeof milestonesTable.$inferSelect) {
  return { ...m, billableAmount: m.billableAmount ? parseFloat(m.billableAmount) : null };
}

const router: IRouter = Router();

router.get("/milestones", async (req, res): Promise<void> => {
  const { projectId, status, overdue, phaseId } = req.query as Record<string, string>;
  let milestones = await db.select().from(milestonesTable).orderBy(milestonesTable.dueDate);
  if (projectId) milestones = milestones.filter((m) => m.projectId === parseInt(projectId));
  if (status) milestones = milestones.filter((m) => m.status === status);
  if (phaseId) milestones = milestones.filter((m) => (m as any).phaseId === parseInt(phaseId));
  if (overdue === "true") {
    const today = new Date().toISOString().split("T")[0];
    milestones = milestones.filter((m) => m.dueDate && m.dueDate < today && m.status !== "completed");
  }
  res.json(milestones.map(parseMilestone));
});

router.post("/milestones", async (req, res): Promise<void> => {
  const { name, projectId, ...rest } = req.body;
  if (!name || !projectId) { res.status(400).json({ error: "name and projectId required" }); return; }
  const [milestone] = await db.insert(milestonesTable).values({ name, projectId: parseInt(projectId), ...rest }).returning();
  res.status(201).json(parseMilestone(milestone));
});

router.get("/milestones/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [milestone] = await db.select().from(milestonesTable).where(eq(milestonesTable.id, id));
  if (!milestone) { res.status(404).json({ error: "Not found" }); return; }
  res.json(parseMilestone(milestone));
});

router.put("/milestones/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { id: _id, createdAt, ...updates } = req.body;
  const [milestone] = await db.update(milestonesTable).set(updates).where(eq(milestonesTable.id, id)).returning();
  if (!milestone) { res.status(404).json({ error: "Not found" }); return; }
  res.json(parseMilestone(milestone));
});

router.put("/milestones/:id/status", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { status, approvalStatus } = req.body;
  const updates: any = {};
  if (status) updates.status = status;
  if (approvalStatus) updates.approvalStatus = approvalStatus;
  if (status === "completed" && !updates.completedDate) updates.completedDate = new Date().toISOString().split("T")[0];
  const [milestone] = await db.update(milestonesTable).set(updates).where(eq(milestonesTable.id, id)).returning();
  if (!milestone) { res.status(404).json({ error: "Not found" }); return; }
  res.json(parseMilestone(milestone));
});

router.delete("/milestones/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(milestonesTable).where(eq(milestonesTable.id, id));
  res.json({ ok: true });
});

router.get("/milestones/:id/signoff", async (req, res): Promise<void> => {
  const milestoneId = parseInt(req.params.id);
  if (isNaN(milestoneId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [signoff] = await db
    .select()
    .from(milestoneSignoffsTable)
    .where(eq(milestoneSignoffsTable.milestoneId, milestoneId))
    .limit(1);
  res.json(signoff ?? null);
});

router.post("/milestones/:id/signoff", async (req, res): Promise<void> => {
  const milestoneId = parseInt(req.params.id);
  if (isNaN(milestoneId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { signerName, signerEmail, note } = req.body as { signerName?: string; signerEmail?: string; note?: string };
  if (!signerName || !signerName.trim()) { res.status(400).json({ error: "signerName is required" }); return; }

  const [milestone] = await db.select().from(milestonesTable).where(eq(milestonesTable.id, milestoneId)).limit(1);
  if (!milestone) { res.status(404).json({ error: "Milestone not found" }); return; }

  const alreadySigned = await db
    .select()
    .from(milestoneSignoffsTable)
    .where(eq(milestoneSignoffsTable.milestoneId, milestoneId))
    .limit(1);
  if (alreadySigned.length > 0) {
    res.status(409).json({ error: "Milestone already signed off", signoff: alreadySigned[0] });
    return;
  }

  const [signoff] = await db
    .insert(milestoneSignoffsTable)
    .values({
      milestoneId,
      projectId: milestone.projectId,
      signerName: signerName.trim(),
      signerEmail: signerEmail?.trim() ?? null,
      note: note?.trim() ?? null,
    })
    .returning();

  await db
    .update(milestonesTable)
    .set({ approvalStatus: "approved" })
    .where(eq(milestonesTable.id, milestoneId));

  res.status(201).json({ signoff, milestoneId });
});

export default router;
