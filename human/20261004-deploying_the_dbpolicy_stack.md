# 2026-10-04: Deploying the dbpolicy stack, in order (dbpolicy thread 10, PR #93)

The sprint is done: ten PRs, #79 to #93, each stacked on the one before. Merging them takes
these steps on production, in this order:

1. **Before #79:** set Convex Auth's `JWT_PRIVATE_KEY`, `JWKS` and `SITE_URL`, and clear
   `identings` by hand (`notes/deploy.md`, *Sessions*).
2. **Merge #79 to #92 in order.** Straight after #83 deploys, and before #86 does, run
   `./scripts/doppledo prd_janitor npx convex run migrations:runAll`. From #83 on it runs all ten
   backfills of threads 1, 3 and 4. A dry run of `runAll` tries only its first migration, so to
   preview one, use `migrations:run '{"fn": "migrations:<name>", "dryRun": true}'`. #86 to #92 read the copies
   with no fallback, so a row not yet backfilled is denied to everyone. If you deploy the stack in
   one go, run it straight after.
3. **Merge #93 last**, once `npx convex run --component migrations lib:getStatus` says all ten are
   done. Its push is refused while any row still lacks a field. If it names a row, that row's
   parent is gone: delete the row and redeploy. The 2026-10-04 export has no such row.

Open, and not blocking: import still reads a pasted `forced_label` (*For the Coach* 7 in the
plan). The sprint's other questions for you are in `whiteboard/20261003-dbpolicy/` (the plan's
*For the Coach*, and each thread's section of the progress document).
