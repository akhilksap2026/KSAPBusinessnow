import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type TemplateTask = {
  name: string;
  description?: string;
  estimatedHours?: number;
  visibility?: string;
  isClientAction?: boolean;
  priority?: string;
};

export type TemplateMilestone = {
  name: string;
  description?: string;
  durationWeeks: number;
  isBillable?: boolean;
  clientAction?: string;
  tasks?: TemplateTask[];
};

export type TemplatePhase = {
  name: string;
  sequence: number;
  description?: string;
  durationWeeks: number;
  milestones?: TemplateMilestone[];
  conditions?: string[];
};

export const templatesTable = pgTable("templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  description: text("description"),
  phases: jsonb("phases").$type<TemplatePhase[]>().default([]),
  conditions: jsonb("conditions").$type<Record<string, boolean>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTemplateSchema = createInsertSchema(templatesTable).omit({ id: true, createdAt: true });
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Template = typeof templatesTable.$inferSelect;
