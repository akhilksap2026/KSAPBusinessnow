import { pgTable, text, serial, timestamp, integer, numeric, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contractsTable = pgTable("contracts", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id"),
  accountId: integer("account_id"),
  accountName: text("account_name"),
  projectName: text("project_name"),
  name: text("name").notNull(),
  contractNumber: text("contract_number"),
  billingModel: text("billing_model").notNull().default("time_and_materials"),
  status: text("status").notNull().default("active"),
  totalValue: numeric("total_value", { precision: 14, scale: 2 }),
  remainingValue: numeric("remaining_value", { precision: 14, scale: 2 }),
  invoicedValue: numeric("invoiced_value", { precision: 14, scale: 2 }).default("0"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  paymentTerms: text("payment_terms").default("Net 30"),
  currencyCode: text("currency_code").default("USD"),
  billingCycle: text("billing_cycle").default("monthly"),
  slaConfig: jsonb("sla_config").$type<Record<string, string>>().default({}),
  billingMilestones: jsonb("billing_milestones").$type<{name: string; amount: number; triggerEvent: string; status: string}[]>().default([]),
  assumptions: text("assumptions"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertContractSchema = createInsertSchema(contractsTable).omit({ id: true, createdAt: true });
export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contractsTable.$inferSelect;
