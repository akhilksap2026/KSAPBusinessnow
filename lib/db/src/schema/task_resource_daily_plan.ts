import { pgTable, serial, integer, numeric, date, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const taskResourceDailyPlanTable = pgTable(
  "task_resource_daily_plan",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id").notNull(),
    resourceId: integer("resource_id").notNull(),
    planDate: date("plan_date").notNull(),
    plannedHours: numeric("planned_hours", { precision: 4, scale: 2 }).notNull().default("0"),
  },
  (t) => [unique().on(t.taskId, t.resourceId, t.planDate)],
);

export const insertTaskResourceDailyPlanSchema = createInsertSchema(taskResourceDailyPlanTable).omit({ id: true });
export type InsertTaskResourceDailyPlan = z.infer<typeof insertTaskResourceDailyPlanSchema>;
export type TaskResourceDailyPlan = typeof taskResourceDailyPlanTable.$inferSelect;
