import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const MILESTONE_STATUSES = ["not_started", "in_progress", "completed", "overdue", "blocked", "pending_approval"] as const;

export const milestonesTable = pgTable("milestones", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  projectName: text("project_name"),
  phase: text("phase"),
  phaseId: integer("phase_id"),
  name: text("name").notNull(),
  description: text("description"),
  startDate: text("start_date"),
  dueDate: text("due_date"),
  completedDate: text("completed_date"),
  status: text("status").notNull().default("not_started"),
  ownerId: integer("owner_id"),
  ownerName: text("owner_name"),
  isBillable: boolean("is_billable").default(true),
  billableAmount: numeric("billable_amount", { precision: 14, scale: 2 }),
  invoiced: boolean("invoiced").default(false),
  visibility: text("visibility").default("internal_only"),
  approvalStatus: text("approval_status").default("not_required"),
  clientAction: text("client_action"),
  sequence: integer("sequence").default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMilestoneSchema = createInsertSchema(milestonesTable).omit({ id: true, createdAt: true });
export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;
export type Milestone = typeof milestonesTable.$inferSelect;
