# Git hygiene

What holds wherever you work: the history we keep, commits, conflicts, pull requests, and what
only the Coach does. How a thread gets from a first commit to a pull request depends on where you
run, and lives beside this file:

- **`notes/git_hygiene-laptop.md`**, in the laptop's container (`$TQ_IS_SANDBOXED`, and no
  `$CLAUDE_CODE_REMOTE`): the spine, worktrees and lanes, `pnpm land`, sprints.
- **`notes/git_hygiene-cloud.md`**, in a cloud session (`$CLAUDE_CODE_REMOTE` is `true`): one
  branch and one PR per thread, pushed as it goes.

Where this file and those differ on how to do something, the place's own file is right.

The rules that hold everywhere:

- History on main is semi-linear: each PR branch is rebased onto current main and lands as a merge commit.
- Don't merge main into a branch, and never use GitHub's "Update branch" in merge mode. A pushed branch contains no merge commits; the `lint-typecheck` CI check rejects them. That holds on every PR, whoever opened it.
- Force-push only with an explicit lease: `--force-with-lease=<branch>:<the commit you expect origin to hold>`. Never plain `--force`.
- Open PRs against `main`, even when stacked.
- Never merge a PR or enable auto-merge. Coach merges.
- Every commit lands in main individually: each should pass tests, and messages follow the existing log style.

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

Enforcement: the `lint-typecheck` CI check rejects any PR branch that contains a merge commit. The main ruleset requires branches to be up to date with `main` before merging and allows the "merge commit" method only.

## Filing the PR

How the branch gets pushed and the PR opened differs by place (`-laptop`, `-cloud`); what goes in it does not.

- **Title**: plain language, saying what changed. A pull request that adds or changes a backfill
  in `convex/migrations.ts` ends its title `(Serial Deploy: <chain>)`, the chain being the
  sprint's name (the thread's label outside a sprint): the Coach merges up to it and waits for its
  deploy before merging what is stacked above (`notes/deploy.md`, *Serial Deploy*).
- **Body**: follow recent PRs (#35 is a good model):
  - What changed, in short paragraphs or bullets with **bold lead-ins**.
  - A **Tests:** line naming the suites run and their counts.
  - "Stacked on #N", naming the unmerged PR your branch stands on, or "Follows #N" for a merged one.
  - An *Open questions* list when minor questions remain. Put them in chat too, and in
    an entry under `human/` or the thread's `/whiteboard` directory where CLAUDE.md asks for that.
    A PR description is easy to miss.

A *significant* question is one whose answer would change the code in the PR. Ask those in chat
before filing, rather than filing and hoping.

## When e2e is not worth running

Going without a run is cheap to get wrong: CI runs the whole suite on the PR, and a red e2e there
brings the Coach back to the session that landed it, to ask for help. The call is yours, then, and
it is a call, not a ritual either way. What to run instead of a skip, and how much, is the
place's own file's to say.

The question is whether any spec could behave differently because of this branch. A spec drives the
running app in a browser, so the branch has to reach the app, or what starts the app, to be noticed.

**The usual skips**, where the answer is plainly no:

* a branch that changes only unit tests (`tests/`), with no app code and no spec;
* a script that is the repository's own housekeeping and nothing the suite runs through
  (`scripts/newb`, `git-attic`, `session-branches.ts` and the others `HousekeepingScripts` in
  `scripts/spine.ts` lists), with its tests and notes;
* an agent's or a skill's definition (`.claude/`), the lint configuration, and documents beside them
  (documents alone need no flag at all).

**Never skip, whatever it looks like** (run e2e as your place's file says), the exceptions to
those exceptions:

* **Anything in `src/`, `convex/`, `e2e/`, `fixtures/` or `public/`**, the dependencies (`package.json`, the
  lockfile), and the configuration of the app, Playwright, CI or the build. A `.md` under `src/`
  is app content.
* **A script the suite runs through**, which looks like "just a script": `scripts/spine.ts`,
  `lanes.ts`, `e2e-log.ts`, `convex_dev`, `convex_backend`, `convex_reset`, `convex_auth_keys`,
  `doppledo`, `as_role`, and any script that `playwright.config.ts` or a `package.json` script the
  suite calls names. A new script is in this group until `HousekeepingScripts` says otherwise.
* **A mixed branch**: the riskiest path decides. A unit test beside app code is an app branch.
* **Tests that stand in for a spec**: a branch that deletes or loosens a spec's coverage, or changes
  what a shared test fixture gives the e2e run, is a change to e2e.

**And distrust the feeling.** Confidence that a change is silly to test is how wrong skips happen:
the writer has just seen exactly what the change does, and not what else reads it. Before you
skip, read the exceptions again, and name in one sentence why no spec could behave differently.
If the sentence will not come, or comes out as "it's only a script", run e2e.

Say the reason in the PR's **Tests:** line (`e2e skipped: <why>`), where the Coach looks when CI
is red. From there CI is the next test: it runs justify, a production build and the whole e2e
suite on every push.

## Rebase conflicts

A rebase conflict, whenever a branch is rebased onto a newer base: fix the straightforward ones
yourself, `git rebase --continue`, check the result as your place's file says, and carry on.

- `pnpm-lock.yaml`: take the base's version, then run `pnpm install`.
- `convex/_generated/`: push to your backend again (`scripts/convex_dev agent`, or `pnpm dev:agent`) and take what it writes.
- Edits that sit side by side without contradicting each other.
- Merges in docs or import lists.
- Tests that the base broke in plainly mechanical ways, such as a rename.

Stop and ask for anything that takes judgment:

- Both sides changed the same logic, or the schema.
- The base changed something the thread depends on.
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

## Force-pushing

- Always with an explicit lease, `--force-with-lease=<branch>:<sha>`, naming the commit you expect
  origin to hold. A bare `--force-with-lease` checks against the remote-tracking ref, which any
  other fetch moves, so it protects nothing against a push you have not seen. Never plain
  `--force`.
- A lease refused as `stale info` for a branch origin has deleted (merged PRs' branches are) was
  taken from a stale remote-tracking ref: `git fetch --prune origin`, then look again.
- Whose branches you may push, and rewrite, is the place's own file's to say.

## Merging (Coach only)

Agents don't merge PRs. The only way into `main` is a merge commit on an up-to-date branch that passes CI. Agents never enable auto-merge either.

The Coach's trivial case is `pnpm automerge <PR#>` (`scripts/automerge.ts`). It replays the PR's line onto `origin/main`: the open PRs beneath it and above it, by `restack` when they are the spine. It pushes them with leases, then sets the PR to merge once main's required checks pass. Run it again for the next PR once one merges. It stops, pushing nothing, on anything a person should look at:

- a conflict;
- a schema change, a new backfill, a `(Serial Deploy …)` title, or a description that says "before merging";
- a draft, a fork, or a base other than `main`;
- two stacks on one PR, or a line partly on the spine;
- a `main` whose ruleset requires no checks, where auto-merge would merge before CI ran.

`--dry-run` says what it would do.

## Commits

Every commit in a PR survives into `main` individually, so it's highly desirable that each commit builds and passes tests. Unusual circumstances may warrant intermediate commits with failures (eg to isolate a large hairy ball of mechanical changes from the thoughtful aftermath repairs, or when debugging a CI problem).

### Commit messages

Match the existing log style: a `feat:` / `fix:` / `docs:` / `style:` / `perf:` prefix, then a plain-language summary.

## Looking at the graph

```
git log --graph --oneline --decorate origin/main -30   # the ladder
git log --first-parent --oneline origin/main           # one line per PR
git branch --merged origin/main                        # local branches whose own commits reached main
git branch -r --merged origin/main                     # the same, for remote-tracking refs
```

`--merged` misses a branch whose PR merged after a rebase, or whose work landed reworded, so it is
not the list of what to delete: stray local branches are retired with `scripts/git-attic`
(`notes/housekeeping.md`, *Retiring stray branches*).

GitHub deletes head branches automatically on merge. `fetch.prune` is unset in the containers, so
a bare `git fetch` keeps their remote-tracking refs, stale; `git fetch --prune origin` drops them.

## Before discarding anything

Committed work survives almost anything: the reflog, or a tag, brings it back. Uncommitted work
does not. Before a command that throws changes away (`reset --hard`, `restore`, `checkout -- .`,
`clean`, `branch -D`), make everything it would discard reachable first: commit it, stash it, or
put a branch on it. If you can't tell what it would discard, stop and ask. To clear away
branches and worktrees, use `notes/housekeeping.md`, which keeps every branch it retires as a tag.

Anything that touches `main` directly: stop and ask Coach.
