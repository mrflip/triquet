# 2026-10-09: Import carries the bots' replies again; the library imports from its own dialog

Thread `import_carries`, from the Coach's report that importing
`notes/examples/20261008-but_not_recap.json` filled neither entries nor bot values.

## What was wrong

* **Bot replies** were dropped on purpose by the code, against the decision doc: the widgets
  rewrite (`3738916e`) removed #66's reply carrying with the old bot model, and nothing rebuilt it
  (`whiteboard/20261003-widgets_todo.md`, item 1). Every formula worked from a reply came to
  nothing with it.
* **Entries** worked, but only when the library already held their widgets. A quiz Import never
  brings the export's `pub.widgets` (changing the library is an admin's act), so `correct_pct`,
  `money_line` and `clueing_finds` were skipped, and their cells' values went with them without a
  word on any question.

## What changed

* A reply under any widgeting asked from its cell (`store: 'append'`) is carried as `replied`,
  and `importQuestions` records it as an `ok` row marked `result_meta.imported`, only into a cell
  holding no row. The cell says "imported" beneath it.
* What a question holds under a widgeting the import skips is named in one line on the question.
* The Widget library dialog folds the library's export and import beneath its list; where the
  reader may not change the library, the form says only an admin may.

## Open questions

* **A cell that only ever failed is not filled.** The todo and the decision doc say "only into a
  cell holding no row"; #66 filled a cell that had only failed. I followed the newer text. Filling
  one would be a one-line change in `carryReplies` (look for an `ok` row instead of any row).
* **A failure and a missing cell are not logged.** The todo says an `errored` or `missing` value
  "is logged". Logging failures made a quiz's own export, pasted back, name every failed cell, so I
  went with #66: only a reply that will not read is named.
* **The example export is not a fixture.** `fixtures/exports/` keeps every shape ever emitted, and
  this one (hunt keyed by realm, with `pub.widgets`) is new there; but it is a real quiz with its
  answers, so I left it out. A trimmed copy could go in if you want the shape pinned.
* Items 2 (reading pre-#69 exports' replies) and 3 (staleness by digest) of the todo remain.
