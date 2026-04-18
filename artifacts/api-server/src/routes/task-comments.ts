import { Router, type IRouter } from "express";
import { eq, asc, sql } from "drizzle-orm";
import { db, taskCommentsTable, tasksTable, resourcesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/task-comments", async (req, res): Promise<void> => {
  const { taskId } = req.query as Record<string, string>;
  if (!taskId) { res.status(400).json({ error: "taskId required" }); return; }

  const comments = await db
    .select({
      id: taskCommentsTable.id,
      taskId: taskCommentsTable.taskId,
      authorId: taskCommentsTable.authorId,
      body: taskCommentsTable.body,
      mentionedUserIds: taskCommentsTable.mentionedUserIds,
      isExternal: taskCommentsTable.isExternal,
      createdAt: taskCommentsTable.createdAt,
      updatedAt: taskCommentsTable.updatedAt,
      authorName: resourcesTable.name,
      authorTitle: resourcesTable.title,
    })
    .from(taskCommentsTable)
    .leftJoin(resourcesTable, eq(taskCommentsTable.authorId, resourcesTable.id))
    .where(eq(taskCommentsTable.taskId, parseInt(taskId)))
    .orderBy(asc(taskCommentsTable.createdAt));

  res.json(comments);
});

router.post("/task-comments", async (req, res): Promise<void> => {
  const { taskId, authorId, body, isExternal = false } = req.body;
  if (!taskId || !authorId || !body) {
    res.status(400).json({ error: "taskId, authorId, and body required" }); return;
  }

  // Parse @mentions from body
  const mentionMatches = body.match(/@(\w[\w\s]*?)(?=\s|$|[^a-zA-Z\s])/g) || [];
  const mentionNames = mentionMatches.map((m: string) => m.slice(1).trim().toLowerCase());

  let mentionedUserIds: number[] = [];
  if (mentionNames.length > 0) {
    const allResources = await db.select({ id: resourcesTable.id, name: resourcesTable.name }).from(resourcesTable);
    mentionedUserIds = allResources
      .filter(r => mentionNames.some((mn: string) => r.name.toLowerCase().includes(mn)))
      .map(r => r.id);
  }

  const [comment] = await db.insert(taskCommentsTable).values({
    taskId: parseInt(taskId),
    authorId: parseInt(authorId),
    body,
    mentionedUserIds,
    isExternal: Boolean(isExternal),
  }).returning();

  // Increment comment count on task
  await db.update(tasksTable)
    .set({ commentCount: sql`${tasksTable.commentCount} + 1` })
    .where(eq(tasksTable.id, parseInt(taskId)));

  // Create notifications for mentioned users
  if (mentionedUserIds.length > 0) {
    const { notificationsTable } = await import("@workspace/db");
    const [task] = await db.select({ name: tasksTable.name }).from(tasksTable).where(eq(tasksTable.id, parseInt(taskId)));
    const [author] = await db.select({ name: resourcesTable.name }).from(resourcesTable).where(eq(resourcesTable.id, parseInt(authorId)));
    const authorName = author?.name ?? "Someone";
    const taskName = task?.name ?? "a task";
    await Promise.all(mentionedUserIds.map(userId =>
      db.insert(notificationsTable).values({
        userId,
        type: "mention",
        title: `${authorName} mentioned you on ${taskName}`,
        body: body.slice(0, 100),
        resourceId: parseInt(taskId),
        resourceType: "task",
      } as any).execute()
    ));
  }

  // Join author info to return
  const [author] = await db.select({ name: resourcesTable.name, title: resourcesTable.title })
    .from(resourcesTable).where(eq(resourcesTable.id, comment.authorId));

  res.status(201).json({ ...comment, authorName: author?.name, authorTitle: author?.title });
});

router.patch("/task-comments/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { body } = req.body;
  if (!body) { res.status(400).json({ error: "body required" }); return; }

  const [comment] = await db.update(taskCommentsTable)
    .set({ body, updatedAt: new Date() })
    .where(eq(taskCommentsTable.id, id))
    .returning();

  if (!comment) { res.status(404).json({ error: "Not found" }); return; }
  res.json(comment);
});

router.delete("/task-comments/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [comment] = await db.select().from(taskCommentsTable).where(eq(taskCommentsTable.id, id));
  if (!comment) { res.status(404).json({ error: "Not found" }); return; }

  await db.delete(taskCommentsTable).where(eq(taskCommentsTable.id, id));

  // Decrement comment count
  await db.update(tasksTable)
    .set({ commentCount: sql`GREATEST(${tasksTable.commentCount} - 1, 0)` })
    .where(eq(tasksTable.id, comment.taskId));

  res.json({ ok: true });
});

export default router;
