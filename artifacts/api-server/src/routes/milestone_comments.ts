import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, milestoneCommentsTable, usersTable, notificationsTable } from "@workspace/db";

const router: IRouter = Router();

async function dispatchMentionNotifications(
  body: string,
  projectId: number,
  milestoneId: number,
  authorName: string,
): Promise<void> {
  const allUsers = await db.select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.active, true));

  for (const user of allUsers) {
    if (body.includes(`@${user.name}`) && user.name !== authorName) {
      await db.insert(notificationsTable).values({
        userId: user.id,
        title: `${authorName} mentioned you`,
        message: `You were mentioned in a comment: "${body.length > 100 ? body.slice(0, 100) + "…" : body}"`,
        type: "mention",
        priority: "fyi",
        entityType: "milestone",
        entityId: milestoneId,
        actionUrl: `/projects/${projectId}`,
      });
    }
  }
}

router.get("/milestones/:milestoneId/comments", async (req, res): Promise<void> => {
  const milestoneId = parseInt(req.params.milestoneId, 10);
  if (isNaN(milestoneId)) { res.status(400).json({ error: "Invalid milestoneId" }); return; }
  const comments = await db.select().from(milestoneCommentsTable)
    .where(eq(milestoneCommentsTable.milestoneId, milestoneId))
    .orderBy(desc(milestoneCommentsTable.createdAt));
  res.json(comments);
});

router.post("/milestones/:milestoneId/comments", async (req, res): Promise<void> => {
  const milestoneId = parseInt(req.params.milestoneId, 10);
  if (isNaN(milestoneId)) { res.status(400).json({ error: "Invalid milestoneId" }); return; }
  const { projectId, authorName, authorRole, body, isClientVisible, parentId } = req.body;
  if (!projectId || !authorName || !body) {
    res.status(400).json({ error: "projectId, authorName, body required" });
    return;
  }
  const [comment] = await db.insert(milestoneCommentsTable)
    .values({ milestoneId, projectId, authorName, authorRole, body, isClientVisible: !!isClientVisible, parentId: parentId || null })
    .returning();

  dispatchMentionNotifications(body, projectId, milestoneId, authorName).catch(() => {});

  res.status(201).json(comment);
});

router.delete("/milestones/comments/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(milestoneCommentsTable).where(eq(milestoneCommentsTable.id, id));
  res.json({ ok: true });
});

export default router;
