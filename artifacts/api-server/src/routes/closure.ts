import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, closureChecklistsTable, projectsTable, handoverSummariesTable, milestonesTable, changeRequestsTable, invoicesTable } from "@workspace/db";

const router: IRouter = Router();

// Get or create closure checklist for a project
router.get("/projects/:id/closure", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  let [checklist] = await db.select().from(closureChecklistsTable).where(eq(closureChecklistsTable.projectId, projectId));

  if (!checklist) {
    [checklist] = await db.insert(closureChecklistsTable).values({
      projectId, projectName: project.name, accountId: project.accountId, accountName: project.accountName,
    }).returning();
  }

  // Gather context for the checklist
  const [milestones, changeRequests, invoices] = await Promise.all([
    db.select().from(milestonesTable).where(eq(milestonesTable.projectId, projectId)),
    db.select().from(changeRequestsTable).where(eq(changeRequestsTable.projectId, projectId)),
    db.select().from(invoicesTable).where(eq(invoicesTable.projectId, projectId)),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const completedMilestones = milestones.filter(m => m.status === "completed").length;
  const totalMilestones = milestones.length;
  const overdueMilestones = milestones.filter(m => m.status !== "completed" && m.dueDate && m.dueDate < today).length;
  const openCRs = changeRequests.filter(cr => !["approved", "rejected"].includes(cr.status)).length;
  const unpaidInvoices = invoices.filter(i => ["sent", "overdue", "draft"].includes(i.status)).length;
  const totalBilled = invoices.filter(i => i.status !== "draft").reduce((s, i) => s + parseFloat(i.amount), 0);

  // Auto-suggest readiness
  const suggestions: string[] = [];
  if (overdueMilestones > 0) suggestions.push(`${overdueMilestones} milestone(s) still overdue`);
  if (openCRs > 0) suggestions.push(`${openCRs} change order(s) not yet finalized`);
  if (unpaidInvoices > 0) suggestions.push(`${unpaidInvoices} invoice(s) outstanding`);
  if (!checklist.deliveryComplete) suggestions.push("Delivery not yet marked complete");

  // Check if handover exists
  const [handover] = await db.select().from(handoverSummariesTable).where(eq(handoverSummariesTable.projectId, projectId));

  res.json({
    checklist,
    context: {
      project: { id: project.id, name: project.name, accountName: project.accountName, status: project.status, endDate: project.endDate },
      milestones: { total: totalMilestones, completed: completedMilestones, overdue: overdueMilestones },
      changeRequests: { total: changeRequests.length, open: openCRs, approved: changeRequests.filter(cr => cr.status === "approved").length },
      invoices: { total: invoices.length, unpaid: unpaidInvoices, totalBilled },
      suggestions,
      handoverExists: !!handover,
      handoverId: handover?.id,
    },
  });
});

router.put("/projects/:id/closure", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { id: _id, createdAt, ...updates } = req.body;
  const today = new Date().toISOString().split("T")[0];

  // If a step is being marked as complete, record the timestamp
  const withTimestamps: any = { ...updates };
  if (updates.deliveryComplete && !updates.deliveryCompleteAt) withTimestamps.deliveryCompleteAt = today;
  if (updates.clientSignOff && !updates.clientSignOffAt) withTimestamps.clientSignOffAt = today;
  if (updates.billingComplete && !updates.billingCompleteAt) withTimestamps.billingCompleteAt = today;
  if (updates.changeOrdersReconciled && !updates.changeOrdersReconciledAt) withTimestamps.changeOrdersReconciledAt = today;
  if (updates.documentationComplete && !updates.documentationCompleteAt) withTimestamps.documentationCompleteAt = today;
  if (updates.handoverReady && !updates.handoverReadyAt) withTimestamps.handoverReadyAt = today;
  if (updates.archived && !updates.archivedAt) withTimestamps.archivedAt = today;

  // Calculate completion status
  const steps = ["deliveryComplete", "clientSignOff", "billingComplete", "changeOrdersReconciled", "documentationComplete", "handoverReady"];
  const allComplete = steps.every(s => withTimestamps[s] === true || updates[s] === true);
  if (allComplete) withTimestamps.status = "complete";
  if (updates.archived) withTimestamps.status = "archived";

  let [checklist] = await db.select().from(closureChecklistsTable).where(eq(closureChecklistsTable.projectId, projectId));

  if (!checklist) {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    [checklist] = await db.insert(closureChecklistsTable).values({
      projectId, projectName: project?.name, accountId: project?.accountId, accountName: project?.accountName,
      ...withTimestamps,
    }).returning();
  } else {
    [checklist] = await db.update(closureChecklistsTable).set(withTimestamps).where(eq(closureChecklistsTable.projectId, projectId)).returning();
  }

  // If archived, update project status
  if (updates.archived) {
    await db.update(projectsTable).set({ status: "completed" }).where(eq(projectsTable.id, projectId));
  }

  res.json(checklist);
});

export default router;
