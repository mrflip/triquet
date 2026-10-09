# Thread 3c: Columns tighten (2026-10-09)

Branch `20261009-cw_tighten`, PR filed at landing; see the report. Ends the chain: the PR body says
`Tightens Serial Deploy: columnwise`. Suites: `pnpm justify` green (5638 unit tests); full e2e at
landing.

* **Built**: every item of 3a's checklist (`thread-3a-cw_widen.md`, *For 3c*):
  1. `convex/schema.ts`: `quizzes` is derived from its row validator alone: `templateable`
     required, `templated` gone.
  2. `tests/convex/schema.test.ts`: `Backfilling` and `Retiring` empty.
  3. `convex/migrations.ts`: the four columnwise backfills, their imports and `CategoryDataSeed`
     gone; `Backfills` keeps the twelve stamp backfills. Their tests are gone from
     `tests/convex/migrations.test.ts`.
  4. `src/models/column.ts`: `source` is `ref` (plain only); the `column` refine, `refOf`'s,
     `widgetingLabelOf`'s and `namesFor`'s old-grammar branches gone. `QuestionWidgetLabel`,
     `beforeOctoberOf` and `plainOf` moved to `src/models/before-october.ts`. The parts
     (`PartVals`, `Part`, `PartTitles`, `partFormulaOf`, `partOf`) moved to `src/lib/estimates.ts`.
  5. `templateableFrom` moved from `src/models/quiz.ts` to `before-october.ts`.
  6. `src/lib/rows.ts`: `templateableOf` gone, `frameOf` and `columnFrom` read the row as it is;
     `updateQuiz` and `updateColumn` (`quiz_writing.ts`) and `layout_actions.ts` lose their
     fallbacks.
  7. `plainOf` gone from `columns.ts` (`specFor`, `isQnum`), `exporting.ts`, `widgeting-edit.ts`,
     and from the views (`ColumnsEditor`, `ColumnFields`).
  8. `categories` (the whole `QuizBagKeys`, no longer filtered) and `category` are in
     `ReservedWidgetingLabels`; the exempting note in `src/lib/vv/patterns.ts` is gone.
  9. Kept for good: `beforeOctoberRead`, `beforeOctoberWidget`, the jsonball's `templated`,
     `CategoriesWidgetLabel`, `CategoriesDescription`, and their tests. `seeding.ts` reads the old
     BUT NOT ishes view through `before-october.ts`'s `QuestionWidgetLabel`.
  10. `notes/deploy.md`'s ledger: rows for `20261008-cw_widen` (#193) and `20261009-cw_tighten`,
     the first saying that nothing rewrites a formula reading `qn.categories`.

* **Decisions taken**:
  - **`category` is reserved too** (the Coach's open call, made in YOLO), beside `categories`, and
    only from widgeting labels, as the record's §9 table put `categories`. Neither is a global word:
    making them global would refuse the next write of any hunt, quiz, question or column already
    labelled `categories` (an estimates column whole is labelled so by `namesFor`).
  - **`question` stays reserved** from widgeting labels, written as the word: thread 10 makes it a
    top-level word of the bag.
  - **`resolve` no longer looks for a widgeting under a word of the bag**: no widgeting may take
    one, so a column whose source is `categories` is always the word. This closes 3a's review item
    (`shadowedBy`): a `categories` widgeting can no longer exist to be renamed or deleted. A row
    the backfill missed would show the hunt's categories in that column, and section 5 of
    `prd_checks.mts` finds any first.
  - **A part column is named by its preset**: `ColumnMenu`'s part presets carry `names`
    (`category_data_masie`, *Masie*), as thread 8's seed presets do, so `namesFor` names a ref only
    and the column model knows no parts. `retitledPatch` by `namesFor` alone no longer retitles a
    part (every editor passes `namerOf`).
  - The old-grammar parts list is the live `Estimates.PartVals`, not a frozen copy.

* **Discoveries**:
  - The Convex schema holds a column's `source` as a string, so the tightening's push cannot refuse
    a source still in the old grammar, nor a widgeting still labelled `categories`: the row
    validator refuses such a row's next write. Section 5 of `prd_checks.mts` is the real gate; the
    ledger row says so.
  - Rehearsal: `scripts/convex_dev agent --seed` pushed the tightened schema to lane 1's empty
    agent backend and seeded it; `convex/_generated/` did not change. No copy of production was
    rehearsed on.
  - For 10: `before-october.ts` is now the one home of every reading of the old grammar; the bag
    rewrite's old-to-new function belongs beside it.

* **For the Coach**:
  - Merge only after #193's deploy said `Backfills: every one has finished.`; then
    `migrations:outstanding` is `[]` and section 5 of a fresh export's `prd_checks.mts` finds none
    (`columnwise-convex_runbook.md`, step 5). Nothing else: no seed run.
  - Once this is on the spine, `prd_checks.mts` section 1 also catches a widgeting labelled
    `category` (or `categories`), since it reads `ReservedWidgetingLabels`: relabel any it finds.
  - `category`'s reservation is a two-way door; `categories` and `category` could be made global
    later, after a grep.
