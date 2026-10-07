# Thread 6: Quiz-level widgetings and entries (2026-10-06)

Branch `20261006-recap_quiz_widgetings`, PR filed at landing; see the report. Suites: `pnpm justify`
green (typecheck, lint, 4776 unit tests); e2e `quiz-entries.spec.ts` (new, 2 tests) and
`widgets`, `entries`, `panels`, `prompts`, `importing` specs green on lane 4; the full e2e runs at
landing.

**No row was widened.** Quiz widgeteds live in a new table, `quiz_widgeteds`; the pivot is not
stored. Nothing here needs folding into thread 1's `Serial Deploy: recap` chain, and nothing for
thread 9 to tighten. A new table deploys with no backfill.

* **Built**:
  - **Run order across the tiers**, `src/lib/run-order.ts` (`RunOrder`): `tieredOf`, `runOrderOf`,
    `quizListOf` (the gear's list, with `Pivot` among them), `movedWithin`, `withAdded`, each taking
    a `tierOf` (`ownTier` for widgetings).
  - **The runner** (`src/lib/formulary/runner.ts`): steps run in `runOrderOf` order; a `quiz` step
    is worked out once over a bag with `qn: {}` and `qn_label: ''` (`quizCellOf`), or projected from
    `RunSource.quizStoredOf`; its widgeted joins every later bag's `quiz` as `quiz.<label>`.
    `QuizRun` gains `quizWidgeteds`, `quizAt` (the quiz each bag held); `frame.quiz` is the quiz once
    every widgeting ran, so `Templating.bagOf` reads `quiz.<label>` unchanged. New:
    `quizWidgetedOf`, `isQuizWide`, `quizBagAt`; `bagsAt` and `statusCounts` know the quiz tier.
  - **Models**: `Widgeting.runsAt(widget, tier)` (only `jsonata` and a non-`estimates` entry at
    `quiz`); `Quiz.mayLabelQuizTier` (not `Quiz.exposed`); `QuizT.stored` (the quiz's own stored
    histories, by label, default `{}`); the quiz's integrity check refuses a column or a templated
    source naming a quiz widgeting, and a quiz widgeting labelled as `Quiz.exposed`;
    `WidgetedValidators.quizRow`, `.quizEntered`; `QuizBagValidators` describe `quiz.<label>` and
    the empty `qn`.
  - **Server**: table `quiz_widgeteds` (`by_quiz_id_and_widgeting_id`, `by_widgeting_id`), stamped,
    signalled, `HuntOwned` in `WritingRules`. Action `enter_quiz_widgeted` (content action,
    `mayReviseClaimedQuiz`: smiths only, refused while locked) through `enterQuizWidgeted` and
    `upsertQuizWidgeted`. `addWidgeting` places by `RunOrder.withAdded` and refuses `tierUnoffered`
    and a reserved quiz label (`labelTaken`); `moveWidgeting`'s index counts the widgeting's own
    tier's list (the quiz's with the pivot); delete and move write the run order whole.
    `enter_widgeted`, `record_widgeted`, a column's source and `set_templated` refuse the wrong tier
    (`wrongTier`). `deleteWidgeting` takes `quiz_widgeteds` rows too. `quizzes.open` sends a smith
    `stored` (as a question's), a reviewer nothing; `quizRowsFor` reads `quizStored`; reads skip
    quiz widgetings per question.
  - **Views**: the gear's *Quiz widgetings* section (`WidgetingsEditor tier="quiz"`, list *Run once
    for the whole quiz*, a fixed *The questions* row via `SortableList`'s new `isFixed` /
    `useReorderable`'s `fixed`); `planWidgetingEdit` takes `tier` (no column for `quiz`, picker
    filtered by `runsAt`). `QuizEntriesPanel` in `Panels.tsx` (after Members): each quiz widgeting
    in run order, an entry in a MUI box of its kind committing on blur (`useDraft`, `NumberField`),
    a formula as its value or failure. `WidgetsPanel` says "once for the quiz". `ColumnsEditor`
    and `templatableSources` offer question widgetings only.
  - **Export**: a quiz body carries `widgeteds: { <label>: { status, value } }` when it has any quiz
    widgetings (so the hunt's git history keeps them); question bodies leave quiz widgetings out.
    An import reads no question's value under a quiz entry's label.
  - Tests: `tests/lib/run-order.test.ts`; runner, quiz-bag, templating, models, rows, exporting,
    importing, widgeting-edit additions; convex: `hunts.test.ts` *enter_quiz_widgeted*,
    `layout_actions.test.ts` *widgetings run once for the whole quiz*, `quizzes.test.ts`, schema,
    policy rules, soundness copies; `e2e/quiz-entries.spec.ts`.
* **Decisions taken**:
  - **The pivot is not stored.** It sits before the first question widgeting; positions stay one
    list. No migration, and the runner is honest under any positions (a quiz widgeting placed among
    question widgetings runs after them all).
  - **Amended after review (sprint decision 12, the reviewer's option b):** in a quiz with no
    question widgetings the pivot sits just before the first quiz formula (after the entries), or
    last, and the first question widgeting added goes there (`RunOrder.withAdded`, `tieredOf`'s
    `readsOf`). Before, a formula over the questions added before any, or left when the last was
    deleted, ended up above every question widgeting added later and silently read none of them.
    Cost: a formula meant to run above the questions in such a quiz must be dragged back above them
    once they come, and while there are none a formula dropped above the pivot snaps back below.
    The server reads the library in `addWidgeting` and `moveWidgeting` to tell formulas from entries
    (`readsOfRows`); the gear's list draws the pivot by the same rule.
  - **The pivot row is fixed, not dragged**: an action cannot name it (`questions` is a reserved
    label), and dragging the others past it reaches every order.
  - **Placement of a new widgeting**: an entry for the quiz just above the pivot (it reads nothing,
    so every formula can read it); a quiz formula at the very end; a question widgeting at the end
    of the question widgetings (in a quiz with none, just above the first quiz formula).
  - **`jsonata` is in** (it fell out of the runner); `aibot` and `estimates` are refused at the quiz
    level.
  - **Quiz entries are a smith's**, sent and written as a question's stored widgeteds are.
  - **Names**: `quiz_widgeteds` table; `enter_quiz_widgeted`; refusals `tierUnoffered`, `wrongTier`;
    panel title *Quiz entries*. Vocabulary: *tier*, *run order*, *questions pivot*, *widgeted*.
* **Deviations**: none from the plan's Decision 7. `WidgetingEdit.tier` is optional (defaults to
  `question`), so existing callers needed no change.
* **Discoveries**:
  - Playwright's role names match substrings: the quiz list is named *Run once for the whole quiz*
    and its button *+ New quiz widgeting…* so `'Widgetings'` and `'+ New widgeting…'` stay unique.
  - The stamp backfill test now types its map as every stamped table but `quiz_widgeteds`: a table
    made after stamps began needs no backfill.
  - `notes/convex.md` *Denormalized fields* says "The copies:" and lists none (the table went
    missing earlier); `Copies` in `tests/support/soundness.ts` is the list, and has the new rows.
* **For thread 5**: `{{quiz.<label>}}` works in the recap head and tail through
  `Templating.bagOf(run, null)` with no change on your side; an author makes a quiz text entry
  (say `playtesters`) under the gear's *Quiz widgetings*, types into it in *Quiz entries*. Expect a
  conflict in `Panels.tsx` (both threads add a panel and a prop).
* **For thread 7**: the new write is `enter_quiz_widgeted` (`ContentPolicies`,
  `mayReviseClaimedQuiz`), the new table `quiz_widgeteds` (`WritingRules`, `HuntOwned`), the read
  `quizzes.open`'s `stored` (smith only). `addWidgeting` now refuses by tier.
* **Left** (`whiteboard/TODO.md`, *From recap sprint, thread 6*): import of the quiz's own entries;
  an import keeping a quiz widgeting's side of the pivot; `aibot` at the quiz level; templating a
  quiz text entry; a draggable/stored pivot.
