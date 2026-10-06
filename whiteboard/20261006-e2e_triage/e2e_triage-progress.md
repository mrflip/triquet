# e2e triage: progress

**Status:** thread 1 landing. Thread 6 held until the Coach releases it.

## Status

| Thread | Label | Status |
|---|---|---|
| 1 | trim and mend the e2e specs; nominate vapid tests | landing |
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

*Review (thread 1):* `fixed`, at medium through `/code-review`. Every deleted test's claim was
checked against its cover and survives; the rewritten pixel checks still fail when the behaviour
breaks. Fixed: `failures` "never a code" now rules out the stub's `RateLimitError` and `429` too
(85101f5). Left, minor: the gear zip-name check sits behind the known milestone flake (as the
plan asked); the corner inset and chaining row heights are exact to the pixel, so watch for
subpixel flake; `toHaveURL(address)` in "a smith renames the hunt" passes at once, and a comment
says why it holds.

*Orchestrator:* from thread 1's `ready` report (its file, `thread-1-e2e_trim.md`, has the detail):

* **The suite has 236 tests now, down from 256**, in the same 23 spec files. No file was deleted or
  merged, so thread 5's map names the files as they stand.
* **Vitest renders no React yet.** Thread 1 declined the dash-readout unit test because it would be
  the repo's first React render under Vitest. Thread 4 meets the same question for
  `SyncUnconfigured`: if it adds React rendering to Vitest, it decides the environment once and
  adds the dash case beside it, as one line.
* **The suite's most frequent flake has a likely product cause.** `quiz-history.spec.ts`, the
  milestone test, tags the start commit under load because `HuntMirror.milestone` waits at most
  `ReadWaitMs` (5 s) for the feeds. Thread 2 cuts load; if the flake survives it, it is the
  Coach's question, not a spec fix.
* **Widget usage counts** are now asserted exactly on a widget of the spec's own, which no other
  spec can drift. That is the pattern for any count over the shared library.
