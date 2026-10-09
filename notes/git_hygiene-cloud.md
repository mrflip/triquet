# Git hygiene in the cloud

How a thread runs in a cloud session (`$CLAUDE_CODE_REMOTE` is `true`): one session, one clone,
one branch, one PR. What holds everywhere (history, commits, conflicts, what goes in a PR,
merging) is `notes/git_hygiene.md`; read it too. The laptop follows
`notes/git_hygiene-laptop.md`, and nothing in it applies here: there is no spine, no worktree, no
lane but 0, and no main checkout of the Coach's.

Within the thread you have standing permission to commit, push its branch, and open its PR
without asking.

## 1. Branch

Work in the clone (`$CLAUDE_PROJECT_DIR`). If the session was given a branch to work on, use it;
otherwise cut one from `origin/main`, named like the laptop's:

```
git fetch origin main && git switch -c YYYYMMDD-<branchlabel> origin/main
```

A cloud branch is never stacked on another unmerged branch: it stands on `main` alone.

## 2. Commit and push at milestones

Commit when the work reaches a place you could hand over: a set of related changes, with the app
working again (typecheck, lint, and the tests near your change pass). Separate commits for
unrelated changes; a large `convex/_generated/` regeneration in a commit of its own.

**Push after every milestone** (`git push -u origin <branch>`). The container is reclaimed when the
session idles out, and an unpushed commit goes with it. Push only your thread's branch: never
`main`, never another session's branch.

## 3. Prove

* `pnpm justify` -- typecheck, lint and the unit tests, side by side. Green over committed work, it
  records the branch's patch-id.
* `pnpm e2e` -- the whole suite (about ten minutes here), or `pnpm e2e --touched`, the corner the
  branch reaches (`notes/git_hygiene-laptop.md`, *Running only the corner*, says how the corner is
  chosen; it works the same here). Repair each failure alone: `pnpm e2e:rerun`. A spec that fails
  in the full run and passes alone with the code unchanged is a flake: report it in the PR's
  **Tests:** line.
* Going without e2e is a judgment: `notes/git_hygiene.md`, *When e2e is not worth running*.

## 4. Catch up

Before opening the PR, and whenever `main` has moved under an open one:

```
git fetch origin main
git rebase origin/main
pnpm justify
git push --force-with-lease=<branch>:<the sha origin holds> origin <branch>
```

Never merge `main` into the branch, on any PR, yours or not: CI rejects a merge commit. Conflicts
are handled as `notes/git_hygiene.md`, *Rebase conflicts*, says.

## 5. File the PR

With the GitHub MCP tools (`gh` is not logged in here), against `main`, as a draft for now, with
the title and body `notes/git_hygiene.md`, *Filing the PR*, describes. It is never stacked:
write "Follows #N" where it builds on a merged PR, and no "Stacked on". Ask in chat first when a
*significant* question hangs. The Coach marks it ready and merges; `pnpm automerge` passes over a
draft.

## 6. See it through

The session watches the PR. A red CI run, a merge conflict, or a review comment on your PR is
yours to answer: fix and push, or say in one comment why not. More commits for the PR go on the
same branch, pushed the same way. Never merge, and never enable auto-merge.
