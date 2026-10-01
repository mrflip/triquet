# Rewidgeting: progress

The running handoff for `rewidgeting-plan.md`, newer than the plan wherever they disagree.
Workers add their sections below the table, newest first.

## Status

| Thread | Label | Status |
|---|---|---|
| 1 | Design note and vocabulary | complete: PR #67 (docs only, unreviewed) |
| 2 | The formulary seam, no data change | pending |
| 3 | The data model, as a clean break | pending |
| 4 | Pasted prompts | pending |
| 5 | Status | pending |
| 6 | Views | pending |
| 7 | The basic set and the catalogue | pending |
| 8 | Entry widgets | pending |

## Thread 1: Design note and vocabulary (2026-10-01)

Branch `20261001-widgets_decision`, PR #67, carrying the two unmerged ground branches beneath it
(`20261001-rewidgeting_start` on `20261001-rewidgeting_plan`, neither with a PR). Suites, after
the rebase onto `origin/main`: typecheck and lint clean, `pnpm test` 2289 passed, `pnpm test:e2e`
193 passed. Docs only.

* **Built**: `notes/decisions/2026-10-widgets.md`, in a new `notes/decisions/`: the design
  threads 2 to 8 build to. Its *Settled here* list, at the end, is every call it made where this
  plan left one loose. `notes/vocabulary.md`: the new words fill its *Widgets* section, the old
  ones sit under *Retiring*, and *Widgets and columns* became *Columns and the bag*.
* **Decisions taken** (the note has the detail and the reasons). Names: `src/lib/formulary/`
  holding `formularies.ts`, `jsonata.ts`, `aibot.ts`, `runner.ts`; `src/models/widget.ts`,
  `widgeting.ts`, `widgeted.ts`; `WidgetedT` is the `{ status, value, err }` read and `WidgetedRowT`
  the row. Every formulary runs over its input, not the bag. A third reported fact, `store`. The
  widget row is a union on `formulary`, with config schemas in the model. The seeds fixture is
  `src/models/seeds.ts`, and the seeding mutation is `seedWidgets` in `convex/seeding.ts`. The
  bag's paths are `qn.dumdum` (`{ guess, explanation }`), `qn.numnum_clueing` and `qn.numnum_hint`
  (`{ items }`). `butnot_ishes` becomes a seeded `jsonata` widget, and its view retires. The bag
  gains `params` and `widgeting_label`. A widgeting exposes `status` and `value`. The mirror path is
  `tq/widget/pub/<label>.tqwidget.json`. Widget actions ride `hunts.perform` under
  `mayChangeHunt`. The indexes are listed in the note.
* **Deviations**: two refinements of plan calls.
  - The orchestrator's YOLO call 1 is refined: the seeding mutation creates the **whole** default
    set for a quiz whose columns name any of it. A column can be removed while its widget is kept,
    so "only what columns name" could seed a sum without the numnum widgeting it reads. A lean
    quiz still gets nothing.
  - The note's import rule follows open **PR #66** (the Coach's reversal of "replies are recorded
    by asking, never pasted"): a pasted `ok` value of a stored widgeting goes into a cell with no
    row, marked `result_meta.imported`.
* **Discoveries**:
  - PR #66 is open and not in this stack. It makes guesses go stale and carries replies on
    import. Its stale half is retired by this sprint. Its edit to `notes/vocabulary.md`'s *stale*
    entry conflicts with #67's move of that entry under *Retiring*: a docs-only conflict for
    whichever lands second.
  - `src/lib/vv/patterns.ts` imports nothing, on purpose, so the reserved pattern cannot read
    `Question.exposed` there. The note gives it a builder that takes the words, which
    `src/models/widgeting.ts` hands it.
  - The seeded prompts are already about 960 characters. An `aibot` formula needs a bound larger
    than `formulaish`'s 999 (the note says 3600).
  - Today's action kinds `add_widget` and its siblings act on a quiz's widgets. In thread 3 they
    come to mean the library's.
* **For the Coach**:
  - Confirm `butnot_ishes` as a seeded widget (or prefer the view reading `numnum_hint`).
  - Confirm dumdum's `{ guess, explanation }`.
  - Confirm the #66 reading.
  - `CLAUDE.md`, `notes/database-decisions.md` and `notes/vocabulary.md` still link decision
    records that are not in the tree.

*Review:* none: docs only, per the sprint skill. *Orchestrator:* both deviations accepted and the
plan's glosses revised to match; the note's *Settled here* list now outranks the plan's glosses.
