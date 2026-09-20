CREATE TABLE `columns` (
	`quiz_id` text(26) NOT NULL,
	`label` text(40) NOT NULL,
	`title` text(82) NOT NULL,
	`source` text(70) NOT NULL,
	`width_px` integer NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`quiz_id`, `label`),
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `widgets` (
	`quiz_id` text(26) NOT NULL,
	`label` text(40) NOT NULL,
	`kind` text NOT NULL,
	`expression_label` text(40),
	`player_label` text(40),
	`textkind` text,
	`description` text(3600) NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`quiz_id`, `label`),
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- Data: a quiz's expressings become widgets and columns, and every quiz gains the playing widgets and the fixed columns the grid always had.
INSERT INTO `expressings` (`quiz_id`, `label`, `expression_label`, `title`, `description`, `shape`, `position`)
SELECT q.`id`, v.`label`, v.`label`, v.`title`, '', 'skinny', v.`pos` FROM `quizzes` q CROSS JOIN (
  SELECT 'clueing_plus_rank' AS `label`, 'Clueing + Rank' AS `title`, 0 AS `pos`
  UNION ALL SELECT 'clueing_full' AS `label`, 'Clueing Full Sum' AS `title`, 1 AS `pos`
  UNION ALL SELECT 'clueing_numeral' AS `label`, 'Clueing Numeral Sum' AS `title`, 2 AS `pos`
  UNION ALL SELECT 'butnot_full' AS `label`, 'BUT NOT Full Sum' AS `title`, 3 AS `pos`
  UNION ALL SELECT 'butnot_numeral' AS `label`, 'BUT NOT Numeral Sum' AS `title`, 4 AS `pos`
  UNION ALL SELECT 'hint_full' AS `label`, 'Hint Full Sum' AS `title`, 5 AS `pos`
  UNION ALL SELECT 'hint_numeral' AS `label`, 'Hint Numeral Sum' AS `title`, 6 AS `pos`
  UNION ALL SELECT 'clueing_plus_butnot_full' AS `label`, 'Clueing+BUT NOT Full' AS `title`, 7 AS `pos`
) v WHERE NOT EXISTS (SELECT 1 FROM `expressings` e WHERE e.`quiz_id` = q.`id`);
--> statement-breakpoint
INSERT INTO `widgets` (`quiz_id`, `label`, `kind`, `expression_label`, `player_label`, `textkind`, `description`, `position`)
SELECT `id`, 'dumdum', 'playing', NULL, 'dumdum', 'clueing', '', 0 FROM `quizzes`;
--> statement-breakpoint
INSERT INTO `widgets` (`quiz_id`, `label`, `kind`, `expression_label`, `player_label`, `textkind`, `description`, `position`)
SELECT `id`, 'numnum_clueing', 'playing', NULL, 'numnum', 'clueing', '', 1 FROM `quizzes`;
--> statement-breakpoint
INSERT INTO `widgets` (`quiz_id`, `label`, `kind`, `expression_label`, `player_label`, `textkind`, `description`, `position`)
SELECT `id`, 'numnum_hint', 'playing', NULL, 'numnum', 'hint', '', 2 FROM `quizzes`;
--> statement-breakpoint
INSERT INTO `widgets` (`quiz_id`, `label`, `kind`, `expression_label`, `player_label`, `textkind`, `description`, `position`)
SELECT `quiz_id`, `label`, 'expressing', `expression_label`, NULL, NULL, `description`, 3 + `position` FROM `expressings`;
--> statement-breakpoint
INSERT INTO `columns` (`quiz_id`, `label`, `title`, `source`, `width_px`, `position`)
SELECT `id`, 'title', 'Title', 'question.title', 100, 0 FROM `quizzes`;
--> statement-breakpoint
INSERT INTO `columns` (`quiz_id`, `label`, `title`, `source`, `width_px`, `position`)
SELECT `id`, 'clueing', 'Clueing', 'question.clueing', 330, 1 FROM `quizzes`;
--> statement-breakpoint
INSERT INTO `columns` (`quiz_id`, `label`, `title`, `source`, `width_px`, `position`)
SELECT `id`, 'hint', 'Hint', 'question.hint', 330, 2 FROM `quizzes`;
--> statement-breakpoint
INSERT INTO `columns` (`quiz_id`, `label`, `title`, `source`, `width_px`, `position`)
SELECT `id`, 'chains_to', 'Chains to', 'question.chains_to', 120, 3 FROM `quizzes`;
--> statement-breakpoint
INSERT INTO `columns` (`quiz_id`, `label`, `title`, `source`, `width_px`, `position`)
SELECT `id`, 'butnot', 'BUT NOT', 'question.butnot', 180, 4 FROM `quizzes`;
--> statement-breakpoint
INSERT INTO `columns` (`quiz_id`, `label`, `title`, `source`, `width_px`, `position`)
SELECT `id`, 'qnum', 'Q#', 'question.qnum', 60, 5 FROM `quizzes`;
--> statement-breakpoint
INSERT INTO `columns` (`quiz_id`, `label`, `title`, `source`, `width_px`, `position`)
SELECT `quiz_id`, `label`, `title`, `label`, CASE `shape` WHEN 'skinny' THEN 78 ELSE 180 END, 6 + `position` FROM `expressings`;
--> statement-breakpoint
INSERT INTO `columns` (`quiz_id`, `label`, `title`, `source`, `width_px`, `position`)
SELECT q.`id`, 'alt_text', 'Alt Text', 'question.alt_text', 220, 6 + (SELECT count(*) FROM `expressings` e WHERE e.`quiz_id` = q.`id`) + 0 FROM `quizzes` q;
--> statement-breakpoint
INSERT INTO `columns` (`quiz_id`, `label`, `title`, `source`, `width_px`, `position`)
SELECT q.`id`, 'notes', 'Notes', 'question.notes', 220, 6 + (SELECT count(*) FROM `expressings` e WHERE e.`quiz_id` = q.`id`) + 1 FROM `quizzes` q;
--> statement-breakpoint
INSERT INTO `columns` (`quiz_id`, `label`, `title`, `source`, `width_px`, `position`)
SELECT q.`id`, 'full_answer', 'Full Answer', 'question.full_answer', 220, 6 + (SELECT count(*) FROM `expressings` e WHERE e.`quiz_id` = q.`id`) + 2 FROM `quizzes` q;
--> statement-breakpoint
INSERT INTO `columns` (`quiz_id`, `label`, `title`, `source`, `width_px`, `position`)
SELECT q.`id`, 'clueing_ishes', 'Clueing ishes', 'numnum_clueing', 170, 6 + (SELECT count(*) FROM `expressings` e WHERE e.`quiz_id` = q.`id`) + 3 FROM `quizzes` q;
--> statement-breakpoint
INSERT INTO `columns` (`quiz_id`, `label`, `title`, `source`, `width_px`, `position`)
SELECT q.`id`, 'butnot_ishes', 'BUT NOT ishes', 'question.butnot_ishes', 170, 6 + (SELECT count(*) FROM `expressings` e WHERE e.`quiz_id` = q.`id`) + 4 FROM `quizzes` q;
--> statement-breakpoint
INSERT INTO `columns` (`quiz_id`, `label`, `title`, `source`, `width_px`, `position`)
SELECT q.`id`, 'hint_ishes', 'Hint Ishes', 'numnum_hint', 170, 6 + (SELECT count(*) FROM `expressings` e WHERE e.`quiz_id` = q.`id`) + 5 FROM `quizzes` q;
--> statement-breakpoint
INSERT INTO `columns` (`quiz_id`, `label`, `title`, `source`, `width_px`, `position`)
SELECT q.`id`, 'guess', 'Quick-model guess', 'dumdum', 160, 6 + (SELECT count(*) FROM `expressings` e WHERE e.`quiz_id` = q.`id`) + 6 FROM `quizzes` q;
--> statement-breakpoint
UPDATE `quizzes` SET `last_sortkey` = CASE
  WHEN `last_sortkey` LIKE 'expressing:%' THEN 'column:' || substr(`last_sortkey`, 12)
  WHEN `last_sortkey` IN ('qnum', 'title', 'chains_to', 'clueing_ishes', 'butnot_ishes', 'hint_ishes') THEN 'column:' || `last_sortkey`
  ELSE `last_sortkey` END
WHERE `last_sortkey` IS NOT NULL;
