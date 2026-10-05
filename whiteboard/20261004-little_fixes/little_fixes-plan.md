# Sprint `little_fixes`: the ident gate, the hunts page, and the quiz grid's lumps

**Date:** 2026-10-05. **Mode:** normal. **Review level:** medium. **Issued by:** flip, via
`/sprint`. **Status:** thread 5 landed (#110); thread 4 reviewed, landing next; thread 6 in review. Threads 1-3
done: 1 and 2 merged via #99, 1b merged as #105; 3 is #108, on the spine, open. **At once:** up to 3
threads (round two).

Three threads, stacked in order, all view work. The planning branch `20261005-little_fixes_start`
sits beneath thread 1, and beneath it the Coach's own unmerged `20261003-but_not_quiz` (quiz
content in `whiteboard/20261001-review/`) and `20261004-jwt_key_script` (#95): their commits ride
into thread 1's PR. This document and `little_fixes-progress.md` beside it are everything a thread
needs about the sprint; where they disagree, the progress document is newer.

The sprint directory was made by the Coach on 2026-10-04 and holds the reference screenshot:
`screenshots/quiz_table_lumpy.png` (the quiz grid, expanded, dark mode).

## Read first (every thread)

`CLAUDE.md` auto-loads, and with it `notes/views.md`, `notes/stack.md`, `notes/testing.md`.
Beyond those, before designing anything:

* `STYLE.md` and `notes/vocabulary.md` -- naming. "ident", "label", "title", "locked",
  "widget", "widgeted" and "stale" have meanings here; use them.
* `notes/views.md`'s tripwires and the MUI skills it names (`material-ui-styling` for `sx` vs
  theme vs CSS module; the grid already leans on `src/components/workbench.module.css`).
* Use the `run` skill (or `playwright-cli`) to see the change in the real app -- every thread
  here is visual, and "verify it sticks to one line" is a claim to check in a browser, at more
  than one width, in light and dark.

## Ground rules

`notes/git_hygiene.md` (*A thread, start to finish*) and `.claude/agents/thread-worker.md`
govern. Particular to this sprint:

* **MUI first, no new hand-rolled mechanism.** Alignment is a layout problem MUI owns (`Table`,
  `Grid`, `Stack`); responsive hiding is the theme's breakpoints (`sx` `display: { xs: 'none',
  md: ... }`), not a resize listener. Reach for an existing `use-settled-resize` only if a
  breakpoint truly cannot express it.
* **No schema change is expected.** If one appears, stop: it is a significant question.
* **Screenshots before and after** go in the sprint directory under `screenshots/`, named
  `threadN-<what>-{before,after}.png`, and are listed in the thread's progress section. They are
  the Coach's fastest review.
* e2e specs that assert on the text you change ("Continue", "You are ... now.", the status pills)
  will need updating -- that is mechanical, not a judgment call.

## The threads

### Thread 1: the ident gate (log in, and "Be someone else")

> when you do the "Be someone else" (and presumably also the original "login"): 1) disable
> "continue" until the box is valid; 2) make it say "Log in as <username>", updating as you
> type; 3) take "You are Mrflip (mrflip) now." and instead have a button in the conventional
> manner to cancel out; it should say "Keep being Mrflip (@mrflip)". That will take you back to
> the hunts page/

*Gloss.* `src/components/IdentGate.tsx` (77 lines; served at `/` by `src/app/(synced)/page.tsx`,
reached from `HuntsList`'s "Be someone else" link via `Routes.switchIdentPath()`). Today the
submit says "Continue" and the current ident shows as microcopy.

* "Valid" means what the server would accept as a username: reuse the ident label's existing
  validator (`src/models/` / `lib/vv/`), do not write a new regex. The field should say why it
  is invalid (MUI `TextField` `error`/`helperText`) once the user has typed, not on an empty
  first paint.
* "Log in as <username>": the label as typed (or as it will be normalized, if the model
  normalizes -- show what will actually be claimed). Empty or invalid: the button is disabled;
  pick a sensible resting text (e.g. "Log in") and record it.
* "Keep being <Title> (@<label>)": a secondary/text `Button` beside the primary, the
  conventional Cancel position (MUI `DialogActions`-style ordering: cancel left, primary
  right). Shown only when an ident is already held -- i.e. on the switch path; the first-login
  path has nothing to keep. It returns to the hunts page (`Routes.huntsPath()`), not to `then`,
  unless the worker finds `then` is the better answer and records why.
* `@label` is a new way of writing an ident. If one already exists elsewhere in the app, match
  it; if not, this is the first, and the progress section should say so (thread 2 may want it).

*Look-ahead.* Thread 2 restyles the hunts page the Cancel lands on; nothing here should depend
on its layout.

### Thread 1b: the ident gate, the Coach's follow-up

*Orchestrator:* added after threads 1 and 2 merged. The Coach, on #96's open questions:

> if I type in my own name again yes have it change to say "keep being".
> If it's not much extra code, I'd prefer that the length validation not scold me by turning red
> until blur; the button should remain disabled; but that entering an unacceptable character does
> turn the field red.

*Gloss.* `src/components/IdentGate.tsx` again, on `20261005-ident_gate_again` from main. On the
switch path, a typed label equal to the held ident's turns the primary into "Keep being <Title>
(@label)" (doing what the cancel does); the separate cancel button may then be redundant -- the
worker decides and records. Validation splits in two: a *shape* failure (an unacceptable
character) shows red at once; a *length* failure only after blur, the button disabled either way.
If the validator does not already tell the two apart, separating them belongs with the validator,
not in the view. The thread's review also covers thread 2's merged commits (#99), which merged
before it could be reviewed.

### Thread 2: the hunts page lines up

> on the hunts page: make the elements line up vertically, by using a table or as you judge. The
> quizzes will not be aligned, but add a larger space; also, add a "thinking face" sigil next to
> each unlocked quiz.

*Gloss.* `src/components/HuntsList.tsx` (156 lines). Columns of a hunt's row should share x
positions down the page (an MUI `Table`, or a CSS grid with fixed tracks; the worker judges and
records why). The quizzes listed per hunt are a ragged list by nature: keep them flowing, with
more space between them. The thinking face (🤔) marks a quiz that is **not locked** (vocabulary:
*locked* -- frozen against edits) -- i.e. still being worked on. It needs an accessible label or
a `title`, and it is a sigil, so it sits beside the quiz's name, not in its own column.

*Orchestrator:* thread 1 added `Ident.byline(ident)` (`src/models/ident.ts`), the app's first
"Title (@label)" form, and its "Keep being" button lands here. The hunts page's own line still
says "You are <title> (label)." -- switch it to `Ident.byline` so the two pages agree; that is a
one-line change in the file this thread is already restyling.

*Look-ahead.* Thread 3's widgets panel also wants "elements that line up" plus responsive
column-hiding. If thread 2 lands on a table/grid pattern that suits both, say so in the progress
section so thread 3 reuses the idiom rather than inventing a second.

### Thread 3: quiz mode -- the grid and the widgets panel

> Quiz mode thread:
> * Consult the screenshot in whiteboard/*little_fixes/*.png -- in the quiz view, the title and
>   label don't align vertically.
> * in collapsed mode, The but_not clue is chopped off and looks weird. The title and label are
>   forcing it to two lines, but nothing is using it.
>   - don't show the label when collapsed; verify it sticks to one line.
> * make the styling consistent and appropriate for columns whose type is string; and also for
>   number -- type string should not be monotyped, but type JSON should. I think currently some
>   fields are styled differently because they're widget outputs -- not necessary. However, don't
>   regress styling that signifies something else real: staleness, etc.
> * the collapse button in the header is currently bottom-weighted, so it sits atop the
>   batch-mode control. it should sit at the top of that cell, with the batch-mode at the botton.
> * vertically align the elements in the widgets table at the bottom. Make the status pills
>   (`(0 ok) (0 errored) (12 missing)`) instead be a plain sentence: `12 blank`,
>   `3 current • 2 stale • 1 errored • 6 blank`. Have it show the description, snippeted, when
>   collapsed. As screen size shrinks, hide the description, then label, then the status string.

*Gloss.* Five bullets, one thread; the worker may commit each as its own milestone.
Likely files: `QuestionTable.tsx` (header row: the fold and batch-mode controls),
`QuestionRow.tsx` (the title/label cell, the collapsed row height), `cells/readouts.tsx` and
`cells/fields.tsx` (how a column's value is typeset by its type, widget output or not),
`workbench.module.css`, `panels/WidgetsPanel.tsx` (104 lines; the pills and the fold).

1. **Title/label alignment.** In the screenshot the title ("Quaternions") sits a few px right
   of its label ("graffitist") and of the other cells' baselines. Find the padding mismatch;
   fix it at its source, not with a nudge.
2. **Collapsed rows are one line.** Collapsed, the title cell drops its label, and every cell in
   the row is one line, ellipsized. "But not" in the screenshot shows a second line clipped
   through its middle -- that cell must ellipsize, not clip. Verify at narrow and wide widths.
3. **Typeset by column type, not by provenance.** string -> the body face; number -> the body
   face, tabular figures, right-aligned or as the grid already does numbers (record the choice);
   JSON -> monospace. A widget's output column takes its declared type's styling. Keep what
   carries meaning: stale, errored, missing/blank, locked, read-only. Inventory what each
   existing style means before deleting one, and list the inventory in the progress section.
   (Title and "But not" are monospace in the screenshot; Title is a string.)
4. **Header corner cell.** The fold toggle at the top of the cell, batch-mode at the bottom
   (`Stack` with `justifyContent: 'space-between'`, or the CSS grid equivalent).
5. **The widgets panel.** Rows align in columns; the pills become one plain sentence, zero
   counts omitted, joined by " • ", using **current / stale / errored / blank** (note: "ok"
   becomes "current" and "missing" becomes "blank" -- check `notes/vocabulary.md` and
   `widget-words.ts`, and if the words are defined there, update the vocabulary with them;
   if they clash with an existing meaning, that is a question for the Coach). Collapsed, a row
   shows the widget's description, truncated to one line. Shrinking, hide in order: description
   first, then label, then the status sentence (theme breakpoints).

*Look-ahead.* Last thread; nothing downstream.

*Orchestrator:* thread 2 settled the idiom for bullet 5 -- read its *Discoveries -- for thread 3*
in the progress document: keep the widgets panel's Accordion, line the summary up with
fixed-width boxes as `ColumnsEditor`'s rows do, and hide by container query (`RoomFor`,
`hiddenUntil`), not a Table. Its three `sx` traps apply to the grid too. The sprint runs in a
worktree: work in it, run `git status` before any path-naming checkout or restore.

## Round two (Coach, 2026-10-05, after the first round's PRs)

*Orchestrator:* the Coach's answers to round one's open questions, and two threads from them.
Settled without a thread: a hunt cannot lack quizzes, so the narrow hunts page's empty row cannot
happen (drop it); `statusLine` unused is noted, not to be investigated now.

*Orchestrator:* the spine stack merged; main's `notes/git_hygiene.md`, CLAUDE.md and the agent
definitions now govern, superseding round one's ground rules. Each round-two worker writes its
section to `thread-<N>-<label>.md` beside this plan, never to the progress document (which is now
the orchestrator's alone), and reports `ready` when built; it lands only when told.

**Under the spine rules.** Every thread starts with `pnpm worktree <label>`
(its own worktree and lane, cut from the spine's top), works from that root with `cd <root> && `
on every command, finishes with `pnpm land`, then files its PR and `pnpm worktree --remove`.
Workers read `notes/git_hygiene.md` and CLAUDE.md *as merged*, and `.claude/agents/thread-worker.md`
as it now stands; they supersede this plan's older ground rules wherever they differ.
**Dependencies:** thread 4 depends on nothing (#105 is merged); thread 5 builds on thread 3's grid
typesetting, which is on the spine (#108), so it depends on nothing unlanded either. They touch
different corners (the gate and `MembersPanel` vs. `ColumnsEditor`, the column model and the grid's
cells), so they run side by side.

### Thread 4: the name field is the title; the label beside it follows until edited

> When people are entering their name, let them type anything they want (becoming the title), but
> show the label form to the right. If they click to edit the label, show red if it doesn't fit
> label standards. If they make a change to the label, it stops auto-updating. if they clear the
> field, it resets to auto-updating. After this, the label is decoupled from the titile whether
> they edited it or not.
>
> change 6 letters and numbers to 6 characters
>
> [reuse `Ident.flawIn` in MembersPanel:] yes for reusing, unless my behavior above makes it not
> make sens

*Gloss.* `src/components/IdentGate.tsx` again (on top of #105's version). Two fields side by side:
**name** (free text, any characters, becomes the ident's title) and **label**, which shows
`Ident.labelFor(name)` and follows the name as it is typed -- until the label field itself is
changed, when it stops following; emptying the label field makes it follow again. The label field
is red when it does not meet the label standard (`IdentValidators.identLabel`), shown once the user
is editing it; the auto-derived label always fits. The submit says "Log in as <label>" and sends
both (`assume_ident` already takes `label` and `title` separately: no server change expected). The
1b behaviours carry over, keyed on the label: your own label turns the primary into "Keep being".
"After this, decoupled": once the ident exists, retitling never relabels -- check that is already
so, and say so. This retires 1b's typed-text shape check (`PA.Identtyped`, `Ident.flawIn`'s
`'shape'`) if nothing else needs it -- the name field takes anything now; remove what becomes dead
rather than leave it. `AppNotices.usernameLength`: "6 characters", not "6 letters and numbers".
`MembersPanel`'s add-member field takes a label, not a name: give it the label field's check (the
same function the gate's label field uses), at the same moment the gate shows red.

### Thread 5: the column editor sets each column's alignment

> Add the standard left-justified editor sigil to the column editor. Each click toggles to the
> next one. start Q# centered

*Gloss.* In `src/components/ColumnsEditor.tsx`, each column row gets the familiar
text-alignment icon (MUI's `FormatAlignLeft` / `FormatAlignCenter` / `FormatAlignRight`, left
justified in its row); a click cycles left -> center -> right -> left, and the grid's cells and
header follow it. It is stored on the column row beside `width_px`: an **optional** field
(`align`) is a widen, so no backfill and no migration (`notes/deploy.md`, *Schema pushes* -- the
worker confirms). Absent means the default by kind: numbers right (thread 3's rule), everything
else left, **Q# centered**. Whether a fresh column writes its default or leaves the field absent
is the worker's call, recorded. Thread 3's open question (Q# right-aligned under a left header)
is answered by this: Q# starts centered, header with it.


### Thread 6: reviews and the spine, in worktrees

> improve the guidance for the sprint plan to account for the worktree issue

*Orchestrator:* added mid-round. The worktree issue: `/code-review` runs in the main checkout, not
the reviewer's worktree (thread 5's review), plus two spine traps this sprint met (`fetch.prune`
unset; the sweep trim bug). Guidance in `.claude/agents/thread-reviewer.md` and the sprint skill;
the worker added `restack`'s `--prune` in `scripts/spine.ts`, with a test, so it is reviewed.
Until it lands, reviewers in this sprint review by hand and never pass `--fix`.

## For the Coach

* **What the sprint stands on.** You invoked it from `20261003-but_not_quiz` (quiz-writing
  commits under `whiteboard/20261001-review/`, no PR), itself on `20261004-jwt_key_script`
  (#95). Thread 1's PR will therefore carry the quiz commits and be stacked on #95. If you would
  rather the sprint stood on main, say so before thread 1 lands and the stack can be replayed.
* **Vocabulary**: thread 3 renames the widget statuses in the UI (ok -> current, missing ->
  blank). The worker will check these against `notes/vocabulary.md`.
