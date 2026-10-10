# Git hygiene for the Coach

What only the Coach does with the repository: merging, and reading the graph. Agents follow
`notes/git_hygiene.md` and their place's file (`-laptop`, `-cloud`); nothing here is theirs to run.

## Merging

The only way into `main` is a merge commit on an up-to-date branch that passes CI. Agents never
merge, and never enable auto-merge.

The trivial case is `pnpm automerge <PR#>` (`scripts/automerge.ts`). It replays the PR's line onto
`origin/main`: the open PRs beneath it and above it, by `restack` when they are the spine. It
pushes them with leases, then sets the PR to merge once main's required checks pass. Run it again
for the next PR once one merges. It stops, pushing nothing, on anything a person should look at:

- a conflict;
- a schema change, a new backfill, a `(Serial Deploy …)` title, or a description that says "before merging";
- a draft, a fork, or a base other than `main`;
- two stacks on one PR, or a line partly on the spine;
- a `main` whose ruleset requires no checks, where auto-merge would merge before CI ran.

`--dry-run` says what it would do.

## Looking at the graph

```
git log --graph --oneline --decorate origin/main -30   # the ladder
git log --first-parent --oneline origin/main           # one line per PR
git branch --merged origin/main                        # local branches whose own commits reached main
git branch -r --merged origin/main                     # the same, for remote-tracking refs
```

The ladder: every bubble's main-side edge is empty, so a dead head sticks out. `--merged` misses a
branch whose PR merged after a rebase, or whose work landed reworded, so it is not the list of
what to delete (`notes/housekeeping.md`).
