CREATE TABLE `user_credentials` (
	`user_id` varchar(36) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`failed_attempts` int NOT NULL DEFAULT 0,
	`locked_until` datetime,
	`set_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_credentials_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
ALTER TABLE `user_credentials` ADD CONSTRAINT `user_credentials_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;