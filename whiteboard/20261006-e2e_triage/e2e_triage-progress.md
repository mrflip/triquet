# e2e triage: progress

**Status:** thread 1 underway. Thread 6 held until the Coach releases it.

## Status

| Thread | Label | Status |
|---|---|---|
| 1 | trim and mend the e2e specs; nominate vapid tests | underway |
| 2 | a fast way in: backend-made hunt, session per worker | pending (after 1) |
| 3 | cover the error boundary | pending (after 1) |
| 4 | cover stats and the other light gaps | pending (after 1) |
| 5 | path-to-spec map, `pnpm e2e --touched`, scoped proof | pending (after 1) |
| 6 | per-container lock on full runs, catch up on acquiring | **held** by the Coach |

## Baseline

From the last green full run before the sprint (lane 1, 2026-10-06 10:09, seeded cache, load 2
as it began):

| | |
|---|---|
| Tests | 259 |
| Test-seconds | 1006 |
| Wall | 157 s on 7 workers |
| Mean per test | 3.9 s |

Threads 1 and 2 replace this table with before-and-after rows from their own runs.

## What the threads have taught

Nothing yet.
