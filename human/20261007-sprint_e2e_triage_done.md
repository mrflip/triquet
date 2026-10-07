# 2026-10-07: Sprint e2e_triage done

The sprint set out to make the e2e suite fast, honest, and able to run just the part of it a
change reaches, so that sessions sharing a machine stop timing each other out. All seven threads
have landed. Six were in the plan. The seventh is a follow-up you asked for in chat, after thread
6's landing showed that the main checkout's tooling broke when a new dependency arrived. You have
merged #156 to #160. #169 and #176 are open, with #176 stacked on #169. Every worktree is removed
and every lane is free.

## What the sprint did

**The suite is honest.** Thread 1 deleted 20 duplicate or vacuous e2e tests and fixed the testing
habits the plan named. It also nominated the vapid unit and e2e tests for you to cut. Thread 3
covered the error page. Thread 4 lightly covered the stats page and the other corners nothing had
covered.

**It is faster.** Thread 2 has the backend make each test's hunt, keeps one signed-in session per
worker, and asks for layouts up front. When load is held level, a run costs about a quarter fewer
test-seconds. Neither of the plan's speed targets was met.

**You can run part of it.** Thread 5 added a map from source paths to the specs they reach,
`pnpm e2e --touched` with a scoped proof the bid accepts, and `pnpm e2e:smoke`. The smoke tier
runs 26 tests in about 30 s.

**It stops overlapping.** Thread 6 queues a second full run in the same container behind a lock.
A run that had to wait catches up with the top before it starts. Thread 7 stops a new dependency
from breaking the spine's own commands.

## Landed, in order

| PR | Thread | What it does | Stacked on | State |
|---|---|---|---|---|
| #156 | 1, e2e_trim | Deletes 20 tests, mends the pixel checks and one-shot reads, nominates vapid tests | #154 | merged |
| #157 | 3, e2e_error_boundary | Covers the error page in a new `failing-pages.spec.ts`, with the `failQuery` helper | #156 | merged |
| #158 | 5, e2e_touched | Adds the path-to-spec map, `pnpm e2e --touched` with a scoped proof, and the `@smoke` tier | #157 | merged |
| #159 | 4, e2e_light_gaps | Covers stats, two smiths on one cell, and a reviewer made a smith; unit tests can render a view | #158 | merged |
| #160 | 2, e2e_fast_way_in | Has the backend make each hunt (`testing:makeHunt`), keeps a session per worker, asks for layouts up front | #159 | merged |
| #169 | 6, e2e_lock | Locks full and touched runs per container; after a wait, catches up first; the bid re-checks a scoped proof after its rebase | main | open |
| #176 | 7, e2e_install | `proper-lockfile` is loaded only when needed; the spine installs packages when it moves a checkout onto another lockfile | #169 | open |

Each PR had one medium review, except #158, which had two. Every review's comment is on its PR.
Merge #169 before #176, or merge #176 and both go together.

## What it cost

Test-seconds are summed over every test in a run.

| Run | Tests | Test-seconds | Wall | Load as it began |
|---|---|---|---|---|
| Baseline, before the sprint | 259 | 1006 | 157 s | 2 |
| After the fast way in, quietest | 239 | 762 | 121 s | low |
| Thread 2's proof, beside two other lanes | 249 | 1753 | 272 s | 27, rising to 46 |
| Thread 6's proof, on a moved main | 254 | 1081 | 171 s | 3.8 |
| Thread 7's proof, the final top | 255 | 960 | 154 s | 3.1 |
| Smoke tier | 26 | 111 | 30 s | 6 |

Load decides the cost more than any change here. The lock stops two runs in one container from
overlapping. It cannot see your other containers.

## What happened after thread 6 landed

Thread 6 imported `proper-lockfile` at the top of `scripts/spine.ts`, and only `pnpm worktree`
installed packages. The main checkout therefore lacked the package, and every spine command there
failed until something installed it. With your word, I ran `pnpm install --frozen-lockfile
--prefer-offline` in the main checkout, which touched only `node_modules`. Thread 7 then made sure
it cannot happen again.

## Open questions, gathered

Policy:

1. **May sprint workers prove with `pnpm e2e --touched`?** CLAUDE.md step 3 and the thread-worker
   agent's *Prove* step still name only `pnpm e2e`. Allowing it would cut most full runs. (#158)
2. **After waiting for the lock, a run may rebase the branch**, and it then says to run
   `pnpm justify` again. CLAUDE.md step 3 and the thread-worker's *Prove* step don't say so yet.
   (#169)
3. **What does the map mean by "the whole suite"?** A file could go there when every quiz screen
   opens through it, or when every quiz screen draws it. The map uses "opens through". I would
   keep it. (#158)
4. **Should rendering views in unit tests spread?** `notes/testing.md` limits it to what a view
   chooses to say. Its helper doesn't decode HTML entities, and fixing that wants a library. (#159)

Product:

5. **Is `ReadWaitMs` long enough under load?** The quiz-history milestone race recurred twice, in
   thread 2's run under the build and in thread 6's first run. Each time it passed when run alone.
   (#156, #160, #169)
6. **Should the address check refuse reserved org labels?** `/~ghost_id/<hunt>` shows a page
   failure rather than "No such hunt". (#157)
7. **Keep `PageFailed` reporting each failure to the console only once under the dev server?** I
   would keep it. (#157)
8. **Who is an admin?** Today every ident is. The stats page's "choose a username first" line will
   read wrong once that narrows. (#159)
9. **Should two hunts made at once still conflict?** They do, because `newHunt` reads every hunt
   to enforce the cap. (#160)
10. **Should `initialAuthTokenReuse` be set?** It would stop each page load spending a refresh
    token, but it changes how production signs in. (#160)
11. **Is a second kept session per worker wanted,** for the specs that bring in a friend? (#160)

Tooling, all minor:

12. **The lock does nothing across your containers.** Only a lock on a path every container
    shares would help, and that is a question about the mounts. (#169)
13. **A signal sent to the lock holder's process alone frees the lock while the suite keeps
    running.** Ctrl-C reaches the whole process group and is fine. (#169)
14. **`withSpineHeld` is a hand-rolled lock** that `proper-lockfile` could replace, after the same
    restructuring into child processes. (#169)
15. **The install covers a checkout only when the spine moves it.** A checkout whose packages
    already lag isn't caught. After a failed install, the next catch-up doesn't try again.
    (#176)
16. **An install in the main checkout swaps `node_modules` under a running `pnpm dev`**, as a
    landing already swaps its files. (#176)

Housekeeping:

17. **Which vapid tests should go?** The nominations are in `human/20261006-vapid_tests.md`, and
    nothing there is deleted yet.
18. **Your old CLAUDE.md edit is still in your stash list** as `stash@{0}: autostash`. The landed
    version supersedes it, so it is safe to drop.
