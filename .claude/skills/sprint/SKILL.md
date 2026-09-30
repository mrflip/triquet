---
name: sprint
description: Orchestrate a sprint -- an ordered series of threads issued at once, each built by a thread-worker subagent and reviewed by a thread-reviewer subagent in series, stacked into one line of PRs, without the Coach's vigilance between threads. Use when the Coach invokes /sprint, issues several "Next thread:" blocks, or asks for work to be run as a sprint. A single thread is not a sprint; just do it.
---

# Sprint orchestrator

You run a **sprint**: the Coach hands you an ordered list of threads and walks away; you
plan it, hand each thread in turn to a fresh `thread-worker` subagent, put a fresh
`thread-reviewer` over what it built, and decide between threads whether to continue,
resume, or stop. Definitions live in `notes/git_hygiene.md` (*A thread, start to finish*
and *Sprints*); the workers' own procedures are `.claude/agents/thread-worker.md` and
`.claude/agents/thread-reviewer.md`. Read all three before your first sprint of a session.

This skill loads inline, which is why the orchestrator is a skill and not an agent: you
run in the main conversation at no delegation depth, keeping live chat with the Coach, and
workers delegate freely below you. Never give this skill `context: fork`: that would burn
a layer, sever the chat, and background the orchestrator into a restricted toolset.

You orchestrate; you do not build, and you do not review. Between threads you never edit
source, check out branches, or otherwise disturb the working tree -- workers and reviewers
run in series in the shared checkout, so each one ends standing on the thread's branch and
the next begins there. Your writes
are the sprint's documents, `HUMAN-whatsup.md`, and chat -- and the sprint's documents are
yours to curate, not merely append to (§3). Commit what you write: your document edits go,
with a `docs:` message, to the branch you stand on, whatever it is, so no worker ever
inherits your dirt. Beyond the sprint-start `newb` (§1), you neither make nor switch
branches: `pre-thread` cuts each thread's branch (§2), and the worker owns it from there.

## 1. Plan

Pick a short `sprint_name` from the work (the Coach's word for it if they gave one), then
`pnpm newb <sprint_name>_start` -- no rebase first, no look at what stands, no push, no
PR. On that branch, make `whiteboard/YYYYMMDD-<sprint_name>/` with two files.

**`<sprint_name>-plan.md`** -- the high-level plan, modelled on
`whiteboard/convex_yay-plan.md` at sprint scale:

* A header: date, mode (normal or YOLO, see §4), the review level (`medium` unless the
  Coach named another, or `none` if they said to skip review), who issued it, and a status
  line you keep current (planned / thread N underway / paused: why / done).
* *Read first*: the notes and files every worker needs beyond CLAUDE.md's auto-loads.
* *Ground rules*: point at git_hygiene and the thread-worker agent; restate only what is
  particular to this sprint.
* The threads, numbered, each with the Coach's text **verbatim** and then your gloss:
  what it likely touches, and your **look-ahead** -- read the whole request before writing
  any of this, because later threads bend earlier ones (a fold-affordance built in thread
  3 and reused in thread 5 is designed once, for both; a library one thread wants is
  chosen knowing the others' uses).
* *For the Coach*: anything already visible that needs a human.

**`<sprint_name>-progress.md`** -- the running handoff, newer than the plan wherever they
disagree. Seed it with a one-line-per-thread *Status* table (`pending` each); workers
append their sections newest-first as they finish.

Commit both files to the `_start` branch with a `docs:` message. No push, no PR.

**The sprint doc** -- a live remote mirror, so the Coach can watch the sprint from any
device. When the Claude Docs tools are in the session, load the live guide before your
first docs call (`guide( items = ["topic.index", "topic.tabs"] )` -- that surface moves
quickly; work from what it says today, never from memory), then birth one doc named for
the sprint with a *Plan* tab, a *Progress* tab and a *HUMAN-whatsup* tab mirroring those
files, and hand the Coach its link once in chat. Any further file the sprint adds to its
whiteboard directory gets a tab of its own when it appears. The repo files stay the
source of truth: write the file first, mirror it after; the doc never holds anything the
repo lacks. No Docs tools in the session: skip the mirror, say so in one line, and carry
on.

Post a short plan summary in chat -- threads, ordering choices, look-ahead calls -- and
proceed. Do not wait for approval unless planning surfaced a *significant* question (one
whose answer would change what gets built); that, ask now, before spawning anything.

## 2. Run each thread, in series

First spawn `pre-thread` (foreground) with a branch label you choose -- it needs nothing
else, and knows nothing of the plan. It tidies the stack, repairs only the straightforward
rebase conflicts, cuts the branch with `newb`, and reports; the tidy's churn stays out of
your context and the worker's. A bail from it (a conflict needing judgment) is a §4
decision, made before any worker is spawned. Anything notable in its report goes into the
worker's prompt and the chat relay.

Then spawn one `thread-worker` per thread with `run_in_background: false`: the next thread
depends on it, nothing else is waiting, and a foreground worker keeps the full toolset
where a background one is trimmed. The prompt is the whole handoff:

```
Thread <N> of sprint <sprint_name>. Sprint directory: whiteboard/<YYYYMMDD-sprint_name>/.
Your branch: <branch>, cut for you -- own it from here. Mode: <normal | YOLO: prefer your
recorded best judgment over blocking on minor calls>.
Read <sprint_name>-plan.md and <sprint_name>-progress.md before touching code, then carry
out this thread per your agent definition:

<the thread's text, verbatim>

Look-ahead from the orchestrator: <what later threads need from this one, if anything>.
From the ground-tidy: <anything pre-thread reported worth the worker knowing, if anything>.
```

The worker owns the branch from there: build, the finishing rebase, push, PR.

When the worker reports `complete`, spawn one `thread-reviewer` (foreground, for the same
reasons) before any bookkeeping, so its fixes ride onto the PR ahead of your document
commit. It stands where the worker left off and needs only its handoff:

```
Review of thread <N> of sprint <sprint_name>. Sprint directory: whiteboard/<YYYYMMDD-sprint_name>/.
Branch: <branch>, PR #<n>, stacked on <beneath>. Review level: <level>.
Review <beneath>...HEAD per your agent definition.
```

`<beneath>` is the branch pre-thread stood on when it cut this one (`origin/main` when it
stood on main); its pointer moved with the worker's finishing rebase, so the range is still
exactly the thread's commits. The reviewer runs `/code-review` over that range, keeps the
fixes it can stand behind as `fix:` commits on the same branch and PR, comments on the PR,
and reports; anything it may not decide comes back `flagged` for §4. Skip the review, and
say so in the relay, when the Coach set the level to `none` or the thread's diff holds no
code (documents, notes, fixtures only). A `blocked` or `abandoned` worker gets no review:
the review is of a finished thread, and follows the resume that finishes it.

## 3. Between threads

1. **Verify, cheaply.** `git status` and `git log --oneline -5` match the reports: the
   worker's commits, then the reviewer's `fix:` commits if it kept any, and a clean tree;
   `gh pr view <n>` exists when the report claims a PR. Trust the reports for the rest --
   do not re-review the diff; that was the reviewer's job, and it is done.
2. **Relay, whole.** Put the worker's report and then the reviewer's in chat verbatim --
   the Coach reads the entire bolus, not a précis -- under one lead line of your own
   (thread, the worker's verdict, PR number, the review's verdict).
3. **Mirror to the sprint doc.** Add a tab named `Thread N: <label>` holding both reports;
   bring the *Plan*, *Progress* and *HUMAN-whatsup* tabs up to date with their files; and
   add a tab for any file that has appeared in the sprint directory since the last look.
   A Coach with the doc open sees each update land live.
4. **Tend the documents.** Tick the thread off in the status lines, and revise later
   threads' glosses where its discoveries changed them. Under the thread's section in the
   progress document add a `*Review:*` line from the reviewer's report -- what it fixed,
   and each finding it left with its disposition -- so a later worker inherits the
   knowledge; the reviewer writes code and the PR, never the documents. Workers may pull
   a later thread's work forward when it comes naturally, declaring it in their section
   and report: strike what was pulled forward from the later thread's text, so it is not
   asked for twice.
   Beyond that bookkeeping, curate: tighten and reorganize both documents as the sprint
   teaches, condense what later threads no longer need, hoist a buried finding to where
   its reader will look, and spin an outgrown block into a standalone file in the sprint
   directory (listed with a line on who should read it, as the workers do). Defend a
   ceiling of about 5,000 words on the progress document: every later worker reads it
   whole. Condense the telling, never the facts -- a worker's section keeps saying what
   that worker claimed -- and mark what you add with `*Orchestrator:*`. Then commit what
   changed (documents only, a `docs:` message) to the just-finished thread's branch, where
   you already stand, and push: the curation rides onto that thread's PR.
5. **Decide** (§4), and go around again. If the Coach has interjected in chat meanwhile,
   fold their guidance in first.

## 4. Continue, resume, or stop

Default rules, absent other guidance:

* **Continue** past a `complete` thread with green suites and a `clean` or `fixed`
  review. Minor questions, and minor findings the reviewer left, ride along in the
  syndicated channels.
* **A `flagged` review** -- a significant finding the reviewer may not act on -- is
  handled like a worker's blocking question. If the fix is a two-way door and you are in
  YOLO, resume the worker (SendMessage, same agent) with the finding as a directive; it
  builds on the branch as it now stands, reviewer's commits and all. Then spawn a second
  reviewer over the new commits only (`<tip the first reviewer left>...HEAD`). Never a
  third: what is still open after that is the Coach's. Otherwise the finding is the
  Coach's, and you pause with it in the status lines.
* **Resume** a `blocked` worker (SendMessage, same agent, so its context survives) when
  you can supply what it lacks: an answer the plan or progress document already holds, or
  -- in YOLO -- a judgment call you can make and record. Otherwise the block is the
  Coach's.
* **Pause the sprint** -- report in chat, update both documents' status lines and the
  sprint doc, add a
  `## YYYY-MM-DD: Sprint <name> paused` entry to `HUMAN-whatsup.md` saying exactly where
  things stand, commit and push those document edits (§3's rule), and end your turn --
  when:
  - a worker is `blocked` on a significant question you may not answer;
  - suites are red and the worker could not repair them;
  - a guardrail conflicts with the work (say so and propose the alternative, per
    CLAUDE.md; never route around it);
  - the tree or a branch is in a state neither you nor the reports explain (a `bailed`
    reviewer is this case);
  - a thread's outcome invalidates later threads' premises. Threads are stacked, so a
    stopped thread stops what follows; run a later thread early only if the plan marked
    it independent.
* **Stopping is cheap** if you're not in YOLO mode. Work parks on pushed branches and
  the progress document; a paused sprint resumes where it stood. When unsure, pause:
  the sprint's promise is that nothing needing the Coach's vigilance happens without it.

**YOLO** (the Coach says so, usually at the invocation): be more reluctant to pause, not
more willing to gamble. Answer judgment calls a competent Coach would consider two-way
doors, record each prominently (the plan's *Decisions taken in YOLO* list, the chat relay,
and `HUMAN-whatsup.md` at sprint end), and keep going. Still pause for anything
destructive or hard to reverse, anything touching `main` or production, a guardrail break,
or a genuinely one-way design call. YOLO never means merging a PR.

## 5. Wrap up

When the last thread completes (or the sprint pauses for good): set both documents' status
lines and mirror them to the sprint doc; add a `HUMAN-whatsup.md` entry at the top -- the
sprint in a paragraph, its PRs in order with "stacked on" notes, YOLO decisions if any,
and the open questions gathered in one place; commit and push that final document state
(§3's rule); then give the Coach the closing summary in chat, leading with what shipped,
what the reviews fixed and left, and what needs their word. Never merge anything; the PRs
are the Coach's to land, top of the stack first or one at a time (git_hygiene, *Stacks*).
