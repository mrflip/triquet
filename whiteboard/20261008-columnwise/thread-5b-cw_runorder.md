# Thread 5b: The run order in both places, and the row preview (2026-10-09)

Branch `20261009-cw_runorder`, PR filed at landing; see the report. Stacked on the spine's top at
landing. Suites at `ready`: `pnpm justify` green; chosen e2e runs of `widgets`, `panels`,
`entries`, `quiz-entries`, `prompts` and of `grid`, `sheets`, `quizzes`, `client-first`,
`archiving`, `ordering`, `estimates`, `importing`, `recap` all green there or alone (flakes below).
`e2e/support.ts` changed, so `--touched` reaches the whole suite. No schema change, no new
dependency.

* **Built**:
  - **`RunOrder.tsx`**: `RunOrderList`, the one run-order list both homes draw (entries at its
    head, never dragged; the rest a `SortableList`, a drop sent as `move_widgeting` through
    thread 2's `runOrderIdxOf`), each row drawn by the caller; `RunOrderLine`, the gear's row (handle,
    label, what it works, tier mark, description cut to the line). `runOrderListsOf(widgetings,
    library)` in `src/lib/widgeting-edit.ts` splits the two lists, tested.
  - **The *Widgets* panel** (`panels/WidgetsPanel.tsx`): its rows are 5a's `WidgetingPanel`s,
    handles and tier marks on, folded by `LayoutFoldkeys.widgeting` in `Workbench`'s fold set; each
    row adds how its cells stand (`aside`), each open panel the widget's formula or prompt verbatim,
    a prompt's input formula and the advice button, or an entry's sentence (`children`). At its
    head *+ New widgeting…* and *+ New quiz widgeting…* (the catalogue inline, `NewWidgetingPicker`).
    `Panels` and `Workbench` hand it `dispatch` and the fold set.
  - **The gear's *Run order*** (`QuizManageModal.tsx`): the drag list alone, `RunOrderLine` rows.
    `WidgetingsEditor.tsx` is gone, and with it the dialog's *Widget library…* button and its
    `onEditLibrary` prop (the toolbar keeps the door).
  - **`WidgetingPanel`** gains `aside` (more of its first row) and `children` (more of its open
    rows), and exports `TierChip`.
  - **The row preview** (`RowPreview.tsx`, above the column list in `ColumnsEditor`): the quiz's
    questions in a select (`PreviewQuestionPicker`, split out of `PreviewPicker`; the pick is
    `usePreviewQuestion`, split out of `usePreviewBag`), and that question's `QuestionRow` under the
    grid's own heads (`ColumnHead`, extracted from `QuestionTable`), from `specsFor` and the
    screen's run, `locked`, no grip, no checkbox, every handler inert. `QuizManageModal` takes
    `run` for it.
  - Tests: `tests/lib/widgeting-edit.test.ts` (`runOrderListsOf`), `tests/components/RunOrder.test.tsx`
    (what a gear row says). e2e: the helpers put widgets to work and relabel through the Widgets
    panel (`widgetsPanel`, `widgetingPanel`, `widgetingAdded`, `closePanel`; folding waits until
    what it folds is hidden); new specs for both homes' drag lists, the gear's run order having
    nothing to unfold, the entries heading both, a widgeting edited in the Widgets panel, a column
    removed from its widgeting's list there, and the row preview.
  - `scripts/spine.ts`: `WidgetsPanel`, `RunOrder`, `WidgetingPanel`, `NewWidgeting` and
    `WidgetPicker` in *the gear and the Widgets panel* (every spec putting a widget to work walks
    them); `RowPreview` in *the gear*.
  - Docs: `notes/vocabulary.md` (*run order*'s two homes, *row preview*), the record's §7 *As built
    (5b)*, `whiteboard/TODO.md` (a 5b section), the Category spread's empty sentence.

* **Decisions taken**:
  1. **The new-widgeting menus live at the head of the *Widgets* panel** (the orchestrator's
     suggestion): the one place every widgeting, columnless or not, is edited, and where a made
     one arrives open to be relabelled. The gear's *+ New column…* keeps *A new entry…* and *A new
     widget…*.
  2. **The gear's *Run order* rows are lines, not panels**: "the drag list alone" read literally;
     editing a widgeting happens in the Widgets panel or beneath its column, so it has no third
     home. Its blurb says where.
  3. **The Widgets panel's folded row is the widgeting panel's**, plus how its cells stand; the old
     row's description snippet and its give-way of the widget's name are gone (the name always
     stays; the description is a field once open). Its open rows keep what the panel promised: the
     widget's formula or prompt exactly as it stands, and the advice button. A formula is so shown
     twice when open (one line folded, verbatim below); kept, since a long formula reads badly on
     one line.
  4. **The preview sits above the column list**, headed as the grid heads (turned heads and all),
     and draws only what is kept: a title typed shows once its field is left, params once the
     server takes them. So no draft `regex` reaches it (thread 6's review).
  5. The preview's select is the widget editor's question select, split out rather than copied;
     it lists Q# and title, as the editor's does, rather than bare labels.

* **Deviations**: none from the gloss. Pulled forward: nothing.

* **Discoveries**:
  - A param changed in the Widgets panel and a cell typed into at once can race: e2e
    `setParams` now waits until saved.
  - MUI's `Collapse` leaves its content findable while it folds: a spec that folds a panel and then
    queries the page waits for the fold to finish (`foldTo`).
  - Flakes seen under load, each passing alone: `widgets.spec.ts` *a column can be added…* (twice:
    a width and title sent within a round trip of the column's relabel go to the old label; in
    TODO), `prompts.spec.ts` *a prompt opened from the library…* (an ask straight after a library
    edit), `panels.spec.ts` *the Copy button…* and *Download Full History…* (the Raw Export tab in
    `beforeEach`), and once `widgets.spec.ts` *a widget says how far…* (*New widget…* clicked
    with the catalogue's listbox open, no dialog came; not seen again in three repeats).

* **For the Coach**:
  - Decisions 1 to 3 above are the visible ones; each is a small change if you want it otherwise.
