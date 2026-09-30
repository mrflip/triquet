# Foldable UI: a fold triangle for the smith's note and the question grid

Sprint plan, 2026-09-30. Mode: **normal** (not YOLO). Issued by the Coach (Flip).
**Status: planned.**

Four threads, stacked in order: an investigation, a reusable fold affordance, then its two uses:
the smith's note and the question grid. `foldable_ui-progress.md`, beside this file, is newer than
this plan wherever the two disagree.

## Read first

Beyond CLAUDE.md and its auto-loads (`notes/views.md`, `notes/stack.md`, `notes/testing.md`):

* `STYLE.md` and `notes/vocabulary.md`, before naming anything (the fold, its states, its hook).
* `src/components/use-checklist.ts` -- batch mode, the precedent the Coach points to: view state
  in a hook beside the view, never in the database, reset when the quiz changes (`scopekey`).
* `src/components/QuestionTable.tsx` (the grid's top-left header cell holds the batch-select
  button) and `src/components/QuestionRow.tsx` (a row's height is measured from its Clueing and
  Hint boxes, clamped between `RowFloorPx` and `RowCapPx`, and imposed on every cell as `heightPx`).
* `src/components/QuizHeader.tsx` -- the smith's note, a multiline MUI `TextField` beside the
  quiz title; and `src/components/ReviewScreen.tsx`, which shows the note read-only on the
  playtesting screen.
* `notes/stack.md`, *Hand-rolled on purpose*: the grid is a bespoke `<table>` on purpose. Nothing in
  this sprint reopens that.

## Ground rules

`notes/git_hygiene.md` (*A thread, start to finish*, *Sprints*) and
`.claude/agents/thread-worker.md` govern. Particular to this sprint:

* **Fold state is view state.** Open/closed never reaches Convex, as batch mode doesn't. Whether it
  survives a reload (per-browser `localStorage`) is the worker's call to propose, not to assume;
  the default is plain React state.
* **Library first, emphatically.** The Coach said it twice: prefer a library or MUI's own
  machinery and less code, even at the cost of the tri-state behaviour thread 4 describes. Thread
  1's findings decide what threads 2 to 4 build on.
* **No state-machine library.** The Coach ruled it out; the question is UI/UX machinery.
* **Accessibility is part of the affordance**: a fold control is a button with `aria-expanded`
  (and `aria-controls` where it names one region). ARIA has no "mixed" for `aria-expanded`;
  thread 4's third state is visual unless the chosen machinery says otherwise.

## Threads

### 1. Investigate fold machinery

> look over the plan. investigate what libraries or existing framework capabilities might offer
> the "folding triangle" feature, and whether they're worth it. We don't need a state machine
> library, the question is what UI / UX level machinery would mean we write less and better code.

*Gloss.* No product code. A findings file, `whiteboard/20260930-foldable_ui/fold-machinery.md`,
and a docs-only PR. Candidates the orchestrator can already see, to weigh and not to presume:

* MUI's own: `Collapse` (its `collapsedSize` prop folds to a partial height -- possibly exactly
  thread 3's "the height of the title box"), `Accordion`/`AccordionSummary` (the canonical MUI
  disclosure, likely too heavy for a grid row), `IconButton` with `ArrowRight`/`ArrowDropDown` or a
  rotated `ChevronRight` (what MUI's own docs and MUI X's tree view use), `TextField`'s
  `minRows`/`maxRows` (folding a multiline field may be no more than `maxRows={1}`).
* MUI X `SimpleTreeView` / DataGrid row-detail panels: expand/collapse machinery, likely a poor
  fit for a bespoke table and cells that are live editors; say why or why not.
* The platform: `<details>`/`<summary>` (native disclosure, keyboard and ARIA for free; how it
  composes with MUI and a table), CSS `interpolate-size` / `field-sizing`, `::details-content`.
* Headless libraries (Radix Collapsible, React Aria's `Disclosure`/`DisclosureGroup`, Headless
  UI `Disclosure`) -- judged by `notes/stack.md`'s test, and against adding a second component
  vocabulary beside MUI.
* Whether any of them offers a tri-state (open / closed / mixed) "fold all" control, or a
  convention for one (tree views' expand-all, IDE code folding, VS Code's collapse-all).

**Look-ahead.** The findings must answer, for each of threads 2 to 4: what to use, how much code
it leaves us, and what it costs. Thread 4's Coach note ("if there is some sort of library for this
do NOT take my UX advice") makes this thread's verdict on tri-state binding: if the recommended
machinery has a convention for fold-all, say what it is, so thread 4 can follow it. End with a
recommendation, and name anything that is a *Discuss* in `notes/stack.md` or unlisted (a
significant question: blocks thread 2 until the Coach answers).

### 2. A reusable fold affordance

> Add reuseable capability for the standard right-pointing-triangle "fold open/closed"
> affordance. To any extent there's framework support or a library for this please use it
> (orchestrator: look ahead to the other usage when deciding). An open/closed state should not be
> in the database, it's more like the batch mode thing..

*Gloss.* Built on thread 1's recommendation. Likely a small component in `src/components/` (the
triangle button: right-pointing when closed, down when open, `aria-expanded`, a label) and, if
it earns its keep, a hook beside it for the open/closed state, shaped like `use-checklist`.
Tests per `notes/testing.md`.

**Look-ahead.** Two consumers, designed for together:

* Thread 3: one boolean, one region (the smith's note).
* Thread 4: a *set* of open rows plus a quiz-wide toggle, and possibly a third, "mixed", visual
  state on the triangle itself. The affordance should be able to show that state if thread 1
  finds no library convention that rules it out; the set-of-open-rows logic probably belongs to
  thread 4, not here, unless it falls out naturally (then declare it pulled forward).
* The grid's triangle lives in a header cell 30-odd px wide beside the batch-select button, so
  the affordance must come in a compact size that matches `IconButton size="small" sx={{ p: 0.25 }}`.

### 3. Fold the smith's note

> The smith's note will be multi-line by nature: so you're either editing it and want it to stay
> open, or it's boring and closed. Make it so I can fold them closed: they will assum the height
> of the title box when closed

*Gloss.* `QuizHeader.tsx`: a triangle beside (or inside the label of) the smith's note; closed,
the note is one title-row high. Open questions for the worker to settle by judgment and record:
the starting state (closed seems to match "boring and closed", but a blank note is one line
either way), whether focusing a closed note opens it (probably yes, as thread 4's rows do), and
whether the playtesting screen's read-only note (`ReviewScreen.tsx`) folds too -- "fold *them*"
may mean every place the note shows. Keep e2e specs that type into the note working.

**Look-ahead.** Thread 4 reuses thread 2's affordance and whatever "focus opens it" mechanism
this thread settles on; do it the same way in both.

### 4. Fold the question grid

> Also add a folding triangle in the very top left of the quiz (claiming some of the empty space
> of the  batch-mode control -- it should not cause the quiz grid to shift).
> When the folding triangle is folded "closed", all the elements in the grid go to a single line.
> Clicking in a text field element expands that element to regular height, with the other
> elements in the row following suit. Don't implement anything that would automatically fold them
> closed again. The contract is 1. If I toggle the fold-triangle when "open" or "mixed", everything
> is closed and the triangle is "closed". If I click to edit a field, that row becomes open and
> the fold-triangle is "mixed". If I toggle the fold-triangle when it is "closed", everything
> opens and it is open. The quiz starts closed. New rows are open. The quiz does not become open
> by opening all the elements.
> NOTE: if there is some sort of library for this do NOT take my UX advice: follow its conventions
> and capabilities. I would prefer to use a library and have minimal code, even if that means no
> tri-state behavior.

*Gloss.* Two pieces:

* **The corner.** `QuestionTable.tsx`'s top-left `<th>` stacks the batch-select button (and, in
  batch mode, the select-all checkbox). The triangle joins that stack without widening the
  gutter (`GutterWidthPx`) or changing the header's height enough to move the grid.
* **The rows.** A closed row imposes a single line: plausibly just `heightPx` clamped to the
  floor instead of the measured height in `QuestionRow.tsx`, so every cell follows at once. Focus
  in any text field opens its row. New rows (added after load) start open; the quiz starts
  closed. State per the contract above -- a quiz-wide mode plus a set of open rows, reset when the
  quiz changes, as `use-checklist` does -- unless thread 1 found machinery with its own
  conventions, which then win.

Watch the mobile card layout (below 640px): folding probably doesn't apply there, or applies
differently; say which. e2e specs that read or type into cells must still pass with the grid
starting closed.

## For the Coach

* Nothing blocking at plan time. Thread 1 may surface a *Discuss*-listed or unlisted library;
  if so the sprint pauses there for your word before thread 2 builds on it.
* Thread 3's scope question (does the note on the playtesting screen fold too?) is left to the
  worker's judgment, recorded in the progress document.
