CREATE TABLE `coach_messages` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`skill_shot_id` varchar(80) NOT NULL,
	`kind` enum('question','practice') NOT NULL DEFAULT 'question',
	`message` text NOT NULL,
	`reply` text NOT NULL,
	`source` varchar(12) NOT NULL,
	`flag` varchar(16),
	`payload` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coach_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coach_messages` ADD CONSTRAINT `coach_messages_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `coach_messages_user_idx` ON `coach_messages` (`user_id`,`skill_shot_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `coach_messages_flag_idx` ON `coach_messages` (`flag`,`created_at`);