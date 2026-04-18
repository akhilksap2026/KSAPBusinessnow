import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db, accountsTable, projectsTable, milestonesTable, tasksTable,
  invoicesTable, changeRequestsTable, formResponsesTable, renewalSignalsTable,
  allocationsTable,
} from "@workspace/db";

const router: IRouter = Router();

function computeAccountHealth(
  projects: any[],
  milestones: any[],
  invoices: any[],
  changeRequests: any[],
  csatScores: number[],
) {
  let score = 100;
  const reasons: { type: string; severity: "critical" | "high" | "medium" | "low"; detail: string; deduction: number }[] = [];
  const today = new Date().toISOString().split("T")[0];

  const overdue = milestones.filter(m => m.status !== "completed" && m.dueDate && m.dueDate < today);
  if (overdue.length > 0) {
    const deduction = Math.min(overdue.length * 8, 24);
    score -= deduction;
    reasons.push({ type: "overdue_milestones", severity: overdue.length >= 3 ? "critical" : "high", detail: `${overdue.length} overdue milestone${overdue.length !== 1 ? "s" : ""}`, deduction });
  }

  if (csatScores.length >= 1) {
    const avg = csatScores.reduce((s, n) => s + n, 0) / csatScores.length;
    if (avg < 3.5) {
      score -= 15;
      reasons.push({ type: "low_csat", severity: avg < 2.5 ? "critical" : "high", detail: `Average CSAT ${avg.toFixed(1)}/5.0`, deduction: 15 });
    }
  }

  const clientReviewCRs = changeRequests.filter(cr => cr.status === "client_review").length;
  if (clientReviewCRs >= 3) {
    score -= 12;
    reasons.push({ type: "change_friction", severity: "high", detail: `${clientReviewCRs} change orders awaiting client approval`, deduction: 12 });
  } else if (clientReviewCRs === 1) {
    score -= 4;
    reasons.push({ type: "change_friction", severity: "low", detail: `1 change order pending client approval`, deduction: 4 });
  }

  const leakageCRs = changeRequests.filter(cr => cr.deliveredBeforeApproval).length;
  if (leakageCRs > 0) {
    score -= 10;
    reasons.push({ type: "revenue_leakage", severity: "critical", detail: `${leakageCRs} change order(s) delivered before approval`, deduction: 10 });
  }

  const overdueInvoices = invoices.filter(i => i.status === "overdue" || (i.status === "sent" && i.dueDate && i.dueDate < today));
  if (overdueInvoices.length > 0) {
    const deduction = Math.min(overdueInvoices.length * 8, 16);
    score -= deduction;
    reasons.push({ type: "overdue_invoices", severity: overdueInvoices.length >= 2 ? "high" : "medium", detail: `${overdueInvoices.length} overdue invoice${overdueInvoices.length !== 1 ? "s" : ""}`, deduction });
  }

  const avgProjectHealth = projects.length > 0 ? projects.reduce((s, p) => s + (p.healthScore || 75), 0) / projects.length : 75;
  if (avgProjectHealth < 70) {
    score -= 15;
    reasons.push({ type: "project_health_rollup", severity: avgProjectHealth < 55 ? "critical" : "high", detail: `Average project health ${Math.round(avgProjectHealth)}/100`, deduction: 15 });
  } else if (avgProjectHealth < 80) {
    score -= 5;
    reasons.push({ type: "project_health_rollup", severity: "low", detail: `Average project health ${Math.round(avgProjectHealth)}/100`, deduction: 5 });
  }

  return { score: Math.max(0, Math.min(100, score)), reasons, avgProjectHealth: Math.round(avgProjectHealth) };
}

router.get("/accounts/:id/health", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, id));
  if (!account) { res.status(404).json({ error: "Not found" }); return; }

  const [projects, allMilestones, invoices, allChangeRequests, csatResponses, renewalSignals, allTasks] = await Promise.all([
    db.select().from(projectsTable).where(eq(projectsTable.accountId, id)),
    db.select().from(milestonesTable),
    db.select().from(invoicesTable).where(eq(invoicesTable.accountId, id)),
    db.select().from(changeRequestsTable),
    db.select().from(formResponsesTable),
    db.select().from(renewalSignalsTable).where(eq(renewalSignalsTable.accountId, id)),
    db.select().from(tasksTable),
  ]);

  const projectIds = new Set(projects.map(p => p.id));
  const milestones = allMilestones.filter(m => m.projectId && projectIds.has(m.projectId));
  const accountCRs = allChangeRequests.filter(cr => projectIds.has(cr.projectId));
  const csatScores = csatResponses.filter(r => r.csatScore !== null).map(r => r.csatScore!);
  const clientActions = allTasks.filter(t => projectIds.has(t.projectId || 0) && t.isClientAction && t.status !== "completed");

  const { score, reasons, avgProjectHealth } = computeAccountHealth(
    projects, milestones, invoices, accountCRs, csatScores,
  );

  await db.update(accountsTable).set({ healthScore: score }).where(eq(accountsTable.id, id));

  const today = new Date().toISOString().split("T")[0];
  const overdueMilestones = milestones.filter(m => m.status !== "completed" && m.dueDate && m.dueDate < today);
  const upcoming90d = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const upcomingGoLives = projects.filter(p => p.goLiveDate && p.goLiveDate >= today && p.goLiveDate <= upcoming90d);

  res.json({
    account: { ...account, annualContractValue: account.annualContractValue ? parseFloat(account.annualContractValue) : null },
    healthScore: score,
    healthReasons: reasons,
    projects: projects.map(p => ({
      id: p.id, name: p.name, status: p.status, healthScore: p.healthScore,
      goLiveDate: p.goLiveDate, currentPhase: p.currentPhase, completionPct: p.completionPct,
      budgetValue: parseFloat(p.budgetValue || "0"), billedValue: parseFloat(p.billedValue || "0"),
      type: p.type,
    })),
    avgProjectHealth,
    overdueMilestones: overdueMilestones.map(m => ({ id: m.id, name: m.name, dueDate: m.dueDate, projectId: m.projectId })),
    clientActions: clientActions.map(t => ({ id: t.id, title: t.name, projectId: t.projectId, priority: t.priority })),
    upcomingGoLives: upcomingGoLives.map(p => ({ id: p.id, name: p.name, goLiveDate: p.goLiveDate })),
    invoiceSummary: {
      total: invoices.reduce((s, i) => s + parseFloat(i.amount), 0),
      paid: invoices.filter(i => i.status === "paid").reduce((s, i) => s + parseFloat(i.amount), 0),
      outstanding: invoices.filter(i => ["sent", "overdue"].includes(i.status)).reduce((s, i) => s + parseFloat(i.amount), 0),
      overdueCount: invoices.filter(i => i.status === "overdue" || (i.status === "sent" && i.dueDate && i.dueDate < today)).length,
    },
    csatAvg: csatScores.length > 0 ? Math.round((csatScores.reduce((s, n) => s + n, 0) / csatScores.length) * 10) / 10 : null,
    renewalSignals: renewalSignals.map(s => ({ ...s, estimatedValue: s.estimatedValue ? parseFloat(s.estimatedValue) : null })),
    changeRequests: accountCRs.map(cr => ({ id: cr.id, title: cr.title, status: cr.status, impactCost: parseFloat(cr.impactCost || "0"), deliveredBeforeApproval: cr.deliveredBeforeApproval })),
  });
});

router.get("/portfolio", async (req, res): Promise<void> => {
  const [projects, accounts, milestones, invoices, changeRequests, allocations] = await Promise.all([
    db.select().from(projectsTable),
    db.select().from(accountsTable),
    db.select().from(milestonesTable),
    db.select().from(invoicesTable),
    db.select().from(changeRequestsTable),
    db.select().from(allocationsTable),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const upcoming90d = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const activeProjects = projects.filter(p => p.status === "active");
  const atRiskProjects = projects.filter(p => (p.healthScore || 75) < 65);
  const upcomingGoLives = projects.filter(p => p.goLiveDate && p.goLiveDate >= today && p.goLiveDate <= upcoming90d);
  const overdueInvoices = invoices.filter(i => i.status === "overdue" || (i.status === "sent" && i.dueDate && i.dueDate < today));

  const totalBudget = projects.reduce((s, p) => s + parseFloat(p.budgetValue || "0"), 0);
  const totalBilled = projects.reduce((s, p) => s + parseFloat(p.billedValue || "0"), 0);
  const revenueAtRisk = atRiskProjects.reduce((s, p) => s + Math.max(0, parseFloat(p.budgetValue || "0") - parseFloat(p.billedValue || "0")), 0);

  const totalAllocatedFTE = allocations.filter(a => a.allocationType === "hard").reduce((s, a) => s + (a.allocationPct || 0), 0) / 100;

  const enrichedProjects = projects.map(p => {
    const pMilestones = milestones.filter(m => m.projectId === p.id);
    const overdueCnt = pMilestones.filter(m => m.status !== "completed" && m.dueDate && m.dueDate < today).length;
    const account = accounts.find(a => a.id === p.accountId);
    return {
      id: p.id, name: p.name, status: p.status, healthScore: p.healthScore || 75,
      accountName: p.accountName, accountId: p.accountId, pmName: p.pmName,
      goLiveDate: p.goLiveDate, completionPct: p.completionPct || 0,
      currentPhase: p.currentPhase, endDate: p.endDate, type: p.type,
      budgetValue: parseFloat(p.budgetValue || "0"),
      billedValue: parseFloat(p.billedValue || "0"),
      budgetHours: parseFloat(p.budgetHours || "0"),
      consumedHours: parseFloat(p.consumedHours || "0"),
      overdueMilestones: overdueCnt,
      accountHealthScore: account?.healthScore || 75,
    };
  });

  const accountSummaries = accounts.map(a => {
    const aProjects = projects.filter(p => p.accountId === a.id && p.status === "active");
    const aInvoices = invoices.filter(i => i.accountId === a.id);
    return {
      id: a.id, name: a.name, healthScore: a.healthScore || 75, segment: a.segment,
      renewalDate: a.renewalDate, activeProjects: aProjects.length,
      overdueInvoices: aInvoices.filter(i => i.status === "overdue").length,
      annualContractValue: a.annualContractValue ? parseFloat(a.annualContractValue) : null,
    };
  });

  res.json({
    summary: {
      activeProjects: activeProjects.length, totalProjects: projects.length,
      atRiskCount: atRiskProjects.length, upcomingGoLives: upcomingGoLives.length,
      totalBudget, totalBilled, revenueAtRisk,
      totalAllocatedFTE: Math.round(totalAllocatedFTE * 10) / 10,
      overdueInvoiceCount: overdueInvoices.length,
      overdueInvoiceAmount: overdueInvoices.reduce((s, i) => s + parseFloat(i.amount), 0),
      pendingCRCount: changeRequests.filter(cr => cr.status === "client_review").length,
    },
    projects: enrichedProjects,
    accounts: accountSummaries,
    upcomingGoLives: upcomingGoLives.map(p => ({ id: p.id, name: p.name, goLiveDate: p.goLiveDate, accountName: p.accountName, pmName: p.pmName })),
    atRiskProjects: atRiskProjects.map(p => ({ id: p.id, name: p.name, healthScore: p.healthScore, accountName: p.accountName, budgetValue: parseFloat(p.budgetValue || "0"), billedValue: parseFloat(p.billedValue || "0") })),
  });
});

router.get("/portfolio/director", async (req, res): Promise<void> => {
  const [projects, milestones, tasks, changeRequests, allocations] = await Promise.all([
    db.select().from(projectsTable),
    db.select().from(milestonesTable),
    db.select().from(tasksTable),
    db.select().from(changeRequestsTable),
    db.select().from(allocationsTable),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const blockedTasks = tasks.filter(t => t.status === "blocked");
  const blockedProjectIds = new Set(blockedTasks.map(t => t.projectId));
  const blockedProjects = projects.filter(p => blockedProjectIds.has(p.id)).map(p => ({
    id: p.id, name: p.name, accountName: p.accountName, healthScore: p.healthScore,
    pmName: p.pmName,
    blockers: blockedTasks.filter(t => t.projectId === p.id).map(t => ({ id: t.id, title: t.name, blockerNote: t.blockerNote })),
  }));

  const overdueMilestones = milestones.filter(m => m.status !== "completed" && m.dueDate && m.dueDate < today);
  const overdueByProject = projects.map(p => ({
    project: { id: p.id, name: p.name, accountName: p.accountName, pmName: p.pmName },
    overdueMilestones: overdueMilestones.filter(m => m.projectId === p.id).map(m => ({ id: m.id, name: m.name, dueDate: m.dueDate })),
  })).filter(p => p.overdueMilestones.length > 0);

  const escalations = projects.filter(p => (p.healthScore || 75) < 65).map(p => ({
    id: p.id, name: p.name, healthScore: p.healthScore, accountName: p.accountName,
    pmName: p.pmName, status: p.status, endDate: p.endDate,
  }));

  const resourceAllocs: Record<number, number> = {};
  allocations.filter(a => a.allocationType === "hard").forEach(a => {
    if (!resourceAllocs[a.resourceId]) resourceAllocs[a.resourceId] = 0;
    resourceAllocs[a.resourceId] += (a.allocationPct || 0);
  });
  const overallocated = Object.entries(resourceAllocs)
    .filter(([, pct]) => pct > 100)
    .map(([id, pct]) => ({ resourceId: parseInt(id), totalPct: pct }));

  const pendingClientCRs = changeRequests.filter(cr => cr.status === "client_review");
  const leakageCRs = changeRequests.filter(cr => cr.deliveredBeforeApproval);

  res.json({
    escalations,
    blockedProjects,
    overdueByProject,
    staffingConflicts: { overallocatedCount: overallocated.length, overallocated },
    changeOrderAlerts: {
      pendingClient: pendingClientCRs.length,
      leakageRisk: leakageCRs.length,
      items: [...pendingClientCRs, ...leakageCRs].map(cr => ({
        id: cr.id, title: cr.title, projectName: cr.projectName, status: cr.status,
        impactCost: parseFloat(cr.impactCost || "0"), deliveredBeforeApproval: cr.deliveredBeforeApproval,
      })),
    },
    summary: {
      escalationCount: escalations.length,
      blockedProjectCount: blockedProjects.length,
      overdueMilestoneCount: overdueMilestones.length,
      staffingConflictCount: overallocated.length,
    },
  });
});

// ── QBR Report ───────────────────────────────────────────────────────────────
router.get("/accounts/:id/qbr-report", async (req, res): Promise<void> => {
  const accountId = parseInt(req.params.id);
  if (isNaN(accountId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId));
  if (!account) { res.status(404).json({ error: "Account not found" }); return; }

  const [projects, milestones, invoices, changeRequests, renewalSignals] = await Promise.all([
    db.select().from(projectsTable).where(eq(projectsTable.accountId, accountId)),
    db.select().from(milestonesTable),
    db.select().from(invoicesTable).where(eq(invoicesTable.accountId, accountId)),
    db.select().from(changeRequestsTable),
    db.select().from(renewalSignalsTable).where(eq(renewalSignalsTable.accountId, accountId)),
  ]);

  const projectIds = new Set(projects.map(p => p.id));
  const accountMilestones = milestones.filter(m => m.projectId && projectIds.has(m.projectId));
  const accountCRs = changeRequests.filter(cr => projectIds.has(cr.projectId));
  const today = new Date().toISOString().split("T")[0];

  const totalBilled = invoices.filter(i => ["sent", "paid"].includes(i.status)).reduce((s, i) => s + parseFloat(i.amount || "0"), 0);
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + parseFloat(i.amount || "0"), 0);
  const outstanding = invoices.filter(i => ["sent", "overdue"].includes(i.status)).reduce((s, i) => s + parseFloat(i.amount || "0"), 0);
  const completedMs = accountMilestones.filter(m => m.status === "completed").length;
  const overdueMs = accountMilestones.filter(m => m.status !== "completed" && m.dueDate && m.dueDate < today);
  const avgHealth = projects.length > 0 ? Math.round(projects.reduce((s, p) => s + (p.healthScore || 75), 0) / projects.length) : 0;

  const projectSummaries = projects.map(p => {
    const pMs = accountMilestones.filter(m => m.projectId === p.id);
    const pDoneMs = pMs.filter(m => m.status === "completed").length;
    return {
      id: p.id, name: p.name, status: p.status, type: p.type,
      health: p.healthScore || 75,
      completion: p.completionPct || 0,
      startDate: p.startDate, endDate: p.endDate, goLiveDate: p.goLiveDate,
      milestonesComplete: pDoneMs, milestonesTotal: pMs.length,
      budget: p.budgetValue ? parseFloat(p.budgetValue) : null,
      billed: p.billedValue ? parseFloat(p.billedValue) : null,
    };
  });

  res.json({
    account: {
      id: account.id, name: account.name, industry: account.industry,
      region: account.region, otmVersion: account.otmVersion,
      acv: account.annualContractValue ? parseFloat(account.annualContractValue) : 0,
      renewalDate: account.renewalDate,
    },
    generatedAt: new Date().toISOString(),
    period: { start: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split("T")[0], end: today },
    executiveSummary: {
      avgHealth, totalProjects: projects.length,
      activeProjects: projects.filter(p => p.status === "active").length,
      totalBilled, totalPaid, outstanding,
      completedMilestones: completedMs, totalMilestones: accountMilestones.length,
      overdueMilestones: overdueMs.length,
      openChangeOrders: accountCRs.filter(cr => ["pending", "client_review"].includes(cr.status)).length,
    },
    projects: projectSummaries,
    financials: {
      invoices: invoices.map(i => ({
        invoiceNumber: i.invoiceNumber, amount: parseFloat(i.amount || "0"),
        status: i.status, issueDate: i.issueDate, dueDate: i.dueDate,
      })),
      totalBilled, totalPaid, outstanding,
    },
    milestones: {
      completed: accountMilestones.filter(m => m.status === "completed").map(m => ({ name: m.name, dueDate: m.dueDate, projectId: m.projectId })),
      overdue: overdueMs.map(m => ({ name: m.name, dueDate: m.dueDate, projectId: m.projectId })),
    },
    changeOrders: accountCRs.map(cr => ({
      title: cr.title, status: cr.status, impactCost: parseFloat(cr.impactCost || "0"),
      impactHours: parseFloat(cr.impactHours || "0"),
    })),
    renewalSignals: renewalSignals.map(s => ({
      signalType: s.signalType, description: s.description, priority: s.priority,
      estimatedValue: s.estimatedValue ? parseFloat(s.estimatedValue) : 0,
      dueDate: s.dueDate, status: s.status,
    })),
  });
});

export default router;
