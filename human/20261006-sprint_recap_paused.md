# 2026-10-06: Sprint recap, paused after thread 6

Paused at the Coach's word (close to their weekly limit), after thread 6 landed. Nothing is
running, and no worktree of this sprint is left: every thread so far has landed and been removed.
The plan is `whiteboard/20261005-recap/recap-plan.md`; the running handoff is `recap-progress.md`
beside it; each thread's own file is `thread-<N>-<label>.md` there.

## What landed, in spine order (each stacked on the one before)

| PR | Thread | What |
|---|---|---|
| #161 | 3 | Every panel folds to its title bar; panels in the row under the grid widen by an arrow |
| #162 | 2 | `Bbjank.toBbjank`: markdown to the league's message-board BBCode |
| #163 | 1 | The recap fields, widened in with backfills **(Serial Deploy: recap)** |
| #164 | 4 | Field templates: mustache over the bag, then markdown, then the sanitizer, last |
| #165 | 5 | The Recap panel: head and tail editors around a copyable bbjank recap note |
| #166 | 6 | Quiz-level widgetings and entries, the questions pivot, the Quiz entries panel |

The deliverable the Coach asked for (markdown into bbjank, copy and paste) is #165, on #162 and #164.

## Before merging

* **#163 first, then wait.** Run the production check in `human/20261006-recap_widen.md` (no
  widgeting already labelled `recap`). Merge up to and including #163, wait for its production
  deploy to log `Backfills: every one has finished.` (Vercel runs the backfills), then merge the rest.
* No other PR changes a row's shape: #166 adds a table (`quiz_widgeteds`), which needs no backfill.
  So the history rewrite the plan foresaw ("widen-seed-tighten") has nothing to move: #163 is the
  only widening, and the tightening (thread 9) comes last when the sprint resumes.
* Paste one recap from the new panel into a board preview: the 40-dash rule, blank lines inside
  `[quote]`, and an image inside a quote are untried there.

## Waiting for the Coach's word

* **Author BBCode can break the recap's frame** (#165): a `[/quote]` in a clueing, or `[/spoiler]`
  in an answer, passes through as typed and closes the quote or shows the answer. Landed as is
  (YOLO decision 10); the escape needs a board test. Thread 7 was to look at it.
* **`mdast-util-definitions`** (#162): fixes link definitions inside quotes and list items. A
  reviewer's install was refused by the session's permission check, so it was not routed to
  another agent. Say yes and it goes into thread 10.
* **`/code-review` checked out a commit in the main checkout** for 90 seconds (14:11:11 to
  14:12:42) while reviewing thread 5, then switched back. Status, branch and HEAD came back as they
  were. Later reviewers forbade the skill any checkout there, and it complied. The thread-reviewer
  definition may want that line permanently.
* **A dangling pointer:** `CLAUDE.md` and `notes/stack.md` cite
  `notes/decisions/2026-09-client-first.md`, which does not exist. The rule lives in
  `notes/stack.md` (*Application framework*) and `notes/decisions/20260928-database-decisions.md`.
  Nothing in this sprint changed client-first: no new route handler or server function.
* #166's second review comment did not post (GitHub answered 502/GraphQL errors); its text is in
  `recap-progress.md` under thread 6.

## Still to run, when the sprint resumes

Thread 7 (security review: the sprint's code, then the app), 8 (the out-of-sprint findings it is
certain of), 10 (the markdown dialect: `__text__` to `[u]` in LL outputs only, leading spaces as
quotes, the per-output quote rule), 9 (tighten #163's fields, last). Then the wrap-up. Resume with
`/sprint` pointed at the plan; the frontier is thread 7, cut from the spine's top.

YOLO decisions taken so far are the plan's list, 1 to 12.
