# Thread 3b: The column expression, authoring, template, readout, collapse (2026-10-08)

Branch `20261008-cw_expression`, PR filed at landing; see the report. Stacked on thread 2's
`20261008-cw_families`. Suites: `pnpm justify` green; the specs near the change (grid, sheets,
estimates, importing, entries, widgets, quizzes) green on lane 2, the new tests repeated six times
each. No schema change: the column's four fields were 3a's.

* **Built**:
  - **The later stages** (`src/lib/columns.ts`): `ColumnSpec` carries `template`, `readout` and
    `collapsed`; `drawnOf(spec, run, templateable, question_id)` is what a cell draws (the formula's
    widgeted from `shownOf`, then the template filled in, `{ widgeted, text, issue }`), made once
    per run; `templatedTextOf` is the sheet's. `readoutOf` (the readout in force: the column's, or
    `markdown` with a template, else null for the cells to choose), `isTypedInto` (no formula, no
    template) and `isDrawnByEditor(spec, widget)` (a field, an entry or an asked bot cell, while
    typed into) are the editability rule, in one place. A collapsed spec is `CollapsedWidthPx`
    (20) wide with a turned header; its `width_px` is untouched.
  - **Templating** (`src/lib/templating.ts`): `valuedBagOf` (the question's bag over the finished
    questions, templateable sources filled, with `value`), `computes(widget)`, `imagesLinkedIn`
    exported. Liquid still only through `Templating.fill`.
  - **The menus** (`src/lib/column-menu.ts`, `ColumnMenu`): `refChoicesOf(quiz)` (fields, the
    view, the keys, question widgetings, `quiz.<label>`s, the bag's words, grouped);
    `presetsFor(subject)` over `PresetSources`, a list: an estimates entry's parts, and the field
    names of `quiz`, `hunt`, `realm`, each category and each question (from `QuizBagValidators`'
    shapes). Anything else offers none: the formula box is the "other".
  - **Generic fields**: `src/components/FormulaField.tsx` (MUI `Autocomplete` `freeSolo` over
    presets; `formulaIssueOf`) and `src/components/TemplateField.tsx` (`templateIssueOf`, Liquid's
    own sentence). Each commits on blur, empties to null, and says its own sentence.
  - **The column's fields** (`src/components/ColumnFields.tsx`): `ColumnRefField` (*Shows*,
    grouped), `ColumnFormulaField`, `ColumnTemplateField`, `ColumnReadoutField`,
    `ColumnCollapsedField`, and `ColumnStagesFields` composing the last four. Each takes
    `{ column, locked, onCommit(patch) }`: no dialog state.
  - **The editor** (`ColumnsEditor.tsx`): *Shows* lists refs only; each row unfolds (*Formula,
    template and readout of X*) to `ColumnStagesFields`. The new-column dialog has a Formula field
    with the presets, so a part column is the widgeting plus `$.masie` picked there.
  - **The grid**: `QuestionRow.bodyOf` draws a collapsed cell empty, a typed-into cell in its
    editor, and everything else through `readoutBody` (`DrawnReadout` in `cells/readouts.tsx`
    for a readout in force; the old drawings otherwise). Thread 2's checkbox and select cells come
    through `EntryCell`, so the rule gates them too. `QuestionTable`'s head: a double-click
    collapses or restores (`onCollapse`, offered with `reviseLayout`), the second click of it
    sorts nothing, a collapsed head has no sort button, and heads select no text.
  - **Sheet and sorts**: `cellTextOf` carries the template's text; sorts are unchanged (they read
    `shownOf`, the formula's value).
  - **Importer**: a pasted column's formula, template, readout and collapse are set as pasted on a
    held column, and taken off when the paste lacks them (they were dropped before).
  - `columnPatch.collapsed` takes null (restoring takes the field off). Additive to the action's
    validator only.

* **Decisions taken**:
  - **A template, like a formula, works only on an `ok` value**: `missing` and `errored` pass by,
    so the dash and the badge show. (An empty estimates cell is `missing`, so a template on the
    estimates column itself shows the dash; its parts by formula still work, 3a's rule.)
  - **A readout draws only a read-only cell.** A field, an entry or an asked bot cell typed into is
    drawn by its box whatever the readout says; the Readout field is disabled there and says so.
    Applying a readout to the asked bot cell (`AskedBody`) is left; nothing needs it yet.
  - **Images**: under a markdown readout (a template's default), a value whose ref is not typed
    text (a `jsonata`/`aibot` widgeting, a word of the bag, an unknown widget) has its images made
    links before it reaches the template or the markdown. The sheet carries the images as typed.
  - **The double-click's first click sorts**: a sortable head's first click sorts at once, as it
    always has; only the second is ignored. Holding the sort until a double-click is ruled out
    would be a timer, a small state machine (a tripwire). A collapsed head offers no sort, so
    restoring never sorts.
  - Changing the ref keeps the formula and template; the author clears them.
  - The template's bag is the finished bag (templateable sources filled), as the pipeline orders it.

* **Weighed, for the generic fields** (the Coach's rule on new input kinds): CodeMirror 6
  (`@uiw/react-codemirror`, with a Liquid or JSONata mode) and Monaco would give highlighting and
  completion, but are heavy, need `notes/stack.md`'s process (Discuss), and the fields are one or
  a few lines; `react-simple-code-editor` with Prism is lighter but unmaintained-ish and still a
  hand-wired highlighter. **Chosen: MUI only** (`Autocomplete` `freeSolo` for presets, `TextField
  multiline` for the template), monospaced. Revisit if 7's or 5a's fields grow to whole templates.

* **Deviations**: none from the plan.

* **Discoveries**:
  - The *Collapsed* switch shows the quiz's own value, so it turns only once the server echoes
    (no optimistic update for `edit_column`); an e2e must click and wait, not `check()`.
  - The importer dropped a pasted column's formula on a held column before this thread.

* **For later threads**:
  - **5a**: lift `ColumnRefField` and `ColumnStagesFields` into the folding editor; the row's
    local `unfolded` state is the place `use-folds` goes. `FormulaField` is the folded line's
    formula field for a `jsonata` widgeting too.
  - **5b**: `drawnOf`, `readoutOf` and `isDrawnByEditor` are what the row preview draws through.
  - **7**: `readoutOf` is where a column showing a `liquidize` defaults to `markdown` (it needs
    the widget; `drawnOf` already has the run), and `Templating.computes` should count
    `liquidize`. `TemplateField` is the `template` param's field.
  - **8**: add a `PresetSource` to `ColumnMenu.PresetSources` for the seeded sums.

* **For the Coach**:
  - The double-click on a sortable head sorts once before it collapses (above). Say if the sort
    should wait for the double-click to be ruled out.
  - `.head` gained `user-select: none` in `workbench.module.css`, so a double-click selects no
    words of the header: a one-line CSS rule beside the rest of the head's.
