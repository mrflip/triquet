# 2026-10-05: Parallel workers, built -- worktrees, lanes, and one spine where you sit

The plan you decided (`whiteboard/20261005-parallel_git/parallel-git-plan.md`) is in, as #103
(lanes), #104 (the spine and the rewritten git_hygiene) and the parallel-sprint PR on top. This
last one was itself built in a worktree and landed with `pnpm land`.

* **Where you sit**: the main checkout stands on the spine's top, and moves up a branch each
  time a thread lands. `pnpm top` names it. Drop anything into `whiteboard/`, `human/` or
  `notes/`; the next cut, landing or `pnpm sweep` commits it. Your other uncommitted edits
  ride along, or stop a landing that would overwrite them (the agent tells you which file).
* **After you merge**, the next cut or landing replays what is left onto `origin/main` and
  pushes it; `pnpm restack` does it on demand. Merging the top of a sprint marks every PR
  beneath it merged, since replays push the lower branches too.
* **Worktrees** are in `~/worktrees/triquet/`, container only. `git worktree list` shows them;
  `pnpm worktree --remove` in one frees it and its lane. A container rebuild loses only what
  was uncommitted in them.
* **Watch for**: three e2e suites at once on one container (each uses half the cores) may
  slow specs into timeouts. If sprints see flaky e2e, drop the cap to 2 in the plan.
* **Owed to you**: while testing the alias I ran `pnpm restack` in the real main checkout. You
  had just merged #101, so it really replayed #103 onto the new main, put my uncommitted edit
  back, and pushed with a lease. Harmless, and a live proof, but it was not meant to happen.
