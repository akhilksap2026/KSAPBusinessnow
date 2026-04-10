import { Router, type IRouter } from "express";
import { db, opportunitiesTable, projectsTable, proposalsTable, opportunityActivityTable, allocationsTable, resourcesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

function parseOpp(o: typeof opportunitiesTable.$inferSelect) {
  return {
    ...o,
    value: o.value ? parseFloat(o.value) : null,
  };
}

const router: IRouter = Router();

router.get("/opportunities", async (req, res): Promise<void> => {
  const { stage, accountId, ownerId } = req.query as Record<string, string>;
  let opps = await db.select().from(opportunitiesTable).orderBy(opportunitiesTable.expectedCloseDate);
  if (stage) opps = opps.filter((o) => o.stage === stage);
  if (accountId) opps = opps.filter((o) => o.accountId === parseInt(accountId));
  if (ownerId) opps = opps.filter((o) => o.ownerId === parseInt(ownerId));
  res.json(opps.map(parseOpp));
});

router.get("/opportunities/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [opp] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id));
  if (!opp) { res.status(404).json({ error: "Not found" }); return; }

  const proposals = await db.select().from(proposalsTable).where(eq(proposalsTable.opportunityId, id));
  const activity = await db.select().from(opportunityActivityTable).where(eq(opportunityActivityTable.opportunityId, id));

  res.json({
    ...parseOpp(opp),
    proposals: proposals.map((p) => ({ ...p, totalValue: p.totalValue ? parseFloat(p.totalValue) : null })),
    activity: activity.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  });
});

router.post("/opportunities", async (req, res): Promise<void> => {
  const { name, accountId, accountName, type, value, probability, expectedStartDate, expectedCloseDate, ownerId, ownerName, ...rest } = req.body;
  if (!name || !accountId) { res.status(400).json({ error: "name and accountId required" }); return; }
  const [opp] = await db.insert(opportunitiesTable).values({
    name, accountId, accountName, type: type || "implementation", value, probability, expectedStartDate, expectedCloseDate, ownerId, ownerName, stage: "lead", ...rest,
  }).returning();
  res.status(201).json(parseOpp(opp));
});

router.put("/opportunities/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { id: _id, createdAt, updatedAt, ...updates } = req.body;
  const [opp] = await db.update(opportunitiesTable).set({ ...updates, updatedAt: new Date() }).where(eq(opportunitiesTable.id, id)).returning();
  if (!opp) { res.status(404).json({ error: "Not found" }); return; }
  res.json(parseOpp(opp));
});

// Go/No-Go update
router.put("/opportunities/:id/gonogo", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { goNoGoStatus, goNoGoRationale, marginFeasibility, capacityFeasibility, deliveryReadiness } = req.body;

  const [opp] = await db.update(opportunitiesTable).set({
    goNoGoStatus, goNoGoRationale, marginFeasibility, capacityFeasibility, deliveryReadiness, updatedAt: new Date(),
  }).where(eq(opportunitiesTable.id, id)).returning();

  await db.insert(opportunityActivityTable).values({
    opportunityId: id,
    activityType: "go_nogo_decision",
    title: `Go/No-Go Decision: ${goNoGoStatus}`,
    body: goNoGoRationale || "",
    authorName: req.body.decidedBy || "System",
  });

  res.json(parseOpp(opp));
});

// Tentative project trigger
router.post("/opportunities/:id/trigger-tentative", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [opp] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id));
  if (!opp) { res.status(404).json({ error: "Not found" }); return; }
  if (opp.tentativeProjectTriggered) { res.status(409).json({ error: "Tentative project already triggered" }); return; }

  const [proj] = await db.insert(projectsTable).values({
    name: `[TENTATIVE] ${opp.name}`,
    accountId: opp.accountId,
    accountName: opp.accountName,
    type: opp.type as any,
    status: "pending",
    startDate: opp.expectedStartDate,
    budgetValue: opp.value ? String(opp.value) : null,
    healthScore: 75,
    description: `Tentative project shell created from opportunity #${id}. ${opp.scopeSummary || ""}`,
  }).returning();

  await db.update(opportunitiesTable).set({
    tentativeProjectId: proj.id, tentativeProjectTriggered: true, updatedAt: new Date(),
  }).where(eq(opportunitiesTable.id, id));

  await db.insert(opportunityActivityTable).values({
    opportunityId: id, activityType: "general_note",
    title: "Tentative project shell created",
    body: `Project #${proj.id} created as tentative shell. Resource Manager should review staffing requirements.`,
    authorName: "System",
  });

  res.status(201).json({ project: proj, message: "Tentative project shell created" });
});

// Convert won opportunity → new project (inline quick-convert modal)
router.post("/opportunities/:id/convert-to-project", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [opp] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id));
  if (!opp) { res.status(404).json({ error: "Not found" }); return; }
  if (opp.handoffProjectId) { res.status(409).json({ error: "Already converted", projectId: opp.handoffProjectId }); return; }

  const {
    name, pmId, pmName, startDate, endDate, type, budgetHours, budgetValue, description,
  } = req.body as Record<string, any>;

  if (!name) { res.status(400).json({ error: "name required" }); return; }

  const [project] = await db.insert(projectsTable).values({
    name,
    accountId: opp.accountId,
    accountName: opp.accountName ?? undefined,
    type: type || opp.type || "implementation",
    status: "active",
    pmId: pmId ? parseInt(pmId) : undefined,
    pmName: pmName || undefined,
    startDate: startDate || opp.expectedStartDate || undefined,
    endDate: endDate || undefined,
    goLiveDate: endDate || undefined,
    budgetHours: budgetHours ? String(budgetHours) : undefined,
    budgetValue: budgetValue ? String(budgetValue) : (opp.value ? String(opp.value) : undefined),
    description: description || opp.scopeSummary || undefined,
    completionPct: 0,
    healthScore: 80,
  }).returning();

  await db.update(opportunitiesTable).set({
    handoffProjectId: project.id,
    handoffCompletedAt: new Date(),
    stage: "won",
    updatedAt: new Date(),
  }).where(eq(opportunitiesTable.id, id));

  await db.insert(opportunityActivityTable).values({
    opportunityId: id,
    activityType: "client_commitment",
    title: `Project created from won deal: ${project.name}`,
    body: `Project #${project.id} created via quick-convert from won opportunity. PM: ${pmName || "TBD"}.`,
    authorName: req.body.createdBy || "System",
  });

  res.status(201).json({ project });
});

// Link an existing project to a won opportunity
router.post("/opportunities/:id/link-project", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { projectId } = req.body as { projectId: number };
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  const [opp] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id));
  if (!opp) { res.status(404).json({ error: "Not found" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  await db.update(opportunitiesTable).set({
    handoffProjectId: projectId,
    handoffCompletedAt: new Date(),
    stage: "won",
    updatedAt: new Date(),
  }).where(eq(opportunitiesTable.id, id));

  await db.insert(opportunityActivityTable).values({
    opportunityId: id,
    activityType: "client_commitment",
    title: `Linked to existing project: ${project.name}`,
    body: `Opportunity manually linked to project #${projectId}.`,
    authorName: req.body.linkedBy || "System",
  });

  res.json({ project });
});

// ─── Staffing Gap Predictor ──────────────────────────────────────────────────

const TYPE_DEFAULT_ROLES: Record<string, string[]> = {
  implementation:       ["OTM Consultant", "Project Manager", "Integration Specialist"],
  cloud_migration:      ["Cloud Architect", "OTM Consultant", "DevOps Engineer"],
  ams:                  ["AMS Consultant", "Support Analyst"],
  certification:        ["OTM Consultant"],
  rate_maintenance:     ["Rate Analyst"],
  custom_development:   ["OTM Developer", "QA Engineer"],
  data_services:        ["Data Analyst", "OTM Consultant"],
};

function roleMatchesResource(role: string, r: typeof resourcesTable.$inferSelect): boolean {
  const words = role.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (words.length === 0) return false;
  const haystack = [
    r.title?.toLowerCase() ?? "",
    (r.practiceArea ?? "").toLowerCase().replace(/_/g, " "),
    ...(r.skills ?? []).map(s => s.toLowerCase()),
    ...(r.specialties ?? []).map(s => s.toLowerCase()),
  ].join(" ");
  return words.some(w => haystack.includes(w));
}

function resourceIsFree(
  r: typeof resourcesTable.$inferSelect,
  allocs: typeof allocationsTable.$inferSelect[],
  windowStart: string,
  windowEnd: string,
): boolean {
  const utilTarget = r.utilizationTarget ?? 80;
  if (r.currentUtilization >= utilTarget) return false;
  const heavyInWindow = allocs
    .filter(a => a.resourceId === r.id)
    .some(a => {
      if (!a.startDate || !a.endDate) return false;
      return a.startDate <= windowEnd && a.endDate >= windowStart && a.allocationPct >= 80;
    });
  return !heavyInWindow;
}

function calcRisk(missing: number, total: number, complexity: string): "none" | "low" | "medium" | "high" {
  if (missing === 0) return "none";
  const ratio = missing / total;
  let level: "low" | "medium" | "high" = ratio <= 0.34 ? "low" : ratio <= 0.67 ? "medium" : "high";
  if ((complexity === "high" || complexity === "very_high") && level === "low") level = "medium";
  if (complexity === "very_high" && level === "medium") level = "high";
  return level;
}

function addWeeksToDate(dateStr: string, weeks: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split("T")[0];
}

router.get("/opportunities/:id/staffing-gap", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [opp] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id));
  if (!opp) { res.status(404).json({ error: "Not found" }); return; }

  const [resources, allocations] = await Promise.all([
    db.select().from(resourcesTable),
    db.select().from(allocationsTable),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const durationWeeks = opp.expectedDurationWeeks ?? 10;
  const windowStart = today;
  const windowEnd = addWeeksToDate(today, durationWeeks + 4);

  const futureAllocs = allocations.filter(a => !a.endDate || a.endDate >= today);

  const requiredRoles: string[] =
    (opp.requiredRoles && opp.requiredRoles.length > 0)
      ? opp.requiredRoles
      : (TYPE_DEFAULT_ROLES[opp.type] ?? ["OTM Consultant"]);

  const missingRoles: string[] = [];
  for (const role of requiredRoles) {
    const matched = resources.filter(r => roleMatchesResource(role, r));
    const available = matched.filter(r => resourceIsFree(r, futureAllocs, windowStart, windowEnd));
    if (available.length === 0) missingRoles.push(role);
  }

  const complexity = opp.deliveryComplexity ?? "medium";
  const risk = calcRisk(missingRoles.length, requiredRoles.length, complexity);

  let message: string;
  if (risk === "none") {
    message = `All ${requiredRoles.length} required role${requiredRoles.length !== 1 ? "s" : ""} have available resources for this ${durationWeeks}-week engagement.`;
  } else if (risk === "low") {
    message = `Minor staffing gap: limited availability for ${missingRoles.join(", ")}. Current bench may free up before the ${durationWeeks}-week project kicks off.`;
  } else if (risk === "medium") {
    message = `Staffing shortfall for ${missingRoles.join(", ")}. Available capacity is constrained in the forecast window — consider partner or contractor sourcing.`;
  } else {
    message = `Critical gap: no available resources found for ${missingRoles.join(", ")}. Immediate sourcing action required before this opportunity can be committed.`;
  }

  res.json({ risk, missingRoles, message, requiredRoles, durationWeeks });
});

// Activity log for an opportunity
router.get("/opportunities/:id/activity", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const activity = await db.select().from(opportunityActivityTable).where(eq(opportunityActivityTable.opportunityId, id));
  res.json(activity.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
});

router.post("/opportunities/:id/activity", async (req, res): Promise<void> => {
  const opportunityId = parseInt(req.params.id);
  const { activityType, title, body, authorName, authorId } = req.body;
  if (!title) { res.status(400).json({ error: "title required" }); return; }
  const [entry] = await db.insert(opportunityActivityTable).values({
    opportunityId, activityType: activityType || "general_note", title, body, authorName, authorId,
  }).returning();
  res.status(201).json(entry);
});

export default router;
