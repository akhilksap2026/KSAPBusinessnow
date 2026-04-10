import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, templatesTable, projectsTable, phasesTable, milestonesTable, tasksTable, accountsTable, templateTasksTable, taskResourcesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/templates", async (req, res): Promise<void> => {
  const { type } = req.query as Record<string, string>;
  let templates = await db.select().from(templatesTable).orderBy(templatesTable.name);
  if (type) templates = templates.filter((t) => t.type === type);
  res.json(templates);
});

router.get("/templates/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [template] = await db.select().from(templatesTable).where(eq(templatesTable.id, id));
  if (!template) { res.status(404).json({ error: "Not found" }); return; }
  res.json(template);
});

// Returns DISTINCT non-null resourceRole values from template_tasks for a template.
// Used by the Step 2 Role Assignment wizard in the frontend.
router.get("/templates/:id/roles", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const tasks = await db
    .select({ resourceRole: templateTasksTable.resourceRole })
    .from(templateTasksTable)
    .where(eq(templateTasksTable.templateId, id));

  const roles = [...new Set(tasks.map(t => t.resourceRole).filter((r): r is string => Boolean(r)))].sort();
  res.json(roles);
});

router.post("/templates", async (req, res): Promise<void> => {
  const { name, type, description } = req.body;
  if (!name || !type) { res.status(400).json({ error: "name and type required" }); return; }
  const [tmpl] = await db.insert(templatesTable).values({ name, type, description: description ?? null, phases: [], conditions: {} }).returning();
  res.status(201).json(tmpl);
});

router.put("/templates/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { name, type, description } = req.body;
  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (type !== undefined) updates.type = type;
  if (description !== undefined) updates.description = description ?? null;
  const [updated] = await db.update(templatesTable).set(updates).where(eq(templatesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/templates/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(templateTasksTable).where(eq(templateTasksTable.templateId, id));
  await db.delete(templatesTable).where(eq(templatesTable.id, id));
  res.json({ ok: true });
});

router.post("/templates/:id/create-project", async (req, res): Promise<void> => {
  const templateId = parseInt(req.params.id);
  if (isNaN(templateId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [template] = await db.select().from(templatesTable).where(eq(templatesTable.id, templateId));
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }

  const { name, accountId, startDate, pmName, roleAssignments = {} } = req.body as {
    name: string;
    accountId: number;
    startDate?: string;
    pmName?: string;
    // roleAssignments maps resourceRole → { resourceId, resourceName }
    roleAssignments?: Record<string, { resourceId: number; resourceName: string }>;
  };
  if (!name || !accountId) { res.status(400).json({ error: "name and accountId required" }); return; }

  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, parseInt(String(accountId))));
  const accountName = account?.name || `Account ${accountId}`;

  const phases = (template.phases as any[]) || [];
  const totalWeeks = phases.reduce((s: number, p: any) => s + (p.durationWeeks || 0), 0);
  const start = startDate ? new Date(startDate) : new Date();
  const end = new Date(start); end.setDate(end.getDate() + totalWeeks * 7);

  const [project] = await db.insert(projectsTable).values({
    name, accountId: parseInt(String(accountId)), accountName, type: template.type as any,
    status: "planned" as any, startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0], pmName: pmName || null,
    templateId: templateId, completionPct: 0,
  }).returning();

  let phaseOffset = 0;
  for (const ph of phases.sort((a: any, b: any) => a.sequence - b.sequence)) {
    const phStart = new Date(start); phStart.setDate(start.getDate() + phaseOffset * 7);
    const phEnd = new Date(phStart); phEnd.setDate(phStart.getDate() + (ph.durationWeeks || 2) * 7);
    const [phase] = await db.insert(phasesTable).values({
      projectId: project.id, name: ph.name, sequence: ph.sequence || 1,
      startDate: phStart.toISOString().split("T")[0], endDate: phEnd.toISOString().split("T")[0],
      description: ph.description || null, status: "not_started" as any,
    }).returning();

    let msOffset = 0;
    for (const ms of (ph.milestones || [])) {
      const msDue = new Date(phStart); msDue.setDate(phStart.getDate() + (msOffset + 1) * Math.floor(((ph.durationWeeks || 2) * 7) / Math.max((ph.milestones || []).length, 1)));
      const [milestone] = await db.insert(milestonesTable).values({
        projectId: project.id, phaseId: phase.id, name: ms.name,
        status: "not_started" as any, dueDate: msDue.toISOString().split("T")[0],
        isBillable: ms.isBillable || false,
        billableAmount: ms.isBillable ? String(Math.round((project as any).budgetValue / Math.max((ph.milestones || []).length, 1) || 0)) : null,
        clientAction: ms.clientAction || null,
        phase: ph.name,
      }).returning();

      for (const t of (ms.tasks || [])) {
        await db.insert(tasksTable).values({
          projectId: project.id, phaseId: phase.id, milestoneId: milestone.id,
          title: t.name, name: t.name, status: "todo" as any,
          estimatedHours: t.estimatedHours ? String(t.estimatedHours) : null,
          isClientAction: t.isClientAction || false, priority: "medium" as any,
          phase: ph.name,
        });
      }
      msOffset++;
    }
    phaseOffset += ph.durationWeeks || 2;
  }

  // Instantiate WBS tasks from template_tasks, applying role assignments.
  const tmplTasks = await db.select().from(templateTasksTable)
    .where(eq(templateTasksTable.templateId, templateId))
    .orderBy(asc(templateTasksTable.sortOrder), asc(templateTasksTable.id));

  if (tmplTasks.length > 0) {
    const idMap = new Map<number, number>(); // templateTask.id → new task.id
    // Collect newly created task IDs that need task_resources rows
    const taskResourcePending: { taskId: number; resourceId: number; resourceName: string; estimatedHours: string | null }[] = [];

    const insertTask = async (tt: typeof tmplTasks[0], resolvedParentId: number | null): Promise<void> => {
      const startD = start.toISOString().split("T")[0];
      const endD = tt.durationDays
        ? (() => { const d = new Date(start); d.setDate(d.getDate() + tt.durationDays!); return d.toISOString().split("T")[0]; })()
        : start.toISOString().split("T")[0];

      // Resolve assignee from roleAssignments if this task has a resourceRole that was filled
      const assigned = tt.resourceRole ? (roleAssignments[tt.resourceRole] ?? null) : null;

      const [created] = await db.insert(tasksTable).values({
        projectId: project.id,
        phaseId: null,
        parentId: resolvedParentId,
        name: tt.name,
        title: tt.name,
        taskType: tt.taskType as any,
        sortOrder: tt.sortOrder ?? 0,
        estimatedHours: tt.estimatedHours ? String(tt.estimatedHours) : null,
        plannedStartDate: startD,
        plannedEndDate: endD,
        status: "todo" as any,
        priority: "medium" as any,
        completionPct: 0,
        assignedToId: assigned ? assigned.resourceId : null,
        assignedToName: assigned ? assigned.resourceName : null,
      }).returning();

      idMap.set(tt.id, created.id);

      // Queue task_resources row if role was assigned
      if (assigned) {
        taskResourcePending.push({
          taskId: created.id,
          resourceId: assigned.resourceId,
          resourceName: assigned.resourceName,
          estimatedHours: tt.estimatedHours ?? null,
        });
      }

      // Recurse for children
      const children = tmplTasks.filter(c => c.parentId === tt.id);
      for (const child of children) {
        await insertTask(child, created.id);
      }
    };

    const roots = tmplTasks.filter(t => !t.parentId);
    for (const root of roots) {
      await insertTask(root, null);
    }

    // Insert task_resources rows for all assigned tasks
    for (const tr of taskResourcePending) {
      await db.insert(taskResourcesTable).values({
        taskId: tr.taskId,
        resourceId: tr.resourceId,
        estimatedHours: tr.estimatedHours ?? null,
        role: null,
      });
    }
  }

  res.status(201).json({ projectId: project.id, name: project.name, message: "Project created from template" });
});

export default router;
