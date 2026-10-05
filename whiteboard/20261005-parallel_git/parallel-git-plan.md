# Parallel workers, one spine

2026-10-05. Status: **built**: #103 (lanes), #104 (the spine and its docs), and the parallel
sprint, stacked in that order. `notes/git_hygiene.md` is now the reference; this plan is the
record of how it was decided.

## The shape

```
origin/main <- B1 <- B2 <- ... <- Bn          the spine: checked out in the main checkout, at Bn
                                \
                                 <- W         a worker's branch, in its own worktree, unlanded
```

* **The spine** is the single stack of landed branches, `origin/main..Bn`, with the main
  checkout standing on its top. It is what the Coach sees and zippers up. Every branch on it
  passed typecheck, lint, the unit tests and e2e on top of exactly what lies beneath it.
* **The spine is shared; unlanded branches are private.** Any agent in the container may sweep
  into the spine, restack it, and push its branches. A branch still in a worktree is its
  worker's alone. Anything on the spine is ready to push and PR. A push carries along commits
  from branches beneath that the pusher knows nothing about, which is fine: they are green and
  straight to main, and once the Coach merges, each PR's commits are its thread's again.
* **Agents write code only in worktrees of their own.** That includes a top-level session working
  with the Coach, not only a sprint's workers. Each worktree is cut from the spine's top and has
  its own ports and databases (*Lanes*). The main checkout is the Coach's, and agents may *read*
  it freely: the Coach's uncommitted edits there are often the best context going. Its files
  change in exactly two ways: a **landing** switches it up to a new top, and a **restack** replays
  it onto `origin/main`.
* **Conflicts surface locally, at landing**, when the worker replays its branch onto the
  current top. Nothing on the spine moves until the worker has resolved that and gone green.

## A worker's life

1. **Cut.** `scripts/worktree <label>` makes `YYYYMMDD-<label>` from the spine's top in a
   container-local directory (`~/worktrees/triquet/<label>`, outside the Mac-shared mount),
   records the top it was cut from, claims a lane, and runs `pnpm install` (`node_modules` is a
   Docker volume mounted only on the main checkout). The agent works from the root it prints.
2. **Build**, committing at milestones as today, with the tests near the change run on its own
   lane.
3. **Review.** A `thread-reviewer` works in the same worktree: `fix:` commits on top.
4. **Land** (`scripts/land`, below), then file the PR ("stacked on #N").
5. **Clean up.** `scripts/worktree --remove`, which frees the lane. Commits are safe in the
   shared repository from the moment they are made; only uncommitted work dies with a worktree,
   or with the container.

## Landing

`scripts/land`, so the order is mechanical:

1. **Sweep** (under the lock, below): anything uncommitted in the main checkout under
   `whiteboard/`, `human/` or `notes/` is committed onto the top as
   `docs: swept from the main checkout`.
2. **Restack** (under the lock) if `origin/main` has moved past the spine's base (*Restacking*).
3. **Rebase** the worker's branch onto the top: `git rebase --onto <top> <the top it last stood
   on>`. A conflict follows git_hygiene's rules as now: repair the straightforward ones (lockfile,
   `convex/_generated/`, side-by-side edits), or stop and report. The spine is untouched.
4. **Typecheck, lint, unit tests.** Red: stop and report.
5. **Has the top moved?** Yes: back to 3.
6. **e2e**, on the worker's lane. Red: stop and report.
7. **Fold in**, under the lock: if the top has moved, release and go back to 3. Otherwise detach
   the worktree (a branch can be checked out in only one place), `git -C <main checkout> switch
   <branch>`, and push. Git carries the Coach's uncommitted edits along in the switch, and refuses
   rather than overwrite a file it would have to change. A refusal re-attaches the worktree and
   reports which file. Never stash it, never commit it.

From there CI is the next test. The **lock** is a `mkdir` in the shared git directory, held for
seconds (a sweep, a restack, a fold), never across a test run. A lock whose holder process is gone
is taken over. Five trips back to 3 without folding in means stop and report: the spine is too
busy to land on.

The spine's top is never `main` itself. When the main checkout stands on `main` and there is
something to sweep, the sweep cuts a branch for it first.

## Restacking, after the Coach merges

Merges keep SHAs, so merged branches drop off the bottom. What is left needs replaying onto the
new `origin/main` before its PRs can merge (the ruleset wants up-to-date branches). Any landing
that sees `origin/main` ahead of the spine's base does it, under the lock:

* Note each spine branch's SHA, then, in the main checkout,
  `git rebase --update-refs --autostash origin/main`. `--autostash` keeps the Coach's
  uncommitted edits: a pop that conflicts leaves them in `git stash list`, which gets
  reported, never dropped. A conflict in the replay itself is aborted and reported. Untracked
  files are never involved.
* Push every spine branch that origin has, each with an explicit lease,
  `--force-with-lease=<branch>:<noted SHA>`. That lease can't be defeated by another worker's
  `git fetch`, which a bare `--force-with-lease` can. Pushing the lower branches too keeps their
  PRs' heads current, so merging the top of a sprint marks them all merged.
* Workers still in worktrees pick the change up at their own landing's rebase.

## The Coach's space

You stay in the main checkout and edit there freely: it is where the spine shows, where
`pnpm dev` follows each landing live, and what workers read for context.

* **`whiteboard/`, `human/` and `notes/` come along**: sprint plans, pasted assets, screenshots,
  note edits. The next sweep commits them, so a stray file gets committed instead of stalling
  anyone. More directories can join the list.
* Uncommitted edits elsewhere are yours in progress: carried along by switches, autostashed by
  restacks, never committed by an agent.
* Workers never trip over your files: their worktrees start from committed history.

## Lanes: ports and databases per checkout

Each checkout's `data/convex-<role>/` and `.next-*` directories already live inside it, so a
worktree gets its own databases and builds for free. Only ports are shared across the container.

* **Lane 0 is the main checkout**, with today's ports unchanged. Worktrees claim lanes 1-9.
* **Port = base + 10 x lane + role digit**, with bases 3000 (web), 3400 (Convex) and 3500 (HTTP
  actions), and role digits dev 0, agent 1, e2e 2, e2e-agent 3, agent-built 4 (a web port only;
  it uses the agent backend), e2e-built 5. So 3413 is lane 1's e2e-agent backend.
* **Claiming**: a checkout's lane is claimed the first time anything asks for it, by `mkdir
  <git common dir>/triquet-lanes/<n>` holding the worktree's root. A claim whose worktree is gone
  is free again.
* **One table**, `scripts/lanes.ts`, maps role and lane to ports. The shell scripts, the e2e
  guard and `scripts/as_role <role> <command>` (which exports `PORT`, `NEXT_PUBLIC_CONVEX_URL`,
  `CONVEX_ROLE` and `TRIQUET_LANE`) all read it, so `package.json` stops spelling ports out and
  Doppler's values become lane 0's defaults.

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
* **Stack order is landing order**, not plan order.
* `pre-thread` retires: `scripts/worktree` cuts the ground, and landing restacks.
* The orchestrator writes its documents in the main checkout, under `whiteboard/`, so every
  sweep carries them. Before spawning a wave it lands nothing itself, but runs the sweep
  (`scripts/land --sweep-only`), so the new worktrees start with the plan.

## Decisions

* Hand-rolling `scripts/lanes.ts`, `scripts/worktree` and `scripts/land`: **yes** (the Coach,
  2026-10-05). No stack tool coordinates several worktrees landing onto one shared checkout.
* Sweep: `whiteboard/`, `human/`, `notes/`.
* Landing is optimistic, with the cheap checks before e2e and a lock only around the fold.
* Worktrees live in the container only.
* The Coach edits in the main checkout; agents read it, and never write it except by landing.
* Risky guidance goes: no folding someone else's uncommitted work into a commit, no branching
  over a dirty tree, no `checkout --` over files. A worktree is clean by construction.

## Rollout

Stacked on #101, each a thread of its own:

1. **Lanes**: `scripts/lanes.ts`, `scripts/as_role`, the shell scripts and `package.json`, the
   e2e guard and its tests, the guidance in CLAUDE.md.
2. **Worktrees and landing**: `scripts/worktree`, `scripts/land`; git_hygiene's thread procedure
   and CLAUDE.md's *Git* section rewritten around the spine.
3. **Parallel sprints**: the sprint skill, the worker and reviewer in worktrees, per-thread
   progress files, `pre-thread` retired and `/git-prep` cutting a worktree.
