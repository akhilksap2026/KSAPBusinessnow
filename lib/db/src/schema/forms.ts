import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type FormField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "multiselect" | "date" | "number" | "checkbox" | "radio" | "rating" | "signature";
  placeholder?: string;
  required?: boolean;
  options?: string[];
  conditionalOn?: { fieldId: string; value: string };
  helpText?: string;
  mapTo?: string;
};

export const formsTable = pgTable("forms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  description: text("description"),
  fields: jsonb("fields").$type<FormField[]>().default([]),
  triggers: jsonb("triggers").$type<{event: string; action: string; params?: Record<string, string>}[]>().default([]),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const formResponsesTable = pgTable("form_responses", {
  id: serial("id").primaryKey(),
  formId: integer("form_id").notNull(),
  formName: text("form_name"),
  projectId: integer("project_id"),
  milestoneId: integer("milestone_id"),
  respondentName: text("respondent_name"),
  respondentEmail: text("respondent_email"),
  responses: jsonb("responses").$type<Record<string, string | string[] | number>>().default({}),
  csatScore: integer("csat_score"),
  status: text("status").notNull().default("submitted"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFormSchema = createInsertSchema(formsTable).omit({ id: true, createdAt: true });
export const insertFormResponseSchema = createInsertSchema(formResponsesTable).omit({ id: true, submittedAt: true });
export type InsertForm = z.infer<typeof insertFormSchema>;
export type Form = typeof formsTable.$inferSelect;
export type FormResponse = typeof formResponsesTable.$inferSelect;
