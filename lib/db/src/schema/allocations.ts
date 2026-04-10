import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const allocationsTable = pgTable("allocations", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  projectName: text("project_name"),
  opportunityId: integer("opportunity_id"),
  resourceId: integer("resource_id").notNull(),
  resourceName: text("resource_name"),
  role: text("role"),
  allocationPct: integer("allocation_pct").notNull().default(100),
  startDate: text("start_date"),
  endDate: text("end_date"),
  status: text("status").notNull().default("confirmed"),
  allocationType: text("allocation_type").notNull().default("hard"),
  hoursPerWeek: numeric("hours_per_week", { precision: 6, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAllocationSchema = createInsertSchema(allocationsTable).omit({ id: true, createdAt: true });
export type InsertAllocation = z.infer<typeof insertAllocationSchema>;
export type Allocation = typeof allocationsTable.$inferSelect;
