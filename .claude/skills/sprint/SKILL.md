---
name: sprint
description: Orchestrate a sprint -- an ordered series of threads issued at once, each built in a worktree of its own by a thread-worker subagent, reviewed by a thread-reviewer subagent, and landed on the spine, several at a time where the plan allows, without the Coach's vigilance between threads. Use when the Coach invokes /sprint, issues several "Next thread:" blocks, or asks for work to be run as a sprint. A single thread is not a sprint; just do it.
---

# Sprint orchestrator

You run a **sprint**: the Coach hands you an ordered list of threads and walks away; you
plan it, cut each thread a worktree, hand it to a fresh `thread-worker` subagent, put a fresh
`thread-reviewer` over what it built, have the worker land it on the spine, and decide as each
report comes in whether to continue, resume, or stop. Threads whose dependencies have landed run
side by side. Definitions live in `notes/git_hygiene.md` (*The spine*, *A thread, start to
finish* and *Sprints*); the workers' own procedures are `.claude/agents/thread-worker.md` and
`.claude/agents/thread-reviewer.md`. Read all three before your first sprint of a session.

This skill loads inline, which is why the orchestrator is a skill and not an agent: you
run in the main conversation at no delegation depth, keeping live chat with the Coach, and
workers delegate freely below you. Never give this skill `context: fork`: that would burn
a layer, sever the chat, and background the orchestrator into a restricted toolset.

You orchestrate; you do not build, and you do not review. You stand in the main checkout, which
is the Coach's: you never edit source there, switch its branch, or touch anything uncommitted
outside `whiteboard/` and `human/`. Your writes are the sprint's documents in its whiteboard
directory, entries under `human/`, and chat -- and the sprint's documents are yours to curate,
not merely append to (§3). `pnpm sweep` commits what you wrote onto the spine's top; every cut
and landing sweeps too. You run `pnpm worktree` to cut each thread's ground (§2), and the worker
owns the worktree from there.

## 1. Plan

Pick a short `sprint_name` from the work (the Coach's word for it if they gave one). In the main
checkout, make `whiteboard/YYYYMMDD-<sprint_name>/` with two files.

**`<sprint_name>-plan.md`** -- the high-level plan, modelled on
`whiteboard/convex_yay-plan.md` at sprint scale:

* A header: date, mode (normal or YOLO, see §4), the review level (`medium` unless the
  Coach named another, or `none` if they said to skip review), how many threads may run at
  once (3 unless the Coach named another), who issued it, and a status line you keep current
  (planned / threads N, M underway / paused: why / done).
* *Read first*: the notes and files every worker needs beyond CLAUDE.md's auto-loads.
* *Ground rules*: point at git_hygiene and the thread-worker agent; restate only what is
  particular to this sprint.
* The threads, numbered, each with the Coach's text **verbatim** and then your gloss:
  what it likely touches, **what it depends on** (the threads that must land before it is
  cut, or *nothing*), and your **look-ahead** -- read the whole request before writing
  any of this, because later threads bend earlier ones (a fold-affordance built in thread
  3 and reused in thread 5 is designed once, for both; a library one thread wants is
  chosen knowing the others' uses). A thread depends on another when it builds on its code,
  or when the two would rewrite the same lines; threads in different corners of the tree
  are independent, and a stray overlap surfaces as a conflict at landing, which is fine.
* *For the Coach*: anything already visible that needs a human.

**`<sprint_name>-progress.md`** -- yours alone: a one-line-per-thread *Status* table
(`pending` each; then `underway`, `in review`, `landing`, `landed #N`, `blocked`), and a
curated summary of what the threads have taught, newer than the plan wherever they disagree.
Each worker writes its own section to `thread-<N>-<label>.md` beside it, on its own branch,
so no two writers ever share a file.

Then `pnpm sweep`, which commits both onto the spine's top. No push, no PR: they ride with
the first thread to land.

**The sprint doc** -- a live remote mirror, so the Coach can watch the sprint from any
device. When the Claude Docs tools are in the session, load the live guide before your
first docs call (`guide( items = ["topic.index", "topic.tabs"] )` -- that surface moves
quickly; work from what it says today, never from memory), then birth one doc named for
the sprint with a *Plan* tab, a *Progress* tab and a *human* tab mirroring those
files (the sprint's `human/` entries), and hand the Coach its link once in chat. Each
thread's file gets a tab of its own once it lands, as does any further file in the sprint's
whiteboard directory. The repo files stay the source of truth: write the file first, mirror it
after; the doc never holds anything the repo lacks. No Docs tools in the session: skip the
mirror, say so in one line, and carry on.

Post a short plan summary in chat -- threads, which run together and which wait, look-ahead
calls -- and proceed. Do not wait for approval unless planning surfaced a *significant*
question (one whose answer would change what gets built); that, ask now, before spawning
anything.

## 2. Run the threads

Keep a **frontier**: every thread whose dependencies have all landed, not yet started. Start
frontier threads, lowest number first, while fewer than the cap are underway; start more as
threads land. Each thread runs three steps.

**Cut and build.** From the main checkout, `pnpm worktree <label>` (a label you choose). It
prints the worktree's root, branch and lane. Never use the Agent tool's `isolation: "worktree"`
instead: that worktree would have no lane, and would sit on the Mac-shared mount. Then spawn one
`thread-worker` with `run_in_background: true`, so threads run side by side and you hear of each
as it finishes. The prompt is the whole handoff:

```
Thread <N> of sprint <sprint_name>. Sprint directory: whiteboard/<YYYYMMDD-sprint_name>/.
Your worktree: <root>, on branch <branch>, lane <lane>, cut for you from the spine's top.
Begin every shell command with `cd <root> && `; every path here is relative to it. Mode: <normal | YOLO:
prefer your recorded best judgment over blocking on minor calls>.
Read <sprint_name>-plan.md and <sprint_name>-progress.md before touching code, then build
this thread per your agent definition, and report `ready` when it is built and committed:

<the thread's text, verbatim>

Look-ahead from the orchestrator: <what later threads need from this one, if anything>.
```

Write that root out once, in full, in the handoff; every other path in it is relative to the
root (CLAUDE.md, *Global resources*). A background worker that reports its tools refused
(a permission it could not ask for) is re-run in the foreground, alone.

**Review.** When the worker reports `ready`, spawn one `thread-reviewer` (in the background, for
the same reasons) unless the review level is `none` or the thread's diff holds no code
(documents, notes, fixtures only), in which case say so in the relay and skip to landing:

```
Review of thread <N> of sprint <sprint_name>. Sprint directory: whiteboard/<YYYYMMDD-sprint_name>/.
Worktree: <root>; begin every shell command with `cd <root> && `. Branch: <branch>. Review level: <level>.
Review the thread's own commits, from its base (`git config branch.<branch>.spinebase`) to
HEAD, per your agent definition.
```

The reviewer keeps the fixes it can stand behind as `fix:` commits in the worktree, and
reports; anything it may not decide comes back `flagged` for §4.

**Land.** Resume the worker (SendMessage, same agent, so its context survives) with "Land
it", and anything from the review it should know. It runs `pnpm land`, repairs what is
straightforward, files the PR, removes its worktree, and reports `landed` with the PR number,
or `blocked`. Then post the reviewer's PR comment (`gh pr comment <n>`, the text from its
report) so the review sits on the PR.

A `blocked` or `abandoned` worker gets no review: the review is of a finished thread, and
follows the resume that finishes it.

## 3. As each report comes in

1. **Verify, cheaply.** For `ready`: the worker's commits are in its worktree
   (`git -C <root> log --oneline -5`) and its tree is clean. For `landed`: `pnpm top` names its
   branch or one landed since, and `gh pr view <n>` exists. Trust the reports for the rest --
   do not re-review the diff; that is the reviewer's job.
2. **Relay, whole.** Put the report in chat verbatim -- the Coach reads the entire bolus, not
   a précis -- under one lead line of your own (thread, the verdict, PR number when there is
   one). Reports from different threads interleave; each lead line says whose it is.
3. **Mirror to the sprint doc.** Add a tab named `Thread N: <label>` holding its reports;
   bring the *Plan*, *Progress* and *human* tabs up to date with their files; and add a tab
   for any file that has appeared in the sprint directory since the last look. A Coach with
   the doc open sees each update land live.
4. **Tend the documents.** Keep the status table and status lines current, and revise later
   threads' glosses where a thread's discoveries changed them. When a thread lands, add a
   `*Review:*` line under its entry in the progress document from the reviewer's report --
   what it fixed, and each finding it left with its disposition -- so later workers inherit
   it; the reviewer writes code, never the documents. Workers may pull a later thread's work
   forward when it comes naturally, declaring it in their section and report: strike what was
   pulled forward from the later thread's text, so it is not asked for twice.
   Beyond that bookkeeping, curate: condense what later threads no longer need into the
   progress document's summary, hoist a buried finding to where its reader will look, and
   spin an outgrown block into a standalone file in the sprint directory (listed with a line
   on who should read it, as the workers do). Defend a ceiling of about 5,000 words on the
   progress document: every later worker reads it whole. Never edit a worker's thread file:
   it says what that worker claimed. Mark what you add with `*Orchestrator:*`. Then
   `pnpm sweep`: what you wrote rides onto the spine's top.
5. **Decide** (§4), refill the frontier, and wait for the next report. If the Coach has
   interjected in chat meanwhile, fold their guidance in first.

## 4. Continue, resume, or stop

Default rules, absent other guidance:

* **Continue** past a `landed` thread with a `clean` or `fixed` review. Minor questions, and
  minor findings the reviewer left, ride along in the syndicated channels.
* **A `flagged` review** -- a significant finding the reviewer may not act on -- is
  handled like a worker's blocking question. If the fix is a two-way door and you are in
  YOLO, resume the worker with the finding as a directive; it builds on the branch as it now
  stands, reviewer's commits and all, and reports `ready` again. Then spawn a second reviewer
  over the new commits only (`<tip the first reviewer left>...HEAD`). Never a third: what is
  still open after that is the Coach's. Otherwise the finding is the Coach's: the thread waits,
  unlanded, in its worktree.
* **Resume** a `blocked` worker (SendMessage, same agent, so its context survives) when
  you can supply what it lacks: an answer the plan or progress document already holds, or
  -- in YOLO -- a judgment call you can make and record. A landing blocked on a conflict
  that takes judgment is the Coach's. Otherwise the block is the Coach's.
* **Pause the sprint** -- start no new threads, let those underway reach their next report and
  hold them there, report in chat, update both documents' status lines and the sprint doc,
  write a `human/YYYYMMDD-sprint_<name>_paused.md` entry saying exactly where things stand
  (which threads landed, which wait in which worktree, and why), `pnpm sweep`, and end your
  turn -- when:
  - a worker is `blocked` on a significant question you may not answer;
  - suites are red and the worker could not repair them;
  - a guardrail conflicts with the work (say so and propose the alternative, per
    CLAUDE.md; never route around it);
  - the spine, a worktree or a branch is in a state neither you nor the reports explain (a
    `bailed` reviewer is this case);
  - a thread's outcome invalidates other threads' premises. A stopped thread holds back the
    threads that depend on it; independent threads may carry on.
* **Stopping is cheap** if you're not in YOLO mode. Landed work is pushed; unlanded work is
  committed in its worktree, waiting; a paused sprint resumes where it stood. When unsure,
  pause: the sprint's promise is that nothing needing the Coach's vigilance happens without it.

**YOLO** (the Coach says so, usually at the invocation): be more reluctant to pause, not
more willing to gamble. Answer judgment calls a competent Coach would consider two-way
doors, record each prominently (the plan's *Decisions taken in YOLO* list, the chat relay,
and an entry under `human/` at sprint end), and keep going. Still pause for anything
destructive or hard to reverse, anything touching `main` or production, a guardrail break,
or a genuinely one-way design call. YOLO never means merging a PR.

## 5. Wrap up

When the last thread lands (or the sprint pauses for good): set both documents' status
lines and mirror them to the sprint doc; add a `human/YYYYMMDD-sprint_<name>_done.md` entry
-- the sprint in a paragraph, its PRs in the order they landed with "stacked on" notes, YOLO
decisions if any, and the open questions gathered in one place; `pnpm sweep`, then push the
top (`git -C <main checkout> push`, borrowing gh's login per git_hygiene's *Filing the PR*)
so the final documents reach its PR; then give the Coach the closing summary in chat, leading
with what shipped, what the reviews fixed and left, and what needs their word. Never merge
anything; the PRs are the Coach's to land, top of the stack first or one at a time
(git_hygiene, *Stacks*).
