# 2026-10-09: Sprint columnwise done, with #209's production deploy failed

**The sprint in a paragraph.** Columns now lead. A column shows one plain ref, worked by an
optional JSONata formula, filled by an optional Liquid template, and drawn by a readout, and it can
collapse. Entries gain families (boolean, enum) with params held to per-formulary allowlists, and
a text entry can carry its own regular expression, held to recheck's ReDoS verdict. Widgetings fold
into panels under the columns, and the run order shows in both places, with a row preview. A
`liquidize` formulary fills a template on render. Every template and formula is bounded in time on
a clock that moves inside a Convex mutation. Sorts are worked out in the browser, so no mutation
runs an author's formula any more. Edits show at once through Convex's optimistic updates, and the
race workarounds are gone. The formula bag, the template bag and the export now share one shape:
`question` and `questions`, keyed by label. The sprint began in normal mode and switched to YOLO
on 2026-10-09.

## Production: #209's deploy failed (the Coach's to look at first)

* **#209** (3c, `Tightens Serial Deploy: columnwise`) merged, and its **production build failed**
  at 06:01 UTC. So did #208's at 06:08, which carries the same schema. CI and the preview build
  passed on both, so the likeliest cause is the tightened schema push refusing a row production
  still holds: a quiz still holding `templated`, or one without `templateable`. Production keeps
  serving #206 (`d3d26b62`, deployed 04:16 UTC) safely.
* **The orchestrator could not read the build log**: the Vercel CLI wants a login this container
  doesn't have.
* **To diagnose and fix:**
  1. Read the log: `npx vercel inspect dpl_8zfjfLjvnyBi7zfgPJQuShMoWdBe --logs`. A refused push
     names the table, the document and the field.
  2. Run the runbook's step 1 (`migrations:outstanding`; `migrations:runAll` if anything is
     outstanding).
  3. Run step 3, sections 5 and 6, over a fresh export.
  4. Fix what they name, then redeploy `main` from Vercel.
  
  `whiteboard/20261008-columnwise/columnwise-convex_runbook.md` has every command. With
  `dev_aijanitor` granted, an agent could do steps 1-3.
* **Hold #211 and #215 until `main` deploys again.** #215 is a second serial deploy (`bagshape`):
  its backfills can only run once its own push lands.

## PRs, in the order they landed

| PR | Thread | Stacked on | State |
| --- | --- | --- | --- |
| #191 | 1, design note and vocabulary | main | merged |
| #192 | 4, removal and commit model | #191 | merged |
| #193 | 3a, columns widen (Serial Deploy: columnwise) | #192 | merged, deployed, backfilled |
| #196 | 2, entry families | main (after #191-#193 merged) | merged |
| #197 | 3b, the column expression | #196 | merged |
| #198 | 6, free regex | #197 | merged |
| #199 | 5a, folding editors | #198 | merged |
| #200 | 8, seeds pass | #199 | merged |
| #201 | 7, `liquidize` | #200 | merged |
| #202 | 5b, run order and row preview | #201 | merged |
| #206 | 9, compute budgets (added) | #202 | merged, deployed |
| #209 | 3c, columns tighten | #206 | merged; **deploy failed** |
| #211 | 11, optimistic updates (added) | #209 | open |
| #215 | 10, one bag shape (added; Serial Deploy: bagshape) | #211 | open |

The sprint-end full e2e run was #215's own landing run, on the top as it stands: 286 passed, 3
flakes cleared alone, all three in `preparedExport` (`whiteboard/TODO.md`).

## Decisions taken in YOLO

The full list is in `columnwise-plan.md`, *Decisions taken in YOLO*. The ones worth a look:
* `category` is reserved beside `categories`, both for widgeting labels only (3c).
* Optimistic updates (11) leave params and moves of columns and widgetings unshown, keeping
  `FoldedParams`' `pendingShown` and `useReorderable`'s `sentTo`. The git history may record an
  in-flight edit a moment early.
* The bag (10): `questions` sits at its top, not under `quiz`. `rank`, `archived`, `secondary`
  and estimate parts stay out of the ball. Quiz-tier widgeteds sit flat in the ball. The template
  bag's `questions` includes archived ones, and old loops are rewritten to reject them. A ref that
  was `qns` or `categories` reads `$` as `$.*`.
* Thread 9: the eslint ignore for `whiteboard/**/*.mts` (the orchestrator's `prd_checks.mts` broke
  lint), moved into #202 on the Coach's "fix both prs".

## Open questions, gathered

* **The failed deploy, above.**
* **#210 against #211:** whichever merges second re-keys `src/state/optimistic-quiz.ts` to
  widgeting ids.
* Minor calls still standing:
  - 3a: the empty-estimates-cell rule; *Category Data* or *Categories* as the header.
  - 3b: a double-click sorts before it collapses; a collapsed column in the card layout.
  - 5a: an automatic header follows what it shows.
  - 5b: decisions 1-3.
  - 7: `template_from` with no formula.
  - 8: should an `aibot`-formula column re-ask on a double-click?
* `categories` and `category` as global reserved words, after a grep of production.
* `RunMs` (5 s) and `AllocMax` (1M), if a real quiz meets them.
* `pnpm lane` is shadowed by pnpm 12's own command (CLAUDE.md says `pnpm lane`).
* The kill incident's suggested guard (`human/20261009-sprint_columnwise_kill_incident.md`), and
  the spine-tool bug where an aborted replay leaves a ref moved
  (`human/20261009-sprint_columnwise_paused.md`).
* Production's seeded `category_data` and `blurb` descriptions still say `qn.`.
