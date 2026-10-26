import { datetime, index, mysqlEnum, mysqlTable, text, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

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

/**
 * The learner's answers in the conversational diagnostic: one row each, overwritten when they retake it. Only the answers are
 * stored; levels are recomputed from them every time, so a change to the rules never leaves stale scores behind.
 */
export const learnerDiagnostic = mysqlTable("learner_diagnostic", {
  userId: referenceColumn("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  answers: jsonColumn<Array<Record<string, unknown>>>("answers").notNull(),
  completedAt: datetime("completed_at"),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

/**
 * Every exchange with Arya as a coach inside a Skill Shot (a question, or a practice note and her feedback), for signed-in
 * learners. It is the audit trail for safety and quality: editors can read it, a safety flag marks what was held back or removed,
 * and a learner can delete their own history.
 */
export const coachMessages = mysqlTable(
  "coach_messages",
  {
    id: referenceColumn("id").primaryKey(),
    userId: referenceColumn("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    skillShotId: varchar("skill_shot_id", { length: 80 }).notNull(),
    kind: mysqlEnum("kind", ["question", "practice"]).notNull().default("question"),
    /** What the learner wrote, after personal details were removed. */
    message: text("message").notNull(),
    reply: text("reply").notNull(),
    /** Who wrote the reply: the AI, plain rules, or a fixed safety message. */
    source: varchar("source", { length: 12 }).notNull(),
    /** crisis, injection or redacted when a safety rule acted on the message. */
    flag: varchar("flag", { length: 16 }),
    payload: jsonColumn<Record<string, unknown>>("payload"),
    createdAt: createdAtColumn(),
  },
  (table) => [index("coach_messages_user_idx").on(table.userId, table.skillShotId, table.createdAt), index("coach_messages_flag_idx").on(table.flag, table.createdAt)],
);
