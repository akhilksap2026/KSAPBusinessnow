import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const phasesTable = pgTable("phases", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  name: text("name").notNull(),
  sequence: integer("sequence").notNull().default(1),
  startDate: text("start_date"),
  endDate: text("end_date"),
  status: text("status").notNull().default("not_started"),
  description: text("description"),
  entryCriteria: jsonb("entry_criteria").default([]),
  exitCriteria: jsonb("exit_criteria").default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPhaseSchema = createInsertSchema(phasesTable).omit({ id: true, createdAt: true });
export type InsertPhase = z.infer<typeof insertPhaseSchema>;
export type Phase = typeof phasesTable.$inferSelect;
