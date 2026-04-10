import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull(),
  projectId: integer("project_id").notNull(),
  projectName: text("project_name"),
  accountId: integer("account_id").notNull(),
  accountName: text("account_name"),
  milestoneId: integer("milestone_id"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  status: text("status").notNull().default("draft"),
  issueDate: text("issue_date"),
  dueDate: text("due_date"),
  paidDate: text("paid_date"),
  notes: text("notes"),
  gstNumber: text("gst_number"),
  isInterState: boolean("is_inter_state").default(false),
  gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).default("18"),
  cgstAmount: numeric("cgst_amount", { precision: 14, scale: 2 }),
  sgstAmount: numeric("sgst_amount", { precision: 14, scale: 2 }),
  igstAmount: numeric("igst_amount", { precision: 14, scale: 2 }),
  totalWithGst: numeric("total_with_gst", { precision: 14, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, createdAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
