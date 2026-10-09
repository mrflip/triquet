# Columnwise: columns lead, entries gain families, a column gains an expression

Sprint plan, 2026-10-08. Mode: **YOLO** from 2026-10-09 (normal before). Review level: **medium**. At most **3** threads at once.
Issued by the Coach (Flip): `preplan.md`, beside this file, with the invocation "normal mode"; switched to YOLO on 2026-10-09 ("make good decisions, we'll fix them up later").
**Status: threads 1, 4, 3a, 2 merged (#191-#193, #196); 3b, 6, 5a, 8, 7, 5b, 9 landed (#197-#202, #206); 3c underway; then a full e2e run; then 10 and 11.** `columnwise-progress.md`, beside this file, is newer than this plan wherever
the two disagree.

**The ask** (the preplan's words): adding a column a person can type into is nine clicks through
three nested dialogs, one of them admin-only. The author's intent is a spreadsheet's "add a
column": the column should lead, and the library and the run order should become the advanced
views they are for most authors. Along the way, entries gain the expressive power of a validator
without the library filling with one-offs, and a column gains a small expression so a rounded or
upcased value does not need a widgeting of its own.

## Read first

Beyond CLAUDE.md and its auto-loads (`notes/stack.md`, `notes/testing.md`, `notes/convex.md`,
`notes/views.md`):

* **`preplan.md`, beside this file, whole.** It is the Coach's design, settled in chat: *The
  shape* (§1-§6), *Reserved words*, *Schema*. Every "ruled" in it is a ruling, not a suggestion.
  Where it contradicts itself, the later ruling wins: the column's `template` is **Liquid**, not
  mustache (its line 514 is superseded by "no mustache anywhere").
* **Thread 1's decision record** once it lands (the code threads start after it): the preplan made
  durable, and the reserved-word lists.
* `notes/vocabulary.md` (*Columns and the bag*, *Widgets*) and `STYLE.md`, before naming anything.
* `notes/decisions/2026-10-widgets.md`: the widgets design this sprint revises.
* `notes/deploy.md`, *Schema pushes* and *Serial Deploy*, before threads 2, 3a and 3c, or any
  thread that finds it must change a row's shape.
* `whiteboard/20261005-recap/recap-progress.md`, for the quiz tier (`Widgeting.runsAt`,
  `quiz_widgeteds`, the Quiz entries panel) and templating (`lib/templating.ts`, LiquidJS).
* The code as it stands: `src/lib/formulary/` (`entry.ts`, `runner.ts`, the formulary interface),
  `src/models/widget.ts`, `widgeting.ts`, `column.ts`, `quiz.ts`, `seeds.ts`, `layout.ts`;
  `src/lib/vv/patterns.ts` (the reserved words); `src/lib/widgeting-edit.ts`; `src/lib/columns.ts`
  and `src/lib/sheets.ts` (`specsFor`); `src/lib/formulas.ts` (the one `jsonata` importer) and
  `src/lib/templating.ts` (the one Liquid importer); `src/components/QuizManageModal.tsx`,
  `ColumnsEditor.tsx`, `WidgetingsEditor.tsx`, `TemplatedEditor.tsx`, `ConfirmRemove.tsx`,
  `PreviewPicker.tsx`, `use-preview-bag.ts`, `use-folds.ts`, `FoldButton.tsx`,
  `panels/WidgetsPanel.tsx`, `panels/QuizEntriesPanel.tsx`.

## Ground rules

`notes/git_hygiene.md` (*The spine*, *A thread, start to finish*, *Sprints*) and
`.claude/agents/thread-worker.md`. Particular to this sprint:

* **Normal mode.** A question whose answer would change what a thread builds is a `blocked`, not a
  judgment call: bring the thread to a committed stopping point and report it. The preplan
  settled a great deal; read it before deciding a question is open.
* **One migration chain, `columnwise`.** Thread 3a widens every field whose rows would not fit,
  with its backfills, and its PR title ends `(Serial Deploy: columnwise)`. Thread 3c tightens,
  last of all, its body saying `Tightens Serial Deploy: columnwise`. Additive changes every row
  already fits (`EntryKindVals` widened, an optional `config` field on a widget, an Absentable
  field) need no chain, but the thread says so in its report. A thread that finds it must widen
  with a backfill does it in commits of its own, titled for the same chain, and blocks first:
  that is a change of plan.
* **One engine per job, one importer each.** JSONata only through `lib/formulas.ts`
  (`Formulas.evaluate`, its timebox and depth guard); Liquid only through `lib/templating.ts`.
  No mustache anywhere new. The prompts' move from mustache to Liquid is **another container's**:
  leave `src/lib/ask/prompts.ts` alone.
* **The two words.** A *templateable* source (the quiz's nomination, `quizzes.templateable` once
  3a lands) is one whose stored text is itself a template, filled at the end over the finished
  bag. A column's *template* is how one column draws a value, and touches no stored text. Keep
  them apart in names, docs and UI copy.
* **The regularity rule** (ruled): a worker who finds a builtin field (categories, say) making
  extra code appear writes "let any schematized output do what builtin X does" and makes X
  regular, never a workaround so X behaves like a schematized output.
* **No bare `new RegExp` over author text**, ever: named patterns only until thread 6 answers
  ReDoS.
* **Every field validator produces its own sentence** (§6, the commit model): no field relies on
  a dialog's Apply to report what is wrong.
* **New input kinds are generic facilities** (the Coach, 2026-10-08): "This sprint will likely
  make some new input kinds, like regex or whatnot. make those generic facilities. Make sure also
  to weigh libraries for them." A regex field (6), an options-list field (2's enum, `EntryParamsFields`),
  a template or formula field (3b, 7), a params editor (5a): each is a field component any form can
  use, not a one-off inside its first caller, and library-first applies before writing one (an MUI
  component, then a widely used library such as `react-number-format` was; record what was weighed
  in the thread file).
* **Reserved words take an allowlist** (the Coach, 2026-10-08): the reserved check accepts an
  optional allowlist `Set` that forces a word allowed, so a family's own params keys (`min`, `max`,
  `integer`) pass the full check rather than escaping it. Thread 2 builds it. `Labelmaker` is moving
  to a `Set` outside this sprint: build on what is there, and do not rewrite it ahead of that.
* **Hard things go to `whiteboard/TODO.md`**, under `## From columnwise sprint, thread N: ...`,
  and into the report.
* **Proving.** `pnpm e2e --touched` or more; the orchestrator asks for a full run on 3a and 3c
  (Convex and a migration), on any thread that bumps a dependency or changes config, and on every
  fourth landing. A new spec file needs one `@smoke` test and a `SpecCorners` entry in
  `scripts/spine.ts`.

## Threads

Thread 1 first, alone. Then 2, 3a and 4 side by side. Then 3b (after 3a) and 7 (after 2 and 3a);
6 (after 2); 5a (after 2, 3b, 4); 5b (after 5a); 8 (after 3b); 9 (after 7); 3c after them all.
Then a full e2e run, and then 10 and 11 side by side (added 2026-10-09), with the sprint-end
full e2e run after both.

```
1 ─┬─ 2 ──┬──────────── 6 (optional)
   │      ├──── 7 ◄─ 3a
   ├─ 3a ─┴─ 3b ─┬─ 8 (optional)
   │             └─ 5a ◄─ 2, 4 ── 5b
   └─ 4 ────────────┘
                              3c: after everything
```

The preplan's thread numbers are kept; 3 and 5 are split.

### 1. Design note and vocabulary

*Coach's text:* "**Design note and vocabulary.** A decision record under `notes/decisions/` (or an
addendum to `2026-10-widgets.md`) with: entries first and why it holds only without a formula; the
family on the widget, the constraints in `params`, and `paramsOf`; the column expression and its
three rules; the uniform source menu and the end of parts in the column grammar; folding, with the
widget behind its door; the removal chain as one rule; the commit model and its exception.
`notes/vocabulary.md` updated (*Columns and the bag*, *Widgets*). Docs only; the Coach reads it
before code moves."

Gloss: a new `notes/decisions/20261008-columnwise.md` (dated, as `20260928-database-decisions.md`)
is cleaner than an addendum, and `2026-10-widgets.md` gains a pointer where it is superseded (its
*reserved pattern* claim about `forced_label`, its parts grammar). Beyond the Coach's list, the
record also carries what the preplan ruled since: **the reserved-word lists** (*Reserved words*,
written out as groups, so thread 2 lands them and 3c adds `categories`); **the `liquidize`
formulary** (§2b); **the render pipeline** in order (the run with `liquidize` steps; templateable
sources filled over the finished bag; the column's ref; its formula; its template; its readout;
markdown and the sanitizer), with the two warnings (the nomination fills at the end, never in run
order; a nominated or liquidized `aibot` runs model output as a template); **the ref grammar**
(one plain key, `qn` first then the bag's top level; `quiz.<label>` the one dotted form); the
`templateable`/`template` distinction; the importer's promise ("an export is a promise").
`notes/vocabulary.md`: *family*, *params*, a column's *ref*, *formula*, *template*, *readout*,
*collapsed*, *templateable*, *liquidize*, and the removal rule flipped. A line in
`notes/security.md` for model output run as a template. Depends on: nothing. **Look-ahead:** every
later worker reads this record before the preplan; write it for them, terse and normative, and
name the thread that builds each piece.

### 2. Entry families

*Coach's text:* "**Entry families.** `boolean` and `enum` kinds and their cells; per-family params
validators and `paramsOf` on the formulary interface; the server and the planner checking params
against the widget's family; `valueOf(widget, widgeting)`; number and text params driving the
existing fields; named patterns (`label`, `oneline`, `url`); default params on the widget;
`Widgeting.runsAt` per family and the new cells in the Quiz entries panel; entries of either tier
first in the runner and at the head of the run-order list; the reserved words landed, with the
integrity check. Seeds for the new families. Tests beside `tests/lib/formulary/entry.test.ts`,
`tests/models/widget.test.ts`; `e2e/entries.spec.ts`."

Gloss: `src/models/widget.ts` (family params as small Zod objects beside `entryConfig`; `config`
gains the family's default params, optional), `src/lib/formulary/` (the interface gains
`paramsOf(widget)`; `entry` returns the family's, `jsonata`/`aibot` the open record they have),
`convex/` (`addWidgeting` and the widgeting patch check params; `widgetForLabel` is already
fetched), `src/lib/widgeting-edit.ts`, the cells (`src/components/cells/`: a checkbox and a select
beside `NumberField`/`PlainField`/`StretchField`), `QuizEntriesPanel.tsx`, `runner.ts` (entries of
both tiers first), the run-order list (entries at its head, not draggable), `src/lib/vv/patterns.ts`
and `src/models/quiz.ts` (the reserved words and the integrity check). `labelish` and `titleish`
are presets of `text`: not offered for new widgets, still valid on rows. Additive to the schema
(`EntryKindVals` widened; optional `config` fields): no chain. Depends on: 1. **Look-ahead:**
**`categories` is not reserved here**: it is the seeded widget's label until 3a renames it, and
3c reserves it. `paramsOf` is reused by thread 7 (`liquidize`'s `template`/`template_from`) and
thread 6 (a free `regex`): make the validator the one source a generic params editor can be
drawn from, since thread 5a's folded line *is* a family's params. The new cells are reused by
5b's row preview and by 3b's editability rule (an entry cell is editable only while the column's
formula is identity and it has no template). 3a renames the `categories` seed in
`src/models/seeds.ts` beside your new seeds: expect a mechanical conflict there.

### 3a. Columns widen: the plain-key source (Serial Deploy: columnwise)

*Coach's text (thread 3, whole; 3a, 3b and 3c share it):* "**The column expression and the
plain-key source.** The migration series (*Schema*): the `category_data` rename, the
`templateable` rename, then the `columns` and `templateable` grammar, in a PR of its own with its
ledger rows; optional `formula`, `template` (Liquid over the template bag with `value`),
`readout` and `collapsed`, with the double-click on the head; evaluation on `ok` only through
`Formulas.evaluate`; identity skips; the entry-cell editability rule; the sheet and the sorts
following; the source menu over the bag's words; field-name lists where a schema is known,
"other" elsewhere; parts as expression presets; the import's reading of the old grammar. Tests
beside `tests/lib/columns.test.ts`, `tests/models/column.test.ts`, `tests/lib/importing.test.ts`;
`e2e/grid.spec.ts`, `e2e/sheets.spec.ts`, `e2e/importing.spec.ts`."

*Orchestrator:* thread 3 is split, since a migration ships as widen, backfill and tighten in
separate pull requests (`notes/deploy.md`), and the Coach merges up to the widening and waits for
its deploy. **3a is the widening, and everything the backfilled rows need in order to be read
right**: 3b builds the authoring on top; 3c tightens last.

Gloss, 3a: the preplan's *Schema* steps, as one chain, on the model of the ledger's
`20261006-recap_widen`:
* **Widen**: `columns.source` accepts both grammars; `formula`, `template`, `readout` and
  `collapsed` arrive on the column row (Absentable, optional for good, absence meaning identity /
  the default readout / not collapsed, unless the worker finds a reason to backfill them; record
  which); `quizzes.templateable` arrives beside `templated`.
* **Backfills**, in order: `categories` -> `category_data` (the widget's `label`; each widgeting's
  `widget_label`; each widgeting `label` `categories` or `categories_<n>`; each column `source` and
  each quiz's nomination naming one); the source grammar (`question.<x>` -> `<x>`;
  `<w>.<part>` -> `<w>` with `formula: '$.<part>'`; a plain label left); `templated` copied to
  `templateable` in the plain form. `convex/migrations.ts`, `Backfills`, `Backfilling` in
  `tests/convex/schema.test.ts`. Rehearse on `scripts/convex_dev agent`, never production.
* **Readers cope with both**: a column resolves a plain key (`qn` first, then the bag's top
  level; `quiz.<label>`) and still the old grammar until 3c; a present `formula` is evaluated on
  `ok` only, through `Formulas.evaluate`, missing and errored passing through, identity skipping
  evaluation. Through `specsFor`, so the grid, the sheet and the sorts follow at once. Without
  this, a backfilled `category_data` + `$.masie` column would show the whole widgeted.
* **Writers write the new**: the seed and default widgeting label become `category_data`; new
  columns and nominations are written plain; the `templated` -> `templateable` rename in the
  action (`set_templateable`), `TemplatedEditor.tsx` and the vocabulary; the export writes the
  plain form; the **import reads the old grammar for good** (translating as the backfill does),
  named in the code as "the grammar before October 2026" so the TODO's someday scan finds it.
* **A checklist for 3c** in the thread file: every field, validator and fallback to tighten.

PR title ends `(Serial Deploy: columnwise)`. Full e2e run. Depends on: 1. **Look-ahead:** 3b
builds the UI over what 3a reads; 7 shares the templateable fill's path, so leave that fill as
one function (`Templating.fill` over the finished bag); 3c removes the old grammar from
`QuestionWidgetLabel`, `WidgetingPartVals` (from the column grammar; `Estimates` keeps its own
list of parts) and the readers.

### 3b. The column expression: authoring, template, readout, collapse

*Coach's text:* as 3a's.

Gloss: on 3a's rows: the source menu over the bag's words (every question field, every
widgeting's output, `quiz`, the `quiz.<label>`s, `hunt`, `realm`, `categories`, `qns`) with the
formula beside it; field-name lists where a schema is known (question, quiz, an estimates entry's
parts), "other" with the expression elsewhere; the parts as expression presets (`$.masie`);
`template` (Liquid through `lib/templating.ts`, over the question's template bag with the
expressed value as `value`, own keys only, budgeted) and `readout` (`plain`, `markdown`, `code`,
`label`, defaulting as the cells choose today); `collapsed`, a double-click on the head toggling
it, drawn with the turned header (`headkind: 'vertical'`) and empty cells, the width kept for the
return, the sheet unchanged by it; the entry-cell editability rule (editable only while the
formula is identity and there is no template; the pills likewise). Builds in `ColumnsEditor.tsx`
and the grid's head; thread 5a then moves the column row into its folding editor, so build the
fields as components it can lift, not as dialog state. Depends on: 3a. **Look-ahead:** 5a and 5b
reuse the column's fields (5b's row preview draws from `specsFor`, so every stage must live there);
8 turns seeded sums into formula presets.

### 4. Removal and commit model

*Coach's text:* "**Removal and commit model.** `delete_widgeting` refuses while a column shows it,
server and client, with the sentence; the manage dialog's *Relabel* and *Done*. Small; parallel to
2 and 3."

Gloss: `convex/` (`delete_widgeting` refuses instead of cascading to columns; a quiz's deletion
still cascades), the client's check through the column model's resolve (it must recognize a
column showing the widgeting in **both** grammars, since 3a may land before or after it),
`ConfirmRemove`'s `refusal` prop carrying the sentence, `QuizManageModal.tsx` (Apply becomes a
*Relabel* button beside the quiz label, Cancel becomes *Done*), the vocabulary's removal line if
thread 1 left it to the code. Depends on: 1. **Look-ahead:** 5a retires the column and widgeting
dialogs, so put no new work into their Apply batching; the commit-as-you-go rule is what 5a builds
everywhere.

### 5a. Folding editors, columns leading

*Coach's text (thread 5, whole; 5a and 5b share it):* "**Folding editors.** The column row
leading, with its widgeting's folded line beneath and the full panel below that; the formulary's
folded fields; the widgeting panel listing its columns' foldables; the run-order sorter in the
*Widgets* panel below the grid, entries at its head, and the manage dialog's *Widgetings* section
gone; *+ New column…* making an entry widgeting and its column in one go
(`src/lib/widgeting-edit.ts`); the column and widgeting dialogs retired, the tier marks kept on the
run-order rows; the one-question row preview in the column editor. `e2e/widgets.spec.ts`,
`e2e/entries.spec.ts`, `e2e/panels.spec.ts`."

*Orchestrator:* split in two for review's sake: 5a is the editor, 5b the run order's two homes and
the preview.

Gloss, 5a: the folded fields as a formulary fact beside `refresh` and `store` (an entry's family
params, a `jsonata` formula line, nothing for `aibot`); one widgeting panel component whose folded
state is its first row and whose open state is the same fields with more rows (`use-folds` keeps
the fold per key); the column row leading in `ColumnsEditor.tsx`, its widgeting's folded line on a
second row beneath it (container queries, `RoomFor`), unfolding into the full panel; the widgeting
panel listing its columns' foldables; *+ New column…* gaining "a new entry…" (any smith) and, for
an admin, "a new widget…", pairing widgeting and column (`planWidgetingEdit`); the column and
widgeting dialogs retired, every field committing as it is made. The widget editor stays behind
its door, untouched, as does the library modal and the toolbar's door. Depends on: 2, 3b, 4.
*Orchestrator, from thread 2:* ~~the params editor~~ is pulled forward: `EntryParamsFields`, one
component whose fields each commit as they are left, sits in the widgeting dialog and the widget
editor; 5a lifts it into the folded line rather than building it.
*Orchestrator, from thread 4:* reuse `columnsShowing` for the widgeting panel's columns; and take
thread 4's two review leftovers: a typed but unconfirmed label is dropped silently (mark it
unsaved), and the quiz label draft goes stale if the quiz is relabelled elsewhere while open.
**Look-ahead:** 5b puts this same panel component as the *Widgets* panel's open state.

### 5b. The run order in both places, and the row preview

*Coach's text:* as 5a's.

Gloss: the *Widgets* panel below the grid (`panels/WidgetsPanel.tsx`) gains drag handles, entries
at its head not draggable, its open state 5a's widgeting panel (so a columnless widgeting is
edited there); the manage dialog's *Widgetings* section becomes a *Run order* section, the drag
list alone, tier marks kept; both dispatch `move_widgeting`. The one-question row preview in the
column editor: a pulldown of the quiz's question labels (through `use-preview-bag`'s picker, quiz
select dropped), beneath it that question's `QuestionRow` drawn from `specsFor` and the quiz's run,
read-only, grip, checkbox and ask handlers off. Depends on: 5a.
*Orchestrator, from thread 6's review:* the preview draws from **stored** params only, never a
draft's: a draft `regex` has not passed recheck. *From 5a:* *+ New widgeting…* and *+ New quiz
widgeting…* (an inline catalogue now) need a home when the section becomes *Run order*.

### 6. Free regex patterns (optional)

*Coach's text:* "**Free regex patterns.** A `regex` named pattern taking author text, with its
ReDoS answer (a checker library from `notes/stack.md`'s process, or a timebox), in a thread of its
own after 2. Optional this sprint."

Gloss: a `text` family param beside the named patterns; the ReDoS answer by library first
(`notes/stack.md`'s process: a checker such as `recheck` or `safe-regex2`, or an engine without
backtracking such as `re2js`), evaluated on both the server and the client wherever a pattern is
checked. A new dependency: full e2e run; a library `notes/stack.md` marks *Discuss* is a
`blocked`. Depends on: 2.

*The Coach, 2026-10-08:* "for regexes I want to be able to hand them to zod. The chief risk is
someone footgunning themselves. Let's apply recheck, if there is ever an incident we can look
again at tradeoffs." *Orchestrator's reading:* `recheck` (npm, 4.5.0, about 5.8 MB unpacked: a
pure-JS build, a JVM jar and native binaries as optional dependencies, and `synckit` for
`checkSync`) checks the **pattern** where it is written: at the params entrypoints (`addWidgeting`,
`editWidgeting`, the planner, an import, a widget's default params), on commit (blur), never per
keystroke. A pattern recheck calls `safe` is stored; past that boundary it is trusted, compiled
once and handed to Zod (`z.string().regex(...)`) to check typed cells. Refuse, with a sentence:
`vulnerable`, **`unknown`** (a timeout or an unsupported feature: strict, as footgun-proofing
asks), and a pattern `new RegExp` will not compile. Cap the pattern's length; a fixed set of
flags. **The server's check is the authority**; the browser's is a courtesy and may load recheck
lazily. **Prove first** that recheck runs in Convex's default runtime (a V8 isolate, no worker
threads, no native binaries: likely its `pure` backend, `RECHECK_BACKEND=pure`, async `check`) within
a mutation's time limit, with recheck's own `timeout` well under it. If it will not run there, the
check would have to move to a Node action, which breaks "validate in the mutation": that is a
`blocked`. Add recheck to `notes/stack.md` (**Use**, the Coach's ruling) and a line to
`notes/security.md`.

### 7. The `liquidize` formulary

*Coach's text:* "**The `liquidize` formulary.** The class in `src/lib/formulary/liquidize.ts`,
its config and params validators, its arms in the runner, the advice, the widget editor and the
Widgets panel, a seeded `liquidize` widget, and the templateable nomination's fill sharing its
path. After 2 (params families and `paramsOf`); parallel to 3, 4 and 5."

Gloss: the preplan's §2b. A `jsonata` widget's twin with Liquid: refresh `live`, stores nothing,
runs at either tier, `input_formula` `$` by default and the template rendered over what the input
came to; the template from the widget's `formula` (a static default), or the widgeting's params
(`template`, or `template_from: { ref, formula }` read from the bag, `ref` in the column's
grammar); output always a string, markdown by convention, empty as `missing`, unparsable as
`errored` with Liquid's sentence. One fill path through `Templating.fill` with the templateable
nomination. `notes/security.md` gains the line for model output run as a template, if thread 1 did
not write it. **Depends on: 2 and 3a** (the preplan says "after 2"; it also shares the
templateable fill, which 3a renames, and its `template_from.ref` is the plain-key grammar 3a
introduces). **Look-ahead:** the recap template as a quiz-tier `liquidize` is later, not now
(write it to TODO).

### 8. Seeds pass (optional)

*Coach's text:* "**Seeds pass (optional).** With a column able to reshape one value, the seeded
sums that only reshape one widgeted (`clueing_full`, `clueing_numeral`, `hint_full`,
`hint_numeral`) can be expression presets; those reading two things or another question
(`butnot_*`, `clueing_plus_*`) stay widgetings. Existing quizzes that work them are untouched
either way."

Gloss: `src/models/seeds.ts` and the column menu's presets (3b). No row rewrite. Depends on: 3b.

### 9. Compute budgets (added 2026-10-09)

*The Coach, ruling on thread 7's second review:* "Land 7, new budgets thread": a thread of its own,
before 3c, for the time bounds the reviews found.

Gloss: every place an author's template or formula (or a model's reply read as one) is worked,
bounded on a clock that moves inside a Convex mutation (`performance.now()`; `Date.now()` stands
still there: `thread-7-budgets.md`), in the browser's run and the server's (`sortQuestions`):
* **S1**: refuse LiquidJS's `*_exp` filters (`where_exp`, `reject_exp`, `group_by_exp`, `has_exp`,
  `find_exp`, `find_index_exp`) in `Liquidry`, as `include` is refused, and cap ranges and
  allocation well below `memoryLimit`'s 10M (near `FillBudget`); measured: a 99-character
  `where_exp` over a 3M range took 13.7 s against a 250 ms deadline. Pin both with tests. `Liquidry`
  serves every Liquid renderer, the prompts' coming move to Liquid (another container) included:
  say so in the thread file.
* **C1**: a column's own template (`Columns.textOfShown`) and the templateable fills
  (`Templating.filledQnOf`) take the column budget as `liquidize` does (thread 7's `columnMs`,
  `deadlineOf`), not 1 s per fill.
* **JSONata's timebox** in `Formulas.evaluate` reads `Date.now()`, so on the server it never fires:
  move it to the moving clock (`clockNow`).
* **m1**: whether a run as a whole wants a cap (N columns × 250 ms); propose and build if cheap,
  else record.
* **m2**: a widgeting whose widget is gone is held only to the row's params validator; hold it to
  `openParams` (no reserved words), or record why not.
`notes/security.md` and the decision record follow. Depends on: 7. Runs before 3c.

### 3c. Columns tighten (last)

*Coach's text:* as 3a's.

Gloss: `notes/deploy.md`'s step 3 for every item on 3a's checklist: `source` and a templateable
source a plain key (or `quiz.<label>`) only; `QuestionWidgetLabel` and `WidgetingPartVals` out of
the column grammar; `quizzes.templated` gone; the readers' old-grammar fallbacks dropped (the
**import's** reading stays, for good); `categories` added to the reserved words, so the integrity
check refuses what the backfill missed; backfills dropped (keep `Backfills` non-empty),
`Backfilling` emptied, the ledger row added (with the note that nothing rewrites an author's
formula reading `qn.categories`). Body says `Tightens Serial Deploy: columnwise`; merged only after
3a's deploy reports `Backfills: every one has finished.` Full e2e run. Depends on: 1 through 9
(the last of the columnwise chain; 10 and 11 come after it). `question` stays reserved: thread 10
makes it a top-level word of the bag.

### 10. One bag shape (added 2026-10-09)

*The Coach's text:* "make a clean break and have expressions widgets and templates accept a bag of
the same shape as the export. If there's good reason, you are allowed to optimize the structure of
the bag to support (a) efficiency of widgeting execution and (b) elegance of widgeting formulae.
With that said, change qn to question and qns to questions. Where formula/template are dealing with
ephemeral data that only concerns rendering of data, it might make sense to withold it from the json
ball -- but in general it makes sense for them to agree. * it continues to makes sense for the
formula/template bag to have the *_label fields denormalized to the top, * make the jsonball include
label, viz and timestamps. They should discard errors, but otherwise be equivalent. * in general,
converge them. I see some opportunities to simplify the data but let's do that on a uniform
structure." And: "the crazy data format buffet is only going to cause more work later. tackle once
these threads and a full e2e suite land."

Gloss:
* **One shape**, the export's, for three readers: the formula bag (`Runner.QuizBag`), the template
  bag (`Templating.TemplateBag`), and the jsonball (`Exporting`, which feeds both git and Raw
  Export). Questions are keyed by label, in quiz order, and each carries its `position`, `label`,
  `viz` and stamps. A widgeting's result is `status` and `value`; errors are dropped from all three.
  `qn` becomes `question` and `qns` becomes `questions`. The `*_label` fields stay at the bag's
  top level (`qn_label` becomes `question_label`).
* **What the bag and the jsonball do now, and where they differ:** `bag-shapes.md`, beside this
  file. Converge every row. What concerns only rendering (images made
  links, filled templateable text, the recap's `number`) may stay out of the jsonball; say which.
* **Optimizing is allowed** for speed of execution or for elegance of formulas. Record each such
  departure from the export's shape, and its reason, in a new § of the decision record.
* **Liquid loops over keyed collections** with a `values` filter
  (`{% assign list = questions | values %}`). LiquidJS's `for` takes no filter, and a bare
  `for` over an object yields `[key, value]` pairs: pin both with tests. JSONata uses
  `$lookup(questions, question.chains_to)` and `questions.*`.
* **A clean break.** Rewrite the seeds, fixtures, tests and
  `notes/examples/20261008-but_not_recap.json`. Write the old-to-new rewrite of formula and template
  text once, as a pure function. The importer uses it for old exports, read for good as 3a's old
  grammar is. Production's stored formulas and templates (library widgets, widgetings' params,
  columns, the quiz's recap fields, templateable texts) are rewritten by a backfill in a chain of
  its own, `(Serial Deploy: bagshape)`, unless the thread finds a simpler way: ask before
  choosing another.
* Every hunt's git files change once, when the jsonball gains `label` and the rest: say so in
  `human/`.
* **Read, then retire,** the parked `20261009-cw_budgets-qnbag-parked` (thread 9's first try at
  a keyed lookup), with `scripts/git-attic`.

Depends on: 3c, and the full e2e run after it. Side by side with 11. Full e2e run.

### 11. Optimistic updates (added 2026-10-09)

*The Coach's text:* "orchestrate a thread -- now, next, later, your call -- to do optimistic
updates. in your plan for that, make sure to remove any workarounds. Also: pause and consider if
adding, then removing, code is actually easier than adding optimistic updates where useful".

Gloss:
* **Library first.** Use Convex's `withOptimisticUpdate` on the one `perform` mutation
  (`src/state/use-hunt.ts`), by action kind. Cover only the kinds whose wait for the server shows:
  editing a question, a column's retitle, relabel and width, an entry's widgeted, sorting and moving
  questions, at least. Each update applies the same change the server makes, through the same pure
  function wherever there is one. Keep every update in one module, so it moves with the quiz query
  when the Coach's coming thread on what each update sends splits that query.
* **Survey first, and put the survey in the thread file and the ready report.** Name each
  workaround for the missing updates and which update removes it:
  - the e2e `waitUntilSaved` calls that exist only for a race (sort out the legitimate ones);
  - thread 9's sort-after-save wait;
  - 5a's `retitledPatch` item and the title lost when two edits are sent at once (TODO);
  - the relabel-then-edit race;
  - the known flaky specs this explains.

  Where keeping a workaround is simpler than the update that would replace it, say so and keep it:
  that is the Coach's "adding, then removing" question.
* **Remove every workaround its update replaces**, in this thread.
* Measure of success: the race flakes stop recurring across the full e2e run.

Depends on: 9, and the full e2e run after 3c. Side by side with 10 (the state layer, where 10 is
`lib` and the models). Full e2e run.

## Decisions taken in YOLO

From 2026-10-09, after thread 9's review. Each is a two-way door, recorded here, in the chat relay,
and in the sprint-end `human/` entry.

* **Thread 9, by its worker:** the save-wait workaround also goes into `ordering.spec.ts`'s
  `fillQuiz`, which is one spec past the one named, since it hit the same race. The export test
  in `entries.spec.ts` is called a load flake, after passing 3 of 3 runs on both the base and the
  branch. "Decision 5" is read as the thread file's `RunMs` decision, amended with the decision
  record's §11.
* **Thread 9, by its worker:** `'whiteboard/**/*.mts'` is added to `eslint.config.mjs`'s global
  ignores (in its own commit, `2b124c4`). The orchestrator's `prd_checks.mts` had broken every
  lint run, because typed rules can't read a file outside the TypeScript project.

## For the Coach

* **Mode: normal**, per your invocation; the preplan's closing list says "mode YOLO", which I read
  as superseded. Workers block on significant questions, and the sprint pauses for them.
* **The design note before code.** The preplan says "the Coach reads it before code moves".
  *Answered 2026-10-08:* code threads proceed once thread 1 lands; the Coach reads the record on
  its PR meanwhile, and a correction reaches workers as a resume.
* **Optional threads 6 and 8.** *Answered 2026-10-08:* run both.
* **Merge order:** up to 3a's PR (`Serial Deploy: columnwise`), wait for its production deploy to
  say `Backfills: every one has finished.`, then the rest; 3c's tightening last. Before 3a's
  deploy, grep the raw export for author formulas reading `qn.categories` (nothing rewrites
  them).
* The preplan's line 514 ("`template` is mustache") is superseded by its later ruling (Liquid,
  no mustache anywhere); the plan follows the later one.
* **3a's review hit the permission check** (2026-10-08): it refused the reviewer a read-only grep of
  `tests/convex/writing/quiz_writing.test.ts` and `layout_actions.test.ts`, and an edit to
  `convex/writing/layout_actions.ts`. The reviewer reported both, and did not work round them.
  Not routed to another agent. Waiting on the Coach: whether 3a's worker (or a later thread)
  applies the reviewer's proposed `shadowedBy` fix (a column whose plain source `categories` names
  a `categories` widgeting is missed on rename and delete; minor, only before 3a's backfill or
  before 3c reserves `categories`), and adds a unit test for `8562e8b`.
* **Thread 2's reserved words break reads** of a label that already holds one (addresses, a
  username's session and hunt joins). *Ruled 2026-10-08:* gate on a production grep, and relabel
  what it finds before deploying; no change to the read paths. Thread 2's PR says `Before merging:`.
* **3a's open calls** (minor): the empty-estimates-cell rule (`27bf8b3`); *Category Data* vs
  *Categories* as a new estimates column's header.
* **3b's open call** (minor): a double-click on a sortable column head sorts once (and saves the
  sort) before it collapses; holding the sort back needs a timer, a views tripwire. And a
  collapsed column in the card layout (below 640px) is restored only from the columns editor.
* **7's open call** (minor): `liquidize`'s `template_from` with no formula reads as a column with
  no formula does (the field itself, a widgeting's `value`), not `$`; the record's §3 amended.
* **After the deploy:** `seeding:seedWidgets` (thread 2's four families and thread 7's `blurb`).
* **Thread 7's review (flagged), ruled 2026-10-08:** a `liquidize` template stopped by a limit
  stops its column (as a JSONata timeout does), **and** the column gets one shared time budget;
  decision 5 amended. And one params-key allowlist per formulary (`jsonata`, `aibot`: none).
* **Before deploying thread 6:** query production for widgetings whose `params` hold a `regex`
  key (one written by a direct call before the deploy would never be checked); expect none.
* **5a's call to confirm** (minor): a column whose header is still the automatic one follows what
  it shows, its formula and its widgeting's relabel (`retitledPatch`); a typed header stays.
* **`pnpm lane` is shadowed** by pnpm 12's own `lane` command; `pnpm run lane` gives the project's.
  CLAUDE.md's *Global resources* says `pnpm lane` (thread 8).
* **8's open call** (minor): should a column whose formula reads an `aibot` widgeting re-ask on a
  double-click, as a seeded sum's cell does?
* **Incident, 2026-10-09:** thread 5b's worker killed processes it did not start (a home-made PID
  walk that took in PID 1), ending the session; no damage found beyond stopped agents and servers.
  `human/20261009-sprint_columnwise_kill_incident.md` has it, with a suggested guard. Every later
  handoff says: stop only the one PID you recorded.
