# Perf improvements: progress

Kept by the orchestrator. Newer than `perf_improvements-plan.md` wherever the two disagree. Each
worker writes its own `thread-<N>-<label>.md` beside this file.

**Status: thread 5 underway; thread 4 landing (questions.open half); thread 2 and thread 4's tally wait for the Coach; threads 1, 3 landed.**

| # | Thread | Status | PR |
|---|---|---|---|
| 1 | spine_test_split | landed | #208 |
| 2 | e2e_load | reviewed; waits for the Coach (see below) | |
| 3 | e2e_fixtures | landed | #207 |
| 4 | convex_reads | landing questions.open half (full e2e); tally on local branch `20261009-convex_reads_tally` | |
| 5 | render_caches | underway (lane 1) | |
| 6 | stable_rows | pending (waits for 5) | |

## Waiting on the Coach

* *Orchestrator:* **Thread 2 (e2e_load)** is reviewed and unlanded in `/home/node/worktrees/triquet/e2e_load` (HEAD `61f39cd8`). Its reviewer kept one fix (the log reads `metadata.actualWorkers`) but was refused by the permission classifier ("Modify Shared Resources") when editing `scripts/convex_dev`, and left three push-skip hazards unfixed: the lane's ports are not in the fingerprint (a lane change with `data/` kept skips a needed push, and the stored auth domain keeps the old port); the lockfile is hashed rather than `node_modules/.pnpm/lock.yaml`; a `--watch` run does not clear `pushed` on exit. Routing those edits through the worker would launder a permission decision, so the Coach chooses: allow the edits, drop the push skip, or land as is with the hazards in TODO.

* *Orchestrator:* **Thread 4 (convex_reads)**: the `makeHuntFor` fix hand-rolls a tally (new `tallies` table, `convex/tallying.ts` trigger, lazily counted). CLAUDE.md asks a Coach's yes before hand-rolling, so the tally commit (`9ca53ab4`) waits for the Coach. The `questions.open` commit (`69a45025`) stands alone and needs no schema change; if no answer comes before landing, the worker lands that half only and keeps the tally on a branch of its own.

## What the threads have taught

* *Orchestrator:* **Thread 3 (e2e_fixtures)** added `testing:putOnHunt` and its helper `putOnHunt(hunt, label, role)` in `e2e/admin.ts`, plus a worker-scoped second visitor (`friend`, `friendLabel` fixtures in `e2e/support.ts`). A spec that needs a second person on a hunt should use these, not the Members panel. Measured: routing 298 to 250 test-seconds, reviews 83 to 53. Its `thread-3-measurements.md` holds runs to compare against.
* *Orchestrator:* **Thread 4** *Review:* clean. Left (minor): tabs open across the deploy show saved bot cells empty until reloaded (functions go live before pages; nothing lost; noted in the PR); the tally's first count stops at the cap.
* *Orchestrator:* **Thread 4 (convex_reads)**: a question's reading now carries `stored` keyed by **widgeting id**; the frame gains `widgeting_ids` (label to id); `quizFromSeen` relabels in run order, in `rows.ts` only. `QuizT`/`QuestionT` unchanged. **For thread 6:** a per-question cache must also depend on the frame's `widgeting_ids` and `widgetings`, since a widgeting renamed changes only the frame. Reads: `questions.open` 7 docs/6 ranges to 4/4 on the fixture; hunt creation 17+N to 19. `tests/support/counting.ts` counts docs and ranges read, for any later read test.
* *Orchestrator:* **Thread 1 landed, #208.** *Review:* clean; left (minor) an early assertion failure in `spine-e2e-lock.test.ts` can orphan the fake e2e run (pre-existing), and two direct `isolatedEnv` calls go without the compile cache.
* *Orchestrator:* **Thread 3 landed, #207.** *Review:* clean; `sessionLeftBy` is belt and braces, not load-bearing (Convex Auth answers a spent token whose child went unused). Full run 287/288, one `panels` flake.
* *Orchestrator:* **Thread 1 (spine_test_split)**: unit wall 56 s to 12 to 13 s. The spine's tests are `tests/scripts/spine.test.ts` (pure helpers) plus one `spine-<command>.test.ts` per command, over `tests/support/spine-world.ts` (`{ world }` fixture). A new spine test goes in its command's file. The suite is now bound by total work, not one file. Open: `E2eLockPollMs` (2 s) could be overridable in tests to save ~4 s from the slowest file; left for a later touch of `scripts/spine.ts` (in `whiteboard/TODO.md`).
* *Orchestrator:* **Thread 2 (e2e_load)**: `Environment.workersFor` (`e2e/environment.ts`) picks `floor((cores - load1) / 1.5)`, clamped 2..7 (1 on CI), and the e2e log records `workers`. New `scripts/convex_run <role> <fn> [json]` calls a function over HTTP in 0.1 s; use it in scripts, not `convex run`. `convex_dev` skips the push when a hash over what it bundles (`data/convex-<role>/pushed`) is unchanged: **after a push by hand, delete that file.** Fixed setup measured 8 to 11 s before (not 15 to 30), 4.7 to 7.3 s after. The `panels` specs flaked even on 2 workers.
* *Orchestrator:* The agents' rate limit cut all three first threads off once (2026-10-09 ~04:30 UTC); each resumed from its commits with nothing lost.
* *Orchestrator:* The machine has been running at load 33 to 42 while three threads build. Expect two-visitor and dialog-heavy specs to time out under it; rerun alone at once (thread 3 saw this on the base code).
