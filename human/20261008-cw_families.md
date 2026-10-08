# 2026-10-08: Entry families -- before the deploy, two things to do by hand

From the columnwise sprint's thread 2 (`20261008-cw_families`). Additive to the schema, no
migration chain; but two things want a person around its deploy.

* **Grep production for labels the new reserved words catch, before deploying.** Nothing rewrites
  a row already holding one, and rows read back are not validated, so the quiz still opens and
  runs. But **every write of such a row is refused**: the row validators check the whole row at
  each write, so a question, column or widgeting under a newly reserved label cannot be edited at
  all (its title, its width, its description), and a column showing a widgeting so labelled cannot
  be resized, until it is relabelled (a relabel goes through, since the row is then whole again).
  The words are `src/lib/vv/patterns.ts`'s new groups (`types`, `engines`, `aggregates`,
  `jsonata`, `status`, `grid`, `self`) for every label (hunts, realms, quizzes, questions, columns,
  widgets, widgetings, usernames), and for widgetings alone the bag's top-level keys, a widgeted's
  keys, a column's fields and an estimate's keys (`ReservedWidgetingLabels`). Likely catches: a
  column or widgeting labelled `total`, `sum`, `count`, `average`, `order`, `name`, `text`, `code`
  or `data`; a username such as `python`. The `scripts/doppledo prd_janitor npx convex data
  <table> --limit 9321 --format jsonl | jq ...` recipe in `notes/convex.md`, *Limits*, reads each
  table. An old export holding one is refused by the importer, naming the word.
* **Seed the library after the deploy**: `./scripts/doppledo prd_janitor npx convex run
  seeding:seedWidgets` adds the four new entry widgets (`memo`, `figure`, `yes_no`, `choice`),
  one per family, which most smiths need to make an entry at all (they cannot write the library).
  It inserts only what is absent.
