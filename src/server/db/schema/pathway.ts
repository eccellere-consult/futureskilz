import { datetime, index, mysqlEnum, mysqlTable, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

import { createdAtColumn, jsonColumn, referenceColumn, updatedAtColumn } from "./columns";
import { users } from "./core";

/**
 * The role a learner is working toward, by the slug of a seeded role (src/features/pathway/roles.ts).
 * One row per learner. Roles live in code for now, so the slug is not a foreign key; an unknown slug is simply ignored on read.
 */
export const learnerPathway = mysqlTable("learner_pathway", {
  userId: referenceColumn("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  targetRole: varchar("target_role", { length: 60 }).notNull(),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

/**
 * Skill Shots designed by the Instructional Design Agent or an editor, kept as one blueprint each. A draft is never shown to
 * learners; an editor approves it and then publishes it, and only a draft with no failed checks can be published.
 */
export const skillShotDrafts = mysqlTable(
  "skill_shot_drafts",
  {
    id: referenceColumn("id").primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    status: mysqlEnum("status", ["designing", "failed", "draft", "in_review", "approved", "published", "retired"]).notNull().default("draft"),
    blueprint: jsonColumn<Record<string, unknown>>("blueprint").notNull(),
    review: jsonColumn<Record<string, unknown>>("review").notNull(),
    brief: jsonColumn<Record<string, unknown>>("brief"),
    /** What the design agent reports: attempts, repairs, and anything a person still has to do. */
    notes: jsonColumn<string[]>("notes"),
    source: varchar("source", { length: 16 }).notNull().default("scaffold"),
    createdBy: referenceColumn("created_by").notNull(),
    approvedBy: referenceColumn("approved_by"),
    publishedAt: datetime("published_at"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [uniqueIndex("skill_shot_drafts_slug_idx").on(table.slug), index("skill_shot_drafts_status_idx").on(table.status)],
);
