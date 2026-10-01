/sprint rewidgeting

Mode: YOLO. Review level: medium. Issued by the Coach (Flip), 2026-10-01.

The design record is `whiteboard/20261001-rewidgeting/preplan.md`. Read it whole before planning;
every call it lists as open has since been settled as its *Open calls* section says, and its
narrative of how we got there is history for you, the orchestrator, and not instruction.
Don't point thread workers to that file or away from it.

This prompt is the instruction.

## Background

The tool computes things per question in two ways today: **expressions** (JSONata formulas,
owned by the hunt, seeded into every hunt) put to work in a quiz as **expressings**, and two
hard-coded **bots** (dumdum guesses the clueing; numnum lists the number-like spans in the
clueing or the hint) connected to a quiz as **bottings**, whose replies are rows in `bottings`
and are projected onto three question fields (`guess`, `clueing_ishes`, `hint_ishes`) that the
formulas read. The bots' prompts, tiers and legal (bot, textkind) pairs are code. A new quiz
gets every expression, all three bottings and the columns for them, which suits one specific
quiz and nobody else's.

This sprint makes both the same kind of thing, on the data layer, so an author can paste in
their own prompt and a new quiz starts lean. Three nouns replace five:

* A **formulary** is the generic runner behind a widget: code, never a row. This sprint has
  `jsonata` (today's expression) and `aibot` (today's bot); `entry` comes last; `script` and
  `api` are for later. Each is a class of statics with one interface: `check(widget)`,
  `input(widget, bag)`, `run(widget, widgeting, bag)`, `advice(widget, widgeting, sample)`,
  plus two facts it reports: `defaultInput` (the input formula a new widget starts with: `$`
  for `jsonata`, `{ 'clueing': qn.clueing }` for `aibot`) and `refresh` (`live` for `jsonata`,
  worked out on render; `click` for `aibot`, asked from the cell as today; neither for `entry`).
* A **widget** is a reusable definition, global to start:
  `{ scope: 'pub', label, title, description, formulary, formula, input_formula, config, position }`.
  `formula` is the JSONata expression or the prompt template. `input_formula` is a JSONata
  expression that culls the bag to what the widget reads: for `aibot` the small object the
  template is rendered over (`{{clueing}}` placeholders, as the prompts have now); an input
  that comes to nothing means "do not ask". `config` is formulary-specific (`servicelabel`,
  `model_tier`, `max_tokens` for `aibot`; empty for `jsonata`). Its key outside the database is
  `pub/<label>`; it serializes at `widget/pub/<label>`, one file per widget, and the library
  exports and imports on its own, apart from any hunt.
* A **widgeting** is one widget put to work in one quiz:
  `{ quiz_id, widget_label, label, description, params, position }`. `position` is the run
  order: each widgeting's bag holds the widgeteds of those before it. `params` is validated and
  unused this sprint, and reaches the bag. The label defaults to the widget's, growing `_2`,
  `_3` while taken: that generation is `Labelmaker`'s, as every label's is. Uniqueness among
  siblings, the reserved words and every other stricture are Zod's, in the row validators and
  the quiz's integrity check, as they are today; a typed label that is taken or reserved is
  refused by them.
* A **widgeted** is what one widgeting came to for one question (as *expressed* is for an
  expressing today; the model cannot be called `result`), stored for formularies that store
  (`aibot` appends, as `bottings` does today; `entry` upserts) and computed on render for
  `jsonata`: `{ question_id, widgeting_id, status, value, message, result_meta }`. `status` is
  `ok` or `errored`; a cell with no row is `missing`. `value` is JSON, untyped. `result_meta` (the field keeps
  its name) is a free bag (tier applied, approximate tokens, truncation, the raw failure response). Everyone
  reads a widgeted as `{ status, value, err }`, where `err` is a newer failure riding along on
  an `ok` value.

The rules that follow from that, all settled:

* **The question bag is flat.** A widgeting's widgeted sits at `qn.<label>` beside the question's own
  fields, and under each of `qns`. Widgeting labels may not match the question's exposed
  fields, its views (`butnot`, `butnot_ishes`), `rank`, or `question`; that pattern is derived
  from the `exposed` lists in one place beside the label pattern, never a second list, and
  enforced by the validators.
* **Staleness is off this sprint.** Here there is no `stale` on a widgeted; the ishes'
  `asked_text` comparison goes with `bottings`; the seeds' `{ value, stale }` form becomes a
  bare value; the grid's greyed stale marks disappear. Accepted. The design it will have, for
  thread 1 to record and for nobody to build yet:

  ```
  input_data = input_formula(bag)                    -- may carry `_dependencies`
  digest     = hash(jsonify({ formula, config, input_data }))
  input_data = input_data without `_dependencies`    -- what the template renders over
  stale      = stored.digest !== digest
  ```

  Nothing is inferred from a formula: the input formula is the author's statement of what
  the widget reads. Each widgeted publishes its `digest` forward in the bag, and a widget that
  reads another's widgeted declares it by naming that digest in `_dependencies`, which is
  folded into its own digest and stripped before the template renders. `stored` is the newest
  `ok` row; with none, nothing is compared. The `digest` column arrives with that sprint.
* **Bulk recalculation is off this sprint.** "Recalculate all", the batched prompt, the
  `bulk_ishes` job and `bulk_ishes_last` go. Note in HUMAN-whatsup at the end that the run was
  already slower than it should be, for the day bulk returns.
* **Keep a lid on migration code.** Production holds one hunt of 27 questions. What a person
  typed (questions, quizzes, hunts, reviews, idents) must survive; what the tool can make again
  (seeded expressions, default layouts, the bots' replies) need not. A simple migration through
  `notes/deploy.md`'s procedure, such as adding a field existing rows lack, is fine wherever
  the work needs one. What to avoid is complex code that translates existing rows into the
  new shapes: where carrying data across would take that, **drop the data instead and report
  it**, in your thread's report, in `losses.md` in the sprint directory, and in the PR. The
  Coach reviews what was dropped and what migration code was written, and will pull back
  anything that grew. The expectation for thread 3 is that `expressions`, today's `widgets`
  and `bottings` are not translated: their tables are cleared by hand at deploy, and one
  idempotent seeding mutation re-creates the library and the default widgetings.
* **Imports of every kind merge by label.**
* **The ask route stays the one server function.** Its contract changes; nothing joins it.
* **Everything else in CLAUDE.md holds**: library first (`mustache` for template rendering is
  the expected proposal; `crypto.subtle` needs no dependency), Zod at every entrypoint, MUI for
  views, `STYLE.md` and `notes/vocabulary.md` before naming anything.

## Threads

### 1. Design note and vocabulary

Write `notes/decisions/2026-10-widgets.md`: the three nouns and the formulary, the four row
shapes and their validators' fields, the formulary interface, the flat bag and the reserved
pattern, serialization paths, the status words, and staleness as designed and deferred, in
the form the other decisions take. Update `notes/vocabulary.md`: add *formulary*, *widget*
(redefined), *widgeting*, *widgeted*, *input formula*; retire *expression*, *expressing*,
*botting*, *slot*, *stale* and *last_err* or mark them as retiring; keep *bot* as a model with
a brief, now an `aibot` widget. Docs only: no code, so no code review. Flag in the PR any place
where the design note had to decide something this plan left loose.

### 2. The formulary seam, no data change

Build `src/lib/formulary/` (or the name the design note chose): the interface, the `jsonata`
and `aibot` formularies wrapping today's `Formulas`, `Expressed`, `lib/ask/*` and the three
hard-coded bots, and one runner that walks a quiz's widgets in position order and yields,
per question, every widget's widgeted as `{ status, value, err }` by label. The grid, the
sorts, the exports and the sheet read through the runner. The bag gains `qn.<label>` for every
widget, expressings included (an expression's value enters the bag for the first time, in run
order); the old `qn.guess`, `qn.clueing_ishes` and `qn.hint_ishes` stay as aliases until
thread 3 removes them. Tests mirror the new module. No schema change, no row change.

### 3. The data model, as a clean break

The three tables: `widgets` (from `expressions`, widened and global), `widgetings` (from
today's `widgets`, one shape), `widgeteds` (from `bottings`), each from its row validator in
`src/models/`, with `convex/schema.ts`, `reading.ts`, `authorize.ts` and the `hunts.perform`
actions for adding, editing, moving and removing widgets and widgetings. The seeding mutation:
the thirteen seed expressions as `jsonata` widgets and the three prompts as `aibot` widgets
(dumdum's clueing; numnum's clueing; numnum's hint), with their tiers and token room, inserted
when absent; and for every existing quiz with no widgetings, the widgetings today's default
layout gives, under the labels its columns already name. The seed texts move out of
`lib/ask/prompts.ts` and `models/expression.ts` into one seeds fixture the mutation reads. The
bag's new paths, with the seed formulas rewritten to them and the three question fields,
`BotSlots`, `bot.ts`, `bot-label.ts` and `bot-status.ts` gone; the aibot formulary keeps a
temporary mapping from the three seeded widget labels to today's three ask jobs until thread
4 replaces the route. The reserved-label pattern. The library's own export and import; the
hunt's export, sheet, mirror (`widget/pub/<label>`) and import following `exposed`. Bulk
recalculation removed. Existing rows follow the rule on migration code above: the three old
tables are expected to be cleared and re-seeded, not translated. Write the Coach's deploy
procedure into `notes/deploy.md` with a ledger row saying what is cleared and why: export the
hunt; clear the three old tables in the Convex dashboard (a push is refused while a table
absent from the schema holds documents); deploy; run the seeding mutation; re-ask the bots.
End with `losses.md` in the sprint directory: every table cleared, every row kind in it, what
re-creates each and what nothing does.

### 4. Pasted prompts

The ask route's new contract: a rendered prompt, a model tier and token room in; a JSON object
out, vetted as today (strings clipped, control characters refused, size bounded) before it is
kept. `Approval` and the credentialed-services check stay; `lib/bots/port.ts` reports services,
not bots. Template rendering with `mustache` (propose it per the library-first rule; HTML
escaping off) over the input formula's object; an input that comes to nothing is not asked.
The three seeded `aibot` widgets run through the new contract and the thread-3 mapping goes.
The advice prompt generalized from `lib/formula-prompt.ts` to every formulary, saying in words
what shape the author wants back. The `aibot` widget editor: prompt, input formula, config,
with a live preview against a chosen question of the distilled object and the rendered prompt.

### 5. Status

`ok`, `errored`, `missing`, projected in one place (the runner) from the newest `ok` row and
any newer `errored` row. One cell body for every widgeted: a scalar as text, anything else
through the existing `JsonFold`; one badge for `err`; `refresh: click` cells are askable,
others read-only. Sorts read `value`; the sheet and export write it. Retire the per-cell
special cases (`guess.tsx`, `ishes.tsx`, the butnot-ishes mirror as a special cell), the
ishes' stale mark and the seeds' marked form. Known regression to state in the PR: numnum's
list of spans shows as folded JSON rather than its current prose list; a nicer presentation
for a list of items is a later nicety, not this thread's.

### 6. Views

Two editors with different scopes. The **widgeting editor**, from the quiz page: pick a widget
from the library (grouped by formulary), set the label, description and place in the run
order (the existing `SortableList`), and a "New widget..." door that opens the other editor.
The **widget editor**, from the library (today's `ExpressionsModal`, kept and renamed):
formulary, formula, input formula, config, the live preview `ExpressionFields` has, the advice
button, a line saying "worked by N widgetings across M quizzes, in H hunts", and removal
refused while anything works it. The **Widgets panel** below the grid replaces *Prompts
used*: the quiz's widgetings in run order, each with its formulary, its formula or prompt
readable, its advice button, and counts of ok, errored and missing. MUI first, per
`notes/views.md`.

### 7. The basic set and the catalogue

A new quiz starts with columns for `label`, `title`, `qnum`, `clueing`, `full_answer` and
`notes`, and no widgetings; `hint`, `chains_to` and `alt_text` stay on the question row with
their columns opt-in. A new hunt seeds nothing (the library is global and seeded once). The
widgeting editor's picker is the catalogue. `src/models/layout.ts`, `Hunt.blank`,
`insertHunt` and the e2e fixtures follow.

### 8. Entry widgets

The `entry` formulary: `config.entry_kind` one of `text`, `number`, `labelish`, `titleish`;
no formula, no input, `refresh` neither; its cell is the existing field editors committing on
blur to a `widgeteds` row that is **upserted**, one per (question, widgeting), rather than
appended. A default `notes` entry widgeting may replace the starter set's `notes` column if
that reads cleanly; otherwise `notes` stays a question field. Do not move `hint`, `alt_text`
or `notes` off the question row: that is a data move, and a later call. Record in
HUMAN-whatsup what moving them would take.
