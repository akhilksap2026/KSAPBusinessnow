import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const milestoneCommentsTable = pgTable("milestone_comments", {
  id: serial("id").primaryKey(),
  milestoneId: integer("milestone_id").notNull(),
  projectId: integer("project_id").notNull(),
  authorName: text("author_name").notNull(),
  authorRole: text("author_role"),
  body: text("body").notNull(),
  isClientVisible: boolean("is_client_visible").notNull().default(false),
  parentId: integer("parent_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMilestoneCommentSchema = createInsertSchema(milestoneCommentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMilestoneComment = z.infer<typeof insertMilestoneCommentSchema>;
export type MilestoneComment = typeof milestoneCommentsTable.$inferSelect;
