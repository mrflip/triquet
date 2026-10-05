# Thread 6: the review runs from outside the worktree (2026-10-05)

Branch `20261005-review_in_worktree`, PR filed at landing; see the report. Suites: typecheck and
lint clean; `pnpm test` 126 files, 3540 tests. e2e runs at landing.

* **Built**:
  - `.claude/agents/thread-reviewer.md`, its description included. A new section, *Where the
    skill stands*, says why `/code-review` cannot see the worktree. The reviewer runs it as
    `/code-review <level> <base-sha>...<tip-sha>`, never with `--fix`, and treats each finding
    as a lead to check against the worktree's files. It makes every kept fix by hand. It
    notes the main checkout's `git status --porcelain` before the skill runs and compares it
    after: a change the review could have made is a `bailed`. It reviews by hand, at the
    level's depth, when the skill's findings show it reviewed the main checkout instead. Its
    report says which way the review ran. *Never* now opens with `--fix` and with writing to
    the main checkout.
  - `.claude/skills/sprint/SKILL.md`: the §2 review handoff names the range as two SHAs and
    says how to find them. §4's second-reviewer range is two SHAs too. The intro has a new
    paragraph, *Stage before you sweep*: the trim bug's workaround, `git add -- whiteboard human
    notes` in the main checkout before each sweep, cut, or resume to land.
  - `.claude/agents/thread-worker.md`, *Land*: a sweep failing on `hiteboard/...` is a
    `blocked`, for the orchestrator to stage and resume.
  - `notes/git_hygiene.md`: *Sprints* describes the review as it now runs. *Force-pushing*
    explains a `stale info` refusal. *Looking at the graph* no longer claims `fetch.prune`.
  - **Code**: `scripts/spine.ts`'s `restack` fetches with `--prune`. A test in
    `tests/scripts/spine.test.ts` replays this sprint's case: alpha lands, origin merges and
    deletes it, notes are swept onto it, and the restack must not lease against it. The test
    failed with `stale info` before the change.
* **Decisions taken**:
  - **The orchestrator's approach, kept whole.** Other ways to point the skill at the worktree
    were considered and none holds. The skill's own description takes "a PR number/branch/path
    target" and says `--fix` applies "to the working tree"; it names no working directory. A
    path target narrows *what* it reviews, not *where* it stands, so `--fix` would still write
    to the main checkout. A branch target would review against an unstated base. The Agent tool
    has no working-directory option, and `isolation: "worktree"` is barred (no lane). So the
    range is spelled as SHAs, because the refs are shared. `HEAD` in the main checkout is the
    thread's base, which makes a `<base>...HEAD` range empty.
  - **The prune fix went in as code.** The orchestrator allowed this for a one-line change
    with a test, and the guidance alone could not cure the trap cleanly. When `restack` is
    refused partway, it has already replayed the spine, and the spine branches after the
    refused one were never pushed. A rerun then finds the spine on `origin/main` and pushes
    nothing, so by-hand guidance would also have had to explain how to push those branches.
    With the fix, the scripts never meet the trap. git_hygiene keeps a line for leases taken
    by hand.
  - **The trim bug stays guidance**, as the brief asked: it is the spine's own code and has its
    own human/ entry.
* **Deviations**: the thread holds code (`scripts/spine.ts`, one line, and its test), so under
  the sprint skill it **does get a review**.
* **Discoveries**:
  - **Threads cut before this lands run the old `spine.ts`.** Thread 4 is one of them. A
    `stale info` in such a landing is this trap: run `git fetch --prune origin` and land again.
    If the replay had other spine branches to push after the refused one, they went unpushed,
    and the landing's own push covers only its branch. The orchestrator should check
    `git branch -vv` on the spine for branches behind their origin.
  - The worktree's branch is cut with `branch.<b>.remote`/`merge` set, so `git status` in a
    fresh worktree says "the upstream is gone" until the first push. Harmless.
* **For the Coach**: see `human/20261005-review_in_worktree.md`. In short: `/code-review` has no
  way to stand in a worktree (worth asking for upstream), and the trim fix in `spine.ts` is
  still open.
