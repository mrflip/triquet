# Thread 11: Let quiz and question widgetings interleave (2026-10-07)

Branch `20261007-recap_interleave`, PR filed at landing; see the report. Suites: `pnpm justify`
green (typecheck, lint, 4829 unit tests); `pnpm e2e --touched` chose the whole suite and proved it
(248 passed; 8 failed in the full run under load and passed alone, unchanged: `panels` x2,
`reviews` x3, `routing` x3, none near this thread).

**No schema change, no migration.** Positions already written are tiered (thread 6 wrote them
whole), so every existing quiz runs exactly as it did; only new moves and adds can mix the tiers.

* **Built**:
  - **One run order, in `position` order, tiers mixed.** The runner (`src/lib/formulary/runner.ts`)
    runs `source.steps` as given: a quiz widgeting runs once over the questions as the widgetings
    before it left them; a question widgeting reads every quiz widgeting before it as
    `quiz.<label>`. Nothing else in the runner changed: it already threaded `qns` and `quizNow`
    step by step.
  - **`src/lib/run-order.ts` and its test are deleted** (pivot, `tieredOf`, `withAdded`,
    `movedWithin`, `quizListOf`). So are `SortableList`'s `isFixed` and `useReorderable`'s `fixed`,
    which served only the pivot row (restored to their pre-#166 text).
  - **Server** (`convex/writing/layout_actions.ts`): `addWidgeting` puts a new widgeting of either
    tier last (`position: rows.widgetings.length`), still refusing `tierUnoffered` and a reserved
    quiz label; `moveWidgeting` is `movedTo` over the whole list, as `moveColumn` is; delete
    closes the gap without reordering. `readsOfRows` (the library read to tell entries from
    formulas) is gone.
  - **Gear**: one *Widgetings* list (`WidgetingsEditor`, no `tier` prop), both tiers, each row
    with an outlined MUI `Chip` saying *each question* or *whole quiz*; doors *+ New widgeting…*,
    *+ New quiz widgeting…*, *Widget library…*. `QuizManageModal` has one *Widgetings* section
    with copy covering both tiers; the *Quiz widgetings* section is gone.
  - Tests: runner (a mixed run: a quiz count between two question widgetings sees the first, not
    the second, and is read by the second), `layout_actions.test.ts` (adds go last, a move counts
    the one list and leaves the tiers mixed, delete keeps the mix), `e2e/quiz-entries.spec.ts`
    (one list, tier marks, a quiz entry stepped above a question widgeting survives a reload).
  - Docs: `notes/vocabulary.md` *tier* and *run order* rewritten, *questions pivot* removed (named
    as history); `whiteboard/TODO.md` thread 6's two pivot items struck; `WidgetsPanel`'s doc block
    and `notes/decisions/2026-10-widgets.md` (*The quiz tier*, an amendment above the old bullet).
* **For the Coach (deploy)**: #166 is on production. A tab still on that bundle during this
  deploy sends `move_widgeting` with an index counted in its own tier's list (`add_widgeting` carries no index: it just goes last), which
  the new server reads as places in the whole list, until it reloads: reload open tabs after
  deploying.
* **Decisions taken**:
  - **One list with a tier mark, not two lists.** Two lists cannot show where a quiz widgeting
    sits among question widgetings, and a drag within one list could not express it. With one
    list `move_widgeting`'s `onto_idx` is the index in the whole run order, the same on client and
    server, and the same rule `move_column` uses. The action's shape is unchanged.
  - **A new widgeting goes last, whichever its tier** (the pre-#166 rule). Predictable, reads
    everything before it, and an import (which adds widgetings in their exported `position`
    order) now rebuilds the order faithfully, closing thread 6's TODO item. Cost: a quiz entry a
    question formula should read (`quiz.playtesters`) must be dragged above it; thread 6 placed
    entries above the pivot automatically.
* **Discoveries**:
  - `pnpm e2e --touched` ran the whole suite for this branch (some path here, likely under
    `convex/` or `src/lib/`, is not in `SpecCorners`' narrower map).
* **For thread 12**: the bag's construction is untouched and still in one place (`bagsOf`,
  `quizBagOf` in the runner; `Templating.bagOf` over `run.frame`/`run.qnsAfter`).
* **For thread 7**: `add_widgeting` and `move_widgeting` no longer read the library; authorization
  unchanged.
