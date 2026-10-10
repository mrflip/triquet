# 2026-10-09: Sprint perf_improvements paused -- five threads landed, two decisions are the Coach's

Five of the six threads have landed as one stack and are pushed. The sprint is paused, not done,
on two decisions that only the Coach can make.

**What the sprint did:**
- **Unit tests:** the suite runs in 12–13 s instead of 56 s. This also shortens `justify` and the
  land hold.
- **E2e specs:** the `routing` and `reviews` specs skip the UI way in, except where the way in is
  what they test.
- **Convex reads:** a question's watch reads only its own rows.
- **Templates and panels:**
  - Liquid parses each template once.
  - Template data stays the same object between renders.
  - Panels are built when first opened.
  - The timebox around each formula reads the clock 60× less often.
- **Re-renders:** committing one question's edit draws the Workbench once and that question's row,
  where it used to draw the Workbench 3 times and 121 rows.

The last thread's landing was a full e2e run on the spine's top, which stands as the sprint-end
proof: `284 passed, 4 failed, 0 not run, in 301 s, 1913 test-seconds (load 22.7)`. All four
failures passed when rerun alone. Plan, progress and each thread's file are in
`whiteboard/20261009-perf_improvements/`. A live mirror is the sprint doc,
https://claude.ai/code/artifact/84675f7d-2072-44f2-a3f0-8b57beb20753.

## PRs, in the order they landed

| PR | Thread | Stacked on | State |
|---|---|---|---|
| #207 | 3 e2e_fixtures | #205 | merged |
| #208 | 1 spine_test_split | #207 | merged |
| #210 | 4 convex_reads (the `questions.open` half) | #208 | open |
| #213 | 5 render_caches | #210 | open |
| #218 | 6 stable_rows | #213 | open |

**#210 needs a reload after it deploys.** Tabs left open across the deploy show saved bot cells
as empty until reloaded. Nothing is lost.

## Waiting for the Coach

1. **Thread 2, e2e_load: built and reviewed, not landed.**
   - It is in worktree `/home/node/worktrees/triquet/e2e_load`, at HEAD `61f39cd8`, on lane 2.
   - What it does:
     - e2e workers follow the load: `floor((cores - load) / 1.5)`, between 2 and 7.
     - A new `scripts/convex_run` calls a function over HTTP.
     - Resetting the backend is one HTTP request per batch.
     - The two env sets are one.
     - The push to the backend is skipped when nothing it bundles has changed.
   - The reviewer's edits to `scripts/convex_dev` were refused by the permission classifier ("Modify
     Shared Resources"). Three gaps in the push skip are therefore left:
     - The fingerprint leaves out the lane's ports. A lane change with `data/` kept skips a push
       that is needed, and the stored auth domain keeps the old port.
     - It hashes the lockfile rather than `node_modules/.pnpm/lock.yaml`.
     - A `--watch` run does not clear the fingerprint when it exits.
   - Having the worker make the refused edits would go round a permission decision. Choose:
     - allow the edits, and I'll have the worker apply them and get a second review;
     - drop the push skip;
     - land it as is, with the gaps in `whiteboard/TODO.md`.
2. **Thread 4's hunt tally: built and reviewed (clean), held back.**
   - It is on the local branch `20261009-convex_reads_tally` (`7857b74b`), not pushed.
   - `makeHuntFor` checks the app's cap against a one-row tally that a trigger keeps. Creating a
     hunt then reads 19 docs, where it used to read 17 plus one per hunt in the app.
   - It adds a `tallies` table and hand-rolls the tally rather than using
     `@convex-dev/aggregate` or the sharded counter. CLAUDE.md asks for a Coach's yes before
     hand-rolling.
   - If yes: rebase the branch onto the spine, dropping its now-duplicate `questions.open` commit,
     and land it as its own schema-change PR. `thread-4-convex_reads.md`, *Held for the Coach*,
     says how.

## Decisions taken in YOLO

- **The "low-hanging fruit" was split between threads 5 and 6.** Thread 5 did the caches and
  panels. Thread 6 did the stable identities and row memo.
- **The e2e work was split between threads 2 and 3.** Thread 2 is how a run is set up; thread 3 is
  how the specs get in.
- **The jsonata timebox is kept.** It checks depth on every step and reads the clock every 256
  steps.
- **Thread 4 was landed in half.** The `questions.open` half landed without the hand-rolled tally.
- **Thread 5 builds panels on first open and keeps them mounted.** It uses `mountOnEnter`, where
  the plan said `unmountOnExit`, so drafts and pastes survive.
- **Thread 6 added `happy-dom` as a dev dependency**, for the new render-counting `dom` Vitest
  project. It is listed in `notes/stack.md`.

## Open questions and things to confirm

- **Two hand-rolled caches to confirm or veto.** Thread 5's text-keyed Liquid parse cache is
  entered in `notes/stack.md` under *Hand-rolled on purpose*. So is the tally above, but only on its
  branch.
- **A lint config change.** `eslint.config.mjs` gained a `triquet/benches` block that turns off
  `vitest/expect-expect` for `*.bench.tsx` (thread 5).
- **One lint suppression:** `no-empty-pattern` in `tests/support/spine-world.ts`, for a vitest
  fixture that needs nothing (thread 1).
- **React Compiler was not tried.** Thread 6's hand-placed memo is now pinned by render-count tests,
  which would also catch a compiler that undid it.
- **Flakes under load.** The specs that flake most are `entries` and `reviews`, plus the
  `panels` `preparedExport` spec. Thread 6 found that last one was a click during a panel's
  opening animation, and fixed it.
- **Follow-ups in `whiteboard/TODO.md`:**
  - an override for `E2eLockPollMs` in tests;
  - `clearAll` deleting raw;
  - calibrating the cores per e2e worker;
  - React `<Activity>` for panels that were opened and folded again.
