# Thread 2: Gearbox: the widgeting and column rows line up, with an icon grammar (2026-10-09)

Branch `20261009-lfb_rows`, PR filed at landing; see the report. Suites: `pnpm justify` green
(5712 unit tests); before review, e2e green on panels, routing, widgets, grid, entries and
categories after catching up onto threads 3 and 4 (157 tests). Before the last catchup, prompts,
quiz-entries, reviews, failing-pages, estimates, sheets, importing and recap were green too.

One commit per ask: ask 3, ask 4, the sweep, and a `fix:` to the e2e fold helper the sweep showed
was needed.

* **Built**:
  - **Ask 3, widgeting rows** (`WidgetingPanel.tsx`, `RunOrder.tsx`): every row is built from
    fixed-width slots, `RowSlots` in `room.ts` (grip, fold, title, tier). A missing grip leaves a
    blank as wide, so rows line up whatever their content. The title block is a new
    `WidgetingTitle`: the formulary's mark, then the widgeting label, then the widget label on a
    line of its own (it never rides the first line). A double-click on the block toggles the fold.
    The open fields line up under the title (`pl: 7`).
  - **The icon grammar**: `FormularyIcons` in `widget-words.ts` gives formula a sigma
    (`Functions`), prompt a robot (`SmartToyOutlined`), entry a keyboard (`KeyboardOutlined`) and
    template braces (`DataObject`). `FormularyMark.tsx` draws the icon, named by its noun
    (`titleAccess`) with the gist in its tooltip. It is used in the Widgets panel rows, the rows
    beneath columns, the gear's run order, the widget library dialog (in place of the noun text)
    and the widget picker's options.
  - **Ask 4, column rows** (`ColumnsEditor.tsx`): the column title field takes `RowSlots.title`,
    the same width as a widgeting's title block, so the widgeting beneath lines up under it. Folded,
    the row holds `ColumnToggles` (`ColumnToggles.tsx`), three icon buttons:
    - the readout, which cycles unset (`HdrAutoOutlined`), plain (`Abc`), markdown (a quill,
      `HistoryEdu`), code (`Code`) and label (`SellOutlined`); see `readoutAfter` in `lib/columns.ts`.
      It is disabled while the cell's editor draws the column.
    - *Templated* (`DataObject`, `aria-pressed`), only where the source can be templated (else a
      blank slot keeps the alignment).
    - *Collapsed* (`TextRotateVertical`, `aria-pressed`).

    Unfolded, the toggles leave the row (their slot stays blank), and the fold holds the full
    controls: the Readout select, the Collapsed switch, and a new *Templated* checkbox
    (`ColumnTemplatedField`). That checkbox also appears in a widgeting's "Shown by the column"
    folds.
  - **Templated is one state**: `Templating.nominationsWith` (pure, extracted from
    `TemplateableEditor`) builds the whole `set_templateable` list. `templatableOf` in
    `lib/columns.ts` says which source a column nominates. `columnTemplatingOf` and
    `columnStagesOf` in `ColumnFields.tsx` feed both the row and the fold.
  - **The sweep** (explaining prose onto `InfoTip`):
    - `Panel` takes `about` (an (i) beside its heading, visible while folded). Its `blurb` is now
      optional and kept for news: "No such quiz", "Not on this hunt", the login gate.
    - `TabbedPanel` takes `about`, and each tab's `about` shows as an (i) at the end of the tab
      row while that tab is open.
    - `ClosableTitle` takes `about`, used for the widget library.
    - Moved: every panel blurb under the quiz, on the hunt page, the categories page and the
      orphaned-repos page, plus the Export / Import tabs; LL Export's smith's-note line
      (`Explained`); the new-widgeting picker's helper (`WidgetPicker` takes `about`); the widget
      editor's explaining helpers (label, description, prompt, input formula, formula, template,
      entry kind, formulary); and the `liquidize` read-from formula's helper.
    - Validation and error helper texts stay where they were.
  - Tests:
    - new: `tests/components/ColumnToggles.test.tsx` and `tests/components/panels/Panel.test.tsx`
      (Panel and TabbedPanel).
    - extended: `FormularyIcons` (`widget-words.test.ts`), `RunOrder.test.tsx`, `readoutAfter` and
      `templatableOf` (`tests/lib/columns.test.ts`), `nominationsWith` (`templating.test.ts`).
    - e2e: new `grid.spec.ts` test, *a folded column's toggles ...*; `entries`, `panels` and
      `widgets` specs now read the mark by its role and name, and the Members test reads its (i).
* **Decisions taken**:
  - **"Push the label onto the next row"**: I read the second label as the widget's label (the old
    "entry memo"). The noun became the icon, and the widget label always takes a second line, so
    every title block has the same shape.
  - **The toggles sit after the alignment button**, which already cycles in place, rather than
    at the row's head, so in-place state reads as one group.
  - **The readout's unset state has its own icon** ("as the cells choose"), not a dimmed copy of
    whatever it resolves to.
  - **The (i) on a `Panel` sits in its title bar**, so the explanation is a hover away even while
    the panel is folded.
  - `RoomFor` in `ColumnsEditor` moved to `label @880 / source @770 / width @470`, since the title
    no longer flexes. The *Shows* select flexes (`1 1 180px`, at most 300px). At the narrowest
    widths the toggles wrap beneath the title.
  - **Reorder names stay unscoped.** "Reorder <label>" and "Widgeting <label>" still repeat in the
    gear (columns list and run order). The lists that hold them have different names, and scoping
    the names would touch `SortableList` and seven spec lines for little gain. Left for a later
    pass if the Coach wants it.
* **Deviations**: the plan offered a double-click on titles to fold; I did it for widgetings only
  (a column's title is a text field, so it is skipped, as the plan allowed). Folds are still
  booleans (`FoldSet`), so `use-fold` was not needed.
* **Discoveries**:
  - **The e2e fold helper raced the Collapse animation.** `unfoldBy` and `openPanel` returned as
    soon as `aria-expanded` flipped. A MUI Select or Popover opened from inside a Collapse that was
    still opening sometimes never showed. This hit `routing.spec.ts:679` and
    `widgets.spec.ts:275`, about 1 in 4 runs each. Removing the blurbs moved those fields up into
    the opening region, which is what exposed it. `foldTo` (`e2e/support.ts`) now waits for
    `MuiCollapse-entered`. After the fix, 32 out of 32 repeated runs passed.
  - Not swept, left for the Coach to judge:
    - `Footnote.tsx`, the grid's long "Each question chains..." paragraph. It is an explanation, but
      it is styled as a deliberate visible reminder.
    - `HuntsList`'s blurb (thread 4 had just rewritten that screen).
    - `IdentGate`'s login blurb (it is guidance at the front door).
    - In-content microcopy in `SpreadPanel`, `CategoriesRoute`, `RecapPanel` and the
      categories-link line in the gear.
  - Screenshots, all in `.../scratchpad/lfb_rows/` and all with an `n` variant at 420px:
    - `before-*`: before the change.
    - `a3-*`: widgeting rows.
    - `a4-*`: column rows. `a4-clueing-open.png` shows the fold's full controls, and
      `a4-clueing-templated.png` the toggles.
    - `sw-*`: the sweep. `sw-io.png` shows a tab's (i) open, and `sw-widgets.png` the Widgets panel.
* **For the Coach**:
  - Is it right that the grid's footnote stays visible?
  - Should the "Reorder <label>" names be scoped by list?
  - Icon choices are a two-way door: change them in `FormularyIcons` and `ReadoutFaces` (in
    `ColumnToggles.tsx`).
