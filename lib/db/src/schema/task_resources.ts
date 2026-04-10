import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const taskResourcesTable = pgTable("task_resources", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  resourceId: integer("resource_id").notNull(),
  estimatedHours: numeric("estimated_hours", { precision: 8, scale: 2 }),
  role: text("role"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTaskResourceSchema = createInsertSchema(taskResourcesTable).omit({ id: true, createdAt: true });
export type InsertTaskResource = z.infer<typeof insertTaskResourceSchema>;
export type TaskResource = typeof taskResourcesTable.$inferSelect;
