CREATE TABLE `entitlements` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`plan_id` varchar(36) NOT NULL,
	`starts_at` datetime NOT NULL,
	`ends_at` datetime NOT NULL,
	`status` enum('active','revoked') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `entitlements_id` PRIMARY KEY(`id`),
	CONSTRAINT `entitlements_order_idx` UNIQUE(`order_id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`number` varchar(16) NOT NULL,
	`financial_year` varchar(5) NOT NULL,
	`issued_at` datetime NOT NULL,
	`customer_name` varchar(160) NOT NULL,
	`customer_email` varchar(254) NOT NULL,
	`customer_state` varchar(2) NOT NULL,
	`customer_gstin` varchar(15),
	`description` varchar(240) NOT NULL,
	`rate_bp` int NOT NULL,
	`taxable_minor` bigint NOT NULL,
	`cgst_minor` bigint NOT NULL DEFAULT 0,
	`sgst_minor` bigint NOT NULL DEFAULT 0,
	`igst_minor` bigint NOT NULL DEFAULT 0,
	`total_minor` bigint NOT NULL,
	`currency` varchar(3) NOT NULL,
	`supplier` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_order_idx` UNIQUE(`order_id`),
	CONSTRAINT `invoices_number_idx` UNIQUE(`number`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`plan_id` varchar(36) NOT NULL,
	`campaign_id` varchar(36),
	`list_minor` bigint NOT NULL,
	`discount_minor` bigint NOT NULL DEFAULT 0,
	`amount_minor` bigint NOT NULL,
	`refunded_minor` bigint NOT NULL DEFAULT 0,
	`currency` varchar(3) NOT NULL,
	`status` enum('created','paid','failed','refunded') NOT NULL DEFAULT 'created',
	`provider` varchar(16) NOT NULL,
	`provider_order_id` varchar(80) NOT NULL,
	`provider_payment_id` varchar(80),
	`customer_state` varchar(2) NOT NULL,
	`customer_gstin` varchar(15),
	`paid_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_provider_order_idx` UNIQUE(`provider`,`provider_order_id`)
);
--> statement-breakpoint
CREATE TABLE `payment_events` (
	`id` varchar(36) NOT NULL,
	`provider` varchar(16) NOT NULL,
	`event_id` varchar(120) NOT NULL,
	`type` varchar(60) NOT NULL,
	`outcome` varchar(120) NOT NULL DEFAULT '',
	`received_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_events_event_idx` UNIQUE(`provider`,`event_id`)
);
--> statement-breakpoint
CREATE TABLE `payouts` (
	`id` varchar(36) NOT NULL,
	`statement_id` varchar(36) NOT NULL,
	`contributor_id` varchar(36) NOT NULL,
	`amount_minor` bigint NOT NULL,
	`currency` varchar(3) NOT NULL,
	`status` enum('queued','paid','failed') NOT NULL DEFAULT 'queued',
	`provider` varchar(16) NOT NULL DEFAULT 'manual',
	`reference` varchar(120),
	`note` text,
	`created_by` varchar(36),
	`paid_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payouts_id` PRIMARY KEY(`id`),
	CONSTRAINT `payouts_statement_idx` UNIQUE(`statement_id`)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` varchar(36) NOT NULL,
	`code` varchar(40) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` varchar(400) NOT NULL DEFAULT '',
	`amount_minor` bigint NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'INR',
	`duration_days` int NOT NULL,
	`active` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `plans_code_idx` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `entitlements` ADD CONSTRAINT `entitlements_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `entitlements` ADD CONSTRAINT `entitlements_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `entitlements` ADD CONSTRAINT `entitlements_plan_id_plans_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_plan_id_plans_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payouts` ADD CONSTRAINT `payouts_statement_id_kc_statements_id_fk` FOREIGN KEY (`statement_id`) REFERENCES `kc_statements`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payouts` ADD CONSTRAINT `payouts_contributor_id_users_id_fk` FOREIGN KEY (`contributor_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `entitlements_user_idx` ON `entitlements` (`user_id`,`ends_at`);--> statement-breakpoint
CREATE INDEX `orders_user_idx` ON `orders` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `payouts_status_idx` ON `payouts` (`status`,`created_at`);