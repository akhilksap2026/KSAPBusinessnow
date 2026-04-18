import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, accountsTable } from "@workspace/db";
import {
  CreateAccountBody,
  UpdateAccountBody,
  GetAccountParams,
  UpdateAccountParams,
  ListAccountsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/accounts", async (req, res): Promise<void> => {
  const query = ListAccountsQueryParams.safeParse(req.query);
  let accounts = await db.select().from(accountsTable).orderBy(accountsTable.name);
  if (query.success && query.data.status) {
    accounts = accounts.filter((a) => a.status === query.data.status);
  }
  if (query.success && query.data.segment) {
    accounts = accounts.filter((a) => a.segment === query.data.segment);
  }
  res.json(accounts.map(a => ({
    ...a,
    annualContractValue: a.annualContractValue ? parseFloat(a.annualContractValue) : null,
  })));
});

router.post("/accounts", async (req, res): Promise<void> => {
  const parsed = CreateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [account] = await db.insert(accountsTable).values(parsed.data as any).returning();
  res.status(201).json(account);
});

router.get("/accounts/:id", async (req, res): Promise<void> => {
  const params = GetAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, params.data.id));
  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  res.json({ ...account, annualContractValue: account.annualContractValue ? parseFloat(account.annualContractValue) : null });
});

router.put("/accounts/:id", async (req, res): Promise<void> => {
  const params = UpdateAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [account] = await db.update(accountsTable).set(parsed.data as any).where(eq(accountsTable.id, params.data.id)).returning();
  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  res.json(account);
});

export default router;
