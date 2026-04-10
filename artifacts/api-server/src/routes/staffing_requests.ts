import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, staffingRequestsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/staffing-requests", async (req, res): Promise<void> => {
  const { projectId, status, priority } = req.query as Record<string, string>;
  let requests = await db.select().from(staffingRequestsTable).orderBy(staffingRequestsTable.createdAt);
  if (projectId) requests = requests.filter(r => r.projectId === parseInt(projectId));
  if (status) requests = requests.filter(r => r.status === status);
  if (priority) requests = requests.filter(r => r.priority === priority);
  res.json(requests);
});

router.post("/staffing-requests", async (req, res): Promise<void> => {
  const { requestedRole, ...rest } = req.body;
  if (!requestedRole) { res.status(400).json({ error: "requestedRole required" }); return; }
  const [request] = await db.insert(staffingRequestsTable).values({ requestedRole, ...rest }).returning();
  res.status(201).json(request);
});

router.put("/staffing-requests/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { id: _id, createdAt, ...updates } = req.body;
  const [request] = await db.update(staffingRequestsTable).set(updates).where(eq(staffingRequestsTable.id, id)).returning();
  if (!request) { res.status(404).json({ error: "Not found" }); return; }
  res.json(request);
});

export default router;
