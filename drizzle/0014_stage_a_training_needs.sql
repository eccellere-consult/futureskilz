CREATE TABLE `tna_programs` (
	`id` varchar(36) NOT NULL,
	`owner_id` varchar(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`topic` varchar(300) NOT NULL,
	`audience` json NOT NULL,
	`goal` text,
	`constraints` json,
	`needs` json,
	`status` enum('draft','reviewing','approved') NOT NULL DEFAULT 'draft',
	`source` varchar(16) NOT NULL DEFAULT 'scaffold',
	`notes` json,
	`working` varchar(16),
	`working_since` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tna_programs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tna_topics` (
	`id` varchar(36) NOT NULL,
	`program_id` varchar(36) NOT NULL,
	`parent_id` varchar(36),
	`position` int NOT NULL DEFAULT 0,
	`title` varchar(200) NOT NULL,
	`summary` text,
	`target_level` double,
	`skill_slugs` json,
	`need_ids` json,
	`prerequisites` json,
	`material_hint` text,
	`evidence_signal` text,
	`minutes` int,
	`status` enum('proposed','approved','rejected') NOT NULL DEFAULT 'proposed',
	`origin` enum('ai','person') NOT NULL DEFAULT 'ai',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tna_topics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tna_programs` ADD CONSTRAINT `tna_programs_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tna_topics` ADD CONSTRAINT `tna_topics_program_id_tna_programs_id_fk` FOREIGN KEY (`program_id`) REFERENCES `tna_programs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `tna_programs_owner_idx` ON `tna_programs` (`owner_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `tna_topics_program_idx` ON `tna_topics` (`program_id`,`parent_id`,`position`);