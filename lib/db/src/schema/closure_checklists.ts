import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const closureChecklistsTable = pgTable("closure_checklists", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  projectName: text("project_name"),
  accountId: integer("account_id"),
  accountName: text("account_name"),
  // Closure steps
  deliveryComplete: boolean("delivery_complete").default(false),
  deliveryCompleteAt: text("delivery_complete_at"),
  deliveryCompleteBy: text("delivery_complete_by"),
  clientSignOff: boolean("client_sign_off").default(false),
  clientSignOffAt: text("client_sign_off_at"),
  clientSignOffBy: text("client_sign_off_by"),
  billingComplete: boolean("billing_complete").default(false),
  billingCompleteAt: text("billing_complete_at"),
  billingCompleteBy: text("billing_complete_by"),
  changeOrdersReconciled: boolean("change_orders_reconciled").default(false),
  changeOrdersReconciledAt: text("change_orders_reconciled_at"),
  documentationComplete: boolean("documentation_complete").default(false),
  documentationCompleteAt: text("documentation_complete_at"),
  handoverReady: boolean("handover_ready").default(false),
  handoverReadyAt: text("handover_ready_at"),
  archived: boolean("archived").default(false),
  archivedAt: text("archived_at"),
  // Context
  closureNotes: text("closure_notes"),
  lessonsLearned: text("lessons_learned"),
  blockers: jsonb("blockers").$type<{description: string; owner: string; resolved: boolean}[]>().default([]),
  status: text("status").notNull().default("in_progress"),
  completedAt: text("completed_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertClosureChecklistSchema = createInsertSchema(closureChecklistsTable).omit({ id: true, createdAt: true });
export type InsertClosureChecklist = z.infer<typeof insertClosureChecklistSchema>;
export type ClosureChecklist = typeof closureChecklistsTable.$inferSelect;
