# 2026-10-07: Sprint recap, done

The recap sprint turned simple markdown into the league's message-board BBCode (bbjank) and built
the Recap panel around it: an editable recap template, in pure mustache over markdown, with three
helpers (`quote`, `oneline`, `apart`) and a default that stands on the app's basic tools. Around it:
field templates with the sanitizer last, quiz-level widgetings that interleave with question ones,
panels that fold and widen, the markdown dialect written down, and a security review whose sprint
findings were fixed and whose certain app-wide ones were fixed after. The Coach shipped a recap note
mid-sprint. The plan is `whiteboard/20261005-recap/recap-plan.md`; the running record is
`recap-progress.md` beside it; each thread has its own `thread-<N>-<label>.md`.

## Pull requests, in the order they landed

Merged by the Coach on 2026-10-07, as one push (safe: no tightening existed then):

| PR | Thread | What | Stacked on |
|---|---|---|---|
| #161 | 3 | Panels fold; panels in the row widen | #159 |
| #162 | 2 | Markdown to bbjank | #161 |
| #163 | 1 | Recap fields widened, with backfills (Serial Deploy: recap) | #162 |
| #164 | 4 | Field templates, sanitizer last | #163 |
| #165 | 5 | The Recap panel | #164 |
| #166 | 6 | Quiz-level widgetings and entries | #165 |
| #167 | ad hoc | Old addresses not found, not a failed query | #166 |

Open, one stack, each on the one above:

| PR | Thread | What |
|---|---|---|
| #168 | ad hoc | Panels under the quiz start folded; recap box resize handle |
| #170 | ad hoc | The milestone spec waits for the branch switch |
| #171 | 14 | Editable recap template (`recap_template`, optional for good) |
| #172 | 15 | The template reads the question's own fields; OR ELSE |
| #173 | 16 | Default template on the app's basic tools, with a gap list (unreviewed) |
| #174 | 13 | Reviewers tell `/code-review` to change nothing in the main checkout |
| #175 | 17 | Template helpers; `longnote` (unreviewed) |
| #177 | 11 | Quiz and question widgetings interleave |
| #178 | 10 | The markdown dialect settled; bbjank verifier fixtures |
| #179 | 12 | Images in every field; categories and viz flags in the bag |
| #181 | 7 | Security review; its sprint fixes |
| #182 | 8 | Security fixes, the certain ones |
| #183 | 9 | The recap fields required again (tighten) |

**Merging:** merge #183 to take the lot. Before that, check production for widgetings labelled
`archived`, `secondary` or `questions` (#179); after it deploys, reload open tabs (#177). #183's
tightening is safe now: the Coach ran #163's backfills by hand and `outstanding` came back empty.

## Decisions taken in YOLO

The plan's list, 1 to 12: threads renumbered into running order; "widen-seed-tighten" read as
deploy.md's widen, backfill, tighten; the fields predicted up front; a template sees the formula's
bag; recap head and tail always templated; the recap's shape in code (later made editable, thread
14); thread 6 built small; security review in two threads; thread 5's frame written in bbjank around
each text; thread 5 landed with its frame-break finding open (the Coach later ruled it wontfix);
`mdast-util-definitions` held for the Coach (later approved, landed in thread 14); thread 6's pivot
kept unstored with an amended placement rule (later dropped altogether, thread 11).

## Open questions, in one place

* **Security, for the Coach** (`whiteboard/20261005-recap/security-findings.md`): O1 the ask route
  is an open, paid proxy (who may ask; rate limit); O2 `Actor.isAdmin` is true for everyone (who
  are the admins); O3 legacy idents first-come; O5 only partly closed (unlimited usernames per
  session); O8 a per-run formula budget; O9 image addresses; images in filled template values.
* **Embedding:** `X-Frame-Options: DENY` blocks embedding the app anywhere (#182).
* **Deploy:** production's deploy of #163 did not start its backfills (`after-vercel-build`); the
  Coach ran them by hand. Find why before the next migration relies on it (TODO).
* **Recap template:** ship the `in_order` column as a library widget? Keep or retire `played` and
  its shaped values in the recap bag?
* **Docs:** keep the new `notes/decisions/2026-09-client-first.md`, or drop it and repoint
  `CLAUDE.md` and `notes/stack.md`; dangling pointers to `2026-09-convex.md` and `2026-09-jazz.md`;
  `notes/database-decisions.md` duplicates `notes/decisions/20260928-database-decisions.md`;
  `CLAUDE.md` could name `notes/markdown.md`.
* **Markdown:** verse after a list item now joins the list (CommonMark); spoiler-like strikeout on
  screen is in TODO.
* **Reviewers:** try `EnterWorktree` to give reviewers a workspace of their own?
* **Flaky specs:** `reviews.spec.ts` › the smith's note folded to a line (a `useId` locator), and
  `addMember` timing out under parallel load, both in TODO.

## Incidents

* `/code-review` checked out a commit in the main checkout for 90 seconds (thread 5's review), then
  switched back; nothing lost. Fixed for good by thread 13 (#174).
* A worker read a file from git history that the Coach had moved into `aside/` (thread 10), and
  reported it. A worker stopped its own wait loop with `pkill -f` on a pattern rather than its PID
  (thread 10); only its own loop matched.
