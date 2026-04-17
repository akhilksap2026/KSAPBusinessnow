import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, resourcesTable, allocationsTable, timesheetsTable, staffingRequestsTable } from "@workspace/db";

const COST_RATE_ROLES = ["delivery_director", "finance_lead", "admin", "finance"];

function canSeeCostRate(req: any): boolean {
  const role = (req.headers["x-user-role"] as string) || "";
  return COST_RATE_ROLES.includes(role);
}

function parseResource(r: typeof resourcesTable.$inferSelect) {
  return {
    ...r,
    hourlyRate: r.hourlyRate ? parseFloat(r.hourlyRate) : null,
    costRate: r.costRate ? parseFloat(r.costRate) : null,
    skills: r.skills ?? [],
    certifications: r.certifications ?? [],
    specialties: r.specialties ?? [],
  };
}

function parseAllocation(a: typeof allocationsTable.$inferSelect) {
  return { ...a, hoursPerWeek: a.hoursPerWeek ? parseFloat(a.hoursPerWeek) : null };
}

function getWeeks(startOffset: number, count: number): string[] {
  const weeks: string[] = [];
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  for (let i = startOffset; i < startOffset + count; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i * 7);
    weeks.push(d.toISOString().split("T")[0]);
  }
  return weeks;
}

function weekOverlap(weekStart: string, alloc: any): number {
  if (!alloc.startDate && !alloc.endDate) return alloc.allocationPct;
  const ws = new Date(weekStart);
  const we = new Date(ws); we.setDate(ws.getDate() + 6);
  const as = alloc.startDate ? new Date(alloc.startDate) : new Date("2000-01-01");
  const ae = alloc.endDate ? new Date(alloc.endDate) : new Date("2099-12-31");
  if (ae < ws || as > we) return 0;
  return alloc.allocationPct;
}

const router: IRouter = Router();

// ── List & create — MUST be before /:id ─────────────────────────────────────
router.get("/resources", async (req, res): Promise<void> => {
  const { practiceArea, status, skill, employmentType } = req.query as Record<string, string>;
  let resources = await db.select().from(resourcesTable).orderBy(resourcesTable.name);
  if (practiceArea) resources = resources.filter(r => r.practiceArea === practiceArea);
  if (status) resources = resources.filter(r => r.status === status);
  if (skill) resources = resources.filter(r => r.skills?.includes(skill));
  if (employmentType) resources = resources.filter(r => r.employmentType === employmentType);
  const showCost = canSeeCostRate(req);
  res.json(resources.map(r => {
    const parsed = parseResource(r);
    if (!showCost) parsed.costRate = null;
    return parsed;
  }));
});

router.post("/resources", async (req, res): Promise<void> => {
  const { name, practiceArea, ...rest } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const [resource] = await db.insert(resourcesTable).values({ name, practiceArea: practiceArea || "implementation", ...rest }).returning();
  res.status(201).json(parseResource(resource));
});

// ── Named sub-routes — MUST be before /resources/:id ─────────────────────────

function getMonths(startOffset: number, count: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = startOffset; i < startOffset + count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(d.toISOString().split("T")[0]);
  }
  return months;
}

function monthOverlap(monthStart: string, alloc: any): number {
  const ms = new Date(monthStart);
  const me = new Date(ms.getFullYear(), ms.getMonth() + 1, 0);
  const as = alloc.startDate ? new Date(alloc.startDate) : new Date("2000-01-01");
  const ae = alloc.endDate ? new Date(alloc.endDate) : new Date("2099-12-31");
  if (ae < ms || as > me) return 0;
  return alloc.allocationPct;
}

// Utilization heatmap — all resources × N weeks or months
router.get("/resources/utilization", async (req, res): Promise<void> => {
  const weeks = parseInt((req.query.weeks as string) || "12");
  const granularity = (req.query.granularity as string) || "week";
  const allResources = await db.select().from(resourcesTable).orderBy(resourcesTable.name);
  const allAllocations = await db.select().from(allocationsTable);

  const periods = granularity === "month"
    ? getMonths(-1, Math.ceil(weeks / 4) + 1).slice(0, Math.ceil(weeks / 4))
    : getWeeks(-2, weeks + 2).slice(0, weeks);

  const overlapFn = granularity === "month" ? monthOverlap : weekOverlap;

  const heatmap = allResources.map(r => {
    const resAllocs = allAllocations.filter(a => a.resourceId === r.id && a.allocationType !== "soft");
    const softAllocs = allAllocations.filter(a => a.resourceId === r.id && a.allocationType === "soft");

    const weeks_data = periods.map(p => {
      const hard = resAllocs.reduce((sum, a) => sum + overlapFn(p, a), 0);
      const soft = softAllocs.reduce((sum, a) => sum + overlapFn(p, a), 0);

      // Project breakdown per period
      const projMap: Record<number, { projectId: number; projectName: string; hard: number; soft: number }> = {};
      [...resAllocs, ...softAllocs].forEach(a => {
        const pct = overlapFn(p, a);
        if (pct === 0) return;
        const pid = a.projectId;
        if (!projMap[pid]) projMap[pid] = { projectId: pid, projectName: a.projectName || `Project ${pid}`, hard: 0, soft: 0 };
        if (a.allocationType === "soft") projMap[pid].soft += pct;
        else projMap[pid].hard += pct;
      });

      const target = r.utilizationTarget || 80;
      let band: string;
      if (hard === 0 && soft === 0) band = "bench";
      else if (hard < 20) band = "bench";
      else if (hard <= target - 10) band = "available";
      else if (hard <= target + 15) band = "optimal";
      else if (hard <= 110) band = "booked";
      else band = "overbooked";
      return { week: p, hard, soft, total: hard + soft, band, projectBreakdown: Object.values(projMap) };
    });

    return {
      resource: parseResource(r),
      weeks: weeks_data,
      avgUtilization: Math.round(weeks_data.reduce((s, w) => s + w.hard, 0) / weeks_data.length),
    };
  });

  res.json({ weeks: periods, resources: heatmap });
});

// Capacity forecast by role/service line
router.get("/resources/capacity", async (req, res): Promise<void> => {
  const windowWeeks = parseInt((req.query.weeks as string) || "12");
  const allResources = await db.select().from(resourcesTable).orderBy(resourcesTable.practiceArea);
  const allAllocations = await db.select().from(allocationsTable);
  const allRequests = await db.select().from(staffingRequestsTable);

  const weekDates = getWeeks(0, windowWeeks);

  const byPractice: Record<string, typeof allResources> = {};
  allResources.forEach(r => {
    const key = r.practiceArea;
    if (!byPractice[key]) byPractice[key] = [];
    byPractice[key].push(r);
  });

  const forecast = Object.entries(byPractice).map(([practiceArea, resources]) => {
    const weeklyForecast = weekDates.map(w => {
      const totalCapacity = resources.length * 40;
      const hardDemand = allAllocations
        .filter(a => a.allocationType !== "soft" && resources.some(r => r.id === a.resourceId))
        .reduce((sum, a) => sum + (weekOverlap(w, a) / 100) * 40, 0);
      const softDemand = allAllocations
        .filter(a => a.allocationType === "soft" && resources.some(r => r.id === a.resourceId))
        .reduce((sum, a) => sum + (weekOverlap(w, a) / 100) * 40, 0);
      const openRequests = allRequests
        .filter(r => r.status === "open" && r.requestedRole.toLowerCase().includes(practiceArea.split("_")[0]))
        .reduce((sum, r) => sum + (r.hoursPerWeek || 0), 0);
      const available = Math.max(0, totalCapacity - hardDemand);
      return { week: w, totalCapacity, hardDemand, softDemand, openRequests, available };
    });

    return {
      practiceArea,
      resourceCount: resources.length,
      resources: resources.map(parseResource),
      weeklyForecast,
      avgAvailability: Math.round(weeklyForecast.reduce((s, w) => s + w.available, 0) / weeklyForecast.length),
    };
  });

  res.json({ weeks: weekDates, forecast });
});

// ── Single resource by ID ─────────────────────────────────────────────────────
router.get("/resources/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [resource] = await db.select().from(resourcesTable).where(eq(resourcesTable.id, id));
  if (!resource) { res.status(404).json({ error: "Not found" }); return; }
  const parsed = parseResource(resource);
  if (!canSeeCostRate(req)) parsed.costRate = null;
  res.json(parsed);
});

// Full resource profile
router.get("/resources/:id/full", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [resource] = await db.select().from(resourcesTable).where(eq(resourcesTable.id, id));
  if (!resource) { res.status(404).json({ error: "Not found" }); return; }

  const [allocations, timesheets, staffingReqs] = await Promise.all([
    db.select().from(allocationsTable).where(eq(allocationsTable.resourceId, id)),
    db.select().from(timesheetsTable).where(eq(timesheetsTable.resourceId, id)),
    db.select().from(staffingRequestsTable).where(eq(staffingRequestsTable.fulfilledByResourceId, id)),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const activeAllocations = allocations.filter(a => (!a.endDate || a.endDate >= today) && a.allocationType !== "soft");
  const softAllocations = allocations.filter(a => a.allocationType === "soft" && (!a.endDate || a.endDate >= today));
  const pastAllocations = allocations.filter(a => a.endDate && a.endDate < today);

  const currentUtil = activeAllocations.reduce((sum, a) => sum + a.allocationPct, 0);

  const recentTimesheets = timesheets
    .sort((a, b) => (a.weekStart > b.weekStart ? -1 : 1))
    .slice(0, 8)
    .reverse();

  const weekDates = getWeeks(0, 12);
  const weeklyLoad = weekDates.map(w => {
    const load = allocations
      .filter(a => a.allocationType !== "soft")
      .reduce((sum, a) => sum + weekOverlap(w, a), 0);
    const softLoad = allocations
      .filter(a => a.allocationType === "soft")
      .reduce((sum, a) => sum + weekOverlap(w, a), 0);
    return { week: w, load, softLoad, available: Math.max(0, (resource.utilizationTarget || 80) - load) };
  });

  const parsed = parseResource(resource);
  if (!canSeeCostRate(req)) parsed.costRate = null;

  res.json({
    resource: parsed,
    allocations: allocations.map(parseAllocation),
    activeAllocations: activeAllocations.map(parseAllocation),
    softAllocations: softAllocations.map(parseAllocation),
    pastAllocations: pastAllocations.map(parseAllocation),
    staffingRequests: staffingReqs,
    utilizationTrend: recentTimesheets.map(t => ({
      week: t.weekStart,
      hours: parseFloat(t.hoursLogged || "0"),
      billable: parseFloat(t.billableHours || "0"),
    })),
    weeklyLoad,
    currentUtilization: Math.min(currentUtil, 200),
  });
});

// Workload check for assignment
router.get("/resources/:id/workload-check", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { startDate, endDate, pct } = req.query as Record<string, string>;
  const requestedPct = parseInt(pct || "100");

  const [resource] = await db.select().from(resourcesTable).where(eq(resourcesTable.id, id));
  if (!resource) { res.status(404).json({ error: "Not found" }); return; }

  const allocations = await db.select().from(allocationsTable).where(eq(allocationsTable.resourceId, id));
  const activeAllocs = allocations.filter(a => {
    if (a.allocationType === "soft") return false;
    if (!startDate && !endDate) return true;
    const as = a.startDate || "2000-01-01";
    const ae = a.endDate || "2099-12-31";
    const rs = startDate || "2000-01-01";
    const re = endDate || "2099-12-31";
    return as <= re && ae >= rs;
  });

  const currentLoad = activeAllocs.reduce((s, a) => s + a.allocationPct, 0);
  const projectedLoad = currentLoad + requestedPct;
  const target = resource.utilizationTarget || 80;
  const available = Math.max(0, target - currentLoad);
  const canFulfill = projectedLoad <= 110;
  const warnings: string[] = [];
  if (projectedLoad > 100) warnings.push(`Would be ${projectedLoad}% allocated — over 100%`);
  if (projectedLoad > 80 && projectedLoad <= 100) warnings.push(`Near capacity at ${projectedLoad}%`);
  if (resource.status === "on_leave") warnings.push("Resource is currently on leave");

  const margin = resource.hourlyRate && resource.costRate
    ? ((parseFloat(resource.hourlyRate) - parseFloat(resource.costRate)) / parseFloat(resource.hourlyRate)) * 100
    : null;

  res.json({
    resource: parseResource(resource),
    currentLoad, requestedPct, projectedLoad, available,
    canFulfill, overAllocated: projectedLoad > 100, warnings,
    margin: margin ? Math.round(margin) : null,
    activeAllocations: activeAllocs.map(parseAllocation),
  });
});

// ── Staffing requests list (open) ────────────────────────────────────────────
router.get("/staffing-requests", async (req, res): Promise<void> => {
  const { status } = req.query as Record<string, string>;
  let reqs = await db.select().from(staffingRequestsTable);
  if (status) reqs = reqs.filter(r => r.status === status);
  res.json(reqs);
});

router.put("/resources/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { id: _id, createdAt, ...updates } = req.body;
  const [resource] = await db.update(resourcesTable).set(updates).where(eq(resourcesTable.id, id)).returning();
  if (!resource) { res.status(404).json({ error: "Not found" }); return; }
  res.json(parseResource(resource));
});

export default router;
