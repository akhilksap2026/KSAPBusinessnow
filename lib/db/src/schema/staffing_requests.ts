import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const staffingRequestsTable = pgTable("staffing_requests", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id"),
  projectName: text("project_name"),
  opportunityId: integer("opportunity_id"),
  requestedRole: text("requested_role").notNull(),
  requiredSkills: text("required_skills").array().default([]),
  startDate: text("start_date"),
  endDate: text("end_date"),
  hoursPerWeek: integer("hours_per_week").default(40),
  allocationPct: integer("allocation_pct").default(100),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("open"),
  notes: text("notes"),
  requestedById: integer("requested_by_id"),
  requestedByName: text("requested_by_name"),
  fulfilledByResourceId: integer("fulfilled_by_resource_id"),
  fulfilledByResourceName: text("fulfilled_by_resource_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStaffingRequestSchema = createInsertSchema(staffingRequestsTable).omit({ id: true, createdAt: true });
export type InsertStaffingRequest = z.infer<typeof insertStaffingRequestSchema>;
export type StaffingRequest = typeof staffingRequestsTable.$inferSelect;
