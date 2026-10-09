# Perf improvements: progress

Kept by the orchestrator. Newer than `perf_improvements-plan.md` wherever the two disagree. Each
worker writes its own `thread-<N>-<label>.md` beside this file.

**Status: thread 1 underway; thread 2 in review; thread 3 landing.**

| # | Thread | Status | PR |
|---|---|---|---|
| 1 | spine_test_split | underway (lane 1) | |
| 2 | e2e_load | in review | |
| 3 | e2e_fixtures | landing (full e2e) | |
| 4 | convex_reads | pending | |
| 5 | render_caches | pending | |
| 6 | stable_rows | pending (waits for 5) | |

## What the threads have taught

* *Orchestrator:* **Thread 3 (e2e_fixtures)** added `testing:putOnHunt` and its helper `putOnHunt(hunt, label, role)` in `e2e/admin.ts`, plus a worker-scoped second visitor (`friend`, `friendLabel` fixtures in `e2e/support.ts`). A spec that needs a second person on a hunt should use these, not the Members panel. Measured: routing 298 to 250 test-seconds, reviews 83 to 53. Its `thread-3-measurements.md` holds runs to compare against.
* *Orchestrator:* **Thread 2 (e2e_load)**: `Environment.workersFor` (`e2e/environment.ts`) picks `floor((cores - load1) / 1.5)`, clamped 2..7 (1 on CI), and the e2e log records `workers`. New `scripts/convex_run <role> <fn> [json]` calls a function over HTTP in 0.1 s; use it in scripts, not `convex run`. `convex_dev` skips the push when a hash over what it bundles (`data/convex-<role>/pushed`) is unchanged: **after a push by hand, delete that file.** Fixed setup measured 8 to 11 s before (not 15 to 30), 4.7 to 7.3 s after. The `panels` specs flaked even on 2 workers.
* *Orchestrator:* The agents' rate limit cut all three first threads off once (2026-10-09 ~04:30 UTC); each resumed from its commits with nothing lost.
* *Orchestrator:* The machine has been running at load 33 to 42 while three threads build. Expect two-visitor and dialog-heavy specs to time out under it; rerun alone at once (thread 3 saw this on the base code).
