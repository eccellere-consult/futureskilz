CREATE TABLE `content_extractions` (
	`id` varchar(36) NOT NULL,
	`source_asset_id` varchar(36) NOT NULL,
	`skill_id` varchar(36),
	`extraction` json NOT NULL,
	`model` varchar(120) NOT NULL,
	`prompt_version` varchar(64) NOT NULL,
	`confidence` float NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `content_extractions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_provenance` (
	`id` varchar(36) NOT NULL,
	`skill_shot_id` varchar(36) NOT NULL,
	`source_asset_id` varchar(36) NOT NULL,
	`extraction_id` varchar(36),
	`attribution` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `content_provenance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_reviews` (
	`id` varchar(36) NOT NULL,
	`skill_shot_id` varchar(36) NOT NULL,
	`reviewer_id` varchar(36) NOT NULL,
	`decision` varchar(64) NOT NULL,
	`checklist` json NOT NULL,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `content_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `source_assets` (
	`id` varchar(36) NOT NULL,
	`contributor_id` varchar(36) NOT NULL,
	`storage_key` varchar(512) NOT NULL,
	`filename` varchar(255) NOT NULL,
	`media_type` varchar(120) NOT NULL,
	`checksum` varchar(128) NOT NULL,
	`status` enum('uploaded','processing','review','approved','rejected','published') NOT NULL DEFAULT 'uploaded',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `source_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `learner_profiles` (
	`user_id` varchar(36) NOT NULL,
	`current_role` varchar(160),
	`industry` varchar(120),
	`experience_years` int,
	`weekly_minutes` int,
	`timezone` varchar(64) NOT NULL DEFAULT 'Asia/Kolkata',
	`onboarding_completed_at` datetime,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `learner_profiles_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `learner_skills` (
	`learner_id` varchar(36) NOT NULL,
	`skill_id` varchar(36) NOT NULL,
	`current_level` float NOT NULL DEFAULT 0,
	`target_level` float NOT NULL DEFAULT 0,
	`confidence` float NOT NULL DEFAULT 0,
	`evidence_count` int NOT NULL DEFAULT 0,
	`last_assessed_at` datetime,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `learner_skills_learner_id_skill_id_pk` PRIMARY KEY(`learner_id`,`skill_id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` varchar(36) NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `role_skills` (
	`role_id` varchar(36) NOT NULL,
	`skill_id` varchar(36) NOT NULL,
	`target_level` float NOT NULL,
	`required` boolean NOT NULL DEFAULT true,
	CONSTRAINT `role_skills_role_id_skill_id_pk` PRIMARY KEY(`role_id`,`skill_id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` varchar(36) NOT NULL,
	`title` varchar(160) NOT NULL,
	`slug` varchar(160) NOT NULL,
	`function` varchar(120),
	`industry` varchar(120),
	`description` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `skill_relationships` (
	`source_skill_id` varchar(36) NOT NULL,
	`target_skill_id` varchar(36) NOT NULL,
	`relationship_type` enum('parent','prerequisite','adjacent') NOT NULL,
	`weight` float NOT NULL DEFAULT 1,
	CONSTRAINT `skill_relationships_pk` PRIMARY KEY(`source_skill_id`,`target_skill_id`,`relationship_type`)
);
--> statement-breakpoint
CREATE TABLE `skills` (
	`id` varchar(36) NOT NULL,
	`parent_skill_id` varchar(36),
	`name` varchar(160) NOT NULL,
	`slug` varchar(160) NOT NULL,
	`description` text NOT NULL,
	`category` varchar(100) NOT NULL,
	`type` varchar(80) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`status` enum('draft','active','retired') NOT NULL DEFAULT 'draft',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `skills_id` PRIMARY KEY(`id`),
	CONSTRAINT `skills_slug_version_idx` UNIQUE(`slug`,`version`)
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` varchar(36) NOT NULL,
	`role` varchar(64) NOT NULL,
	`granted_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_roles_user_id_role_pk` PRIMARY KEY(`user_id`,`role`)
);
--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`token_hash` varchar(128) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`last_seen_at` timestamp NOT NULL DEFAULT (now()),
	`revoked_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_sessions_token_hash_idx` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36),
	`email` varchar(254) NOT NULL,
	`display_name` varchar(160) NOT NULL,
	`status` enum('invited','active','suspended') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_idx` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `assessment_attempts` (
	`id` varchar(36) NOT NULL,
	`assessment_id` varchar(36) NOT NULL,
	`learner_id` varchar(36) NOT NULL,
	`status` enum('started','submitted','evaluated','abandoned') NOT NULL DEFAULT 'started',
	`score` float,
	`confidence` float,
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` datetime,
	CONSTRAINT `assessment_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `assessment_questions` (
	`id` varchar(36) NOT NULL,
	`assessment_id` varchar(36) NOT NULL,
	`skill_id` varchar(36) NOT NULL,
	`sequence` int NOT NULL,
	`prompt` text NOT NULL,
	`response_type` varchar(64) NOT NULL,
	`rubric` json NOT NULL,
	CONSTRAINT `assessment_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `assessment_responses` (
	`id` varchar(36) NOT NULL,
	`attempt_id` varchar(36) NOT NULL,
	`question_id` varchar(36) NOT NULL,
	`response` json NOT NULL,
	`score` float,
	`evaluator` varchar(120),
	`confidence` float,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assessment_responses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `assessments` (
	`id` varchar(36) NOT NULL,
	`title` varchar(220) NOT NULL,
	`type` varchar(64) NOT NULL,
	`rubric_version` varchar(64) NOT NULL,
	`status` enum('draft','active','completed','archived') NOT NULL DEFAULT 'draft',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assessments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `goal_skills` (
	`goal_id` varchar(36) NOT NULL,
	`skill_id` varchar(36) NOT NULL,
	`target_level` float NOT NULL,
	`priority` int NOT NULL DEFAULT 1,
	CONSTRAINT `goal_skills_goal_id_skill_id_pk` PRIMARY KEY(`goal_id`,`skill_id`)
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` varchar(36) NOT NULL,
	`learner_id` varchar(36) NOT NULL,
	`target_role_id` varchar(36),
	`title` varchar(200) NOT NULL,
	`description` text NOT NULL,
	`target_date` datetime,
	`priority` int NOT NULL DEFAULT 1,
	`status` enum('draft','active','completed','archived') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `goals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `journey_steps` (
	`id` varchar(36) NOT NULL,
	`journey_id` varchar(36) NOT NULL,
	`skill_id` varchar(36) NOT NULL,
	`skill_shot_id` varchar(36),
	`sequence` int NOT NULL,
	`status` enum('draft','active','completed','archived') NOT NULL DEFAULT 'draft',
	`score` float,
	`mastery` float,
	CONSTRAINT `journey_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `learning_journeys` (
	`id` varchar(36) NOT NULL,
	`learner_id` varchar(36) NOT NULL,
	`goal_id` varchar(36) NOT NULL,
	`estimated_minutes` int NOT NULL,
	`progress` float NOT NULL DEFAULT 0,
	`status` enum('draft','active','completed','archived') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `learning_journeys_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `practice_sessions` (
	`id` varchar(36) NOT NULL,
	`learner_id` varchar(36) NOT NULL,
	`skill_id` varchar(36) NOT NULL,
	`skill_shot_id` varchar(36),
	`response` json NOT NULL,
	`feedback` json,
	`score` float,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `practice_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `skill_evidence` (
	`id` varchar(36) NOT NULL,
	`learner_id` varchar(36) NOT NULL,
	`skill_id` varchar(36) NOT NULL,
	`evidence_type` varchar(64) NOT NULL,
	`score` float NOT NULL,
	`source` varchar(160) NOT NULL,
	`evaluator` varchar(120) NOT NULL,
	`confidence` float NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `skill_evidence_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `skill_shot_attempts` (
	`id` varchar(36) NOT NULL,
	`skill_shot_id` varchar(36) NOT NULL,
	`learner_id` varchar(36) NOT NULL,
	`status` enum('started','submitted','evaluated','abandoned') NOT NULL DEFAULT 'started',
	`progress` float NOT NULL DEFAULT 0,
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` datetime,
	CONSTRAINT `skill_shot_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `skill_shots` (
	`id` varchar(36) NOT NULL,
	`skill_id` varchar(36) NOT NULL,
	`title` varchar(220) NOT NULL,
	`slug` varchar(190) NOT NULL,
	`learning_objective` text NOT NULL,
	`format` varchar(64) NOT NULL,
	`duration_minutes` int NOT NULL,
	`content` json NOT NULL,
	`provenance_summary` text,
	`status` enum('draft','active','completed','archived') NOT NULL DEFAULT 'draft',
	`published_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `skill_shots_id` PRIMARY KEY(`id`),
	CONSTRAINT `skill_shots_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `agent_decisions` (
	`id` varchar(36) NOT NULL,
	`run_id` varchar(36) NOT NULL,
	`decision` varchar(160) NOT NULL,
	`rationale` text NOT NULL,
	`confidence` varchar(32) NOT NULL,
	`requires_approval` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_decisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_runs` (
	`id` varchar(36) NOT NULL,
	`conversation_id` varchar(36),
	`agent_name` varchar(120) NOT NULL,
	`agent_version` varchar(64) NOT NULL,
	`provider` varchar(64) NOT NULL,
	`model` varchar(120) NOT NULL,
	`status` enum('started','succeeded','failed','escalated') NOT NULL DEFAULT 'started',
	`input` json NOT NULL,
	`output` json,
	`error` text,
	`input_tokens` int,
	`output_tokens` int,
	`cost_micros` int NOT NULL DEFAULT 0,
	`latency_ms` int,
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` datetime,
	CONSTRAINT `agent_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_conversations` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36),
	`channel` varchar(32) NOT NULL,
	`context` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36),
	`actor_id` varchar(36),
	`action` varchar(120) NOT NULL,
	`resource_type` varchar(120) NOT NULL,
	`resource_id` varchar(160),
	`metadata` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `magic_links` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`token_hash` varchar(128) NOT NULL,
	`resource_type` varchar(80) NOT NULL,
	`resource_id` varchar(160) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`consumed_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `magic_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `magic_links_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `notification_consent` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`channel` enum('whatsapp','email','web_push') NOT NULL,
	`destination` varchar(254) NOT NULL,
	`consented_at` timestamp NOT NULL,
	`source` varchar(120) NOT NULL,
	`opted_out_at` datetime,
	CONSTRAINT `notification_consent_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notification_outbox` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`channel` enum('whatsapp','email','web_push') NOT NULL,
	`template_key` varchar(160) NOT NULL,
	`payload` json NOT NULL,
	`idempotency_key` varchar(190) NOT NULL,
	`status` enum('pending','processing','sent','failed','cancelled') NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`scheduled_for` timestamp NOT NULL,
	`sent_at` datetime,
	`last_error` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notification_outbox_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_outbox_idempotency_key_unique` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`endpoint` varchar(1024) NOT NULL,
	`public_key` varchar(255) NOT NULL,
	`auth_secret` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`revoked_at` datetime,
	CONSTRAINT `push_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `push_subscriptions_endpoint_unique` UNIQUE(`endpoint`)
);
--> statement-breakpoint
ALTER TABLE `content_extractions` ADD CONSTRAINT `content_extractions_source_asset_id_source_assets_id_fk` FOREIGN KEY (`source_asset_id`) REFERENCES `source_assets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_extractions` ADD CONSTRAINT `content_extractions_skill_id_skills_id_fk` FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_provenance` ADD CONSTRAINT `content_provenance_skill_shot_id_skill_shots_id_fk` FOREIGN KEY (`skill_shot_id`) REFERENCES `skill_shots`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_provenance` ADD CONSTRAINT `content_provenance_source_asset_id_source_assets_id_fk` FOREIGN KEY (`source_asset_id`) REFERENCES `source_assets`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_provenance` ADD CONSTRAINT `content_provenance_extraction_id_content_extractions_id_fk` FOREIGN KEY (`extraction_id`) REFERENCES `content_extractions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_reviews` ADD CONSTRAINT `content_reviews_skill_shot_id_skill_shots_id_fk` FOREIGN KEY (`skill_shot_id`) REFERENCES `skill_shots`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_reviews` ADD CONSTRAINT `content_reviews_reviewer_id_users_id_fk` FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `source_assets` ADD CONSTRAINT `source_assets_contributor_id_users_id_fk` FOREIGN KEY (`contributor_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `learner_profiles` ADD CONSTRAINT `learner_profiles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `learner_skills` ADD CONSTRAINT `learner_skills_learner_id_users_id_fk` FOREIGN KEY (`learner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `learner_skills` ADD CONSTRAINT `learner_skills_skill_id_skills_id_fk` FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_skills` ADD CONSTRAINT `role_skills_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_skills` ADD CONSTRAINT `role_skills_skill_id_skills_id_fk` FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `skill_relationships` ADD CONSTRAINT `skill_relationships_source_skill_id_skills_id_fk` FOREIGN KEY (`source_skill_id`) REFERENCES `skills`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `skill_relationships` ADD CONSTRAINT `skill_relationships_target_skill_id_skills_id_fk` FOREIGN KEY (`target_skill_id`) REFERENCES `skills`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_sessions` ADD CONSTRAINT `user_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessment_attempts` ADD CONSTRAINT `assessment_attempts_assessment_id_assessments_id_fk` FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessment_attempts` ADD CONSTRAINT `assessment_attempts_learner_id_users_id_fk` FOREIGN KEY (`learner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessment_questions` ADD CONSTRAINT `assessment_questions_assessment_id_assessments_id_fk` FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessment_questions` ADD CONSTRAINT `assessment_questions_skill_id_skills_id_fk` FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessment_responses` ADD CONSTRAINT `assessment_responses_attempt_id_assessment_attempts_id_fk` FOREIGN KEY (`attempt_id`) REFERENCES `assessment_attempts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessment_responses` ADD CONSTRAINT `assessment_responses_question_id_assessment_questions_id_fk` FOREIGN KEY (`question_id`) REFERENCES `assessment_questions`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `goal_skills` ADD CONSTRAINT `goal_skills_goal_id_goals_id_fk` FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `goal_skills` ADD CONSTRAINT `goal_skills_skill_id_skills_id_fk` FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `goals` ADD CONSTRAINT `goals_learner_id_users_id_fk` FOREIGN KEY (`learner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `goals` ADD CONSTRAINT `goals_target_role_id_roles_id_fk` FOREIGN KEY (`target_role_id`) REFERENCES `roles`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journey_steps` ADD CONSTRAINT `journey_steps_journey_id_learning_journeys_id_fk` FOREIGN KEY (`journey_id`) REFERENCES `learning_journeys`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journey_steps` ADD CONSTRAINT `journey_steps_skill_id_skills_id_fk` FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journey_steps` ADD CONSTRAINT `journey_steps_skill_shot_id_skill_shots_id_fk` FOREIGN KEY (`skill_shot_id`) REFERENCES `skill_shots`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `learning_journeys` ADD CONSTRAINT `learning_journeys_learner_id_users_id_fk` FOREIGN KEY (`learner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `learning_journeys` ADD CONSTRAINT `learning_journeys_goal_id_goals_id_fk` FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `practice_sessions` ADD CONSTRAINT `practice_sessions_learner_id_users_id_fk` FOREIGN KEY (`learner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `practice_sessions` ADD CONSTRAINT `practice_sessions_skill_id_skills_id_fk` FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `practice_sessions` ADD CONSTRAINT `practice_sessions_skill_shot_id_skill_shots_id_fk` FOREIGN KEY (`skill_shot_id`) REFERENCES `skill_shots`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `skill_evidence` ADD CONSTRAINT `skill_evidence_learner_id_users_id_fk` FOREIGN KEY (`learner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `skill_evidence` ADD CONSTRAINT `skill_evidence_skill_id_skills_id_fk` FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `skill_shot_attempts` ADD CONSTRAINT `skill_shot_attempts_skill_shot_id_skill_shots_id_fk` FOREIGN KEY (`skill_shot_id`) REFERENCES `skill_shots`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `skill_shot_attempts` ADD CONSTRAINT `skill_shot_attempts_learner_id_users_id_fk` FOREIGN KEY (`learner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `skill_shots` ADD CONSTRAINT `skill_shots_skill_id_skills_id_fk` FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_decisions` ADD CONSTRAINT `agent_decisions_run_id_agent_runs_id_fk` FOREIGN KEY (`run_id`) REFERENCES `agent_runs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_runs` ADD CONSTRAINT `agent_runs_conversation_id_ai_conversations_id_fk` FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_conversations` ADD CONSTRAINT `ai_conversations_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_id_users_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `magic_links` ADD CONSTRAINT `magic_links_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification_consent` ADD CONSTRAINT `notification_consent_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification_outbox` ADD CONSTRAINT `notification_outbox_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `push_subscriptions` ADD CONSTRAINT `push_subscriptions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;