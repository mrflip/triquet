CREATE TABLE `answerings` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`player_label` text NOT NULL,
	`textkind` text NOT NULL,
	`asked_text` text,
	`status` text NOT NULL,
	`answer_text` text,
	`items` text,
	`message` text,
	`truncated` integer NOT NULL,
	`model_tier_applied` text,
	`approx_tokens` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_label`) REFERENCES `players`(`label`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `answerings_question_idx` ON `answerings` (`question_id`,`player_label`,`textkind`,`created_at`);--> statement-breakpoint
CREATE TABLE `players` (
	`label` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`blurb` text NOT NULL,
	`model_tier` text NOT NULL,
	`max_tokens` integer NOT NULL,
	`prompts` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`position` integer NOT NULL,
	`label` text NOT NULL,
	`forced_label` text,
	`title` text NOT NULL,
	`qnum` text NOT NULL,
	`clueing` text NOT NULL,
	`hint` text NOT NULL,
	`chains_to` text,
	`full_answer` text NOT NULL,
	`alt_text` text NOT NULL,
	`notes` text NOT NULL,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `questions_quiz_idx` ON `questions` (`quiz_id`,`position`);--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`title` text NOT NULL,
	`label` text NOT NULL,
	`forced_label` text,
	`version` text NOT NULL,
	`locked` integer NOT NULL,
	`last_sortkey` text,
	`bulk_ishes_last` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quizzes_workspace_idx` ON `quizzes` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`active_quiz_id` text,
	`created_at` integer NOT NULL
);
