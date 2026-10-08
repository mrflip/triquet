# Thread 4: Removal and commit model (2026-10-08)

Branch `20261008-cw_removal`, PR filed at landing; see the report. Suites: `pnpm justify` green;
on lane 3, `widgets`, `routing`, `quizzes`, `archiving`, `quiz-history`, `entries`, `estimates`,
`prompts` and `quiz-entries` specs green (two flakes, each green alone: `routing.spec.ts:621`, a
friend's Members panel, and `prompts.spec.ts:92`).

* **Built**:
  - `src/lib/columns.ts`: `columnsShowing(quiz, label)`, the columns showing a widgeting whole or
    a part, each found through `resolve`; `widgetingRemovalRefusal(quiz, label)`, the sentence
    naming them (by title, or label when untitled), or null.
  - `src/lib/notices.ts`: the refusal `widgetingShown` and `widgetingShownNotice(columnNames)`.
  - `convex/writing/layout_actions.ts`: `deleteWidgeting` refuses (`widgetingShown`, with the
    sentence naming the columns) instead of cascading to them. It still takes its widgeteds and
    its templateable nomination with it, and rewrites the run order. `deleteColumns` folded into
    `deleteColumn`, its one caller now. A quiz's deletion (`quiz_writing.deleteQuiz`) still
    cascades, untouched.
  - `WidgetingsEditor.tsx`: `ConfirmRemove`'s `refusal` carries the same sentence; the removal
    question no longer says "the columns that show it".
  - `QuizManageModal.tsx`: *Relabel* beside the quiz label (disabled until the label changes, as
    the hunt's are); the foot holds only *Done*. The two Relabel buttons are named `Relabel quiz`
    and `Relabel hunt` for a screen reader.
  - Tests: `tests/lib/columns.test.ts`, `tests/lib/notices.test.ts`,
    `tests/convex/writing/layout_actions.test.ts` (refusal and sentence, the part column holding it
    back, a formula reading it not holding it back); e2e `widgets.spec.ts` (refused, naming the
    column; removed once the column is), and the manage dialog's buttons in `support.ts`
    (`closeManage` clicks Done), `routing`, `quiz-history`, `archiving`, `quizzes`.

* **Decisions taken**:
  - **One sentence, server and browser**: both call `widgetingRemovalRefusal`, so the toast a
    stale browser gets and the editor's line read the same, naming the columns: "The column
    “Spare” still shows that widgeting — remove the column first."
  - The *Relabel* still closes the dialog, as the hunt's Rename and Relabel do: the address moves
    with a relabel.

* **Discoveries** (for 3a, and 5a):
  - **3a's merge**: `columnsShowing` counts a column when `resolve` comes back `kind: 'widgeting'`
    with `widgeting.label` the one asked. A plain key that is a widgeting's label resolves so
    already. If 3a's `resolve` gives `quiz.<label>` a kind of its own, `columnsShowing` must count
    it too (a column showing a quiz widgeting holds it back like any other); if `resolve`'s
    signature changes, only its one call in `columnsShowing` follows.
  - **5a** can list a widgeting's columns with `columnsShowing` (the widgeting panel listing its
    columns' foldables).
  - A dangling column can now arise only through an import, as §8 says; `specFor` already skips one.

* **For the Coach**:
  - Minor: *Done* drops a quiz label (or hunt name or label) typed and not yet Relabelled, as
    *Cancel* did. Commit-as-you-go makes that easier to miss; 5a could mark an unsaved label.
    The review (clean) also found the label draft goes stale if the quiz is relabelled elsewhere
    while the dialog is open. The orchestrator gave both to thread 5a.
