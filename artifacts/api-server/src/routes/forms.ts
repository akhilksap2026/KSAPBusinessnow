import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db, formsTable, formResponsesTable, accountsTable, projectsTable,
  milestonesTable, invoicesTable, changeRequestsTable, renewalSignalsTable,
} from "@workspace/db";

const router: IRouter = Router();

router.get("/forms", async (req, res): Promise<void> => {
  const { type } = req.query as Record<string, string>;
  let forms = await db.select().from(formsTable).orderBy(formsTable.name);
  if (type) forms = forms.filter(f => f.type === type);
  res.json(forms);
});

router.post("/forms", async (req, res): Promise<void> => {
  const { name, type, ...rest } = req.body;
  if (!name || !type) { res.status(400).json({ error: "name and type required" }); return; }
  const [form] = await db.insert(formsTable).values({ name, type, ...rest }).returning();
  res.status(201).json(form);
});

router.get("/forms/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [form] = await db.select().from(formsTable).where(eq(formsTable.id, id));
  if (!form) { res.status(404).json({ error: "Not found" }); return; }
  const responses = await db.select().from(formResponsesTable).where(eq(formResponsesTable.formId, id));
  res.json({ form, responses });
});

router.post("/forms/:id/submit", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [form] = await db.select().from(formsTable).where(eq(formsTable.id, id));
  if (!form) { res.status(404).json({ error: "Form not found" }); return; }
  const [response] = await db.insert(formResponsesTable).values({
    formId: id, formName: form.name, ...req.body,
  }).returning();

  // ── CSAT → Account Health → Renewal Signal loop ────────────────────────────
  const csatScore = req.body.csatScore ? parseFloat(req.body.csatScore) : null;
  const accountId = req.body.accountId ? parseInt(req.body.accountId) : null;

  if (csatScore !== null && accountId && !isNaN(accountId)) {
    try {
      const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId));
      if (account) {
        const [projects, allMilestones, invoices, allCRs, allCsatResponses] = await Promise.all([
          db.select().from(projectsTable).where(eq(projectsTable.accountId, accountId)),
          db.select().from(milestonesTable),
          db.select().from(invoicesTable).where(eq(invoicesTable.accountId, accountId)),
          db.select().from(changeRequestsTable),
          db.select().from(formResponsesTable),
        ]);
        const projectIds = new Set(projects.map(p => p.id));
        const milestones = allMilestones.filter(m => m.projectId && projectIds.has(m.projectId));
        const accountCRs = allCRs.filter(cr => projectIds.has(cr.projectId));
        const csatScores = allCsatResponses.filter(r => r.csatScore !== null).map(r => r.csatScore!);
        const today = new Date().toISOString().split("T")[0];

        let score = 100;
        const overdue = milestones.filter(m => m.status !== "completed" && m.dueDate && m.dueDate < today);
        score -= Math.min(overdue.length * 8, 24);
        if (csatScores.length >= 1) {
          const avg = csatScores.reduce((s, n) => s + n, 0) / csatScores.length;
          if (avg < 3.5) score -= 15;
        }
        const overdueInvoices = invoices.filter(i => i.status === "overdue" || (i.status === "sent" && i.dueDate && i.dueDate < today));
        score -= Math.min(overdueInvoices.length * 8, 16);
        score = Math.max(0, Math.min(100, score));

        await db.update(accountsTable).set({ healthScore: score }).where(eq(accountsTable.id, accountId));

        if (csatScore <= 2) {
          const existingSignal = await db.select().from(renewalSignalsTable)
            .where(and(eq(renewalSignalsTable.accountId, accountId), eq(renewalSignalsTable.signalType, "low_csat")));
          if (existingSignal.length === 0) {
            const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
            await db.insert(renewalSignalsTable).values({
              accountId,
              accountName: account.name,
              signalType: "low_csat",
              status: "open",
              priority: csatScore <= 1 ? "critical" : "high",
              description: `CSAT score ${csatScore}/5 submitted — account health at risk. Immediate intervention recommended.`,
              dueDate,
              estimatedValue: account.annualContractValue || "0",
            });
          }
        }
      }
    } catch (e) {
      console.error("[CSAT loop]", e);
    }
  }

  res.status(201).json(response);
});

router.get("/form-responses", async (req, res): Promise<void> => {
  const { formId, projectId } = req.query as Record<string, string>;
  let responses = await db.select().from(formResponsesTable).orderBy(formResponsesTable.submittedAt);
  if (formId) responses = responses.filter(r => r.formId === parseInt(formId));
  if (projectId) responses = responses.filter(r => r.projectId === parseInt(projectId));
  res.json(responses);
});

export default router;
