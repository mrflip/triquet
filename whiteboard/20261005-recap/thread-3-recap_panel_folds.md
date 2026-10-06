# Thread 3: Panels fold and expand (2026-10-06)

Branch `20261006-recap_panel_folds`, PR filed at landing; see the report. Suites: justify green
(4464 unit tests); `e2e/panels.spec.ts`, `estimates.spec.ts`, `alarms.spec.ts` green (25).

* **Built**: `src/components/panels/Panel.tsx` gives every panel a fold triangle (`FoldButton`,
  labelled "Show this panel") before its heading, folding it to its title bar by MUI `Collapse`,
  which keeps the body mounted, so drafts survive a fold. A panel inside the new `PanelsRow`
  (the grid of panels under the quiz, which `Panels.tsx` now renders through) that is not
  already `wide` also gets an arrow at the end of its title bar ("Widen this panel to the whole
  row", `aria-pressed`, `OpenInFull`/`CloseFullscreen`) toggling it to the whole row. State is
  React's own, unpersisted. One new e2e in `panels.spec.ts` (fold, widen, no arrow on a wide
  panel).
* **Decisions taken**:
  - The arrow shows only inside `PanelsRow` (a context Panel reads), since outside the grid
    (hunt page, ident gate, not-found pages) a panel is already the page's width. Those panels
    still fold: the Coach said all panels.
  - A panel resting `wide` (Widgets, Export / Import, Reviews once shared) gets no arrow: it
    cannot grow.
  - Width can be held by the view (`widened` + `onWidenedChange`, MUI's controlled pattern), so
    a view whose content grows with the panel knows the width. `SpreadPanel` does this.
* **Deviations**: the spread chart is no longer a click-to-widen button; the panel's arrow is the
  one control (the plan's "lift rather than keep two"). Its microcopy ("Click the chart...") went
  with it; `estimates.spec.ts` drives the arrow instead.
* **Discoveries**: for threads 5 and 6, a new panel rendered in `Panels.tsx` gets both affordances
  just by using `Panel`; pass `wide` only if it must always span the row (then it has no arrow).
  `FoldButton` refuses `sx`, so the triangle sits at the panel's padding edge, not hung outside it.
