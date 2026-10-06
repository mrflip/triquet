# Thread 10: The tightening of orglabel and viz (2026-10-06)

Branch `20261006-tighten_orglabel_viz`, PR filed at landing; see the report. A follow-up to
threads 7 (#133) and 8 (#140), after #119's precedent. Suites, in lane 1: typecheck and lint
clean; vitest 144 files, 4246 passed, 1 skipped; e2e 259 passed (`reviews.spec.ts:69` red once
under load in the full run, green on its own).

* **Built**:
  - **Schema**: a hunt's `orglabel` and a question's `viz` are derived from their row validators
    again, both required (`convex/schema.ts`). `tests/convex/schema.test.ts` empties `Backfilling`.
    `convex/_generated/` did not change.
  - **Fallbacks gone**: `rows.orgFor` (earliest member) and `reading.orglabelOf`; `huntInOrg`'s
    second read for a hunt with no org, which also held an unbackfilled hunt's label against every
    org in the census; `updateHunt` storing a missing org; `rows.vizOf` (`seenQuestionFor` and
    `archiveStarters` read `row.viz`). `huntListingOf(rows)` no longer takes the members, so
    `hunts.list` stops reading each hunt's huntings.
  - **Backfills**: `backfillHuntOrglabels` and `backfillQuestionViz` leave `convex/migrations.ts`
    and `Backfills`, with their tests. `tests/convex/migrations.test.ts`, `stats.test.ts` now use
    the stamps' backfills where they used these (a failed run is a hunt with `updated_at: -1`).
    Raw test inserts of hunts and questions gain `orglabel` / `viz`; tests of the widen period
    (`idents`, `hunts`, `reading`, `rows`) go.
  - **Notes**: a ledger row in `notes/deploy.md` (plus #133 and #140 on the widenings' rows), and
    *Schema pushes* step 3 says a tightening leaves `Backfills` non-empty; `notes/vocabulary.md`
    (org) and `notes/decisions/urls.md` lose the widen-period sentences.
* **Decisions taken**:
  - **The stamp backfills stay.** They have finished on production and skip stamped rows, so they
    cost one finished check each per deploy. They stay because retiring them would empty `Backfills`,
    and `migrations.runner([])` throws ("Specify the migration"): `runAll` runs on every
    production deploy (`scripts/convex-migrations.ts`) and every preview (`--preview-run`), so an
    empty series would fail previews and warn on production. The stamps stay optional for good, so
    no tightening retires them. They can go once another backfill holds the list open, or once
    `runAll` accepts an empty series.
  - `hunts.open` still accepts a missing `orglabel` (#133's review fix, for tabs on the app from
    before orgs during that deploy). That covers a client that is out of date, not data that is, and
    it is marked nothing like "until the tighten", so it stays.
* **Deviations**: none. The handoff said #132 was open; it was merged (`e3e8395`), and is already
  beneath this branch, so this branch does not conflict with it.
* **Discoveries**: `/convex-reviewer` on the diff: no critical or important findings; no public
  function added, and reads only removed.
* **For the Coach**:
  - Merge only after `migrations:backfillHuntOrglabels` and `migrations:backfillQuestionViz` show
    `success` on production's /stats. A hunt nobody is on was left without an org by the backfill
    and refuses this push: give it a smith or delete it first.
  - When to retire the stamp backfills, and whether `runAll` should be taught to run an empty
    series (a wrapper mutation calling `migrations.runSerially` when `Backfills` is non-empty).

## Review

Clean, no fixes. The reviewer agrees on keeping the stamp backfills (checked in the migrations
library: `runner([])` throws "Specify the migration") and on leaving `hunts.open`'s allowance for
a missing `orglabel` (it serves stale tabs, not rows; retire it later on its own). One docs fix
asked, made before landing: the ledger row names both causes of a refused push, a backend that
missed `20261005-viz`, and a hunt nobody is on, which the orgs' backfill skipped with a warning
yet reported `success` for.
