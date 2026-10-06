# 2026-10-06: Sprint e2e_triage paused, waiting on your word for thread 6

Five of the six threads have landed, and the sprint now waits on thread 6, the per-container lock
on full e2e runs. You asked to hold it until you had seen the measurements, and they are below.
Nothing is left in a worktree. Every lane is free.

## The stack, in landing order

| PR | Thread | What it does | Stacked on |
|---|---|---|---|
| #156 | 1, e2e_trim | Deletes 20 duplicate or vacuous e2e tests, mends the pixel checks and one-shot reads, and nominates vapid tests | #154 |
| #157 | 3, e2e_error_boundary | Covers the error boundary in a new `failing-pages.spec.ts`, with the `failQuery` helper | #156 |
| #158 | 5, e2e_touched | Adds the path-to-spec map, `pnpm e2e --touched` with a scoped proof the bid accepts, and the `@smoke` tier | #157 |
| #159 | 4, e2e_light_gaps | Covers the stats page, two smiths on one cell, and a reviewer made a smith. Unit tests can now render a view | #158 |
| #160 | 2, e2e_fast_way_in | Speeds up the way in: `testing:makeHunt`, one session kept per worker, layouts asked for up front | #159 |

Every PR had one medium review. Thread 5's had two, because the first flagged that its map sent
too little to the whole suite. I settled that from the plan's own rule. Each review's comment is
posted on its PR.

## What the speed work bought

Test-seconds are summed over every test in a run.

| Run | Test-seconds | Wall | Mean | Load as it began |
|---|---|---|---|---|
| Baseline, before the sprint | 1006 | 157 s | 3.9 s | 2 |
| After thread 1 | 942 | 149 s | 3.9 s | 3 |
| Thread 2, before, paired | 1148 | 179 s | 4.8 s | about 28 |
| Thread 2, after, paired | 846 | 137 s | 3.5 s | about 28 |
| Thread 2, after, quietest | 762 | 121 s | 3.2 s | low |
| Thread 2's proof, the final top | 1753 | 272 s | 7.0 s | 27, rising to 46 |
| Smoke tier, not a proof | 111 | 30 s | 4.3 s | 6 |

* **The fast way in saves about a quarter** when load is held level. Neither of the plan's targets
  was met. The way in still takes about 1.3 s, most of it the dev server's first page load and the
  page waiting for its session, ident and hunt in turn. The mean test is 3.2 s at best.
* **Load still dominates.** The same suite costs 762 test-seconds on a quiet machine and 1753 under
  two other lanes' work. That is the stampede, and the speed work narrows it but does not end it.

## Thread 6: my recommendation is to release it

The lock queues a second full run in the same container rather than letting it overlap. It cannot
help across your two or three containers, as you said. Three reasons to build it anyway:

1. **The data says overlap costs more than waiting.** Two runs at load 25 to 45 each took
   1250 to 1750 test-seconds, against about 800 to 950 for one run alone.
2. **It is cheap.** Thread 5 left one place in `e2e()` for the lock and the catch-up to wrap.
3. **It carries a real fix.** The bid checks a scoped proof before its own catch-up, so a spec file
   that lands in a proved corner meanwhile goes unrequired. Thread 6's gloss now moves that check
   after the catch-up.

The other lever is policy, not code. Letting sprint workers prove with `pnpm e2e --touched` would
cut most full runs. That is your call, and CLAUDE.md is yours to change. See question 1 below.

## Open questions, gathered

Policy:

1. **May sprint workers prove with `--touched`?** CLAUDE.md step 3 and the thread-worker agent's
   *Prove* still name only `pnpm e2e`. (#158)
2. **What does the map mean by "the whole suite"?** Does a file go there when every quiz screen
   opens through it, or when every quiz screen draws it? The map uses "opens through". Two history
   files, the download and its help text, follow "draws", which only makes scoped runs larger.
   I would keep "opens through". (#158)
3. **Should rendering views in unit tests spread?** `notes/testing.md` now limits it to what a view
   chooses to say. Its helper does not decode HTML entities, and that fix wants a library. (#159)

Product:

4. **Is `ReadWaitMs` long enough under load?** A milestone can tag the state from before an edit.
   This recurred once under the build and never in seven dev-server runs after thread 2. (#156, #160)
5. **Should the address check refuse reserved org labels?** `/~ghost_id/<hunt>` shows a page
   failure rather than "No such hunt". Three error-boundary tests lean on that gap, and say so. (#157)
6. **Keep `PageFailed` reporting once under the dev server?** It now reports each failure to the
   console once, though StrictMode mounts it twice. I would keep it. (#157)
7. **Who is an admin?** Every ident is one today. Only a browser with no username is refused the
   backfills. The stats page's "choose a username first" line will read wrong once admin narrows. (#159)
8. **Should two hunts made at once still conflict?** They do, through the UI too, because `newHunt`
   reads every hunt to enforce the cap. (#160)
9. **Should `initialAuthTokenReuse` be set?** It would stop each page load spending a refresh
   token, but it changes how production signs in. (#160)
10. **Is a second kept session per worker wanted?** It would speed up specs that bring in a friend
    without being about the friend's way in. (#160)

Housekeeping:

11. **Which vapid tests should go?** The nominations are in `human/20261006-vapid_tests.md`. Nothing
    there is deleted yet.
12. **Your old CLAUDE.md edit is still in your stash list** as an `autostash`. The landed version
    supersedes it, so it is safe to drop.
