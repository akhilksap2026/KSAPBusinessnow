import { Router, type IRouter } from "express";
import { eq, or, and, lte, gte } from "drizzle-orm";
import { db, approvalDelegationsTable, usersTable } from "@workspace/db";

const router: IRouter = Router();

// POST /api/delegations — create a delegation
router.post("/delegations", async (req, res): Promise<void> => {
  const { delegatorId, delegateId, startDate, endDate, scope } = req.body;
  if (!delegatorId || !delegateId || !startDate || !endDate) {
    res.status(400).json({ error: "delegatorId, delegateId, startDate, endDate required" });
    return;
  }
  const [row] = await db.insert(approvalDelegationsTable).values({
    delegatorId: parseInt(delegatorId),
    delegateId: parseInt(delegateId),
    startDate,
    endDate,
    scope: scope || "timesheets",
    isActive: true,
  }).returning();
  res.status(201).json(row);
});

// GET /api/delegations/mine — delegations where I am delegator or delegate
router.get("/delegations/mine", async (req, res): Promise<void> => {
  const contextUserId = parseInt(req.query.contextUserId as string);
  if (isNaN(contextUserId)) { res.status(400).json({ error: "contextUserId required" }); return; }

  const rows = await db.select().from(approvalDelegationsTable)
    .where(and(
      eq(approvalDelegationsTable.isActive, true),
      or(
        eq(approvalDelegationsTable.delegatorId, contextUserId),
        eq(approvalDelegationsTable.delegateId, contextUserId),
      )
    ));

  // Enrich with user names
  const userIds = [...new Set(rows.flatMap(r => [r.delegatorId, r.delegateId]))];
  const users = userIds.length
    ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable)
        .where(or(...userIds.map(uid => eq(usersTable.id, uid))))
    : [];
  const userMap = Object.fromEntries(users.map(u => [u.id, u.name]));

  res.json(rows.map(r => ({
    ...r,
    delegatorName: userMap[r.delegatorId] ?? `User #${r.delegatorId}`,
    delegateName: userMap[r.delegateId] ?? `User #${r.delegateId}`,
  })));
});

// DELETE /api/delegations/:id — deactivate a delegation
router.delete("/delegations/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.update(approvalDelegationsTable)
    .set({ isActive: false })
    .where(eq(approvalDelegationsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

export default router;
