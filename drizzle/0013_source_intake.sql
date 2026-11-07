ALTER TABLE `kc_projects` ADD `kind` varchar(16) DEFAULT 'interview' NOT NULL;--> statement-breakpoint
ALTER TABLE `kc_uploads` ADD `source_kind` varchar(24);--> statement-breakpoint
ALTER TABLE `kc_uploads` ADD `source_url` varchar(500);--> statement-breakpoint
ALTER TABLE `kc_uploads` ADD `attested_at` datetime;--> statement-breakpoint
ALTER TABLE `kc_uploads` ADD `attestation_version` varchar(24);