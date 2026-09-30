# Foldable UI: progress

The running handoff for `foldable_ui-plan.md`, newer than the plan wherever they disagree.
Workers add their sections below the table, newest first.

## Status

| Thread | Label | Status |
|---|---|---|
| 1 | Investigate fold machinery | complete (docs-only PR) |
| 2 | A reusable fold affordance | pending |
| 3 | Fold the smith's note | pending |
| 4 | Fold the question grid | pending |

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
