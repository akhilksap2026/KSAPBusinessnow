import { pgTable, text, serial, timestamp, integer, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const templateTasksTable = pgTable("template_tasks", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull(),
  parentId: integer("parent_id"),
  name: text("name").notNull(),
  taskType: text("task_type").notNull().default("work"),
  sortOrder: integer("sort_order").default(0),
  estimatedHours: numeric("estimated_hours", { precision: 8, scale: 2 }),
  durationDays: integer("duration_days"),
  resourceRole: text("resource_role"),
  depType: text("dep_type").default("FS"),
  predecessorIds: jsonb("predecessor_ids").$type<number[]>().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTemplateTaskSchema = createInsertSchema(templateTasksTable).omit({ id: true, createdAt: true });
export type InsertTemplateTask = z.infer<typeof insertTemplateTaskSchema>;
export type TemplateTask = typeof templateTasksTable.$inferSelect;
