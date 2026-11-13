CREATE TABLE `media_jobs` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`filename` varchar(255) NOT NULL,
	`size` int NOT NULL,
	`checksum` varchar(64) NOT NULL,
	`offset_seconds` int NOT NULL DEFAULT 0,
	`status` enum('queued','working','done','failed') NOT NULL DEFAULT 'queued',
	`note` varchar(500),
	`upload_id` varchar(36),
	`consent_at` datetime NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `media_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `media_jobs` ADD CONSTRAINT `media_jobs_project_id_kc_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `kc_projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `media_jobs` ADD CONSTRAINT `media_jobs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `media_jobs_project_idx` ON `media_jobs` (`project_id`,`created_at`);