import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, resourcesTable } from "@workspace/db";

const router: IRouter = Router();

async function enrichUserWithResource(user: typeof usersTable.$inferSelect) {
  const [resource] = await db
    .select({ id: resourcesTable.id, name: resourcesTable.name })
    .from(resourcesTable)
    .where(eq(resourcesTable.userId, user.id))
    .limit(1);
  return { ...user, resourceId: resource?.id ?? null };
}

router.get("/me/context", async (req, res): Promise<void> => {
  const rawId = req.query.userId as string | undefined;
  const rawEmail = req.query.email as string | undefined;

  let self: typeof usersTable.$inferSelect | undefined;

  if (rawEmail) {
    [self] = await db.select().from(usersTable).where(eq(usersTable.email, rawEmail));
  } else if (rawId) {
    const id = parseInt(rawId, 10);
    if (!isNaN(id)) {
      [self] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    }
  }

  if (!self) {
    res.status(rawEmail || rawId ? 404 : 400).json({
      error: rawEmail || rawId ? "User not found" : "userId or email query param required",
    });
    return;
  }

  const selfId = self.id;

  const [directReports, manager] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.reportsToId, selfId)),
    self.reportsToId
      ? db.select().from(usersTable).where(eq(usersTable.id, self.reportsToId)).then(r => r[0] ?? null)
      : Promise.resolve(null),
  ]);

  const [selfEnriched, ...reportsEnriched] = await Promise.all([
    enrichUserWithResource(self),
    ...directReports.map(enrichUserWithResource),
  ]);

  const reportsToEnriched = manager ? await enrichUserWithResource(manager) : null;

  res.json({
    self: selfEnriched,
    reportsTo: reportsToEnriched,
    directReports: reportsEnriched,
    availableContexts: [selfEnriched, ...reportsEnriched],
  });
});

router.post("/session/context", async (req, res): Promise<void> => {
  const { userId, contextUserId } = req.body ?? {};
  if (!userId || !contextUserId) {
    res.status(400).json({ error: "userId and contextUserId required" });
    return;
  }

  const uid = parseInt(String(userId), 10);
  const ctxId = parseInt(String(contextUserId), 10);

  if (uid === ctxId) {
    res.json({ ok: true, activeContextUserId: ctxId });
    return;
  }

  const [report] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, ctxId));

  if (!report || report.reportsToId !== uid) {
    res.status(403).json({ error: "contextUserId is not a direct report of userId" });
    return;
  }

  res.json({ ok: true, activeContextUserId: ctxId });
});

export default router;
