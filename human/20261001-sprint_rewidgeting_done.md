# 2026-10-01: Sprint rewidgeting done -- eight threads, eight PRs open, a hand deploy

* **The sprint.** Bots and expressions are one family on the data layer: a global library of
  *widgets* (formularies `jsonata`, `aibot`, `entry`), put to work in a quiz as *widgetings*, coming
  to a *widgeted* per question. Authors paste their own prompts; a new quiz starts lean (five
  columns, no widgetings) and picks from the library. Plan, handoff and `losses.md`:
  `whiteboard/20261001-rewidgeting/`. Live mirror: the *Rewidgeting sprint* Claude Doc.
* **The PRs, stacked in order** (land the top, #74, to take them all, or one at a time):
  #67 decision record and vocabulary (docs only) <- #68 formulary seam <- #69 the three tables,
  seeding, clean break <- #70 pasted prompts <- #71 status <- #72 two editors and the Widgets panel
  <- #73 the lean starter set <- #74 entry widgets. #67 also carries the unmerged
  `20261001-rewidgeting_plan` (yours) and `20261001-rewidgeting_start` commits beneath it.
* **The deploy is a hand procedure** (thread 3's entry below; `notes/deploy.md`, *Clearing the
  widget tables*; `losses.md`). Land and deploy the stack together, at least through #70: the seeding
  mutation inserts only what is absent, so production should be seeded once, from the final fixture.
* **Bulk recalculation is gone, and the batched run was already slower than it should be**: worth
  a look of its own the day bulk returns (thread 3's entry below).
* **Reviews**: every code thread reviewed at medium; 12 `fix:` commits kept across seven threads;
  one flagged finding (thread 2: dumdum's reply not stored verbatim), fixed on resume and since made
  moot by thread 4's JSON route. Nothing significant left open.
* **YOLO decisions, yours to overturn** (the plan's *Decisions taken in YOLO* has all eleven):
  seeding a quiz's widgetings only when its columns name the old defaults; `butnot_ishes` as a seeded
  `jsonata` widget; dumdum's value `{ guess, explanation }`; imports keep pasted values per #66;
  duplicate labels in a library import merge, first wins; raw mustache tags (`{{{x}}}`, `{{&x}}`)
  refused; no separate `label` starter column; entry values imported ahead of #66.
* **Open questions, gathered** (detail in the plan's *For the Coach*):
  - Rate limiting on `/api/ask` (thread 4's entry below); `servicelabel` in the request, or assume
    `claude`?
  - Your `dev` backend needs `--reset --seed` (it holds the old schema and dumdum's old prompt).
    Previews seed only twelve widgets unless `build:vercel` runs `seeding:seedWidgets`.
  - Library export/import on the Export panel, or elsewhere? A Title field in the widget editor?
  - Column headings from a widgeting's label (*Butnot Ishes*) or the widget's title?
  - The sort rule for objects (a one-key object sorts as what it holds).
  - A paste holding widgetings but no questions changes nothing today; merge them?
  - Seed a generic entry widget? Move `notes` and `alt_text` into entries (thread 8's entry below)?
  - Suppressions: four `no-extraneous-class` disables on classes of statics (`JsonataFormulary`,
    `AibotFormulary`, `Widgeted`, `Widget`), or an `allowStaticOnly` override.
  - `CLAUDE.md` names the deleted `Expressed`, and points (with `notes/database-decisions.md`) at
    decision records under `/aside/`.
  - PR #66 and #67 both edit the vocabulary's *stale* entry: a small docs conflict for the second.
  - A known limit: the stored read nears Convex's per-transaction bound around 999 questions by 5
    `aibot` widgetings.
