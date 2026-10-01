# Widgets: one family of per-question calculations, on the data layer

**Status:** accepted, 2026-10-01. The design is the Coach's (Flip), settled in chat before the
rewidgeting sprint; this record was written by that sprint's first thread
(`whiteboard/20261001-rewidgeting/`) and is the design threads 2 to 8 build to.

**Replaces:** expressions, expressings, the bots and their prompts as code, the botting widget, and
the `bottings` table with its three projected question fields.

*Form.* No earlier decision record is in the tree to copy (`CLAUDE.md` and
`notes/database-decisions.md` name records under `notes/decisions/` that are not there), so this
one takes a plain form: context, decision, consequences, deferred, and a closing list of the calls
this record made where the sprint plan left them open. `notes/vocabulary.md` carries the words.

## Context

The tool works things out per question in two ways, and they share almost nothing.

* **Expressions** (`src/models/expression.ts`) are JSONata formulas held by a hunt and seeded into
  every hunt. An **expressing** puts one to work in a quiz (`src/models/widget.ts`, kind
  `expressing`). Its value is worked out on every render (`src/lib/expressed.ts`) and stored
  nowhere, and it never enters the bag, so no formula can read another's value.
* **Bots** are code: two of them (`src/models/bot.ts`, `bot-label.ts`), their prompts
  (`src/lib/ask/prompts.ts`), tiers and token room (`src/lib/ask/models.ts`), and the three legal
  (bot, textkind) pairs (`BotSlots` in `src/models/botting.ts`). A **botting** widget connects a
  quiz to one pair; each ask is appended to the `bottings` table; and the newest reply per pair is
  projected onto three question fields, `guess`, `clueing_ishes` and `hint_ishes`
  (`resultsFor`), which the seed formulas read.
* **Ownership is split three ways** (hunt, quiz, build), and the widget dialog
  (`WidgetsEditor.tsx`, `src/state/widget-edit.ts`) edits a hunt's expression and a quiz's widget
  in one Apply.
* **Staleness has three rules**: ishes compare the stored `asked_text` with the text; an expression
  is stale only when its formula answers `{ value, stale }`; a guess has none. Failures ride along
  as `last_err`.
* **A new quiz gets everything**: three bottings, eight sums and their columns
  (`src/models/layout.ts`), which suits one quiz with a numeric meta and nobody else's.

The sprint makes both one kind of thing defined in rows, so an author can paste in a prompt of
their own, and a new quiz can start lean.

## Decision

### Three nouns, and the formulary

Five things (bot, botting the widget, botting the row, expression, expressing) become three nouns
and a piece of code.

* A **formulary** is the generic runner behind a widget: code, never a row. This sprint has
  `jsonata` (what an expression was) and `aibot` (what a bot was); `entry` arrives last (thread 8);
  `script` and `api` are for later.
* A **widget** is a reusable definition: a formulary, a formula, an input formula and a config,
  under a label. Widgets are global to start: every hunt sees the same **library**, scope `pub`.
* A **widgeting** is one widget put to work in one quiz, under a label of its own, at a place in
  the quiz's run order.
* A **widgeted** is what one widgeting came to for one question. The model cannot be called
  `result`; *widgeted* is to widgeting as *expressed* was to expressing.

*Bot* keeps its meaning, a model with a brief, and the brief is now a row: an `aibot` widget.
Dumdum and numnum dissolve into three seeded `aibot` widgets, and live on as their labels and
titles.

### The formulary interface

Each formulary is a class of statics in `src/lib/formulary/`, one file each, all answering one
interface. Sketched in TypeScript (the bodies, and the exact parameter types, are thread 2's):

```ts
export type Refresh = 'live' | 'click'
export type Store   = 'append' | 'upsert'

export type Formulary = {
  /** Whether the widget is well-formed: null when it is, else one sentence for the author */
  check:        (widget: WidgetT) => string | null
  /** What the widget reads: its input formula worked out over `bag`; `undefined` means "do not run" */
  input:        (widget: WidgetT, bag: QuizBag) => InputOutcome
  /** What the widgeting comes to for the question `bag` is for */
  run:          (widget: WidgetT, widgeting: WidgetingT, bag: QuizBag) => ...
  /** The meta-prompt an author copies out to get help writing this widget's formula */
  advice:       (widget: WidgetT, widgeting: WidgetingT, sample: QuizBag) => string
  /** The input formula a new widget of this formulary starts with; null when it reads nothing */
  defaultInput: string | null
  /** How a widgeted comes to be: worked out on render, asked from the cell, or neither (typed) */
  refresh:      Refresh | null
  /** How a widgeted is kept: appended as history, upserted as the one value, or not at all */
  store:        Store | null
  /** The validator for this formulary's `config` */
  config:       ZodType
}
```

| | `jsonata` | `aibot` | `entry` (thread 8) |
|---|---|---|---|
| class | `JsonataFormulary` | `AibotFormulary` | `EntryFormulary` |
| `formula` is | a JSONata expression | a mustache prompt template | nothing (empty) |
| `defaultInput` | `$` | `{ 'clueing': qn.clueing }` | null |
| `refresh` | `live` | `click` | null |
| `store` | null | `append` | `upsert` |
| `config` | `{}` | `{ servicelabel, model_tier, max_tokens }` | `{ entry_kind }` |
| `run` | synchronous; on every render | async; the browser renders the prompt, asks the ask route, and hands back the widgeted row to record | the cell's field editor commits on blur |

* **Every formulary runs over its input, never over the bag.** `input` works the widget's input
  formula out over the bag (through `Formulas.evaluate`, so the same timebox and depth limits
  hold). A `jsonata` widget's formula reads what its input formula came to; with the default `$`
  that is the whole bag, as today. An `aibot` widget's template is rendered over its input alone,
  which must be an object (`{{clueing}}` placeholders, as the prompts have now). This is what will
  make the staleness digest honest (*Deferred*).
* **An input that comes to nothing (JSONata `undefined`) means "do not run":** an `aibot` widget is
  not asked, and a `jsonata` widget is not worked out. Either way the cell is `missing`. Today's "a
  text with nothing in it is not asked about" becomes the input formula's business: the seeded
  `aibot` inputs are written to come to nothing for a blank text (*Seeds*).
* **`refresh`** is what the cell reads to decide whether it is askable (`click`) or read-only
  (`live`, and `entry`'s own editor). The runner works out `live` widgetings on render, projects
  `append` and `upsert` ones from their stored rows, and never asks a model.
* **`store`** is this record's addition to the two facts the Coach listed: the write policy needs
  saying somewhere, and saying it beside `refresh` keeps it from being inferred from it.
* **`config`** is validated by the formulary in the sense that each formulary reports its schema;
  the schemas themselves live in `src/models/widget.ts` (`WidgetValidators.jsonataConfig`,
  `aibotConfig`), so the row validator is whole without importing the formularies.
* **`advice`** generalizes `src/lib/formula-prompt.ts` to every formulary (thread 4): one
  composition, `src/lib/formulary/advice.ts`, around what each formulary says (`AdviceSpec`: its
  preamble, what its formula reads, what it should come to, its constraints). It says in words what
  shape the author wants back, since no result schema exists this sprint: for a prompt, that the
  prompt itself must name the object it wants.
* **One lookup**, `src/lib/formulary/formularies.ts`, maps a widget's `formulary` to its class. The
  runner, `src/lib/formulary/runner.ts`, walks a quiz's widgetings in run order and yields, per
  widgeting label and per question, the widgeted as read (`WidgetedT`, below), as
  `Expressed.forQuiz` does for expressings today.

### The row shapes

Four shapes: three tables, and the one form every reader takes a widgeted in. Each table's fields
come from its row validator in `src/models/`, through the bridge, as every table's do
(`convex/schema.ts`). Field types name the validator kit's aliases.

**`widgets`**, from `WidgetValidators.row` in `src/models/widget.ts` (redefined). A discriminated
union on `formulary`, like today's union `widgets` table, so each formulary's arm carries its own
`config` and its own bound on `formula`.

| field | type | notes |
|---|---|---|
| `scope` | `oneof(['pub'])`, default `'pub'` | The only value this sprint. Hunt-owned and personal widgets come later as other values here, not other tables. Fixed once made. |
| `label` | `label` | Unique within its scope; fixed once made, since widgetings and files name it. |
| `title` | `titleish`, default `''` | Blank reads as the label, titleized. |
| `description` | `noteish`, default `''` | What the widget works out, for the author choosing one. |
| `formulary` | `oneof(FormularykindVals)` | `jsonata`, `aibot` (and `entry` from thread 8). Fixed once made: the config's shape hangs on it. |
| `formula` | `jsonata`: `formulaish` (999); `aibot`: textish, at most 3600 | The JSONata expression, or the prompt template. Kept exactly as typed. The seeded prompts are near 999 already, hence the larger bound. |
| `input_formula` | `formulaish` | JSONata; defaults to the formulary's `defaultInput`. |
| `config` | `jsonataConfig`: `obj({}).strict()`; `aibotConfig`: `{ servicelabel, model_tier, max_tokens }` | `servicelabel` from `ServicelabelVals` (`src/lib/credentials.ts`), `model_tier` from `ModelTierVals` (`src/models/ask.ts`), `max_tokens` a `uint`, 1 to 8000 (twice numnum's 4000; the route refuses more). |
| `position` | `uint` | The order the library lists them. |

`WidgetValidators.widgetPatch` revises `title`, `description`, `formula`, `input_formula` and
`config`; never `scope`, `label` or `formulary`. A widget's key outside the database is
`<scope>/<label>`, `pub/dumdum`, made by `Widget.keyOf` as `keyOf` makes `tq/<label>` for an
expression today.

**`widgetings`**, from `WidgetingValidators.row` in `src/models/widgeting.ts`. Today's `widgets`
table, renamed and with its two arms collapsed into one shape.

| field | type | notes |
|---|---|---|
| `quiz_id` | `zid('quizzes')` | |
| `widget_label` | `label` | Which `pub` widget it works, by label, as `expression_label` did: labels are fixed once made, so exports round-trip with no id translation. A `widget_scope` joins it the day a second scope does. |
| `label` | `widgetingLabel` | Unique within the quiz and not reserved (*The bag*). What columns, the bag and exports name it by. |
| `description` | `noteish`, default `''` | What this widgeting is for in this quiz. |
| `params` | a record from `label` to JSON, default `{}`, size-bounded | Validated and unused this sprint; it reaches the bag. |
| `position` | `uint` | The run order (*Run order*). |

`WidgetingValidators.widgetingPatch` revises `label`, `description` and `params`. Moving one is
its own action, as today.

**`widgeteds`**, from `WidgetedValidators.row` in `src/models/widgeted.ts`. Today's `bottings`,
generalized: `reply_text` and `items` fold into `value`; the run-time facts fold into
`result_meta`; `bot_label`, `textkind` and `asked_text` go.

| field | type | notes |
|---|---|---|
| `question_id` | `zid('questions')` | |
| `widgeting_id` | `zid('widgetings')` | Keyed by widgeting, not widget: one widget can be worked twice in a quiz. |
| `status` | `oneof(['ok', 'errored'])` | What was stored. `missing` is never stored. |
| `value` | JSON, nullable, size-bounded | Untyped. Null when `errored`. |
| `message` | `noteish`, nullable | Why it errored, in the author's words; null when `ok`. |
| `result_meta` | a record of JSON, default `{}`, size-bounded | A free bag of how it ran: `model_tier_applied`, `approx_tokens`, `truncated`, and on a failure the raw `response`. Nothing reads it structurally except the views that show it. The field keeps its name. |

When it was written is the row's own `_creationTime`, as for a botting. `value` and `result_meta`
are written by hand in `convex/schema.ts` as `CVX.any()`, held to the row validator by
`tests/convex/schema.test.ts`, as a botting's `response` is now: the bridge converts recursive
JSON at run time but TypeScript cannot follow it. The size bound on `value` is one constant in
`src/lib/vv/patterns.ts`, shared by the row validator and the ask route's vetting (thread 4).

**The widgeted as read**, `WidgetedT` in `src/models/widgeted.ts`: what cells, sorts, the sheet,
the exports and the bag all take a widgeted in.

```ts
type WidgetedErrT = { message: string, at: number | null, response: JsonT | null }
type WidgetedT =
  | { status: 'ok',      value: JsonT, err: WidgetedErrT | null }
  | { status: 'errored', value: null,  err: WidgetedErrT }
  | { status: 'missing', value: null,  err: null }
```

It follows the house pattern: `WidgetedRowT` is what the table holds, `WidgetedT` what everyone
else reads, as `QuestionRowT` and `QuestionT` are. `err` holds a failure wherever there is one: on
`errored` it is the failure itself; on `ok` it is a newer failure riding along on an older value.
`at` is the failed row's `_creationTime` (null for a `jsonata` failure, worked out just now), and
`response` is its `result_meta.response`.

### The status words

`ok`, `errored`, `missing`, and no others: no `never` (a TypeScript keyword), no `unknown`, no
`not applicable` until something needs one. They replace `done`/`error` (`BottingStatusVals`, the
bag's `played`), `value`/`nothing`/`error` (`Expressed`), and null-for-never-asked.

The projection lives in one place, the runner:

* **Stored formularies** (`append`, `upsert`): the newest `ok` row is the value; a newer `errored`
  row rides along as `err`; only `errored` rows make the cell `errored`; no row makes it `missing`.
* **`jsonata`**: a value is `ok`; a failure is `errored` (a timeout stops the widgeting's other
  questions, as now); a formula that comes to nothing (JSONata `undefined`, null or `''`) is
  `missing`, shown as the muted dash `nothing` is today; a function is `errored`.

### The bag: flat, in run order, with a reserved pattern

**Flat.** A widgeting's widgeted sits at `qn.<label>`, beside the question's own fields, and under
each of `qns`, as `WidgetedT` whole: a formula reads `qn.numnum_clueing.status` and
`qn.numnum_clueing.value.items`. The JSON and TSV exports are first-class, so the bag stays flat
rather than pushing widgeteds under a sub-key.

**Run order.** A widgeting's `position` is its run order, and its bag holds the widgeteds of the
widgetings before it, on `qn` and on every question of `qns`; never its own, never a later one's.
Every earlier label is present on every question, as `missing` at the least. So position is the
dependency order, and the drag-to-reorder list (`SortableList`) is the control for it. The
default order puts the `aibot` widgetings first, as today's default layout puts the bottings.

**The bag gains, at the top level**, the widgeting's own `params` and its `widgeting_label`, beside
`qn_label` and `quiz_label`. The bag is therefore made per (question, widgeting); the per-render
cost of that is `notes/database-decisions.md`'s memoization item, not this sprint's.

**The reserved pattern.** A widgeting's label may not be:

* any key a question has in the bag: `Question.exposed` (`alt_text`, `chains_to`, `clueing`,
  `full_answer`, `hint`, `label`, `notes`, `qnum`, `title`) and `rank`, which the bag adds;
* a view a column can show of a question, `QuestionViewVals` in `src/models/column.ts`, which
  after thread 3 is `butnot` alone (*`butnot_ishes`*, below);
* `question`, `QuestionWidgetLabel`, the questions' own fields in a column's source.
* `forced_label`, the key a question carries in the hunt export and the import beside its own
  fields (`src/models/hunt.ts`, `src/models/import.ts`): a widgeting under it would have its flat
  widgeted overwrite it and break the re-import. Added by the rewidgeting sprint's thread-3 review.

The set is derived from those lists in one place and never written out as a second list.
`src/lib/vv/patterns.ts` imports nothing, on purpose, so it gains a builder beside `Label` that
takes the reserved words and returns a `Patternbag`; `src/models/widgeting.ts` hands it the lists
and builds `widgetingLabel` from it. `rank` becomes a named constant beside `Question.exposed`
(which the bag's question and the pattern both read), so it is not spelled twice. The row
validator and the quiz's integrity check (`src/models/quiz.ts`) enforce it with uniqueness among
siblings, as they do for widget labels today, and a typed label that is taken or reserved is
refused with a sentence.

**A defaulted label** is the widget's own, growing `_2`, `_3` while it is taken or reserved:
`Labelmaker.firstFree(label, taken)`, which trims the stem so the result still fits the label
pattern's 40 characters. It replaces `Labelmaker.appendFallback`'s random suffix for widgetings.
So a widget labelled `notes` is put to work as `notes_2`.

**Consequence for thread 8:** while `notes` is an exposed question field, no widgeting can be
labelled `notes`. A default `notes` entry widgeting does not read cleanly, so `notes` stays a
question field this sprint.

### `butnot_ishes`

Today `question.butnot_ishes` is a view that mirrors the chained-to question's hint ishes, which
are a fixed question field. Once replies sit under widgeting labels that vary by quiz, a core view
would have to name one seeded label (`numnum_hint`), which is code knowing a bot again. So the
view retires, and the thing it showed becomes a seeded `jsonata` widget, `butnot_ishes`:

```
(qns[label = $$.qn.chains_to]).numnum_hint.value
```

It joins the default widgetings after the three `aibot` ones. `QuestionViewVals` becomes
`['butnot']`, so `butnot_ishes` is no longer reserved and is free to be the widgeting's label. An
existing column whose source is `question.butnot_ishes` is re-pointed to source `butnot_ishes` by
the seeding mutation, the one edit it makes to a row it did not create: a matching source string
patched to another, idempotent, no shape translated. Thread 5 then has no special cell to retire
for it; it is a widgeted like the rest.

### Values the seeded `aibot` widgets come to

Settled once, so that thread 3 stores, thread 4's route returns, and the seed formulas read the
same shape. The route asks for "a JSON object" and no more; each prompt says in words what object
it wants.

| widget | input formula | `value` |
|---|---|---|
| `dumdum` | `$trim(qn.clueing) != '' ? { 'clueing': $trim(qn.clueing) }` | `{ guess: string, explanation: string }` |
| `numnum_clueing` | `$trim(qn.clueing) != '' ? { 'clueing': $trim(qn.clueing) }` | `{ items: [{ text, value, kind }] }` |
| `numnum_hint` | `$trim(qn.hint) != '' ? { 'hint': $trim(qn.hint) }` | `{ items: [{ text, value, kind }] }` |

* The items keep today's ish shape (`IshValidators.ishItem`: `text`, `value`, `kind` of `numeral`
  or `wordish`), and numnum's prompts change only their last line, from "a JSON array" to
  `{"items": [...]}`.
* Dumdum's prompt asks for the object outright (thread 4); thread 3's temporary mapping, which
  split the old one-line answer at its first line break, is gone.
* The inputs trim, as the asked text is trimmed today, and come to nothing for a blank text, so a
  blank text is not asked about. A new `aibot` widget still starts from the Coach's
  `{ 'clueing': qn.clueing }`.

The seed sums read those paths, as bare values (the `{ value, stale }` form goes in thread 3):

```
qn.numnum_clueing.status = 'ok' ? $floor($sum($append([0], qn.numnum_clueing.value.items.value)) + 0.5)
```

and the `butnot_*` sums read `(qns[label = $$.qn.chains_to]).numnum_hint` the same way. The
`status = 'ok'` guard stays: without it a `missing` cell would sum to nought, and "nobody has
asked yet" is not "the answer is nought".

### Serialization

* **The library** exports and imports on its own, apart from any hunt. Its export is
  `{ widgets: [...] }`, each widget as its fields without its position, in library order. Its
  import merges by label: a label the library lacks is added at the end; a label it holds is
  revised (title, description, formula, input formula, config); a widget whose formulary differs
  from the held one is skipped and logged rather than half-merged. Its door is the Export panel
  (thread 3); thread 6 may move it into the widget editor.
* **The mirror** (`src/lib/quizgit.ts`) writes one file per widget the quiz works, at
  `tq/widget/pub/<label>.tqwidget.json`, beside the `tq/hunt/...` tree, in place of the hunt's
  `tq/hunt/<hunt>/<hunt>.tqexpressions.json`. Only the widgets the quiz's widgetings name: the
  history follows the quiz, and a prompt edit shows up as a diff of the quizzes that work it.
* **A widgeting's exposed fields** are `status` and `value`, for every formulary: the git table's
  columns are `<label>.status` and `<label>.value`, a non-string value written as its
  `UU.jsonify`. `err` and `result_meta` are not exposed, as cost, model, time and failure are not
  today.
* **The hunt's export** (`src/lib/exporting.ts`) loses `expressions` and carries no widgets: it
  names them by `widget_label`. Each quiz carries its widgetings in run order (their fields
  without ids, quiz or position), and each question carries, flat beside its own fields, every
  widgeting's exposed `{ status, value }` under its label, the worked-out ones included, from the
  same projection the git table reads.
* **The sheet** (`src/lib/sheets.ts`) writes a widgeted column's `value` as text, a non-string as
  its JSON.
* **Imports of every kind merge by label.** A hunt or quiz import merges questions as today, and
  widgetings by label: one the quiz lacks is added when the library holds its widget, and skipped
  and logged when it does not; one it holds has its description and params revised; none is
  removed. A pasted widgeted is carried, following open PR #66 (the Coach's reversal of "replies
  are recorded by asking, never pasted"): for a widgeting that stores (`aibot`, and `entry` from
  thread 8), an `ok` value under its label is recorded as an `ok` row with
  `result_meta.imported: true`, and only into a cell that holds no row, so a pasted value never
  buries a real one; anything else under the label (an `errored` or `missing` reading, an
  unreadable value) carries nothing, and is logged. A `jsonata` widgeting's value is worked out,
  never imported. #66 marks a carried reply stale; with staleness off, the `imported` mark is what
  remains of that, for the digest to read when it comes (a carried row has no digest, so it would
  read as stale).

### Who may do what

The library is shared: every smith of any hunt may add, edit, move or remove a `pub` widget, and an
edit changes every quiz that works it. Acceptable while the users are a few friends; hunt and
personal scopes will fix it.

* **Widget and widgeting actions ride `hunts.perform`**, from a quiz on screen, like every layout
  action today, and `mayPerform` (`convex/authorize.ts`) authorizes them as it does any non-review
  action: `mayChangeHunt` on the open hunt. Being a smith of the hunt on screen is what "a smith of
  any hunt" comes to when the library is reached from a quiz. `authorize.ts`'s header says so in a
  sentence; no new rule is needed until a door to the library opens outside any hunt.
* **Removing a widget is refused while any widgeting works it**, in any hunt (thread 6). Removing a
  widgeting removes its columns and its widgeteds.
* **Reading the library**: any browser that has said who it is. It holds formulas and prompts,
  nothing of any hunt.
* **Counting usage** ("worked by N widgetings across M quizzes, in H hunts", thread 6) reads
  widgetings across hunts the ident may not be on. It returns counts only, never a label or title
  from such a hunt, and anyone who may edit the widget may see them.
* **Recording a widgeted** (`record_widgeted`, from `record_botting`) is authorized as recording a
  botting is now.

### Write policy and indexes

By formulary (`store`): `aibot` appends, history kept, as `bottings` does; `entry` upserts, one row
per (question, widgeting); `jsonata` stores nothing.

* `widgets`: `by_scope_and_position` (the library in order) and `by_scope_and_label` (lookup,
  uniqueness).
* `widgetings`: `by_quiz_id_and_position` (a quiz's run order) and `by_widget_label` (usage, and
  the removal refusal).
* `widgeteds`: `by_question_id_and_widgeting_id`, which serves the newest-first walk of one cell
  (stopped at the first `ok`, as a botting cell's is), the `entry` upsert as one read, and deleting
  a question's widgeteds; and `by_widgeting_id`, for removing a widgeting's.
* Caps in `src/lib/vv/patterns.ts`: `WidgetingsPerQuiz` (from `WidgetsPerQuiz`, 99),
  `WidgetsInLibrary` (from `ExpressionsPerHunt`, 999), and a bound on the usage read
  (thread 6). A cell's walk stays uncapped, as a botting cell's is (`notes/convex.md`).

### Seeds and the default widgetings

The library's seeds are rows, inserted by one idempotent seeding mutation when absent, not a list in
code projected as rows: on the data layer is the point.

* **The seeds fixture is `src/models/seeds.ts`**: TypeScript, so the prompts read as prose rather
  than escaped JSON; and under `src/models/` because `convex/` may import only `src/lib` and
  `src/models`, which rules out `fixtures/`. It holds two lists and nothing else: `SeedWidgets`
  and `DefaultWidgetings`. The seed texts move into it from `src/models/expression.ts` and
  `src/lib/ask/prompts.ts`.
* **`SeedWidgets`**: the thirteen seed expressions as `jsonata` widgets under their labels; the
  three prompts as `aibot` widgets, `dumdum` (quick tier, 256 tokens), `numnum_clueing` and
  `numnum_hint` (careful tier, 4000 tokens each), with `servicelabel` `claude`; and
  `butnot_ishes`, above. Seventeen.
* **`DefaultWidgetings`**, in run order: `dumdum`, `numnum_clueing`, `numnum_hint`,
  `butnot_ishes`, then the eight sums, each labelled as its widget, as the default layout's columns
  already name them.
* **The seeding mutation** is `seedWidgets`, an internal mutation in `convex/seeding.ts`, run as
  `npx convex run seeding:seedWidgets`. It inserts each seed widget whose label the library lacks;
  and for each quiz with no widgetings whose columns name any default widgeting, it creates the
  whole default set, and re-points a `question.butnot_ishes` column. A quiz whose columns name
  none (a lean quiz, from thread 7) is left alone, so the mutation stays harmless to re-run.
  *(The whole set rather than only the named ones: a column can be removed while its widget is
  kept, so a quiz showing a sum may not show the numnum widgeting the sum reads.)*
* **A new hunt seeds nothing**, and from thread 7 a new quiz starts with no widgetings.

### Names

| what | where |
|---|---|
| the formularies | `src/lib/formulary/`: `formularies.ts` (the interface and the lookup), `jsonata.ts`, `aibot.ts`, `entry.ts` (thread 8), `runner.ts`; tests in `tests/lib/formulary/` |
| the models | `src/models/widget.ts` (redefined), `widgeting.ts`, `widgeted.ts`; classes `Widget`, `Widgeting`, `Widgeted` |
| the enum | `FormularykindVals`, `Formularykind`, in `src/models/widget.ts`; the field keeps the Coach's name, `formulary` |
| the types | `WidgetT`, `WidgetRowT`, `WidgetPatch`; `WidgetingT`, `WidgetingRowT`, `WidgetingPatch`; `WidgetedRowT`, `WidgetedT`, `WidgetedErrT` |
| the seeds | `src/models/seeds.ts`: `SeedWidgets`, `DefaultWidgetings` |
| the seeding mutation | `convex/seeding.ts`: `seedWidgets` |
| the library's functions | `convex/widgets.ts` |
| the actions | `add_widget`, `edit_widget`, `move_widget`, `delete_widget`, `import_widgets` now mean the library; `add_widgeting`, `edit_widgeting`, `move_widgeting`, `delete_widgeting` the quiz's; `record_widgeted` from `record_botting` |
| the label generator | `Labelmaker.firstFree` |

`add_widget` and its siblings change meaning in thread 3: today they act on a quiz's widgets. The
clean break makes renaming in place safe; any reader of an old action log should know.

## Consequences

* **Code that goes**: `src/models/bot.ts`, `bot-label.ts`, `bot-status.ts`, `botting.ts`,
  `expression.ts`, `guess.ts`; `BotSlots`; the question fields `guess`, `clueing_ishes`,
  `hint_ishes`; `src/lib/ask/bulk.ts` and `bottings.ts`, with `bots.ts` shrinking to the services
  it reports; the job-typed contract; the `{ value, stale }` form; the per-cell `guess.tsx` and
  `ishes.tsx`. `src/models/ish.ts` keeps `ishItem`, the shape of numnum's items, and loses the
  rest.
* **Data that goes**: the `expressions`, `widgets` and `bottings` tables are cleared by hand at
  deploy, not translated (thread 3's `losses.md` and its `notes/deploy.md` ledger row). Questions,
  quizzes, columns, hunts, realms, idents, huntings, reviews and reviewings are untouched, and
  re-seeded widgetings carry the labels the existing columns name.
* **Behaviour that goes on purpose**: staleness and its greyed marks; bulk recalculation
  ("Recalculate all", the batched prompt, `bulk_ishes_last`); numnum's prose list of spans and
  dumdum's plain-text guess, which show as folded JSON (`JsonFold`) until a nicer presentation for
  objects and lists comes. Each thread that removes one says so in its PR.
* **The ask route** stays the one server function. Its contract becomes a rendered prompt, a model
  tier and token room in, a vetted JSON object out (thread 4). A free-form relay is more abusable
  than three fixed jobs: `Approval` and the credentials check stay as strict, the prompt's size is
  bounded as well as the reply's, and rate limiting moves closer. As built:
  - **The browser renders the prompt**, with mustache (`src/lib/ask/prompts.ts`), over the input
    formula's object as plain JSON (a JSONata function is dropped, never called): HTML escaping is
    off, and a value that is not a string fills in as its JSON. A template that does not parse, or
    a prompt longer than `Promptish` (16000 characters), is recorded as a failure and asks nothing.
  - **The request** (`AskContract.askRequest`) is `{ prompt, servicelabel, model_tier, max_tokens }`:
    the prompt and the widget's config, each held to the same bounds as the widget's own. The
    service names whose credential the check reads.
  - **The route** puts the prompt to the tier's model, streamed, with one line of system prompt
    asking for a single JSON object and nothing else. Structured outputs cannot hold an open
    object, and the current models refuse a prefill, so the answer is read as text: a code fence
    around it is forgiven; prose, a list or a scalar is `unreadable`; an answer the room ran out
    in is `cutShort`, a new failure kind whose sentence says to give the widget more tokens.
  - **The vetting** (`src/lib/ask/replies.ts`) clips every string to `Textish`'s 3600 characters
    and refuses, as `unreadable`, a control character in any string, a key the database would
    refuse (`Replykey`: printable ASCII, not opening with `$`), nesting past 15 levels, a list of
    more than 2000 items or an object of more than 1024 keys (`ReplyShape`: the database nests a
    row 16 levels deep at most, the value one of them), and a reply past `WidgetedJson`'s 40000
    characters.
  - **The reply** is `{ ok: true, value, truncated, model_tier_applied, approx_tokens }`; the
    browser records `value` as the widgeted's, the rest as its `result_meta`.
* **Two editors with two scopes** (thread 6): the widgeting editor from the quiz page, and the
  widget editor from the library, so the author always knows which they are in.

## Deferred

### Staleness: designed, and off this sprint

There is no `stale` on a widgeted this sprint: the ishes' `asked_text` comparison goes with
`bottings`, the seeds' `{ value, stale }` form becomes a bare value, and the grid's greyed marks
disappear. The Coach accepted that. The design, for the sprint that builds it:

```
input_data = input_formula(bag)                    -- may carry `_dependencies`
digest     = hash(jsonify({ formula, config, input_data }))
input_data = input_data without `_dependencies`    -- what the template renders over
stale      = stored.digest !== digest
```

* **Nothing is inferred from a formula.** The input formula is the author's statement of what the
  widget reads; every widget's bag holds everything before it, so nothing could tell which of it
  an arbitrary input was built from.
* **Each widgeted publishes its `digest` forward** in the bag, beside `status` and `value`. A
  widget that reads another's widgeted declares it by naming that digest in `_dependencies`:
  `{ 'items': qn.numnum_hint.value.items, '_dependencies': [qn.numnum_hint.digest] }`. The field
  is folded into the widget's own digest and stripped before the template renders.
* **`stored` is the newest `ok` row**, never a newer errored one; with none the cell is `missing`
  and nothing is compared.
* **What is in the digest**: the formula text and the config, so an edited prompt or another model
  tier stales what came before; and the input's output. Not the input formula's own text (its
  output stands in), the widgeting's label or description, `result_meta`, or the model id behind a
  tier.
* A `jsonata` widget stores nothing, so its staleness is only what its declared dependencies give
  it. An `entry` value, typed, is never stale.
* The hash is `UU.jsonify` (stable: keys sorted at every depth) then `crypto.subtle`, which every
  browser and Convex's runtime have: no dependency. The `digest` column arrives with that sprint,
  as the widening half of a migration, and `stale` and `digest` join `WidgetedT` then.
* This sprint nothing strips `_dependencies`; an input that names it renders it.

### Also left for later

* **Bulk recalculation**, for pasted prompts or any other. The batched run was already slower than
  it should be, which is worth a look of its own when bulk returns.
* **Result typing.** Every value is JSON. If typing is ever wanted, the Coach's answer is a choice
  between `string` and `object`, and no more.
* **Scopes beyond `pub`**: hunt-owned and personal widgets, as values of `scope`.
* **Moving `hint`, `alt_text` and `notes` off the question row** into `entry` widgeteds: a data move
  the export, sheet, import and mirror would follow. `chains_to` stays core regardless.
* **`script` and `api` formularies.**

## Settled here

Calls this record made where the sprint plan left them open. Each is a two-way door until the code
that builds on it lands.

1. **The record's form**: plain (context, decision, consequences, deferred), since no earlier
   record is in the tree.
2. **Names**: `src/lib/formulary/` and its files; `widget.ts`, `widgeting.ts`, `widgeted.ts`;
   `WidgetedT` for the read and `WidgetedRowT` for the row; `FormularykindVals`; the classes
   `JsonataFormulary`, `AibotFormulary`, `EntryFormulary`; `Labelmaker.firstFree`.
3. **A third reported fact, `store`**, beside `defaultInput` and `refresh`.
4. **Config schemas live in the model**, reported by each formulary; the widget row is a union on
   `formulary`, with a larger bound on an `aibot` formula (3600) than a `jsonata` one (999), and
   `max_tokens` at most 8000.
5. **Every formulary runs over its input**, and an input of nothing means `missing` for `jsonata`
   as for `aibot`. A `jsonata` value of null or `''` is `missing` too, as `nothing` is today.
6. **`WidgetedT`'s `err`** carries `message`, `at` and `response`, on `errored` as on `ok`; the bag
   carries `WidgetedT` whole; the exposed fields are `status` and `value`.
7. **The bag gains `params` and `widgeting_label`** at the top level.
8. **The seeds fixture is `src/models/seeds.ts`**, TypeScript; the seeding mutation is
   `convex/seeding.ts`'s `seedWidgets`.
9. **The default set is created whole** for a quiz whose columns name any of it, refining the
   plan's "only what columns name".
10. **The bag's new paths and the `aibot` values**: `qn.dumdum`, `qn.numnum_clueing`,
    `qn.numnum_hint`; `{ guess, explanation }` and `{ items }`; the seeded input formulas trim
    and come to nothing for a blank text.
11. **`butnot_ishes` becomes a seeded `jsonata` widget**; the view retires, `QuestionViewVals` is
    `['butnot']`, and the seeding mutation re-points the one column source. The alternative, a
    view reading the fixed label `numnum_hint`, keeps a core view knowing a bot.
12. **Serialization**: `tq/widget/pub/<label>.tqwidget.json` in the mirror, only for the widgets
    the quiz works; the library's own `{ widgets }` export; the hunt export's flat widgeteds; the
    import's widgeting merge, and its refusal of a changed formulary.
13. **Pasted widgeteds are carried** into empty cells of stored widgetings, marked
    `result_meta.imported`, following open PR #66 rather than today's "never pasted". Should #66
    be withdrawn, the rule reverts to dropping them, and nothing else here moves.
14. **Authorization**: widget actions ride `hunts.perform` under `mayChangeHunt`; the library is
    readable by any ident; usage is counts only.
15. **Indexes and caps**: as listed under *Write policy and indexes*.
16. **`notes` cannot be a widgeting's label** while it is a question field, so thread 8 keeps
    `notes` on the question.
