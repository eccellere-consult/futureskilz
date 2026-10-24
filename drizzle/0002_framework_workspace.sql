CREATE TABLE `agent_skills` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agent_slug` varchar(100) NOT NULL,
	`name` varchar(150) NOT NULL,
	`skill_content` longtext,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_skills_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_skills_agent_slug_unique` UNIQUE(`agent_slug`)
);
--> statement-breakpoint
CREATE TABLE `ws_cases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`client_id` varchar(36) NOT NULL,
	`section` varchar(40) NOT NULL,
	`title` varchar(200) NOT NULL,
	`brief` text,
	`status` enum('open','solved','archived') NOT NULL DEFAULT 'open',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ws_cases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ws_fillins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`client_id` varchar(36) NOT NULL,
	`section` varchar(40) NOT NULL,
	`case_id` int NOT NULL DEFAULT 0,
	`tool_id` varchar(80) NOT NULL,
	`fields` json NOT NULL,
	`recommendations` json,
	`actionables` json,
	`analysis` json,
	`analysis_fingerprint` varchar(32),
	`analysis_at` datetime,
	`previous_fields` json,
	`previous_reason` varchar(16),
	`version` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ws_fillins_id` PRIMARY KEY(`id`),
	CONSTRAINT `ws_fillins_scope_idx` UNIQUE(`client_id`,`section`,`case_id`,`tool_id`)
);
--> statement-breakpoint
CREATE TABLE `ws_tools` (
	`id` int AUTO_INCREMENT NOT NULL,
	`section` varchar(40) NOT NULL,
	`tool_id` varchar(80) NOT NULL,
	`name` varchar(200) NOT NULL,
	`facets` json NOT NULL,
	`does` text,
	`when_to_use` text,
	`when_not_to_use` text,
	`next_step` text,
	`fields` json NOT NULL,
	`upstream_tools` json,
	`downstream_tools` json,
	`definition` json,
	`source` json,
	`status` enum('draft','needs_review','in_review','published','deprecated') NOT NULL DEFAULT 'draft',
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ws_tools_id` PRIMARY KEY(`id`),
	CONSTRAINT `ws_tools_section_tool_idx` UNIQUE(`section`,`tool_id`)
);
--> statement-breakpoint
ALTER TABLE `ws_cases` ADD CONSTRAINT `ws_cases_client_id_users_id_fk` FOREIGN KEY (`client_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ws_fillins` ADD CONSTRAINT `ws_fillins_client_id_users_id_fk` FOREIGN KEY (`client_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ws_cases_client_section_idx` ON `ws_cases` (`client_id`,`section`,`status`);--> statement-breakpoint
CREATE INDEX `ws_fillins_case_idx` ON `ws_fillins` (`client_id`,`section`,`case_id`);--> statement-breakpoint
CREATE INDEX `ws_tools_section_status_idx` ON `ws_tools` (`section`,`status`);