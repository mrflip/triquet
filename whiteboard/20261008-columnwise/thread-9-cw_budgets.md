# Thread 9: Compute budgets (2026-10-09)

Branch `20261009-cw_budgets`, PR filed at landing; see the report. Suites: `pnpm justify` green;
e2e for sorting and the seeded sums green. No schema change.

* **Built**:
  - `src/lib/clock.ts`: `clockNow()` (`performance.now()`), the one clock every budget reads;
    `Date.now()` stands still inside a Convex function.
  - **S1, `src/lib/liquidry.ts`**, which serves every Liquid renderer (field, column, recap and
    `liquidize` templates, and the prompts once another container moves them to Liquid;
    `src/lib/ask/prompts.ts` untouched):
    - `ClockedContext` reads the deadline at every value read, and its spawned item contexts too, so
      `where`, `has`, `map`, `sort` by a property and the rest stop *inside* their call. No measurable
      cost.
    - `RefusedFilters`: the six `*_exp` filters refused as the template is read, the sentence naming
      the twin; a `syntax` failure, so an `errored` cell, never a throw.
    - `ItemsMax` 100,000 per step (ranges, a filter's list or text) and `AllocMax` 1,000,000 all told
      (Liquid's limit was 10M), by taking over LiquidJS's render and allocation limits (`heldTo`).
      `push`/`unshift`/`concat` charged for all they add (`sizeWithin`); the app's filters charged.
      The review added a capped `capture`.
  - **C1, `src/lib/templating.ts`**: `ColumnMs` (250), `columnBudget()`, `fillWithin`: time left,
    spent fill by fill whenever asked (the grid's lazy cells too); a `limit` stops the column. Taken by
    `Columns.textOfShown` and each templateable source in `finishedQnsOf` (so `filledQuiz`).
  - **JSONata**: the timebox reads `clockNow()`; `evaluate` takes a deadline, threaded through every
    formulary's `input`, `run`/`worked`, and `template_from`'s formula.
  - **m1**: `Runner.RunMs` 5000 (the browser's alone, see below); each live column's deadline is the
    sooner of its own and the run's; a column begun after it says so; asked inputs stop at the first
    that will not. `Columns.workedOf` holds a column's own formula to `RunMs` for its whole column.
  - **m2**: `paramsFor` holds a gone widget's widgeting to `WidgetingValidators.openParams`.
  - **Flaky timing tests**: recheck's verdict tests get `RoomyMs` (`tests/support/redos.ts`); the
    mutation suites mock `Redos.firstRefusalOf` with it. Production budgets unchanged.
  - **Sort on the client** (review, the Coach's ruling): `Sortings.sortedIdsOf`; `Workbench` sends
    `sort_questions` with every question's id; the server refuses an order that is not exactly the
    quiz's questions (`sortStale`) and commits it with `last_sortkey`. **No mutation runs a quiz.**
    Tests sort through `sortAction` (`tests/support/convex.ts`); `Seen` carries the hunt's `wheel`.
  - Docs: record §11, §4's sorts amended; `notes/security.md`; `whiteboard/TODO.md`;
    `human/20261009-cw_budgets.md`; the `liquidize` advice says no `*_exp`.

* **Decisions taken**:
  1. **The clock inside reads, not caps alone**: a long property path read from each item of a modest
     list is elements × path in one call (2.4 s over 1,000 items), which no range cap reaches.
  2. **Two caps**: 100k per step ("near FillBudget") and 1M all told; 100k all told would refuse honest
     recaps running `| upcase` over every question's text.
  3. **Column budgets are time left, not deadlines**, so lazily drawn cells count only their own time.
  4. **JSONata has no tight column budget**: the seeded `butnot` formula takes ~260 ms a column over
     300 questions.
  5. **`RunMs` is 5000** (amended on review; it was 1000, a mutation's second): only the browser runs a
     quiz now, so the bound is loose.
  6. **Recheck steadied by room, not warm-up**: the flakes were a wall-clock timeout on a cold first
     check (70-120 ms, 3-25 ms warm) times load. Green under 24 busy loops on 16 cores.

* **Deviations**: `recap.test.ts` used `where_exp`; now `where: "recap"`, with a test pinning the
  refusal. `e2e/widgets.spec.ts` "sorting by a computed column…" waits for the save before sorting:
  a marked workaround (below).

* **Discoveries**:
  - **Probed on lane 1's backend** (probe removed, `_generated` pushed back): JSONata stopped at
    101 ms with `Date.now()` still; a long-path `where` stopped at 257 ms against 250; `where_exp` and
    a 3M range refused in 6 ms. A JSONata `[1..10000000]` runs a mutation out of its 64 MB: in TODO.
  - **A face** (`faceOf`, a templateable field's cell) fills outside any column's budget: a view
    change, in TODO with a design.
  - **The sort race**: the browser has no optimistic updates, so a sort clicked within a round trip of
    an edit sorts the quiz as it was. The Coach accepted it; optimistic updates remove it, and the
    e2e workaround with it (TODO).
  - LiquidJS internals taken over (`readProperty`, `spawn`, `renderLimit.check`, `memoryLimit.use`,
    the filter table), each pinned by a test that fails without it; LiquidJS pinned to 10.30.0.

* **Moved out**: questions keyed by label for the bag (the review's fix A) leaves this thread: the
  Coach ruled a larger change, the bag shaped as the export with `question`/`questions`, a thread of
  its own. A first cut is parked, unlanded, on the local branch `20261009-cw_budgets-qnbag-parked`
  (`1b7661f`): it may be read, and should not be deleted.

* **For thread 3c**: `shownOf`/`drawnOf` and the sorts read as before.

* **For the Coach**:
  - **Before deploying**: grep production for stored templates naming a `*_exp` filter
    (`human/20261009-cw_budgets.md`).
  - Tune `RunMs` (5 s) and `AllocMax` (1M) if a real quiz meets them.
