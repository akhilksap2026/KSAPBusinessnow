import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const TASK_STATUSES = ["todo", "in_progress", "in_review", "done", "blocked", "cancelled"] as const;

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  milestoneId: integer("milestone_id"),
  phaseId: integer("phase_id"),
  phase: text("phase"),
  parentId: integer("parent_id"),
  name: text("name").notNull(),
  description: text("description"),
  assignedToId: integer("assigned_to_id"),
  assignedToName: text("assigned_to_name"),
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("medium"),
  dueDate: text("due_date"),
  estimatedHours: numeric("estimated_hours", { precision: 8, scale: 2 }),
  loggedHours: numeric("logged_hours", { precision: 8, scale: 2 }).default("0"),
  visibility: text("visibility").default("internal_only"),
  isClientAction: boolean("is_client_action").default(false),
  approvalStatus: text("approval_status").default("not_required"),
  blockerNote: text("blocker_note"),
  notes: text("notes"),
  dependsOnTaskId: integer("depends_on_task_id"),
  taskType: text("task_type").notNull().default("work"),
  plannedStartDate: text("planned_start_date"),
  plannedEndDate: text("planned_end_date"),
  baselineStartDate: text("baseline_start_date"),
  baselineEndDate: text("baseline_end_date"),
  etcHours: numeric("etc_hours", { precision: 8, scale: 2 }),
  completionPct: integer("completion_pct").default(0),
  sortOrder: integer("sort_order").default(0),
  hierarchyLevel: integer("hierarchy_level").default(0),
  isLeaf: boolean("is_leaf").default(true),
  commentCount: integer("comment_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
