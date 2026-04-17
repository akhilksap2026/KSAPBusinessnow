import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const PROSPECT_STATUSES = ["active", "qualified", "converted", "dead"] as const;
export const PROSPECT_SENTIMENTS = ["positive", "neutral", "negative"] as const;
export const PROSPECT_TYPES = ["new_logo", "expansion", "reactivation", "referral"] as const;

export const prospectsTable = pgTable("prospects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type"),
  industry: text("industry"),
  segment: text("segment"),
  status: text("status").notNull().default("active"),
  primaryContactName: text("primary_contact_name"),
  primaryContactEmail: text("primary_contact_email"),
  linkedinUrl: text("linkedin_url"),
  sentiment: text("sentiment"),
  touchPoints: jsonb("touch_points").$type<{ date: string; type: string; notes: string }[]>().default([]),
  ownerId: integer("owner_id"),
  notes: text("notes"),
  convertedToAccountId: integer("converted_to_account_id"),
  convertedAt: timestamp("converted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProspectSchema = createInsertSchema(prospectsTable).omit({ id: true, createdAt: true });
export type InsertProspect = z.infer<typeof insertProspectSchema>;
export type Prospect = typeof prospectsTable.$inferSelect;
