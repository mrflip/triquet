# Thread 2: clear_people (2026-10-11)

Branch `20261011-clear_people`, PR filed at landing; see the report. Suites: justify green
(typecheck, lint, 202 unit files); `pnpm e2e --touched` ran the whole suite (the branch adds to
`convex/`): 293 passed, no flakes. The review came back clean.

* **Built**:
  - `convex/clear_people.ts`: `clearBatch`, an internal mutation deleting up to 500 rows a run
    from `PeopleTables` (reviewings, reviews, huntings, identings, idents, authRefreshTokens,
    authVerifiers, authSessions, authVerificationCodes, authAccounts, authRateLimits, users:
    children before the rows they point at), answering what it deleted by table; and `count`, an
    internal query paging one table at a time (1000 rows a page), handing on to the next table.
  - `scripts/janitor.ts`: **the guard for threads 4 and 8.** `takeAim(argv)` strips
    `--deployment <name>` and hands back `{ aim, rest }`. `aim.acting` is false without the flag,
    true when the name equals the deployment reached, and anything else throws `JanitorStop` before
    anything is done. The deployment reached is learned by `reachedDeployment()`, which runs
    `pnpm exec convex function-spec` in the same environment the command's `convex run`s use and
    reads its `url`, the deployment's own `cloudUrl` (`_system/cli/convexUrl:cloudUrl`, read with
    the same admin key; not the address the CLI connected to): the name is the `*.convex.cloud` subdomain, or host:port for a local backend.
    It also exports `aim.said` (the first line to print), `dryRunCoda(aim)` (the last line of a dry
    run, naming the flag to add) and `stopOrThrow(err)` for `main`.
  - `scripts/clear_people` (a bash wrapper) over `scripts/clear-people.ts`. It counts, and on a
    dry run stops there. Acting, it clears batch after batch until a run deletes nothing, says what
    each run deleted and the totals, and counts again; it exits 1 when rows remain (a visitor came
    in meanwhile).
  - Tests: `tests/convex/clear_people.test.ts` (people go, every kept table's rows are identical
    but for signals' `changed_at`, `expectSound`, a second run deletes nothing, batching, paging)
    and `tests/scripts/{janitor,clear-people}.test.ts` (the guard; the script against a fake
    deployment).
  - Notes: `notes/deploy.md` gains *Commands run by hand on production* (the guard) and *Clearing
    production's people* (why a command rather than a backfill, and the Coach's five steps);
    `notes/security.md` and `notes/convex.md` record the one exception to leaving Convex Auth's
    tables alone.
* **Decisions taken**:
  - The deletes go through the triggers (`zInternalMutation`), not raw. A quiz whose shared
    reviews are deleted has its change signal moved, as any deletion of them moves it. That is
    true to what the signal means. The other choice was writing raw past the ESLint rule that
    keeps every mutation on the triggers. Signals are never deleted.
  - The flag is `--deployment <name>`. The name comes from the address the deployment reports
    for itself, through `function-spec` with the same admin key, not from the deploy key's prefix
    or the command line.
  - The mutation itself has no environment or argument guard. It is internal, so only a holder of
    the admin key can call it, and thread 3 deletes it.
* **Discoveries**:
  - `convex function-spec` gives `{ url, functions }` against a local backend too, so the guard
    can be proved on a lane's backend.
  - Convex returns a record's keys in alphabetical order. The script reorders them into the order
    of the counts.
  - Proof on this lane's `e2e` backend, after `pnpm e2e e2e/reviews.spec.ts` had filled it with
    160 people's rows over 9 hunts: the dry run counted them; `--deployment wrong-name-999`
    stopped with exit 1, having done nothing; the real run deleted all 160 in one run; the hunts,
    realms, quizzes, questions, widgets, columns and signals counts were unchanged; a second run
    deleted nothing.
* **Open, for threads 4 and 8** (the review's minor finding): the deployment is checked once, and
  each later `convex run` picks it again from the environment. That matters only without a deploy
  key, if `.env.local`'s `CONVEX_DEPLOYMENT` changed during a run. Pinning it means changing the
  shared `convexRun` (`scripts/convex-migrations.ts`); left alone here.
* **For threads 3, 4 and 8**:
  - Thread 3 deletes `convex/clear_people.ts`, `scripts/clear_people`, `scripts/clear-people.ts`
    and their two tests, the regenerated `convex/_generated/api.d.ts` entry, and the two sentences
    in `notes/convex.md` and `notes/security.md` that name them. It keeps `scripts/janitor.ts`,
    its test, and the *Commands run by hand on production* section of `notes/deploy.md`.
  - Threads 4 and 8: build a command as `clear-people.ts` does: `takeAim` first, print
    `aim.said`, look, act only when `aim.acting`, and end a dry run with `dryRunCoda(aim)`. Add
    the steps under *Commands run by hand on production*.
* **For the Coach**: deploy.md's *Clearing production's people* holds your steps. Step 3 runs
  `scripts/clear_people` twice: dry, then with `--deployment` naming the deployment the dry run
  printed.
