import { pgTable, serial, integer, varchar, date, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const approvalDelegationsTable = pgTable("approval_delegations", {
  id: serial("id").primaryKey(),
  delegatorId: integer("delegator_id").notNull().references(() => usersTable.id),
  delegateId: integer("delegate_id").notNull().references(() => usersTable.id),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  scope: varchar("scope", { length: 20 }).notNull().default("timesheets"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ApprovalDelegation = typeof approvalDelegationsTable.$inferSelect;
