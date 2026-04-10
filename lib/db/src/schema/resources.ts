import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const resourcesTable = pgTable("resources", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  name: text("name").notNull(),
  title: text("title"),
  practiceArea: text("practice_area").notNull().default("implementation"),
  employmentType: text("employment_type").notNull().default("employee"),
  skills: text("skills").array().default([]),
  certifications: text("certifications").array().default([]),
  specialties: text("specialties").array().default([]),
  utilizationTarget: integer("utilization_target").default(80),
  currentUtilization: integer("current_utilization").default(0),
  status: text("status").notNull().default("available"),
  hourlyRate: numeric("hourly_rate", { precision: 8, scale: 2 }),
  costRate: numeric("cost_rate", { precision: 8, scale: 2 }),
  location: text("location"),
  timezone: text("timezone"),
  isContractor: boolean("is_contractor").default(false),
  availableFrom: text("available_from"),
  bio: text("bio"),
  dailyHoursCapacity: numeric("daily_hours_capacity", { precision: 5, scale: 2 }).default("8"),
  currency: text("currency").default("CAD"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertResourceSchema = createInsertSchema(resourcesTable).omit({ id: true, createdAt: true });
export type InsertResource = z.infer<typeof insertResourceSchema>;
export type Resource = typeof resourcesTable.$inferSelect;
