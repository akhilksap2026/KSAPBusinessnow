import { pgTable, text, serial, timestamp, integer, numeric, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const OPPORTUNITY_STAGES = ["lead", "qualified", "discovery", "proposal", "negotiation", "won", "lost", "parked"] as const;
export type OpportunityStage = typeof OPPORTUNITY_STAGES[number];

export const OPPORTUNITY_TYPES = ["implementation", "cloud_migration", "ams", "certification", "rate_maintenance", "custom_development", "data_services"] as const;
export type OpportunityType = typeof OPPORTUNITY_TYPES[number];

export const DELIVERY_COMPLEXITY = ["low", "medium", "high", "very_high"] as const;
export const PRICING_MODELS = ["milestone", "retainer", "time_and_materials", "blended"] as const;
export const GONOGO_STATUS = ["pending", "approved", "rejected", "deferred"] as const;

export const opportunitiesTable = pgTable("opportunities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  accountId: integer("account_id"),
  prospectId: integer("prospect_id"),
  accountName: text("account_name"),
  stage: text("stage").notNull().default("lead"),
  type: text("type").notNull().default("implementation"),
  value: numeric("value", { precision: 14, scale: 2 }),
  probability: integer("probability").default(20),
  expectedStartDate: text("expected_start_date"),
  expectedCloseDate: text("expected_close_date"),
  expectedDurationWeeks: integer("expected_duration_weeks"),
  ownerId: integer("owner_id"),
  ownerName: text("owner_name"),
  deliveryComplexity: text("delivery_complexity").default("medium"),
  staffingRisk: text("staffing_risk").default("none"),
  staffingDemandSummary: text("staffing_demand_summary"),
  // Detail fields
  summary: text("summary"),
  scopeSummary: text("scope_summary"),
  assumptions: text("assumptions"),
  logisticsEnvironmentNotes: text("logistics_environment_notes"),
  otmModules: jsonb("otm_modules").$type<string[]>().default([]),
  requiredRoles: jsonb("required_roles").$type<string[]>().default([]),
  stakeholders: jsonb("stakeholders").$type<{name:string; role:string; email?:string}[]>().default([]),
  risks: jsonb("risks").$type<{description:string; severity:string}[]>().default([]),
  // Go/No-Go
  goNoGoStatus: text("go_no_go_status").default("pending"),
  goNoGoRationale: text("go_no_go_rationale"),
  marginFeasibility: boolean("margin_feasibility"),
  capacityFeasibility: boolean("capacity_feasibility"),
  deliveryReadiness: boolean("delivery_readiness"),
  // Tentative project link
  tentativeProjectId: integer("tentative_project_id"),
  tentativeProjectTriggered: boolean("tentative_project_triggered").default(false),
  // Handoff
  handoffProjectId: integer("handoff_project_id"),
  handoffCompletedAt: timestamp("handoff_completed_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOpportunitySchema = createInsertSchema(opportunitiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;
export type Opportunity = typeof opportunitiesTable.$inferSelect;
