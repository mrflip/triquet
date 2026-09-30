# Fold machinery: findings

Thread 1 of `foldable_ui`, 2026-09-30. What library or framework machinery would let threads 2 to 4
write less and better code for the fold triangle, and whether any of it is worth it. Verified
against the installed `@mui/material` and `@mui/icons-material` 9.4.0, the source of MUI's own demos
and MUI X's (fetched from GitHub on 2026-09-30), and a throwaway Playwright probe of the running app
(numbers under *Measured*, below).

## Verdict

**MUI's own pieces, no new package.** The affordance is an `IconButton` with `aria-expanded`, showing
`ArrowRightIcon` folded and `ArrowDropDownIcon` open: the pattern MUI's own Collapsible table demo
uses, with the standard triangle glyphs. The
smith's note folds with **`maxRows`** on the `TextField` it already is, which MUI re-applies on
every render. The grid folds by clamping the `heightPx` that `QuestionRow` already imposes on every
cell. Nothing in the library owns "a set of folded rows" for a bespoke `<table>`, so thread 4 keeps
a small hook shaped like `useChecklist`, the same call already made there.

**Fold-all follows MUI X's convention, and has no third state**: one button whose state is worked
out from the rows. If anything is open, it folds everything; if nothing is, it unfolds everything.
Every click in the Coach's contract comes out the same. What goes is the "mixed" face, and the
quiz-wide mode that only existed to tell "mixed" from "open".

Every mechanism the threads need is already installed. The only hand-rolled piece is thread 4's
fold-set hook (about 35 lines); see *For the Coach*.

## What was weighed

| Candidate | Verdict | Why |
|---|---|---|
| `IconButton` + `ArrowRight` / `ArrowDropDown` | **Use** (thread 2) | MUI's Collapsible table demo is an `IconButton` with `aria-expanded` and `aria-controls` that swaps two icons. `ArrowRight` and `ArrowDropDown` are the filled triangles (▸ ▾), and one is the other turned 90°. Themed, compact at `size="small" sx={{ p: 0.25 }}`, and focusable, so Playwright's `getByRole('button', { expanded })` works. MUI X's `CustomizeDetailPanelToggle` rotates one icon instead; see thread 2 for why swapping is less code here. |
| `TextField` `maxRows` | **Use** (thread 3) | `TextareaAutosize` recomputes its height in a layout effect that has no dependencies, so it runs on every render (`TextareaAutosize.js`, `syncHeight`). Changing `maxRows` from 14 to 1 re-folds at once. Measured: the note goes from 224px to 40px, one line, with nothing else changed. |
| `QuestionRow`'s `heightPx` | **Use** (thread 4) | Every cell already takes its height from `heightPx`. Folding it to one line of the grid's box (28px) folds the whole row in one place, and the measured natural heights keep being reported while folded, so unfolding comes back at the right height instantly. |
| `Collapse` with `collapsedSize` | No, for the editable note; possible for a read-only one | While not `entered` its root is `overflow: hidden` (`Collapse.js`), so it clips the outlined label, which hangs about 9px above the field. It also wants a pixel height guessed by hand where `maxRows` works one out. For the grid it has nothing to wrap, since a row is a `<tr>` whose cells are sized one by one. It would suit the read-only note on the playtesting screen, if that folds at all, but Typography's `noWrap` is less code there. |
| `Accordion` / `AccordionSummary` | No | A Paper and a summary button around a region that collapses to zero. It can't show the note's first line while folded, it puts a different look on the header, and it can't live inside a table row. |
| `<details>` / `<summary>` | No | Closed content gets `content-visibility: hidden` (MDN, `::details-content`), so it can't be focused. That breaks "focus opens it" and hides the first line; there is also nowhere to put one around a `<tr>`. `JsonFold` already uses it for read-only JSON, which is the right place for it. `::details-content` is Baseline 2025, but it doesn't change the focus problem. |
| CSS `interpolate-size`, `field-sizing` | No | `interpolate-size` only matters for animating to `auto`, and still works only in Chromium (Chrome 129+; open bugs in Firefox and Safari). The note's height belongs to `TextareaAutosize` and the grid's to `GrowingField`'s measurements, so `field-sizing` has nothing to take over. |
| MUI X `SimpleTreeView`, Data Grid Pro detail panels | No, but **their convention is binding** (below) | Neither is installed. The tree view is a `role="tree"` list and can't hold a table. Row detail panels are Data Grid **Pro** (paid), and the bespoke grid is closed under *Hand-rolled on purpose*. Both teams publish the expand-all behaviour thread 4 should copy. |
| React Aria `Disclosure`/`DisclosureGroup`, `@react-stately/disclosure` | No | `DisclosureGroup` holds a set of `expandedKeys`, which is the one thing thread 4 needs. But it has no expand-all and no mixed state, and it renders `div`s. Using only the stately hook would mean taking `react-stately` for about ten lines of `Set` handling, the same trade `notes/stack.md` already declined for `useChecklist`. It would also bring a second component vocabulary beside MUI. |
| Radix `Collapsible`, Headless UI `Disclosure` | No | Unlisted, and they duplicate what MUI already gives: the button, `aria-expanded`, a panel that hides. Hiding the panel is the wrong behaviour here: a folded note or row stays **visible and editable**, just clipped. |

## Fold-all: the binding verdict for thread 4

**There is a library convention, and thread 4 follows it.** MUI X publishes the same rule twice:

* Data Grid, *Row recipes*, "Expand or collapse all detail panels" (`DetailPanelExpandCollapseAll`):
  `noDetailPanelsOpen = expandedRowIds.size === 0`; a click expands every row if none is open, and
  otherwise collapses all of them. The icon is `UnfoldMore` or `UnfoldLess`, and the `aria-label`
  is "Expand All" or "Collapse All".
* Tree View, *Expansion*, "Controlled expansion": one button, labelled "Expand all" if nothing is
  expanded and "Collapse all" otherwise, with the same rule.

WAI-ARIA has no "mixed" for `aria-expanded` (it exists only for `aria-checked` and `aria-pressed`).
The APG tree pattern's only bulk key, `*`, expands siblings and never collapses. IDEs split the
two (VS Code's one-way "Collapse All"; JetBrains' separate Expand All and Collapse All). None of
them offers a tri-state fold control.

What thread 4 builds, then:

* **State is the set of folded rows, and nothing else.** No quiz-wide mode. `anyOpen` is worked
  out from that set: some question's id is missing from it.
* **The corner button**: `aria-expanded={anyOpen}`. When pressed: if anything is open, fold every
  row; if nothing is, unfold every row.
* **Against the Coach's contract**: "open or mixed, toggle, everything closed" holds. "Click to
  edit, that row opens" holds. "Closed, toggle, everything opens" holds. "Starts closed" and "new
  rows are open" both hold. **What goes**: the "mixed" face, and "the quiz does not become open by
  opening all the elements", which only decided which face to show; the click did the same thing
  either way. One edge case also changes: a row added while everything is folded makes the button
  read "open", so the next press folds it (the contract doesn't say either way).
* **The icon**: the convention binds the behaviour and the two states, not the glyph. The MUI X
  recipe's `UnfoldLess`/`UnfoldMore` is one demo's choice. **Recommend thread 2's triangle**, since
  the Coach asked for one and it matches the note's; `UnfoldMore`/`UnfoldLess` (installed) is the
  fallback if a triangle reads wrong in the corner.
* **The label** stays the same whichever way it points, with the state carried by `aria-expanded`:
  the APG disclosure pattern. MUI X's demos swap the label instead, which is weaker. Point
  `aria-controls` at the `<tbody>`'s id.

## Thread 2: the affordance

**Use**: `IconButton` holding `open ? <ArrowDropDownIcon /> : <ArrowRightIcon />` (both from
`@mui/icons-material`), as MUI's Collapsible table demo swaps its icons. `aria-expanded={open}`, an
optional `aria-controls`, and a fixed `aria-label`. The size defaults to the grid corner's
`size="small" sx={{ p: 0.25 }}` with `fontSize="small"`, which is 24px and fits the 28px content box
of the 40px gutter; the note may want the icon at `medium`. Suggested name: `FoldButton`, in
`src/components/FoldButton.tsx`. "Fold" is already the word here (`JsonFold`).

Rotating one icon, as MUI X's detail-panel toggle does, would animate the turn. It costs two things
that swapping doesn't:

* `theme.transitions.create` doesn't consult reduced motion: MUI 9's `theme.motion.reducedMotion`
  defaults to `'never'`, and only components such as `Collapse` read it.
* The page-wide `.transitions *` rule in `globals.css` sets the `transition` shorthand at the same
  specificity as an `sx` class, so which one wins depends on stylesheet order. The comment on
  `textarea.veiled` in `workbench.module.css` already works around that once.

**Leaves**: one component of about 25 lines plus its doc block. **No hook in thread 2.** Thread 3
needs one `useState`, and thread 4's set logic is its own.

**Costs**: nothing new installed, and no animation. Glyph size:
`ArrowRight` draws a 5×10 triangle inside its 24-unit box, so at `fontSize="small"` it is small.
The Coach should see it before thread 4 copies it (`ChevronRight`/`ExpandMore`, the tree view's defaults,
are larger if wanted).

**Testing**: the repo has no component-test harness (Testing Library or Vitest browser mode are
still open with the Coach in `notes/stack.md`), so the component can't be exercised on its own
until it has a consumer. **Suggest the orchestrator fold thread 2 into thread 3**, or let thread 2
pull thread 3's use forward, so the button lands with an e2e spec that clicks it.

## Thread 3: the smith's note

**Use**: `const [open, setOpen] = useState(false)` in `QuizHeader`. Then
`maxRows={open ? SmithsNoteMaxRows : 1}` and `onFocus={() => { setOpen(true) }}` on the `TextField`
(MUI hands `onFocus` to the textarea itself, so focusing the button doesn't count). A click on
the rendered face already focuses the box (`focusBox` in `cells/markdown.tsx`), so it opens it too.
While folded, add `'& [data-face]': { overflowY: 'hidden' }` to the field's `sx`: the face is
`overflow-y: auto` and its content still stands 164px tall in the 40px box (measured), so it would
show a scrollbar anywhere scrollbars aren't overlays.

**Where the triangle goes**: leaning **outside the field, just before it, aligned to the top**. As
a `startAdornment` it would sit inside the outline, but MUI shrinks the label whenever there is a
start adornment (`InputLabel.js`: `shrink = filled || focused || adornedStart`), which changes how
an empty note looks, and adornments centre vertically on a tall multiline field.

**Leaves**: about 10 changed lines in `QuizHeader.tsx`, plus the `FoldButton`.

**Costs**: folding is instant, not animated (`maxRows` doesn't transition). Folded, the note is 40px
tall against the title box's 58px and the gear's 46px. In the probe's screenshot they read as one
row: top-aligned, the note's margin centring it on the title. If the Coach wants the heights to
match exactly, `size="medium"` gives 56px but changes the open note too; I'd leave it.

**Settle by judgment**: the state resets when the quiz changes (`key` or the `scopekey` pattern);
it starts folded. The **playtesting screen's note** is documented as "the smith's note, in full",
and an e2e spec checks it "paragraphs and all". **Lean: leave it unfolded.** If it does fold, use
Typography's `noWrap` for one ellipsised line (MUI's own one-line clamp), not `Collapse`.

## Thread 4: the grid

**Use**:

* **The hook**: `useFolds(scopekey, itemkeys)` beside the table, shaped like `use-checklist`. It
  holds a **set of folded ids**, which gives the contract almost for free:
  * On a new scope, the set is every current id, so the quiz starts folded.
  * A new row isn't in the set, so it is open.
  * Focusing a row removes its id.
  * Fold-all puts every id back in; unfold-all empties the set.
  * `anyOpen = itemkeys.some((itemkey) => ! folded.has(itemkey))`.

  Export the transitions as pure functions and test them, as `tests/state/use-hunt.test.ts` does
  with `placeIn`. About 35 lines.
* **The corner**: `FoldButton` in the top-left `<th>`'s `Stack`, above the batch button, wired to
  the convention above. Measured: in a new hunt's quiz the corner is **165px tall**, because the
  narrow computed columns turn their headers on end, so a 24px triangle stacks in without moving
  anything. A quiz with no narrow computed column has a header about 40px tall, and there the
  stack adds 24px once. That is constant, not a shift when the button is pressed. Two 24px buttons
  side by side don't fit the 28px box.
* **The rows**: in `QuestionRow`,
  `const heightPx = folded ? FoldedRowPx : Math.min(Math.max(...), RowCapPx)`, with
  `FoldedRowPx = 28`, the grid's one-line box (14px × 1.45 plus padding and border; measured 28).
  To open the row, put `onFocus` on the `<tr>`; React's focus event bubbles. Filter to
  `textarea, input` targets, since the Coach said "clicking in a text field", so the grip, the ask
  buttons and the chain select don't open it. Add a `rowFolded` class and one CSS-module rule,
  `.rowFolded .face, .rowFolded .scrolls { overflow: hidden }`. Folded faces and readouts are
  otherwise `overflow-y: auto` over content taller than the box (measured 154px inside 28px).
* **Mobile (below 640px)**: `thead` is `display: none` there, so **the corner button doesn't
  exist**. Treat every row as open below 640px: MUI's `useMediaQuery('(max-width:640px)')`, which
  `ReviewScreen` already uses. Otherwise cards would fold with no way to unfold them all.

**Leaves**: the hook of about 35 lines, about 15 lines in `QuestionRow`, about 10 in
`QuestionTable`, one CSS rule, and the props passed through `Workbench`.

**Costs, and what to expect**:

* A folded row measures **58px, not 28**. The Title cell is its input (28px) over the label
  metaline (15px), and the askable cells hold a `min-height` of 44px, which beats `max-height`.
  Open, the probe's six-line row was 167px, and the floor is 69px. Each element is on one line,
  which reads as the Coach asked (see the probe's screenshot). Getting lower would mean hiding the
  metaline and the askables' minimum while folded; I wouldn't.
* In batch mode the gutter's checkbox and trash can stack to about 56px anyway.
* `onFocus` on the row, and the React focus events generally, arguably trip the views note's "DOM
  handlers beyond click and change". `QuestionRow` already carries `onKeyDown`, `onBlur` and
  `onDoubleClick`. Name it in the thread's report rather than route around it.
* e2e: the specs that type into cells focus them first, which unfolds the row. `grid.spec`'s "a
  long clueing sets the height of its hint box too" reads the hint's height *before* filling, so
  it now starts from the folded 28px and still passes. `quizzes.spec`'s smith's-note growth spec
  fills the note, which focuses it, so it opens before it is measured.

## Persistence

Plain React state for both, per the plan's default. MUI has no storage hook. Persisting per browser
would mean either a hand-rolled `localStorage` wrapper or an unlisted package (`usehooks-ts`), for a
convenience the Coach hasn't asked for. A small question for the Coach, not a recommendation.

## Measured

A throwaway Playwright probe on the e2e backend, deleted afterwards. It filled the note with five
paragraphs and the first clueing with six lines, then measured with the fold hardcoded
(`maxRows={1}`, `heightPx = 28`) and without.

| What | Open | Folded |
|---|---|---|
| Smith's note (outlined input) | 224px | 40px |
| Note's face: content / box | 164 / 164 | 164 / 40 (`overflow-y: auto`) |
| Quiz title box / gear | 58px / 46px | same |
| Grid corner `<th>` | 165.5px | same |
| First question row | 167px | 58px |
| Clueing, Hint, Notes, Alt Text, Full Answer boxes | 154px | 28px |
| Title cell: input + metaline | 28 + 15px | same |
| Askable cells (ishes, guess) | 44px (`min-height`) | 44px |

## For the Coach

* **Thread 4's fold-set hook is hand-rolled on purpose**, the same kind as `useChecklist`: a `Set`
  in React state, reset when the quiz changes. The library that could own it is
  `@react-stately/disclosure` (`useDisclosureGroupState`), declined for the reason `useChecklist`
  gives. It needs your nod before thread 4, and a line under *Hand-rolled on purpose* in
  `notes/stack.md`. It does not block threads 2 and 3.
* **Tri-state is dropped** by the convention you asked thread 4 to follow. Clicks behave as your
  contract says; only the "mixed" face goes.
* The triangle glyph is small at the grid's compact size; worth a look when thread 2 or 3 lands.

## Sources

* `node_modules/@mui/material` 9.4.0: `Collapse/Collapse.js`, `TextareaAutosize/TextareaAutosize.js`,
  `InputLabel/InputLabel.js`, `InputBase/InputBase.js`. `node_modules/@mui/icons-material` 9.4.0
  for `ArrowRight`, `ArrowDropDown`, `ChevronRight`, `UnfoldLess`, `UnfoldMore`.
* MUI's Collapsible table demo:
  [CollapsibleTable.tsx](https://github.com/mui/material-ui/blob/master/docs/data/material/components/table/CollapsibleTable.tsx)
  (`IconButton` with `aria-expanded` and `aria-controls`, and `Collapse` in a detail row).
* MUI X: [row recipes, expand or collapse all](https://mui.com/x/react-data-grid/row-recipes/#expand-or-collapse-all-detail-panels)
  ([source](https://github.com/mui/mui-x/blob/master/docs/data/data-grid/row-recipes/DetailPanelExpandCollapseAll.tsx)),
  [CustomizeDetailPanelToggle.tsx](https://github.com/mui/mui-x/blob/master/docs/data/data-grid/master-detail/CustomizeDetailPanelToggle.tsx),
  [Tree View controlled expansion](https://github.com/mui/mui-x/blob/master/docs/data/tree-view/simple-tree-view/expansion/ControlledExpansion.tsx),
  and the tree view's [default icons](https://github.com/mui/mui-x/blob/master/packages/x-tree-view/src/icons/icons.tsx)
  (chevron right and chevron down). MUI X packages are at 9.14.0 on npm.
* React Aria [DisclosureGroup](https://react-aria.adobe.com/DisclosureGroup).
* MDN [`::details-content`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/::details-content);
  caniuse [`interpolate-size`](https://caniuse.com/mdn-css_properties_interpolate-size_allow-keywords).
