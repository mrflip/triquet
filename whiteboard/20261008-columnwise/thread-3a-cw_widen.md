# Thread 3a: Columns widen, the plain-key source (2026-10-08)

Branch `20261008-cw_widen`, PR filed at landing; see the report. Chain `columnwise`, title ends
`(Serial Deploy: columnwise)`. Suites: `pnpm justify` green; the touched e2e specs (importing,
estimates, widgets, entries, quiz-entries, sheets, grid) green on lane 2.

* **Built**:
  - **The ref** (`src/models/column.ts`): `source` is one plain key (a question field, `butnot`,
    a key `label`/`rank`/`archived`/`secondary`, a widgeting label, a word `quiz`/`hunt`/`realm`/
    `categories`/`qns`), or `quiz.<label>`. `refOf` parses it; the grammar before October 2026
    is read by `beforeOctoberOf`/`plainOf` everywhere. The validator takes both grammars.
  - **The column's new fields**, optional for good (`Absentable`): `formula`, `template`,
    `readout`, `collapsed`. `columnPatch` takes `null` for formula/template/readout to take one off.
  - **Reading** (`src/lib/columns.ts`): `resolve` finds on `qn` first (so a pre-backfill
    widgeting `categories` still wins over the word), then the top level, a widgeting only at the
    tier its ref names. `ColumnSpec.formula`; `shownOf(spec, run, templateable, question_id)` is
    what a column shows, worked by its formula through `JsonataFormulary.worked` once per run
    (WeakMap), a timeout stopping the rest of the column. The grid draws a formula's value
    read-only (`QuestionRow.workedBody`; a part preset `$.masie` on an estimates entry as
    `EstimatePartReadout`), and draws keys, words and `quiz.<label>` as readouts. Sheet
    (`cellTextOf(spec, …)`) and sorts (`sortValueFor`) go through `shownOf`.
  - **templateable**: `quizzes.templateable` (plain: `clueing`, a widgeting label), action
    `set_templateable`, `TemplateableEditor.tsx` (aria "Templateable sources"). The one fill is
    `Templating.finishedQnsOf(run, templateable)`; `filledBagOf` uses it.
  - **`category_data`**: the seed (`CategoryDataLabel`, `src/models/seeds.ts`).
  - **Writers**: starter layout, planner, columns editor (a part is the widgeting + `$.<part>`;
    its menu keys read `category_data, $.masie`), `addColumn`/`updateColumn` (translate a stale
    browser's old grammar; `null` takes a field off), `updateQuiz` (writes `templateable`, takes
    `templated` off), exporter (plain, `templateable`).
  - **Importer, for good**: `beforeOctoberRead` (columns, `templated`, the `categories` widget,
    widgetings and cells) and `beforeOctoberWidget` (library). `src/models/before-october.ts`
    holds the relabelling (`categoryDataOf`, `relabelledSource`).
  - **Backfills** (`convex/migrations.ts`), in order: `backfillCategoryDataWidget`,
    `backfillCategoryDataWidgetings`, `backfillPlainColumnSources`, `backfillQuizTemplateables`.
    Schema: `quizzes.templateable` optional (`Backfilling`), `quizzes.templated` optional
    (`Retiring`). Rehearsed on lane 2's agent backend: old rows pushed under the base commit, the
    widening pushed over them, `migrations:runAll`, `outstanding` empty, seeding again adds no
    second entry.

* **Decisions taken**:
  - `formula`, `template`, `readout`, `collapsed` are not backfilled: absence is their meaning.
  - `templated` is retired in the same backfill that writes `templateable` (as `retireQuizVersions`
    did), so 3c only drops it from the schema.
  - The categories relabel is per quiz (`quizzes` table), so a widgeting, its columns and the
    nomination move together; a label already taken gets `Labelmaker.firstFree`, the natural
    `category_data_<n>` of the others reserved first.
  - The old entry is deleted where seeding already made `category_data`; any other widget under
    that label stops the series (for a Coach).
  - **A `missing` widgeted with parts beside it is worked on** (an empty estimates cell): the
    decision record's rule 2 amended in §4; else a backfilled `$.masie` column shows a dash where
    it showed 53% (`e2e/estimates.spec.ts`). Committed on its own (`27bf8b3`), easy to revert.
  - A column formula's input comes from the formula bag (`run.qnsAfter`, archived included, no
    image linking), templateable sources filled; `qns` is every question.
  - The server translates an old-grammar column write rather than refusing it, so a stale tab
    keeps working until the tightening.

* **Deviations**: none from the plan. Pulled forward from 3b, as reading needs it: the grid draws
  a formula'd column read-only (the editability rule's effect, not its UI), and the validator
  and grid accept keys, words and `quiz.<label>`. 3b builds the menu, template, readout, collapse.

* **Discoveries**:
  - A new estimates column titles itself `Category Data` (the planner titleizes the label).
  - `run.parts` and `Runner.widgetedOf`'s part argument are gone; parts live only in the bag.
  - A stale tab's `set_templated` is refused (the action is renamed).
  - The sheet writes an identity column's templateable text unfilled, as before.
  - Thread 4: `widgetingLabelOf` now also reads `quiz.<label>`; `resolve` keeps kind `widgeting`.

* **For 3c (tighten)**, every item:
  1. `convex/schema.ts`: drop the hand-written `templateable` and `templated`, and the comment.
  2. `tests/convex/schema.test.ts`: empty `Backfilling` and `Retiring`.
  3. `convex/migrations.ts`: drop the four backfills, their imports and `CategoryDataSeed`;
     `Backfills` keeps the stamps'. Drop the columnwise tests in `tests/convex/migrations.test.ts`.
  4. `src/models/column.ts`: `source` plain only; drop the refine on `column`; `refOf`,
     `widgetingLabelOf`, `namesFor` lose the old-grammar branch. Move `beforeOctoberOf`/`plainOf`
     to `src/models/before-october.ts` for the importer. `WidgetingPartVals`/`WidgetingPartTitles`/
     `partOf`/`partFormulaOf` move beside `Estimates`. Decide whether `question` stays reserved.
  5. `src/models/quiz.ts`: move `templateableFrom` to `before-october.ts`.
  6. `src/lib/rows.ts`: `templateableOf` → the row's own; `columnFrom` and `frameOf` lose the
     fallback. `convex/writing/quiz_writing.ts`: `updateQuiz` and `updateColumn` lose theirs.
     `layout_actions.ts`: `templateableOf(rows.quiz)` → `rows.quiz.templateable`.
  7. `src/lib/columns.ts` (`specFor`, `isQnum`), `exporting.ts`, `widgeting-edit.ts`: drop
     `plainOf`.
  8. Reserved words: `categories` (and the Coach's call on `category`) into the bag's top-level
     group; drop the exempting note in `src/lib/vv/patterns.ts`.
  9. Keep for good: `beforeOctoberRead`, `beforeOctoberWidget`, the jsonball's `templated`,
     `CategoriesWidgetLabel`/`CategoriesDescription`, their tests.
  10. Ledger rows in `notes/deploy.md`; for this PR: *Relabels the library's `categories` entry
     `category_data` (taking it away where seeding made one), each quiz's widgetings of it or
     labelled `categories`/`categories_<n>`, and the columns and nominations naming them; writes
     each column's source plain (`question.<x>` → `<x>`, `<w>.<part>` → `<w>` with
     `formula: '$.<part>'`); writes each quiz's `templated` as `templateable`, plain, taking
     `templated` off. Nothing rewrites a formula reading `qn.categories`.* Run: `migrations:runAll`,
     or `backfillCategoryDataWidget`, `backfillCategoryDataWidgetings`,
     `backfillPlainColumnSources`, `backfillQuizTemplateables`.

* **For the Coach**:
  - Before deploying: grep the raw export for formulas reading `qn.categories`.
  - Is the empty-estimates-cell rule (above) right, or should an unplaced question show a dash?
  - `Category Data` as a new estimates column's header, or `Categories`?
