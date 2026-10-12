# 2026-10-12: /stats backfills are public where EXPOSE_INTERNAL_STATS_TO_ALL says so

You asked for `/stats` to be public. The page itself already was: anyone could open it and read
the build's stamp. The only restricted part was its Backfills section, which `stats:backfills`
gives to an admin alone (`Approve.mayReadBackfills`, from 8366f90) and answers `null` to everyone
else.

**What I did**

* A deployment env var, `EXPOSE_INTERNAL_STATS_TO_ALL`, declared in `convex/convex.config.ts`
  beside `TRIQUET_CLEARABLE`. Exactly `true` shows the backfills to everyone, with or without a
  session; `false` or unset keeps them an admin's. It is declared as `true` or `false` and nothing else, so
  a mistyped value is refused instead of quietly closing the page.
* The policy reads it the way `ask_anthropic_bot` reads its switch: `convex/stats.ts` hands the raw
  value in, `Approve.mayReadBackfills(actor, exposeval)` decides.
* A local backend leaves it unset, so the e2e suite still exercises the admin gate.
* `notes/security.md` records the decision, and `notes/deploy.md` how to set it.

**To turn it on** (a Coach's, per `notes/deploy.md`):
`./scripts/doppledo prd_janitor npx convex env set EXPOSE_INTERNAL_STATS_TO_ALL true`.

**Open questions**

* If "restricted" meant something else (a Vercel protection on the route, say), nothing in the
  repo restricts `/stats` other than the backfills; that would be a project setting I cannot see.
* Should the row counts stay admin-only even where this is set, with only names and states public?
  A small change to `backfillsFrom` (`src/lib/rows.ts`).
