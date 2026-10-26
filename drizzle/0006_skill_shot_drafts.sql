CREATE TABLE `skill_shot_drafts` (
	`id` varchar(36) NOT NULL,
	`slug` varchar(80) NOT NULL,
	`title` varchar(200) NOT NULL,
	`status` enum('designing','failed','draft','in_review','approved','published','retired') NOT NULL DEFAULT 'draft',
	`blueprint` json NOT NULL,
	`review` json NOT NULL,
	`brief` json,
	`notes` json,
	`source` varchar(16) NOT NULL DEFAULT 'scaffold',
	`created_by` varchar(36) NOT NULL,
	`approved_by` varchar(36),
	`published_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `skill_shot_drafts_id` PRIMARY KEY(`id`),
	CONSTRAINT `skill_shot_drafts_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE INDEX `skill_shot_drafts_status_idx` ON `skill_shot_drafts` (`status`);