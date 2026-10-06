# Thread: landing_flow (2026-10-06)

Branch `20261006-landing_flow`, PR filed at landing; see the report. Stacked on #131.
Suites: `pnpm justify` green (typecheck, lint, `pnpm test` 136 files, 3987 tests); `pnpm e2e` proved, 252
specs, with flakes rerun alone (below), before the last two changes (typecheck at the bid, lint's
cache), and not rerun since, at the Coach's direction. Unreviewed, at the Coach's direction.

* **Built**:
  - `scripts/spine.ts`: `catchup` (land's first half), `justify` (records the patch-id),
    `e2e` (keeps the branch's tally from Playwright's JSON report; proved when every spec of a
    full run has passed, there or alone), `e2e-log`, and `land` as the bid: refuses without a
    current justify and an e2e proof (documents and notes exempt), then under one hold catches
    up, runs typecheck beside the unit tests, folds in; pushes after. No rebase-and-rerun loop any more. The
    hold now waits up to 30 minutes and says whom it waits on.
  - `scripts/e2e-log.ts`: report reading, the tally, the log (`$TQ_WORKTREES/.e2e-log.jsonl`)
    and its summary.
  - `pnpm worktree` seeds the new worktree's `.next-e2e/dev/cache` from the main checkout's.
  - package.json: `catchup`, `justify`, `e2e`, `e2e:rerun`, `e2e:log`; `test:e2e` names its
    build directory (`NEXT_DIST_DIR=.next-e2e`, as Doppler's dev_e2e already did).
  - Playwright: seven local workers; a JSON report when `PLAYWRIGHT_JSON_OUTPUT_FILE` is set.
  - Guidance: git_hygiene *Finishing* is A to E; thread-worker, thread-reviewer, the sprint
    skill, CLAUDE.md's finish step, stack.md, STYLE.md follow. The wait-for-load-8 advice is gone.
  - Measurements: in the plan, *Measured*.
* **Decisions taken**:
  - Parallel justify is pnpm's own `pnpm run --no-bail "/^(typecheck|lint|test)$/"`: prefixed
    output, each step run to its end, red if any is. No new dependency (concurrently and
    npm-run-all2 weighed; recorded in stack.md).
  - tsconfig `allowImportingTsExtensions`, so `spine.ts` imports `./e2e-log.ts` and
    `./lanes.ts` under plain node. STYLE.md notes the exception.
  - The bid's tests allow each test a minute (`pnpm test:bid`, `--testTimeout=60000`), and the
    spine's test file too: measured, the unit tests time out beside another worktree's e2e suite.
  - The Coach's calls after `ready`: typecheck joins the bid, beside the tests; `pnpm lint` keeps
    a cache (`.eslintcache`, content strategy; `rm .eslintcache` if CI's lint disagrees).
  - Proof records: `branch.<b>.justified` (patch-id), `branch.<b>.proved` (top and patch-id) in
    git config; the tally in the worktree's git dir (`triquet-e2e.json`). Runs over uncommitted
    changes are logged but count toward nothing.
  - A flake is a spec cleared with the branch's patch-id unchanged since the full run; cleared
    after any commit, it is "repaired". An approximation: an unrelated commit makes a flake read
    as repaired.
  - An e2e proof is not invalidated by later commits (the plan's "e2e at the worker's
    judgement"); the bid says when the proof predates the latest changes.
* **Deviations**:
  - Docs-only exempts `*.md` only outside `src/`: `src/content/*.md` is compiled by MDX into
    pages, and a stray `{` breaks the build.
  - `fix:` commit at the bottom: #133 merged with `PA.Identlabel`/`identlabel`, which thread 7
    renamed to Userlabel, so typecheck was red at the spine's top. The rename carried through
    in three files.
* **Discoveries**:
  - The machine's load average is the VM's: other containers raise it, and nothing in this
    container shows why.
  - Seeding the cache costs 0.8 s and so far saves nothing measurable (dev server compiles on
    demand). The log will tell over more runs.
  - Flakes seen while proving this thread: `quiz-history.spec.ts › an edit commits only the
    files it changed, its message naming the quiz`; `reviews.spec.ts › a review › shows the
    reviewer the smith's note folded to a line...`. Each passed alone at once.
* **For the Coach**:
  - Lint's cache can hold stale type-aware results: if CI's lint goes red where a worktree's was
    green, `rm .eslintcache`.
