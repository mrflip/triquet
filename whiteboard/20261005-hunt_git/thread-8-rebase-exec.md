# Thread 8: the unit suite under `git rebase --exec` (2026-10-06)

Read this before scripting a check of each commit of a branch.

To check every commit of the branch, thread 8 ran `git rebase 09a94b2 --exec "pnpm typecheck &&
pnpm lint && pnpm vitest run"`. Rebase exports `GIT_DIR` (and the worktree's paths) to the
command it runs. `tests/scripts/lanes.test.ts`, `spine.test.ts` and `git-attic.test.ts` shell out
to git in temporary repositories, and inherited that environment, so their git acted on **this
worktree's own repository**:

* they committed their fixtures ("Tess Ter": `feat: shared.txt`, `chore: lanes`, `the hunt`)
  onto the rebase's detached HEAD;
* they made a branch `side`, and a worktree at `/tmp/triquet-lanes-repo-…/side`, in the shared
  repository every checkout uses.

No spine branch, tag, remote or config was touched (checked by `git for-each-ref --sort=-committerdate`,
the tag list and `git config --list --show-origin`). Recovered by `git rebase --quit`, `git
checkout -f 20261005-viz` (the working tree held the commit being checked, nothing uncommitted),
`git branch -D side` and `git worktree prune`.

To check each commit, check it out and run the suites in a plain shell:

```sh
for sha in $(git rev-list --reverse <base>..HEAD); do git checkout -q $sha && pnpm typecheck && pnpm lint && pnpm vitest run; done; git checkout -q <branch>
```

**A guard worth adding** (not done here: it is the spine scripts' tests, outside this thread): have
those tests spawn git with `GIT_DIR`, `GIT_WORK_TREE` and `GIT_INDEX_FILE` removed from the
environment, so a suite run from any git hook or rebase cannot reach the repository it runs in.
