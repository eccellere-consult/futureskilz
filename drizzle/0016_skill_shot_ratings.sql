CREATE TABLE `skill_shot_ratings` (
	`id` varchar(36) NOT NULL,
	`slug` varchar(80) NOT NULL,
	`learner_ref` varchar(64) NOT NULL,
	`rating` int NOT NULL,
	`comment` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `skill_shot_ratings_id` PRIMARY KEY(`id`),
	CONSTRAINT `skill_shot_ratings_learner_idx` UNIQUE(`slug`,`learner_ref`)
);
