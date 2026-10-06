# 2026-10-05: Merge plan for hunt_git (#118 to #133)

All ten PRs are one chain on `origin/main` (`bc4661a`, #136), in the sprint plan's order. Each PR
holds the branches beneath it plus its own commits. The replay was clean: no conflicts, so
**no conflict made me decide anything**. `git range-diff` shows all 66 commits unchanged. No
titles or bodies were edited. Thread 8 (`20261005-viz`) was not touched.

## Two ways to merge

- **As a unit (fewest steps).** Do the two checks under *Before you start*, then merge **#133**
  alone. GitHub marks the nine beneath it merged. That gives one Convex push and one deploy, then
  the orglabel backfill. If #119's push is refused, nothing in the stack deploys, and production
  keeps serving the old version.
- **One at a time.** Merge in the order below, and run `pnpm restack` after each merge so the
  next PR is up to date with `main`. The stops below apply to this route.

## Before you start

1. **#119's precondition: #115's backfill finished.** You ran `runAll` today. To confirm it
   finished:
   ```
   ./scripts/doppledo prd_janitor npx convex run --component migrations lib:getStatus
   ```
   Both `backfillHuntBranches` and `retireQuizVersions` should show as done.
2. **#126's precondition: no widgeting labelled `position`.** #126's body does not hold the
   command (the sprint's notes say it was given in chat), so here is one. It also covers
   `forced_label` and `id`, as the review asked:
   ```
   ./scripts/doppledo prd_janitor npx convex data widgetings --limit 100000 --format jsonl \
     | jq -c 'select(.label == "position" or .label == "forced_label" or .label == "id") | {_id, label, quiz_id, hunt_id}'
   ```
   Empty output means you can go ahead. For any hit, relabel that widgeting from its quiz's gear
   **before** merging #126. Nothing else will stop you: the reservation is only in the Zod row
   validator, not in `convex/schema.ts`, so the push succeeds anyway, and the damage shows up
   later as refused edits and overwritten exports.

## In merge order

| # | PR | Stop after merging? | Commands |
|---|---|---|---|
| 1 | **#118** Switch branch button on a phone | No | None (a view only) |
| 2 | **#119** Hunt branch required, quiz version gone (tighten) | **Yes**, until the deploy is green | Precondition 1 above. Its schema push checks every hunt and quiz, so a refusal fails the build and the old version keeps serving. Make sure it deployed before you stack more on it. |
| 3 | **#121** One address model | No | None (pure lib, no callers yet) |
| 4 | **#125** The URL scheme, old addresses move | No | None. `hunts.list` gains a projection, not a schema change. |
| 5 | **#126** Jsonballs, Import and Export | No, but **check before merging** | Precondition 2 above |
| 6 | **#127** A hunt's files | No | None |
| 7 | **#128** Watches at the grain of the files | No | None. `quizzes.whole` is a new query; no schema change. |
| 8 | **#129** One repository per hunt | No | None. Browsers' old `/quizzes` repositories get no migration (as designed). |
| 9 | **#130** Downloads and the hunts page | No | None |
| 10 | **#133** A hunt stores its org (widen) | **Yes**: backfill | Once Vercel has deployed it, see below |

### After #133 deploys

```
./scripts/doppledo prd_janitor npx convex run migrations:runAll '{"dryRun": true}'
./scripts/doppledo prd_janitor npx convex run migrations:runAll
./scripts/doppledo prd_janitor npx convex run --component migrations lib:getStatus
```

`runAll` now holds only `backfillHuntOrglabels`, because #119 removed #115's two backfills. A
hunt nobody is on is skipped and named in the log: give it a smith or delete it before the
tighten PR, whose push would otherwise be refused. That tighten PR isn't written yet; its steps
are in `human/20261005-orglabel.md`. Thread 8's widen backfills will join this same `runAll` when
it lands.

Until the backfill runs, a hunt with no `orglabel` reads its org from its earliest member, and
`hunts.open` accepts a tab still running the previous app. Running the backfill a little late is
harmless.

## Small things noticed

- **Config name.** #133's body and `human/20261005-orglabel.md` write `dev_aijanitor` (the
  agent's janitor config). `notes/deploy.md` names `prd_janitor` as the Coach's. Both reach
  production. The commands above use `prd_janitor`.
- **Not in this chain:** #131 and #132 are open separately. #132 ("A production deploy runs its
  backfills and waits for them") shows as conflicting with `main`. If it merges first, the
  backfill step above may become automatic.
