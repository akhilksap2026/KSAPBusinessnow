import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/notifications", async (req, res): Promise<void> => {
  const { userId, unreadOnly } = req.query as Record<string, string>;
  const uid = userId ? parseInt(userId) : 1;
  let rows = await db.select().from(notificationsTable)
    .orderBy(desc(notificationsTable.createdAt))
    .limit(100);
  rows = rows.filter(n => n.userId === uid);
  if (unreadOnly === "true") rows = rows.filter(n => !n.read);
  res.json(rows);
});

router.get("/notifications/unread-count", async (req, res): Promise<void> => {
  const { userId } = req.query as Record<string, string>;
  const uid = userId ? parseInt(userId) : 1;
  const rows = await db.select().from(notificationsTable)
    .where(and(eq(notificationsTable.userId, uid), eq(notificationsTable.read, false)));
  res.json({ count: rows.length });
});

router.post("/notifications", async (req, res): Promise<void> => {
  const { userId, title, message, type, priority, entityType, entityId, actionUrl } = req.body;
  if (!userId || !title || !message) {
    res.status(400).json({ error: "userId, title, message required" });
    return;
  }
  const [n] = await db.insert(notificationsTable)
    .values({ userId, title, message, type: type || "info", priority: priority || "fyi", entityType, entityId, actionUrl })
    .returning();
  res.status(201).json(n);
});

router.put("/notifications/:id/read", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid notification id" }); return; }
  const [notification] = await db.update(notificationsTable).set({ read: true }).where(eq(notificationsTable.id, id)).returning();
  if (!notification) { res.status(404).json({ error: "Notification not found" }); return; }
  res.json(notification);
});

router.patch("/notifications/mark-all-read", async (req, res): Promise<void> => {
  const { userId } = req.body;
  const uid = userId ? parseInt(userId) : 1;
  await db.update(notificationsTable).set({ read: true }).where(eq(notificationsTable.userId, uid));
  res.json({ ok: true });
});

router.delete("/notifications/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(notificationsTable).where(eq(notificationsTable.id, id));
  res.json({ ok: true });
});

export default router;
