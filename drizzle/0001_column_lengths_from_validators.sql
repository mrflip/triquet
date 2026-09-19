PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_answerings` (
	`id` text(26) PRIMARY KEY NOT NULL,
	`question_id` text(26) NOT NULL,
	`player_label` text(40) NOT NULL,
	`textkind` text NOT NULL,
	`asked_text` text(3600),
	`status` text NOT NULL,
	`answer_text` text(3600),
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
INSERT INTO `__new_answerings`("id", "question_id", "player_label", "textkind", "asked_text", "status", "answer_text", "items", "message", "truncated", "model_tier_applied", "approx_tokens", "created_at") SELECT "id", "question_id", "player_label", "textkind", "asked_text", "status", "answer_text", "items", "message", "truncated", "model_tier_applied", "approx_tokens", "created_at" FROM `answerings`;--> statement-breakpoint
DROP TABLE `answerings`;--> statement-breakpoint
ALTER TABLE `__new_answerings` RENAME TO `answerings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `answerings_question_idx` ON `answerings` (`question_id`,`player_label`,`textkind`,`created_at`);--> statement-breakpoint
CREATE TABLE `__new_players` (
	`label` text(40) PRIMARY KEY NOT NULL,
	`title` text(82) NOT NULL,
	`blurb` text(3600) NOT NULL,
	`model_tier` text NOT NULL,
	`max_tokens` integer NOT NULL,
	`prompts` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_players`("label", "title", "blurb", "model_tier", "max_tokens", "prompts") SELECT "label", "title", "blurb", "model_tier", "max_tokens", "prompts" FROM `players`;--> statement-breakpoint
DROP TABLE `players`;--> statement-breakpoint
ALTER TABLE `__new_players` RENAME TO `players`;--> statement-breakpoint
CREATE TABLE `__new_questions` (
	`id` text(26) PRIMARY KEY NOT NULL,
	`quiz_id` text(26) NOT NULL,
	`position` integer NOT NULL,
	`label` text(40) NOT NULL,
	`forced_label` text(40),
	`title` text(82) NOT NULL,
	`qnum` text NOT NULL,
	`clueing` text(3600) NOT NULL,
	`hint` text(3600) NOT NULL,
	`chains_to` text(26),
	`full_answer` text(3600) NOT NULL,
	`alt_text` text(3600) NOT NULL,
	`notes` text(3600) NOT NULL,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_questions`("id", "quiz_id", "position", "label", "forced_label", "title", "qnum", "clueing", "hint", "chains_to", "full_answer", "alt_text", "notes") SELECT "id", "quiz_id", "position", "label", "forced_label", "title", "qnum", "clueing", "hint", "chains_to", "full_answer", "alt_text", "notes" FROM `questions`;--> statement-breakpoint
DROP TABLE `questions`;--> statement-breakpoint
ALTER TABLE `__new_questions` RENAME TO `questions`;--> statement-breakpoint
CREATE INDEX `questions_quiz_idx` ON `questions` (`quiz_id`,`position`);--> statement-breakpoint
CREATE TABLE `__new_quizzes` (
	`id` text(26) PRIMARY KEY NOT NULL,
	`workspace_id` text(26) NOT NULL,
	`title` text(82) NOT NULL,
	`label` text(40) NOT NULL,
	`forced_label` text(40),
	`version` text(40) NOT NULL,
	`locked` integer NOT NULL,
	`last_sortkey` text,
	`bulk_ishes_last` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_quizzes`("id", "workspace_id", "title", "label", "forced_label", "version", "locked", "last_sortkey", "bulk_ishes_last") SELECT "id", "workspace_id", "title", "label", "forced_label", "version", "locked", "last_sortkey", "bulk_ishes_last" FROM `quizzes`;--> statement-breakpoint
DROP TABLE `quizzes`;--> statement-breakpoint
ALTER TABLE `__new_quizzes` RENAME TO `quizzes`;--> statement-breakpoint
CREATE INDEX `quizzes_workspace_idx` ON `quizzes` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `__new_workspaces` (
	`id` text(26) PRIMARY KEY NOT NULL,
	`active_quiz_id` text(26),
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_workspaces`("id", "active_quiz_id", "created_at") SELECT "id", "active_quiz_id", "created_at" FROM `workspaces`;--> statement-breakpoint
DROP TABLE `workspaces`;--> statement-breakpoint
ALTER TABLE `__new_workspaces` RENAME TO `workspaces`;