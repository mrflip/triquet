# Thread 8: Seeds pass (2026-10-08)

Branch `20261008-cw_seeds`, PR filed at landing; see the report. Stacked on thread 5a's
`20261008-cw_folding`. Suites: `pnpm justify` green (one run failed a unit test under load 28 and
passed whole on the rerun, unnamed); the full `pnpm e2e` at landing, its count in the report. No
schema change, no row rewrite.

* **Built**:
  - **`SeedPresets`** (`src/models/seeds.ts`): the seeds' own reshapes, by widget label. For
    `numnum_clueing`, `numnum_hint` and `butnot_ishes`, the two sums over the column's `$` (the
    widgeted): every span, and the spans in digits, each rounded halves up, built from the same
    `SumOf` as the seeded widgets, so the two cannot drift. No `status = 'ok'` guard: a column's
    formula works only on an `ok` widgeted, so an unasked spotter shows the dash, not nought.
  - **`seedPresets`**, a `PresetSource` in `ColumnMenu.PresetSources` (`src/lib/column-menu.ts`),
    offering them beside a widgeting of those widgets, whatever the widgeting is called.
  - **`FormulaPreset.names`** (optional), **`ColumnMenu.namesOf(source, formula, presets)`** and
    **`ColumnMenu.namerOf(quiz, library)`**: a column taking a seeded sum is named as the seeded sum
    it stands in for (`clueing_full`, *Clueing Full Sum*; `hint_numeral`, *Hint Numeral Sum*;
    `butnot_full`, *BUT NOT Full Sum*), else as `namesFor` names it. Over 5a's folding editor (at
    catch-up, the new-column dialog being retired): `retitledPatch` takes a `ColumnNamer`
    (`namesFor` by default), and `useColumnCommit` is handed `namerOf`'s, from `ColumnsEditor` and
    `WidgetingPanel`, so a header still after what a column shows follows a preset's names when
    the formula is picked, and back when it is taken off. A column made from *+ New column…* has no
    formula yet, so `newColumnShowing` still names by `namesFor`.
  - Tests: `tests/models/seeds.test.ts` runs each preset through `Columns.shownOf` on the classic
    layout and holds it equal to the seeded sum it stands in for, and missing when unasked (a
    failed ask is the one difference: see *Review*);
    `tests/lib/column-menu.test.ts` the offer and the naming; `e2e/ishes.spec.ts` a column made
    from *+ New column…* on the spotter, its formula picked from the digits preset, its header
    following to *Clueing Numeral Sum*, showing 36 once asked. `tests/models/column.test.ts` holds
    `retitledPatch` to a namer it is given.
  - The decision record (`notes/decisions/20261008-columnwise.md`, beside *The parts are
    expression presets*) and `notes/vocabulary.md` (*preset*) say so.

* **Decisions taken**:
  - **The four reshaping sums stay seeded**, beside the presets. A seeded sum's cell re-asks its
    spotter on a double-click (`QuestionRow.reextractFor`, keyed on `clueing_full`/`hint_full`); a
    formula'd column on the spotter is read-only and does not. `seeding:seedWidgets` gives a quiz
    laid out before the library all twelve `DefaultWidgetings`, sums among them. And a fresh
    deployment's library would differ from production's for no gain, since seeding only adds.
  - **Offered by the library widget's label**, as `reextractFor` already finds the spotters: a seed
    knows its own reply's shape, so it is the one place a bot's result is offered presets
    (the decision record's §4, *The source menu*, gives an `aibot` source none otherwise).
  - **`butnot_ishes` is offered the sums too**: its value is a spotter's reply (the chained-to
    hint's), so the preset is exactly `butnot_full`/`butnot_numeral` (a test holds them equal).
    The `butnot_*` widgets themselves stay, as the plan says.
  - **Presets may name their column**: without it, a sum column on `numnum_clueing` would be
    headed *Numnum Clueing*, and a second one the same.

* **Deviations**: none from the plan. `namesOf`, `namerOf` and `retitledPatch`'s namer are small
  additions the plan did not name (the last asked for by the orchestrator at landing).

* **Discoveries**:
  - The sum's double-click re-ask is the one thing a preset column lacks. Making a formula'd column
    on an `aibot` widgeting re-ask on double-click would close the gap; not done (beyond this
    thread, and `isDrawnByEditor` holds it read-only on purpose).
  - `--touched` reaches the whole suite: `src/models/seeds.ts` is under `src/models/`, which no
    corner names.

* **Review** (`clean`, one minor finding, by design): a spotter whose ask failed with no earlier
  `ok` reply shows the errored badge through a preset, where the seeded sum shows the dash (the sum
  reads `status = 'ok'` itself and comes to nothing; a column passes an `errored` widgeted by, as
  `SpotterSums`' doc block says). The decision record names the difference.

* **For the Coach**:
  - **`pnpm lane` no longer runs the project's script**: pnpm 12 has a built-in `lane` command,
    which wins and prints "All packages are on the main lane." `pnpm run lane` (or
    `node scripts/lanes.ts lane`) says this worktree's lane, 1. CLAUDE.md's *Global resources*
    names `pnpm lane`; renaming the script, or writing `pnpm run lane`, would fix it.

* **For later threads**:
  - **5b**: the row preview needs nothing of this; a new caller of `useColumnCommit` passes
    `ColumnMenu.namerOf(quiz, library)`.
  - **7**: a mechanical conflict in `seeds.ts` at most (`blurb`); `SeedPresets` sits after the
    BUT NOT ishes.
