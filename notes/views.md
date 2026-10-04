---
paths:
  - "src/components/**"
  - "src/app/**"
---

# Views

How a view is built here. This file loads itself when work touches `src/components/` or
`src/app/`. The rule it serves is the Library-first non-negotiable in `CLAUDE.md`: hand-rolling
is a decision, not a default, and the lookup order is a Material UI component or an existing
dependency, then a new library (`notes/stack.md` says whether it is settled), then, after a Coach
says yes in chat, our own code.

## Composition

Views are TSX composed from MUI components; raw HTML elements are for semantics MUI lacks.
Markdown is for documents and content, not UI. `Workbench` is the whole tool; `cells/` are the
grid's cell editors and readouts; `panels/` sit below the grid. A hook that only serves a view
(`use-draft`, `use-reorder`) lives beside it. Pages under `src/app/` are thin and hand off to a
component.

A failure goes where the author will see it. One about a field (a label refused, a form's
check) is said beside the field. One with nothing on screen beside it -- a change written
behind the screen and not kept, a navigation that did not happen -- raises an **alarm**
(`useRaiseAlarm`), which the page's one `Snackbar` shows at the foot of the window until it is
dismissed. Raise one rather than adding a line of muted text a scrolled page hides, or a second
Snackbar.

## Styling

Style with MUI first: `sx`, the theme in `src/app/theme.ts`, and the components' own props.
`workbench.module.css` is for layout MUI cannot express, and a new rule there needs a reason
said in chat. A CSS-module rule that re-creates something `sx` or the theme can do is one of the
tripwires below. Form controls in the chrome around the grid are MUI's (`Select native`,
`InputBase`, `IconButton`, `TextField multiline`), which keeps them themed and keeps Playwright's
`selectOption` and `getByLabel` working; the grid's own cells are the one place a raw element is
the settled choice (below).

A view that changes its layout as it narrows asks the box it sits in, not the window, unless it
is the page itself. A dialog or a panel is not as wide as the window. Give the measured box
`containerType: 'inline-size'`, and use MUI's container-query shorthand in `sx` (`'@620'`, or
`'@sm'` for the theme's breakpoint against the box's width). Name the widths in a `RoomFor`
constant beside the view, saying what each one makes room for (`ColumnsEditor`, `DangerZone`).
`Stack`'s `direction` prop takes window breakpoints only, so set `flexDirection` in `sx` instead.
A page's own layout (`ReviewScreen`, `About`, the grid's cards) stays on the window's
breakpoints. Content that only needs to wrap wants `flexWrap` or an `auto-fit` grid, and no
query at all.

## Tripwires that mean "stop and ask"

* You are attaching native DOM event handlers beyond click and change.
* You are writing a raw `<table>`, `<button>`, `<select>`, `<input>` or `<dialog>` where MUI has
  one.
* You are adding a CSS-module rule that re-creates something `sx` or the theme can do.
* You are writing a small state machine for an interaction.
* You are past about thirty lines on behaviour that is not specific to quizzes: drag and drop,
  focus handling, keyboard navigation, popovers, form state, virtualization, date math, parsing.

A decision recorded under *Hand-rolled on purpose* in `notes/stack.md` closes the tripwire for
that code: the question grid's bespoke `<table>`, its batch-mode selection hook and its fold set
are there. Don't re-flag one without a new reason.

The same goes in reverse: hand-rolled code that a library should own is said in chat rather than
extended. Flag it once, briefly, and only when already touching that code; don't propose
migrating code you aren't otherwise changing.

## Skills to reach for

The MUI skills under `.claude/skills/` load only when named. Name one at these moments.

* **`sx`, `styled` or theme work of a kind this repo has not done yet** (a new variant, a
  breakpoint scheme, a component override): `/material-ui-styling`.
* **Touching `src/app/theme.ts` or the palette**: `/material-ui-theming`.
* **Reaching for a component's less-travelled props** (slots, `slotProps`, a controlled form of
  an input): check the installed MUI version in `package.json` first, and prefer the component's
  own TypeScript types in `node_modules` over memory.
