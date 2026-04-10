import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, handoverSummariesTable, projectsTable, milestonesTable, changeRequestsTable, allocationsTable, resourcesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/handover/:projectId", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  let [handover] = await db.select().from(handoverSummariesTable).where(eq(handoverSummariesTable.projectId, projectId));

  const [milestones, changeRequests, allocations] = await Promise.all([
    db.select().from(milestonesTable).where(eq(milestonesTable.projectId, projectId)),
    db.select().from(changeRequestsTable).where(eq(changeRequestsTable.projectId, projectId)),
    db.select().from(allocationsTable).where(eq(allocationsTable.projectId, projectId)),
  ]);

  // Auto-generate if not exists
  if (!handover) {
    const approvedCRs = changeRequests.filter(cr => cr.status === "approved");
    [handover] = await db.insert(handoverSummariesTable).values({
      projectId,
      projectName: project.name,
      accountId: project.accountId,
      accountName: project.accountName,
      scopeDelivered: `OTM implementation delivered for ${project.accountName}. ${project.description || ""}`,
      milestoneSummary: milestones.map(m => ({ name: m.name, status: m.status, completedDate: m.status === "completed" ? m.dueDate : undefined })),
      changeHistory: approvedCRs.map(cr => ({ title: cr.title, status: cr.status, impactCost: parseFloat(cr.impactCost || "0") })),
      keyContacts: [],
      status: "draft",
    }).returning();
  }

  res.json({
    handover,
    context: {
      project: { id: project.id, name: project.name, accountName: project.accountName, status: project.status, pmName: project.pmName, startDate: project.startDate, endDate: project.endDate, goLiveDate: project.goLiveDate },
      milestones: milestones.map(m => ({ id: m.id, name: m.name, status: m.status, dueDate: m.dueDate, isBillable: m.isBillable })),
      changeRequests: changeRequests.map(cr => ({ id: cr.id, title: cr.title, status: cr.status, impactCost: parseFloat(cr.impactCost || "0"), impactHours: parseFloat(cr.impactHours || "0") })),
      team: allocations.map(a => ({ resourceName: a.resourceName, role: a.role, allocationType: a.allocationType })),
    },
  });
});

router.put("/handover/:projectId", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { id: _id, createdAt, ...updates } = req.body;

  let [handover] = await db.select().from(handoverSummariesTable).where(eq(handoverSummariesTable.projectId, projectId));
  if (!handover) {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    [handover] = await db.insert(handoverSummariesTable).values({ projectId, projectName: project?.name, accountId: project?.accountId, accountName: project?.accountName, ...updates }).returning();
  } else {
    [handover] = await db.update(handoverSummariesTable).set(updates).where(eq(handoverSummariesTable.projectId, projectId)).returning();
  }
  res.json(handover);
});

export default router;
