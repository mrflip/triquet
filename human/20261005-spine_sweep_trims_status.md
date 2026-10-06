# 2026-10-05: `pnpm sweep` dropped the first letter of the first path it swept -- resolved

**Resolved.** Both halves are fixed on main: `sweep` and `removeWorktree` read status through
`gitExactly`, untrimmed (your fix), and the reviewer no longer runs `/code-review --fix` (#113).
The *Stage before you sweep* workaround is gone from the sprint skill and the worker's definition
(`20261005-sprint_lessons`). Kept below as the record; prune when you like.

`scripts/spine.ts`'s `git()` helper trims what git prints, and `sweep` reads
`git status --porcelain -z` through it. When the first entry is an unstaged change (` M path`),
the trim eats its leading space, so `pathsOfStatus` slices one character too far and asks
`git add` for `hiteboard/...`. The sweep fails, and with it every `pnpm worktree` and `pnpm land`
(each sweeps first) while such a file sits in `whiteboard/`, `human/` or `notes/`.

* **Seen**: sprint little_fixes, sweeping the orchestrator's two edited plan files.
* **Workaround used**: `git add` the files first (status then reads `M  path`), then `pnpm sweep`.
* **Fix**: read porcelain output untrimmed (a `gitRaw` beside `git()`, or trim only trailing
  newlines), with a `tests/scripts/spine.test.ts` case for a leading ` M`. Not done here: it is
  the spine's own code, outside this sprint's threads. Say the word and it becomes a thread.

**Also**: `removeWorktree` (around line 302) reads status the same way; there it only garbles the
first path in its error message (a thread-5 reviewer's note).

## And: `/code-review` runs in the main checkout, not the reviewer's worktree

Under the spine rules a `thread-reviewer` stands in a worktree, but the `/code-review` skill forks
into the session's main checkout (`/workspace/triquet`). It reviewed the orchestrator's
uncommitted docs there instead of the thread; with `--fix` it would write into your checkout. The
thread-5 reviewer caught it, ran nothing with `--fix`, and reviewed the diff by hand in the
worktree; later reviewers in this sprint are told to do the same. The fix belongs in
`.claude/agents/thread-reviewer.md` (or the skill's invocation): review by hand from the
worktree, or find a way to point the skill at the worktree's root.
