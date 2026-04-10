import { Router, type IRouter } from "express";
import { like, or } from "drizzle-orm";
import { db, projectsTable, accountsTable, resourcesTable, opportunitiesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/search", async (req, res): Promise<void> => {
  const q = (req.query.q as string || "").trim().toLowerCase();
  if (!q || q.length < 2) { res.json({ projects: [], accounts: [], resources: [], opportunities: [] }); return; }

  const pattern = `%${q}%`;

  const [projects, accounts, resources, opportunities] = await Promise.all([
    db.select({ id: projectsTable.id, name: projectsTable.name, status: projectsTable.status, accountName: projectsTable.accountName, healthScore: projectsTable.healthScore })
      .from(projectsTable).limit(6),
    db.select({ id: accountsTable.id, name: accountsTable.name, industry: accountsTable.industry, healthScore: accountsTable.healthScore, status: accountsTable.status })
      .from(accountsTable).limit(6),
    db.select({ id: resourcesTable.id, name: resourcesTable.name, title: resourcesTable.title, practiceArea: resourcesTable.practiceArea })
      .from(resourcesTable).limit(6),
    db.select({ id: opportunitiesTable.id, name: opportunitiesTable.name, stage: opportunitiesTable.stage, accountName: opportunitiesTable.accountName })
      .from(opportunitiesTable).limit(4),
  ]);

  // Client-side filter since pattern matching differs by DB
  const match = (s: string | null | undefined) => s?.toLowerCase().includes(q);

  res.json({
    projects: projects.filter(p => match(p.name) || match(p.accountName)),
    accounts: accounts.filter(a => match(a.name) || match(a.industry)),
    resources: resources.filter(r => match(r.name) || match(r.title) || match(r.practiceArea)),
    opportunities: opportunities.filter(o => match(o.name) || match(o.accountName)),
    query: q,
  });
});

export default router;
