# 2026-10-08: Entry families -- a hard gate before the deploy, and a seed after it

From the columnwise sprint's thread 2 (`20261008-cw_families`). Additive to the schema, no
migration chain; but two things want a person around its deploy, and the first is a gate.

* **Before deploying (a hard gate): grep production for every newly reserved word, and relabel
  each one found.** The words are `src/lib/vv/patterns.ts`'s new groups (`types`, `engines`,
  `aggregates`, `jsonata`, `status`, `grid`, `self`), reserved for every label; and, for
  widgetings alone, `ReservedWidgetingLabels`' new entries (the bag's top-level keys, a widgeted's
  keys, a column's fields, an estimate's keys). Grep production's raw export, table by table, for
  them among **hunt, realm, quiz, question, column, widget and widgeting labels, and usernames**
  (idents, and the orgs they name). The `scripts/doppledo prd_janitor npx convex data <table>
  --limit 9321 --format jsonl | jq ...` recipe in `notes/convex.md`, *Limits*, reads each table.
  Likely catches: a column or widgeting labelled `total`, `sum`, `count`, `average`, `order`,
  `name`, `text`, `code` or `data`; a hunt or quiz labelled `data` or `sql`; a username such as
  `python`. Relabel each before the deploy (a relabel goes through afterward too, but some of what
  breaks below cannot be reached to relabel). **What breaks for one missed:**
  - **Reads**: an address slot is checked with `label`, an org with `userlabel`
    (`src/lib/addresses.ts`, `convex/hunts.ts` `openHunt`), so a hunt, realm, quiz or review
    (by its reviewer's username) under a reserved word **cannot be opened at all**.
  - **A username** under a reserved word cannot be asserted again at the front door, added to a
    hunt, or used to make one.
  - **Writes**: the row validators check the whole row at each write, so a question, column or
    widgeting under such a label cannot be edited at all (its title, its width, its description),
    and a column showing a widgeting so labelled cannot be resized, until it is relabelled.
  - **Imports**: an old export holding one is refused, the sentence naming the word.
* **Seed the library after the deploy**: `./scripts/doppledo prd_janitor npx convex run
  seeding:seedWidgets` adds the four new entry widgets (`memo`, `figure`, `yes_no`, `choice`),
  one per family, which most smiths need to make an entry at all (they cannot write the library).
  It inserts only what is absent.
