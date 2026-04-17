import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rateCardsTable = pgTable("rate_cards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  practiceArea: text("practice_area"),
  billingRate: numeric("billing_rate", { precision: 8, scale: 2 }).notNull(),
  sellRate: numeric("sell_rate", { precision: 8, scale: 2 }),
  costRate: numeric("cost_rate", { precision: 8, scale: 2 }),
  projectId: integer("project_id"),
  accountId: integer("account_id"),
  effectiveDate: text("effective_date"),
  expiryDate: text("expiry_date"),
  notes: text("notes"),
  isTemplate: boolean("is_template").default(false),
  currency: text("currency").default("CAD"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRateCardSchema = createInsertSchema(rateCardsTable).omit({ id: true, createdAt: true });
export type InsertRateCard = z.infer<typeof insertRateCardSchema>;
export type RateCard = typeof rateCardsTable.$inferSelect;
