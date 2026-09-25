# Drag and drop: Pragmatic, behind one hook (Sept 2026)

**Decision.** Every drag is **Pragmatic drag-and-drop** (`@atlaskit/pragmatic-drag-and-drop`, plus
its `-hitbox` package). `useReorderable` in `src/components/use-reorder.ts` is the only place it
is wired up.

**Why, over dnd-kit.** Chosen on release evidence rather than reputation: dnd-kit's stable line
(`@dnd-kit/core` 6.3.1) had not been published since Dec 2024, and its rewrite (`@dnd-kit/react`)
was still 0.x, so the choice was between stagnant and unproven. Pragmatic is on a monthly
cadence, is what Jira and Trello drag with, is framework-agnostic, and brings three tiny
dependencies. It decorates the DOM we already have rather than asking for wrapper components,
which is what lets the question grid stay a real `<table>`.

**What it replaced.** Two hand-rolled HTML5 drag implementations, one in the question grid and
one in the sortable lists. The old grid code always passed the hovered row's index, so a
downward drag landed below the row while the indicator was drawn above it.

**Rules that follow from it.**

* Take `-hitbox` for `attachClosestEdge` and `getReorderDestinationIndex`. **Do not** take
  `-react-drop-indicator`: it drags in `@atlaskit/tokens` and `@compiled/react`, a second
  design-token system beside MUI's. The indicator is two lines of CSS.
* Pragmatic ships no keyboard dragging, on purpose. Every grip therefore also answers the up and
  down arrows. A grip that is focusable must never be a grip that does nothing.
* Playwright cannot originate a native drag in this Chromium; `dragOnto` in `e2e/support.ts`
  synthesises the events, carrying coordinates so that which half of a row was hit is testable.
