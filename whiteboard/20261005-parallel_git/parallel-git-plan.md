# Parallel workers, one spine -- a proposal

2026-10-05. Status: **proposal, for the Coach**. Nothing here is in force; `notes/git_hygiene.md`
still governs.

## The shape

```
origin/main <- B1 <- B2 <- ... <- Bn          the spine: checked out in the main checkout, at Bn
                                \
                                 <- W         a worker's branch, in its own worktree, unlanded
```

* **The spine** is the single stack of landed branches, `origin/main..Bn`, with the main
  checkout standing on its top. It is what the Coach sees and zippers up. Every branch on it
  passed the full suite when it landed.
* **The spine is common property.** Any agent in the container may restack it, sweep into it,
  and push its branches. A branch still in a worktree is its worker's alone.
* **Workers never touch the main checkout's files.** Each works in its own worktree, cut from
  the spine's top, with its own ports and databases (*Lanes*). The main checkout's tree changes
  in exactly two ways: a **landing** switches it up to the new top, and a **restack** replays
  it onto `origin/main`.
* **Conflicts surface locally, at landing**, when the worker replays its branch onto the
  current top. Nothing on the spine moves until the worker has resolved that and gone green.

## A worker's life

1. **Cut.** Spawned with `isolation: "worktree"` (the harness puts it under
   `.claude/worktrees/`, which tsc and eslint already skip), from the spine's top. It renames its
   branch to `YYYYMMDD-<label>`, claims a lane (`scripts/lane`), and runs `pnpm install`
   (`node_modules` is a Docker volume mounted only on the main checkout).
2. **Build**, committing at milestones as today, and running the tests near its change on its
   own lane.
3. **Review.** A `thread-reviewer` works in the same worktree, as today: `fix:` commits on top.
4. **Land** (`scripts/land`, below). Rebase onto the top, run the full suite, switch the main
   checkout up, push, open the PR ("stacked on #N").
5. **Clean up.** `git worktree remove`, which also frees the lane.

## Landing

One script, `scripts/land`, so the steps that must happen in order are mechanical. Everything
that writes to the spine holds one lock (`mkdir` in the shared git directory, which is atomic):

1. Take the lock. Waiting here is normal.
2. **If `origin/main` has moved past the spine's base, restack first** (below).
3. Note the top's SHA. `git rebase --onto <top> <my base>`. A conflict follows git_hygiene's
   rules as now: repair the straightforward ones (lockfile, `convex/_generated/`, side-by-side
   edits), or `--abort`, release the lock and report. The spine is untouched.
4. The full suite: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e`, on the
   worker's lane. Red means release the lock and report. Because the lock is held, only one
   full e2e run happens at a time in the container, which suits the CPU.
5. Check that the top is still the noted SHA (a Coach's commit could have moved it). If it has
   moved, go back to 3.
6. `git -C <main checkout> switch <my branch>`. Git carries any uncommitted edits in the main
   checkout along, and refuses rather than overwriting a file it would have to change. A refusal
   means release the lock and tell the Coach which file. Never stash it, never commit it.
7. Push the branch, `gh pr create`, release the lock.

The spine's top is never `main` itself: when the spine is empty, the first write to it cuts a
branch first, as the sprint's `_start` branch does today.

## Restacking, after the Coach merges

Merges keep SHAs, so merged branches simply drop off the bottom. What is left needs replaying onto
the new `origin/main` before its PRs can merge (the ruleset wants up-to-date branches). Any agent
that takes the lock and sees `origin/main` ahead of the spine's base does it:

* Note every spine branch's SHA, then, in the main checkout,
  `git rebase --update-refs --autostash origin/main`. `--autostash` keeps the Coach's
  uncommitted edits reachable: a pop that conflicts leaves them in `git stash list`, which gets
  reported, not dropped. Untracked files are never involved.
* Push each rewritten branch with an explicit lease, `--force-with-lease=<branch>:<noted SHA>`.
  That lease can't be defeated by another worker's `git fetch`, which a bare
  `--force-with-lease` can.
* Workers still in worktrees pick the change up at their own landing (step 3).

## The Coach's space

You stay in the main checkout: it is where the spine shows and where `pnpm dev` follows each
landing live.

* **`whiteboard/` and `human/` are yours to drop anything into**: sprint plans, pasted assets,
  screenshots. Any landing or restack **sweeps** what is uncommitted there into a
  `docs: swept from the main checkout` commit on the top before it starts. So a stray file
  gets committed instead of stalling anyone.
* Uncommitted edits elsewhere are treated as yours in progress: carried along by switches,
  autostashed by restacks, never committed by an agent.
* Workers never see the main checkout's dirt at all: their worktrees start from committed
  history. That one fact removes most of today's "uncommitted changes, so stop" stalls.

A worktree of your own would buy little: the spine has to be checked out somewhere, and you want
to be the one watching it.

## Lanes: ports and databases per checkout

Each checkout's `data/convex-<role>/` and `.next-*` directories already live inside it, so a
worktree gets its own databases and builds for free. Only ports are shared across the container.

* **Lane 0 is the main checkout**, with today's ports unchanged. Worktrees claim lanes 1-9.
* **Port = base + 10 x lane + role digit**, with bases 3000 (web), 3400 (Convex) and 3500 (HTTP
  actions), and role digits dev 0, agent 1, e2e 2, e2e-agent 3, agent build 4, e2e-built 5. So
  3413 is lane 1's e2e-agent backend.
* **Claiming**: `scripts/lane` prints the checkout's lane. In a worktree with no lane yet, it
  claims the lowest free one by `mkdir <git common dir>/triquet-lanes/<n>`, writing the worktree's
  root inside. A claim whose worktree is gone is free again.
* **One table** in `scripts/` maps role and lane to ports. A small `scripts/as_role <role> <cmd>`
  exports `PORT`, `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_ROLE` and `TRIQUET_LANE`, so `package.json`
  stops spelling ports out and Doppler's values become lane 0's defaults. `convex_backend`,
  `convex_dev`, `convex_auth_keys` and the e2e guard (`e2e/environment.ts`) read the same table.
  Doppler's service tokens come from the environment, so they work in any directory.

The guidance this would put in CLAUDE.md's *Global resources*, once it is true:

> **Every checkout has a lane.** `scripts/lane` names yours: 0 in the main checkout, 1-9 in a
> worktree, claimed on first ask. Each role's ports are offset by ten per lane, so the same
> `pnpm dev:agent`, `pnpm test:e2e:agent` and `scripts/convex_dev <role>` find your own server,
> backend and data without colliding with another checkout's. Never pass a port or a Convex URL
> by hand; never touch another lane's backend. Lane 0's `dev` role is the Coach's.

## Files everyone writes

* `human/`: done, one file per entry.
* **The sprint's progress document** becomes the orchestrator's alone: a status table and a
  curated summary. Each worker writes its section to `whiteboard/<sprint>/thread-N-<label>.md`
  on its own branch, so it lands with the branch and never conflicts.
* `convex/_generated/` and `pnpm-lock.yaml` keep their existing "regenerate and take it" repairs.

## The sprint, in parallel

* The plan marks each thread's dependencies. The orchestrator runs every thread whose
  dependencies have landed, up to a cap (3 to start, mostly for e2e load), and spawns
  dependents only once their predecessors have landed.
* **Stack order is landing order**, not plan order. You merge by sprint, so this shouldn't
  matter.
* `pre-thread` retires: there is no shared tree to tidy before each thread. Restacking moves into
  landing.
* The orchestrator commits the plan to the spine before spawning anyone, and takes the lock for
  its own document commits.

## Libraries considered

git-town, git-branchless, git-machete, Graphite's `gt`, ghstack and spr all manage stacks and
restack them, which `rebase --update-refs` already does for us. To my knowledge none coordinates
several local worktrees landing onto one shared checkout. Graphite and spr also want merge flows
of their own (squash, merge queue) that fight the semi-linear ladder. This is from memory, not
re-surveyed. So `scripts/land` and `scripts/lane` would be hand-rolled: small, with tests, and
recorded under *Hand-rolled on purpose*. That needs your yes.

## Rollout

Three threads, run by hand rather than as a sprint, since the third changes the sprint machinery:

1. **Lanes**: `scripts/lane`, the port table and `as_role`, the e2e guard and its tests, and
   the guidance above. Useful on its own the moment anyone opens a second worktree.
2. **Landing**: `scripts/land`, restacking, the sweep, the lock. Rewrites git_hygiene's
   *Starting*, *Finishing*, *Force-pushing* and *Stacks* and CLAUDE.md's *Git* section around
   the spine and common ownership.
3. **Parallel sprints**: the sprint skill, the worker and reviewer in worktrees, per-thread
   progress files, `pre-thread` retired.

## For the Coach

1. **Hand-rolling** `scripts/land` and `scripts/lane`: yes?
2. **Sweep scope**: only `whiteboard/` and `human/`, or every untracked file in the main
   checkout? (Wider means fewer surprises, at the risk of a stray `.ts` file failing lint.)
3. **The lock held through the full suite** serializes landings, a few minutes each. Fine, or
   should landing be optimistic (suite outside the lock, re-run if the top moved)?
4. **Where worktrees live**: `.claude/worktrees/` is on the Mac-shared mount (visible in VS
   Code, slower installs) and a container-local path is the reverse. Thread 1 will time both.
5. **Your code edits in the main checkout** while workers run: carried along (the proposal's
   default), or kept to a worktree of your own?
6. Still open from the earlier chat: commit-and-push authority, and look-before-overwrite.
   This proposal's answer is "the spine is common property, unlanded branches are private".
