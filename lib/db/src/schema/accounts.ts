import { pgTable, text, serial, timestamp, boolean, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  industry: text("industry"),
  segment: text("segment").default("enterprise"),
  status: text("status").notNull().default("active"),
  healthScore: integer("health_score").default(75),
  annualContractValue: numeric("annual_contract_value", { precision: 14, scale: 2 }),
  accountOwnerId: integer("account_owner_id"),
  region: text("region"),
  otmVersion: text("otm_version"),
  cloudDeployment: boolean("cloud_deployment").default(false),
  renewalDate: text("renewal_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAccountSchema = createInsertSchema(accountsTable).omit({ id: true, createdAt: true });
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accountsTable.$inferSelect;
