CREATE TABLE `book_projects` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`contributor_id` varchar(36) NOT NULL,
	`status` enum('writing','ready','failed','approved') NOT NULL DEFAULT 'writing',
	`step` varchar(120) NOT NULL DEFAULT '',
	`book` json,
	`source` varchar(16) NOT NULL DEFAULT 'outline',
	`page_count` int,
	`interior_pdf` longtext,
	`cover_pdf` longtext,
	`cover_art` longtext,
	`error` text,
	`approved_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `book_projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `book_projects_project_idx` UNIQUE(`project_id`)
);
--> statement-breakpoint
ALTER TABLE `book_projects` ADD CONSTRAINT `book_projects_project_id_kc_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `kc_projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `book_projects` ADD CONSTRAINT `book_projects_contributor_id_users_id_fk` FOREIGN KEY (`contributor_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `book_projects_contributor_idx` ON `book_projects` (`contributor_id`,`updated_at`);