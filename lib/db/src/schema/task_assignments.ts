import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const taskAssignmentsTable = pgTable("task_assignments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  resourceId: integer("resource_id").notNull(),
  roleOnTask: text("role_on_task"),
  estimatedHours: numeric("estimated_hours", { precision: 8, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTaskAssignmentSchema = createInsertSchema(taskAssignmentsTable).omit({ id: true, createdAt: true });
export type InsertTaskAssignment = z.infer<typeof insertTaskAssignmentSchema>;
export type TaskAssignment = typeof taskAssignmentsTable.$inferSelect;
