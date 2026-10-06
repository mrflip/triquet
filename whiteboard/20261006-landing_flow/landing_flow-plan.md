# Landing flow: prove before you bid, bid cheaply

**Date:** 2026-10-06. **Status:** approved by the Coach; built (see `thread-landing_flow.md`) and landed as #146, stacked on #116; unreviewed at the Coach's direction. **Asked by:** flip, after sprint
little_fixes (`whiteboard/20261004-little_fixes/`), where workers spent long stretches waiting on e2e.

Words: **tests** = `pnpm test` (vitest). **justify** = `pnpm typecheck && pnpm lint && pnpm test`.
**e2e** = the Playwright suite alone. **Top** = the spine's top. **Snipe** = another branch landing
after you proved yours, so the top you proved against is gone.

## What happens today, and why it hurts

`pnpm land` (`scripts/spine.ts`, `land`) holds the spine lock only for seconds: once to replay and
sweep, and once to fold in. Between those it rebases, runs justify, then the full e2e, all unlocked.
Afterwards it looks at the top: if anyone landed meanwhile, it rebases and runs **justify and the
whole e2e again**, up to 5 times. A failed spec stops it, and "land again" restarts from the top,
full justify and full e2e included.

So every landing snipes everyone in the middle of e2e, and each snipe costs a full justify + e2e
(2.3 minutes on a quiet machine, 12 under load). Under load the windows stretch, more snipes land
in them, the reruns add load, and the slowest worker can be starved. Waiting isn't the cost.
Rerunning after snipes is.

## The flow

```
A  build      tests at will, until the worker is satisfied
B  prove      catch up -> justify -> e2e -> repair each failure alone, until green
C  refresh    top moved since B? catch up -> justify -> repair (e2e only at the worker's judgement)
D  bid        pnpm land: under the lock, catch up if needed, run tests, fold in, push
E  PR         gh pr create
```

* **A. Build.** Tests at will. Nothing expensive.
* **B. Prove.** `pnpm catchup` rebases the branch onto the current top (the lock is held only for
  the seconds the replay and sweep take). Then `pnpm justify` until it is green, repairing as
  needed. Then `pnpm e2e`, the full suite on the lane. Each failure is repaired on its own:
  `pnpm e2e:rerun` runs `playwright test --last-failed --workers=1`, or the worker runs one
  spec or a few, by judgement. A spec that fails in the full run and passes alone is a **flake**.
  It doesn't block, but it is always reported (below). B ends when every spec of the full run
  has passed, in the full run or alone. The worker records it: `branch.<b>.proved` holds the
  top it was proved on and the branch's patch-id.
* **C. Refresh.** If the top has moved since B, run `pnpm catchup` and `pnpm justify` again,
  and repair. E2e is the worker's call: usually none, some if the snipe touched the same corner.
  What is being defended is only the interaction between the new top and this branch. Everything
  beneath already passed justify and e2e with its own work, and sprints are issued to be
  independent.
* **D. Bid.** `pnpm land`, changed to:
  1. Refuse unless the branch has an e2e proof (B) and a justify that is current. Current means
     taken on the present patch-id, so a code change since then needs justify again, but a plain
     rebase doesn't. Docs-only branches are exempt from e2e (below).
  2. **Under the lock:** catch up if the top moved, run **tests**, fold in, push.
  3. A failure or a rebase conflict releases the lock and stops with the spine untouched. The
     worker repairs it, re-justifies, and bids again.
* **E. PR.** Filed as now. Its **Tests:** line names every flake from B and C.

Order within a sprint thread: A, then `ready`, review, B, C, D, E. Reviewing before B keeps the
window from the first catch-up to the bid short, which is what keeps snipes few. The reviewer's
fixes are covered by B.

## Timing: why this beats today

| Moment | Today | Proposed |
|---|---|---|
| A snipe during your expensive work | redo justify + full e2e (inside `land`, up to 5 times) | redo catch-up + justify (C); e2e only by judgement |
| A flake | stop; "land again" = full justify + full e2e | rerun that spec alone, about 10 s, and report it |
| Waiting for the lock | seconds, but then exposed to snipes for justify + e2e | queue time x tests time, and no snipe can happen under the lock |
| Two e2e suites at once | the slower one gets sniped | runs freely; nothing waits on them, since the bid does no e2e |

E2e runs in parallel, whenever each worker likes, as the Coach wants. Nobody waits for anyone's
e2e: the only line is at the lock, where each holder runs tests only. With *n* bidders queued,
the worst wait is about *n* x the tests' duration. That is shorter than one e2e run unless the
queue is long. The thread measures tests' and justify's durations and puts them here.

**What we accept:** an interaction between the top a branch was proved on and anything that
landed after it is caught only by tests at the bid, and then by CI's full suite on the PR. CI
already runs justify, a production build, and e2e on 6 shards with a retry, on every push. A
cloud e2e failure costs the Coach little; workers waiting cost a lot. Not covered under the lock:
typecheck (vitest strips types). Adding `pnpm typecheck` to the bid costs its duration per bid.
The thread measures it and the Coach chooses.

## Pieces to build (one thread, `scripts/spine.ts` and its tests, plus the guidance)

1. **`pnpm catchup`**: `land`'s first half, split out. Hold the lock, replay the spine onto
   origin if origin moved, and sweep. Release, then rebase the branch onto the top. Record
   `spinebase`.
2. **`pnpm justify`**: typecheck, lint, tests. When green, record the patch-id.
3. **`pnpm e2e`** and **`pnpm e2e:rerun`** (`--last-failed --workers=1`). Both append to the e2e
   log and record the proof when every spec is accounted for.
4. **`pnpm land`**, as in D. The checks that run under the lock stay configurable, as
   `TRIQUET_LAND_CHECKS` is now, defaulting to `pnpm test`.
5. **Docs-only, mechanically:** when every path changed since `spinebase` is a `*.md` file or
   sits under `whiteboard/` or `human/`, land needs no e2e proof. It still needs a current
   justify (cheap for docs) and still runs tests under the lock.
6. **Workers: 7** locally (`playwright.config.ts`, now `'50%'`, which is 8 here).
7. **The e2e log**, to see how often we fail for non-pristine reasons. It is one JSON line per
   run, kept outside any checkout (`$TQ_WORKTREES/.e2e-log.jsonl`): when, branch, lane, the
   load average, whether the build cache was cold, seeded or warm, the failures, and what each
   rerun did. `pnpm e2e:log` summarises it: failure and flake rates, split by load and by cache
   state.
8. **Reuse what we can:**
   - **Next's build cache:** seed each new worktree's dist directory from the main checkout's
     at `pnpm worktree`, copied (a reflink where the filesystem allows it), never shared live.
     Two dev servers writing one cache can corrupt it.
   - **Measure first:** the log's cache field says whether seeding pays.
   - **Already shared:** the pnpm store, Playwright's browsers and the Convex backend binary.
9. **Guidance:**
   - `notes/git_hygiene.md`, *Finishing*, becomes A to E.
   - `thread-worker.md`'s *The thread*, the sprint skill's §2 and the reviewer's suites step
     follow it.
   - Remove the "wait for the load to fall below 8" advice (PR #131): flakes are rerun alone,
     and the bid does no e2e.

## Measured (2026-10-06, by the thread)

16 cores, an OrbStack VM whose load average counts every container on it, so "quiet" means a
load of 3 to 7 that other containers set. Seconds, wall clock.

| Step | Alone | Notes |
|---|---|---|
| `pnpm typecheck` | 1.4 warm, 7 cold | warm = tsbuildinfo current; after a rebase it lies between |
| `pnpm lint` | 41-43 | the long pole, measured with no cache; it now keeps one (`.eslintcache`) |
| `pnpm test` | 23-24 | 136 files, 3987 tests |
| all three in sequence | about 66 (72 cold) | |
| `pnpm justify` (side by side) | 46-47 (50 cold) | about lint's time: parallel saves 20-25 s |
| `pnpm justify`, lint cached | 25 | the tests are the long pole now |
| the bid's checks (typecheck beside `pnpm test:bid`) | 25 | quiet |
| `pnpm test` beside one e2e suite | 169 and 275 | as at a bid while another worktree proves; load rose 12 to 89; 4 and 19 tests timed out at vitest's 5 s |
| `pnpm e2e`, full, quiet | 163 cold, 179 warm, 178 seeded | 252 specs, seven workers; one flake in two of three runs |
| `pnpm e2e`, full, loaded | 689 cold | load 5 to 62 (unit tests ran beside it): 60 failed |
| `pnpm e2e:rerun` | 13-19 | the flake and the setup project |
| seeding the e2e cache | 0.8 | 1.1 GB copied from the main checkout |

What follows:

* **Typecheck joins the bid**, the Coach's call on these numbers: 2-7 s alone, run beside the
  tests (`pnpm run --no-bail`, as justify runs), so it adds nothing to the bid's wall time.
* **Lint keeps a cache** (`eslint --cache --cache-strategy content`, `.eslintcache`, gitignored),
  the Coach's call: type-aware results can go stale when a file's dependencies change, so if CI's
  lint disagrees, `rm .eslintcache`.
* **The bid's tests are load-sensitive.** Beside another worktree's e2e suite they take 3-5
  minutes, not 24 s, and process-heavy tests time out. The bid now allows each test a minute
  (`pnpm test:bid`, `--testTimeout=60000`; CI keeps five seconds), and the spine's own tests a minute
  each. A queue of bids waits that long per bid ahead.
* **Seeding did not pay, so far.** Cold, warm and seeded runs took the same time on a quiet
  machine: Next's dev server compiles on demand and the setup project warms the first page.
  The copy costs under a second, so it stays while the e2e log gathers more runs.

## Not doing (whiteboard/TODO.md, *Ways to have workers spend less time twiddling thumbs waiting for e2e*)

A machine-wide e2e lock, and random backoff before retrying: both reasons are recorded there.
