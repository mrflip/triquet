CREATE TABLE `expressings` (
	`quiz_id` text(26) NOT NULL,
	`label` text(40) NOT NULL,
	`expression_label` text(40) NOT NULL,
	`title` text(82) NOT NULL,
	`shape` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`quiz_id`, `label`),
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `expressions` (
	`workspace_id` text(26) NOT NULL,
	`owner` text(40) NOT NULL,
	`label` text(40) NOT NULL,
	`formula` text(999) NOT NULL,
	`description` text(3600) NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`workspace_id`, `owner`, `label`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
UPDATE `quizzes` SET `last_sortkey` = 'expressing:' || `last_sortkey` WHERE `last_sortkey` IN ('clueing_plus_rank', 'clueing_full', 'clueing_numeral', 'butnot_full', 'butnot_numeral', 'hint_full', 'hint_numeral', 'clueing_plus_butnot_full');
