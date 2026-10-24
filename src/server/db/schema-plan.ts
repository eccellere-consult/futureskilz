/**
 * Columns added after the first migration (drizzle/0001), added one by one when missing.
 * Keep this list in step with every later additive migration.
 */
export const additiveColumns = [
  { table: "learner_profiles", column: "responsibility_level", definition: "varchar(32)" },
  { table: "learner_profiles", column: "focus", definition: "varchar(64)" },
  { table: "learner_profiles", column: "horizon", definition: "varchar(32)" },
  { table: "learner_profiles", column: "challenge_type", definition: "varchar(64)" },
  { table: "learner_profiles", column: "challenge", definition: "text" },
  { table: "learner_profiles", column: "priority_families", definition: "json" },
  { table: "learner_profiles", column: "welcome_summary", definition: "text" },
  { table: "learner_profiles", column: "welcome_summary_source", definition: "varchar(16)" },
  { table: "magic_links", column: "payload", definition: "json" },
] as const;

/**
 * Tables added after the first migration (drizzle/0002, the framework workspace), each with the statements that create it
 * exactly as the migration does: the table, then its foreign keys and indexes. A missing table gets all of them; a table
 * that is already there is left alone. A test checks these are word for word the statements of the migration file.
 */
export const additiveTables = [
  {
    table: "agent_skills",
    statements: [
      "CREATE TABLE `agent_skills` (\n\t`id` int AUTO_INCREMENT NOT NULL,\n\t`agent_slug` varchar(100) NOT NULL,\n\t`name` varchar(150) NOT NULL,\n\t`skill_content` longtext,\n\t`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,\n\t`created_at` timestamp NOT NULL DEFAULT (now()),\n\tCONSTRAINT `agent_skills_id` PRIMARY KEY(`id`),\n\tCONSTRAINT `agent_skills_agent_slug_unique` UNIQUE(`agent_slug`)\n);",
    ],
  },
  {
    table: "ws_cases",
    statements: [
      "CREATE TABLE `ws_cases` (\n\t`id` int AUTO_INCREMENT NOT NULL,\n\t`client_id` varchar(36) NOT NULL,\n\t`section` varchar(40) NOT NULL,\n\t`title` varchar(200) NOT NULL,\n\t`brief` text,\n\t`status` enum('open','solved','archived') NOT NULL DEFAULT 'open',\n\t`created_at` timestamp NOT NULL DEFAULT (now()),\n\t`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,\n\tCONSTRAINT `ws_cases_id` PRIMARY KEY(`id`)\n);",
      "ALTER TABLE `ws_cases` ADD CONSTRAINT `ws_cases_client_id_users_id_fk` FOREIGN KEY (`client_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;",
      "CREATE INDEX `ws_cases_client_section_idx` ON `ws_cases` (`client_id`,`section`,`status`);",
    ],
  },
  {
    table: "ws_fillins",
    statements: [
      "CREATE TABLE `ws_fillins` (\n\t`id` int AUTO_INCREMENT NOT NULL,\n\t`client_id` varchar(36) NOT NULL,\n\t`section` varchar(40) NOT NULL,\n\t`case_id` int NOT NULL DEFAULT 0,\n\t`tool_id` varchar(80) NOT NULL,\n\t`fields` json NOT NULL,\n\t`recommendations` json,\n\t`actionables` json,\n\t`analysis` json,\n\t`analysis_fingerprint` varchar(32),\n\t`analysis_at` datetime,\n\t`previous_fields` json,\n\t`previous_reason` varchar(16),\n\t`version` int NOT NULL DEFAULT 1,\n\t`created_at` timestamp NOT NULL DEFAULT (now()),\n\t`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,\n\tCONSTRAINT `ws_fillins_id` PRIMARY KEY(`id`),\n\tCONSTRAINT `ws_fillins_scope_idx` UNIQUE(`client_id`,`section`,`case_id`,`tool_id`)\n);",
      "ALTER TABLE `ws_fillins` ADD CONSTRAINT `ws_fillins_client_id_users_id_fk` FOREIGN KEY (`client_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;",
      "CREATE INDEX `ws_fillins_case_idx` ON `ws_fillins` (`client_id`,`section`,`case_id`);",
    ],
  },
  {
    table: "ws_tools",
    statements: [
      "CREATE TABLE `ws_tools` (\n\t`id` int AUTO_INCREMENT NOT NULL,\n\t`section` varchar(40) NOT NULL,\n\t`tool_id` varchar(80) NOT NULL,\n\t`name` varchar(200) NOT NULL,\n\t`facets` json NOT NULL,\n\t`does` text,\n\t`when_to_use` text,\n\t`when_not_to_use` text,\n\t`next_step` text,\n\t`fields` json NOT NULL,\n\t`upstream_tools` json,\n\t`downstream_tools` json,\n\t`definition` json,\n\t`source` json,\n\t`status` enum('draft','needs_review','in_review','published','deprecated') NOT NULL DEFAULT 'draft',\n\t`sort_order` int NOT NULL DEFAULT 0,\n\t`created_at` timestamp NOT NULL DEFAULT (now()),\n\t`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,\n\tCONSTRAINT `ws_tools_id` PRIMARY KEY(`id`),\n\tCONSTRAINT `ws_tools_section_tool_idx` UNIQUE(`section`,`tool_id`)\n);",
      "CREATE INDEX `ws_tools_section_status_idx` ON `ws_tools` (`section`,`status`);",
    ],
  },
] as const;

export type SchemaPlan = "migrate" | "add-columns";

/**
 * An empty database gets every checked-in migration. A database that already has tables only
 * gets the tables and columns it is missing: re-running a migration there could fail on columns someone
 * already added by hand, whether or not Drizzle's migration record exists.
 */
export function chooseSchemaPlan(state: { hasUsersTable: boolean; hasMigrationsFolder: boolean }): SchemaPlan {
  return !state.hasUsersTable && state.hasMigrationsFolder ? "migrate" : "add-columns";
}
