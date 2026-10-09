# Thread 1: Split the spine's test file (2026-10-09)

Branch `20261009-spine_test_split`, PR filed at landing; see the report. Suites: `pnpm justify`
green (181 files, 5605 passed, 1 skipped). Unit tests only, so it lands with `--skip-e2e`.

**Measured** (whole unit suite, `pnpm vitest run`, wall; before and after run interleaved at the
same load, about 11 on 16 cores):

| | before | after |
|---|---|---|
| unit suite wall | 56.2 s, 57.2 s | 13.5 s, 12.3 s |
| slowest file | `spine.test.ts`, 51.7 s | `spine-e2e-lock.test.ts`, 7.2 s |
| the spine's tests, summed test time | 51.7 s | 48-53 s (81-92 s without the compile cache, under contention) |

Under heavier load (15-30) the interleaved runs gave 63-78 s before and 14-16 s after.

* **Built**:
  - `tests/support/spine-world.ts`: the scratch world (`makeWorld`, `WorldT`, `isolatedEnv`, the
    fake e2e suite), its fixtures (`SpineFixtures`, `SpineContext`), `withSpecs`, `Today`,
    `RepoRoot`, `SpineTimeout`.
  - `tests/scripts/spine.test.ts` now holds only the pure helpers (`reachOf`, `skippingE2e`,
    `withSpineHeld` and the rest): 107 tests, under a second.
  - The 68 stories of a scratch repository are spread over thirteen files, one per command:

    | file | what goes in it |
    |---|---|
    | `spine-worktree.test.ts` | `pnpm worktree`: cutting and removing |
    | `spine-catchup.test.ts` | `pnpm catchup` |
    | `spine-justify.test.ts` | `pnpm justify` |
    | `spine-e2e.test.ts` | `pnpm e2e`: full runs, reruns, proofs, flakes, the log |
    | `spine-e2e-touched.test.ts` | `pnpm e2e --touched`: corners and scoped proofs |
    | `spine-e2e-lock.test.ts` | the e2e lock: waiting, and what goes by without it |
    | `spine-land.test.ts` | `pnpm land` of one branch: refusals, documents, the Coach's edits |
    | `spine-land-stack.test.ts` | `pnpm land` beside other branches: stacking, conflicts, replay onto origin/main |
    | `spine-land-catchup.test.ts` | the bid's catch-up under the hold, and the proof read afresh |
    | `spine-land-into.test.ts` | `pnpm land --into` |
    | `spine-install.test.ts` | installing packages when a move changes the lockfile |
    | `spine-sweep.test.ts` | `pnpm sweep` |
    | `spine-restack.test.ts` | `pnpm restack` |

    **Where a new spine test goes**: a pure function of `scripts/spine.ts` in `spine.test.ts`; a
    story about one command in that command's file; a helper more than one file needs in
    `tests/support/spine-world.ts`, otherwise beside the one file that uses it. Each file opens
    with `const it = test.extend<SpineContext>(SpineFixtures)` and wraps its describes in
    `describe('node scripts/spine.ts, in a repository with worktrees', { timeout: SpineTimeout }, ...)`.
    A file past about 6 s alone is worth splitting again along a describe.

* **Decisions taken**:
  - **Files by command, finer than the plan's four groups.** The four groups ran 6-18 s each and
    the longest set the wall. Thirteen files, one per command, give the obvious place for a new
    test that the look-ahead asked for, and no file runs past about 7 s.
  - **A vitest fixture (`test.extend`) instead of `beforeEach`.** Each test takes `{ world }`, as
    vitest's docs do it. The extension is declared in each file, not exported ready-made, because
    `@vitest/eslint-plugin` sees a `test.extend(...)` as a test only when it is declared in the
    same file; an imported one turns every `expect` into `no-standalone-expect`. Naming it `it`
    keeps `sonarjs/no-empty-test-file` content as well.
  - **Node's compile cache for the spine runs** (`NODE_COMPILE_CACHE`, set by `isolatedEnv`).
    `node scripts/spine.ts` costs 75 ms to start, 30 ms with the cache: type stripping and compiling
    1,970 lines of script each time. The tests spawn it hundreds of times, so this halves the spine
    tests' CPU, which matters now that the suite is bound by total work. The cache lives in a temp
    directory per test file (a `scope: 'file'` fixture), removed after: node keys entries by path,
    and every world's `scripts/lanes.ts` lies at a fresh path, so a cache kept per checkout grew by
    about 500 files a run (68 MB in an afternoon). Node checks every entry (magic number,
    checksums) and recompiles a damaged one, which I tried with entries overwritten by random
    bytes, so concurrent writers are safe.
  - **No world built once per describe.** `makeWorld` takes 24 ms; a test's cost is its spawns of
    git and node (a two-branch landing is about 0.7 s on a quiet machine). Sharing a world would
    save nothing and couple tests that now stand alone.
  - **`vitest.config.ts` left alone.** `--pool=threads` fails tests outright and runs slower;
    `--maxWorkers=16` gained about a second (12.8 s against 14.0 s) but takes the container's last
    core from the other lanes.

* **Deviations**:
  - The support module is `tests/support/spine-world.ts`, not under `tests/scripts/` as the plan
    said: `tests/` mirrors the source path for path, so a file in `tests/scripts/` reads as the test
    of a script, and `tests/support/` is where shared fixtures already live (`convex.ts`). Unit tests
    only either way.
  - The compile cache is a speed-up of the tests' machinery, not a split. It came naturally, and is
    the larger part of the CPU saved.

* **Discoveries**:
  - **The unit suite is now bound by its total work, not by one file.** All files start about 2 s in
    (vitest's startup); the last to finish are ordinary component tests scheduled late. The summed
    time is about 95 s over 15 workers. Further gains come from making tests cheaper anywhere, not
    from splitting the spine's tests more.
  - **The e2e lock's two waiting tests sleep about 2 s each** in `scripts/spine.ts`'s
    `E2eLockPollMs` (2000), which keeps `spine-e2e-lock.test.ts` the slowest file (about 6 s alone,
    7 s in the suite). An environment override for the poll, set short in `isolatedEnv`, would cut
    about 4 s from it. Not done: that changes `scripts/spine.ts`, which the suite runs through (no
    e2e skip then), and threads 2 and 3 may be in it. Thread 2 could take it if it touches the
    lock code anyway.
  - `pnpm vitest run --exclude <glob>` does not reach the files of the `projects` in
    `vitest.config.ts`: both projects still ran every file. To compare versions of a test file,
    move them aside.
  - Thread 2 or 3, adding a spine test after this lands: see *Where a new spine test goes* above.
    Whichever of them lands second rebases its spine tests onto these files.
