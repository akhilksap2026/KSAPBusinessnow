import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const timeEntryCollaboratorsTable = pgTable("time_entry_collaborators", {
  id: serial("id").primaryKey(),
  timesheetId: integer("timesheet_id").notNull(),
  resourceId: integer("resource_id").notNull(),
  resourceName: text("resource_name"),
  isInformationalOnly: boolean("is_informational_only").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTimeEntryCollaboratorSchema = createInsertSchema(timeEntryCollaboratorsTable).omit({ id: true, createdAt: true });
export type InsertTimeEntryCollaborator = z.infer<typeof insertTimeEntryCollaboratorSchema>;
export type TimeEntryCollaborator = typeof timeEntryCollaboratorsTable.$inferSelect;
