# Git hygiene

History on main is semi-linear: each PR branch is rebased onto current main and lands as a merge commit. Procedures and reasoning are in `notes/git_hygiene.md`; read it before any rebase that touches more than one branch.

- Never merge main into a branch, and never use GitHub's "Update branch" in merge mode. To catch up: `git fetch origin && git rebase origin/main`.
- A branch must contain no merge commits; the `semi-linear` CI check rejects them.
- Push rebased branches with `git push --force-with-lease --force-if-includes`. Never plain `--force`, and never force-push a branch another agent owns.
- Open PRs against `main`, even when stacked; write "stacked on #N" in the description.
- Don't merge PRs. Coach merges.
- Every commit lands in main individually: each should pass tests, and messages follow the existing log style.
- Before marking a PR ready: rebase onto origin/main, run the full test suite, push.


## The shape we keep

History on `main` is **semi-linear**. Every PR branch is rebased onto the current tip of `main`, then lands as one `--no-ff` merge commit. The graph is a ladder:

```
*   Merge pull request #23 …        <- main
|\
| * fix: …
| * feat: …
|/
*   Merge pull request #22 …
|\
| * docs: …
|/
*   …
```

The main-side edge of every bubble is empty. There are never braids, never "Merge branch 'main' into …" commits, and never a branch forked from the middle of another branch's bubble.

Why this shape:

- The graph is readable, and a dead head sticks out.
- `git log --first-parent --oneline main` gives one line per PR, like a changelog.
- `git revert -m 1 <merge>` backs out a whole PR at once.
- Merge commits keep the branch's SHAs. Stacked branches and anything that cites a SHA stay valid after a merge. Squash-merge and GitHub's rebase-merge rewrite every SHA, which forces a restack after each merge.

Enforcement: the `semi-linear` CI check rejects any PR branch that contains a merge commit. The main ruleset requires branches to be up to date with `main` before merging and allows the "merge commit" method only.

## Catching up with main

```
git fetch origin
git rebase origin/main
git push --force-with-lease --force-if-includes
```

If you did merge main in by accident, `git rebase origin/main` fixes it. A plain rebase drops the merge commit and replays only the branch's own commits.

## Force-pushing

- Always use `--force-with-lease --force-if-includes`, never plain `--force`. The lease refuses the push if someone else pushed to the branch since you last fetched.
- Only force-push branches you own. If you branched off another agent's branch, you own only your branch. Say "stacked on #N" in your PR description.

## Stacks

A stack is a branch built on another unmerged branch: A <- B <- C.

- Open every PR in a stack against `main`. Upper PRs will show the lower PRs' commits in their diff until those lower PRs land, and that's fine.
- `rebase.updateRefs` is on, so rebasing the top branch moves every branch pointer inside the stack with it:

  ```
  git switch C
  git rebase origin/main          # moves B's pointer too
  git push --force-with-lease --force-if-includes origin B C
  ```

- Don't rebase the whole stack pre-emptively. Every merge moves `main`, so rebase **after** each merge, not before.

Two ways to land a stack:

1. **As a unit (preferred when it's ready together).** Merge only the top PR. GitHub sees the lower PRs' head commits in `main` with unchanged SHAs and marks those PRs merged automatically. You get one bubble containing all of the stack's commits.
2. **One PR at a time.** Merge A. Then rebase from C as above, which moves B and C onto the new tip, push, and merge B. Repeat. You get one bubble per PR, at the cost of a restack per merge.

## Merging (Coach only)

Agents don't merge PRs. The only way into `main` is a merge commit on an up-to-date branch that passes CI. Do not enable auto-merges.

## Commits

Every commit survives into `main` individually.
It's highly desirable that each commit builds and passes tests, but it's more desirable that commits commemorate coherent related changes; it can situationally make sense to commit with failures (eg to isolate an extremely hairy ball of mechanical changes from the thoughtful work of dealing with the wreckage).

### Commit messages

Match the existing log style: a `feat:` / `fix:` / `docs:` / `style:` / `perf:` prefix, then a plain-language summary.

## Looking at the graph

```
git log --graph --oneline --decorate origin/main -30   # the ladder
git log --first-parent --oneline origin/main           # one line per PR
git branch --merged origin/main                        # local branches safe to delete
git branch -r --merged origin/main                     # remote branches safe to delete
```

GitHub deletes head branches automatically on merge. `fetch.prune` removes the stale remote-tracking refs.

## Recovery

- **A rebase went wrong mid-way:** `git rebase --abort`.
- **A rebase finished but the result is wrong:** `git reflog` shows where the branch was. `git reset --hard <that sha>` puts it back.
- **Pushed something wrong to your own branch:** fix it locally, then `--force-with-lease` again.
- **Anything touching `main` directly:** stop and ask Coach.