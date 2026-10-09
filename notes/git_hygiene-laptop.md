# Git hygiene on the laptop

How a thread runs in the laptop's container, where many agents share one repository beside the
Coach. What holds everywhere (history, commits, conflicts, what goes in a PR, merging) is
`notes/git_hygiene.md`; read it too. A cloud session follows `notes/git_hygiene-cloud.md` instead
of this file.

- **The spine** is the one stack of landed branches, checked out in the main checkout at its top: what the Coach watches and merges. It is shared; a branch not yet landed is its agent's alone. See *The spine*.
- **Agents write only in worktrees of their own**, cut from the spine's top with `pnpm worktree <label>`. The main checkout is the Coach's: read it freely, never write to it except by landing.
- A line of work is a thread: a worktree, commits at milestones, a proof (`pnpm catchup`, `pnpm justify`, `pnpm e2e`), a bid (`pnpm land`), a PR, `pnpm worktree --remove`. See *A thread, start to finish*.
- An ordered series of threads issued at once and run by agents is a sprint. See *Sprints*.

Inside your own worktree, use git however it helps: checkpoint commits, scratch branches, replays
to unwind a hairy change. Tidy the result before you land it.

## The spine

```
origin/main <- B1 <- B2 <- ... <- Bn          the spine: checked out in the main checkout, at Bn
                                \
                                 <- W         a thread's branch, in its own worktree, not yet landed
```

* **The spine** is `origin/main..Bn`: every landed branch, stacked in the order they landed, with
  the main checkout standing on the top. Each branch on it passed typecheck, lint, the unit tests
  and e2e on a recent top, and the unit tests on exactly what lies beneath it (*Finishing*).
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
  replays it onto `origin/main`. Either move that brings another `pnpm-lock.yaml` installs its
  packages there (`pnpm install --frozen-lockfile --prefer-offline`), under the hold: `node_modules`
  is derived from the lockfile, so the install is the same write as the move that called for it.
  A catch-up or a bid that rebases a worktree onto another lockfile installs there too. Only a
  change to the lockfile installs. `scripts/spine.ts` reaches a package only to take the e2e lock,
  so its other commands run even in a checkout whose packages lag its lockfile.
* **The Coach's notes come along.** Whatever is uncommitted in the main checkout's `whiteboard/`,
  `human/` and `notes/` is swept onto the top by the next cut, landing or `pnpm sweep`, as
  `docs: swept from the main checkout`. A stray file there gets committed rather than stalling
  anyone. The Coach's other uncommitted edits are theirs: carried along when the main checkout
  switches, autostashed when it is replayed, never committed by an agent.
* **One at a time.** Sweeping, replaying, catching up and cutting each hold the spine for the
  seconds they take (a lock in the repository's shared git directory). A bid holds it for its
  typecheck and unit tests as well, and no other suite ever runs under the hold.

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
prints the worktree's root: work from there, beginning every shell command with `cd <root> && `
(the shell goes back to the main checkout between commands), and build every absolute path from
it (CLAUDE.md, *Global resources*). A worktree starts from committed history, so nothing anyone left lying in
another checkout is in your way.

### Milestones

Commit when the work reaches a place you could hand over: a set of related changes, with the app
working again (typecheck, lint, and the tests near your change pass). A milestone is a return to
working order, not a count of edits. What you push shouldn't stop mid-refactor (local checkpoints
are fine, folded in before pushing), and unrelated changes are better in separate commits. A large `convex/_generated/` regeneration goes in a commit of its own. For the
occasional deliberate commit with failing tests, see `notes/git_hygiene.md`, *Commits*.

### Finishing: prove, then bid

Prove the branch before it bids to land, and keep the bid cheap. What makes landing slow is not
waiting but rerunning: every branch that lands while you run the expensive suites (a **snipe**)
moves the top you proved against. So the expensive work happens before the bid and at your own
pace, and the bid itself runs only typecheck and the unit tests, holding the spine so nothing can
snipe it.

```
A  build     the unit tests at will, until you are satisfied
B  prove     pnpm catchup -> pnpm justify -> pnpm e2e -> repair each failure alone, until green
C  refresh   the top moved since B? pnpm catchup -> pnpm justify -> repair (e2e only by judgement)
D  bid       pnpm land
E  PR        gh pr create
```

* **A. Build.** Commit at milestones; run the tests near your change as often as you like.
* **B. Prove.** `pnpm catchup` rebases the branch onto the current top, holding the spine only
  for the seconds its replay and sweep take, and installs your packages if the top brought another
  lockfile. `pnpm justify` runs typecheck, lint and the unit tests side by side, each prefixed by
  its name and each run to its end, so one run shows every failure (lint keeps a cache, `.eslintcache`: if CI's lint disagrees with yours, `rm
  .eslintcache` and justify again); green over committed work, it records the branch's patch-id. Then `pnpm e2e`, the full
  suite on your lane, or `pnpm e2e --touched`, the corner of it your branch reaches (*Running only the
  corner*, below); either may first wait its turn for the container's e2e lock, and catch up
  after (*One full run at a time*, below). Repair each failure on its own: `pnpm e2e:rerun` reruns what the last run
  failed, one worker at a time (`--last-failed --workers=1`), and `pnpm e2e <spec file>...` runs
  the specs you choose. A spec that failed in the full run and passes alone with the code
  unchanged is a **flake**: it does not block, and it is always reported, in the PR's
  **Tests:** line. B ends when every spec of the full or touched run has passed, there or alone;
  `pnpm e2e` says "Proved" and records it. Commit before each run: a run over uncommitted changes is
  logged, but counts toward nothing.
* **C. Refresh.** If anything landed since B, `pnpm catchup` and `pnpm justify` again, and
  repair. What needs defending is only how your branch meets what landed: everything beneath it
  already passed justify and e2e with its own work. Rerun e2e only where the newcomer touched
  the same corner.
* **D. Bid.** `pnpm land` refuses a branch not justified at its present patch-id (any change
  since needs `pnpm justify` again; a rebase that carries your changes across unaltered does not),
  or with no e2e proof, unless every path it changes is a document or a note (a `.md` outside
  `src/`, or anything under `whiteboard/` or `human/`), or the bid says why e2e has nothing to tell
  it (`pnpm land --skip-e2e "<why>"`: *When e2e is not worth running*, below). A proof from
  `pnpm e2e --touched` is scoped to the spec files it ran: the bid takes it while every path the
  branch changes still reaches inside them, and refuses, naming the path, once one reaches further.
  Then, holding the spine throughout: it
  replays the spine onto `origin/main` if origin has moved, sweeps, rebases your branch onto the
  top if the top has moved and then reads its e2e proof afresh with the scripts as the rebase left
  them (`node scripts/spine.ts proof`), so that a spec file the top gained in a corner you proved,
  or a change to the map, is required of you too, runs typecheck beside the unit tests (`pnpm test:bid`, each test
  allowed a minute: the machine may be loaded), and switches the main checkout onto your branch.
  Released, it pushes, and names your flakes for the PR. A conflict or a red test releases the
  hold and stops with the spine untouched: repair, commit, `pnpm justify`, and bid again. Bids
  queue for the hold, so the wait is about the tests' time for each bid ahead of yours.
* **E. PR.** *Filing the PR*, below.

### Running only the corner

A full e2e run is about three minutes of one worktree, and it loads the machine: several at once
time out specs that no branch touched, and the flakes land on everyone else's runs, a stampede.
So there are three ways to prove a branch: the whole suite, the corner of it the branch reaches,
or none (*When e2e is not worth running*, below).

`pnpm e2e --touched` runs the corner. `SpecCorners`, beside `UnwatchedRules` in `scripts/spine.ts`,
maps each area of the tree to the spec files that would notice a change there, read from the specs
and checked against the imports; a component used in two corners names the spec files of both.
`--touched` takes the paths the branch changes since its base, prints the corner each one chose,
and runs their union. Read that list before the suite gets far: if a path fell into a corner you
think too small, stop it, run the whole suite, and mend the map on your branch.

* **A path the map does not name reaches the whole suite**, and then `--touched` runs it all, as a
  full run: everything under `convex/` and `src/models/`, `src/lib/rows.ts`, `e2e/support.ts`, the
  configuration and the dependencies, the scripts the suite runs through, the few files every
  screen leans on (`use-draft`, `use-session`, the text fields, the quiz history mirror), and
  anything new. A spec file reaches itself.
* **A path e2e cannot notice reaches nothing**: a document, a unit test, the paths listed below. A
  branch of nothing else runs no spec, and `--touched` says how to land without one.
* **The proof is scoped** to the spec files the run ran. Repair its failures alone, as after a full
  run. The bid takes it while every path the branch changes still reaches inside that scope; a
  path committed since that reaches further refuses the bid, naming the path, as no proof would.
  Run `pnpm e2e --touched` again (or the whole suite), then bid.
* **A spec file the map names but the tree lacks is skipped**, and a corner with none of its spec
  files there yet reaches the whole suite.
* **A new spec file goes in the map**, in the corner it covers (a unit test of the map fails until
  it does), and a new component once you know which specs drive it. Until then it reaches the whole
  suite, which costs time, never coverage.

**The smoke tier** is no proof at all. One test of each spec file is tagged `@smoke`
(`notes/testing.md`), and `pnpm e2e:smoke` runs those alone: two dozen tests, in about half a
minute on a quiet machine. It is a quick signal that nothing is plainly broken, worth having before a full run when the
map says the whole suite. It is logged as a run of chosen specs, and proves nothing.

**CI is the strict gate.** Whichever you chose (the whole suite, the corner, or a skip), CI runs
justify, a production build and the whole e2e suite on every push. The local choice decides how
soon you find out, never whether.

### One full run at a time

Two full runs on one machine time each other's specs out, so a full or touched `pnpm e2e` first
takes the container's **e2e lock**, `.e2e-lock` beside the e2e log under `$TQ_WORKTREES`. Reruns,
chosen specs and the smoke tier go by without it, and CI takes none.

* **A run that finds the lock held waits**, saying whose run holds it (lane, branch, checkout,
  process) and since when, and what it will do once it has the lock. Leave it waiting; a wait of
  an hour gives up, naming the holder.
* **Having waited, it catches up first** (`pnpm catchup`), since the holder has very likely just
  landed and moved the top, and only then chooses a touched run's corner and runs the suite. A
  catch-up that conflicts frees the lock and stops, with the rebase left for you, as `pnpm catchup`
  does. A run that caught up says so: justify again before you bid (C). The main checkout, and a
  worktree holding uncommitted changes, are not caught up.
* **The lock goes with its process.** `proper-lockfile` frees it however the run ends, and a lock
  whose run was killed outright goes stale within thirty seconds and is taken over.
* **The log keeps the wait** (`waited_s`), and `pnpm e2e:log` says how often runs waited and for
  how long.

It is one lock per container, not per machine: runs in two containers still overlap.

### When e2e is not worth running

The judgment is `notes/git_hygiene.md`, *When e2e is not worth running*. When a skip tempts you
over app code, run the corner instead (`pnpm e2e --touched`); where the shared file says never to
skip, run the whole suite or at least the corner. To skip, bid with the
sentence: `pnpm land --skip-e2e "unit tests of the session script only"`.
It still needs a justify at the branch's present patch-id. A proof the branch already has stands
over the reason. When it refuses for want of a proof it says whether e2e could notice any path the
branch changes (`e2eWatched` in `scripts/spine.ts`), and a skip over such paths lands with a
warning, since the call is yours. Put the reason in the PR's **Tests:** line (`e2e skipped:
<why>`), where the Coach looks when CI is red.

### Around the bid

In a sprint, review comes between A and B (*Sprints*): B covers the reviewer's fixes, and the
window from your first catch-up to your bid stays short, which is what keeps snipes few.

Several e2e suites at once load the machine, and specs time out (Convex "Function execution
timed out") that your branch never touches. Don't wait for the load to fall: rerun those specs
alone, at once, and report them as flakes. Every run of `pnpm e2e` writes a line to the e2e log
(`$TQ_WORKTREES/.e2e-log.jsonl`): the load, the build cache's state, and what failed and what
cleared. `pnpm e2e:log` summarises it, red runs and flakes by load and by build cache. A new
worktree's e2e build cache is copied from the main checkout's at `pnpm worktree`; the log says
whether that pays.

If the main checkout won't switch, because a file your branch changes holds the Coach's
uncommitted edit, the bid stops with nothing changed and names the file. Tell the Coach;
never stash, commit or overwrite their edit.

A rebase conflict at a catch-up or a bid: resolve it as `notes/git_hygiene.md`, *Rebase
conflicts*, says, then `pnpm justify` again before you bid.

Whose branches may be pushed: a spine branch by anyone (the scripts do it); an unlanded branch
only by its own agent. A bare `--force-with-lease` protects nothing here, where every worktree's
fetch moves the shared remote-tracking refs, and `--force-if-includes` is no better, since the
reflogs are shared too. Never write in the main checkout: everything uncommitted there is the
Coach's.

### Filing the PR

`pnpm land` has pushed the branch. Run `gh pr create --base main`, from your worktree, with the
title and body `notes/git_hygiene.md`, *Filing the PR*, describes.

`git fetch` over HTTPS works without credentials, and `gh` uses its own login. `git push` needs
credentials, and in the container the configured helper (`gcm-core`) is missing. The spine's
scripts borrow gh's login for each push; to push by hand, do the same, without changing any
config:

```
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push
```

### Adding to a PR already filed

More commits for a PR whose branch has landed: cut a worktree as for any thread
(`pnpm worktree <label>`), commit, prove as usual, and bid with `pnpm land --into <branch>`. The
bid folds your commits into that branch rather than stacking one of your own: it fast-forwards,
is pushed, and its PR carries them. Your working branch is deleted. Add what they bring to the
PR's description, then remove the worktree.

Only the top of the spine takes this: a branch with others landed above it would need them all
replayed and pushed again, so the bid refuses, and the commits land as a PR of their own, stacked
on the top, unless the Coach says otherwise.

### Cleaning up

Once the PR is filed: `pnpm worktree --remove`, from the worktree. It refuses while anything is
uncommitted there, and frees the lane. The branch lives on in the spine. Only uncommitted work
dies with a worktree, or with the container: commits are in the shared repository from the
moment they are made.

Branches, worktrees and lanes that other threads left behind are housekeeping, not part of a
thread: `notes/housekeeping.md`.


## Sprints

A **sprint** is an ordered series of threads issued at once and run without the Coach at the
wheel. The Coach hands the `/sprint` orchestrator the thread list; it writes a plan to
`whiteboard/YYYYMMDD-<sprint>/<sprint>-plan.md`, then runs the threads, each in a worktree of its
own: a fresh `thread-worker` agent builds it and a `thread-reviewer` agent then reviews its
commits, with `/code-review` (which runs in the main checkout, so never with `--fix`, and told to change
nothing there) or by hand,
making the fixes it can stand behind in the worktree as `fix:` commits; then the worker proves
it and bids (*Finishing*, B to E). Threads land on the spine in the order they finish, none
merged until the Coach returns.
The orchestrator's procedure is `.claude/skills/sprint/SKILL.md`; the agents' are
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

A branch merged under new SHAs (its PR rebased on GitHub first) is emptied by the replay rather
than dropped, and is not pushed: its PR has merged. Once the whole spine has merged (the main
checkout stands on `origin/main`, on a spine branch origin has deleted), the main checkout goes
back to `main`, fast-forwarded, and the next landing starts the spine afresh. A branch the Coach
cut there by hand is theirs, and stays.

Your own unlanded branch picks up the change at its next `pnpm catchup`, or at its bid.

If you did merge main into your branch by accident, `git rebase origin/main` fixes it. A plain
rebase drops the merge commit and replays only the branch's own commits.


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
