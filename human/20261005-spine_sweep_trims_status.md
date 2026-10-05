# 2026-10-05: `pnpm sweep` drops the first letter of the first path it sweeps

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
