import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const fxRatesTable = pgTable("fx_rates", {
  id: serial("id").primaryKey(),
  fromCurrency: text("from_currency").notNull(),
  toCurrency: text("to_currency").notNull(),
  rate: numeric("rate", { precision: 12, scale: 6 }).notNull(),
  effectiveDate: text("effective_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFxRateSchema = createInsertSchema(fxRatesTable).omit({ id: true, createdAt: true });
export type InsertFxRate = z.infer<typeof insertFxRateSchema>;
export type FxRate = typeof fxRatesTable.$inferSelect;
