import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  accountId: integer("account_id").notNull(),
  accountName: text("account_name"),
  type: text("type").notNull().default("implementation"),
  status: text("status").notNull().default("active"),
  healthScore: integer("health_score").default(75),
  pmId: integer("pm_id"),
  pmName: text("pm_name"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  baselineStartDate: text("baseline_start_date"),
  baselineEndDate: text("baseline_end_date"),
  goLiveDate: text("go_live_date"),
  budgetHours: numeric("budget_hours", { precision: 10, scale: 2 }),
  consumedHours: numeric("consumed_hours", { precision: 10, scale: 2 }).default("0"),
  budgetValue: numeric("budget_value", { precision: 14, scale: 2 }),
  billedValue: numeric("billed_value", { precision: 14, scale: 2 }).default("0"),
  completionPct: integer("completion_pct").default(0),
  visibility: text("visibility").default("internal_only"),
  description: text("description"),
  currentPhase: text("current_phase"),
  // Lifecycle fields
  kickoffComplete: boolean("kickoff_complete").default(false),
  clientPortalActivated: boolean("client_portal_activated").default(false),
  billingReadiness: boolean("billing_readiness").default(false),
  closureReadiness: boolean("closure_readiness").default(false),
  handoverReadiness: boolean("handover_readiness").default(false),
  currency: text("currency").default("CAD"),
  isInternal: boolean("is_internal").default(false),
  healthStatus: text("health_status").default("green"),
  healthBudget: text("health_budget").default("green"),
  healthHours: text("health_hours").default("green"),
  healthTimeline: text("health_timeline").default("green"),
  healthRisks: text("health_risks").default("green"),
  burnStatus: text("burn_status"),
  templateId: integer("template_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
