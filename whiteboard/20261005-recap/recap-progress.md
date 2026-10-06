# Recap: progress

The running handoff for `recap-plan.md`, newer than the plan wherever they disagree. Each worker
writes its own `thread-<N>-<label>.md` beside this file; the orchestrator keeps this one.

## Status

| Thread | Label | Status |
|---|---|---|
| 1 | Widen the recap fields | in review |
| 2 | Markdown to bbjank | landed #162 |
| 3 | Panels fold and expand | landed #161 |
| 4 | Field templates | pending |
| 5 | The recap panel | pending |
| 6 | Quiz-level widgetings and entries | pending |
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

* **Fields (thread 1, in review).** Newer than the plan's Decision 3: quiz `templated` names what
  it templates the way a column names what it shows, `question.<field>` or a widgeting's label;
  the templatable question fields are `TemplatableFieldVals` (clueing, hint, full_answer, notes,
  recap); `set_templated` replaces the whole list and refuses an unknown widgeting
  (`untemplatable`). The four quiz note setters are one `setQuizNote`. Readers of rows written
  before the fields existed get the defaults from `QuizFallbacks`/`QuestionFallbacks`/
  `WidgetingFallbacks` in `src/lib/rows.ts`. `recap` is now a reserved widgeting label. Thread 5:
  `recap` has no column or cell editor yet (add it to `QuestionFieldVals`; no migration). Thread 6:
  nothing reads `tier` yet. Thread 9: the checklist is in `thread-1-recap_widen.md`.

*Orchestrator:* a spine replay's message names unlanded branches (`recap_bbjank`, `recap_widen`)
as replayed; it skips branches checked out in worktrees, and their refs were untouched. Harmless.

## Migration chain `recap`

*Orchestrator:* the Coach merges up to thread 1's PR, waits for its production deploy's build log
to say `Backfills: every one has finished.` (Vercel runs the backfills on deploy), then merges the
rest, thread 9's tightening last.
