# Rewidgeting: preplan

Date: 2026-10-01. A pre-plan, written in chat with the Coach (Flip) before the sprint plan
exists. It records the survey of what stands, the shape we are converging on, the Coach's
rulings so far, the agent's pushback, and a rough thread order. The sprint plan
(`rewidgeting-plan.md`) will be written from this once the open calls at the end are settled.

**The ask.** Bots and expressions become one family of things defined on the data layer rather
than in code, so that (a) an author can paste in their own prompt, and (b) a new quiz starts
with a basic set, with the numeric-meta machinery opt-in from a catalogue, so the tool can be
released as a general one.

## What the survey found

The partial move is further along than "partial" suggests. The remaining tangle is in four
specific places.

* **Widgets are already a union table** (`src/models/widget.ts`), but the two arms are
  structurally different. An expressing holds a pointer to a hunt expression; a botting holds a
  pointer to a code bot plus a textkind. Neither holds its own formula.
* **Bots are code, not data.** The two bots, their prompts, tiers and token limits live in
  `src/models/bot.ts`, `src/lib/ask/prompts.ts` and `src/lib/ask/models.ts`. The three legal
  (bot, textkind) pairs are hard-coded in `src/models/botting.ts` as slots that map onto three
  question fields.
* **Bot results are question fields.** The bag exposes them as `qn.guess`, `qn.clueing_ishes`
  and `qn.hint_ishes`, and every seed sum formula reads those names. Expression results are not
  in the bag at all, so a formula cannot read another formula: the opposite of "every widget
  sees the results before it".
* **Ownership is split three ways.** Expressions belong to the hunt and are seeded into every
  hunt at creation. Expressings and bottings belong to the quiz. Bots belong to the build. The
  widget dialog (`WidgetsEditor.tsx`, `state/widget-edit.ts`) edits a hunt expression and a quiz
  widget in one Apply: that is the "am I editing a global thing or a quiz thing" confusion.
* **Staleness has three rules.** Ishes are stale when the stored `asked_text` differs from the
  current text. Expressions are stale only when the formula returns `{ value, stale }`. A guess
  has no stale concept. Errors ride along as `last_err`; never-asked is null; "not applicable"
  (no chain, empty text) is handled cell by cell in the views.
* **The ask route is job-typed** (`guess`, `ishes`, `bulk_ishes`), with the output schema built
  from Zod on the server. A pasted prompt means the route takes a prompt and a schema instead
  of a job name.
* **Blast radius** of the three bot field names: about 15 source files and 16 test files
  (`grep -rl 'clueing_ishes\|hint_ishes\|\.guess\b' src convex tests`), plus the export, the
  TSV sheet and the git mirror, whose shapes all follow `exposed`.

## The shape

Three nouns, where today there are five (bot, botting-the-widget, botting-the-row, expression,
expressing). The Coach's framing, with the agent's refinements marked, and the Coach's rulings
of 2026-10-01 folded in.

### 1. The formulary (code only, never a row)

The generic "bot or expression or JS code or API call": something that does stuff with a
formula and a bag and comes to a result. The Coach named it the **formulary**, a word that
means nothing yet and so collides with nothing. A widget names its formulary in a field of
that name; the values this sprint are `jsonata` (today's expression) and `aibot` (today's
bot), with `entry`, `script` and `api` as the obvious later ones. *Bot* keeps its vocabulary
meaning, a model with a brief, and the brief is now a row.

In code, one interface with one class of statics per formulary:

* `check(widget)`: is the formula well-formed; a sentence when not.
* `input(widget, bag)`: what this widget reads, distilled by its input formula (below).
* `run(widget, widgeting, bag)`: synchronous for `jsonata`; for `aibot`, the rendered prompt
  the browser sends to the ask route, and the reply as a result.
* `advice(widget, widgeting, sample)`: the meta-prompt the author copies out to get help
  writing the formula. Generalizes `lib/formula-prompt.ts` to every formulary.
* `defaultInput`: the input formula a new widget of this formulary starts with (ruled): `$`
  for `jsonata`, `{ 'clueing': qn.clueing }` for `aibot`, nothing for `entry`.
* `refresh`: how a result comes to be (ruled): `live` for `jsonata`, worked out on every
  render; `click` for `aibot`, asked when the author double-clicks the cell or presses Enter
  on it, as today; neither for `entry`, which is typed. The cell component reads this to
  decide whether it is an `AskableCell` or a `ReadonlyCell`.

**Distilling the bag.** Every widget carries a second JSONata expression, the **input
formula**, which culls the bag to what the widget reads. For `jsonata` the default is
everything (`$`), since the formula reads the bag directly. An `aibot` widget never sees the
whole bag: its input formula distils it into one small object: `{ 'clueing': qn.clueing }` for dumdum, `{ 'hint': qn.hint }` for numnum's hint
widget, `{ 'clueing': qn.clueing, 'others': qns[label != $$.qn_label].title }` for something
cleverer. The prompt template is rendered over that object alone, with `{{clueing}}`
placeholders as the prompts have today: the fills code supplies now become an expression the
author writes. An input formula that comes to nothing (JSONata `undefined`) means "do not
ask": today's "a text with nothing in it is not asked about" made explicit, and the cell stays
`missing`. Rendering wants a library, not a hand-roll: `mustache` is the boring one (dotted
paths, sections for lists, triple braces to switch off HTML escaping), unlisted and so
proposed through `notes/stack.md`.

Dumdum and numnum as named personalities dissolve into widgets: dumdum's one prompt becomes
one `aibot` widget, numnum's clueing and hint prompts become two. Their names live on as the
widgets' labels and titles.

### 2. The widget: a reusable definition, global to start

```
widgets: { scope, label, title?, description, formulary, formula, input_formula, config, position }
```

* `scope`: `pub` for now, and the only value. Every widget is global: there is no `hunt_id`,
  and every hunt sees the same library. Hunt-owned and personal scopes come later as other
  values of this field, not as other tables. Today's `owner: 'tq'` on expressions is this
  field under another name.
* `label`: unique within its scope, fixed once made (things refer to it). Never `question`.
  The key that names a widget everywhere outside the database is `pub/<label>`, as
  `keyOf` makes `tq/<label>` today.
* `formulary`: `jsonata` or `aibot`.
* `formula`: the JSONata expression for `jsonata`; the prompt template for `aibot`.
* `input_formula`: the JSONata expression that culls the bag to what the widget reads (§1):
  `$` by default for `jsonata`; for `aibot`, the small object the template is rendered over.
  When staleness is built, its output is also what the result's digest is made from
  (*Staleness*).
* `config`: formulary-specific and validated by it: for `aibot`, `servicelabel`,
  `model_tier`, `max_tokens`; empty for `jsonata`.
* `position`: the order the author lists them, as expressions have today.

**Result typing is off the sprint.** Every result is JSON, and a `result_schema` column waits
until a need answers how it should be authored. The Coach's answer, if one becomes wanted: a
choice between `string` and `object` (a record of anything; ajv's word), and no more. The ask
route constrains the model to "a JSON object" and no more; the advice prompt says what shape
the author wants in words.

**Serialization.** A widget lives at `widget/pub/<label>` in the mirror, one file per widget,
where today a hunt's expressions are one file at `tq/hunt/<hunt>/<hunt>.tqexpressions.json`.
**Widgets are exported separately** from a hunt (ruled): the library has its own export and
import, and a hunt's export names widgets by label and carries none. A widget import merges by
label, as every import does (ruled).

**Seeds.** The existing prompts and expressions are preserved as global widgets: the thirteen
seed expressions as `jsonata` widgets, dumdum's clueing prompt and numnum's clueing and hint
prompts as three `aibot` widgets with their tiers and token room. They are rows, seeded once by a
one-shot mutation when the library is empty, not a list in code projected as rows: "on the
data layer, not the code layer" is the point of the sprint.

**Who may edit a `pub` widget** is every smith of any hunt, and an edit changes every quiz that
works it. That is acceptable while the users are a few friends and is noted as a thing the
hunt and personal scopes will fix.

### 3. The widgeting: one widget put to work in one quiz

```
widgetings: { quiz_id, widget_label, label, description, params, position }
```

* `widget_label`: which `pub` widget it works, by label, following the precedent of
  `expression_label` on today's expressing: labels are fixed once made, so exports and imports
  round-trip with no id translation. (The Coach's first list had `quizlabel` and `widgetlabel`
  beside ids; a row names its quiz and widget once, and the quiz's label, which can change
  through `forced_label`, is read at projection time as for every other child.)
* `label`: unique within the quiz; what columns, the bag and exports name it by. Defaults to
  the widget's label, growing `_2`, `_3` and so on while taken (ruled; today's
  `Labelmaker.appendFallback` adds a random suffix instead). The generation is `Labelmaker`'s;
  uniqueness, the reserved words and every other stricture are Zod's, in the validators
  (ruled). An import **deep-merges widgetings by label**.
* `position`: the run order. Every widgeting's bag holds the results of the widgetings before
  it, so position is the dependency order, and the existing drag-to-reorder list is already
  the right control.
* `params`: present and validated but unused this sprint. It reaches the bag as the
  widgeting's own `params`, so a formula can read `params.foo` the day parameterization comes.
  The bag also gains the widgeting's own label (a proposal already in HUMAN-whatsup).
* `description`: what this widgeting is for in this quiz, as today.

This is today's `widgets` table, renamed and with both arms collapsed into one shape.

### Widgeteds (first drafted as "results")

**Ruled: the model is not called `result`.** It is a **widgeted**: what one widgeting came to
for one question, as *expressed* is what an expressing came to today. The table is
`widgeteds`. The field `result_meta` keeps its name. Below, and elsewhere in this preplan,
"result" in prose means a widgeted, and `results` as a table means `widgeteds`; the sprint
prompt uses the new word throughout.

```
widgeteds: { question_id, widgeting_id, status, value, message, result_meta }
```

* Keyed by **widgeting**, not widget: a question belongs to one quiz, but the same widget could
  be put to work twice in a quiz with different params.
* `status`: `ok`, `errored`, `missing`. (`missing` is the absence of a row, so it appears in
  the projected result rather than being stored. No `never`: it is a keyword. No `unknown` or
  `not applicable` until something needs one.)
* `value`: the result as JSON. Null when errored.
* `message`: why it errored, in the author's words.
* `result_meta`: a free bag for whatever the formulary wants to say about how it ran:
  `model_tier_applied`, `approx_tokens`, `truncated` (the reply was cut short), and the raw
  failure `response` for the badge to show. Nothing reads it structurally except the views
  that show it.

This is today's `bottings` table, generalized: append-only as now (the newest ok row is the
value, a newer errored row rides along as the failure), with `reply_text` and `items` folded
into `value`. Bots persist here. Expressions keep computing on render and store nothing,
which `notes/stack.md` already decided. Entry widgets, when they come, store their values here
too, which is why the shape is worth getting right now.

**The result as everyone reads it** (cells, sorts, exports, the bag) is one type:
`{ status, value, err }`, where `err` is the newer failure riding along on an `ok` value
(`stale` and `digest` join it when staleness is built). The bag carries it per question at `qn.<label>`, flat beside the question's own fields
as the bot results sit today, and in `qns[*]` as well as `qn`, since the butnot formulas read
the chained-to question's results.

**One flat label space per question** (ruled). The JSON and TSV exports are first-class, so
the bag stays flat rather than pushing results under a sub-key, which would guard only
against a widgeting shadowing a question field and nothing else. That guard comes from a
reserved pattern instead:

* A widgeting's label may not match the question's exposed fields, its views (`butnot`,
  `butnot_ishes`), `rank`, or `question`. The pattern is derived from those lists in one
  place beside the label pattern in `lib/vv/patterns.ts`, so the reserved set follows
  `exposed` and is never a second list. With entry widgets taking over the row's growth
  (thread 8), that set stops growing, which is what makes flat safe over time.
* Widgetings are unique by label within a quiz, as widgets are today. A defaulted label grows
  `_2`, `_3`; a typed one that is taken or reserved is refused with a sentence.
* Columns keep their own label space per quiz, as now; the TSV's headers stay column labels.

### Staleness: designed, and off this sprint

**Ruled 2026-10-01: staleness is not in this sprint.** It kept raising Very Interesting
Questions Worthy of Much Debate, and it is a mid-level feature. The design below is where the
debate landed, kept here for the sprint that builds it. Until then there is no `stale` on a
result, the ishes' `asked_text` comparison goes with the `bottings` table, and the seeds'
marked `{ value, stale }` form becomes a bare value: the greyed stale marks the grid shows
today disappear, and the Coach accepted that.

**The design.** A result stores a **digest** of what it was computed from, and is stale when
the digest of the current moment differs. Nothing is inferred from a formula; the author says
what a widget reads. One process for every formulary, evaluated at read time against the
current bag:

```
input_data   = input_formula(bag)                     -- may carry `_dependencies`
digest       = hash(jsonify({ formula, config, input_data }))
input_data   = input_data without `_dependencies`     -- what the template renders over
stale        = stored.digest !== digest
```

* **Each result publishes its digest forward.** The result object in the bag carries
  `digest` beside `status` and `value`.
* **Dependencies are declared, not found.** An input formula that reads another widget's
  result names that result's digest in a `_dependencies` field,
  `{ 'ishes': qn.clueing_ishes, '_dependencies': [qn.clueing_ishes.digest] }`. The field is
  folded into the digest and stripped before the prompt is rendered. This is the answer to the
  Church-Turing objection the agent kept walking into: every widget's bag holds everything
  before it, so nothing can tell which results an arbitrary `input_data` was built from; the
  author tells it.
* `stored` is the newest `ok` result for the cell, never a newer errored row riding along;
  with no stored row the status is `missing` and nothing is compared.
* The formula text and the config are in the digest because an edited prompt, or another
  model tier, must stale what was computed under the old one. The input formula's own text is
  not (its output stands in); nor are the widgeting's label and description, `result_meta`,
  or the model id behind a tier.
* A `jsonata` widget stores no result; its staleness, when it has one, is only what its
  declared dependencies give it. An `entry` widget's input is nothing and a typed value is
  never stale.
* The hash is `UU.jsonify` (stable) then `crypto.subtle`, which every browser and Convex's
  runtime have, so no dependency. The `digest` column on `results` is added when this is
  built, as the widening half of a migration, and not before.

### The ask route

Stays the one named server function. Its contract becomes "send this rendered prompt under this
model tier and token room, ask for a JSON object, return it parsed". The browser distils and renders, since it has the bag; the key stays on the server.

Two cautions. A free-form prompt relay is more abusable than three fixed jobs: the existing
approval gate matters more, and the rate limiting `notes/stack.md` lists under *Later* moves
closer. And the reply is vetted on the server as today (`vetReply`: strings clipped, control
characters refused) before it is kept, now against "a JSON value of bounded size" rather than a
job's shape.

**Bulk.** "Recalculate all" sends one keyed request for every text, through numnum's
hand-written batched prompt. **Left until later** (ruled): no bulk for pasted prompts, and the
button goes with the batched prompt and `bulk_ishes_last` rather than being kept alive for one
seeded widget. The Coach notes the run is already dodgy slow, slower than it should be, which
is worth a look of its own when bulk returns; `HUMAN-whatsup.md` should carry that note at
sprint end.

### Views

The ownership confusion is fixed by two editors with different titles and different scopes:

* **The widgeting editor**, from the quiz page: pick a widget of the hunt, set this
  widgeting's label, description and (later) params, and its place in the run order. It
  never shows a formula box. Removing a widgeting removes its columns and nothing else.
* **The widget editor**, from the global library: formula, input formula, config, with the
  live preview against the on-screen quiz's questions that
  `ExpressionFields` has today, the advice button, and a plain line saying "worked by N
  widgetings across M quizzes, in H hunts" before Apply. Removing a widget is refused while
  anything works it.

The convenience of writing a new widget from the widgeting dialog is worth keeping as a
"New widget..." door that opens the widget editor, so that the author always knows which
thing they are in. The *Prompts used* panel below the grid becomes the **Widgets** panel: the
quiz's widgetings in run order, each with its formulary, its formula or prompt readable, its advice
button, and a status summary (how many questions ok, errored, stale, missing).

### The basic set and the catalogue

The global library holds the seeds (the sums, the word count, the text helpers, and now dumdum
and numnum as `aibot` widgets), seeded once. A new hunt seeds nothing. A new **quiz** starts
with the core columns and no widgetings; the widgeting editor's picker, over the library, is
the catalogue. **The starter set, ruled:** `label`, `title`, `qnum`, `clueing`, `full_answer`,
`notes`. `hint`, `chains_to` and `alt_text` stay on the question row, with their columns
opt-in, until entry widgets take them: the Coach's own custom columns stop being everyone's.
The defaults in `src/models/layout.ts` shrink to that.

### Entry widgets, last

Custom per-question fields as a formulary, `entry`, whose values live in `results`. The Coach
confirmed the shape: entry types will grow to `image url`, `youtube url` and `audio url`, which
are widgets by any reading. It is the biggest migration in the list: `hint`, `alt_text` and
`notes` would leave the question row, and the export, sheet, import and mirror would follow.
`chains_to` drives chain order and the butnot views and stays core regardless. Ruled: last,
in this sprint; the results table is designed to admit it from thread 3.

**Cost, assessed 2026-10-01.** The Coach asked whether a value written on every blur is a
Convex cost. It is the cost the grid already pays: `useDraft` commits on blur and only on a
change, and `notes/database-decisions.md` measured a text edit at about 3 KiB once each action
read only what it needs. An entry widget's blur is one small `results` write instead of a
question patch: the same count, about the same bytes. Two things differ. Bot results are
append-only history, so an entry value must **upsert** or every blur adds a row; the design
thread gives `results` a write policy by formulary, or entries a sibling table of the same
shape. And a question's query reads one more small row per entry widget, linear in widgets,
not in edits. The recompute of every formula on each redelivery (the note's memoization item)
is the same for an entry edit as for a clueing edit today. The Coach will take the data-flood
question when the widget exists.

## Migration: a clean break, by the Coach's decision

`notes/deploy.md` *Schema pushes* says a change that production's rows would not fit ships as
widen, backfill, tighten through `@convex-dev/migrations`. **For this sprint the Coach sets
that aside**: production holds one hunt of 27 questions, and the Coach would sooner paste them
through Claude than have the sprint carry migration code. Under the reading below, not even
that is needed. The agent's reading of what
"keep a lid on complicated code to migrate existing data" means, chosen from the three
options offered:

**Nothing migrates, and almost nothing needs to.** The question row holds only what the author
writes; the bots' replies are projections from `bottings`. So the tables that change shape are
exactly three, and none of them holds anything a person typed into a question:

| today | becomes | what is in it |
|---|---|---|
| `expressions` | `widgets` (`pub`) | the seeds, re-created by the seeding mutation; any custom expression is in the hunt's export |
| `widgets` | `widgetings` | the default layout's three bottings and the sum expressings, per quiz |
| `bottings` | `results` | the bots' replies: re-askable for a few cents |

Questions, quizzes, columns, hunts, realms, idents, huntings, reviews and reviewings are not
touched. Columns name widgetings by label, and the re-seeded widgetings carry the labels the
default layout gives today, so the existing columns keep pointing at something.

**The procedure**, for the Coach, at deploy time:

1. Export the hunt from the Export panel, so any custom expression is on disk.
2. Clear the three old tables in the Convex dashboard (`notes/deploy.md`, *Resetting*: a cloud
   deployment is cleared from the dashboard). Convex refuses a push while a table absent from
   the schema still holds documents, so this comes first.
3. Deploy. The schema push adds the three new tables empty.
4. Run the one-shot seeding mutation (the library's seeds, and the default widgetings for
   every quiz that has none), as the ledger's `Run` column names it.
5. Recalculate all, and ask dumdum per question, to refill the results.

**What is lost is written down at the sprint's midpoint** (ruled). Thread 3, which knows the
shapes exactly, ends with a `losses.md` in the sprint directory: every table cleared, every
row kind in it, what re-creates each (the seeding mutation, a re-ask, the Coach's hands), and
what nothing re-creates. The Coach reads it before the deploy, not after.

**The ground rule for workers**, stated in the plan so that no thread builds the dance deploy.md
describes: no `@convex-dev/migrations` migration, no widened-then-tightened schema, no
`Backfilling` entries in the schema test, and one PR for the schema change. The seeding
mutation is the only data-moving code, and it is idempotent and tiny. The ledger in deploy.md
gets one row saying what was cleared and why, so a backend that missed it knows to be emptied.

**What this costs.** The bots' replies for 27 questions, re-asked. A local backend, as always,
is emptied and pushed again (`scripts/convex_reset`). Option (b), building the full migration,
was rejected as a day of agent work protecting a few cents of model usage; option (c) is this
section.

## Threads, in rough order

Threads 4 and 5 are fairly independent and could swap.

1. **Design note and vocabulary.** A decision document under `notes/decisions/` with the three
   nouns and the formulary, the `pub` scope and its serialization, the formulary interface,
   the four row shapes, the bag namespace, the status words, and staleness as designed and
   deferred; `notes/vocabulary.md` updated to match. Docs only, read by the Coach
   before any code moves.
2. **The formulary seam, no data change.** `lib/widgets/` with the interface and both
   formularies wrapping today's code, and one runner that walks a quiz's widgetings in order and yields the
   unified result per question. The grid, the sorts and the exports read through it. The bag
   gains results by widgeting label; the old `qn.guess` names stay as aliases for one thread.
3. **The data model, as a clean break.** The three tables under their new shapes and names,
   the seeding mutation, the bag's new paths, the seed formulas rewritten to them, the
   widgets' own export and import, and the hunt's export, sheet, mirror and import following
   `exposed`. One PR; the ledger row in `notes/deploy.md`; the Coach's deploy procedure
   written where they will find it; and `losses.md` (*Migration*).
4. **Pasted prompts.** The route's new contract, the input formula and the template rendered
   over it, reply vetting, and the `aibot` widget editor where a prompt is pasted. No bulk.
5. **Status.** `ok`, `errored`, `missing`, projected in one place, shown by one cell body and
   one badge, sorted and exported by one rule. Retires the per-cell special cases, the ishes'
   stale mark and the seeds' marked form (*Staleness*: off this sprint).
6. **Views.** The widgeting editor and the widget editor as two things; the Widgets panel
   replaces Prompts used; the advice button on every formulary; `ExpressionsModal` becomes the
   global library's editor rather than retiring.
7. **The basic set and the catalogue.** A new quiz starts lean; the picker offers the
   library; `layout.ts` shrinks.
8. **Entry widgets.** The `entry` formulary, the upsert policy, and the question row's `hint`,
   `alt_text` and `notes` moving into results. Last, and in this sprint (ruled).

## Open calls for the Coach

Settled: widgets are global (`scope: pub`), serialize as `widget/pub/<label>`, and export
separately from a hunt; imports of every kind merge by label; an `aibot` whose input formula
comes to nothing is not asked; the existing prompts and expressions are preserved as the
seeds; no migration code beyond the seeding mutation, with `losses.md` at the midpoint
(*Migration*); the generic thing is the **formulary** (`jsonata`, `aibot`); every result is
JSON, and if typing is ever wanted it is `string` or `object`; every widget has an input
formula, `$` by default for `jsonata`; **staleness is designed and off this sprint**, and the
marked `{ value, stale }` form retires with it; status words are `ok`, `errored`, `missing`;
the run-time facts go in `result_meta`; each formulary reports a default input formula and
whether its results refresh live or on a click; bulk recalculation is left until later; a
widgeting's label defaults to the widget's with `_2`, `_3` on collision; the starter set is
`label`, `title`, `qnum`, `clueing`, `full_answer`, `notes`; entry widgets are thread 8, in
this sprint; results sit flat at `qn.<label>`, with the question's own names reserved
(*Results*).

Nothing is open. The preplan is ready to become the sprint plan.
