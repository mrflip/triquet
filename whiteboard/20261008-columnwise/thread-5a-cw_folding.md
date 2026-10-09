# Thread 5a: Folding editors, columns leading (2026-10-08)

Branch `20261008-cw_folding`, PR filed at landing; see the report. Stacked on the spine's top at landing (thread 6's #198 among it).
Suites: `pnpm justify` green; at landing `pnpm e2e --touched` reached the whole suite (276 passed;
thread 6's three regex specs ported to the folded line and green; `panels.spec.ts:43`, `:197` and
`routing.spec.ts:718` failed under load and passed alone). No schema
change, no new dependency.

* **Built**:
  - **The formulary's folded fact** (`src/lib/formulary/formularies.ts`): `folded: 'params' |
    'formula' | null` beside `refresh` and `store`; `entry` folds to its params, `jsonata` to its
    formula, `aibot` to nothing. Thread 7's `liquidize` adds `'template'` (its template line).
  - **`WidgetingPanel.tsx`**: one panel per widgeting. Folded, one row: its fold, its label and
    what it works, its tier mark (in the run order), and its **folded line** (`FoldedLine`: an
    entry's params through `EntryParamsFields` with `layout="line"`; a formula's formula,
    read-only; nothing for a prompt). Open, the same row with more beneath: its label
    (`ExplicitField`, *Relabel*), its description (kept on blur), the widget it works with the
    admin's *Edit the widget…* door, the columns showing it (`columnsShowing`, each a fold opening
    `ColumnMoreFields`), and its removal (`ConfirmRemove` with thread 4's refusal).
  - **`ColumnsEditor.tsx`**: each column a panel (`ColumnPanel`): its row (title, ref, width,
    alignment, label, giving way by `RoomFor`) unfolding to `ColumnMoreFields`; beneath a column
    showing a widgeting, that widgeting's panel, folded to its line. *+ New column…* is a menu:
    *Showing something the quiz has…* (`RefPicker`), *A new entry…* (the catalogue, entries only),
    and for whoever may change the library *A new widget…* (`NewWidgetDoor`); each made at once.
  - **`ColumnFields.tsx`** gains `useColumnCommit` (the row's old `commit`, now with
    `retitledPatch`), `ColumnMoreFields`, `ColumnTitleField`, `ColumnWidthField`, `RefPicker`,
    `ColumnIssue`.
  - **`WidgetingsEditor.tsx`**: the run order's rows are `WidgetingPanel`s, tier marked; *+ New
    widgeting…* and *+ New quiz widgeting…* open the catalogue inline (`NewWidgetingPicker` in
    `NewWidgeting.tsx`), made as picked, with the admin's *New widget…* door beside it.
    `WidgetPicker.tsx` is the catalogue, moved out of the retired dialog.
  - **Retired**: `ColumnDialog` and `WidgetingDialog`, and their Apply batching.
  - **`ExplicitField.tsx`**: a field whose change waits on its own button, saying *Not kept yet:
    Relabel keeps it.* while it waits, its draft following what is held while nothing is typed
    (`explicitShown`). The quiz label, hunt name and hunt label in the manage dialog, and every
    column and widgeting label, go through it (thread 4's two review leftovers).
  - **Folds** (`use-folds.ts`): `useFoldSet(scope)`, held by `Workbench` so the manage dialog's
    panels stay as left across a reopen and start folded for another quiz; keys per place a panel
    is drawn (`layout-folds.ts`, `LayoutFoldkeys`), so a copy beneath one column folds apart from
    another; whatever is made arrives open (`madeFoldkeys`).
  - **Lib**: `newColumnShowing(quiz, source)` (`widgeting-edit.ts`); `retitledPatch(column, patch)`
    (`models/column.ts`); `planWidgetingEdit` heads a column still headed after a widgeting's old
    label after its new one.
  - Docs: `notes/vocabulary.md` (*catalogue*, *folding editor*, *folded line*, *widgeting panel*);
    the record's §7 gains *As built (5a)*; `whiteboard/TODO.md` gains a 5a section.

* **Decisions taken**:
  1. **A `jsonata` widgeting's folded line is its widget's formula, read-only.** The formula is
     the widget's, behind its door (§7); the panel's open rows carry the admin's door to it.
  2. **Made at once, named after.** With no dialog to type a label into first, a pick makes the
     widgeting (labelled as its widget, `_2` while taken) and its column; it arrives open to be
     relabelled. So **a column still headed as `namesFor` heads what it shows follows** a change of
     its ref, its formula (a part picked: *Category Data* becomes *Masie*) or its widgeting's
     label; a header the author wrote stays. Without this the e2e's old expectation (a column
     headed after the label typed) has no way to happen.
  3. **The column's panel and the widgeting's are contiguous**: the column's row, its open rows,
     then the widgeting's line and its open rows, indented. The widgeting copy sits inside the
     column's `group`, so a spec scopes a column's whole gearbox at once.
  4. **Fold state lives in `Workbench`** (the manage dialog mounts only while open), scoped by the
     quiz's id; per copy, not per widgeting.
  5. ***+ New widgeting…* and *+ New quiz widgeting…* stay** beside the run order, as the
     catalogue inline: a library widget that is not an entry needs a way in at the question tier,
     and the quiz tier has no column. 5b decides their home when the section becomes *Run order*.
  6. The new-column menu's first item picks a ref rather than making a column of the first
     unshown thing: no column the author did not ask for.
  7. A folded line keeps to its row: a param's help text shows only in the stacked fields (the
     widget editor), its issue in both.

* **Weighed** (new input kinds are generic facilities): `ExplicitField` is MUI `TextField` and
  `Button`; no form library (react-hook-form and the like) is warranted for one field and one
  button. The pickers are MUI `Autocomplete`. Nothing hand-rolled past MUI.

* **Deviations**:
  - The relabel retitle (decision 2) is unasked; it keeps "add a column, then name it" whole.
  - `+ New widgeting…` kept (decision 5).

* **Discoveries**:
  - A number box's keystroke guard trims a value past its *most* as it is typed, so a refusal
    sentence for a *most* cannot be reached from the cell: a spec tests the *least*.
  - Playwright's `getByRole` skips what `display: none` hides, so a field shown only when the row
    hides it (`ColumnMoreFields`' `beside`) is the one found at a narrow width: a spec folds the
    panel first (`foldBy` in `e2e/support.ts`).
  - The advice and preview of a widget written through a door are told no widgeting (TODO).

* **Review** (`fixed`): `c31d2b3` (folded params stop showing what was sent once the held params
  move elsewhere; `pendingShown` exported and tested) and `298de82` (`ExplicitField` drops what was
  typed once what is held moves off it). Left, minor:
  1. `retitledPatch` reads the column as last loaded: a pick landing within a round trip of a
     title's blur can put the default header back over the typed one. The fix is Convex optimistic
     updates on the quiz's dispatch (TODO).
  2. A widgeting's relabel and its column's retitle are separate mutations, so a relabel the
     server refuses still retitles the column (TODO).
  3. `ExplicitField` gives way to a relabel made elsewhere while the author is typing, as
     designed (`explicitShown`); recorded only.

* **For later threads**:
  - **5b**: the *Widgets* panel's open state is `WidgetingPanel` (context `WidgetingPanelContext`:
    hunt, quiz, library, sources, revisable, changeable, dispatch, changeLibrary, folds, all in
    `Workbench`), with `foldkeyOf` of a key of its own; the run order's *Entries* and
    *Widgetings* lists in `WidgetingsEditor.tsx` are the drag list to move. The new-widgeting
    buttons (decision 5) need a home when the section becomes *Run order*.
  - **7** (`liquidize`, not landed at this thread's `ready`): `folded: 'template'` on its
    formulary, a `'template'` arm in `FoldedLine` (`TemplateField` over the `template` param, as
    `FoldedParams` commits through `revise({ params })`); its `LiquidizeParamsFields` from the
    retired widgeting dialog becomes the panel's open rows.
  - **6**: the regex field joins `EntryParamsFields`; in `layout="line"` it shows its issue, not
    its help.
