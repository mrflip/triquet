# Thread 1: Gearbox: the (i) facility, the entries note, one remove-with-confirm, unique ids (2026-10-09)

Branch `20261009-lfb_gearbox`; the PR is filed at landing (see the report). Suites: `pnpm justify` green
(5652 unit tests); e2e not yet run (it runs at landing: `widgets`, `archiving`, `routing` specs changed).

One commit per ask: ask 2 `20e5243c`, ask 1 `3098ca61`, ask 5 `ebb030ea`, the duplicate ids
`bb70dc70`, and a note in `notes/views.md` `1e1bfa95`.

* **Built**:
  - `src/components/InfoTip.tsx`: **`InfoTip`**, a small `InfoOutlined` `IconButton` named
    "About <topic>", its prose in a MUI `Tooltip` that opens on hover, keyboard focus and a tap
    (`enterTouchDelay={0}`, held 20 s), and stays open while the pointer is over it (links work).
    One size (`p: 0.25`, small icon), which sits in a dense row as well as beside a heading.
    **`Explained`** puts one at a field's end, level with a small text field's box.
    `ExplicitField` gains `about` (the tip at its row's end); `helperText` is now optional.
  - The gearbox (`QuizManageModal.tsx`): Columns, Run order, Templates, History, Hunt and Archived
    questions each have a `SectionHeading` (local) with the tip in place of their paragraph. The
    explaining helper texts moved onto tips: the quiz label, hunt name, hunt label, column label,
    column formula, column template, the ref picker, the widgeting label, the widgeting
    description, and the folded formula. LL Export's inline (i) is now an `InfoTip`.
  - `RunOrder.tsx`: the Entries note is gone; a `Divider` between the Entries and Widgetings lists
    when both have members (both the gearbox's run order and the Widgets panel).
  - `ConfirmRemove.tsx`, rewritten: `form: 'text' | 'icon'` (text button "Remove column", or a
    bin named the same), `act: 'Remove' | 'Delete'`, `refusal`, `disabled`. Pressed, either form
    opens the same MUI `Popover` over the button, `Keep it` exactly where the button was and
    `Yes, remove` beside it, the question beneath; Keep, Escape or a click elsewhere keeps the
    thing. The popover is an `alertdialog` named "<Act> <noun>?". Now used by the columns, the
    widgetings, the widget editor (as before) and, new, the archived questions' delete (bin,
    *Delete*) and the members' remove (bin).
  - `lib/column-menu.ts` `refChoicesOf` offers a widgeting only where its ref resolves to it;
    `ColumnFields.tsx` keys the menus' choices by group and ref (`choiceKeyOf`; `getOptionKey`
    on `RefPicker`'s Autocomplete).
  - `e2e/support.ts` `answerRemoval(page, 'Yes, remove' | 'Yes, delete' | 'Keep it' | 'Escape')`;
    `widgets`, `archiving` and `routing` specs answer the question through it (the popover is
    outside the panel that asked). The column-removal spec now also proves Escape keeps it and
    leaves the gear's dialog open.
  - Unit tests: `tests/components/InfoTip.test.tsx`, `ConfirmRemove.test.tsx`,
    `ColumnFields.test.ts` (new), `RunOrder.test.tsx` and `tests/lib/column-menu.test.ts` (added to).
* **Decisions taken**:
  - **The confirm is a Popover over the button**, not an inline swap. It gives Escape, click-away
    and focus for free (no hand-rolled blur or key handlers, which `notes/views.md` flags), and,
    since it overlays rather than reflows, it costs a dense row (thread 2) no width. "Same place":
    the popover's paper is offset so *Keep it* lands where the button was; a bin at the window's
    right edge gets the popover shifted left to stay on screen. *Keep it* is under the pointer, so
    a double click on the button keeps, never removes.
  - **Tab does not blur it away**: the popover is modal and holds focus until answered (Escape or
    click-away). The plan said "reverts on blur"; this is the library's version of that.
  - **The duplicate "categories" could not be reproduced on today's spine.** #209 (landed just
    before this sprint) refuses `categories` and `category` as widgeting labels and stopped
    `resolve` looking for a widgeting under a bag word, so no menu can now list `categories` twice.
    The cause was what the plan suspected: the ref menu listed a legacy widgeting labelled
    `categories` beside the bag word, and `RefPicker`'s Autocomplete keys options by their label,
    so MUI warned of duplicated values (`getOptionKey`) and React of two children keyed
    `categories`. Fixed for good either way: the menu offers each ref once, and keys are scoped
    by their parent (the group). The new unit test fails without the fix.
  - **DOM ids** in the column and widgeting editors were already `useId`, which React derives from
    the component's place in the tree, so they are already scoped by the parent chain and cannot
    collide; I did not replace them with label-built ids, which could. No label-built `id` exists
    in the gearbox (the one in `panels/Panel.tsx`, `panel-${title}`, is thread 3's).
  - Members' remove joined `ConfirmRemove` (the plan said "every inline remove"; taking someone off
    the hunt had no confirm at all), as a bin, keeping its name `Remove <label>`.
* **Deviations**: none from the plan's substance. The "Widgetings" paragraph of the plan is the
  gearbox's *Run order* section. The Hunt section had no paragraph of its own; its tip says what
  the hunt is plus `AppNotices.deletingHunt`, and the categories link stays visible.
* **Discoveries** (for thread 2):
  - Left for the sweep: `NewWidgetingPicker`/`WidgetPicker`'s helper text ("Pick what its cells
    take ..."), which sits beside the ref picker in the same *+ New column* flow;
    `ColumnReadoutField`'s "drawn by their editor" (kept: it reports why the field is disabled);
    LL Export's smith's-note paragraph; the panels' blurbs (thread 3's screens).
  - In the gearbox, a widgeting and the column showing it share a label by default, so
    "Reorder <label>" and "Widgeting <label>" each appear twice in the dialog (columns list and
    run order). The specs scope by list; if thread 2's rows want unique names, scope the handle's
    name by its list noun.
  - `InfoTip` and the bin are both `size="small"` with `p: 0.25`-ish footprints; the un-archive
    button in the archived list is now `size="small"` to match the bin.
  - Screenshots, desktop (1400) and narrow (420), in the scratch directory
    `/tmp/claude-1000/-workspace-triquet/f30ef132-9ff1-4794-9ac7-84d07c95cc9e/scratchpad/lfb_gearbox/`:
    `wide-*.png`, `narrow-*.png` (gear, tip open, column unfolded, confirm, run order, archived),
    `more-*.png` (Widgets panel with the divider, members' bin and its question, archived bin and
    its question).
* **For the Coach**: whether a widgeting may be labelled with a bag word is now settled by #209
  (it may not); the editor copes with a legacy one either way.
