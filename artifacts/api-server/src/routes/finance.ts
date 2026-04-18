import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, timesheetsTable, invoicesTable, projectsTable, allocationsTable, changeRequestsTable, rateCardsTable, contractsTable, milestonesTable, tasksTable, milestoneSignoffsTable } from "@workspace/db";

const router: IRouter = Router();

// Finance summary dashboard
router.get("/finance/summary", async (req, res): Promise<void> => {
  const [timesheets, invoices, projects, contracts] = await Promise.all([
    db.select().from(timesheetsTable),
    db.select().from(invoicesTable),
    db.select().from(projectsTable),
    db.select().from(contractsTable),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const adminProjectIds = new Set(projects.filter(p => p.isAdministrative).map(p => p.id));
  const approvedTs = timesheets.filter(t => t.status === "approved" && t.isBillable === true && !adminProjectIds.has(t.projectId));
  const pendingTs = timesheets.filter(t => t.status === "submitted");

  const wipHours = approvedTs.reduce((s, t) => s + parseFloat(t.billableHours || t.hoursLogged), 0);
  const totalInvoiced = invoices.reduce((s, i) => s + parseFloat(i.amount), 0);
  const paidInvoices = invoices.filter(i => i.status === "paid").reduce((s, i) => s + parseFloat(i.amount), 0);
  const outstanding = invoices.filter(i => ["sent", "overdue"].includes(i.status)).reduce((s, i) => s + parseFloat(i.amount), 0);
  const overdueInvoices = invoices.filter(i => i.status === "overdue" || (i.status === "sent" && i.dueDate && i.dueDate < today));
  const totalContractValue = contracts.reduce((s, c) => s + parseFloat(c.totalValue || "0"), 0);

  // WIP: approved billable hours not yet invoiced
  const invoicedProjectIds = new Set(invoices.filter(i => i.status !== "draft").map(i => i.projectId));
  const wipByProject: Record<number, { projectName: string; hours: number; estimatedValue: number }> = {};
  approvedTs.forEach(t => {
    const hours = parseFloat(t.billableHours || "0");
    if (!wipByProject[t.projectId]) wipByProject[t.projectId] = { projectName: t.projectName || `Project ${t.projectId}`, hours: 0, estimatedValue: 0 };
    wipByProject[t.projectId].hours += hours;
    wipByProject[t.projectId].estimatedValue += hours * 185; // default rate
  });

  res.json({
    wipHours: Math.round(wipHours),
    wipEstimatedValue: Object.values(wipByProject).reduce((s, p) => s + p.estimatedValue, 0),
    wipByProject: Object.entries(wipByProject).map(([id, data]) => ({ projectId: parseInt(id), ...data })),
    totalInvoiced,
    paidAmount: paidInvoices,
    outstandingAmount: outstanding,
    overdueCount: overdueInvoices.length,
    overdueAmount: overdueInvoices.reduce((s, i) => s + parseFloat(i.amount), 0),
    pendingTimesheets: pendingTs.length,
    totalContractValue,
    draftInvoices: invoices.filter(i => i.status === "draft").length,
  });
});

// WIP — approved timesheets not yet fully invoiced
router.get("/finance/wip", async (req, res): Promise<void> => {
  const [timesheets, projects] = await Promise.all([
    db.select().from(timesheetsTable),
    db.select({ id: projectsTable.id, isAdministrative: projectsTable.isAdministrative }).from(projectsTable),
  ]);
  const adminProjectIds = new Set(projects.filter(p => p.isAdministrative).map(p => p.id));
  const approved = timesheets.filter(t => t.status === "approved" && t.isBillable === true && !adminProjectIds.has(t.projectId));

  const byProject: Record<number, { projectId: number; projectName: string; entries: any[]; totalHours: number; billableHours: number; estimatedValue: number }> = {};
  approved.forEach(t => {
    const pid = t.projectId;
    if (!byProject[pid]) byProject[pid] = { projectId: pid, projectName: t.projectName || `Project ${pid}`, entries: [], totalHours: 0, billableHours: 0, estimatedValue: 0 };
    const bh = parseFloat(t.billableHours || "0");
    byProject[pid].entries.push({ ...t, hoursLogged: parseFloat(t.hoursLogged), billableHours: bh });
    byProject[pid].totalHours += parseFloat(t.hoursLogged);
    byProject[pid].billableHours += bh;
    byProject[pid].estimatedValue += bh * 185;
  });

  res.json(Object.values(byProject));
});

// Revenue leakage detection
router.get("/finance/leakage", async (req, res): Promise<void> => {
  const [timesheets, invoices, milestones] = await Promise.all([
    db.select().from(timesheetsTable),
    db.select().from(invoicesTable),
    db.select().from(changeRequestsTable),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const leakageItems: any[] = [];

  // 1. Approved billable timesheets not invoiced (exclude admin projects and non-billable entries)
  const adminPids = new Set((await db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.isAdministrative, true))).map(p => p.id));
  const approvedTs = timesheets.filter(t => t.status === "approved" && t.isBillable === true && parseFloat(t.billableHours || "0") > 0 && !adminPids.has(t.projectId));
  const invoicedProjects = new Set(invoices.filter(i => i.status !== "draft").map(i => i.projectId));
  const notInvoiced = approvedTs.filter(t => !invoicedProjects.has(t.projectId));
  if (notInvoiced.length > 0) {
    leakageItems.push({
      type: "uninvoiced_approved_work",
      severity: "high",
      title: "Approved billable work not invoiced",
      description: `${notInvoiced.length} approved timesheet entries not linked to any invoice`,
      estimatedValue: notInvoiced.reduce((s, t) => s + parseFloat(t.billableHours || "0") * 185, 0),
      affectedItems: notInvoiced.slice(0, 5).map(t => ({ id: t.id, projectName: t.projectName, hours: t.billableHours, week: t.weekStart })),
    });
  }

  // 2. Change requests delivered before approval
  const deliveredBeforeApproval = milestones.filter(cr => cr.deliveredBeforeApproval);
  if (deliveredBeforeApproval.length > 0) {
    deliveredBeforeApproval.forEach(cr => {
      leakageItems.push({
        type: "change_delivered_before_approval",
        severity: "critical",
        title: `Change delivered before approval: "${cr.title}"`,
        description: "Work completed before change order was approved — billing risk",
        estimatedValue: parseFloat(cr.impactCost || "0"),
        affectedItems: [{ id: cr.id, projectName: cr.projectName, title: cr.title }],
      });
    });
  }

  // 3. Overdue draft invoices
  const oldDrafts = invoices.filter(i => i.status === "draft" && i.issueDate && i.issueDate < today);
  if (oldDrafts.length > 0) {
    leakageItems.push({
      type: "stale_draft_invoices",
      severity: "medium",
      title: `${oldDrafts.length} draft invoices not sent`,
      description: "Invoices in draft state past their issue date",
      estimatedValue: oldDrafts.reduce((s, i) => s + parseFloat(i.amount), 0),
      affectedItems: oldDrafts.map(i => ({ id: i.id, invoiceNumber: i.invoiceNumber, amount: parseFloat(i.amount), projectName: i.projectName })),
    });
  }

  res.json({ leakageItems, totalLeakageRisk: leakageItems.reduce((s, i) => s + (i.estimatedValue || 0), 0) });
});

// Margin analysis by project
router.get("/finance/margin", async (req, res): Promise<void> => {
  const [projects, allocations, timesheets, invoices] = await Promise.all([
    db.select().from(projectsTable),
    db.select().from(allocationsTable),
    db.select().from(timesheetsTable),
    db.select().from(invoicesTable),
  ]);

  const marginByProject = projects.map(p => {
    const pAllocs = allocations.filter(a => a.projectId === p.id && a.allocationType !== "soft");
    const pTimesheets = timesheets.filter(t => t.projectId === p.id);
    const pInvoices = invoices.filter(i => i.projectId === p.id);

    const invoicedRevenue = pInvoices.filter(i => i.status !== "draft").reduce((s, i) => s + parseFloat(i.amount), 0);
    const paidRevenue = pInvoices.filter(i => i.status === "paid").reduce((s, i) => s + parseFloat(i.amount), 0);
    const approvedBillableTs = pTimesheets.filter(t => t.status === "approved" && t.isBillable === true);
    const approvedHours = approvedBillableTs.reduce((s, t) => s + parseFloat(t.hoursLogged), 0);
    const billableHours = approvedBillableTs.reduce((s, t) => s + parseFloat(t.billableHours || "0"), 0);
    const budgetValue = parseFloat(p.budgetValue || "0");
    const budgetHours = Number(p.budgetHours) || 0;
    const consumedHours = Number(p.consumedHours) || 0;

    const plannedMargin = budgetValue > 0 ? Math.round(((budgetValue - (budgetHours * 110)) / budgetValue) * 100) : null;
    const currentRevenue = parseFloat(p.billedValue || "0") || invoicedRevenue;
    const currentCost = approvedHours * 110;
    const currentMargin = currentRevenue > 0 ? Math.round(((currentRevenue - currentCost) / currentRevenue) * 100) : null;
    const marginRisks: string[] = [];
    if (consumedHours > budgetHours * 0.9 && invoicedRevenue < budgetValue * 0.7) marginRisks.push("High hour burn vs. low billing");
    if (currentMargin !== null && plannedMargin !== null && currentMargin < plannedMargin - 10) marginRisks.push("Current margin tracking below plan");

    return {
      project: { id: p.id, name: p.name, status: p.status, billingModel: p.type },
      plannedMargin, currentMargin,
      budgetValue, invoicedRevenue, paidRevenue,
      approvedHours, billableHours, consumedHours, budgetHours,
      marginRisks,
      allocationCount: pAllocs.length,
    };
  });

  res.json(marginByProject);
});

// Receivables aging
router.get("/finance/receivables", async (req, res): Promise<void> => {
  const invoices = await db.select().from(invoicesTable);
  const today = new Date();

  const aging = invoices.filter(i => ["sent", "overdue"].includes(i.status)).map(i => {
    const dueDate = i.dueDate ? new Date(i.dueDate) : null;
    const daysPastDue = dueDate ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const bucket = daysPastDue <= 0 ? "current" : daysPastDue <= 30 ? "1-30" : daysPastDue <= 60 ? "31-60" : daysPastDue <= 90 ? "61-90" : "90+";
    return { ...i, amount: parseFloat(i.amount), daysPastDue, bucket };
  });

  const buckets: Record<string, { count: number; amount: number }> = { current: {count:0, amount:0}, "1-30": {count:0, amount:0}, "31-60": {count:0, amount:0}, "61-90": {count:0, amount:0}, "90+": {count:0, amount:0} };
  aging.forEach(i => {
    if (buckets[i.bucket]) { buckets[i.bucket].count++; buckets[i.bucket].amount += i.amount; }
  });

  res.json({ receivables: aging, agingBuckets: buckets, totalOutstanding: aging.reduce((s, i) => s + i.amount, 0) });
});

// Timesheet approval queue
router.get("/finance/timesheet-queue", async (req, res): Promise<void> => {
  const timesheets = await db.select().from(timesheetsTable);
  const queue = timesheets.filter(t => t.status === "submitted").map(t => ({
    ...t,
    hoursLogged: parseFloat(t.hoursLogged),
    billableHours: t.billableHours ? parseFloat(t.billableHours) : null,
    flags: parseFloat(t.hoursLogged) > 50 ? ["high_hours"] : [],
  }));
  res.json(queue);
});

// Approve/reject timesheet
router.post("/timesheets/:id/approve", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { approvedByName } = req.body;
  const today = new Date().toISOString().split("T")[0];
  const [ts] = await db.update(timesheetsTable).set({ status: "approved", approvedByName, approvedAt: today }).where(eq(timesheetsTable.id, id)).returning();
  if (!ts) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...ts, hoursLogged: parseFloat(ts.hoursLogged), billableHours: ts.billableHours ? parseFloat(ts.billableHours) : null });
});

router.post("/timesheets/:id/reject", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { rejectedReason } = req.body;
  const today = new Date().toISOString().split("T")[0];
  const [ts] = await db.update(timesheetsTable).set({ status: "rejected", rejectedReason, rejectedAt: today }).where(eq(timesheetsTable.id, id)).returning();
  if (!ts) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...ts, hoursLogged: parseFloat(ts.hoursLogged) });
});

// Log daily time
router.post("/timesheets/log", async (req, res): Promise<void> => {
  const { projectId, projectName, resourceId, resourceName, hoursLogged, billableHours, activityType, notes, entryDate, taskId, isBillable } = req.body;
  if (!projectId || !resourceId || !hoursLogged) { res.status(400).json({ error: "projectId, resourceId, hoursLogged required" }); return; }
  const today = new Date();
  const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekStart = monday.toISOString().split("T")[0];
  const [ts] = await db.insert(timesheetsTable).values({
    projectId: parseInt(projectId), projectName, resourceId: parseInt(resourceId), resourceName,
    weekStart, hoursLogged, billableHours, status: "draft", activityType: activityType || "consulting",
    notes, entryDate: entryDate || today.toISOString().split("T")[0], taskId, isBillable: isBillable !== false,
  }).returning();
  res.status(201).json(ts);
});

// ── Profitability per project ─────────────────────────────────────────────────
router.get("/finance/profitability", async (req, res): Promise<void> => {
  const [projects, timesheets, invoices, rateCards] = await Promise.all([
    db.select().from(projectsTable),
    db.select().from(timesheetsTable),
    db.select().from(invoicesTable),
    db.select().from(rateCardsTable),
  ]);

  const defaultRate = 185;
  const defaultCostRate = 95;

  const result = projects.filter(p => p.status !== "cancelled" && !p.isAdministrative).map(p => {
    const pTs = timesheets.filter(t => t.projectId === p.id && t.status === "approved" && t.isBillable === true);
    const pInvoices = invoices.filter(i => i.projectId === p.id);
    const pRC = rateCards.find(r => r.projectId === p.id);

    const billableRate = pRC ? parseFloat((pRC.billingRate as string) || String(defaultRate)) : defaultRate;
    const costRate = pRC?.costRate ? parseFloat(pRC.costRate as string) : defaultCostRate;

    const billedRevenue = pInvoices
      .filter(i => ["sent", "paid"].includes(i.status))
      .reduce((s, i) => s + parseFloat(i.amount || "0"), 0);
    const paidRevenue = pInvoices
      .filter(i => i.status === "paid")
      .reduce((s, i) => s + parseFloat(i.amount || "0"), 0);
    const totalHours = pTs.reduce((s, t) => s + parseFloat(t.hoursLogged || "0"), 0);
    const billableHours = pTs.reduce((s, t) => s + parseFloat(t.billableHours || "0"), 0);
    const costValue = totalHours * costRate;
    const revenueValue = billedRevenue || (billableHours * billableRate);
    const budget = p.budgetValue ? parseFloat(p.budgetValue) : 0;
    const margin = revenueValue > 0 ? Math.round(((revenueValue - costValue) / revenueValue) * 100) : null;
    const budgetMargin = budget > 0 ? Math.round(((budget - (parseFloat(p.budgetHours || "0") * costRate)) / budget) * 100) : null;

    return {
      project: { id: p.id, name: p.name, status: p.status, accountName: p.accountName, type: p.type },
      budget,
      billedRevenue,
      paidRevenue,
      totalHours: Math.round(totalHours),
      billableHours: Math.round(billableHours),
      costValue: Math.round(costValue),
      revenueValue: Math.round(revenueValue),
      margin,
      budgetMargin,
      profitValue: Math.round(revenueValue - costValue),
      isUnderMargin: margin !== null && margin < 20,
    };
  });

  const totals = {
    totalRevenue: result.reduce((s, p) => s + p.revenueValue, 0),
    totalCost: result.reduce((s, p) => s + p.costValue, 0),
    totalProfit: result.reduce((s, p) => s + p.profitValue, 0),
    avgMargin: result.filter(p => p.margin !== null).length > 0
      ? Math.round(result.filter(p => p.margin !== null).reduce((s, p) => s + (p.margin || 0), 0) / result.filter(p => p.margin !== null).length)
      : 0,
    projectsUnderMargin: result.filter(p => p.isUnderMargin).length,
  };

  res.json({ projects: result, totals });
});

// ── Cash Flow Forecast (12 weeks) ─────────────────────────────────────────────
router.get("/finance/cashflow-forecast", async (req, res): Promise<void> => {
  const [invoices, milestones] = await Promise.all([
    db.select().from(invoicesTable),
    db.select().from(milestonesTable),
  ]);

  const today = new Date();
  const weeks: { weekStart: string; weekEnd: string; weekLabel: string; inflow: number; outflow: number; net: number; details: string[] }[] = [];

  for (let w = 0; w < 12; w++) {
    const ws = new Date(today); ws.setDate(today.getDate() + w * 7 - today.getDay());
    const we = new Date(ws); we.setDate(ws.getDate() + 6);
    const wsStr = ws.toISOString().split("T")[0];
    const weStr = we.toISOString().split("T")[0];

    const weekInvoices = invoices.filter(i => i.dueDate && i.dueDate >= wsStr && i.dueDate <= weStr && ["sent", "overdue"].includes(i.status));
    const billableMilestones = milestones.filter(m => m.dueDate && m.dueDate >= wsStr && m.dueDate <= weStr && m.isBillable && m.status !== "completed" && !m.invoiced);

    const inflow = weekInvoices.reduce((s, i) => s + parseFloat(i.amount || "0"), 0);
    const projected = billableMilestones.reduce((s, m) => s + parseFloat(m.billableAmount || "0"), 0);
    const details = [
      ...weekInvoices.map(i => `Invoice ${i.invoiceNumber}: ${i.amount}`),
      ...billableMilestones.map(m => `Projected: ${m.name}`),
    ];

    weeks.push({
      weekStart: wsStr, weekEnd: weStr,
      weekLabel: `W${w + 1} (${ws.toLocaleDateString("en-US", { month: "short", day: "numeric" })})`,
      inflow: Math.round(inflow), outflow: 0, net: Math.round(inflow + projected),
      details,
    });
  }

  const outstanding = invoices.filter(i => ["sent", "overdue"].includes(i.status)).reduce((s, i) => s + parseFloat(i.amount || "0"), 0);
  const projected12w = weeks.reduce((s, w) => s + w.net, 0);

  res.json({ weeks, summary: { outstanding, projected12w, overdueCount: invoices.filter(i => i.status === "overdue").length } });
});

router.get("/clients/:id/portal", async (req, res): Promise<void> => {
  const accountId = parseInt(req.params.id);
  if (isNaN(accountId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [projects, allMilestones, allTasks, invoices, allChangeRequests, allSignoffs] = await Promise.all([
    db.select().from(projectsTable).where(eq(projectsTable.accountId, accountId)),
    db.select().from(milestonesTable),
    db.select().from(tasksTable),
    db.select().from(invoicesTable).where(eq(invoicesTable.accountId, accountId)),
    db.select().from(changeRequestsTable),
    db.select().from(milestoneSignoffsTable),
  ]);

  const milestones = allMilestones;
  const tasks = allTasks;
  const changeRequests = allChangeRequests;
  const signoffMap = new Map(allSignoffs.map(s => [s.milestoneId, s]));

  const projectIds = new Set(projects.map(p => p.id));
  const clientMilestones = milestones.filter(m => m.projectId && projectIds.has(m.projectId));
  const clientTasks = tasks.filter(t => t.projectId && projectIds.has(t.projectId) && t.visibility !== "internal_only");
  const clientCRs = changeRequests.filter(cr => projectIds.has(cr.projectId) && ["client_review", "approved"].includes(cr.status));

  const today = new Date().toISOString().split("T")[0];
  const overdueMilestones = clientMilestones.filter(m => m.status !== "completed" && m.dueDate && m.dueDate < today);
  const actionNeeded = clientTasks.filter(t => t.isClientAction && t.status !== "completed");
  const pendingApprovals = clientCRs.filter(cr => cr.status === "client_review");

  res.json({
    projects: projects.map(p => ({
      id: p.id, name: p.name, status: p.status, healthScore: p.healthScore,
      startDate: p.startDate, endDate: p.endDate, currentPhase: p.currentPhase,
    })),
    milestones: clientMilestones.map(m => {
      const signoff = signoffMap.get(m.id);
      return {
        id: m.id, name: m.name, status: m.status, dueDate: m.dueDate,
        projectId: m.projectId, isBillable: m.isBillable,
        approvalStatus: m.approvalStatus,
        signedBy: signoff?.signerName ?? null,
        signedAt: signoff?.signedAt ?? null,
      };
    }),
    actionNeeded: actionNeeded.map(t => ({ id: t.id, title: t.name, projectId: t.projectId, priority: t.priority, dueDate: t.dueDate })),
    pendingApprovals: pendingApprovals.map(cr => ({ id: cr.id, title: cr.title, projectName: cr.projectName, impactCost: parseFloat(cr.impactCost || "0"), impactHours: parseFloat(cr.impactHours || "0") })),
    overdueMilestones: overdueMilestones.map(m => ({ id: m.id, name: m.name, dueDate: m.dueDate, projectId: m.projectId })),
    invoices: invoices.map(i => ({ id: i.id, invoiceNumber: i.invoiceNumber, amount: parseFloat(i.amount), status: i.status, dueDate: i.dueDate })),
    summary: {
      totalProjects: projects.length,
      completedMilestones: clientMilestones.filter(m => m.status === "completed").length,
      totalMilestones: clientMilestones.length,
      actionsRequired: actionNeeded.length,
      pendingApprovals: pendingApprovals.length,
      overdueMilestones: overdueMilestones.length,
    },
  });
});

export default router;
