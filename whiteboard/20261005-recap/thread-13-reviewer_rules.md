# Thread 13: Reviews that cannot touch the main checkout (2026-10-07)

Branch `20261007-reviewer_rules`, PR filed at landing; see the report. Documents only (`.claude/`
definitions and `notes/`): no code, so `pnpm justify` is the only suite, and e2e is skipped at
landing (git_hygiene, *When e2e is not worth running*).

* **Built**:
  - `.claude/agents/thread-reviewer.md`: the main checkout is read-only to the skill as to the
    reviewer (no checkout, switch, stash, reset or restore; no installs, builds, servers or test
    runs), with the thread 5 incident as the reason; code is tried only in the worktree. The
    reviewer puts that rule in `/code-review`'s arguments every time (the exact text is in *The
    job*, step 1), since the skill reads neither this file nor its own standing place. Before the
    review it notes the main checkout's time, status, branch and stash list; after, it checks
    those and the reflog since (a checkout to a bare SHA, a stray `reset`, or a move away and back
    is the review's; landings and sweeps write `commit`, `rebase` and branch-to-branch `checkout`
    entries), and reports `bailed` on a change the review could have made. A review run from
    inside the worktree is recorded as preferred, should the skill ever take a directory. The
    report gains *what you could not check, and why*: a restriction is reported, never worked
    round. The description and *Never* say the same.
  - `.claude/skills/sprint/SKILL.md`: the review handoff carries the orchestrator's hand-given
    line from this sprint (tell the skill no checkout/switch/stash/reset; the thread only through
    the two SHAs or the worktree; `bailed` if it changes the main checkout anyway), and asks for
    what could not be checked.
  - `notes/git_hygiene.md`, *Sprints*: the skill is "told to change nothing there".
* **Decisions taken**:
  - **The reflog, not only status, is the tell.** The thread 5 incident left status, branch and
    HEAD as they were; only the reflog showed it. Landings move the main checkout's HEAD too, so
    the check names the entries landings write and the ones only a review would.
  - **The rule rides in the skill's arguments** after `--`, as the orchestrator's hand-given line
    did; that worked this sprint, and there is no other channel to the skill.
* **Discoveries**:
  - The `EnterWorktree` tool can switch a session (or an agent) into an existing worktree by
    `path`. That might be the "workspace of the reviewer's own" the Coach asked for: a reviewer
    standing in the thread's worktree, so `/code-review` runs there. Untested, and not adopted:
    its own description says to use it only when instructed, from an agent whose directory was
    pinned it accepts only worktrees under `.claude/worktrees/` (ours live under
    `~/worktrees/triquet/`), and whether an unpinned subagent's switch moves the orchestrator's
    session too is unknown. See *For the Coach*.
* **For the Coach**:
  - Whether to try `EnterWorktree path=<root>` for reviewers (a short experiment in a scratch
    worktree, watching the orchestrator's directory), which would make the preferred
    "review from inside the worktree" real. The definition already says to use such a route once
    it is sanctioned.
