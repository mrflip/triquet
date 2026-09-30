# Foldable UI: progress

The running handoff for `foldable_ui-plan.md`, newer than the plan wherever they disagree.
Workers add their sections below the table, newest first.

## Status

| Thread | Label | Status |
|---|---|---|
| 1 | Investigate fold machinery | complete (docs-only PR) |
| 2 | A reusable fold affordance (+ the editable note's fold, pulled forward) | complete (PR #56) |
| 3 | Fold the smith's note on the playtesting screen | complete (PR #57) |
| 4 | Fold the question grid | complete (PR #59) |

*Orchestrator (after thread 1):* the Coach ruled the playtesting screen's note folds too (overrides
thread 1's lean). Thread 2 takes the editable note's fold as its first consumer; thread 3 keeps the
playtesting screen. See the plan's revised glosses.

## Thread 4: Fold the question grid (2026-09-30)

Branch `20260930-fold_grid`, PR #59, stacked on #57. Suites: typecheck, lint, unit (97 files,
2244 tests), e2e (190, run as `pnpm test:e2e:agent`), all green, after rebasing onto main (#54).

* **Built**:
  * `src/components/use-folds.ts`: **`useFolds(itemkeys)`**, a `ReadonlySet` of folded ids in
    React state, started as every item there at mount; `anyOpen`, `isFolded`, `unfold`,
    `setAllOpen`. Pure parts exported and tested (`tests/components/use-folds.test.ts`):
    `unfoldIn` hands back the same set when the item is already open, so focusing an open row
    re-renders nothing; `anyOpenIn` asks only about items still in the list.
  * `QuestionTable.tsx`: the hook, `FoldButton` (default small size, label "Show questions in
    full", `aria-controls` the `<tbody>`'s `useId`) in a `Tooltip` above the batch button in the
    corner's `Stack`; each row gets `folded` and `onUnfold`. Below 640px (`useMediaQuery`, the
    same query as the CSS module's card layout) every row is passed `folded={false}`.
  * `QuestionRow.tsx`: `FoldedRowPx = 28`; folded, `heightPx` is that instead of the measured
    height; the `<tr>` carries `rowFolded`, `data-folded` (for e2e), and
    `onFocus={openOnEntry(onUnfold)}` while folded.
  * `workbench.module.css`: `.rowFolded .face, .rowFolded .scrolls, .rowFolded .field
    { overflow: hidden }`.
  * `Workbench.tsx`: `QuestionTable` keyed `grid-${quiz._id}`.
  * e2e: four specs in `grid.spec.ts`; `foldedRows(page)` in `support.ts`.
  * `notes/stack.md`, *Hand-rolled on purpose*: an entry for the fold set beside `useChecklist`'s;
    `notes/views.md` names it among the closed tripwires.
* **Decisions taken**:
  * **The hook lives in `QuestionTable`, reset by `key`**, not `useChecklist`'s `scopekey`: the
    fold set is the table's alone (nothing else reads it), and thread 2 reset `QuizHeader` the
    same way. The key is `grid-${quiz._id}` because `QuizHeader`, a sibling, is keyed by the bare
    id, and React wants sibling keys unique (the first try logged duplicate-key warnings).
  * **The triangle stacks directly above the batch button**, at the bottom of the tall corner,
    rather than at the very top of the cell: the corner's controls stay together, bottom-aligned
    with the column titles, and in a quiz whose header is short (no turned titles) the stack
    still fits, where a triangle pinned to the top would sit on the batch button. Checked by
    screenshot.
  * **The glyph is unchanged.** In the corner the `ArrowRight` matches the batch icon's weight
    and reads as a triangle; `FoldButton` is as thread 2 left it.
  * Tooltip: "Fold every question to one line" while any is open, "Show every question in full"
    when none is, as the batch button's tooltip changes with its state. The accessible name stays
    fixed.
* **Deviations**: none from `fold-machinery.md` or the orchestrator's note.
* **Discoveries**:
  * Every existing e2e spec passed with the grid starting folded, unchanged: they focus a box
    before reading or typing, which opens its row.
  * A locked quiz's rows still open on focus (a read-only box still takes focus), which is how a
    locked quiz is read in full. The corner works on a locked quiz too.
  * Rebasing onto main (#54 merged) moved `20260930-fold_machinery`, `-fold_button`,
    `-fold_playtest_note` and `-foldable_ui_start` locally; none of those was pushed from here.
    `prerebase/20260930-fold_grid` tags the tip from before.
* **For the Coach**: the triangle glyph and the fold-all behaviour are worth a look on PR #59.
  Fold state is not kept across a reload.

## Thread 3: Fold the smith's note on the playtesting screen (2026-09-30)

Branch `20260930-fold_playtest_note`, PR #57, stacked on #56. Suites: typecheck, lint, unit (96
files, 2225 tests), e2e (185, run as `pnpm test:e2e:agent`), all green.

* **Built**:
  * `src/components/ReviewScreen.tsx`: **`SmithsNoteReading`**, the reviewer's reading of the
    note pulled out of `ReviewScreen` into its own small component, with a `FoldButton`
    (`size="medium"`, the same label as the editable note's, "Show the smith's note in full")
    before the "Smith's note" heading, its `controls` naming the note's paragraph (`useId`).
    Folded, the paragraph is `Typography noWrap`; open, `whiteSpace: 'pre-wrap'` as before.
    Rendered with `key={quiz._id}`, so another quiz starts folded. `ReviewScreen`'s doc block no
    longer says "in full".
  * `e2e/reviews.spec.ts`: the "paragraphs and all" spec now walks the fold: starts folded
    (`aria-expanded="false"`, `text-overflow: ellipsis`, one line-height tall, the paragraphs
    run together), the triangle unfolds it to the full text, and folds it back to one line.
* **Decisions taken**:
  * **Starts folded**, as the editable note does, and as the plan leaned ("boring and closed").
    The ellipsis says there is more. Only the triangle folds or unfolds it (read-only: no
    `openOnEntry`).
  * **`noWrap`, not `Collapse` or a line clamp.** `noWrap` is MUI's own one-line clamp, one prop.
    It runs the paragraphs together, so the folded line previews as much of the note as fits,
    and always ellipsises when anything is cut. `Collapse` with `collapsedSize` would animate
    (the editable note doesn't) and needs a line height picked by hand; a CSS
    `-webkit-line-clamp` would show only the first paragraph, and is styling we'd write.
  * The triangle hangs a little into the Paper's padding (`ml: -1.5`), so the glyph sits near the
    text's left edge. Checked by screenshot, desktop and 400px wide.
* **Discoveries**:
  * The playtesting screen shows the note as **plain text** (`pre-wrap`), not rendered markdown
    as the workbench's face does. Left as it was. If it is ever rendered as markdown, `noWrap`
    stops fitting (block children), and `Collapse` with `collapsedSize` becomes the right tool.
  * `ReviewScreen` isn't keyed by quiz in `QuizRoute`, so view state inside it survives moving
    between quizzes; hence the key on the note.
  * Pushing needs gh's credentials (`notes/git_hygiene.md`, *Filing the PR*): plain `git push`
    fails in the container.
* **For the Coach**: a reviewer may need the note to play (a theme, instructions). If starting
  folded hides too much from them, starting it open is a one-word change
  (`useState(false)` in `SmithsNoteReading`).

## Thread 2: A reusable fold affordance (2026-09-30)

Branch `20260930-fold_button`, PR #56, stacked on #55. Suites: typecheck, lint, unit (96 files,
2225 tests), e2e (185), all green.

* **Built**:
  * `src/components/FoldButton.tsx`: **`FoldButton`**, MUI's `IconButton` showing `ArrowRight`
    folded and `ArrowDropDown` open (swapped, not rotated), with `aria-expanded`, an optional
    `aria-controls` (`controls`), and a fixed `aria-label` (`label`). Controlled: `open` and
    `onOpenChange(open)`, no state of its own. `size="small"` (the default) is the grid corner's
    `size="small" sx={{ p: 0.25 }}` with a small icon, 24px; `size="medium"` is an ordinary
    `IconButton`, 40px, as tall as a small `TextField`. Every other `IconButton` prop passes
    through (so a `Tooltip` can wrap it); `sx` does not.
  * Same file: **`openOnEntry(onOpen)`**, an `onFocus` handler that opens a fold when focus lands
    in a `textarea` or a non-checkbox, non-radio `input`. Written for thread 4's `<tr onFocus>` as
    well as the note: React's focus events bubble, and the filter keeps the batch checkbox, the
    grip, the ask buttons and the chain `<select>` from opening a row.
  * **Pulled forward from thread 3: the editable smith's note folds** (`QuizHeader.tsx`). The
    triangle sits outside the field, before it, top-aligned (`size="medium"`). `maxRows={open ?
    SmithsNoteMaxRows : 1}`; `onFocus={openOnEntry(...)}`, so a click on the rendered face or a
    tab into the note opens it; while folded the face gets `overflowY: hidden`. The note's
    `TextField` now takes an `id` from `useId()`, which the triangle's `aria-controls` names.
  * `Workbench.tsx`: `QuizHeader` is keyed by `quiz._id`, so switching quizzes starts the header
    afresh (note folded, drafts its own).
  * e2e: a new spec in `e2e/quizzes.spec.ts` (starts folded, typing opens it and it stays open
    after blur, the triangle folds it to the same one-line height and clips the face, reopens,
    and after a reload a click on the face opens and focuses it). `holderOf(field)` in
    `e2e/support.ts`: the element a text box sits in, for finding its face.
* **Decisions taken**:
  * **The note starts folded**, and nothing folds it but its triangle. "You're either editing it
    and want it to stay open, or it's boring and closed": editing opens it, and it stays open
    until folded by hand, as thread 4's rows will. A blank or one-line note looks the same
    either way, so the triangle is always shown rather than appearing and disappearing.
  * **The label is fixed**: "Show the smith's note in full", with `aria-expanded` saying whether it
    is; not "Smith's note", which would give the button and the textbox one name.
  * **Reset per quiz by `key`**, not the `scopekey` pattern: `QuizHeader` is a component, and
    React's own way to reset a component's state when its subject changes is a key. `useChecklist`
    needs `scopekey` only because it is a hook in `Workbench`.
  * **No hook.** The note needs one `useState`; thread 4's fold set is its own.
  * Fold state is plain React state: not Convex, not `localStorage`.
* **Deviations**: none from `fold-machinery.md`. `onFocus` on the note arguably trips `notes/views.md`'s
  "DOM handlers beyond click and change" tripwire; it is what the plan asked for and is reported.
* **Discoveries**:
  * Folded, the note is 40px, top-aligned beside the 58px title box, and reads as one row with it
    (checked by screenshot, desktop and 400px wide; below 640px the triangle and note wrap under
    the title together).
  * `onToggle` is a DOM prop on `IconButton` (the popover `toggle` event), so the callback is
    `onOpenChange`, React Aria's and Radix's name for it.
  * A `Tooltip` around `FoldButton` works because props pass through; thread 4's corner may want
    one to match the batch button's.
* **For thread 3** (the playtesting screen's note): `FoldButton` serves a region that isn't a
  field: give the region an `id` and pass it as `controls`. It is read-only, so no `openOnEntry`.
* **For thread 4**: `<FoldButton open={anyOpen} onOpenChange={...} label=... controls={tbodyId} />`
  in the corner at the default size; `onFocus={openOnEntry(() => { unfold(question._id) })}` on the
  row's `<tr>`.
* **For the Coach**: the triangle glyph is small, at the note's medium size as at the grid's
  small one (`ArrowRight` draws 5 by 10 in a 24 box). Worth a look at PR #56 before thread 4
  copies it; `ChevronRight`/`ExpandMore` are larger if wanted.

## Thread 1: Investigate fold machinery (2026-09-30)

Branch `20260930-fold_machinery`, PR #55, on `main`. Suites: typecheck, lint, unit (96 files, 2225 tests), e2e (184), all green.

* **Built**: `fold-machinery.md`, beside this file: the findings. **Threads 2 to 4 read it
  before designing**; each has its own section there, with what to use, the code it leaves and the
  cost. No product code.
* **Decisions taken**:
  * **No new package.** The affordance is MUI's `IconButton` swapping `ArrowRight` and
    `ArrowDropDown`, as MUI's Collapsible table demo does, with `aria-expanded`. The note folds by
    `maxRows={open ? SmithsNoteMaxRows : 1}`. The grid folds by clamping `QuestionRow`'s `heightPx`
    to one line (28px).
  * **Fold-all follows MUI X's convention, and is binding on thread 4**: one two-state button
    worked out from the rows. Anything open, it folds all; nothing open, it unfolds all. No
    "mixed" face and no quiz-wide mode. Every click in the Coach's contract comes out the same;
    only the third face goes.
  * Rejected: `Collapse` for the editable note (it clips the outlined label and needs a hand-picked
    height), `Accordion`, `<details>` (closed content can't be focused), MUI X Tree View and Data
    Grid Pro, React Aria / react-stately, Radix, Headless UI. Reasons are in the file's table.
* **Discoveries**:
  * A throwaway Playwright probe (deleted, tree clean) measured the fold.
    * The note folds from 224px to 40px, against the title box's 58px.
    * A folded grid row is **58px, not 28**: the Title cell's label metaline and the askable
      cells' 44px `min-height` hold it there.
    * The grid corner is 165px tall in a new quiz, because of the headers turned on end, so the
      triangle fits without a shift.
    * Folded, the rendered faces are `overflow-y: auto` over taller content and need
      `overflow: hidden` while folded.
  * Below 640px the grid's `thead` is `display: none`, so the corner button doesn't exist there.
    Recommended: every row open on mobile.
  * `theme.transitions.create` ignores reduced motion in MUI 9 (`theme.motion.reducedMotion`
    defaults to `'never'`), and the page-wide `.transitions *` rule in `globals.css` competes with
    `sx` transitions. That is why the recommendation is to swap icons rather than rotate one.
  * The repo has no component-test harness, so thread 2's button can't be tested until it has a
    consumer. **Suggest merging thread 2 into thread 3**, or letting thread 2 pull the note's use
    forward.
  * `JsonFold` (a `<details>`) already makes "fold" the house word.
* **For the Coach**:
  * **Thread 4's fold-set hook** (a `Set` of folded question ids, reset per quiz, about 35 lines)
    is hand-rolled on purpose, the same kind as `useChecklist`. `@react-stately/disclosure` could
    own it, and is declined for the same reason. It needs your yes, and a line under *Hand-rolled on
    purpose*, before thread 4. It doesn't block threads 2 and 3.
  * **Tri-state is dropped**, per the convention you asked thread 4 to follow.
  * Minor: the `ArrowRight` glyph is small at the grid's compact size. Fold state is plain React
    state, not kept across a reload; `localStorage` would need a hand-rolled wrapper or an unlisted
    package. The playtesting screen's note: lean leave it unfolded.
