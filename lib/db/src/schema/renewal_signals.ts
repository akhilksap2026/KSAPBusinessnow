import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const renewalSignalsTable = pgTable("renewal_signals", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  accountName: text("account_name"),
  signalType: text("signal_type").notNull(),
  description: text("description"),
  dueDate: text("due_date"),
  estimatedValue: numeric("estimated_value", { precision: 14, scale: 2 }),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("medium"),
  assignedTo: text("assigned_to"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRenewalSignalSchema = createInsertSchema(renewalSignalsTable).omit({ id: true, createdAt: true });
export type InsertRenewalSignal = z.infer<typeof insertRenewalSignalSchema>;
export type RenewalSignal = typeof renewalSignalsTable.$inferSelect;
