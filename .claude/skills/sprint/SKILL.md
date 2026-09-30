---
name: sprint
description: Orchestrate a sprint -- an ordered series of threads issued at once, each built by a thread-worker subagent in series, stacked into one line of PRs, without the Coach's vigilance between threads. Use when the Coach invokes /sprint, issues several "Next thread:" blocks, or asks for work to be run as a sprint. A single thread is not a sprint; just do it.
---

# Sprint orchestrator

You run a **sprint**: the Coach hands you an ordered list of threads and walks away; you
plan it, hand each thread in turn to a fresh `thread-worker` subagent, and decide between
threads whether to continue, resume, or stop. Definitions live in `notes/git_hygiene.md`
(*A thread, start to finish* and *Sprints*); the worker's own procedure is
`.claude/agents/thread-worker.md`. Read both before your first sprint of a session.

You orchestrate; you do not build. Between threads you never edit source, check out
branches, or otherwise disturb the working tree -- workers run in series in the shared
checkout, so each one ends standing on its branch and the next begins there. Your writes
are the sprint's two documents, `HUMAN-whatsup.md`, and chat.

## 1. Plan

Pick a short `sprint_name` from the work (the Coach's word for it if they gave one) and
make `whiteboard/YYYYMMDD-<sprint_name>/` with two files.

**`<sprint_name>-plan.md`** -- the high-level plan, modelled on
`whiteboard/convex_yay-plan.md` at sprint scale:

* A header: date, mode (normal or YOLO, see §4), who issued it, and a status line you keep
  current (planned / thread N underway / paused: why / done).
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

Post a short plan summary in chat -- threads, ordering choices, look-ahead calls -- and
proceed. Do not wait for approval unless planning surfaced a *significant* question (one
whose answer would change what gets built); that, ask now, before spawning anything.

## 2. Run each thread, in series

Spawn one `thread-worker` per thread with `run_in_background: false` (the next thread
depends on it; nothing else is waiting). The prompt is the whole handoff:

```
Thread <N> of sprint <sprint_name>. Sprint directory: whiteboard/<YYYYMMDD-sprint_name>/.
You should be standing on <branch> with a clean tree. Mode: <normal | YOLO: prefer your
recorded best judgment over blocking on minor calls>.
Read <sprint_name>-plan.md and <sprint_name>-progress.md before touching code, then carry
out this thread per your agent definition:

<the thread's text, verbatim>

Look-ahead from the orchestrator: <what later threads need from this one, if anything>.
```

The first thread's branch is wherever the sprint starts (usually `main`); each later
thread's is the branch the previous worker reported ending on.

## 3. Between threads

1. **Verify, cheaply.** `git status` and `git log --oneline -3` match the report;
   `gh pr view <n>` exists when the report claims a PR. Trust the report for the rest --
   do not re-review the diff.
2. **Relay to chat.** A condensed version of the worker's report: what landed (PR number,
   suite counts), deviations and suppressions, its questions. This is the Coach's live
   feed; keep it a short paragraph per thread, not the report verbatim.
3. **Tend the plan.** Tick the thread off in the status lines, and revise later threads'
   glosses where its discoveries changed them. The progress document is the workers';
   append an `*Orchestrator:*` line to a thread's section only to record a decision you
   made about it.
4. **Decide** (§4), and go around again. If the Coach has interjected in chat meanwhile,
   fold their guidance in first.

## 4. Continue, resume, or stop

Default rules, absent other guidance:

* **Continue** past a `complete` thread with green suites. Minor questions ride along in
  the syndicated channels.
* **Resume** a `blocked` worker (SendMessage, same agent, so its context survives) when
  you can supply what it lacks: an answer the plan or progress document already holds, or
  -- in YOLO -- a judgment call you can make and record. Otherwise the block is the
  Coach's.
* **Pause the sprint** -- report in chat, update both documents' status lines, add a
  `## YYYY-MM-DD: Sprint <name> paused` entry to `HUMAN-whatsup.md` saying exactly where
  things stand, and end your turn -- when:
  - a worker is `blocked` on a significant question you may not answer;
  - suites are red and the worker could not repair them;
  - a guardrail conflicts with the work (say so and propose the alternative, per
    CLAUDE.md; never route around it);
  - the tree or a branch is in a state neither you nor the report explains;
  - a thread's outcome invalidates later threads' premises. Threads are stacked, so a
    stopped thread stops what follows; run a later thread early only if the plan marked
    it independent.
* **Stopping is cheap.** Work parks on pushed branches and the progress document; a paused
  sprint resumes where it stood. When unsure, pause: the sprint's promise is that nothing
  needing the Coach's vigilance happens without it.

**YOLO** (the Coach says so, usually at the invocation): be more reluctant to pause, not
more willing to gamble. Answer judgment calls a competent Coach would consider two-way
doors, record each prominently (the plan's *Decisions taken in YOLO* list, the chat relay,
and `HUMAN-whatsup.md` at sprint end), and keep going. Still pause for anything
destructive or hard to reverse, anything touching `main` or production, a guardrail break,
or a genuinely one-way design call. YOLO never means merging a PR.

## 5. Wrap up

When the last thread completes (or the sprint pauses for good): set both documents' status
lines; add a `HUMAN-whatsup.md` entry at the top -- the sprint in a paragraph, its PRs in
order with "stacked on" notes, YOLO decisions if any, and the open questions gathered in
one place; then give the Coach the closing summary in chat, leading with what shipped and
what needs their word. Never merge anything; the PRs are the Coach's to land, top of the
stack first or one at a time (git_hygiene, *Stacks*).
