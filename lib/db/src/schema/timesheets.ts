import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const timesheetsTable = pgTable("timesheets", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  projectName: text("project_name"),
  resourceId: integer("resource_id").notNull(),
  resourceName: text("resource_name"),
  weekStart: text("week_start").notNull(),
  hoursLogged: numeric("hours_logged", { precision: 6, scale: 2 }).notNull(),
  billableHours: numeric("billable_hours", { precision: 6, scale: 2 }),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  approvedById: integer("approved_by_id"),
  approvedByName: text("approved_by_name"),
  approvedAt: text("approved_at"),
  rejectedAt: text("rejected_at"),
  rejectedReason: text("rejected_reason"),
  entryDate: text("entry_date"),
  taskId: integer("task_id"),
  categoryId: integer("category_id"),
  isBillable: boolean("is_billable").default(true),
  activityType: text("activity_type").default("consulting"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTimesheetSchema = createInsertSchema(timesheetsTable).omit({ id: true, createdAt: true });
export type InsertTimesheet = z.infer<typeof insertTimesheetSchema>;
export type Timesheet = typeof timesheetsTable.$inferSelect;
