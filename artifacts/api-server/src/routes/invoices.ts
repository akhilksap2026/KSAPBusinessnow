import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db, invoicesTable, timesheetsTable, tasksTable, rateCardsTable, resourcesTable } from "@workspace/db";
import {
  CreateInvoiceBody,
  UpdateInvoiceBody,
  GetInvoiceParams,
  UpdateInvoiceParams,
  ListInvoicesQueryParams,
} from "@workspace/api-zod";
import { z } from "zod/v4";

export interface TMLineItem {
  description: string;
  resource: string;
  task: string;
  serviceDate: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

function parseInvoice(i: typeof invoicesTable.$inferSelect) {
  return {
    ...i,
    amount: parseFloat(i.amount),
  };
}

async function generateTMLines(
  projectId: number,
  accountId: number,
  periodStart: string,
  periodEnd: string,
): Promise<TMLineItem[]> {
  const allTimesheets = await db
    .select()
    .from(timesheetsTable)
    .where(
      and(
        eq(timesheetsTable.projectId, projectId),
        eq(timesheetsTable.isBillable, true),
        eq(timesheetsTable.status, "approved"),
      ),
    )
    .orderBy(timesheetsTable.resourceName);

  const timesheets = allTimesheets.filter((te) => {
    const effectiveDate = te.entryDate ?? te.weekStart;
    if (!effectiveDate) return true;
    return effectiveDate >= periodStart && effectiveDate <= periodEnd;
  });

  if (timesheets.length === 0) return [];

  const taskIds = [...new Set(timesheets.filter((t) => t.taskId).map((t) => t.taskId!))];
  const resourceIds = [...new Set(timesheets.filter((t) => t.resourceId).map((t) => t.resourceId))];

  const [tasks, resources, rateCards] = await Promise.all([
    taskIds.length
      ? db
          .select({ id: tasksTable.id, name: tasksTable.name })
          .from(tasksTable)
          .then((rows) => rows.filter((r) => taskIds.includes(r.id)))
      : Promise.resolve([] as { id: number; name: string }[]),
    resourceIds.length
      ? db
          .select({ id: resourcesTable.id, defaultRole: resourcesTable.defaultRole, practiceArea: resourcesTable.practiceArea })
          .from(resourcesTable)
          .then((rows) => rows.filter((r) => resourceIds.includes(r.id)))
      : Promise.resolve([] as { id: number; defaultRole: string | null; practiceArea: string }[]),
    db
      .select()
      .from(rateCardsTable)
      .then((rows) =>
        rows.filter((rc) => rc.projectId === projectId || rc.accountId === accountId || rc.isTemplate),
      ),
  ]);

  const taskMap = new Map(tasks.map((t) => [t.id, t.name]));
  const resourceMap = new Map(resources.map((r) => [r.id, r]));

  function findSellRate(resourceId: number, resourceName: string): number {
    const resource = resourceId ? resourceMap.get(resourceId) : null;
    const projectRates = rateCards.filter((rc) => rc.projectId === projectId);
    const accountRates = rateCards.filter((rc) => rc.accountId === accountId && !rc.projectId);
    const templateRates = rateCards.filter((rc) => rc.isTemplate);

    const pools = [projectRates, accountRates, templateRates];

    for (const pool of pools) {
      if (pool.length === 0) continue;
      if (resource?.defaultRole) {
        const match = pool.find(
          (rc) =>
            rc.role.toLowerCase().includes(resource.defaultRole!.toLowerCase()) ||
            resource.defaultRole!.toLowerCase().includes(rc.role.toLowerCase()),
        );
        if (match) return parseFloat(match.sellRate ?? match.billingRate);
      }
      if (resource?.practiceArea) {
        const match = pool.find(
          (rc) =>
            rc.practiceArea &&
            (rc.practiceArea.toLowerCase().includes(resource.practiceArea.toLowerCase()) ||
              resource.practiceArea.toLowerCase().includes(rc.practiceArea.toLowerCase())),
        );
        if (match) return parseFloat(match.sellRate ?? match.billingRate);
      }
      if (pool.length > 0) {
        return parseFloat(pool[0].sellRate ?? pool[0].billingRate);
      }
    }
    return 0;
  }

  return timesheets.map((te) => {
    const taskName = te.taskId ? (taskMap.get(te.taskId) ?? "General") : "General";
    const resourceName = te.resourceName ?? "Unknown";
    const dailyComment = te.dailyComment?.trim();
    const description = dailyComment
      ? `${resourceName} — ${taskName} — ${dailyComment}`
      : `${resourceName} — ${taskName}`;
    const hours = parseFloat(te.hoursLogged ?? "0");
    const unitPrice = findSellRate(te.resourceId, resourceName);
    return {
      description,
      resource: resourceName,
      task: taskName,
      serviceDate: te.entryDate ?? te.weekStart,
      quantity: hours,
      unitPrice,
      amount: parseFloat((hours * unitPrice).toFixed(2)),
    };
  });
}

const router: IRouter = Router();

router.get("/invoices", async (req, res): Promise<void> => {
  const query = ListInvoicesQueryParams.safeParse(req.query);
  let invoices = await db.select().from(invoicesTable).orderBy(invoicesTable.issueDate);
  if (query.success) {
    if (query.data.projectId) invoices = invoices.filter((i) => i.projectId === query.data.projectId);
    if (query.data.accountId) invoices = invoices.filter((i) => i.accountId === query.data.accountId);
    if (query.data.status) invoices = invoices.filter((i) => i.status === query.data.status);
  }
  res.json(invoices.map(parseInvoice));
});

router.post("/invoices", async (req, res): Promise<void> => {
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const count = await db.select().from(invoicesTable);
  const invoiceNumber = `INV-${String(count.length + 1).padStart(4, "0")}`;
  const [invoice] = await db.insert(invoicesTable).values({ ...parsed.data, invoiceNumber }).returning();
  res.status(201).json(parseInvoice(invoice));
});

router.get("/invoices/:id", async (req, res): Promise<void> => {
  const params = GetInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, params.data.id));
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  res.json(parseInvoice(invoice));
});

router.put("/invoices/:id", async (req, res): Promise<void> => {
  const params = UpdateInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [invoice] = await db.update(invoicesTable).set(parsed.data).where(eq(invoicesTable.id, params.data.id)).returning();
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  res.json(parseInvoice(invoice));
});

router.get("/invoices/:id/tm-lines", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid invoice id" });
    return;
  }
  const { periodStart, periodEnd } = req.query as { periodStart?: string; periodEnd?: string };
  if (!periodStart || !periodEnd) {
    res.status(400).json({ error: "periodStart and periodEnd are required" });
    return;
  }

  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  const lines = await generateTMLines(invoice.projectId, invoice.accountId, periodStart, periodEnd);

  const resourceTotals = new Map<string, number>();
  for (const line of lines) {
    resourceTotals.set(line.resource, (resourceTotals.get(line.resource) ?? 0) + line.amount);
  }

  const grandTotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const totalHours = lines.reduce((sum, l) => sum + l.quantity, 0);

  res.json({
    invoiceId: id,
    periodStart,
    periodEnd,
    lines,
    resourceSubtotals: Object.fromEntries(resourceTotals),
    grandTotal: parseFloat(grandTotal.toFixed(2)),
    totalHours: parseFloat(totalHours.toFixed(2)),
  });
});

const ApplyTMBody = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  lines: z.array(
    z.object({
      description: z.string(),
      resource: z.string(),
      task: z.string(),
      serviceDate: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
      amount: z.number(),
    }),
  ),
});

router.post("/invoices/:id/apply-tm-lines", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid invoice id" });
    return;
  }

  const parsed = ApplyTMBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  const { periodStart, periodEnd, lines } = parsed.data;
  const grandTotal = lines.reduce((sum, l) => sum + l.amount, 0);

  const [updated] = await db
    .update(invoicesTable)
    .set({
      lineItems: lines,
      periodStart,
      periodEnd,
      billingType: "time_and_materials",
      amount: grandTotal.toFixed(2),
    })
    .where(eq(invoicesTable.id, id))
    .returning();

  res.json(parseInvoice(updated));
});

export default router;
