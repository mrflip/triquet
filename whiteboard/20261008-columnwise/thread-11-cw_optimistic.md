# Thread 11: Optimistic updates (2026-10-09)

Branch `20261009-cw_optimistic`, PR filed at landing; see the report. Suites: `pnpm justify` green;
a full `pnpm e2e` before review, 285 passed and 3 flakes each green alone (`categories.spec.ts`, a
reviewer's total order; `prompts.spec.ts`, a prompt revised from the library; `routing.spec.ts`,
the friend's hunts list). None of the three is a race this thread covers. The landing's full run is in the
report and the PR.

* **Built**:
  - `src/state/optimistic-quiz.ts`: `showPerformed`, Convex's `withOptimisticUpdate` on
    `hunts.perform` (`useHunt`, memoized: `withOptimisticUpdate` makes a new mutation each call). It
    parses the action with `ActionValidators.huntAction` as the server does, then patches the
    watched `quizzes.open` frame and `questions.open` readings, by kind: `edit_question` and
    `set_chain` (a chain written as its target's label), `enter_widgeted` and `enter_quiz_widgeted`
    (one `ok` row, or none), `edit_column` (null takes a field off; a rename carries the sort
    memory), `edit_widgeting` (label and description; a rename carries the columns' sources, the
    templateable nomination and what it stored, for the quiz and each question), `sort_questions`
    (left alone when the ids are not exactly the quiz's: `sortStale`), `move_question` (`Rank`,
    `qnumSortkeyOf`, as the server). An update that throws is reported (`Postmortem`) and never
    stops the write.
  - `Workbench.onSort` dispatches through `carryOut` and takes its arrow back when the sort is
    refused, as the optimistic order is taken back.
  - `tests/state/optimistic-quiz.test.ts`: each kind shown early on a stand-in store, then carried
    out through convex-test, and the two compared, stamps aside: the update makes the server's
    change.
  - `notes/queries_hooks_and_subscriptions.md` says where the quiz's optimistic updates live.

## The survey: each workaround, and what became of it

| Workaround | Replaced by | Now |
|---|---|---|
| Thread 9's sort-after-save waits, `e2e/widgets.spec.ts` (sort by a computed column), `e2e/ordering.spec.ts` (`fillQuiz`), `e2e/client-first.spec.ts` | `edit_question` and `sort_questions` shown early | removed |
| `e2e/grid.spec.ts`: the wait before a double-click sort on Q#, and before a template is drawn over a title just typed | `edit_question` | removed |
| `e2e/entries.spec.ts`, "an entry rides the export": the wait before the import's plan reads the quiz | `enter_widgeted` | removed |
| 5a's `retitledPatch` item: a ref or formula picked within a round trip of a title's blur sends the default header back | `edit_column` (the column as shown holds the title at once) | struck from TODO; no code to remove |
| 5b's relabel-then-edit race (`useColumnCommit`, `WidgetingPanel`'s `revise` address the label as last loaded; the title lost in "a column can be added…") | `edit_column` and `edit_widgeting` relabels | struck |
| `Workbench.onSort` sets the arrow before dispatching, so `sortStale` leaves it wrong | the arrow taken back on refusal | struck |
| `FoldedParams`' memory of params sent (`pendingShown`, 5a) | — | **kept**, TODO amended |
| `useReorderable`'s `sentTo` (an arrow press before the move lands) | — | **kept** |

The 63 `waitUntilSaved` mentions left are legitimate: before a reload or navigation, before another
browser or visitor reads the server, before the server's export (`preparedExport`, `labelAt` in
`importing.spec.ts`), before a negative check that an edit landed (`ishes.spec.ts`'s staleness),
settles in a `beforeEach` whose checks retry anyway (`sheets.spec.ts`, `ishes.spec.ts`), and around
actions not shown early (params in `entries.spec.ts`'s `setParams`, the smith's note in
`widgets.spec.ts`).

**Flakes these explain** (the e2e log, 17 full runs): `widgets.spec.ts` "a column can be added for
anything…" (3, the relabel race), `entries.spec.ts` "an entry rides the export" (1, an echo landing
after the import's plan). Thread 9's sort race never reached the log: the waits hid it. Neither
flaked in the full run above. The rest of the log's flakes (reviews, routing, panels' counts,
categories) are load, not a missing update.

* **Decisions taken**:
  - **"Adding, then removing"**: two workarounds stay, being simpler than the update.
    `FoldedParams` keeps params the server refused in their fields, and thread 6's regex courtesy
    says its sentence beside them (`entries.spec.ts`, "a regular expression that could take too
    long…"); an optimistic params update is taken back on the refusal and the sentence with it, so
    params are not shown early. `sentTo` serves the columns' and widgetings' lists too, whose moves
    are not shown early, in six lines.
  - **Not shown early**: `retitle_quiz` (`quiz-history.spec.ts` reads the tab's title as the sign an
    edit landed), `relabel_quiz` (the address follows), anything needing a server id
    (`add_question`, `new_quiz`), imports, deletions, `set_viz`, `set_templateable` (its checkbox
    shows the quiz's nominations by design), the notes, `move_column`/`move_widgeting`, and the
    library (`widgets.perform`). Each is a few lines here if a wait starts to show.
  - The entered value is not held to its params in the update: the cells refuse before sending,
    and the server's refusal takes the update back.

* **Discoveries**:
  - Convex applies an optimistic update synchronously inside the mutation call, re-runs it on every
    server result until its write is reflected, and does not catch a throw: one would stop the
    write being sent and break every later result. Hence the `try`.
  - The hunt's history feed (`hunt-feed.ts`) watches the same queries, so it sees an optimistic
    reading: a commit made while a write is in flight may hold the change a moment early (stamps
    behind), and a refused one is undone by the next commit. Acceptable while the history is a view,
    not a source of truth.
  - For thread 10: this module reads only the frame and the question readings, never the bag; expect
    no conflict beyond `whiteboard/TODO.md`.

* **Review**: `fixed`. `8fd0b361`: a retyped entry keeps its row's `_creationTime`, as the
  server's `db.replace` does, pinned by a test. At landing, the two entry cases' bare `value` names
  became `entered` (STYLE.md). The reviewer's other findings were minor, and were not relayed to
  this worker in detail; the orchestrator's relay holds them.

* **For the Coach**: the two kept workarounds above (your "adding, then removing" question), and the
  list of kinds not shown early.
