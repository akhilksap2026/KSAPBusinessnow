import { pgTable, serial, integer, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { projectsTable } from "./projects";
import { tasksTable } from "./tasks";

export const projectBaselinesTable = pgTable("project_baselines", {
  id:           serial("id").primaryKey(),
  projectId:    integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  label:        text("label").notNull().default("Baseline"),
  baselinedAt:  timestamp("baselined_at").notNull().defaultNow(),
  baselinedBy:  text("baselined_by"),
});

export const baselineTasksTable = pgTable("baseline_tasks", {
  id:              serial("id").primaryKey(),
  baselineId:      integer("baseline_id").notNull().references(() => projectBaselinesTable.id, { onDelete: "cascade" }),
  taskId:          integer("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  plannedStart:    text("planned_start"),
  plannedEnd:      text("planned_end"),
  plannedHours:    numeric("planned_hours", { precision: 8, scale: 2 }),
});

export const insertProjectBaselineSchema = createInsertSchema(projectBaselinesTable).omit({ id: true, baselinedAt: true });
export const insertBaselineTaskSchema    = createInsertSchema(baselineTasksTable).omit({ id: true });

export type ProjectBaseline = typeof projectBaselinesTable.$inferSelect;
export type BaselineTask    = typeof baselineTasksTable.$inferSelect;
