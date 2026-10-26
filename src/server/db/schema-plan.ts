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
 * Tables added after the first migration (drizzle/0002 the framework workspace, drizzle/0003 expert capture, drizzle/0004 optional passwords), each with the statements that create it
 * exactly as the migration does: the table, then its foreign keys and indexes. A missing table gets all of them; a table
 *  that is already there is left alone. Foreign keys and indexes run only after every missing table exists, because tables of
 * one migration refer to each other. A test checks these are word for word the statements of the migration files.
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
  {
    table: "kc_audit",
    statements: [
      "CREATE TABLE `kc_audit` (\n\t`id` varchar(36) NOT NULL,\n\t`actor_id` varchar(36),\n\t`action` varchar(60) NOT NULL,\n\t`entity` varchar(40) NOT NULL,\n\t`entity_id` varchar(36),\n\t`meta` json,\n\t`created_at` timestamp NOT NULL DEFAULT (now()),\n\tCONSTRAINT `kc_audit_id` PRIMARY KEY(`id`)\n);",
      "CREATE INDEX `kc_audit_entity_idx` ON `kc_audit` (`entity`,`entity_id`,`created_at`);",
    ],
  },
  {
    table: "kc_consents",
    statements: [
      "CREATE TABLE `kc_consents` (\n\t`id` varchar(36) NOT NULL,\n\t`contributor_id` varchar(36) NOT NULL,\n\t`project_id` varchar(36),\n\t`purpose` varchar(40) NOT NULL,\n\t`granted` boolean NOT NULL,\n\t`terms_version` varchar(24) NOT NULL,\n\t`created_at` timestamp NOT NULL DEFAULT (now()),\n\tCONSTRAINT `kc_consents_id` PRIMARY KEY(`id`)\n);",
      "ALTER TABLE `kc_consents` ADD CONSTRAINT `kc_consents_contributor_id_users_id_fk` FOREIGN KEY (`contributor_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;",
      "ALTER TABLE `kc_consents` ADD CONSTRAINT `kc_consents_project_id_kc_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `kc_projects`(`id`) ON DELETE set null ON UPDATE no action;",
      "CREATE INDEX `kc_consents_contributor_idx` ON `kc_consents` (`contributor_id`,`purpose`,`created_at`);",
    ],
  },
  {
    table: "kc_contributors",
    statements: [
      "CREATE TABLE `kc_contributors` (\n\t`user_id` varchar(36) NOT NULL,\n\t`public_name` varchar(160) NOT NULL,\n\t`headline` varchar(240),\n\t`language` varchar(16) NOT NULL DEFAULT 'en',\n\t`status` enum('active','paused','withdrawn') NOT NULL DEFAULT 'active',\n\t`created_at` timestamp NOT NULL DEFAULT (now()),\n\t`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,\n\tCONSTRAINT `kc_contributors_user_id` PRIMARY KEY(`user_id`)\n);",
      "ALTER TABLE `kc_contributors` ADD CONSTRAINT `kc_contributors_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;",
    ],
  },
  {
    table: "kc_documents",
    statements: [
      "CREATE TABLE `kc_documents` (\n\t`id` varchar(36) NOT NULL,\n\t`project_id` varchar(36) NOT NULL,\n\t`kind` enum('knowledge_package','skill_md','follow_up_questions','source_map') NOT NULL,\n\t`version` int NOT NULL,\n\t`mode` enum('draft','publish') NOT NULL,\n\t`status` enum('draft','awaiting-contributor-review','approved','published','superseded') NOT NULL DEFAULT 'draft',\n\t`content` longtext NOT NULL,\n\t`data` json,\n\t`fact_fingerprint` varchar(64) NOT NULL,\n\t`approved_by` varchar(36),\n\t`approved_at` datetime,\n\t`created_by` varchar(36),\n\t`created_at` timestamp NOT NULL DEFAULT (now()),\n\tCONSTRAINT `kc_documents_id` PRIMARY KEY(`id`),\n\tCONSTRAINT `kc_documents_version_idx` UNIQUE(`project_id`,`kind`,`version`)\n);",
      "ALTER TABLE `kc_documents` ADD CONSTRAINT `kc_documents_project_id_kc_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `kc_projects`(`id`) ON DELETE cascade ON UPDATE no action;",
    ],
  },
  {
    table: "kc_fact_revisions",
    statements: [
      "CREATE TABLE `kc_fact_revisions` (\n\t`id` varchar(36) NOT NULL,\n\t`fact_id` varchar(36) NOT NULL,\n\t`actor_id` varchar(36),\n\t`action` varchar(24) NOT NULL,\n\t`before` json,\n\t`after` json,\n\t`reason` varchar(400),\n\t`created_at` timestamp NOT NULL DEFAULT (now()),\n\tCONSTRAINT `kc_fact_revisions_id` PRIMARY KEY(`id`)\n);",
      "ALTER TABLE `kc_fact_revisions` ADD CONSTRAINT `kc_fact_revisions_fact_id_kc_facts_id_fk` FOREIGN KEY (`fact_id`) REFERENCES `kc_facts`(`id`) ON DELETE cascade ON UPDATE no action;",
      "CREATE INDEX `kc_fact_revisions_fact_idx` ON `kc_fact_revisions` (`fact_id`,`created_at`);",
    ],
  },
  {
    table: "kc_fact_sources",
    statements: [
      "CREATE TABLE `kc_fact_sources` (\n\t`id` varchar(36) NOT NULL,\n\t`fact_id` varchar(36) NOT NULL,\n\t`segment_id` varchar(36) NOT NULL,\n\t`quote` text NOT NULL,\n\tCONSTRAINT `kc_fact_sources_id` PRIMARY KEY(`id`)\n);",
      "ALTER TABLE `kc_fact_sources` ADD CONSTRAINT `kc_fact_sources_fact_id_kc_facts_id_fk` FOREIGN KEY (`fact_id`) REFERENCES `kc_facts`(`id`) ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE `kc_fact_sources` ADD CONSTRAINT `kc_fact_sources_segment_id_kc_segments_id_fk` FOREIGN KEY (`segment_id`) REFERENCES `kc_segments`(`id`) ON DELETE restrict ON UPDATE no action;",
      "CREATE INDEX `kc_fact_sources_fact_idx` ON `kc_fact_sources` (`fact_id`);",
      "CREATE INDEX `kc_fact_sources_segment_idx` ON `kc_fact_sources` (`segment_id`);",
    ],
  },
  {
    table: "kc_facts",
    statements: [
      "CREATE TABLE `kc_facts` (\n\t`id` varchar(36) NOT NULL,\n\t`project_id` varchar(36) NOT NULL,\n\t`role_id` varchar(36),\n\t`process_id` varchar(36),\n\t`category` varchar(24) NOT NULL,\n\t`kind` enum('direct_statement','source_fact','ai_synthesis','editorial') NOT NULL,\n\t`title` varchar(240) NOT NULL,\n\t`statement` longtext NOT NULL,\n\t`details` json,\n\t`confidence` enum('high','medium','low') NOT NULL DEFAULT 'medium',\n\t`review_status` enum('proposed','needs_confirmation','confirmed','corrected','rejected') NOT NULL DEFAULT 'proposed',\n\t`sensitivity` enum('none','possible','confirmed') NOT NULL DEFAULT 'none',\n\t`permission` enum('unset','public','anonymize','private') NOT NULL DEFAULT 'unset',\n\t`anonymized_statement` text,\n\t`machine_extracted` boolean NOT NULL DEFAULT true,\n\t`version` int NOT NULL DEFAULT 1,\n\t`created_at` timestamp NOT NULL DEFAULT (now()),\n\t`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,\n\tCONSTRAINT `kc_facts_id` PRIMARY KEY(`id`)\n);",
      "ALTER TABLE `kc_facts` ADD CONSTRAINT `kc_facts_project_id_kc_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `kc_projects`(`id`) ON DELETE cascade ON UPDATE no action;",
      "CREATE INDEX `kc_facts_project_idx` ON `kc_facts` (`project_id`,`review_status`);",
      "CREATE INDEX `kc_facts_role_idx` ON `kc_facts` (`project_id`,`role_id`);",
    ],
  },
  {
    table: "kc_feedback",
    statements: [
      "CREATE TABLE `kc_feedback` (\n\t`id` varchar(36) NOT NULL,\n\t`lesson_id` varchar(36) NOT NULL,\n\t`lesson_version` int NOT NULL,\n\t`learner_ref` varchar(64) NOT NULL,\n\t`rating` int NOT NULL,\n\t`useful` boolean,\n\t`comment` text,\n\t`moderation` enum('visible','held','removed') NOT NULL DEFAULT 'visible',\n\t`created_at` timestamp NOT NULL DEFAULT (now()),\n\t`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,\n\tCONSTRAINT `kc_feedback_id` PRIMARY KEY(`id`),\n\tCONSTRAINT `kc_feedback_learner_idx` UNIQUE(`lesson_id`,`learner_ref`)\n);",
      "ALTER TABLE `kc_feedback` ADD CONSTRAINT `kc_feedback_lesson_id_kc_lessons_id_fk` FOREIGN KEY (`lesson_id`) REFERENCES `kc_lessons`(`id`) ON DELETE restrict ON UPDATE no action;",
    ],
  },
  {
    table: "kc_learning_events",
    statements: [
      "CREATE TABLE `kc_learning_events` (\n\t`id` varchar(36) NOT NULL,\n\t`lesson_id` varchar(36) NOT NULL,\n\t`lesson_version` int NOT NULL,\n\t`learner_ref` varchar(64) NOT NULL,\n\t`event_type` enum('start','progress','complete','material_use','check_result','return') NOT NULL,\n\t`seconds` int NOT NULL DEFAULT 0,\n\t`value` int,\n\t`dedupe_key` varchar(120) NOT NULL,\n\t`occurred_at` timestamp(3) NOT NULL DEFAULT (now()),\n\tCONSTRAINT `kc_learning_events_id` PRIMARY KEY(`id`),\n\tCONSTRAINT `kc_events_dedupe_idx` UNIQUE(`dedupe_key`)\n);",
      "ALTER TABLE `kc_learning_events` ADD CONSTRAINT `kc_learning_events_lesson_id_kc_lessons_id_fk` FOREIGN KEY (`lesson_id`) REFERENCES `kc_lessons`(`id`) ON DELETE restrict ON UPDATE no action;",
      "CREATE INDEX `kc_events_lesson_idx` ON `kc_learning_events` (`lesson_id`,`occurred_at`);",
    ],
  },
  {
    table: "kc_lesson_attribution",
    statements: [
      "CREATE TABLE `kc_lesson_attribution` (\n\t`lesson_id` varchar(36) NOT NULL,\n\t`contributor_id` varchar(36) NOT NULL,\n\t`share_bp` int NOT NULL,\n\t`credited_as` varchar(24) NOT NULL DEFAULT 'author',\n\tCONSTRAINT `kc_lesson_attribution_idx` UNIQUE(`lesson_id`,`contributor_id`)\n);",
      "ALTER TABLE `kc_lesson_attribution` ADD CONSTRAINT `kc_lesson_attribution_lesson_id_kc_lessons_id_fk` FOREIGN KEY (`lesson_id`) REFERENCES `kc_lessons`(`id`) ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE `kc_lesson_attribution` ADD CONSTRAINT `kc_lesson_attribution_contributor_id_users_id_fk` FOREIGN KEY (`contributor_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;",
    ],
  },
  {
    table: "kc_lessons",
    statements: [
      "CREATE TABLE `kc_lessons` (\n\t`id` varchar(36) NOT NULL,\n\t`slug` varchar(120) NOT NULL,\n\t`project_id` varchar(36) NOT NULL,\n\t`contributor_id` varchar(36) NOT NULL,\n\t`version` int NOT NULL DEFAULT 1,\n\t`status` enum('draft','in_review','awaiting_contributor','approved','published','retired') NOT NULL DEFAULT 'draft',\n\t`title` varchar(240) NOT NULL,\n\t`stage` varchar(24) NOT NULL,\n\t`proficiency` varchar(24) NOT NULL,\n\t`role_label` varchar(200) NOT NULL DEFAULT '',\n\t`industry` varchar(160) NOT NULL DEFAULT '',\n\t`duration_seconds` int NOT NULL DEFAULT 0,\n\t`spec` json NOT NULL,\n\t`fact_ids` json NOT NULL,\n\t`issues` json,\n\t`editor_approved_by` varchar(36),\n\t`editor_approved_at` datetime,\n\t`contributor_approved_at` datetime,\n\t`published_at` datetime,\n\t`created_at` timestamp NOT NULL DEFAULT (now()),\n\t`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,\n\tCONSTRAINT `kc_lessons_id` PRIMARY KEY(`id`),\n\tCONSTRAINT `kc_lessons_slug_idx` UNIQUE(`slug`)\n);",
      "ALTER TABLE `kc_lessons` ADD CONSTRAINT `kc_lessons_project_id_kc_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `kc_projects`(`id`) ON DELETE restrict ON UPDATE no action;",
      "ALTER TABLE `kc_lessons` ADD CONSTRAINT `kc_lessons_contributor_id_users_id_fk` FOREIGN KEY (`contributor_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;",
      "CREATE INDEX `kc_lessons_status_idx` ON `kc_lessons` (`status`);",
      "CREATE INDEX `kc_lessons_project_idx` ON `kc_lessons` (`project_id`);",
    ],
  },
  {
    table: "kc_projects",
    statements: [
      "CREATE TABLE `kc_projects` (\n\t`id` varchar(36) NOT NULL,\n\t`contributor_id` varchar(36) NOT NULL,\n\t`title` varchar(200) NOT NULL,\n\t`status` enum('interviewing','in_review','approved','published','withdrawn') NOT NULL DEFAULT 'interviewing',\n\t`language` varchar(16) NOT NULL DEFAULT 'en',\n\t`target_topics` json,\n\t`state` json NOT NULL,\n\t`created_at` timestamp NOT NULL DEFAULT (now()),\n\t`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,\n\tCONSTRAINT `kc_projects_id` PRIMARY KEY(`id`)\n);",
      "ALTER TABLE `kc_projects` ADD CONSTRAINT `kc_projects_contributor_id_users_id_fk` FOREIGN KEY (`contributor_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;",
      "CREATE INDEX `kc_projects_contributor_idx` ON `kc_projects` (`contributor_id`,`status`);",
    ],
  },
  {
    table: "kc_receipts",
    statements: [
      "CREATE TABLE `kc_receipts` (\n\t`id` varchar(36) NOT NULL,\n\t`external_ref` varchar(120) NOT NULL,\n\t`gross_minor` bigint NOT NULL,\n\t`refund_minor` bigint NOT NULL DEFAULT 0,\n\t`fee_minor` bigint NOT NULL DEFAULT 0,\n\t`tax_minor` bigint NOT NULL DEFAULT 0,\n\t`currency` varchar(3) NOT NULL,\n\t`status` enum('eligible','held','refunded','disputed') NOT NULL DEFAULT 'eligible',\n\t`received_at` datetime NOT NULL,\n\t`recorded_by` varchar(36),\n\t`created_at` timestamp NOT NULL DEFAULT (now()),\n\tCONSTRAINT `kc_receipts_id` PRIMARY KEY(`id`),\n\tCONSTRAINT `kc_receipts_ref_idx` UNIQUE(`external_ref`)\n);",
    ],
  },
  {
    table: "kc_revenue_policies",
    statements: [
      "CREATE TABLE `kc_revenue_policies` (\n\t`id` varchar(36) NOT NULL,\n\t`version` varchar(40) NOT NULL,\n\t`status` enum('draft','approved','retired') NOT NULL DEFAULT 'draft',\n\t`definition` json NOT NULL,\n\t`approved_by` varchar(36),\n\t`approved_at` datetime,\n\t`created_by` varchar(36),\n\t`created_at` timestamp NOT NULL DEFAULT (now()),\n\tCONSTRAINT `kc_revenue_policies_id` PRIMARY KEY(`id`),\n\tCONSTRAINT `kc_policies_version_idx` UNIQUE(`version`)\n);",
    ],
  },
  {
    table: "kc_roles",
    statements: [
      "CREATE TABLE `kc_roles` (\n\t`id` varchar(36) NOT NULL,\n\t`project_id` varchar(36) NOT NULL,\n\t`company` varchar(200) NOT NULL DEFAULT '',\n\t`title` varchar(200) NOT NULL DEFAULT '',\n\t`industry` varchar(160) NOT NULL DEFAULT '',\n\t`location` varchar(160) NOT NULL DEFAULT '',\n\t`start_year` int,\n\t`end_year` int,\n\t`ongoing` boolean NOT NULL DEFAULT false,\n\t`dates_approximate` boolean NOT NULL DEFAULT false,\n\t`summary` text,\n\t`sort_order` int NOT NULL DEFAULT 0,\n\t`confirmed` boolean NOT NULL DEFAULT false,\n\t`source_segment_id` varchar(36),\n\t`created_at` timestamp NOT NULL DEFAULT (now()),\n\t`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,\n\tCONSTRAINT `kc_roles_id` PRIMARY KEY(`id`)\n);",
      "ALTER TABLE `kc_roles` ADD CONSTRAINT `kc_roles_project_id_kc_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `kc_projects`(`id`) ON DELETE cascade ON UPDATE no action;",
      "CREATE INDEX `kc_roles_project_idx` ON `kc_roles` (`project_id`,`sort_order`);",
    ],
  },
  {
    table: "kc_segments",
    statements: [
      "CREATE TABLE `kc_segments` (\n\t`id` varchar(36) NOT NULL,\n\t`project_id` varchar(36) NOT NULL,\n\t`session_id` varchar(36),\n\t`seq` int NOT NULL,\n\t`source` enum('interview','upload','correction') NOT NULL,\n\t`speaker` enum('expert','companion') NOT NULL,\n\t`text` longtext NOT NULL,\n\t`modality` enum('voice','text','system') NOT NULL DEFAULT 'text',\n\t`locator` varchar(120),\n\t`upload_id` varchar(36),\n\t`role_id` varchar(36),\n\t`question_key` varchar(40),\n\t`created_at` timestamp(3) NOT NULL DEFAULT (now()),\n\tCONSTRAINT `kc_segments_id` PRIMARY KEY(`id`),\n\tCONSTRAINT `kc_segments_project_seq_idx` UNIQUE(`project_id`,`seq`)\n);",
      "ALTER TABLE `kc_segments` ADD CONSTRAINT `kc_segments_project_id_kc_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `kc_projects`(`id`) ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE `kc_segments` ADD CONSTRAINT `kc_segments_session_id_kc_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `kc_sessions`(`id`) ON DELETE set null ON UPDATE no action;",
    ],
  },
  {
    table: "kc_sessions",
    statements: [
      "CREATE TABLE `kc_sessions` (\n\t`id` varchar(36) NOT NULL,\n\t`project_id` varchar(36) NOT NULL,\n\t`number` int NOT NULL,\n\t`started_at` timestamp NOT NULL DEFAULT (now()),\n\t`ended_at` datetime,\n\t`summary` text,\n\tCONSTRAINT `kc_sessions_id` PRIMARY KEY(`id`),\n\tCONSTRAINT `kc_sessions_project_number_idx` UNIQUE(`project_id`,`number`)\n);",
      "ALTER TABLE `kc_sessions` ADD CONSTRAINT `kc_sessions_project_id_kc_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `kc_projects`(`id`) ON DELETE cascade ON UPDATE no action;",
    ],
  },
  {
    table: "kc_statements",
    statements: [
      "CREATE TABLE `kc_statements` (\n\t`id` varchar(36) NOT NULL,\n\t`contributor_id` varchar(36) NOT NULL,\n\t`policy_id` varchar(36) NOT NULL,\n\t`period_start` datetime NOT NULL,\n\t`period_end` datetime NOT NULL,\n\t`status` enum('illustrative','draft','final','disputed','paid','void') NOT NULL DEFAULT 'draft',\n\t`currency` varchar(3) NOT NULL,\n\t`total_minor` bigint NOT NULL DEFAULT 0,\n\t`payload` json NOT NULL,\n\t`inputs_hash` varchar(64) NOT NULL,\n\t`dispute_note` text,\n\t`created_by` varchar(36),\n\t`created_at` timestamp NOT NULL DEFAULT (now()),\n\t`finalized_at` datetime,\n\tCONSTRAINT `kc_statements_id` PRIMARY KEY(`id`),\n\tCONSTRAINT `kc_statements_run_idx` UNIQUE(`contributor_id`,`policy_id`,`period_start`,`period_end`,`inputs_hash`)\n);",
      "ALTER TABLE `kc_statements` ADD CONSTRAINT `kc_statements_contributor_id_users_id_fk` FOREIGN KEY (`contributor_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;",
      "ALTER TABLE `kc_statements` ADD CONSTRAINT `kc_statements_policy_id_kc_revenue_policies_id_fk` FOREIGN KEY (`policy_id`) REFERENCES `kc_revenue_policies`(`id`) ON DELETE restrict ON UPDATE no action;",
    ],
  },
  {
    table: "kc_uploads",
    statements: [
      "CREATE TABLE `kc_uploads` (\n\t`id` varchar(36) NOT NULL,\n\t`project_id` varchar(36) NOT NULL,\n\t`uploaded_by` varchar(36) NOT NULL,\n\t`filename` varchar(255) NOT NULL,\n\t`media_type` varchar(120) NOT NULL,\n\t`size` int NOT NULL,\n\t`checksum` varchar(64) NOT NULL,\n\t`ownership` enum('unknown','mine','permission','third_party') NOT NULL DEFAULT 'unknown',\n\t`intended_use` varchar(240),\n\t`role_id` varchar(36),\n\t`extraction_status` enum('pending','extracted','failed','unsupported','duplicate') NOT NULL DEFAULT 'pending',\n\t`extraction_note` varchar(400),\n\t`summary` text,\n\t`char_count` int NOT NULL DEFAULT 0,\n\t`created_at` timestamp NOT NULL DEFAULT (now()),\n\tCONSTRAINT `kc_uploads_id` PRIMARY KEY(`id`),\n\tCONSTRAINT `kc_uploads_project_checksum_idx` UNIQUE(`project_id`,`checksum`)\n);",
      "ALTER TABLE `kc_uploads` ADD CONSTRAINT `kc_uploads_project_id_kc_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `kc_projects`(`id`) ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE `kc_uploads` ADD CONSTRAINT `kc_uploads_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;",
    ],
  },
  {
    table: "user_credentials",
    statements: [
      "CREATE TABLE `user_credentials` (\n\t`user_id` varchar(36) NOT NULL,\n\t`password_hash` varchar(255) NOT NULL,\n\t`failed_attempts` int NOT NULL DEFAULT 0,\n\t`locked_until` datetime,\n\t`set_by` varchar(36),\n\t`created_at` timestamp NOT NULL DEFAULT (now()),\n\t`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,\n\tCONSTRAINT `user_credentials_user_id` PRIMARY KEY(`user_id`)\n);",
      "ALTER TABLE `user_credentials` ADD CONSTRAINT `user_credentials_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;",
    ],
  },
  {
    table: "learner_pathway",
    statements: [
      "CREATE TABLE `learner_pathway` (\n\t`user_id` varchar(36) NOT NULL,\n\t`target_role` varchar(60) NOT NULL,\n\t`created_at` timestamp NOT NULL DEFAULT (now()),\n\t`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,\n\tCONSTRAINT `learner_pathway_user_id` PRIMARY KEY(`user_id`)\n);",
      "ALTER TABLE `learner_pathway` ADD CONSTRAINT `learner_pathway_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;",
    ],
  },
  {
    table: "skill_shot_drafts",
    statements: [
      "CREATE TABLE `skill_shot_drafts` (\n\t`id` varchar(36) NOT NULL,\n\t`slug` varchar(80) NOT NULL,\n\t`title` varchar(200) NOT NULL,\n\t`status` enum('designing','failed','draft','in_review','approved','published','retired') NOT NULL DEFAULT 'draft',\n\t`blueprint` json NOT NULL,\n\t`review` json NOT NULL,\n\t`brief` json,\n\t`notes` json,\n\t`source` varchar(16) NOT NULL DEFAULT 'scaffold',\n\t`created_by` varchar(36) NOT NULL,\n\t`approved_by` varchar(36),\n\t`published_at` datetime,\n\t`created_at` timestamp NOT NULL DEFAULT (now()),\n\t`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,\n\tCONSTRAINT `skill_shot_drafts_id` PRIMARY KEY(`id`),\n\tCONSTRAINT `skill_shot_drafts_slug_idx` UNIQUE(`slug`)\n);",
      "CREATE INDEX `skill_shot_drafts_status_idx` ON `skill_shot_drafts` (`status`);",
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
