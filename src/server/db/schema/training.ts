import { datetime, double, index, int, mysqlEnum, mysqlTable, text, varchar } from "drizzle-orm/mysql-core";

import { createdAtColumn, jsonColumn, referenceColumn, updatedAtColumn } from "./columns";
import { users } from "./core";

/**
 * A training programme being planned from a big topic: who it is for, the learner needs found, and (in tna_topics) the
 * topic tree. Everything the AI proposes starts as a proposal; a person confirms, edits or rejects it.
 */
export const tnaPrograms = mysqlTable(
  "tna_programs",
  {
    id: referenceColumn("id").primaryKey(),
    ownerId: referenceColumn("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    topic: varchar("topic", { length: 300 }).notNull(),
    /** Who the learners are: role, level, language, group size. */
    audience: jsonColumn<Record<string, unknown>>("audience").notNull(),
    goal: text("goal"),
    /** Time per learner, deadline, tools, languages and other limits. */
    constraints: jsonColumn<Record<string, unknown>>("constraints"),
    /** The learner needs: statement, evidence label, priority, status. */
    needs: jsonColumn<Array<Record<string, unknown>>>("needs"),
    status: mysqlEnum("status", ["draft", "reviewing", "approved"]).notNull().default("draft"),
    /** ai or scaffold: whether the last proposal came from a model or from the plain starting structure. */
    source: varchar("source", { length: 16 }).notNull().default("scaffold"),
    notes: jsonColumn<string[]>("notes"),
    /** "needs" or "tree" while the agent is working in the background; empty otherwise. A stale marker is cleared on read. */
    working: varchar("working", { length: 16 }),
    workingSince: datetime("working_since"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [index("tna_programs_owner_idx").on(table.ownerId, table.updatedAt)],
);

/** One node of a programme's topic tree: a module, a topic, or a Skill-Shot-sized piece (a leaf). */
export const tnaTopics = mysqlTable(
  "tna_topics",
  {
    id: referenceColumn("id").primaryKey(),
    programId: referenceColumn("program_id").notNull().references(() => tnaPrograms.id, { onDelete: "cascade" }),
    parentId: referenceColumn("parent_id"),
    position: int("position").notNull().default(0),
    title: varchar("title", { length: 200 }).notNull(),
    summary: text("summary"),
    targetLevel: double("target_level"),
    skillSlugs: jsonColumn<string[]>("skill_slugs"),
    needIds: jsonColumn<string[]>("need_ids"),
    prerequisites: jsonColumn<string[]>("prerequisites"),
    materialHint: text("material_hint"),
    evidenceSignal: text("evidence_signal"),
    minutes: int("minutes"),
    status: mysqlEnum("status", ["proposed", "approved", "rejected"]).notNull().default("proposed"),
    origin: mysqlEnum("origin", ["ai", "person"]).notNull().default("ai"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [index("tna_topics_program_idx").on(table.programId, table.parentId, table.position)],
);
