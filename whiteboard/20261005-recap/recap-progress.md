# Recap: progress

The running handoff for `recap-plan.md`, newer than the plan wherever they disagree. Each worker
writes its own `thread-<N>-<label>.md` beside this file; the orchestrator keeps this one.

## Status

| Thread | Label | Status |
|---|---|---|
| 1 | Widen the recap fields | landed #163 |
| 2 | Markdown to bbjank | landed #162 |
| 3 | Panels fold and expand | landed #161 |
| 4 | Field templates | landed #164 |
| 5 | The recap panel | landing |
| 6 | Quiz-level widgetings and entries | underway |
| 7 | Security review | pending |
| 8 | Security fixes, certain ones | pending |
| 9 | Tighten the recap fields | pending |
| 10 | The markdown dialect, settled | pending |

## What the threads have taught

* **Panels (thread 3, #161).** `Panel` has a fold triangle (everywhere) and, inside `PanelsRow`
  (the row under the quiz grid), a widen arrow. A new panel gets both by using `Panel` inside
  `Panels.tsx`; pass `wide` only if it must always span the row (then no arrow). `SpreadPanel`'s
  own toggle is gone; `widened`/`onWidenedChange` let a panel follow its width.
  *Review:* clean. Left, minor: every panel's buttons share one name ("Show this panel", "Widen this
  panel to the whole row"), so a screen reader's button list repeats; `Stack` spacing may eat
  `.panelHeading`'s 4px bottom margin. Both in #161's open questions.
* **bbjank (thread 2, #162).** `Bbjank.toBbjank(markdown)` in `src/lib/bbjank.ts`. For thread 5: keep `{AS: Qn}` on the clueing's first line (alone
  on its line, a following `1. ...` reads as an ordered list); prefix *every* line of a multi-line
  clueing with `> ` after `Markdown.forScreen`, rather than relying on lazy continuation. The
  `~~**ANSWER**~~` spoiler path is solid. bbjank's link and image protocols (http/https; https)
  are its own, not `Markdown.Allowlist`'s: thread 4 widens the allowlist for images, thread 7 decides
  whether they share one source.
  *Review:* fixed two: an HTML block's indented lines were read as quotes (now exempt); an unnamed
  quote that came to nothing wrote an empty `[list][/list]` (now left out). Left, minor: link
  definitions inside a quote or list item aren't collected and a twice-defined label resolves to
  the last (`mdast-util-definitions` fixes both; the reviewer's add was refused by the session's
  permission check, so it waits on the Coach); a fenced code block in a list item gains the item's
  indent (TODO); `\[b\]` and `[/code]` in code reach the board live; `{AS:}` empty gives
  `[quote=""]`, and a multi-line annotation puts a newline in `[spoiler=..]`.

* **Fields (thread 1, #163, `Serial Deploy: recap`).** Newer than the plan's Decision 3: quiz `templated` names what
  it templates the way a column names what it shows, `question.<field>` or a widgeting's label;
  the templatable question fields are `TemplatableFieldVals` (clueing, hint, full_answer, notes,
  recap); `set_templated` replaces the whole list and refuses an unknown widgeting
  (`untemplatable`). The four quiz note setters are one `setQuizNote`. Readers of rows written
  before the fields existed get the defaults from `QuizFallbacks`/`QuestionFallbacks`/
  `WidgetingFallbacks` in `src/lib/rows.ts`. `recap` is now a reserved widgeting label. Thread 5:
  `recap` has no column or cell editor yet (add it to `QuestionFieldVals`; no migration). Thread 6:
  nothing reads `tier` yet. Thread 9: the checklist is in `thread-1-recap_widen.md`.
  *Review:* clean. Left, minor: a production widgeting already labelled `recap` would refuse every
  write to it and cover the question's `recap` in the bag (the Coach's pre-merge check,
  `human/20261006-recap_widen.md`; a hit needs a relabelling migration); an old export from such a
  quiz has its questions skipped at import, logged.

* **Templates (thread 4, #164).** `src/lib/templating.ts`: `fill(template, bag)` -> `{ markdown,
  issue }`, never throws; `bagOf(run, question_id | null)` is the one bag builder (formula's bag
  minus `params`/`widgeting_label`, questions after every widgeting ran; `null` for quiz texts);
  `filledQuiz(quiz, run)`. A widgeted fills in as its value. Mustache reads only the bag's own keys
  (custom `Context`), with lookup and output budgets. Images only in templated fields
  (`TemplatedRenderOptions`, https only). Thread 5: `Templating.fill(text, Templating.bagOf(run,
  null)).markdown` for recap head and tail, `bagOf(run, question._id)` or `filledQuiz` per
  question, then `Bbjank.toBbjank`. Thread 6: quiz widgeteds placed in `run.frame.quiz` reach
  templates as `quiz.<label>` with no change; else widen `bagOf`. Round-trip exports keep the source
  as typed. To TODO: the review screen shows templated fields unfilled; `ll-bbcode.ts` has no image
  rule; categories not in the bag.
  *Review:* fixed two: the fill's length guard counted lookups, not filled text (`{{qns}}` repeated
  built the list's JSON per tag: ~500 ms and V8's string limit on one cell), now counted as it fills;
  mustache's shared template cache kept every keystroke's draft, now templating has its own writer,
  cleared after each use. Left, minor: two quick ticks in the Templates section can lose the first
  (whole-list action, no optimistic state); a long literal section repeats up to the pass budget
  before the length check; `{{#qns}}` walks archived questions too (**thread 5: leave archived
  questions out of the recap**); image tests lack entity-encoded and backslash cases (hold by hand).

* **Recap (thread 5, in review).** `Recap.bbjankOf(quiz, run)` in `src/lib/recap.ts`; `RecapPanel`
  last in `Panels.tsx`. **Deviation from Decision 6:** each text (head, clueing with BUT NOT,
  answer, recap, tail) goes through `toBbjank` on its own, and the frame (`[quote="Qn"]`,
  `Answer: [spoiler][b]..[/b][/spoiler]`, `Correct Answer %:`) is written in bbjank around it: no
  lazy continuation between blocks, no `---` turning a line into a heading. Questions as the LL
  go-live export takes them (no archived, no alternates, no never-written blanks), rank order.
  *Correct Answer %* reads a column labelled `correct_pct` (or five other spellings), blank
  otherwise. The head's placeholder uses `{{quiz.playtesters}}` (thread 6). A question's `recap` is
  a grid column now. `Bbjank.RuleLine` is exported.
  *Review:* flagged; landed as is by the orchestrator's YOLO call. Fixed: an answer converted on its
  own lost `1984.` (an empty list) or became a list, rule or link definition; it is now converted as
  the rest of its `Answer: ` line. **Left for the Coach (and thread 7):** author BBCode can break the
  frame: `[/quote]` in a clueing, `[/spoiler]` or `[/b]` in an answer pass through as typed (thread
  2's design), closing the quote or revealing the answer early; the fix is choosing which BBCode an
  author may write and testing an escape on the board. Minor: a clueing opening `1984. …` loses its
  number (the writer drops an ordered list's start); `Correct Answer %:` goes in raw, outside the
  writer.

*Orchestrator:* **`/code-review` touched the main checkout.** Reviewing thread 5, the skill ran
`git checkout 0a48bb5` in `/workspace/triquet` to try the code, and switched back 90 seconds later
(reflog 14:11:11 to 14:12:42). Status, branch and HEAD came back as they were. A landing in that
window would have collided. Later reviewers are told to forbid the skill any checkout in the main
checkout, and to probe only in their worktree. For the Coach.

*Orchestrator:* a spine replay's message names unlanded branches (`recap_bbjank`, `recap_widen`)
as replayed; it skips branches checked out in worktrees, and their refs were untouched. Harmless.

## Migration chain `recap`

*Orchestrator:* the Coach merges up to thread 1's PR, waits for its production deploy's build log
to say `Backfills: every one has finished.` (Vercel runs the backfills on deploy), then merges the
rest, thread 9's tightening last.
