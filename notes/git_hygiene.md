# Git hygiene

History on main is semi-linear: each PR branch is rebased onto current main and lands as a merge commit. Procedures and reasoning follow the summary below.

- **The spine** is the one stack of landed branches, checked out in the main checkout at its top: what the Coach watches and merges. It is shared; a branch not yet landed is its agent's alone. See *The spine*.
- **Agents write only in worktrees of their own**, cut from the spine's top with `pnpm worktree <label>`. The main checkout is the Coach's: read it freely, never write to it except by landing.
- A line of work is a thread: a worktree, commits at milestones, `pnpm land`, a PR, `pnpm worktree --remove`. See *A thread, start to finish*.
- Don't merge main into a branch, and never use GitHub's "Update branch" in merge mode. A pushed branch contains no merge commits; the `semi-linear` CI check rejects them.
- Force-push only with an explicit lease: `--force-with-lease=<branch>:<the commit you expect origin to hold>`. Never plain `--force`. The spine's scripts do this for you.
- Open PRs against `main`, even when stacked; write "stacked on #N" in the description.
- Never merge a PR or enable auto-merge. Coach merges.
- Every commit lands in main individually: each should pass tests, and messages follow the existing log style.
- An ordered series of threads issued at once and run by agents is a sprint. See *Sprints*.

Inside your own worktree, use git however it helps: checkpoint commits, scratch branches, replays
to unwind a hairy change. Tidy the result before you land it.


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

## The spine

```
origin/main <- B1 <- B2 <- ... <- Bn          the spine: checked out in the main checkout, at Bn
                                \
                                 <- W         a thread's branch, in its own worktree, not yet landed
```

* **The spine** is `origin/main..Bn`: every landed branch, stacked in the order they landed, with
  the main checkout standing on the top. Each branch on it passed typecheck, lint, the unit tests
  and e2e on top of exactly what lies beneath it.
* **The spine is shared; an unlanded branch is private.** Any agent may sweep onto the spine,
  replay it onto `origin/main`, and push its branches. A branch still in a worktree is its
  agent's alone. Anything on the spine is ready to push and PR: a push carries along commits from
  branches beneath that the pusher may know nothing about, which is fine, since they are green and
  straight to main. Once the Coach merges, each PR holds only its own thread's commits again.
* **Agents write only in worktrees.** That goes for a session working beside the Coach as much
  as a sprint's workers. Each worktree has a lane of its own: ports, Convex backends and data
  (CLAUDE.md, *Global resources*). The main checkout is the Coach's, and agents read it freely
  (the Coach's uncommitted edits there are often the best context going) but never write to it.
  Its files change in exactly two ways: a landing switches it up to a new top, and a restack
  replays it onto `origin/main`.
* **The Coach's notes come along.** Whatever is uncommitted in the main checkout's `whiteboard/`,
  `human/` and `notes/` is swept onto the top by the next cut, landing or `pnpm sweep`, as
  `docs: swept from the main checkout`. A stray file there gets committed rather than stalling
  anyone. The Coach's other uncommitted edits are theirs: carried along when the main checkout
  switches, autostashed when it is replayed, never committed by an agent.
* **One at a time.** Sweeping, replaying and folding in each hold the spine for the seconds they
  take (a lock in the repository's shared git directory); tests never run under the hold.

`scripts/spine.ts` does all of this. `pnpm restack` replays the spine onto `origin/main` by hand
(cuts and landings do it whenever origin has moved), and `pnpm sweep` sweeps without landing.


## A thread, start to finish

A thread is one line of work: one branch, one PR, one worktree, and a session may hold several.
You may commit, land and push the thread's branch, and open its PR, without asking first.

### Starting

```
pnpm worktree <branchlabel>
```

Run it from any checkout of the repository. It holds the spine, replays it onto `origin/main` if
origin has moved, sweeps the Coach's notes, cuts `YYYYMMDD-<branchlabel>` from the top into
`~/worktrees/triquet/<branchlabel>`, claims the worktree a lane, and installs its packages. It
prints the worktree's root: work from there, and build every absolute path from it (CLAUDE.md,
*Global resources*). A worktree starts from committed history, so nothing anyone left lying in
another checkout is in your way.

### Milestones

Commit when the work reaches a place you could hand over: a set of related changes, with the app
working again (typecheck, lint, and the tests near your change pass). A milestone is a return to
working order, not a count of edits. What you push shouldn't stop mid-refactor (local checkpoints
are fine, folded in before pushing), and unrelated changes are better in separate commits. A large `convex/_generated/` regeneration goes in a commit of its own. For the
occasional deliberate commit with failing tests, see *Commits*.

### Finishing: landing

```
pnpm land
```

Run it in your worktree, with everything committed. It lands your branch on the spine:

1. Holding the spine: replay it onto `origin/main` if origin has moved, and sweep.
2. Rebase your branch onto the top. On a conflict it stops, the rebase in progress and the spine
   untouched (below).
3. `pnpm typecheck && pnpm lint && pnpm test`. Red stops it.
4. If the top moved meanwhile (someone else landed), back to 2.
5. `pnpm test:e2e`, on your lane. Red stops it.
6. Holding the spine: if the top moved, back to 2. Otherwise switch the main checkout onto your
   branch and push it.

From there CI is the next test. Five trips back to 2 and it gives up: land again shortly.

If the main checkout won't switch, because a file your branch changes holds the Coach's
uncommitted edit, the landing stops with nothing changed and names the file. Tell the Coach;
never stash, commit or overwrite their edit.

A rebase conflict: fix the straightforward ones yourself, `git rebase --continue`, and land
again.

- `pnpm-lock.yaml`: take the top's version, then run `pnpm install`.
- `convex/_generated/`: push to your backend again (`scripts/convex_dev agent`) and take what it writes.
- Edits that sit side by side without contradicting each other.
- Merges in docs or import lists.
- Tests that the spine broke in plainly mechanical ways, such as a rename.

Stop and ask for anything that takes judgment:

- Both sides changed the same logic, or the schema.
- The spine changed something the thread depends on.
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

`pnpm land` has pushed the branch. Run `gh pr create --base main`, from your worktree.

- **Title**: plain language, saying what changed.
- **Body**: follow recent PRs (#35 is a good model):
  - What changed, in short paragraphs or bullets with **bold lead-ins**.
  - A **Tests:** line naming the suites run and their counts.
  - "Stacked on #N", naming the PR of the branch you landed on (the landing says which), or "Follows #N".
  - An *Open questions* list when minor questions remain. Put them in chat too, and in
    an entry under `human/` or the thread's `/whiteboard` directory where CLAUDE.md asks for that.
    A PR description is easy to miss.

A *significant* question is one whose answer would change the code in the PR. Ask those in chat
before filing, rather than filing and hoping.

`git fetch` over HTTPS works without credentials, and `gh` uses its own login. `git push` needs
credentials, and in the container the configured helper (`gcm-core`) is missing. The spine's
scripts borrow gh's login for each push; to push by hand, do the same, without changing any
config:

```
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push
```

### Cleaning up

Once the PR is filed: `pnpm worktree --remove`, from the worktree. It refuses while anything is
uncommitted there, and frees the lane. The branch lives on in the spine. Only uncommitted work
dies with a worktree, or with the container: commits are in the shared repository from the
moment they are made.


## Sprints

A **sprint** is an ordered series of threads issued at once and run without the Coach at the
wheel. The Coach hands the `/sprint` orchestrator the thread list; it writes a plan to
`whiteboard/YYYYMMDD-<sprint>/<sprint>-plan.md`, then runs the threads, each in a worktree of its
own: a fresh `thread-worker` agent builds it and a `thread-reviewer` agent then runs
`/code-review` over its commits, keeping the fixes it can stand behind as `fix:` commits; then the
worker lands it. Threads land on the spine in the order they finish, none merged until the Coach
returns. The orchestrator's procedure is `.claude/skills/sprint/SKILL.md`; the agents' are
`.claude/agents/thread-worker.md` and `.claude/agents/thread-reviewer.md`. Everything in this
document binds a sprint's agents as it binds any other: a sprint changes who is watching, not
what is allowed.


## Catching up with main

Nothing to do by hand: every cut and landing replays the spine onto `origin/main` when origin has
moved, as it does once the Coach merges, and `pnpm restack` does it on demand. Merged branches drop
off the bottom (merge commits keep their SHAs), what is left is replayed with
`git rebase --update-refs --autostash origin/main`, and every spine branch origin has is pushed
with an explicit lease, so its PR stays current and merging the top of a sprint marks every PR
beneath it merged. A replay that conflicts is undone and stops: that is the Coach's call.

Your own unlanded branch picks up the change at its landing's rebase.

If you did merge main into your branch by accident, `git rebase origin/main` fixes it. A plain
rebase drops the merge commit and replays only the branch's own commits.


## Force-pushing

- Always with an explicit lease, `--force-with-lease=<branch>:<sha>`, naming the commit you expect
  origin to hold. A bare `--force-with-lease` checks against the remote-tracking ref, which any
  other checkout's `git fetch` moves: in a repository many worktrees share, it protects nothing.
  `--force-if-includes` is no better here, since the reflogs are shared too. Never plain `--force`.
- A spine branch may be pushed by anyone (*The spine*); the scripts do it. An unlanded branch is
  pushed only by its own agent.


## Stacks

A stack is a branch built on another unmerged branch. The spine is this repository's one stack,
and the scripts keep it straight. By hand:

- Open every PR in a stack against `main`. Upper PRs will show the lower PRs' commits in their diff until those lower PRs land, and that's fine.
- Rebase a stack only from the **top**, with `--update-refs`, so every branch pointer inside it
  moves with its commits. Rebasing a lower branch alone strands the ones above it on the old
  commits, and a later rebase of the top replays those stale copies: a cactus. Never rebase the
  spine by hand while anyone else might be landing: `pnpm restack` holds it first.
- A branch checked out in another worktree is skipped by `--update-refs` and stays where it was.

Two ways to land a stack:

1. **As a unit (preferred when it's ready together).** Merge only the top PR. GitHub sees the lower PRs' head commits in `main` with unchanged SHAs and marks those PRs merged automatically. You get one bubble containing all of the stack's commits.
2. **One PR at a time.** Merge the bottom PR, then `pnpm restack`, which moves the rest onto the new tip and pushes them; merge the next. Repeat. You get one bubble per PR, at the cost of a restack per merge.


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

Never in the main checkout: everything uncommitted there is the Coach's.
