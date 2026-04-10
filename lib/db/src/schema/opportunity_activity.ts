import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ACTIVITY_TYPES = [
  "discovery_call",
  "workshop",
  "scope_clarification",
  "client_commitment",
  "internal_approval",
  "proposal_sent",
  "negotiation_note",
  "go_nogo_decision",
  "general_note",
] as const;

export const opportunityActivityTable = pgTable("opportunity_activity", {
  id: serial("id").primaryKey(),
  opportunityId: integer("opportunity_id").notNull(),
  activityType: text("activity_type").notNull().default("general_note"),
  title: text("title").notNull(),
  body: text("body"),
  authorId: integer("author_id"),
  authorName: text("author_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOpportunityActivitySchema = createInsertSchema(opportunityActivityTable).omit({ id: true, createdAt: true });
export type InsertOpportunityActivity = z.infer<typeof insertOpportunityActivitySchema>;
export type OpportunityActivity = typeof opportunityActivityTable.$inferSelect;
