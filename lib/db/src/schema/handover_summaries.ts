import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type HandoverContact = { name: string; role: string; email?: string; phone?: string; type: "client" | "internal" | "ams" };
export type HandoverMilestoneSummary = { name: string; status: string; completedDate?: string; notes?: string };

export const handoverSummariesTable = pgTable("handover_summaries", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  projectName: text("project_name"),
  accountId: integer("account_id"),
  accountName: text("account_name"),
  scopeDelivered: text("scope_delivered"),
  milestoneSummary: jsonb("milestone_summary").$type<HandoverMilestoneSummary[]>().default([]),
  openRisks: text("open_risks"),
  supportExpectations: text("support_expectations"),
  changeHistory: jsonb("change_history").$type<{title: string; status: string; impactCost?: number}[]>().default([]),
  keyContacts: jsonb("key_contacts").$type<HandoverContact[]>().default([]),
  unresolvedItems: text("unresolved_items"),
  renewalNotes: text("renewal_notes"),
  upsellNotes: text("upsell_notes"),
  signedOffBy: text("signed_off_by"),
  signedOffAt: text("signed_off_at"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHandoverSummarySchema = createInsertSchema(handoverSummariesTable).omit({ id: true, createdAt: true });
export type InsertHandoverSummary = z.infer<typeof insertHandoverSummarySchema>;
export type HandoverSummary = typeof handoverSummariesTable.$inferSelect;
