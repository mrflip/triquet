# Recap: progress

The running handoff for `recap-plan.md`, newer than the plan wherever they disagree. Each worker
writes its own `thread-<N>-<label>.md` beside this file; the orchestrator keeps this one.

## Status

| Thread | Label | Status |
|---|---|---|
| 1 | Widen the recap fields | pending |
| 2 | Markdown to bbjank | pending |
| 3 | Panels fold and expand | pending |
| 4 | Field templates | pending |
| 5 | The recap panel | pending |
| 6 | Quiz-level widgetings and entries | pending |
| 7 | Security review | pending |
| 8 | Security fixes, certain ones | pending |
| 9 | Tighten the recap fields | pending |

## What the threads have taught

*Orchestrator:* nothing yet.

## Migration chain `recap`

*Orchestrator:* the Coach merges up to thread 1's PR, waits for its production deploy's build log
to say `Backfills: every one has finished.` (Vercel runs the backfills on deploy), then merges the
rest, thread 9's tightening last.
