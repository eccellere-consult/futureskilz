import {
  datetime,
  index,
  int,
  longtext,
  mysqlEnum,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

import { createdAtColumn, jsonColumn, referenceColumn, updatedAtColumn } from "./columns";
import { users } from "./core";

/**
 * Framework workspace tables (the Problem Solving section and any later section built from the Framework Workspace
 * Builder kit, references/05). One set of tables serves every section: `section` is the section's slug. The engine code
 * reads and writes them with plain SQL; they are declared here so migrations and the self-setup create them.
 */

/** The section's catalogue: one row per tool, seeded from code, with the facets the overview filters on. */
export const wsTools = mysqlTable(
  "ws_tools",
  {
    id: int("id").autoincrement().primaryKey(),
    section: varchar("section", { length: 40 }).notNull(),
    toolId: varchar("tool_id", { length: 80 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    facets: jsonColumn<Record<string, unknown>>("facets").notNull(),
    does: text("does"),
    whenToUse: text("when_to_use"),
    whenNotToUse: text("when_not_to_use"),
    nextStep: text("next_step"),
    fields: jsonColumn<unknown[]>("fields").notNull(),
    upstreamTools: jsonColumn<string[]>("upstream_tools"),
    downstreamTools: jsonColumn<string[]>("downstream_tools"),
    definition: jsonColumn<Record<string, unknown>>("definition"),
    source: jsonColumn<Record<string, unknown>>("source"),
    status: mysqlEnum("status", ["draft", "needs_review", "in_review", "published", "deprecated"]).notNull().default("draft"),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("ws_tools_section_tool_idx").on(table.section, table.toolId),
    index("ws_tools_section_status_idx").on(table.section, table.status),
  ],
);

/** "My problems": each case is one problem a learner works through the section's tools. */
export const wsCases = mysqlTable(
  "ws_cases",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: referenceColumn("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    section: varchar("section", { length: 40 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    brief: text("brief"),
    status: mysqlEnum("status", ["open", "solved", "archived"]).notNull().default("open"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [index("ws_cases_client_section_idx").on(table.clientId, table.section, table.status)],
);

/**
 * One saved tool per (learner, section, case, tool). `case_id` is 0 for a section without cases and is NEVER NULL (a
 * UNIQUE key lets NULLs through); there is deliberately no foreign key from it, and the code checks the case belongs to
 * the signed-in learner before every read or write. `version` rises on every write.
 */
export const wsFillins = mysqlTable(
  "ws_fillins",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: referenceColumn("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    section: varchar("section", { length: 40 }).notNull(),
    caseId: int("case_id").notNull().default(0),
    toolId: varchar("tool_id", { length: 80 }).notNull(),
    fields: jsonColumn<unknown[]>("fields").notNull(),
    recommendations: jsonColumn<unknown[]>("recommendations"),
    actionables: jsonColumn<unknown[]>("actionables"),
    analysis: jsonColumn<Record<string, unknown>>("analysis"),
    analysisFingerprint: varchar("analysis_fingerprint", { length: 32 }),
    analysisAt: datetime("analysis_at"),
    previousFields: jsonColumn<unknown[]>("previous_fields"),
    previousReason: varchar("previous_reason", { length: 16 }),
    version: int("version").notNull().default(1),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("ws_fillins_scope_idx").on(table.clientId, table.section, table.caseId, table.toolId),
    index("ws_fillins_case_idx").on(table.clientId, table.section, table.caseId),
  ],
);

/** An admin's edited methodology for a tool (what "How is this analysed?" shows and the AI follows). */
export const agentSkills = mysqlTable("agent_skills", {
  id: int("id").autoincrement().primaryKey(),
  agentSlug: varchar("agent_slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 150 }).notNull(),
  skillContent: longtext("skill_content"),
  updatedAt: updatedAtColumn(),
  createdAt: createdAtColumn(),
});
