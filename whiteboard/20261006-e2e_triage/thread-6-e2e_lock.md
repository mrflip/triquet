# Thread 6: A per-container lock on full runs, and a catch-up after the wait (2026-10-07)

Branch `20261007-e2e_lock`. PR filed at landing; see the report. Suites: `pnpm justify` green
(4496 unit tests); a full `pnpm e2e` through the new lock, green after one known flake was rerun alone.

## Measurement

| Run | Tests | Test-seconds | Wall | Load | Cache | Waited |
|---|---|---|---|---|---|---|
| Full, lane 1, 03:41 | 249 | 1005 | 162 s, 7 workers | 15.1 as it began, 19.3 at its end | seeded | 0 s |

One flake: `quiz-history.spec.ts`, the milestone test ("an edit commits only the files it
changed…"). It passed alone, unchanged. It is the known `ReadWaitMs` race (question 4 in
`human/20261006-sprint_e2e_triage_paused.md`). The lock does not change what a run costs. It
only stops two runs in one container from overlapping, so there is no before-and-after pair.

* **Built**
  * **The e2e lock** (`scripts/spine.ts`, `underE2eLock`). A full `pnpm e2e` or `pnpm e2e --touched` takes
    `$TQ_WORKTREES/.e2e-lock` first: proper-lockfile's directory, beside the e2e log. A note,
    `.e2e-lock.json`, names the holder. Reruns, chosen specs and the smoke tier never take it, and nothing in CI does
    (`takesE2eLock`).
  * **The waiting message** (`e2eWaitSaid`) names the holder's lane, run kind, branch, checkout
    and pid, and says since when and how long ago. It also says what this run does next. When the
    holder's process is gone, it says the lock frees itself within 30 s. As printed:

    ```
    The e2e lock is held by lane 2's full run of 20261007-other_thread (/home/node/worktrees/triquet/other_thread, pid 81234), since 03:42:47, 2 min ago.
    Full and touched runs take turns in this container, since two at once time each other out.
    Waiting, for up to 60 minutes; once the lock is free, this run catches 20261007-e2e_lock up with the top first (`pnpm catchup`), since the holder has likely landed, and then runs the whole suite.
    ```
  * **The catch-up after a wait.** Once it has the lock, a run that waited runs `catchup`. If
    the catch-up conflicts, the lock is freed and the run stops with the rebase left in progress,
    as `pnpm catchup` does. The main checkout is not caught up, and neither is a worktree with
    uncommitted changes; for the second, the run says so.
  * **`waited_s`** goes on the log line of every run that takes the lock: 0 when it found the
    lock free. The run's own line shows the wait when there was one, and `pnpm e2e:log` gives a
    "Waiting for the e2e lock" line (`E2eLog.waitsSaid`).
  * **The bid reads a scoped proof afresh after its own catch-up** (the *Orchestrator* gloss).
    Inside the hold, once `land` has rebased, it runs `node scripts/spine.ts proof` in a new
    process. A spec file the top gained in a corner the branch proved is then required. The bid
    stops, leaving the branch rebased, until `pnpm e2e --touched` covers that spec.
  * **`node scripts/spine.ts proof [--skip-e2e <reason>]`**, new: where the branch's e2e proof
    stands, as a bid would take it (`e2eProofOf`, split out of `proofOf`).
  * **Documents.** `notes/git_hygiene.md` gains *One full run at a time*, and *Finishing* B and D
    are updated. `notes/stack.md` lists proper-lockfile under Testing.
  * **Tests.** In `tests/scripts/spine.test.ts`, pure tests cover `takesE2eLock` and
    `e2eWaitSaid`. World tests cover:
    * a second run waiting, naming the holder, and catching up with a branch that landed during the wait;
    * a rerun, chosen specs and CI going by without the lock;
    * a catch-up that conflicts, which frees the lock and runs nothing;
    * the bid requiring a spec file the top gained;
    * flakes passed on through the fresh read.

    `tests/scripts/e2e-log.test.ts` covers `waitsSaid`.
* **Decisions taken**
  * **A run catches up only after it waits.** That is the Coach's words ("after the lock
    releases they restack"). A run that finds the lock free does not rebase under its worker.
  * **The lock holder runs the suite in a child process: `e2e` again, told how long it waited.**
    The child takes no lock of its own. There are two reasons:
    * proper-lockfile keeps a lock fresh on a timer. The suite runs through `spawnSync`, which
      would block that timer for minutes, so the lock would go stale and a waiter would take it
      30 s into the run.
    * After a catch-up, the code that runs should be the rebased checkout's own: its
      `SpecCorners` for the touched corner, and its tally format.

    The catch-up is a child process for the first reason too, since `withSpineHeld` waits with
    `Atomics.wait`.
  * **Timings.** The lock goes stale 30 s after its holder stops refreshing it. Waiters poll every
    2 s and give up after 60 min, naming the holder.
  * **The bid's scope check: kept before the hold, and read again after the catch-up.** The early
    check refuses a bid with no proof without making it queue for the hold. The check after the
    catch-up is the one that decides. It runs in a new process because the bidding process holds
    the old `SpecCorners` in memory and would not see a map line the top added.
    * The fresh read skips the justify check, as the bid always has after its own rebase: a clean
      rebase can change the patch-id when context lines move.
    * It runs only when the bid actually rebased.
* **Deviations**
  * The plan said "on acquiring it runs `pnpm catchup` first". It runs only after a wait, as
    above. It runs as `node scripts/spine.ts catchup`, which is the same command without pnpm's
    wrapper.
  * The `proof` subcommand was not in the plan. The bid's fresh read needed it, and it is useful
    to a person on its own.
* **Discoveries**
  * **proper-lockfile's `lockSync` cannot hold a lock across `spawnSync`.** Its freshness runs on
    the event loop. Any future lock held across a long synchronous run needs the same
    child-process shape.
  * **Load was 15 to 25 with only this lane running in this container.** Other containers share
    the CPU, and this lock cannot see them, as the plan's last *For the Coach* bullet foresaw.
  * **The world tests run the repository's own script against a scratch repository**, so they
    cannot stage a top that changes the map itself. The fresh read handles that case by
    construction (a new process reads the file the rebase left). The test covers the
    spec-file-gained case.
* **For the Coach**
  * **A run that waited may rebase the branch.** Its output says "Rebased … : justify it again".
    The bid still refuses only a patch-id that changed. CLAUDE.md step 3 and the thread-worker's
    *Prove* do not mention this yet; one line in each would help. Both are yours, so I left them.
  * **`withSpineHeld` is a hand-rolled lock**: a directory, with takeover by pid. proper-lockfile
    could own it now that it is in the tree, but it holds through minutes of `spawnSync` checks,
    so it would need the same child-process restructuring. Worth a thought, not urgent.
  * **Across containers** the lock still does nothing. Only a lock on a path the containers
    share would help, and that is a question about the mounts.
