# Git hygiene in the cloud

How work runs in a cloud session (`$CLAUDE_CODE_REMOTE` is `true`): one clone, and **one branch
and one PR per milestone**, so a session may file several. What holds everywhere (history,
commits, conflicts, what goes in a PR, merging) is `notes/git_hygiene.md`; read it too. The laptop
follows `notes/git_hygiene-laptop.md`, and nothing in it applies here: there is no spine, no
worktree, no lane but 0, and no main checkout of the Coach's.

A **milestone** is a piece of work the Coach could review and merge on its own: a set of related
changes, with the app working and the proof green. Within the session you have standing
permission to commit, push each milestone's branch, and open its PR without asking.

## 1. Branch, once per milestone

Work in the clone (`$CLAUDE_PROJECT_DIR`). Cut each milestone's branch, named like the laptop's
(`YYYYMMDD-<branchlabel>`, a label for that milestone):

* **from `origin/main`**, when it does not need an earlier milestone's work that is not merged yet:

  ```
  git fetch origin main && git switch -c YYYYMMDD-<branchlabel> origin/main
  ```

* **from the previous milestone's branch**, when it builds on it: `git switch -c
  YYYYMMDD-<branchlabel>` from there. That makes a stack: its PR shows the lower one's commits
  until that merges, and step 4 says how to keep it current.

If the session was given a branch to work on, its first milestone uses it.

## 2. Commit and push as you go

Commit at natural points: a set of related changes, with the tests near them passing. Separate
commits for unrelated changes; a large `convex/_generated/` regeneration in a commit of its own.

**Push after every commit worth keeping** (`git push -u origin <branch>`). The container is
reclaimed when the session idles out, and an unpushed commit goes with it. Push only this
session's branches: never `main`, never another session's branch.

## 3. Prove the milestone

* `pnpm justify` -- typecheck, lint and the unit tests, side by side. Green over committed work, it
  records the branch's patch-id.
* `pnpm e2e` -- the whole suite (about twenty minutes here), or `pnpm e2e --touched`, the corner
  the branch reaches (`notes/git_hygiene-laptop.md`, *Running only the corner*, says how the corner
  is chosen; it works the same here). Repair each failure alone: `pnpm e2e:rerun`. A spec that
  fails in the full run and passes alone with the code unchanged is a flake: report it in the
  PR's **Tests:** line.
* Going without e2e is a judgment: `notes/git_hygiene.md`, *When e2e is not worth running*.

## 4. Catch up

Before opening the PR, and whenever `main` has moved under an open one:

```
git fetch origin main
git rebase origin/main            # a stacked branch: rebase the top of the stack with --update-refs
pnpm justify
git push --force-with-lease=<branch>:<the sha origin holds> origin <branch>
```

Never merge `main` into a branch, on any PR, yours or not: CI rejects a merge commit. Conflicts
are handled as `notes/git_hygiene.md`, *Rebase conflicts*, says. Once a lower milestone merges,
rebase the ones above it onto `origin/main` and push each with its lease.

## 5. File the PR

With the GitHub MCP tools (`gh` is not logged in here), against `main`, **ready for review, not
as a draft**, with the title and body `notes/git_hygiene.md`, *Filing the PR*, describes. Write
"Stacked on #N" when the branch was cut from an unmerged milestone's, "Follows #N" when it
builds on a merged one. Ask in chat first when a *significant* question hangs.

Then start the next milestone (step 1).

## 6. See each PR through

The session watches every PR it opens. A red CI run, a merge conflict, or a review comment is
yours to answer: fix and push, or say in one comment why not. More commits for a PR go on its own
branch, pushed the same way. Never merge, and never enable auto-merge.
