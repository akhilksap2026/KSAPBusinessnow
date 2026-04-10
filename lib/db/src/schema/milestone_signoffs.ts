import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const milestoneSignoffsTable = pgTable("milestone_signoffs", {
  id: serial("id").primaryKey(),
  milestoneId: integer("milestone_id").notNull(),
  projectId: integer("project_id").notNull(),
  signerName: text("signer_name").notNull(),
  signerEmail: text("signer_email"),
  note: text("note"),
  signedAt: timestamp("signed_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMilestoneSignoffSchema = createInsertSchema(milestoneSignoffsTable).omit({ id: true, createdAt: true });
export type InsertMilestoneSignoff = z.infer<typeof insertMilestoneSignoffSchema>;
export type MilestoneSignoff = typeof milestoneSignoffsTable.$inferSelect;
