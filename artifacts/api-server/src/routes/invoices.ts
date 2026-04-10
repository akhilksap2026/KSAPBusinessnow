import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, invoicesTable } from "@workspace/db";
import {
  CreateInvoiceBody,
  UpdateInvoiceBody,
  GetInvoiceParams,
  UpdateInvoiceParams,
  ListInvoicesQueryParams,
} from "@workspace/api-zod";

function parseInvoice(i: typeof invoicesTable.$inferSelect) {
  return {
    ...i,
    amount: parseFloat(i.amount),
  };
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

export default router;
