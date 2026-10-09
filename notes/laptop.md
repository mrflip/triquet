# Working in the laptop's container

Loaded at the start of every session in the laptop's container (`$TQ_IS_SANDBOXED` is `true`,
and `$CLAUDE_CODE_REMOTE` is not): `.claude/hooks/session-start.sh` prints it. If you are reading
it without that, you are on the laptop and it binds you all the same. A cloud session reads
`notes/cloud.md` instead. `notes/sandbox_setup.md` has how the container itself is built.

## Global resources

**Use `pnpm dev:agent`** and similar: `pnpm build:agent` (served by `pnpm start:agent`),
`pnpm test:e2e:agent`. Each role has a web port, a local Convex backend of its own
(`scripts/convex_backend <role>`, HTTP actions beside it) and its data and the CLI's `cli.env` in
`data/convex-<role>/`. `scripts/convex_dev <role>` starts the backend when it is not running,
pushes `convex/` to it and runs a command beside it; `scripts/convex_reset <role>` empties one.

**Every checkout has a lane** (`pnpm lane`): 0 in the main checkout, on the ports the project
has always used (agent 3001 and 3401, e2e-agent 3003 and 3403), and 1-9 in a worktree, claimed the
first time anything asks. Each role's ports move up ten per lane (`scripts/lanes.ts`), so the
same commands in a worktree find that worktree's own servers and backends, and its data lives
inside it. Never pass a port or a Convex URL by hand; never touch another lane's backend. In the
main checkout, the `dev` and `e2e` roles are the Coach's. If you meet another shared resource --
a port, a cache or output directory, a database -- give yourself a parallel one the same way,
and add its script to `package.json`.

**Your checkout's root is `git rev-parse --show-toplevel`**, which in a worktree is not
`/workspace/triquet`. Every path in this repo's documents and in a handoff is relative to that
root. When a tool wants an absolute path, build it from your own root, never from a path you
saw elsewhere: an absolute path into another checkout edits that checkout, not yours. Reading
the main checkout for context is fine; writing to it is not. Hand paths on the same way,
relative to the root, or prefixed with the root you mean, spelled out. **The shell does not keep
a worktree as its directory between commands**: it goes back to the main checkout. Begin every
command in a worktree with `cd <root> && `, or name the checkout outright (`git -C <root>`); a
bare `git commit` or `pnpm` would act on the main checkout instead.

## A thread, on the laptop

`notes/git_hygiene-laptop.md` has each step in full, and `notes/git_hygiene.md` what holds
everywhere. Read them before any complicated operation (eg a rebase that touches more than one
branch) or anything that deletes a ref or a worktree.

Work goes in **threads**: one line of work, one branch, one PR, one worktree. (A session may involve several threads.) An ordered series of threads issued at once is a **sprint**, run by the `/sprint` orchestrator through `thread-worker` agents: `notes/git_hygiene-laptop.md`, *Sprints*. Within a thread you have standing permission to commit, land, push its branch, and open its PR without asking.

**The spine** is the one stack of landed branches, checked out in the main checkout at its top: what the Coach watches and merges. It is shared, and any agent may sweep it, replay it onto `origin/main` and push its branches; a branch not yet landed is its own agent's. **Agents write only in worktrees of their own**: the main checkout is the Coach's, to read freely and never write to except by landing.

1. **Start** with `pnpm worktree <branchlabel>`, which cuts `YYYYMMDD-<branchlabel>` from the spine's top into a worktree of
   its own, with a lane and its packages, and prints its root. Work from that root. Continuing the current thread needs no new worktree.
2. **Commit at natural milestones**: a set of related changes, with the app working again (typecheck,
   lint and the tests near your change pass). Not mid-refactor, not on a timer. Separate commits are preferred.
   Inside your worktree, commit, branch and replay however helps, and tidy up before landing.
3. **Finish** by proving the branch, then bidding (`notes/git_hygiene-laptop.md`, *Finishing*): `pnpm catchup` rebases onto the top,
   `pnpm justify` runs typecheck, lint and the unit tests, `pnpm e2e` the e2e suite (each failure repaired alone: `pnpm e2e:rerun`; a run that waited for the container's lock rebases the branch first, so `pnpm justify` again; a thread worker in a sprint runs `pnpm e2e --touched` or more, and the full suite when its orchestrator asks: `/sprint`, *Which proof*) --
   `pnpm land --skip-e2e "<why>"` goes without it only where `notes/git_hygiene.md`, *When e2e is not worth running*, allows --
   then `pnpm land` folds your branch onto the spine, running only typecheck and the unit tests under the spine's hold, and pushes it. On a rebase conflict, repair what is straightforward and carry on;
   if a conflict needs a judgment about which behaviour wins, discuss (by finishing and offering to rewind, or by `git rebase --abort`ing on large problems).
4. **File the PR** against `main` with `gh pr create`, unless *significant* questions hang: then ask
   in chat first. Add smaller open questions in the description -- but make sure they *also* appear in the proper place (`human/`, whiteboard, chat) as usual. Write "stacked on #N" for the branch you landed on.
   Then `pnpm worktree --remove`. More commits for a PR
   already filed land with `pnpm land --into <its branch>` (`git_hygiene-laptop`, *Adding to a PR already filed*).

- Never stash, commit, discard or overwrite anything uncommitted in the main checkout but the swept `whiteboard/`, `human/` and `notes/`: it is the Coach's.
