# 2026-10-04: Sprint categories done -- four threads, four PRs open

* **The sprint.** A hunt now has a *wheel* of 24 subject categories (fixed titles, from your
  Wuxing spike), arranged by drag or key at `/c/<hunt>/categories`; Masie, Artie and Poppy sit at
  slots 0, 8 and 16 and get a question by how far its categories sit from them; a quiz can work a
  *category estimate* entry (pills of category and difficulty) whose columns show each persona's
  chance and their average; and a *Category spread* panel draws the quiz's questions as a radar
  round the wheel, raw and smoothed, widening in the page on a click. Plan and handoff:
  `whiteboard/20261004-categories/`. Live mirror: the *Sprint: categories* Claude Doc.
* **The PRs, stacked in order** (land the top, #94, to take them all, or one at a time):
  #85 categories, the wheel and its editor <- #87 personas <- #91 the estimate entry and column
  parts <- #94 the spread panel and Recharts. #85 also carries your unmerged `chore: redact notes`
  (`20261004-redact`) and the sprint's plan commit beneath it.
* **Deploy**: every schema change is additive (an optional hunt `wheel`, a fifth `entry_kind`, a
  wider column source), so no migration. Run `seeding:seedWidgets` on production after #91 lands,
  for the seeded `categories` widget (thread 3's entry below).
* **Reviews**: all four threads at medium; one `fix:` kept (#91: the pills cell could wait forever
  for a superseded write). Nothing significant left open.
* **YOLO decisions, yours to overturn** (the plan's *Decisions taken in YOLO*): the wheel stored
  with its holes, total order derived by your fill rule; personas at slots, not categories; the
  chance curve linear between plateaus (best within one slot, worst within one of opposite), so
  null lands exactly halfway; a new pill's difficulty is medium; column hooks as
  `<widgeting>.<part>` sources, persona parts worked out on render; Recharts for the chart; the
  route exactly `/c/<hunt>/categories`.
* **Open questions, gathered** (detail in each thread's progress section and entries below):
  - Recharts or `@mui/x-charts`? Only `SpreadPanel.tsx` imports Recharts.
  - The new chart colours `seriesA`/`seriesB` (thread 4's entry below).
  - A hunt `wheel` optional for good (`Absentable`), or backfilled and required?
  - Should the wheel ride the hunt's Export? Today the Export box works chances against the
    default wheel.
  - The five decision notes now in `aside/` while CLAUDE.md, `stack.md` and `convex.md` point at
    `notes/decisions/`: bring back, or repoint?
  - A refused pills write leaves the cell on the unsaved value (a follow-up: `onCommit` reporting
    the mutation's outcome through `Workbench`'s `dispatch`).
  - Small things to confirm: the all-blank cell written rather than deleted; "(blank)" wording;
    difficulty by chip colour; persona cards naming one category each way; "Every question names a
    category." on an empty quiz; tiny tiles at rest in a 340px column.
  - Unconfirmed in a browser: at slots 8 and 16 a persona card may cover a tile's outer corner
    (that corner then can't be grabbed for a drag).
  - Adding a category later needs a migration: stored wheels are exactly 24 slots over the enum.
