import { pgTable, text, serial, timestamp, integer, numeric, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const changeRequestsTable = pgTable("change_requests", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  projectName: text("project_name"),
  changeOrderNumber: text("change_order_number"),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("other"),
  requestedById: integer("requested_by_id"),
  requestedByName: text("requested_by_name"),
  status: text("status").notNull().default("draft"),
  priority: text("priority").notNull().default("medium"),
  impactHours: numeric("impact_hours", { precision: 8, scale: 2 }),
  impactCost: numeric("impact_cost", { precision: 14, scale: 2 }),
  impactWeeks: integer("impact_weeks"),
  impactMilestones: jsonb("impact_milestones").$type<string[]>().default([]),
  affectedBudget: numeric("affected_budget", { precision: 14, scale: 2 }),
  internalApproverName: text("internal_approver_name"),
  internalApprovedAt: text("internal_approved_at"),
  clientApproverName: text("client_approver_name"),
  clientApprovedAt: text("client_approved_at"),
  deliveredBeforeApproval: boolean("delivered_before_approval").default(false),
  attachments: jsonb("attachments").$type<{name: string; url: string}[]>().default([]),
  submittedDate: text("submitted_date"),
  approvedDate: text("approved_date"),
  notes: text("notes"),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  rejectedBy: text("rejected_by"),
  rejectedAt: text("rejected_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertChangeRequestSchema = createInsertSchema(changeRequestsTable).omit({ id: true, createdAt: true });
export type InsertChangeRequest = z.infer<typeof insertChangeRequestSchema>;
export type ChangeRequest = typeof changeRequestsTable.$inferSelect;
