import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const timeEntryCategoriesTable = pgTable("time_entry_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code"),
  defaultBillable: boolean("default_billable").default(true),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTimeEntryCategorySchema = createInsertSchema(timeEntryCategoriesTable).omit({ id: true, createdAt: true });
export type InsertTimeEntryCategory = z.infer<typeof insertTimeEntryCategorySchema>;
export type TimeEntryCategory = typeof timeEntryCategoriesTable.$inferSelect;
