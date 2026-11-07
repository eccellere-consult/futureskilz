CREATE TABLE `learner_pathway` (
	`user_id` varchar(36) NOT NULL,
	`target_role` varchar(60) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `learner_pathway_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
ALTER TABLE `learner_pathway` ADD CONSTRAINT `learner_pathway_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;