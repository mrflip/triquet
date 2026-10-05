# Git hygiene

History on main is semi-linear: each PR branch is rebased onto current main and lands as a merge commit. Procedures and reasoning follow the summary below.

These rules are about the history you push. Locally, use git however it helps: checkpoint commits,
scratch branches and replays to unwind a hairy change. Tidy the result before it leaves
your machine.

- Don't merge main into a branch you push, and never use GitHub's "Update branch" in merge mode. To catch up: `git fetch origin && git rebase --update-refs origin/main`.
- A pushed branch contains no merge commits; the `semi-linear` CI check rejects them.
- Push rebased branches with `git push --force-with-lease --force-if-includes`. Never plain `--force`, and never force-push a branch another agent owns.
- Open PRs against `main`, even when stacked; write "stacked on #N" in the description.
- Never merge a PR or enable auto-merge. Coach merges.
- Every commit lands in main individually: each should pass tests, and messages follow the existing log style.
- A line of work is a thread: a tidy of the stack onto origin/main, `newb`, commits at milestones, a rebase onto origin/main at the end, a PR. See *A thread, start to finish*.
- An ordered series of threads issued at once and run back to back by agents is a sprint. See *Sprints*.


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

## A thread, start to finish

A thread is one line of work: one branch, one PR, and a session may hold several. You may commit, push the thread's branch, and
open its PR without asking first.

### Starting

On a clean tree, before the first edit:

```
git fetch origin
git rebase --update-refs origin/main
pnpm newb <branchlabel>
```

The rebase tidies the stack you stand on (see *Stacks*): every unmerged branch beneath HEAD,
whoever made it, replayed onto `origin/main` in its current order, each branch pointer moving with
its commits. Branches that have merged drop out, because merge commits keep SHAs. Standing on `main`
or on a merged branch, it fast-forwards you to `origin/main`. Either way you end up on fresh ground.

This is a local tidy. Origin's copies of the branches beneath you now differ from yours, which is
fine: push only the branches you own. Should a lower branch have been rewritten on origin in the
meantime, its commits conflict on replay; that is a stop-and-ask, not a repair.

- If the rebase refuses to start (uncommitted changes) or conflicts, `git rebase --abort`, run
  `newb` where you stand, and tell the Coach what you found.
- If you stand on an unmerged branch, the new thread is stacked on it. Note that branch's PR number
  for the description.
- Carrying on with the current thread needs no new branch.

`pnpm newb <branchlabel>` branches `YYYYMMDD-<branchlabel>` from HEAD and carries the working tree
along, uncommitted changes and all. Its upstream is set, so the first plain `git push` creates the
remote branch.

### Milestones

Commit when the work reaches a place you could hand over: a set of related changes, with the app
working again (typecheck, lint, and the tests near your change pass). A milestone is a return to
working order, not a count of edits. What you push shouldn't stop mid-refactor (local checkpoints
are fine, folded in before pushing), and unrelated changes are better in separate commits. A large `convex/_generated/` regeneration goes in a commit of its own. For the
occasional deliberate commit with failing tests, see *Commits*.

### Finishing: the rebase

```
git fetch origin
git rebase --update-refs origin/main
pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e
```

Fix the straightforward conflicts yourself:

- `pnpm-lock.yaml`: take main's version, then run `pnpm install`.
- `convex/_generated/`: push to your backend again (`scripts/convex_dev agent`) and take what it writes.
- Edits that sit side by side without contradicting each other.
- Merges in docs or import lists.
- Tests that main broke in plainly mechanical ways, such as a rename.

Stop and ask for anything that takes judgment:

- Both sides changed the same logic, or the schema.
- Main changed something the thread depends on.
- Resolving would mean dropping a change from either side.
- The suite fails after the rebase and the cause isn't obvious.

When a rebase turns hairy, tag the tip from before it, so there is a named place to rewind to.
Mid-rebase, the branch still points at that tip. Keep the tag local:

```
git tag prerebase/<branch> <branch>          # mid-rebase; after it, use <branch>@{1}
git range-diff prerebase/<branch>...HEAD     # afterwards: what the rebase changed, commit by commit
```

To stop, either:

- finish the rebase with your best resolution, then report it and offer to rewind to the tag; or
- on large problems, `git rebase --abort`, which returns the branch to where it was.

Either way, report the conflicting commits and files, what each side meant, and the tag's name.
Delete the tag once the PR merges.

### Filing the PR

Push: plain `git push` the first time, and `git push --force-with-lease --force-if-includes` after
any later rebase. Then run `gh pr create --base main`.

- **Title**: plain language, saying what changed.
- **Body**: follow recent PRs (#35 is a good model):
  - What changed, in short paragraphs or bullets with **bold lead-ins**.
  - A **Tests:** line naming the suites run and their counts.
  - "Stacked on #N" or "Follows #N" where either applies.
  - An *Open questions* list when minor questions remain. Put them in chat too, and in
    an entry under `human/` or the thread's `/whiteboard` directory where CLAUDE.md asks for that.
    A PR description is easy to miss.

A *significant* question is one whose answer would change the code in the PR. Ask those in chat
before filing, rather than filing and hoping.

`git fetch` over HTTPS works without credentials, and `gh` uses its own login. `git push` needs
credentials, and in the container the configured helper (`gcm-core`) is missing. Borrow gh's
login for the one push, without changing any config:

```
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push
```

## Sprints

A **sprint** is an ordered series of threads issued at once and run back to back without the
Coach at the wheel. The Coach hands the `/sprint` orchestrator the thread list; it writes a
plan to `whiteboard/YYYYMMDD-<sprint>/<sprint>-plan.md`, then runs each thread in turn: a
`pre-thread` agent does *Starting* (the tidy and the `newb`, repairing only the
straightforward conflicts), a fresh `thread-worker` agent owns the branch from there --
build, the finishing rebase, push, PR -- and a `thread-reviewer` agent then runs `/code-review`
over the thread's own commits, keeping the fixes it can stand behind as `fix:` commits appended
to the same branch and PR, never rewriting the worker's. Each thread is stacked on the one
before, none merged until the Coach returns. The running handoff is `<sprint>-progress.md`
beside the plan: every worker reads both before touching code and appends its section on
finishing, and it is newer than the plan wherever they disagree. The orchestrator's procedure
and its stop-or-continue rules are `.claude/skills/sprint/SKILL.md`; the agents' are
`.claude/agents/pre-thread.md`, `.claude/agents/thread-worker.md` and
`.claude/agents/thread-reviewer.md`. Everything in this document binds a sprint's agents as it
binds any other: a sprint changes who is watching, not what is allowed.

## Catching up with main

```
git fetch origin
git rebase --update-refs origin/main
git push --force-with-lease --force-if-includes
```

If you did merge main in by accident, `git rebase origin/main` fixes it. A plain rebase drops the merge commit and replays only the branch's own commits.

## Force-pushing

- Always use `--force-with-lease --force-if-includes`, never plain `--force`. The lease refuses the push if someone else pushed to the branch since you last fetched.
- Only force-push branches you own. If you branched off another agent's branch, you own only your branch. Say "stacked on #N" in your PR description.

## Stacks

A stack is a branch built on another unmerged branch: A <- B <- C. *Your stack* is every unmerged
branch beneath where you stand, whoever made it, in the order it currently stands.

- Open every PR in a stack against `main`. Upper PRs will show the lower PRs' commits in their diff until those lower PRs land, and that's fine.
- Always rebase from the **top**, with `--update-refs`: every branch pointer inside the stack moves
  with its commits. Rebasing a lower branch alone strands the ones above it on the old commits, and
  a later rebase of the top replays those stale copies: a cactus.

  ```
  git switch C
  git rebase --update-refs origin/main          # moves A's and B's pointers too
  git push --force-with-lease --force-if-includes origin C   # and B, if B is yours
  ```

- To add to a lower branch, commit there, then `git switch C && git rebase --update-refs B`.
- A branch checked out in another worktree is skipped by `--update-refs` and stays where it was.
- Rebase when `main` has moved under you: at a thread's start and finish, or after a merge beneath
  you. Not on a timer.

Two ways to land a stack:

1. **As a unit (preferred when it's ready together).** Merge only the top PR. GitHub sees the lower PRs' head commits in `main` with unchanged SHAs and marks those PRs merged automatically. You get one bubble containing all of the stack's commits.
2. **One PR at a time.** Merge A. Then rebase from C as above, which moves B and C onto the new tip, push, and merge B. Repeat. You get one bubble per PR, at the cost of a restack per merge.

## Merging (Coach only)

Agents don't merge PRs. The only way into `main` is a merge commit on an up-to-date branch that passes CI. Do not enable auto-merges.

## Commits

Every commit in a PR survives into `main` individually, so it's highly desirable that each commit builds and passes tests. Unusual circumstances may warrant intermediate commits with failures (eg to isolate a large hairy ball of mechanical changes from the thoughtful aftermath repairs, or when debugging a CI problem).

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

## Before discarding anything

Committed work survives almost anything: the reflog, or a tag, brings it back. Uncommitted work
does not. Before a command that throws changes away (`reset --hard`, `restore`, `checkout -- .`,
`clean`, `branch -D`), make everything it would discard reachable first: commit it, stash it, or
put a branch on it. If you can't tell what it would discard, stop and ask.

Anything that touches `main` directly: stop and ask Coach.
