# 2026-10-09: Columnwise paused: the spine's replay onto main conflicts (the Coach's call; resolved)

**Where things stand.**
* Merged: #191 through #201.
* Landed and open: #202 (5b) and #206 (9), stacked in that order. The main checkout stands on
  `20261009-cw_budgets` and is clean.
* Not started: 3c, then a full e2e run, then 10 and 11 (`columnwise-plan.md`).

**Why it stopped.** Two PRs from outside the sprint merged to `main`: #203 (import carries
replies) and #205 (recheck's verdict tests get 5 s on CI). Cutting 3c's worktree replays the spine
onto `origin/main` first, and that replay conflicts. The conflict is at thread 9's `1c5038c`, in
`tests/lib/redos.test.ts`. Both sides fix the same flake (recheck's cold first check timing out on
a loaded machine). #205 adds a local `VerdictMs = 5000`. Thread 9 adds `tests/support/redos.ts`
(`RoomyMs = 10_000`) and also covers the three mutation suites, so it is a superset. The tooling
undid the replay; a conflicting replay is the Coach's call.

**Rehearsed** in a throwaway detached worktree, with no branch refs moved:
* Taking thread 9's side (`--theirs` during the rebase) is the only conflict in the whole replay.
* The resulting `redos.test.ts` is identical to the spine's.
* The replayed top typechecks and passes every unit test (5,648, 1 skipped).

**To resolve** (the Coach, or the orchestrator on the Coach's say-so), in the main checkout:

```sh
cd /workspace/triquet && git fetch origin
git rebase --update-refs --autostash origin/main      # stops at 1c5038c
git checkout --theirs -- tests/lib/redos.test.ts && git add tests/lib/redos.test.ts
GIT_EDITOR=true git rebase --continue
git push --force-with-lease=20261009-cw_runorder:6188db95 origin 20261009-cw_runorder
git push --force-with-lease=20261009-cw_budgets:2b124c4 origin 20261009-cw_budgets
```

The leases are origin's SHAs as of this entry. If origin has moved since, the push refuses: fetch,
and take the new SHAs.

**A spine-tool bug found on the way.** The undone replay left `20261009-cw_runorder` at a
rewritten copy (`cadf493`, 5b replayed onto #205). `rebase --abort` did not put back a ref that
`--update-refs` had moved. The orchestrator set the ref back to `6188db95` (origin's, and the
spine's) with `git branch -f`; the old value is in the reflog. `scripts/spine.ts`'s `replay()`
should record each spine ref before the rebase and restore it after an abort.

**Resolved, 04:03 UTC.** The replay was run (after #204 also merged); its `redos.test.ts` keeps both
`VerdictMs` and the `RoomyMs` support. Then, on the Coach's "fix both prs", the orchestrator moved
the eslint ignore for `whiteboard/**/*.mts` into #202's branch, which carries `prd_checks.mts`
and failed lint without it. Both branches were pushed with leases. 3c is cut and building.
