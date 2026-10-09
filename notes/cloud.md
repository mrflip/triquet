# Working in a cloud session

Loaded at the start of every cloud session (Claude Code on the web, the app or a phone:
`$CLAUDE_CODE_REMOTE` is `true`): `.claude/hooks/session-start.sh` prints it. If you are reading
it without that, check the variable; when it is `true`, this binds you all the same. On the laptop,
`notes/laptop.md` holds instead, and none of the spine, worktrees, lanes, `pnpm land` or sprints
apply here.

## Where you are

* **A fresh clone, yours alone**, at `$CLAUDE_PROJECT_DIR`, with `/workspace/triquet` pointing at
  it. No Coach works in it and nobody else's work is uncommitted in it: work in it directly. It is
  lane 0, on the project's usual ports.
* **The container is thrown away** when the session idles out or ends. Uncommitted work and
  unpushed commits go with it. Push as you go (`notes/git_hygiene-cloud.md`).
* **Four cores, not sixteen.** Long suites take longer, and the e2e suite runs fewer workers (as
  many as the idle cores bear: `workersFor` in `e2e/environment.ts`).
* **Waiting is the expensive part.** The full e2e suite takes about twenty minutes here, and CI
  runs it in about five on every push. A bug that CI or a later pass catches costs less than
  making the Coach wait between prompts. Prove locally what a quick run can tell you, and leave
  the full gate to CI: `notes/git_hygiene-cloud.md`, *Prove the milestone, cheaply*.

## What the session hook did

1. Pointed `/workspace/triquet` at the clone.
2. Installed the packages from the lockfile.
3. Installed the Doppler CLI, if the environment holds a `DOPPLER_TOKEN_*` for it.
4. Set, for the session: `TQ_IS_SANDBOXED=true`, and `TQ_CHROMIUM_PATH`, the container's own
   Chromium, when Playwright's pinned build is missing (you may not run `playwright install`
   here).

If a command below fails for want of one of those, run the hook yourself:
`CLAUDE_CODE_REMOTE=true .claude/hooks/session-start.sh`.

## What works, and what doesn't

* **Works**: `pnpm justify` (typecheck, lint and the unit tests), `pnpm e2e` and its kin
  (`--touched`, `e2e:rerun`, `e2e:smoke`), `pnpm dev:agent`, `scripts/convex_dev agent`, and the
  local Convex backend, which downloads its binary on first use.
* **Doppler**: with no Doppler CLI, `scripts/doppledo` runs its command bare and says so, as CI
  does, and the e2e suite accepts that here. The bots have no key without Doppler, which is what
  the suite wants anyway. Never ask for a secret in chat.
* **GitHub**: `git push` and `git fetch` work as they are (the container supplies credentials and
  signs commits; change no git config). `gh` is not logged in: use the GitHub MCP tools for pull
  requests, comments and CI.
* **Laptop only, never here**: `pnpm worktree`, `catchup`, `land`, `sweep`, `restack`,
  `automerge`, `/sprint`, `/git-prep`, the `thread-worker` and `thread-reviewer` agents, and
  `pnpm sessions` (which reads transcripts only the laptop keeps).
* **Node 22 here** where `.tool-versions` pins 24: typecheck, the unit tests and e2e all pass on it.

## A thread, in the cloud

One branch and one PR per milestone, all worked in the clone: a session may file several.
`notes/git_hygiene-cloud.md` has each step, and `notes/git_hygiene.md` what holds everywhere. In
short: cut each milestone's branch from `origin/main` (or from the milestone it builds on),
commit and push as you go, prove cheaply (the corner or the smoke tier; CI runs the rest), rebase
onto `origin/main` (never merge it in), open the PR ready for review with the GitHub MCP tools,
and see it through CI and review.

`human/` and `whiteboard/` entries are committed on the thread's branch: there is no sweep to
carry them, and the PR is how they reach the Coach.
