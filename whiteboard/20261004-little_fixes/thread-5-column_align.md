# Thread 5: the column editor sets each column's alignment (2026-10-05)

Branch `20261005-column_align`, PR not yet filed (reported `ready`; lands when told). Suites:
typecheck and lint clean; `pnpm test` 126 files, 3562 tests; `pnpm test:e2e` (lane 2) 232 passed.

* **Built**:
  - *The field.* `align` on a column (`src/models/column.ts`): `'left' | 'center' | 'right'`
    (`ColumnAlignVals`, in the order a click steps through), optional in `column`, `columnPatch`
    and so `row`. `edit_column` carries it with no server change. `frameOf` (`src/lib/rows.ts`)
    now picks it through, present only where set.
  - *The rule.* `src/lib/columns.ts`: `alignOf(column)` is the column's own alignment, else
    `'center'` for Q#, else null ("each box sets itself"). `ColumnSpec.align` carries it.
    `headAlignOf(column)` is where the header sits: `alignOf`, else right for a turned header
    and left for any other. The editor shows that. `alignAfter` steps left, center, right, left.
  - *The grid.* A header and each cell of an aligned column wear `.alignLeft`, `.alignCenter` or
    `.alignRight` (`alignClassOf`, exported from `QuestionRow.tsx`). That sets `--col-align` and
    `--col-justify`. Every box that set its own `text-align` now says
    `var(--col-align, <its old value>)`: `.head`, `.headVertical`, `.cell`, `.field`,
    `.fieldNumber`, `.sum`, `.expressedText`, `.askable`. So an unaligned column draws exactly as
    thread 3 left it, apart from Q#. The estimate pills justify by `--col-justify`. Cards (below
    640px) reset both properties, so a card lays out as before.
  - *The editor.* `AlignButton` in `ColumnsEditor.tsx` sits after the width field and never
    hides as the list narrows. It is an `IconButton` showing MUI's `FormatAlignLeft`, `Center` or
    `Right` icon, named "Alignment of <column>: <align>". Its tooltip says "Aligned <align>[, as it
    sits unset]. Click to align <next>." It is disabled when the quiz is locked.
  - Tests: the model (the three alignments; `justify`, `''` and null refused; absent stays
    absent), `alignOf`, `headAlignOf` and `alignAfter` (`tests/lib/columns.test.ts`), the frame,
    and `edit_column` round-tripping it (`tests/convex/writing/layout_actions.test.ts`).
    `tests/convex/schema.test.ts` lists `columns.align` under `Absentable`. e2e: one spec in
    `widgets.spec.ts` checks that Q# starts centered, header and box. It clicks Title from left to
    center to right, checks the header and box follow and survive a reload, and checks the next
    click goes back to left.
  - `notes/vocabulary.md`'s *column* entry names `align` and what its absence means.
* **Decisions taken**:
  - **A fresh column leaves `align` absent**, and nothing writes a default. Absence is the
    default by kind. A column's default can then follow its source and width. No creation path
    (starter layout, a widgeting's column, seeding, the column dialog) had to change. The first
    click writes one.
  - **Schema: absentable, not backfilled.** Its absence has a meaning of its own, so it is
    optional in the row validator for good. That is `notes/deploy.md`'s *Schema pushes* last case,
    a hunt's `wheel` being the first. It needs no migration, backfill or tightening, and no ledger
    row. `convex/_generated/` did not change. The agent backend took the push without a reset.
  - **"Default by kind" means each cell by its value**, as thread 3 left it: a column has no type
    (thread 3's discovery). So an unaligned column sets nothing, and each box keeps its own
    default. Q# alone gets a column-level default, centered, header with it. This answers thread
    3's open question: Q# no longer sits right under a left header.
  - **What the editor shows for a column never aligned** is where its header sits
    (`headAlignOf`). That is center for Q#, right for a turned (narrow widgeting) header, and left
    otherwise. The tooltip adds ", as it sits unset". See *For the Coach* for where that can mislead.
  - **Where the mark sits**: after the width, beside the other "how it is drawn" field. The plan's
    gloss said "left justified in its row"; I read the Coach's "standard left-justified editor
    sigil" as the icon itself (a word processor's align-left mark), not its placement.
  - **The mark stays in the row only.** It is not in the column's gear dialog: the Coach asked for
    the click-cycling mark, and a new column can be aligned from its row once made.
  - **Custom property over a specificity override.** Each box states its own fallback where it
    is defined, so one variable reaches header, inputs, textareas, readouts and askable buttons.
    No `.alignX .box` rules are needed to outrank `.sum` and `.fieldNumber`. These are new rules
    in `workbench.module.css`, which `notes/views.md` asks to be reasoned: the grid's cells are
    styled without Emotion (the settled hand-rolled grid), so `sx` cannot reach them.
* **Deviations**: the estimate pills following `--col-justify` was not asked for. Without it an
  aligned estimates column would be the one cell kind that ignored its column.
* **Discoveries**:
  - At 09:09, before any script of mine ran, the lane-2 dev server logged requests for `/`,
    `/my/hunts`, `/?switch` and a hunt `interested_giraffe`. Probably a browser left open from an
    earlier lane-2 worktree reconnecting; nothing came of it.
  - The agent backend (lane 2, port 3421) now holds idents `aligner_*`, each with a hunt
    "Princes and kings" made for the screenshots. The scratch script is not committed.
  - A select ignores `text-align` in most browsers, so the chain picker's closed value may not
    follow a centered or right-aligned *Chains to* column. It was left as is.
* **For the Coach**:
  - **What an unset column's mark shows.** It shows where the header sits. A *wide* widgeting
    column holding numbers therefore shows "left" (its header is left) while its numbers sit
    right. A *narrow* text widgeting (*Answer Reversed*) shows "right" (its turned header) while
    its text sits left. The first click makes the mark true. The alternative is a fourth, "auto"
    state in the cycle, against the three-step cycle you asked for. Say if you want it.
  - Once clicked, a column cannot return to "unset" from the editor: the cycle has three stops.
    Setting it back to where it sat is the same on screen, except in the two mixed cases above.

Screenshots (`screenshots/thread5-*`; read them to review the look). `-before` is main, and
`-after` is this branch with nothing clicked: only Q# moves. `-after-aligned` has Title centered,
Full Answer right and Answer Letter Count centered.
`grid-light-1400` and `grid-dark-1400` (each phase); `columns-light-1400` (each phase) and
`columns-dark-1400` (before, after-aligned), the editor's rows; `columns-light-420` (before,
after-aligned), the row at its narrowest, the mark still there. `grid-folded-light-1400` and
`grid-card-light-600` (after-aligned) show that folded rows still ellipsize when centered or
right, and that a card ignores alignment.
