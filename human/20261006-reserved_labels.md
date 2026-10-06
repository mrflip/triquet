# 2026-10-06: Reserved labels -- two lists, and production holds none of either

`PA.ReservedLabels` (`src/lib/vv/patterns.ts`) is a list of words no label may be, grouped by why:
fields (`key` among them now), the tool's nouns, those nouns with `id` run on,
`constructor`/`prototype`, null-ish literals, Windows device names, and a few route words. Any label
ending `_id`/`_ids` is refused too. The kit's `label` refuses them, so every label namespace does.

`PA.ReservedToplevel` is the second list, for the global namespaces only: a hunt's label (its
address) and an ident's (a username). It holds the app's own corners (`lib`, `sys`, `pub`, `my`,
`dashboard`, `account`...), marketing and help pages (`about`, `careers`, `jobs`, `pricing`,
`support`...) and names that would pass for the app speaking (`triquet`, `staff`, `system`...),
plus anything beginning `secur`. Hunt labels refuse it through the kit's `toplabel`; ident labels
refuse both lists through `identlabel`.

**Production holds none of them.** A read-only export through `dev_aijanitor` (2026-10-06),
with every row run through this branch's row validators: 0 refused across hunts, realms, quizzes,
questions, columns, widgets, widgetings, widgeteds, idents and huntings. No migration needed.

Left as known bugs in `whiteboard/TODO.md`: `categories` (the shipped widget's label), and the
question's content fields (`title`, `notes`...), which stay reserved only among widgetings.

Also suggested, not done: `yes`/`no`/`on`/`off` (YAML 1.1 reads them as booleans; we write no YAML
today), `head` as a branch (ambiguous with `HEAD` on a case-insensitive filesystem), and more
top-level prefixes beside `secur` (`admin`, `triquet`, `support`, so `triquet_team` is refused too).
