CREATE TABLE `playings` (
	`id` text(26) PRIMARY KEY NOT NULL,
	`question_id` text(26) NOT NULL,
	`player_label` text(40) NOT NULL,
	`textkind` text NOT NULL,
	`asked_text` text(3600),
	`status` text NOT NULL,
	`reply_text` text(3600),
	`items` text,
	`message` text(3600),
	`truncated` integer NOT NULL,
	`model_tier_applied` text,
	`approx_tokens` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_label`) REFERENCES `players`(`label`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `playings_question_idx` ON `playings` (`question_id`,`player_label`,`textkind`,`created_at`);