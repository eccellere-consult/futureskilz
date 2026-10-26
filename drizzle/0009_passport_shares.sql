CREATE TABLE `passport_shares` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`label` varchar(120) NOT NULL DEFAULT '',
	`include` json NOT NULL,
	`expires_at` datetime NOT NULL,
	`revoked_at` datetime,
	`views` int NOT NULL DEFAULT 0,
	`last_viewed_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `passport_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `passport_shares_token_idx` UNIQUE(`token_hash`)
);
--> statement-breakpoint
ALTER TABLE `passport_shares` ADD CONSTRAINT `passport_shares_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `passport_shares_user_idx` ON `passport_shares` (`user_id`,`created_at`);