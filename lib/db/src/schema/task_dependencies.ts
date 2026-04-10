import { pgTable, serial, integer, timestamp, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const taskDependenciesTable = pgTable("task_dependencies", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  dependsOnTaskId: integer("depends_on_task_id").notNull(),
  dependencyType: text("dependency_type").notNull().default("FS"),
  lagDays: integer("lag_days").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTaskDependencySchema = createInsertSchema(taskDependenciesTable).omit({ id: true, createdAt: true });
export type InsertTaskDependency = z.infer<typeof insertTaskDependencySchema>;
export type TaskDependency = typeof taskDependenciesTable.$inferSelect;
