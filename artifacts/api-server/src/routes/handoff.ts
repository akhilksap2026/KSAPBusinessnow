import { Router, type IRouter } from "express";
import { db, opportunitiesTable, proposalsTable, projectsTable, milestonesTable, opportunityActivityTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// Preview handoff data
router.get("/handoff/:opportunityId", async (req, res): Promise<void> => {
  const oppId = parseInt(req.params.opportunityId);
  if (isNaN(oppId)) { res.status(400).json({ error: "Invalid opportunity id" }); return; }

  const [opp] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, oppId));
  if (!opp) { res.status(404).json({ error: "Opportunity not found" }); return; }

  const proposals = await db.select().from(proposalsTable).where(eq(proposalsTable.opportunityId, oppId));
  const acceptedProposal = proposals.find((p) => p.clientAcceptanceState === "accepted") || proposals[0] || null;

  const preview = {
    opportunity: { ...opp, value: opp.value ? parseFloat(opp.value) : null },
    acceptedProposal: acceptedProposal ? { ...acceptedProposal, totalValue: acceptedProposal.totalValue ? parseFloat(acceptedProposal.totalValue) : null } : null,
    willCarryOver: {
      accountId: opp.accountId,
      accountName: opp.accountName,
      projectType: opp.type,
      scopeSummary: opp.scopeSummary,
      milestoneOutline: acceptedProposal?.milestoneOutline || [],
      pricingBaseline: acceptedProposal?.totalValue ? parseFloat(acceptedProposal.totalValue as string) : (opp.value ? parseFloat(opp.value) : null),
      requiredRoles: opp.requiredRoles,
      risks: opp.risks,
      assumptions: opp.assumptions,
      serviceLineTags: [opp.type],
      stakeholders: opp.stakeholders,
    },
    alreadyHandedOff: !!opp.handoffProjectId,
    handoffProjectId: opp.handoffProjectId,
  };

  res.json(preview);
});

// Execute handoff → create project
router.post("/handoff/:opportunityId", async (req, res): Promise<void> => {
  const oppId = parseInt(req.params.opportunityId);
  if (isNaN(oppId)) { res.status(400).json({ error: "Invalid opportunity id" }); return; }

  const [opp] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, oppId));
  if (!opp) { res.status(404).json({ error: "Opportunity not found" }); return; }
  if (opp.handoffProjectId) { res.status(409).json({ error: "Handoff already completed", projectId: opp.handoffProjectId }); return; }

  const proposals = await db.select().from(proposalsTable).where(eq(proposalsTable.opportunityId, oppId));
  const acceptedProposal = proposals.find((p) => p.clientAcceptanceState === "accepted") || proposals[0] || null;

  const milestoneOutline: {name:string;deliverable:string;weeks:number;billableAmount?:number}[] = (acceptedProposal?.milestoneOutline as any) || [];
  const budget = acceptedProposal?.totalValue || opp.value;
  const projectName = req.body.projectName || opp.name;

  // Create project
  const [project] = await db.insert(projectsTable).values({
    name: projectName,
    accountId: opp.accountId,
    accountName: opp.accountName,
    type: opp.type as any,
    status: "active",
    startDate: opp.expectedStartDate,
    budgetValue: budget ? String(budget) : null,
    healthScore: 75,
    description: opp.scopeSummary || opp.summary || "",
  }).returning();

  // Create milestones from proposal outline
  if (milestoneOutline.length > 0) {
    let weekOffset = 0;
    for (const ms of milestoneOutline) {
      const startDate = opp.expectedStartDate
        ? new Date(new Date(opp.expectedStartDate).getTime() + weekOffset * 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
        : null;
      const dueDate = opp.expectedStartDate
        ? new Date(new Date(opp.expectedStartDate).getTime() + (weekOffset + ms.weeks) * 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
        : null;
      await db.insert(milestonesTable).values({
        projectId: project.id,
        name: ms.name,
        description: ms.deliverable,
        dueDate,
        startDate,
        status: "not_started",
        isBillable: true,
        billableAmount: ms.billableAmount ? String(ms.billableAmount) : null,
        invoiced: false,
      });
      weekOffset += ms.weeks;
    }
  }

  // Mark opportunity as handed off
  await db.update(opportunitiesTable).set({
    handoffProjectId: project.id,
    handoffCompletedAt: new Date(),
    stage: "won",
    updatedAt: new Date(),
  }).where(eq(opportunitiesTable.id, oppId));

  // Log activity
  await db.insert(opportunityActivityTable).values({
    opportunityId: oppId,
    activityType: "general_note",
    title: `Handoff completed → Project #${project.id} created`,
    body: `Project "${projectName}" created with ${milestoneOutline.length} milestone(s) carried over from proposal.`,
    authorName: req.body.handoffBy || "System",
  });

  res.status(201).json({
    project,
    milestonesCreated: milestoneOutline.length,
    message: "Handoff complete. Project is active.",
  });
});

export default router;
