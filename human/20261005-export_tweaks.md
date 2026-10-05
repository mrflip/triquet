# 2026-10-05: Export tweaks, and a quiz's `q1_preamble` widened in with a backfill

* **Raw Export** holds just a centred *Prepare export* until asked, in about the space the box
  takes; once read, the box with *Copy* and *Refresh export* beside it. The box does not follow
  edits (a change on screen withdraws it, back to *Prepare export*), so Refresh stays: it is how
  to catch up with an edit to another quiz of the hunt, which leaves the box standing. The *Download
  Full History* button is gone from this tab; the Full History tab still has it.
* **LL Export** has a mode pulldown (Plain, Playtesting, Go live) and an (i) tooltip saying what
  each does. Playtesting puts the whole smith's note, then a blank line, ahead of the first
  question; Go live puts the quiz's Q1 preamble there, and shows it in a field beside the pulldown
  to be rewritten. "First" is the lowest rank; in a quiz where no question has a Q#, it is the
  first unranked one, so the lead never vanishes silently. The mode is the tab's own state, not
  saved, and starts on Go live (Coach's call). Rebased onto the dbpolicy and categories sprints:
  the preamble's field is read-only unless `offers.reviseQuiz`, as the smith's note is;
  `set_q1_preamble` is a content action under `mayReviseClaimedQuiz`, as `set_smiths_note` is;
  and it reaches the dispatcher by a narrow `onQ1Preamble` from `Workbench` through `Panels`,
  not by handing the panel `dispatch` back.
* **The smith's note box keeps its lines**: each line break becomes `[br]` then the line break.
  The bulk records stay on one line as before.
* **Your step once this is deployed:** `q1_preamble` is a new field on quiz rows, so this is the
  widen half of the usual migration. Run, against production:

  ```sh
  ./scripts/doppledo prd_janitor npx convex run migrations:run '{"fn": "migrations:backfillQ1Preambles", "dryRun": true}'
  ./scripts/doppledo prd_janitor npx convex run migrations:run '{"fn": "migrations:backfillQ1Preambles"}'
  ```

  Then merge the stacked tightening PR, `20261004-tighten_q1_preamble` (field required in the
  schema, fallbacks and backfill dropped, ledger row added). Its push checks every quiz, so it
  lands only once the backfill is complete. Until then, a quiz without the field reads as having
  the default.
