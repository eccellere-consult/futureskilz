CREATE TABLE `kc_audit` (
	`id` varchar(36) NOT NULL,
	`actor_id` varchar(36),
	`action` varchar(60) NOT NULL,
	`entity` varchar(40) NOT NULL,
	`entity_id` varchar(36),
	`meta` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kc_audit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kc_consents` (
	`id` varchar(36) NOT NULL,
	`contributor_id` varchar(36) NOT NULL,
	`project_id` varchar(36),
	`purpose` varchar(40) NOT NULL,
	`granted` boolean NOT NULL,
	`terms_version` varchar(24) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kc_consents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kc_contributors` (
	`user_id` varchar(36) NOT NULL,
	`public_name` varchar(160) NOT NULL,
	`headline` varchar(240),
	`language` varchar(16) NOT NULL DEFAULT 'en',
	`status` enum('active','paused','withdrawn') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `kc_contributors_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `kc_documents` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`kind` enum('knowledge_package','skill_md','follow_up_questions','source_map') NOT NULL,
	`version` int NOT NULL,
	`mode` enum('draft','publish') NOT NULL,
	`status` enum('draft','awaiting-contributor-review','approved','published','superseded') NOT NULL DEFAULT 'draft',
	`content` longtext NOT NULL,
	`data` json,
	`fact_fingerprint` varchar(64) NOT NULL,
	`approved_by` varchar(36),
	`approved_at` datetime,
	`created_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kc_documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `kc_documents_version_idx` UNIQUE(`project_id`,`kind`,`version`)
);
--> statement-breakpoint
CREATE TABLE `kc_fact_revisions` (
	`id` varchar(36) NOT NULL,
	`fact_id` varchar(36) NOT NULL,
	`actor_id` varchar(36),
	`action` varchar(24) NOT NULL,
	`before` json,
	`after` json,
	`reason` varchar(400),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kc_fact_revisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kc_fact_sources` (
	`id` varchar(36) NOT NULL,
	`fact_id` varchar(36) NOT NULL,
	`segment_id` varchar(36) NOT NULL,
	`quote` text NOT NULL,
	CONSTRAINT `kc_fact_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kc_facts` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`role_id` varchar(36),
	`process_id` varchar(36),
	`category` varchar(24) NOT NULL,
	`kind` enum('direct_statement','source_fact','ai_synthesis','editorial') NOT NULL,
	`title` varchar(240) NOT NULL,
	`statement` longtext NOT NULL,
	`details` json,
	`confidence` enum('high','medium','low') NOT NULL DEFAULT 'medium',
	`review_status` enum('proposed','needs_confirmation','confirmed','corrected','rejected') NOT NULL DEFAULT 'proposed',
	`sensitivity` enum('none','possible','confirmed') NOT NULL DEFAULT 'none',
	`permission` enum('unset','public','anonymize','private') NOT NULL DEFAULT 'unset',
	`anonymized_statement` text,
	`machine_extracted` boolean NOT NULL DEFAULT true,
	`version` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `kc_facts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kc_feedback` (
	`id` varchar(36) NOT NULL,
	`lesson_id` varchar(36) NOT NULL,
	`lesson_version` int NOT NULL,
	`learner_ref` varchar(64) NOT NULL,
	`rating` int NOT NULL,
	`useful` boolean,
	`comment` text,
	`moderation` enum('visible','held','removed') NOT NULL DEFAULT 'visible',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `kc_feedback_id` PRIMARY KEY(`id`),
	CONSTRAINT `kc_feedback_learner_idx` UNIQUE(`lesson_id`,`learner_ref`)
);
--> statement-breakpoint
CREATE TABLE `kc_learning_events` (
	`id` varchar(36) NOT NULL,
	`lesson_id` varchar(36) NOT NULL,
	`lesson_version` int NOT NULL,
	`learner_ref` varchar(64) NOT NULL,
	`event_type` enum('start','progress','complete','material_use','check_result','return') NOT NULL,
	`seconds` int NOT NULL DEFAULT 0,
	`value` int,
	`dedupe_key` varchar(120) NOT NULL,
	`occurred_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `kc_learning_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `kc_events_dedupe_idx` UNIQUE(`dedupe_key`)
);
--> statement-breakpoint
CREATE TABLE `kc_lesson_attribution` (
	`lesson_id` varchar(36) NOT NULL,
	`contributor_id` varchar(36) NOT NULL,
	`share_bp` int NOT NULL,
	`credited_as` varchar(24) NOT NULL DEFAULT 'author',
	CONSTRAINT `kc_lesson_attribution_idx` UNIQUE(`lesson_id`,`contributor_id`)
);
--> statement-breakpoint
CREATE TABLE `kc_lessons` (
	`id` varchar(36) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`contributor_id` varchar(36) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`status` enum('draft','in_review','awaiting_contributor','approved','published','retired') NOT NULL DEFAULT 'draft',
	`title` varchar(240) NOT NULL,
	`stage` varchar(24) NOT NULL,
	`proficiency` varchar(24) NOT NULL,
	`role_label` varchar(200) NOT NULL DEFAULT '',
	`industry` varchar(160) NOT NULL DEFAULT '',
	`duration_seconds` int NOT NULL DEFAULT 0,
	`spec` json NOT NULL,
	`fact_ids` json NOT NULL,
	`issues` json,
	`editor_approved_by` varchar(36),
	`editor_approved_at` datetime,
	`contributor_approved_at` datetime,
	`published_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `kc_lessons_id` PRIMARY KEY(`id`),
	CONSTRAINT `kc_lessons_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `kc_projects` (
	`id` varchar(36) NOT NULL,
	`contributor_id` varchar(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`status` enum('interviewing','in_review','approved','published','withdrawn') NOT NULL DEFAULT 'interviewing',
	`language` varchar(16) NOT NULL DEFAULT 'en',
	`target_topics` json,
	`state` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `kc_projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kc_receipts` (
	`id` varchar(36) NOT NULL,
	`external_ref` varchar(120) NOT NULL,
	`gross_minor` bigint NOT NULL,
	`refund_minor` bigint NOT NULL DEFAULT 0,
	`fee_minor` bigint NOT NULL DEFAULT 0,
	`tax_minor` bigint NOT NULL DEFAULT 0,
	`currency` varchar(3) NOT NULL,
	`status` enum('eligible','held','refunded','disputed') NOT NULL DEFAULT 'eligible',
	`received_at` datetime NOT NULL,
	`recorded_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kc_receipts_id` PRIMARY KEY(`id`),
	CONSTRAINT `kc_receipts_ref_idx` UNIQUE(`external_ref`)
);
--> statement-breakpoint
CREATE TABLE `kc_revenue_policies` (
	`id` varchar(36) NOT NULL,
	`version` varchar(40) NOT NULL,
	`status` enum('draft','approved','retired') NOT NULL DEFAULT 'draft',
	`definition` json NOT NULL,
	`approved_by` varchar(36),
	`approved_at` datetime,
	`created_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kc_revenue_policies_id` PRIMARY KEY(`id`),
	CONSTRAINT `kc_policies_version_idx` UNIQUE(`version`)
);
--> statement-breakpoint
CREATE TABLE `kc_roles` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`company` varchar(200) NOT NULL DEFAULT '',
	`title` varchar(200) NOT NULL DEFAULT '',
	`industry` varchar(160) NOT NULL DEFAULT '',
	`location` varchar(160) NOT NULL DEFAULT '',
	`start_year` int,
	`end_year` int,
	`ongoing` boolean NOT NULL DEFAULT false,
	`dates_approximate` boolean NOT NULL DEFAULT false,
	`summary` text,
	`sort_order` int NOT NULL DEFAULT 0,
	`confirmed` boolean NOT NULL DEFAULT false,
	`source_segment_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `kc_roles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kc_segments` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`session_id` varchar(36),
	`seq` int NOT NULL,
	`source` enum('interview','upload','correction') NOT NULL,
	`speaker` enum('expert','companion') NOT NULL,
	`text` longtext NOT NULL,
	`modality` enum('voice','text','system') NOT NULL DEFAULT 'text',
	`locator` varchar(120),
	`upload_id` varchar(36),
	`role_id` varchar(36),
	`question_key` varchar(40),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `kc_segments_id` PRIMARY KEY(`id`),
	CONSTRAINT `kc_segments_project_seq_idx` UNIQUE(`project_id`,`seq`)
);
--> statement-breakpoint
CREATE TABLE `kc_sessions` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`number` int NOT NULL,
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`ended_at` datetime,
	`summary` text,
	CONSTRAINT `kc_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `kc_sessions_project_number_idx` UNIQUE(`project_id`,`number`)
);
--> statement-breakpoint
CREATE TABLE `kc_statements` (
	`id` varchar(36) NOT NULL,
	`contributor_id` varchar(36) NOT NULL,
	`policy_id` varchar(36) NOT NULL,
	`period_start` datetime NOT NULL,
	`period_end` datetime NOT NULL,
	`status` enum('illustrative','draft','final','disputed','paid','void') NOT NULL DEFAULT 'draft',
	`currency` varchar(3) NOT NULL,
	`total_minor` bigint NOT NULL DEFAULT 0,
	`payload` json NOT NULL,
	`inputs_hash` varchar(64) NOT NULL,
	`dispute_note` text,
	`created_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`finalized_at` datetime,
	CONSTRAINT `kc_statements_id` PRIMARY KEY(`id`),
	CONSTRAINT `kc_statements_run_idx` UNIQUE(`contributor_id`,`policy_id`,`period_start`,`period_end`,`inputs_hash`)
);
--> statement-breakpoint
CREATE TABLE `kc_uploads` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`uploaded_by` varchar(36) NOT NULL,
	`filename` varchar(255) NOT NULL,
	`media_type` varchar(120) NOT NULL,
	`size` int NOT NULL,
	`checksum` varchar(64) NOT NULL,
	`ownership` enum('unknown','mine','permission','third_party') NOT NULL DEFAULT 'unknown',
	`intended_use` varchar(240),
	`role_id` varchar(36),
	`extraction_status` enum('pending','extracted','failed','unsupported','duplicate') NOT NULL DEFAULT 'pending',
	`extraction_note` varchar(400),
	`summary` text,
	`char_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kc_uploads_id` PRIMARY KEY(`id`),
	CONSTRAINT `kc_uploads_project_checksum_idx` UNIQUE(`project_id`,`checksum`)
);
--> statement-breakpoint
ALTER TABLE `kc_consents` ADD CONSTRAINT `kc_consents_contributor_id_users_id_fk` FOREIGN KEY (`contributor_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kc_consents` ADD CONSTRAINT `kc_consents_project_id_kc_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `kc_projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kc_contributors` ADD CONSTRAINT `kc_contributors_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kc_documents` ADD CONSTRAINT `kc_documents_project_id_kc_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `kc_projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kc_fact_revisions` ADD CONSTRAINT `kc_fact_revisions_fact_id_kc_facts_id_fk` FOREIGN KEY (`fact_id`) REFERENCES `kc_facts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kc_fact_sources` ADD CONSTRAINT `kc_fact_sources_fact_id_kc_facts_id_fk` FOREIGN KEY (`fact_id`) REFERENCES `kc_facts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kc_fact_sources` ADD CONSTRAINT `kc_fact_sources_segment_id_kc_segments_id_fk` FOREIGN KEY (`segment_id`) REFERENCES `kc_segments`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kc_facts` ADD CONSTRAINT `kc_facts_project_id_kc_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `kc_projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kc_feedback` ADD CONSTRAINT `kc_feedback_lesson_id_kc_lessons_id_fk` FOREIGN KEY (`lesson_id`) REFERENCES `kc_lessons`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kc_learning_events` ADD CONSTRAINT `kc_learning_events_lesson_id_kc_lessons_id_fk` FOREIGN KEY (`lesson_id`) REFERENCES `kc_lessons`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kc_lesson_attribution` ADD CONSTRAINT `kc_lesson_attribution_lesson_id_kc_lessons_id_fk` FOREIGN KEY (`lesson_id`) REFERENCES `kc_lessons`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kc_lesson_attribution` ADD CONSTRAINT `kc_lesson_attribution_contributor_id_users_id_fk` FOREIGN KEY (`contributor_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kc_lessons` ADD CONSTRAINT `kc_lessons_project_id_kc_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `kc_projects`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kc_lessons` ADD CONSTRAINT `kc_lessons_contributor_id_users_id_fk` FOREIGN KEY (`contributor_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kc_projects` ADD CONSTRAINT `kc_projects_contributor_id_users_id_fk` FOREIGN KEY (`contributor_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kc_roles` ADD CONSTRAINT `kc_roles_project_id_kc_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `kc_projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kc_segments` ADD CONSTRAINT `kc_segments_project_id_kc_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `kc_projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kc_segments` ADD CONSTRAINT `kc_segments_session_id_kc_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `kc_sessions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kc_sessions` ADD CONSTRAINT `kc_sessions_project_id_kc_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `kc_projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kc_statements` ADD CONSTRAINT `kc_statements_contributor_id_users_id_fk` FOREIGN KEY (`contributor_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kc_statements` ADD CONSTRAINT `kc_statements_policy_id_kc_revenue_policies_id_fk` FOREIGN KEY (`policy_id`) REFERENCES `kc_revenue_policies`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kc_uploads` ADD CONSTRAINT `kc_uploads_project_id_kc_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `kc_projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kc_uploads` ADD CONSTRAINT `kc_uploads_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `kc_audit_entity_idx` ON `kc_audit` (`entity`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `kc_consents_contributor_idx` ON `kc_consents` (`contributor_id`,`purpose`,`created_at`);--> statement-breakpoint
CREATE INDEX `kc_fact_revisions_fact_idx` ON `kc_fact_revisions` (`fact_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `kc_fact_sources_fact_idx` ON `kc_fact_sources` (`fact_id`);--> statement-breakpoint
CREATE INDEX `kc_fact_sources_segment_idx` ON `kc_fact_sources` (`segment_id`);--> statement-breakpoint
CREATE INDEX `kc_facts_project_idx` ON `kc_facts` (`project_id`,`review_status`);--> statement-breakpoint
CREATE INDEX `kc_facts_role_idx` ON `kc_facts` (`project_id`,`role_id`);--> statement-breakpoint
CREATE INDEX `kc_events_lesson_idx` ON `kc_learning_events` (`lesson_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `kc_lessons_status_idx` ON `kc_lessons` (`status`);--> statement-breakpoint
CREATE INDEX `kc_lessons_project_idx` ON `kc_lessons` (`project_id`);--> statement-breakpoint
CREATE INDEX `kc_projects_contributor_idx` ON `kc_projects` (`contributor_id`,`status`);--> statement-breakpoint
CREATE INDEX `kc_roles_project_idx` ON `kc_roles` (`project_id`,`sort_order`);