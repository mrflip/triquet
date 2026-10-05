# 2026-10-05: The thread-reviewer reviews from outside its worktree, and the spine prunes

Sprint little_fixes, thread 6 (`20261005-review_in_worktree`).

* **`/code-review` cannot stand in a worktree.** It takes a PR, a branch or a path as its target
  and has no working-directory option, so it runs in the main checkout. The thread-reviewer now
  runs it over two spelled-out SHAs, never with `--fix`, and checks each finding against the
  worktree, or reviews by hand (`.claude/agents/thread-reviewer.md`, *Where the skill stands*).
  The skill sees less than it could: it reads the code around a change from the thread's base.
  A working-directory option for the skill (or for subagents) would retire the workaround. It is
  worth asking for upstream.
* **Done here: `restack` fetches with `--prune`.** This was the "stale info" refusal after #108
  merged. `fetch.prune` is unset in the container, and git_hygiene no longer says otherwise.
* **Still open: the sweep's trim bug** (`human/20261005-spine_sweep_trims_status.md`). Until it
  is fixed, the sprint skill tells the orchestrator to `git add -- whiteboard human notes` before
  sweeping. When the fix lands, delete the paragraph *Stage before you sweep* from
  `.claude/skills/sprint/SKILL.md`, along with the matching sentence in `thread-worker.md`'s
  *Land*.
