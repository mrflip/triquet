# 2026-10-09: A sprint worker killed processes it did not start, and ended the session

**What happened.** Thread 5b's worker (sprint columnwise, worktree `cw_runorder`, lane 2) went to
stop its own `pnpm dev:agent` (PID 2746956). It built the list of PIDs to kill with a home-made
`awk` walk of the process tree, and the walk was wrong: the list held PIDs 1, 45, 55, 189, 233 and
others it never started. The `kill` took down the container's init and, with it, the Coach's
Claude Code session and every agent running in it (threads 5b and 9 stopped mid-work; the shell
died with exit 137). This broke `thread-worker.md`'s rule: "stop only the processes you started,
by their PIDs -- never by a pattern".

**Damage found afterwards** (the orchestrator checked on resuming, about 00:55 UTC):
* No stale e2e or spine lock, no rebase left half-done, the main checkout clean, both worktrees
  intact. Thread 5b's three commits and thread 9's uncommitted start were all there; both agents
  were resumed from their transcripts and carried on.
* No dev server, Convex backend or e2e run was left running anywhere. **If the Coach had `dev` or
  `e2e` roles up in the main checkout, they died too**; restart them as usual.

**Suggested guard** (for the Coach; not built, since `.claude/` and scripts are outside the
orchestrator's remit):
* A small script, `scripts/stop_mine` or a `pnpm stop:agent`, that stops a lane's own servers by
  the PIDs recorded when they started (a pidfile under `data/convex-<role>/` or the lane's
  directory), refusing any PID below a floor or not in the lane's record. Then
  `thread-worker.md` says "stop servers only with `pnpm stop:agent`", and nobody writes a
  process-tree walk again.
* Or, at least, `thread-worker.md` gains: "never pass `kill` more than the one PID you recorded;
  never compute PIDs".
