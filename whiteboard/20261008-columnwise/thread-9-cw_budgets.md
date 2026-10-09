# Thread 9: Compute budgets (2026-10-09)

Branch `20261009-cw_budgets`, PR filed at landing; see the report. Suites: `pnpm justify` green
(typecheck, lint, 5,605 unit tests). No schema change; no e2e spec touched.

* **Built**:
  - `src/lib/clock.ts`: `clockNow()` (`performance.now()`), the one clock every budget reads, and
    `soonerOf`. Liquidry, the runner, JSONata and Templating read it.
  - **S1, `src/lib/liquidry.ts`** (serves every Liquid renderer: field, column, recap and
    `liquidize` templates, and the prompts once another container moves them to Liquid;
    `src/lib/ask/prompts.ts` untouched):
    - `ClockedContext`: the render's deadline is read at every value read (`readProperty`), and
      every context a filter spawns for an item is one too, so `where`, `reject`, `group_by`,
      `has`, `find`, `map`, `sort` by a property are stopped *inside* their one call. No measurable
      cost (a 300-question nested `where` takes ~100 ms either way).
    - `RefusedFilters`: the six `*_exp` filters, refused as the template is read (a throwing getter
      on the engine's filter table), the sentence naming the twin: "the filter where_exp works an
      expression for every item of a list, which is not offered: use where, with a property and a
      value, line:1, col:N". A `syntax` failure: a cell's `errored` sentence, never a throw.
    - `ItemsMax` 100,000 (no one step may make or be handed more: a range, a filter's list, a
      filter's text) and `AllocMax` 1,000,000 (Liquid's memory limit, was 10M). `heldTo` takes over
      LiquidJS's render limit (as thread 7's `clocked` did) and its allocation limit (per-step cap,
      clock, then Liquid's own count).
    - `push`/`unshift`/`concat` charged for all they add (`sizeWithin`): otherwise a list can hold one
      long thing many times over, which our `fillingOf` and Liquid's `stringify` then build in one
      unclocked step. The app's own filters (`in_order`) charged as Liquid's are.
  - **C1, `src/lib/templating.ts`**: `ColumnMs` (250, moved from `liquidize.ts`), `ColumnBudgetT`,
    `columnBudget()`, `fillWithin(template, bag, budget)`: time left, spent fill by fill whenever each
    is asked (a grid's lazy cells included; the time between cells is not counted); a `limit` stops
    the column, later fills returning that failure with their own text as typed. Taken by
    `Columns.textOfShown` (per run and column key, beside `TextedOf`'s memo) and by each templateable
    source in `finishedQnsOf`; `filledQuiz` (the export) now reads `finishedQnsOf`.
  - **JSONata, `src/lib/formulas.ts`**: the timebox reads `clockNow()`; `evaluate(formula, input,
    deadline?)`, the sooner wins, a passed deadline stops at once. Deadlines thread through every
    formulary's `input`, `JsonataFormulary.run`/`worked`, and `liquidize`'s `template_from` formula.
  - **m1, `src/lib/formulary/runner.ts`**: `RunMs` 1000, the run's deadline; each live column's is the
    sooner of its own and the run's; a live column begun after it reads "The quiz took too long to
    work out, so this column was not: ...". An asked widgeting's inputs (`inputsOf`) stop at the
    first that will not, as a live column does.
  - **m2, `convex/writing/layout_actions.ts`** `paramsFor`: a widgeting whose widget is gone takes
    params through `WidgetingValidators.openParams` (no reserved word, no formulary's own).
  - **Flaky timing tests**: `Redos.firstRefusalOf(regexes, budgetMs, checkMs)`;
    `tests/support/redos.ts` (`RoomyMs`, `roomy`); verdict tests in `redos.test.ts` pass `RoomyMs`;
    `layout_actions`, `library_actions` and `hunts` tests `vi.mock` Redos with `roomy`. Production
    budgets unchanged.
  - Docs: the record's new §11 (and §3 amended); `notes/security.md` (an entry, and two stale lines
    fixed); `whiteboard/TODO.md` (thread 7's JSONata item done; a thread 9 section);
    `human/20261009-cw_budgets.md`; the `liquidize` advice says no `*_exp`.

* **Decisions taken**:
  1. **The clock inside reads, not only caps.** A cap on ranges does not reach the worst case found:
     a long property path read from each item (`qns | where: "a.a.a…"`, 1,700 segments) over a
     modest list is elements × path in one call (2.4 s over 1,000 items, ~40 s over 100,000).
  2. **Two caps**: per step 100k ("near FillBudget", as asked) and all told 1M (a tenth of Liquid's
     default). 100k all told would refuse honest recaps that run `| upcase` or `| replace` over
     every question's text.
  3. **Column budgets are time left, not deadlines**, so the grid's cell-by-cell fills count only
     their own time. The runner keeps deadlines (its loop is tight).
  4. **JSONata has no column budget**: the seeded `butnot` formula (`qns[label = $$.qn.chains_to]`)
     takes ~260 ms a column over 300 questions; 250 would stop honest columns. The run's second holds.
  5. **`RunMs` is 1000**: a mutation's whole second, the most one change may hang a page.
  6. **Steadying recheck by room, not warm-up**: the flakes were recheck's wall-clock timeout on a
     cold Scala.js first check (70-120 ms, 3-25 ms warm) multiplied by load; a warm-up shrinks it but
     does not remove it. Proven green with 24 busy loops on 16 cores.

* **Deviations**: none from the plan. One test changed meaning-preservingly: `recap.test.ts` used
  `where_exp`; it now uses `where: "recap"`, and a new test pins the refusal.

* **Discoveries**:
  - **Probed on lane 1's backend** (throwaway internal mutation, removed, `_generated` pushed back):
    JSONata stopped at 101 ms with `Date.now()` moving 0; Liquid's long-path `where` over a 100k
    range stopped at 257 ms against 250; the 99-character `where_exp` refused in 6 ms; `(1..3000000)
    | where` refused in 6 ms. **A JSONata `[1..10000000]` runs a Convex mutation out of its 64 MB**
    before any timebox is asked: in TODO.
  - **A face** (a templateable field's cell, `faceOf`) fills outside any column's budget: not in
    the plan's C1 list, a view change; in TODO with a design.
  - Liquid's `capture` builds text uncounted (time-bounded only); `append` in a loop meets
    `AllocMax` at about a hundred 200-character questions.
  - LiquidJS internals now taken over: `Context.readProperty`, `spawn`, `renderLimit.check`,
    `memoryLimit.use`, `engine.filters`. All pinned by tests (each fails without its hook: the
    long-path test ran 40 s with the read check off); LiquidJS is pinned to 10.30.0.

* **For thread 3c**: nothing here touches the column grammar; `shownOf`/`drawnOf` read as before,
  the sorts too.

* **For the Coach**:
  - **Before deploying**: grep production for stored templates naming a `*_exp` filter
    (`human/20261009-cw_budgets.md`); each would stop filling in.
  - Tune `RunMs` (1 s) and `AllocMax` (1M) if a real quiz meets them.
