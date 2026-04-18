import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const COMPLIANCE_ACTION_TYPES = ["reminder_sent", "week_locked", "week_unlocked", "escalated_to_rm"] as const;
export type ComplianceActionType = typeof COMPLIANCE_ACTION_TYPES[number];

export const timesheetComplianceEventsTable = pgTable("timesheet_compliance_events", {
  id: serial("id").primaryKey(),
  resourceId: integer("resource_id").notNull(),
  resourceName: text("resource_name"),
  weekStart: text("week_start").notNull(),
  actionType: text("action_type").notNull(),
  performedByName: text("performed_by_name"),
  performedAt: timestamp("performed_at", { withTimezone: true }).notNull().defaultNow(),
  notes: text("notes"),
});

export const timesheetWeekLocksTable = pgTable("timesheet_week_locks", {
  id: serial("id").primaryKey(),
  resourceId: integer("resource_id").notNull(),
  weekStart: text("week_start").notNull(),
  lockedByName: text("locked_by_name"),
  lockedAt: timestamp("locked_at", { withTimezone: true }).notNull().defaultNow(),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
});
