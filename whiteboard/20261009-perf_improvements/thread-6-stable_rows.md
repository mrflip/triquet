# Thread 6: One change, one row (2026-10-09)

Branch `20261009-stable_rows`, PR filed at landing; see the report. Stacked on thread 5's tip
(`6239f26f`). Suites: `pnpm justify` green (unit, plus the new `dom` project). `e2e/panels.spec.ts`
run 8 times after its fix, 160 of 160; the full e2e run is the landing proof.

**Measured** with `tests/components/QuizRoute.dom.test.tsx`: the real `QuizRoute` over the 40-question
`bigQuiz()`, in happy-dom, over a stand-in Convex client. Counts are Workbench renders (by
`workbenchOffers` calls), row renders (by `useReorderable` calls), and `runQuiz` calls. The before
column is the same harness over the base commit's `src`, restored afterwards and checked clean.

| one change, 40 questions | before | after |
|---|---|---|
| a title committed: Workbench / rows / runs | 3 / 121 / 1 | 1 / 1 / 1 |
| a title committed, wall (happy-dom, 3 runs) | 292 to 307 ms | 72 to 98 ms |
| a bot asked: at the ask's start | 1 / 40 / 0 | 0 / 1 / 0 |
| a bot asked and answered, in all | 4 / 160 / 1 | 1 / 3 / 1 |
| a bot asked and answered, wall | 326 to 476 ms | 71 to 72 ms |

The test asserts the after counts, so a memo that stops paying fails it. Most of what is left is
`runQuiz` (about 37 ms on the bench, unchanged here) and the frame's own render.

* **Built**:
  - **Stable questions** (`src/lib/rows.ts`). `quizFromSeen(frame, seen, was)` and
    `assembledQuiz(..., was)` take the quiz the last assembly came to. They hand back each question
    whose reading is the very same object, under the same stored-cell key, chained to the same id.
    The key is the frame's widgetings' labels and tiers plus `widgeting_ids`, per thread 4. The
    frame's own parts (`widgetings`, `columns`, `stored`, `templateable`) keep their identity while
    deep-equal. When nothing is new, they hand back `was` itself. `useQuiz` passes its held quiz,
    and so does the hunt feed's `liveSource`.
  - **Row runs** (`src/components/row-runs.ts`). `rowRunOf(run, question, specs, templateable,
    unavailableFor)` works out what each cell of a row shows (`CellRunT`: field, entry, ask, drawn,
    butnot, estimate, widgeted, collapsed, plus what a double-click re-asks). It also gives the
    question's template bag, and each templated source filled over that bag (`faces`).
    `isSameRowRun` compares two row runs by value: cells, faces, and whether there is a bag.
  - **`QuestionRow` in `memo`**, with `isSameRowProps`: every prop by identity, except `rowRun`, by
    `isSameRowRun`. The row reads nothing from the run but its row run. Every handler it gets takes
    the question's id. It gets `targetHint` (a string) in place of the questions list.
    `QuestionTable` works out the row runs once per run. Workbench's handlers are `useCallback`s; the
    ones that read the quiz or run (`onAsk`, `onMove`) read a latest ref, as `useHunt` does.
    `useFolds().unfold` and `useChecklist().toggle` are stable now.
  - **Chain options by context** (`ChainChoices` in `cells/chain.tsx`). They are made again only
    when a title, a viz, or the set of questions changes. A retitle draws every picker again, but
    not the rows.
  - **`unsaved` moved down**. `page-hold.ts` now tells listeners about writes, and
    `usePageWriting()` reads them. `ScreenMain` is the screen's `<main data-unsaved>`, and Workbench
    and ReviewScreen use it. `HuntHandle.unsaved`, `WorkbenchProps.unsaved`, `ReviewScreen`'s
    `unsaved` and `useLibraryActions().unsaved` are gone.
  - **`asking` moved down**. `useAsking` returns `{ asks, ask }`. `asks` is a per-screen store held
    outside React state. A row reads its own asks with `useAskingIn(asks, question_id)`, through
    `useSyncExternalStore`. `NoAsks` serves the preview row.
  - **Tests**: `row-runs.test.ts`, `QuestionRow.test.ts` (`isSameRowProps`), the reuse cases in
    `rows.test.ts`, `big-quiz.test.ts`, and the DOM test. There is a new Vitest project, `dom`
    (`tests/**/*.dom.test.tsx`, happy-dom). There is a new stand-in, `tests/support/fake-convex-react.ts`,
    and `bigReadingsOf(quiz)` (frame plus readings) in `big-quiz.ts`.
* **Decisions taken**:
  - **A templated box compares by what it fills in to, not by its bag.** Every run makes new bags
    (`qns` changes when any question does), so comparing bags would draw every templated row on
    every change. A row whose faces fill in the same keeps the bag it was drawn with. A draft typed
    into such a row fills over that older bag until its commit lands. That differs only if the draft
    reads something another question changed meanwhile, and the face is veiled while typing.
  - **`usePageWriting` is React state, not `useSyncExternalStore`.** The latter renders at sync
    priority. That let `data-unsaved="false"` commit a render ahead of the watches the write
    brought current, which raced `waitUntilSaved` (commit `c8fc526a`). A write's end now lands in
    the same default-lane batch as Convex's updates. The asks store keeps `useSyncExternalStore`;
    an ask's end comes before its reading in either case.
  - **`useQuiz` keeps `setHeld` during render.** It holds the quiz a missing reading falls back
    to, and it is now also the `was` of the next assembly. The second pass is of the route's hooks
    only, never of the tree.
  - **Every question is made again when a widgeting is relabelled** (the stored key changes). That
    change redraws every row through `specs` anyway.
* **Deviations**:
  - `notes/testing.md` said a view is unit tested only through `react-dom/server`. I added a
    paragraph for the `dom` project: it counts renders, and is never for behaviour.
  - `e2e/support.ts`, `foldTo`: opening a panel now waits for its MUI Collapse to finish growing
    (`.MuiCollapse-entered`). See the next section.
* **Discoveries**:
  - **The `preparedExport` flake was not identity churn.** I instrumented `useWholeHunt` and
    `ExportImportPanel` in the browser. In every failing run, `prepare` was **never called**:
    Playwright's click on *Prepare export* reported done, but nothing was withdrawn, asked, or
    refused. The click landed while the panel's Collapse (`mountOnEnter`, thread 5) was still
    opening. Waiting for the Collapse to finish took `panels.spec` from about 6 failures in 13 runs
    (load 3 to 58) to 0 in 8 (load 13 to 24). Stable identities did cut the export's withdrawals to
    real changes only.
  - Faster renders exposed the `unsaved` priority race above. Specs that `waitUntilSaved` and then
    act on what the change showed depend on that ordering.
  - React Compiler would cover the `useCallback`s and inline JSX. It would not cover the
    value-equal row runs, the identity kept through assembly, or the stores. It would not plainly
    have done this thread better, so there is nothing for `human/`.
  - Still drawn on every change: the frame (header, switcher, toolbar, `QuestionTable`'s body),
    every opened panel, and each `ChainPicker` when a title changes. `ReviewScreen`'s rows are not
    in `memo`.
* **For the Coach**:
  - **happy-dom** is a new dev dependency, listed under *Use*, *Testing* in `notes/stack.md`
    (unlisted, widely used, Vitest's own recommendation). It does not settle the *Discuss* item on
    component tests.
  - `tests/support/fake-convex-react.ts` is named apart from thread 2's `tests/support/fake-convex.ts`
    (a fake HTTP backend for scripts, unlanded), so the two do not collide.
