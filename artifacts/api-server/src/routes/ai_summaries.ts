import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  projectsTable,
  milestonesTable,
  tasksTable,
  changeRequestsTable,
  allocationsTable,
  accountsTable,
  invoicesTable,
  renewalSignalsTable,
  formResponsesTable,
} from "@workspace/db";

const router: IRouter = Router();

// ── Shared helpers ────────────────────────────────────────────────────────────

function fmt(v: number) {
  if (!v) return "$0";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

function healthLabel(score: number) {
  return score >= 80 ? "healthy" : score >= 65 ? "at risk" : "critical";
}

function statusLabel(s: string) {
  return s === "on_track" ? "on track" : s === "at_risk" ? "at risk" : s === "critical" ? "critical" : s;
}

// ── GET /projects/:id/ai-summary ──────────────────────────────────────────────

router.get("/projects/:id/ai-summary", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: "Not found" }); return; }

  const today = new Date().toISOString().split("T")[0];

  const [milestones, tasks, changeRequests, allocations] = await Promise.all([
    db.select().from(milestonesTable).where(eq(milestonesTable.projectId, id)),
    db.select().from(tasksTable).where(eq(tasksTable.projectId, id)),
    db.select().from(changeRequestsTable).where(eq(changeRequestsTable.projectId, id)),
    db.select().from(allocationsTable).where(eq(allocationsTable.projectId, id)),
  ]);

  // Metrics
  const overdueMilestones = milestones.filter(m => m.dueDate && m.dueDate < today && m.status !== "completed" && m.status !== "cancelled");
  const completedMilestones = milestones.filter(m => m.status === "completed");
  const blockedTasks = tasks.filter(t => t.status === "blocked");
  const doneTasks = tasks.filter(t => t.status === "done" || t.status === "completed");
  const completionPct = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : (project.completionPct ?? 0);

  const budgetHours = parseFloat(project.budgetHours || "0");
  const consumedHours = parseFloat(project.consumedHours || "0");
  const burnPct = budgetHours > 0 ? Math.round((consumedHours / budgetHours) * 100) : 0;
  const budgetValue = parseFloat(project.budgetValue || "0");
  const billedValue = parseFloat(project.billedValue || "0");
  const billingPct = budgetValue > 0 ? Math.round((billedValue / budgetValue) * 100) : 0;
  const blendedRate = 85;
  const laborCost = consumedHours * blendedRate;
  const marginPct = budgetValue > 0 ? Math.round(((budgetValue - laborCost) / budgetValue) * 100) : null;

  const openCRs = changeRequests.filter(cr => !["approved", "rejected"].includes(cr.status));
  const highBurn = burnPct > completionPct + 20 && burnPct > 40;
  const lowMargin = marginPct !== null && marginPct < 20;

  const healthScore: number = project.healthScore ?? 100;
  const hl = healthLabel(healthScore);

  // Next upcoming milestone
  const futureMilestones = milestones.filter(m => m.dueDate && m.dueDate >= today && m.status !== "completed" && m.status !== "cancelled").sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
  const nextMilestone = futureMilestones[0];

  // Staffing pressure: allocations over-committed vs total
  const overAllocated = allocations.filter(a => parseFloat(a.allocationPct || "0") > 100).length;

  // ── Title ────────────────────────────────────────────────────────────────
  const title = `Project Health Summary — ${project.name}`;

  // ── Summary paragraph ────────────────────────────────────────────────────
  let summary: string;
  if (healthScore >= 80) {
    summary = `${project.name} is in ${hl} condition with a health score of ${healthScore}/100. Task completion stands at ${completionPct}% with ${overdueMilestones.length === 0 ? "no overdue milestones" : `${overdueMilestones.length} overdue milestone${overdueMilestones.length > 1 ? "s" : ""}`}. Budget burn is ${burnPct}%${billingPct > 0 ? `, and ${billingPct}% of the budget has been billed to the client` : ""}.`;
  } else if (healthScore >= 65) {
    const topConcern = overdueMilestones.length > 0
      ? `${overdueMilestones.length} overdue milestone${overdueMilestones.length > 1 ? "s" : ""}`
      : blockedTasks.length > 0 ? `${blockedTasks.length} blocked task${blockedTasks.length > 1 ? "s" : ""}`
      : highBurn ? `budget burn at ${burnPct}% against ${completionPct}% completion`
      : "elevated risk factors";
    summary = `${project.name} is ${hl} with a health score of ${healthScore}/100, primarily due to ${topConcern}. The project is ${completionPct}% complete with a budget burn rate of ${burnPct}%. Immediate attention is recommended to prevent further deterioration.`;
  } else {
    summary = `${project.name} is in critical condition with a health score of ${healthScore}/100. Multiple risk factors are compounding — ${overdueMilestones.length > 0 ? `${overdueMilestones.length} milestone${overdueMilestones.length > 1 ? "s are" : " is"} overdue` : ""}${blockedTasks.length > 0 ? `, ${blockedTasks.length} task${blockedTasks.length > 1 ? "s are" : " is"} blocked` : ""}${highBurn ? `, and budget burn has reached ${burnPct}%` : ""}. Urgent executive action is required.`;
  }

  // ── Bullets ──────────────────────────────────────────────────────────────
  const bullets: string[] = [];
  bullets.push(`Health score: ${healthScore}/100 — ${hl}`);
  bullets.push(`Task completion: ${completionPct}% (${doneTasks.length} of ${tasks.length} tasks done)`);
  bullets.push(`Milestones: ${completedMilestones.length}/${milestones.length} complete${overdueMilestones.length > 0 ? `, ${overdueMilestones.length} overdue` : ""}`);
  bullets.push(`Budget burn: ${burnPct}% of allocated hours consumed`);
  if (marginPct !== null) bullets.push(`Estimated margin: ${marginPct}%${marginPct < 20 ? " — below 20% threshold" : ""}`);
  if (billingPct > 0) bullets.push(`Billed to client: ${fmt(billedValue)} (${billingPct}% of budget)`);
  if (openCRs.length > 0) bullets.push(`Open change orders: ${openCRs.length} pending approval`);
  if (blockedTasks.length > 0) bullets.push(`Blocked tasks: ${blockedTasks.length} requiring resolution`);
  if (nextMilestone) bullets.push(`Next milestone: "${nextMilestone.name}" due ${nextMilestone.dueDate}`);
  if (overAllocated > 0) bullets.push(`${overAllocated} resource${overAllocated > 1 ? "s are" : " is"} over-allocated on this project`);

  // ── Risks ────────────────────────────────────────────────────────────────
  const risks: string[] = [];
  if (overdueMilestones.length > 0) {
    const names = overdueMilestones.slice(0, 2).map(m => `"${m.name}"`).join(", ");
    risks.push(`${overdueMilestones.length} overdue milestone${overdueMilestones.length > 1 ? "s" : ""} (${names}${overdueMilestones.length > 2 ? ` +${overdueMilestones.length - 2} more` : ""}) threaten the delivery timeline`);
  }
  if (blockedTasks.length > 0) {
    risks.push(`${blockedTasks.length} blocked task${blockedTasks.length > 1 ? "s are" : " is"} preventing team velocity`);
  }
  if (highBurn) {
    risks.push(`Budget burn (${burnPct}%) outpaces task completion (${completionPct}%) by ${burnPct - completionPct} points — resources being consumed faster than work is delivered`);
  }
  if (lowMargin && marginPct !== null) {
    risks.push(`Estimated margin of ${marginPct}% is below the healthy 20% threshold — profitability is at risk`);
  }
  if (openCRs.length > 0) {
    risks.push(`${openCRs.length} unresolved change order${openCRs.length > 1 ? "s" : ""} create billing uncertainty and potential scope disputes`);
  }
  if (overAllocated > 0) {
    risks.push(`Over-allocated resources may cause burnout or quality issues`);
  }
  if (risks.length === 0) {
    risks.push("No significant risks detected — project is progressing to plan");
  }

  // ── Recommended Actions ──────────────────────────────────────────────────
  const recommendedActions: string[] = [];
  if (overdueMilestones.length > 0) {
    recommendedActions.push(`Schedule a recovery session for the ${overdueMilestones.length > 1 ? `${overdueMilestones.length} overdue milestones` : `"${overdueMilestones[0].name}" milestone`} — revise the delivery date or escalate to the client`);
  }
  if (blockedTasks.length > 0) {
    recommendedActions.push(`Assign resolution owners to each of the ${blockedTasks.length} blocked task${blockedTasks.length > 1 ? "s" : ""} and enforce a 48-hour resolution deadline`);
  }
  if (highBurn) {
    recommendedActions.push(`Audit resource allocations and align remaining scope to available budget — consider scope reduction or a change order`);
  }
  if (lowMargin && marginPct !== null) {
    recommendedActions.push(`Review SOW for out-of-scope work delivered and raise change orders to recover margin`);
  }
  if (openCRs.length > 0) {
    recommendedActions.push(`Drive change order approvals before the next billing cycle — ${openCRs.length > 1 ? `${openCRs.length} orders require` : "1 order requires"} a client decision`);
  }
  if (recommendedActions.length === 0) {
    recommendedActions.push("Maintain weekly status updates and keep the client informed of upcoming milestones");
    recommendedActions.push("Proactively review the project closure checklist to ensure a smooth wrap-up");
  }

  res.json({ title, summary, bullets, risks, recommendedActions, generatedAt: new Date().toISOString() });
});

// ── GET /portfolio/ai-summary ─────────────────────────────────────────────────

router.get("/portfolio/ai-summary", async (req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const in90Days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [projects, milestones, invoices, allocations] = await Promise.all([
    db.select().from(projectsTable),
    db.select().from(milestonesTable),
    db.select().from(invoicesTable),
    db.select().from(allocationsTable),
  ]);

  // Compute metrics
  const activeProjects = projects.filter(p => p.status === "active");
  const atRiskProjects = projects.filter(p => p.status === "at_risk" || (p.healthScore !== null && p.healthScore < 65));
  const criticalProjects = projects.filter(p => p.healthScore !== null && p.healthScore < 50);
  const onTrackProjects = activeProjects.filter(p => p.healthScore !== null && p.healthScore >= 80);

  const upcomingGoLives = projects.filter(p => p.goLiveDate && p.goLiveDate >= today && p.goLiveDate <= in90Days);

  const totalBudget = projects.reduce((s, p) => s + parseFloat(p.budgetValue || "0"), 0);
  const totalBilled = projects.reduce((s, p) => s + parseFloat(p.billedValue || "0"), 0);
  const billingRate = totalBudget > 0 ? Math.round((totalBilled / totalBudget) * 100) : 0;
  const revenueAtRisk = atRiskProjects.reduce((s, p) => s + parseFloat(p.budgetValue || "0"), 0);

  const overdueInvoices = invoices.filter(i => i.status === "overdue" || (i.status === "sent" && i.dueDate && i.dueDate < today));
  const overdueInvoiceAmount = overdueInvoices.reduce((s, i) => s + parseFloat(i.amount || "0"), 0);

  const overdueMilestones = milestones.filter(m => m.dueDate && m.dueDate < today && m.status !== "completed" && m.status !== "cancelled");

  const hardAllocations = allocations.filter(a => a.type === "hard");
  const uniqueResources = new Set(hardAllocations.map(a => a.resourceId));
  const totalAllocatedFTE = uniqueResources.size;

  const avgHealth = activeProjects.length > 0
    ? Math.round(activeProjects.filter(p => p.healthScore !== null).reduce((s, p) => s + (p.healthScore ?? 0), 0) / activeProjects.filter(p => p.healthScore !== null).length)
    : 0;

  // ── Title ────────────────────────────────────────────────────────────────
  const title = "Weekly Portfolio Executive Summary";

  // ── Summary paragraph ────────────────────────────────────────────────────
  let summary: string;
  if (atRiskProjects.length === 0) {
    summary = `The delivery portfolio is in strong shape with ${activeProjects.length} active project${activeProjects.length !== 1 ? "s" : ""} and an average health score of ${avgHealth}/100. Total managed budget is ${fmt(totalBudget)}, of which ${fmt(totalBilled)} (${billingRate}%) has been billed. ${upcomingGoLives.length > 0 ? `${upcomingGoLives.length} go-live${upcomingGoLives.length > 1 ? "s are" : " is"} scheduled in the next 90 days.` : "No go-lives are imminent."}`;
  } else {
    summary = `The delivery portfolio has ${activeProjects.length} active project${activeProjects.length !== 1 ? "s" : ""} with an average health score of ${avgHealth}/100. ${atRiskProjects.length} project${atRiskProjects.length > 1 ? "s are" : " is"} classified as at-risk or critical, representing ${fmt(revenueAtRisk)} in revenue under pressure. ${overdueInvoices.length > 0 ? `${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? "s" : ""} totaling ${fmt(overdueInvoiceAmount)} require immediate attention.` : "Invoice health is good."}`;
  }

  // ── Bullets ──────────────────────────────────────────────────────────────
  const bullets: string[] = [];
  bullets.push(`${activeProjects.length} active projects | ${onTrackProjects.length} on track, ${atRiskProjects.length} at risk${criticalProjects.length > 0 ? `, ${criticalProjects.length} critical` : ""}`);
  bullets.push(`Portfolio average health: ${avgHealth}/100`);
  bullets.push(`Total budget under management: ${fmt(totalBudget)}`);
  bullets.push(`Revenue billed to date: ${fmt(totalBilled)} (${billingRate}% billing rate)`);
  if (revenueAtRisk > 0) bullets.push(`Revenue at risk: ${fmt(revenueAtRisk)} across ${atRiskProjects.length} at-risk project${atRiskProjects.length > 1 ? "s" : ""}`);
  bullets.push(`Upcoming go-lives (90d): ${upcomingGoLives.length}${upcomingGoLives.length > 0 ? ` — ${upcomingGoLives.slice(0, 2).map(p => p.name).join(", ")}${upcomingGoLives.length > 2 ? ` +${upcomingGoLives.length - 2} more` : ""}` : ""}`);
  if (overdueInvoices.length > 0) bullets.push(`Overdue invoices: ${overdueInvoices.length} totaling ${fmt(overdueInvoiceAmount)}`);
  if (overdueMilestones.length > 0) bullets.push(`Overdue milestones across portfolio: ${overdueMilestones.length}`);
  bullets.push(`Allocated staff: ${totalAllocatedFTE} FTE on hard allocations`);

  // ── Risks ────────────────────────────────────────────────────────────────
  const risks: string[] = [];
  if (criticalProjects.length > 0) {
    const names = criticalProjects.slice(0, 2).map(p => `"${p.name}"`).join(", ");
    risks.push(`${criticalProjects.length} project${criticalProjects.length > 1 ? "s are" : " is"} in critical condition (${names}${criticalProjects.length > 2 ? ` +${criticalProjects.length - 2} more` : ""}) — require immediate executive attention`);
  }
  if (atRiskProjects.length > 0 && criticalProjects.length < atRiskProjects.length) {
    risks.push(`${atRiskProjects.length - criticalProjects.length} additional project${atRiskProjects.length - criticalProjects.length > 1 ? "s are" : " is"} at risk, carrying ${fmt(revenueAtRisk)} combined budget exposure`);
  }
  if (overdueInvoices.length > 0) {
    risks.push(`${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? "s" : ""} totaling ${fmt(overdueInvoiceAmount)} — aging increases write-off risk`);
  }
  if (overdueMilestones.length > 0) {
    risks.push(`${overdueMilestones.length} overdue milestone${overdueMilestones.length > 1 ? "s" : ""} across the portfolio signal delivery timeline risk`);
  }
  if (upcomingGoLives.length > 2) {
    risks.push(`${upcomingGoLives.length} go-lives concentrated in the next 90 days may strain delivery capacity`);
  }
  if (risks.length === 0) {
    risks.push("No portfolio-level risks detected — all projects are tracking within healthy parameters");
  }

  // ── Recommended Actions ──────────────────────────────────────────────────
  const recommendedActions: string[] = [];
  if (criticalProjects.length > 0) {
    recommendedActions.push(`Convene an emergency review for the ${criticalProjects.length} critical project${criticalProjects.length > 1 ? "s" : ""} — assign executive sponsors and agree on recovery plans this week`);
  }
  if (atRiskProjects.length > 0) {
    recommendedActions.push(`Schedule escalation calls for the ${atRiskProjects.length} at-risk project${atRiskProjects.length > 1 ? "s" : ""} and update risk mitigation plans`);
  }
  if (overdueInvoices.length > 0) {
    recommendedActions.push(`Dispatch the finance team to resolve ${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? "s" : ""} totaling ${fmt(overdueInvoiceAmount)} — prioritise oldest first`);
  }
  if (overdueMilestones.length > 0) {
    recommendedActions.push(`Review and re-baseline the ${overdueMilestones.length} overdue milestone${overdueMilestones.length > 1 ? "s" : ""} — communicate revised dates to clients`);
  }
  if (recommendedActions.length === 0) {
    recommendedActions.push("Maintain weekly portfolio review cadence and proactively track go-live readiness");
    recommendedActions.push("Review resource utilisation to ensure upcoming go-lives are adequately staffed");
  }

  res.json({ title, summary, bullets, risks, recommendedActions, generatedAt: new Date().toISOString() });
});

// ── GET /accounts/:id/ai-summary ─────────────────────────────────────────────

router.get("/accounts/:id/ai-summary", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, id));
  if (!account) { res.status(404).json({ error: "Not found" }); return; }

  const today = new Date().toISOString().split("T")[0];
  const in90Days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const projects = await db.select().from(projectsTable).where(eq(projectsTable.accountId, id));
  const projectIds = projects.map(p => p.id);

  const [allMilestones, invoices, renewalSignals, csatResponses, changeRequests] = await Promise.all([
    projectIds.length > 0 ? db.select().from(milestonesTable).where(inArray(milestonesTable.projectId, projectIds)) : Promise.resolve([]),
    db.select().from(invoicesTable).where(eq(invoicesTable.accountId, id)),
    db.select().from(renewalSignalsTable).where(eq(renewalSignalsTable.accountId, id)),
    db.select().from(formResponsesTable),
    projectIds.length > 0 ? db.select().from(changeRequestsTable).where(inArray(changeRequestsTable.projectId, projectIds)) : Promise.resolve([]),
  ]);

  // Metrics
  const activeProjects = projects.filter(p => p.status === "active");
  const atRiskProjects = projects.filter(p => p.status === "at_risk" || (p.healthScore !== null && p.healthScore < 65));
  const avgProjectHealth = projects.filter(p => p.healthScore !== null).length > 0
    ? Math.round(projects.filter(p => p.healthScore !== null).reduce((s, p) => s + (p.healthScore ?? 0), 0) / projects.filter(p => p.healthScore !== null).length)
    : 0;

  const overdueMilestones = allMilestones.filter(m => m.dueDate && m.dueDate < today && m.status !== "completed" && m.status !== "cancelled");
  const upcomingGoLives = projects.filter(p => p.goLiveDate && p.goLiveDate >= today && p.goLiveDate <= in90Days);

  const overdueInvoices = invoices.filter(i => i.status === "overdue" || (i.status === "sent" && i.dueDate && i.dueDate < today));
  const outstandingAmount = invoices.filter(i => ["sent", "overdue"].includes(i.status)).reduce((s, i) => s + parseFloat(i.amount || "0"), 0);
  const totalBilled = invoices.reduce((s, i) => s + parseFloat(i.amount || "0"), 0);

  const acv = account.annualContractValue ? parseFloat(account.annualContractValue) : 0;
  const healthScore = account.healthScore ?? avgProjectHealth;
  const hl = healthLabel(healthScore);

  const accountCsatScores = csatResponses.filter(r => r.csatScore !== null && projectIds.includes(r.projectId || 0)).map(r => r.csatScore!);
  const csatAvg = accountCsatScores.length > 0 ? Math.round((accountCsatScores.reduce((s, n) => s + n, 0) / accountCsatScores.length) * 10) / 10 : null;

  const openCRs = changeRequests.filter(cr => !["approved", "rejected"].includes(cr.status));

  const pendingRenewals = renewalSignals.filter(r => r.status === "pending" || r.status === "at_risk");
  const renewalEstimatedValue = pendingRenewals.reduce((s, r) => s + (r.estimatedValue ? parseFloat(r.estimatedValue) : 0), 0);

  // ── Title ────────────────────────────────────────────────────────────────
  const title = `Account Health Narrative — ${account.name}`;

  // ── Summary paragraph ────────────────────────────────────────────────────
  let summary: string;
  if (healthScore >= 80) {
    summary = `${account.name} is a ${hl} account with a composite health score of ${healthScore}/100 and ${activeProjects.length} active project${activeProjects.length !== 1 ? "s" : ""}. Average project health is ${avgProjectHealth}/100${csatAvg ? ` and client satisfaction is rated ${csatAvg}/5.0` : ""}. The account has ${fmt(acv)} in annual contract value with ${fmt(outstandingAmount)} currently outstanding.`;
  } else if (healthScore >= 65) {
    const topRisk = atRiskProjects.length > 0 ? `${atRiskProjects.length} at-risk project${atRiskProjects.length > 1 ? "s" : ""}` : overdueMilestones.length > 0 ? `${overdueMilestones.length} overdue milestone${overdueMilestones.length > 1 ? "s" : ""}` : `outstanding invoices of ${fmt(outstandingAmount)}`;
    summary = `${account.name} is ${hl} with a composite health score of ${healthScore}/100, primarily driven by ${topRisk}. The account spans ${projects.length} project${projects.length !== 1 ? "s" : ""}${activeProjects.length !== projects.length ? `, of which ${activeProjects.length} are active` : ""}. Corrective action is recommended to prevent account health deterioration.`;
  } else {
    summary = `${account.name} is in critical health with a score of ${healthScore}/100. The account requires urgent attention — ${atRiskProjects.length > 0 ? `${atRiskProjects.length} project${atRiskProjects.length > 1 ? "s are" : " is"} at risk, ` : ""}${overdueMilestones.length > 0 ? `${overdueMilestones.length} milestone${overdueMilestones.length > 1 ? "s are" : " is"} overdue, ` : ""}${overdueInvoices.length > 0 ? `and ${overdueInvoices.length} invoice${overdueInvoices.length > 1 ? "s are" : " is"} overdue` : ""}. Executive engagement with the client is strongly advised.`;
  }

  // ── Bullets ──────────────────────────────────────────────────────────────
  const bullets: string[] = [];
  bullets.push(`Account health score: ${healthScore}/100 — ${hl}`);
  bullets.push(`${projects.length} project${projects.length !== 1 ? "s" : ""} total: ${activeProjects.length} active, ${atRiskProjects.length} at risk`);
  bullets.push(`Average project health: ${avgProjectHealth}/100`);
  if (csatAvg !== null) bullets.push(`Client satisfaction (CSAT): ${csatAvg}/5.0`);
  bullets.push(`Annual contract value: ${fmt(acv)}`);
  bullets.push(`Total billed: ${fmt(totalBilled)} | Outstanding: ${fmt(outstandingAmount)}`);
  if (overdueInvoices.length > 0) bullets.push(`Overdue invoices: ${overdueInvoices.length} requiring escalation`);
  if (overdueMilestones.length > 0) bullets.push(`Overdue milestones across active projects: ${overdueMilestones.length}`);
  if (openCRs.length > 0) bullets.push(`Open change orders: ${openCRs.length} pending approval`);
  if (upcomingGoLives.length > 0) bullets.push(`Upcoming go-lives (90d): ${upcomingGoLives.map(p => p.name).join(", ")}`);
  if (pendingRenewals.length > 0) bullets.push(`Renewal pipeline: ${pendingRenewals.length} signal${pendingRenewals.length > 1 ? "s" : ""} (${fmt(renewalEstimatedValue)} estimated)`);
  if (account.renewalDate) bullets.push(`Account renewal date: ${account.renewalDate}`);

  // ── Risks ────────────────────────────────────────────────────────────────
  const risks: string[] = [];
  if (atRiskProjects.length > 0) {
    const names = atRiskProjects.slice(0, 2).map(p => `"${p.name}"`).join(", ");
    risks.push(`${atRiskProjects.length} at-risk project${atRiskProjects.length > 1 ? "s" : ""} (${names}${atRiskProjects.length > 2 ? ` +${atRiskProjects.length - 2} more` : ""}) threaten account health and renewal confidence`);
  }
  if (overdueInvoices.length > 0) {
    risks.push(`${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? "s" : ""} — unpaid amounts risk souring the client relationship`);
  }
  if (overdueMilestones.length > 0) {
    risks.push(`${overdueMilestones.length} overdue milestone${overdueMilestones.length > 1 ? "s" : ""} across active projects — delivery credibility is at risk`);
  }
  if (csatAvg !== null && csatAvg < 3.5) {
    risks.push(`Low CSAT score of ${csatAvg}/5.0 — client satisfaction is below the acceptable threshold and threatens renewal`);
  }
  if (pendingRenewals.some(r => r.status === "at_risk")) {
    const atRiskRenewalValue = pendingRenewals.filter(r => r.status === "at_risk").reduce((s, r) => s + (r.estimatedValue ? parseFloat(r.estimatedValue) : 0), 0);
    risks.push(`Renewal signals marked at-risk with ${fmt(atRiskRenewalValue)} in potential contract value at stake`);
  }
  if (risks.length === 0) {
    risks.push("No significant account risks detected — health indicators are within healthy parameters");
  }

  // ── Recommended Actions ──────────────────────────────────────────────────
  const recommendedActions: string[] = [];
  if (atRiskProjects.length > 0) {
    recommendedActions.push(`Schedule a joint review with the client covering the ${atRiskProjects.length} at-risk project${atRiskProjects.length > 1 ? "s" : ""} — agree on recovery milestones and revised timelines`);
  }
  if (overdueInvoices.length > 0) {
    recommendedActions.push(`Escalate ${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? "s" : ""} to the account owner and client billing contact — aim to resolve within 5 business days`);
  }
  if (overdueMilestones.length > 0) {
    recommendedActions.push(`Re-baseline overdue milestones and communicate revised delivery dates to the client proactively`);
  }
  if (pendingRenewals.length > 0 && account.renewalDate) {
    recommendedActions.push(`Initiate renewal conversation with the client — ${fmt(renewalEstimatedValue)} in contract value is in play`);
  }
  if (openCRs.length > 0) {
    recommendedActions.push(`Close out ${openCRs.length} pending change order${openCRs.length > 1 ? "s" : ""} to clear billing blockers and formalise scope`);
  }
  if (recommendedActions.length === 0) {
    recommendedActions.push("Conduct a QBR with the client to reinforce the relationship and surface any emerging concerns");
    recommendedActions.push("Review the account's renewal readiness and proactively engage on expansion opportunities");
  }

  res.json({ title, summary, bullets, risks, recommendedActions, generatedAt: new Date().toISOString() });
});

export default router;
