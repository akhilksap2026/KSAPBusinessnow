import { pgTable, text, serial, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const automationsTable = pgTable("automations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  trigger: text("trigger").notNull(),
  description: text("description"),
  conditions: jsonb("conditions").$type<Record<string, string | number>>().default({}),
  actions: jsonb("actions").$type<{type: string; params?: Record<string, string>}[]>().default([]),
  enabled: boolean("enabled").default(true),
  runCount: integer("run_count").default(0),
  lastRunAt: text("last_run_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const automationRunsTable = pgTable("automation_runs", {
  id: serial("id").primaryKey(),
  automationId: integer("automation_id"),
  automationName: text("automation_name"),
  trigger: text("trigger"),
  outcome: text("outcome").notNull().default("success"),
  details: jsonb("details").$type<Record<string, string | number>>().default({}),
  entityId: integer("entity_id"),
  entityType: text("entity_type"),
  entityName: text("entity_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAutomationSchema = createInsertSchema(automationsTable).omit({ id: true, createdAt: true });
export const insertAutomationRunSchema = createInsertSchema(automationRunsTable).omit({ id: true, createdAt: true });
export type Automation = typeof automationsTable.$inferSelect;
export type AutomationRun = typeof automationRunsTable.$inferSelect;
