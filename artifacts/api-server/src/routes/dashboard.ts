import { Router, type IRouter } from "express";
import { db, projectsTable, milestonesTable, tasksTable, resourcesTable, invoicesTable, opportunitiesTable, allocationsTable, changeRequestsTable, activityLogsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard/executive", async (_req, res): Promise<void> => {
  const projects = await db.select().from(projectsTable);
  const activeProjects = projects.filter((p) => p.status === "active");
  const atRiskProjects = projects.filter((p) => p.status === "at_risk");

  const invoices = await db.select().from(invoicesTable);
  const totalRevenue = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + parseFloat(i.amount), 0);
  const revenueAtRisk = invoices
    .filter((i) => i.status === "overdue")
    .reduce((sum, i) => sum + parseFloat(i.amount), 0);

  const resources = await db.select().from(resourcesTable);
  const avgUtilization = resources.length
    ? Math.round(resources.reduce((sum, r) => sum + (r.currentUtilization ?? 0), 0) / resources.length)
    : 0;

  const today = new Date().toISOString().split("T")[0];
  const upcomingGoLives = activeProjects
    .filter((p) => p.goLiveDate && p.goLiveDate >= today)
    .sort((a, b) => (a.goLiveDate! > b.goLiveDate! ? 1 : -1))
    .slice(0, 5)
    .map((p) => ({
      ...p,
      budgetHours: p.budgetHours ? parseFloat(p.budgetHours) : null,
      consumedHours: p.consumedHours ? parseFloat(p.consumedHours) : null,
      budgetValue: p.budgetValue ? parseFloat(p.budgetValue) : null,
      billedValue: p.billedValue ? parseFloat(p.billedValue) : null,
    }));

  const green = projects.filter((p) => (p.healthScore ?? 0) >= 80).length;
  const yellow = projects.filter((p) => (p.healthScore ?? 0) >= 60 && (p.healthScore ?? 0) < 80).length;
  const red = projects.filter((p) => (p.healthScore ?? 0) < 60).length;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const revenueByMonth = months.map((month, i) => ({
    month,
    billed: 120000 + i * 15000 + Math.random() * 20000,
    collected: 100000 + i * 12000 + Math.random() * 15000,
    target: 150000,
  }));

  const marginWatch = activeProjects.slice(0, 5).map((p) => ({
    projectId: p.id,
    projectName: p.name,
    budgetedMargin: 35,
    actualMargin: 25 + Math.random() * 20,
    variance: -5 + Math.random() * 15,
  }));

  res.json({
    totalActiveProjects: activeProjects.length,
    totalRevenue,
    revenueAtRisk,
    averageUtilization: avgUtilization,
    upcomingGoLives,
    portfolioHealthBreakdown: { green, yellow, red },
    revenueByMonth,
    marginWatch,
  });
});


router.get("/dashboard/resources", async (_req, res): Promise<void> => {
  const resources = await db.select().from(resourcesTable);
  const allocations = await db.select().from(allocationsTable);

  const utilizationByConsultant = resources.map((r) => ({
    resourceId: r.id,
    resourceName: r.name,
    title: r.title ?? "",
    utilization: r.currentUtilization ?? 0,
    target: r.utilizationTarget ?? 80,
    status: r.status,
    projects: allocations
      .filter((a) => a.resourceId === r.id && a.status === "confirmed")
      .map((a) => a.projectName ?? "Unknown"),
  }));

  const overAllocated = resources.filter((r) => r.status === "over_allocated").map((r) => ({
    ...r,
    hourlyRate: r.hourlyRate ? parseFloat(r.hourlyRate) : null,
    skills: r.skills ?? [],
  }));
  const onBench = resources.filter((r) => r.status === "bench").map((r) => ({
    ...r,
    hourlyRate: r.hourlyRate ? parseFloat(r.hourlyRate) : null,
    skills: r.skills ?? [],
  }));
  const softBooked = resources.filter((r) => r.status === "soft_booked").map((r) => ({
    ...r,
    hourlyRate: r.hourlyRate ? parseFloat(r.hourlyRate) : null,
    skills: r.skills ?? [],
  }));

  const skillsGaps = [
    { skill: "OTM Cloud Migration", demand: 6, supply: 3, gap: 3 },
    { skill: "OTM Rate Engine", demand: 4, supply: 2, gap: 2 },
    { skill: "OTM Integration (EDI)", demand: 5, supply: 4, gap: 1 },
    { skill: "OTM Data Migration", demand: 3, supply: 1, gap: 2 },
    { skill: "OTM QA Automation", demand: 4, supply: 3, gap: 1 },
  ];

  res.json({ utilizationByConsultant, overAllocated, onBench, softBooked, skillsGaps });
});

router.get("/dashboard/finance", async (_req, res): Promise<void> => {
  const invoices = await db.select().from(invoicesTable);
  const milestones = await db.select().from(milestonesTable);
  const projects = await db.select().from(projectsTable);

  const milestoneBillingQueue = milestones
    .filter((m) => m.isBillable && !m.invoiced && m.status === "completed")
    .map((m) => ({ ...m, billableAmount: m.billableAmount ? parseFloat(m.billableAmount) : null }));

  const uninvoicedHours = 342;
  const uninvoicedValue = uninvoicedHours * 185;

  const receivables = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .map((i) => ({ ...i, amount: parseFloat(i.amount) }));

  const marginVariance = projects.slice(0, 5).map((p) => ({
    projectId: p.id,
    projectName: p.name,
    budgeted: 35,
    actual: 28 + Math.random() * 14,
    variance: -7 + Math.random() * 14,
  }));

  const contractStatus = [
    { accountId: 1, accountName: "GlobalTrans Corp", contractValue: 480000, renewalDate: "2025-06-30", status: "active" },
    { accountId: 2, accountName: "Apex Logistics", contractValue: 320000, renewalDate: "2025-08-15", status: "at_risk" },
    { accountId: 3, accountName: "NorthStar Freight", contractValue: 210000, renewalDate: "2025-04-30", status: "expiring" },
  ];

  res.json({
    milestoneBillingQueue,
    uninvoicedHours,
    uninvoicedValue,
    receivables,
    marginVariance,
    contractStatus,
  });
});

router.get("/dashboard/pipeline", async (_req, res): Promise<void> => {
  const opportunities = await db.select().from(opportunitiesTable);

  const stages = ["prospect", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"];
  const pipelineByStage = stages.map((stage) => {
    const opps = opportunities.filter((o) => o.stage === stage);
    return {
      stage,
      count: opps.length,
      value: opps.reduce((sum, o) => sum + (o.value ? parseFloat(o.value) : 0), 0),
    };
  });

  const totalPipelineValue = opportunities
    .filter((o) => !["closed_lost", "closed_won"].includes(o.stage))
    .reduce((sum, o) => sum + (o.value ? parseFloat(o.value) : 0), 0);

  const tentativeStarts = opportunities
    .filter((o) => o.stage === "negotiation" || o.stage === "proposal")
    .map((o) => ({ ...o, value: o.value ? parseFloat(o.value) : null }));

  const staffingRiskByOpp = opportunities
    .filter((o) => o.staffingRisk && o.staffingRisk !== "none")
    .map((o) => ({
      opportunityId: o.id,
      opportunityName: o.name,
      risk: o.staffingRisk ?? "none",
      missingSkills: ["OTM Cloud Migration", "Integration Specialist"],
    }));

  const proposalsPending = opportunities.filter((o) => o.stage === "proposal").length;

  res.json({
    pipelineByStage,
    totalPipelineValue,
    opportunities: opportunities.map((o) => ({ ...o, value: o.value ? parseFloat(o.value) : null })),
    tentativeStarts,
    staffingRiskByOpp,
    proposalsPending,
  });
});

router.get("/dashboard/project/:projectId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const projectId = parseInt(raw, 10);
  if (isNaN(projectId)) {
    res.status(400).json({ error: "Invalid project id" });
    return;
  }

  const milestones = await db.select().from(milestonesTable);
  const allocations = await db.select().from(allocationsTable);
  const changeRequests = await db.select().from(changeRequestsTable);
  const activity = await db.select().from(activityLogsTable);
  const allProjectsList = await db.select().from(projectsTable);

  const projectMilestones = milestones
    .filter((m) => m.projectId === projectId)
    .map((m) => ({ ...m, billableAmount: m.billableAmount ? parseFloat(m.billableAmount) : null }));
  const projectAllocations = allocations
    .filter((a) => a.projectId === projectId)
    .map((a) => ({ ...a, hoursPerWeek: a.hoursPerWeek ? parseFloat(a.hoursPerWeek) : null }));
  const projectCRs = changeRequests
    .filter((cr) => cr.projectId === projectId && cr.status === "pending_review")
    .map((cr) => ({
      ...cr,
      impactHours: cr.impactHours ? parseFloat(cr.impactHours) : null,
      impactCost: cr.impactCost ? parseFloat(cr.impactCost) : null,
    }));

  const proj = allProjectsList.find((p) => p.id === projectId);

  if (!proj) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const budgetHours = proj.budgetHours ? parseFloat(proj.budgetHours) : 0;
  const consumedHours = proj.consumedHours ? parseFloat(proj.consumedHours) : 0;
  const budgetValue = proj.budgetValue ? parseFloat(proj.budgetValue) : 0;
  const billedValue = proj.billedValue ? parseFloat(proj.billedValue) : 0;
  const burnRate = budgetHours > 0 ? consumedHours / budgetHours : 0;
  const projectedOverrun = burnRate > 1 ? (burnRate - 1) * budgetValue : 0;

  res.json({
    project: { ...proj, budgetHours, consumedHours, budgetValue, billedValue },
    milestones: projectMilestones,
    pendingApprovals: projectCRs,
    allocations: projectAllocations,
    budgetBurn: { budgetHours, consumedHours, budgetValue, billedValue, burnRate, projectedOverrun },
    recentActivity: activity.slice(-10).reverse().map((a) => ({
      ...a,
      timestamp: a.timestamp?.toISOString() ?? new Date().toISOString(),
    })),
  });
});

router.get("/dashboard/utilization", async (_req, res): Promise<void> => {
  const resources = await db.select().from(resourcesTable);

  const avgUtilization = resources.length
    ? Math.round(resources.reduce((sum, r) => sum + (r.currentUtilization ?? 0), 0) / resources.length)
    : 0;

  const practiceAreas = ["implementation", "cloud_migration", "ams", "qa_certification", "integration", "development", "data_migration"];
  const byPracticeArea = practiceAreas.map((area) => {
    const areaResources = resources.filter((r) => r.practiceArea === area);
    return {
      practiceArea: area,
      utilization: areaResources.length
        ? Math.round(areaResources.reduce((sum, r) => sum + (r.currentUtilization ?? 0), 0) / areaResources.length)
        : 0,
      headcount: areaResources.length,
    };
  });

  const weeks = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"];
  const trend = weeks.map((week) => ({
    week,
    utilization: 70 + Math.floor(Math.random() * 20),
  }));

  const headcountByStatus = {
    allocated: resources.filter((r) => r.status === "allocated").length,
    available: resources.filter((r) => r.status === "available").length,
    bench: resources.filter((r) => r.status === "bench").length,
    overAllocated: resources.filter((r) => r.status === "over_allocated").length,
  };

  res.json({ averageUtilization: avgUtilization, byPracticeArea, trend, headcountByStatus });
});

router.get("/dashboard/sales", async (req, res): Promise<void> => {
  res.redirect(307, "/api/dashboard/pipeline");
});

router.get("/dashboard/pm", async (_req, res): Promise<void> => {
  const [projects, milestones, tasks] = await Promise.all([
    db.select().from(projectsTable),
    db.select().from(milestonesTable),
    db.select().from(tasksTable),
  ]);
  const active = projects.filter(p => p.status === "active");
  const overdue = milestones.filter(m => m.status === "overdue" || (m.dueDate && m.dueDate < new Date().toISOString().split("T")[0] && m.status !== "completed"));
  const upcoming = milestones.filter(m => m.status !== "completed" && m.dueDate && m.dueDate >= new Date().toISOString().split("T")[0]).slice(0, 8);
  const blocked = tasks.filter(t => t.status === "blocked");
  res.json({ activeProjects: active, overdueMilestones: overdue, upcomingMilestones: upcoming, blockedTasks: blocked });
});

router.get("/dashboard/activity", async (req, res): Promise<void> => {
  const limit = parseInt((req.query.limit as string) ?? "20", 10);
  const activity = await db.select().from(activityLogsTable);
  res.json(
    activity
      .slice(-limit)
      .reverse()
      .map((a) => ({
        ...a,
        timestamp: a.timestamp?.toISOString() ?? new Date().toISOString(),
      }))
  );
});

export default router;
