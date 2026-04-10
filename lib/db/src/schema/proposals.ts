import { pgTable, text, serial, timestamp, integer, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const PROPOSAL_TYPES = ["implementation", "migration", "ams", "certification", "custom_development", "data_services"] as const;
export const INTERNAL_APPROVAL_STATES = ["draft", "in_review", "approved", "rejected"] as const;
export const CLIENT_ACCEPTANCE_STATES = ["not_sent", "sent", "in_negotiation", "accepted", "declined"] as const;

export const proposalsTable = pgTable("proposals", {
  id: serial("id").primaryKey(),
  opportunityId: integer("opportunity_id").notNull(),
  proposalType: text("proposal_type").notNull().default("implementation"),
  title: text("title").notNull(),
  scopeSummary: text("scope_summary"),
  milestoneOutline: jsonb("milestone_outline").$type<{name:string; deliverable:string; weeks:number; billableAmount?:number}[]>().default([]),
  pricingModel: text("pricing_model").notNull().default("milestone"),
  pricingSummary: jsonb("pricing_summary").$type<{label:string; amount:number; notes?:string}[]>().default([]),
  addOns: jsonb("add_ons").$type<{name:string; amount:number; optional:boolean}[]>().default([]),
  effortEstimate: integer("effort_estimate_hours"),
  totalValue: numeric("total_value", { precision: 14, scale: 2 }),
  internalApprovalState: text("internal_approval_state").notNull().default("draft"),
  clientAcceptanceState: text("client_acceptance_state").notNull().default("not_sent"),
  versions: jsonb("versions").$type<{version:number; createdAt:string; summary:string; authorName:string}[]>().default([]),
  currentVersion: integer("current_version").default(1),
  createdById: integer("created_by_id"),
  createdByName: text("created_by_name"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProposalSchema = createInsertSchema(proposalsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProposal = z.infer<typeof insertProposalSchema>;
export type Proposal = typeof proposalsTable.$inferSelect;
