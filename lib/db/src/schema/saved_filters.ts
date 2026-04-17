import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const savedFiltersTable = pgTable("saved_filters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: integer("owner_id").notNull(),
  isShared: boolean("is_shared").default(false),
  filterContext: text("filter_context").notNull(),
  filterJson: jsonb("filter_json").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSavedFilterSchema = createInsertSchema(savedFiltersTable).omit({ id: true, createdAt: true });
export type InsertSavedFilter = z.infer<typeof insertSavedFilterSchema>;
export type SavedFilter = typeof savedFiltersTable.$inferSelect;
