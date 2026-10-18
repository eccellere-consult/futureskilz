ALTER TABLE `learner_profiles` ADD `responsibility_level` varchar(32);--> statement-breakpoint
ALTER TABLE `learner_profiles` ADD `focus` varchar(64);--> statement-breakpoint
ALTER TABLE `learner_profiles` ADD `horizon` varchar(32);--> statement-breakpoint
ALTER TABLE `learner_profiles` ADD `challenge_type` varchar(64);--> statement-breakpoint
ALTER TABLE `learner_profiles` ADD `challenge` text;--> statement-breakpoint
ALTER TABLE `learner_profiles` ADD `priority_families` json;--> statement-breakpoint
ALTER TABLE `learner_profiles` ADD `welcome_summary` text;--> statement-breakpoint
ALTER TABLE `learner_profiles` ADD `welcome_summary_source` varchar(16);--> statement-breakpoint
ALTER TABLE `magic_links` ADD `payload` json;