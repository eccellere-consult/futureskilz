CREATE TABLE `learner_diagnostic` (
	`user_id` varchar(36) NOT NULL,
	`answers` json NOT NULL,
	`completed_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `learner_diagnostic_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
ALTER TABLE `learner_diagnostic` ADD CONSTRAINT `learner_diagnostic_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;