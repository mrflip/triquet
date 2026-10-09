# Git hygiene in the cloud

How work runs in a cloud session (`$CLAUDE_CODE_REMOTE` is `true`): one clone, and **one branch
and one PR per thread**, so a session may file several. What holds everywhere (history,
commits, conflicts, what goes in a PR, merging) is `notes/git_hygiene.md`; read it too. The laptop
follows `notes/git_hygiene-laptop.md`, and nothing in it applies here: there is no spine, no
worktree, no lane but 0, and no main checkout of the Coach's.

A **thread** is what CLAUDE.md calls one: a line of work the Coach could review and merge on its
own. (A *milestone* is still the smaller thing it is everywhere: a point worth committing at.)
Within the session you have standing permission to commit, push each thread's branch, and open
its PR without asking.

## 1. Branch, once per thread

Work in the clone (`$CLAUDE_PROJECT_DIR`). Cut each thread's branch, named like the laptop's
(`YYYYMMDD-<branchlabel>`, a label for that thread):

* **from `origin/main`**, when it does not need an earlier thread's work that is not merged yet:

  ```
  git fetch origin main && git switch -c YYYYMMDD-<branchlabel> origin/main
  ```

* **from the previous thread's branch**, when it builds on it: `git switch -c
  YYYYMMDD-<branchlabel>` from there. That makes a stack: its PR shows the lower one's commits
  until that merges, and step 4 says how to keep it current.

If the session was given a branch to work on, its first thread uses it.

## 2. Commit and push as you go

Commit at natural points: a set of related changes, with the tests near them passing. Separate
commits for unrelated changes; a large `convex/_generated/` regeneration in a commit of its own.

**Push after every commit worth keeping** (`git push -u origin <branch>`). The container is
reclaimed when the session idles out, and an unpushed commit goes with it. Push only this
session's branches: never `main`, never another session's branch.

**Which branches are this session's** is read from the commits, not remembered: every commit a
cloud session makes ends with a `Claude-Session:` trailer naming it, and
`$CLAUDE_CODE_REMOTE_SESSION_ID` holds the same id (`cse_<id>` there, `session_<id>` in the
trailer). A branch is this session's
when every commit on it past `origin/main` carries this session's trailer:

```
git log origin/main..origin/<branch> --format='%(trailers:key=Claude-Session,valueonly)'
```

Only such a branch may be rebased or force-pushed. One holding a commit from anyone else (the
Coach, another session) takes only plain new commits on top; ask before rewriting it. A blank or
foreign trailer counts as someone else's.

## 3. Prove the thread, cheaply

**Why the bar is lower here.** The Coach uses cloud sessions from a small machine. A full local
e2e run takes about twenty minutes, often five times as long as the change it checks, and the
Coach waits through it between prompts. CI runs the whole suite on every push in about five
minutes, across six shards. A bug that CI catches, or that the Coach cleans up later in the
session or in a later PR, costs little next to those waits. So prove locally only what a quick
run can tell you, and let CI be the full gate. When the cost changes (a change that is hard to
undo, a schema or migration, something the Coach said to be careful with), weigh it again.

* **Static checks and nearby tests**: typecheck, lint, and the unit tests near the change (`pnpm
  typecheck`, `pnpm lint`, `pnpm exec vitest run <paths>`). `pnpm justify` runs all three over every
  unit test, about four minutes here. Run it before the PR when the change is broad; otherwise
  leave the full unit suite to CI, which runs it too.
* **e2e, the corner**: `pnpm e2e --touched` when the branch reaches app code, as long as the corner
  it prints is small. When it says the whole suite (anything under `convex/` or `src/models/`,
  the dependencies, a new file the map does not know), run `pnpm e2e:smoke` instead (one test per spec
  file, about three minutes here) and let CI run the rest.
* **No e2e** when e2e could not notice the change: `notes/git_hygiene.md`, *When e2e is not
  worth running*. Say which choice you made in the PR's **Tests:** line.
* **The whole suite locally** only when the Coach asks for it, or when you are chasing something
  CI cannot show you.

**Investigating an e2e failure**, whether from CI or a local run: run the spec files involved, or
the one test (`pnpm e2e <spec file>`, `pnpm e2e <spec file> --grep "<title>"`, `pnpm e2e:rerun`).
Push the fix and let CI run the whole suite rather than rerunning it here.

**A failure that is probably not this branch's.** A spec may fail on a PR when the branch
plainly did not cause it. The usual signs:
- it fails the same way on `main`, or on another recent PR's CI;
- the commit that went red changed nothing the spec runs (docs only, say);
- it passes when run alone, with the code unchanged.

Then you may leave it: say on the PR which spec failed, what points away from this branch, and
that you did not chase it, and rerun the job once if you can. Chase it when the branch touched
what the spec exercises, or when it fails the same way twice on this branch and nowhere else.

## 4. Catch up

Before opening the PR, and whenever `main` has moved under an open one:

```
git fetch origin main
git rebase origin/main            # a stacked branch: rebase the top of the stack with --update-refs
# re-run the checks of step 3 that the rebase could have upset
git push --force-with-lease=<branch>:<the sha origin holds> origin <branch>
```

Never merge `main` into a branch, on any PR, yours or not: CI rejects a merge commit. Conflicts
are handled as `notes/git_hygiene.md`, *Rebase conflicts*, says. Once a lower thread merges,
rebase the ones above it onto `origin/main` and push each with its lease.

## 5. File the PR

With the GitHub MCP tools (`gh` is not logged in here), against `main`, **ready for review, not
as a draft**, with the title and body `notes/git_hygiene.md`, *Filing the PR*, describes. Write
"Stacked on #N" when the branch was cut from an unmerged thread's, "Follows #N" when it
builds on a merged one. Ask in chat first when a *significant* question hangs.

Then start the next thread (step 1).

## 6. See each PR through

The session watches every PR it opens. A red CI run, a merge conflict, or a review comment is
yours to answer: fix and push, or say in one comment why not. More commits for a PR go on its own
branch, pushed the same way. Never merge, and never enable auto-merge.
