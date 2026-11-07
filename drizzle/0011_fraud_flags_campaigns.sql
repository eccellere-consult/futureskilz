CREATE TABLE `campaigns` (
	`id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`kind` enum('discount','free_access','featured') NOT NULL,
	`code` varchar(40),
	`percent_off_bp` int NOT NULL DEFAULT 0,
	`extra_free_per_pillar` int NOT NULL DEFAULT 0,
	`starts_at` datetime NOT NULL,
	`ends_at` datetime NOT NULL,
	`max_redemptions` int,
	`redemptions` int NOT NULL DEFAULT 0,
	`status` enum('draft','active','paused','ended') NOT NULL DEFAULT 'draft',
	`notes` text,
	`created_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`),
	CONSTRAINT `campaigns_code_idx` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `fraud_flags` (
	`id` varchar(36) NOT NULL,
	`subject_type` enum('learner','lesson','receipt') NOT NULL,
	`subject_ref` varchar(80) NOT NULL,
	`rule` varchar(40) NOT NULL,
	`severity` enum('low','medium','high') NOT NULL,
	`window_key` varchar(40) NOT NULL DEFAULT 'all',
	`summary` varchar(240) NOT NULL,
	`details` json,
	`status` enum('open','confirmed','dismissed') NOT NULL DEFAULT 'open',
	`reviewed_by` varchar(36),
	`reviewed_at` datetime,
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fraud_flags_id` PRIMARY KEY(`id`),
	CONSTRAINT `fraud_flags_subject_idx` UNIQUE(`subject_type`,`subject_ref`,`rule`,`window_key`)
);
--> statement-breakpoint
CREATE INDEX `campaigns_status_idx` ON `campaigns` (`status`,`ends_at`);--> statement-breakpoint
CREATE INDEX `fraud_flags_status_idx` ON `fraud_flags` (`status`,`created_at`);