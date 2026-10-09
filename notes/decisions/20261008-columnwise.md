# Columnwise: columns lead, entries gain families, a column gains an expression

**Status:** accepted, 2026-10-08. The design is the Coach's (Flip), settled in chat
(`whiteboard/20261008-columnwise/preplan.md`); this record was written by the columnwise
sprint's thread 1 and is what its later threads build to. Read it before the preplan: where the
two differ, this record is the later word. Each piece names the thread that builds it, by the
sprint plan's numbers (`columnwise-plan.md`).

**Revises** `notes/decisions/2026-10-widgets.md`: its reserved pattern, its entry kinds, the
parts in a column's source, and "removing a widgeting removes its columns" (*Superseded*, at the
end). `notes/vocabulary.md` carries the words.

**The ask.** Adding a column a person can type into took nine clicks through three nested
dialogs, one of them admin-only. The author's intent is a spreadsheet's "add a column": the column
leads, and the library and the run order become the advanced views they are for most authors.

## 1. Entries run first (thread 2)

An entry depends on nothing: `EntryFormulary.input` is always `missing`, and it has no formula.
So every entry widgeting, of either tier, runs ahead of every other widgeting, and the run-order
list shows the entries at its head, not draggable. What is dragged is the `live` and `click`
widgetings of both tiers, mixed as placed. `position` stays on the row; the order among entries
is arbitrary and harmless. The runner and the list agree: entries first, then the rest by
position.

**This holds only while an entry reads nothing.** A family with a computed default, or parts
that read another widgeting, would bring a dependency back, and with it the order. Such a thing
is not an entry; build it as a formula, or revisit this rule first. (The estimates parts read the
hunt's total order, the run's place, not a widgeting: they are fine.)

A quiz whose formula named an entry placed after it now reads the entry's value where it read
nothing. That is the point; nothing else moves.

## 2. Entry families (thread 2; a free regex, thread 6)

**What is frozen lives on the widget; what is revisable lives on the widgeting.** A family is
the cell editor and the value's type: a number stored where text is expected breaks formulas,
sorts and the editor, so it is fixed once the widget is made, as `entry_kind` is now (the
family *is* the `entry_kind`). Constraints are revisable: a raised minimum bites only on the next
edit, since nothing validates rows read back. So the constraints are the widgeting's `params`.
One entry widget per family; the library gains one only when a new editor does.

| family | params | editor | runs at `quiz` |
|---|---|---|---|
| `number` | `min`, `max`, `integer` | `NumberField`, the params driving `signed` and `fractional` | yes |
| `text` | `max_length`, `pattern`, `regex`, `lines` (`one` or `many`) | `PlainField` (one) or `StretchField` (many) | yes |
| `boolean` | none | a checkbox; an emptied cell is `missing`, so tri-state for free | yes |
| `enum` | `options`, a list of one-line strings, each once | a select | yes |
| `estimates` | none, as now | pills | no |

* **`params` are validated per family.** Each family's params is a small Zod object in
  `src/models/widget.ts`, beside `entryConfig`. No JSON Schema, no schema library.
* **`paramsOf(widget)`** joins the formulary interface: the validator for a widgeting's params,
  given its widget, beside the `config` validator each formulary reports. `entry` hands back the
  family's; `jsonata` and `aibot` the open record `params` is now; `liquidize` its own (§3). It is
  the one source a generic params editor is drawn from (thread 5a's folded line, thread 7's
  template fields, thread 6's regex).
* **Checked where a widgeting is written**: on the server by `addWidgeting` and the widgeting
  patch (which already fetch the widget, `widgetForLabel`), in the browser by the planner
  (`src/lib/widgeting-edit.ts`), which has the library.
* **`EntryFormulary.valueOf(widget, widgeting)`**: what one cell may hold, by the family and the
  params in force.
* **Default params on the widget.** `config` gains the family's params, each optional, beside
  `entry_kind`. The params in force are the widget's, overlaid key by key by the widgeting's. An
  admin seeds `difficulty` as a number entry of 1 to 10; a widgeting may still say otherwise.
* **`pattern` is a named pattern**: `label`, `oneline` or `url`, each a pattern of
  `src/lib/vv/patterns.ts`. Never a bare `new RegExp` over author text but through
  `lib/regexes.ts`, and only once the pattern is through the ReDoS check.
* **`regex` is the author's own** (thread 6): `{ source, flags }`, beside `pattern` (a cell
  matches both), one line of at most 200 characters, flags of `i`, `m`, `s` and `u`, in that
  order. The ReDoS answer is recheck (the Coach's ruling): a pattern is checked where a mutation
  writes it (`addWidgeting`, `editWidgeting`, `addWidget`, `editWidget`, `importWidgets`, which a
  quiz's import reaches through its actions), unless the row already held it, and refused unless
  recheck calls it `safe`. Past that boundary it is trusted: compiled once and handed to Zod as
  each cell is checked. The browser's `RegexField` asks recheck as a courtesy, as the pattern is
  committed; the planner holds the pattern only to the params validator (its length, its flags,
  that it compiles), since recheck in the browser answers asynchronously.
* **`labelish` and `titleish` are presets of `text`** (`pattern: 'label'`, one line; `pattern:
  'oneline'`, one line, a title's length). Not offered for a new widget; rows holding them stay
  valid, and their cells are drawn as now.
* **`Widgeting.runsAt`** answers per family, by the table. The *Quiz entries* panel types into a
  `quiz` entry with the cell the grid uses, the checkbox and the select included.
* **Every params field produces its own sentence** when it refuses (§8). No field leans on a
  dialog's Apply to say what is wrong.
* **Seeds**: one entry widget per new family. A seeded label is never a reserved word (§9): not
  `number`, `text`, `boolean` or `enum`, which the `types` group reserves.

Additive to the schema: `EntryKindVals` widens, `config` gains optional fields, `params` was
already there and tightens at the entrypoint, never on read. No migration.

## 3. The `liquidize` formulary (thread 7)

A `jsonata` widget's twin with Liquid. `src/lib/formulary/liquidize.ts`, `LiquidizeFormulary`.

* `refresh` `live`, `store` null, runs at either tier. Worked out at its place in the run order,
  over the bag a formula gets there; `input_formula` is `$` by default, and the template is
  filled in over what the input came to, as an `aibot` prompt is over its.
* **Where the template comes from**: the widget's `formula`, a static template, is the admin's
  default. The widgeting's params may hold a `template` of its own, or a `template_from` of
  `{ ref, formula }`, whose text is read from the bag: `ref` a plain key in the column's grammar
  (§4), `formula` JSONata over what it names, coming to a string. At most one of the two; either
  overrides the widget's. `paramsOf` reports the validator. *Thread 7:* the pair reads as a
  column's ref and formula do: an absent formula is identity (a field itself, a widgeting's
  `value`), not `$`, which for a widgeting is the whole widgeted; and a `missing` or `errored`
  widgeting passes the formula by, so a bot not yet asked makes the template `missing`.
* **Output is always a string**, markdown by convention: a column showing it defaults to the
  markdown readout and sorts as text. An empty fill is `missing`; a template that will not parse,
  or a `template_from` that comes to no string, is `errored`, with Liquid's own sentence as
  `Templating.fill` returns it.
* **Budgeted by the column** (*the Coach, on thread 7's review*): a fill stopped by a limit (its
  time, `Liquidry.RenderMs`; our counted budgets; Liquid's allocation limit) stops its column,
  every later question reading the same failure, as a `jsonata` timeout does; and the whole column
  has one budget of time for all its fills (`LiquidizeFormulary.columnMs`, 250 ms), so many
  medium-slow fills cannot add up to the same harm. The budget is asked between a template's
  pieces and at every turn of a loop, never inside one filter's call: a slow filter, or a huge
  range handed to one, runs to its end first (thread 9, *compute budgets*, takes that on, with a
  column's own template, the templateable fills and a cap per run). Time is read on `performance.now()`, which
  moves inside a Convex mutation where `Date.now()` stands still. A template that will not read
  costs only its own cell: one read from the bag differs question by question.
* **One fill path.** Through `Templating.fill`, shared with the templateable nomination (§5),
  which is "liquidize this source over the finished bag, in place". Whether the nomination is
  rebuilt internally as a `liquidize` is the worker's call; it is not a row change.
* Arms in the runner, the advice, the widget editor and the Widgets panel, beside `jsonata` and
  `aibot`; a seeded `liquidize` widget.
* Later, not now: the recap template as a quiz-tier `liquidize` over `qns` (to
  `whiteboard/TODO.md`).

## 4. The column: a short pipeline (threads 3a, 3b)

A column is a **ref** that picks one thing from the bag, a **formula** that works a value out of
it, a **template** that makes text of the value, and a **readout** that draws the text. Each stage
is optional and absent by default; a column of a ref alone shows what columns show today.

### The ref: one plain key (3a)

`source` keeps its field name and holds a **ref**: one plain key, in the bag's own words,
resolved against `qn` first and then the bag's top level.

* Against `qn`: a question's field (`title`, `clueing`, `rank`, `archived`, any key a question has
  in the bag), the question's view `butnot` (worked out as now; not in the bag, and reserved
  from widgeting labels as a field is), or a `question` widgeting's label.
* At the top level: `quiz`, `hunt`, `realm`, `categories`, `qns`. A value the same in every row is
  still worth a column when the formula pulls an answer out of it.
* **The one dotted form is `quiz.<label>`**, a `quiz` widgeting's widgeted.
* Nothing else. A column never names a column: the ref space is the bag's, and the column label
  space stays its own. The two lookups never collide, because every top-level bag word is
  reserved from widgeting labels (§9).

The grammar before October 2026 (`question.<field>`, `<widgeting>.<part>`) is read by the
readers until 3c, and by the importer for good (§10). `QuestionWidgetLabel` and
`WidgetingPartVals` leave the column grammar at 3c; `Estimates` keeps its own list of parts.

### The formula (3a reads it, 3b authors it)

`formula` is JSONata, the field's name by the exact parallel with a widget: a `jsonata` widget is
an input formula culling the bag and a formula over what that came to; a column is a ref picking
a thing and a formula over it, in the same language, through the same evaluator and limits
(`Formulas.evaluate`, its timebox and depth guard; `lib/formulas.ts` stays the one importer of
`jsonata`). The bend in the parallel: a widget's formula is a prompt for `aibot`; a column's is
only ever JSONata.

**Its input is the thing as the bag holds it**: a field is the field; a widgeting is the whole
widgeted, `{ status, value, err }`, with an estimates entry's parts beside them. So `$.masie` is
a persona's chance and `$.value.guess` is dumdum's guess. **Identity is the field's absence**,
which shows a field itself and a widgeted's `value`, as today; an emptied formula box removes the
field. `$` is not identity for a widgeting: it reads the whole widgeted.

The formula's own outcome reads as a `jsonata` widgeted's does: a value is `ok`, nothing (JSONata
`undefined`, null, `''`) is `missing`, a failure is `errored` and shows the badge.

**Three rules make it a view, not a second widgeting.**

1. **It is not in the run order**, enters no bag, and nothing reads it. Its input is the one thing
   picked, never the bag, so combining two things is a widgeting, mechanically.
2. **It runs only on an `ok` widgeted**: `missing` and `errored` pass through, so the dash and
   the badge keep working and nobody writes `$.status = 'ok' ? …`. A field, and a top-level
   word, has no status and is always worked on. *Thread 3a:* a `missing` widgeted the bag carries
   parts beside is worked on too: an empty category-estimate cell reads as one estimate of no
   category in particular, and its part columns showed 53% for it before October 2026.
3. **An entry cell is editable only while the formula is identity and there is no template.** A
   rounded number has no inverse to type into. The pills likewise. Identity skips evaluation, so
   the common case costs nothing.

### The template and the readout (3b)

* **`template`** is Liquid, filled in through `lib/templating.ts` over the question's template bag
  (`Templating.bagOf`) with the value the formula came to added at the top level as `value`:
  own keys only, under the fill's budgets. Named for its role, not its engine, as `formula` is
  not `jsonata`. No mustache anywhere new.
* **`readout`** is one of `plain` (the text as itself), `markdown` (our dialect, then the
  sanitizer), `code` (verbatim, monospaced) or `label` (as the Title cell draws a question's
  label). Absent, a column draws as the cells choose today; a column with a template, or showing
  a `liquidize`, defaults to `markdown`.
* **What a computed widgeting came to reaches markdown with its images made links**
  (`Templating.bagOf`'s rule, `![` written `&#33;[`), whether as the template's `value` or under a
  markdown readout. A `jsonata`, `aibot` or `liquidize` value never draws an image; only text a
  person typed does.

### Collapsed (3b)

A double-click on a column's head collapses it to its turned header's unpadded height, and
another restores it. `collapsed` is an optional boolean on the column, beside the `width_px` it
keeps for the return; it is a state, not a width, so it sits below `WidthPxMin`. The grid draws a
collapsed column with its turned header (`headkind: 'vertical'`) and empty cells. The sheet is
unchanged by it.

### The sheet and the sorts (3a)

The grid's TSV is built from the column specs (`specsFor`), so every stage lives there and the
sheet carries what the column shows: the ref, the formula, the template. The raw export carries
rows, not the grid, and is untouched; nothing imports the sheet. **A sort reads the value the
formula came to**, never the template's text, under the existing rules (`Sortings.sortValueOf`):
a number dressed by a template still sorts as a number.

### The source menu (3b)

One menu for every column: every question field and view, every `question` widgeting's output,
`quiz`, each `quiz.<label>`, `hunt`, `realm`, `categories`, `qns`; the formula beside it.

* **Field-name lists where the thing's schema is known**: a question, the quiz, an estimates
  entry's parts. A `jsonata`, `aibot` or `liquidize` source has no result schema, and stays
  without (result schemas come the day something else needs them): it offers "other", the
  formula box.
* **The parts are expression presets**: `$.masie`, `$.average`, `$.estimates`. The parts stay on
  the widgeted in the bag, where formulas read them (`Estimates.partsOf`).
* **The seeded sums that reshape one widgeted are presets too** (thread 8): beside a widgeting of
  `numnum_clueing`, `numnum_hint` or `butnot_ishes`, by the widget's label, the column offers the
  two sums (`SeedPresets` in `src/models/seeds.ts`), naming the column as the seeded sum
  (`hint_full`, *Hint Full Sum*), and stands in for it but in one thing: a spotter whose ask failed
  with no earlier `ok` reply shows the badge through a preset (a column passes an `errored`
  widgeted by), where the seeded sum shows the dash. A seed knows its own reply's shape, so this is the one place a
  bot's result is offered presets. The sums reading two things or another question (`butnot_*`,
  `clueing_plus_*`) stay widgets, and **the four reshaping sums stay seeded too**: a sum's cell
  re-asks its spotter on a double-click, which a formula'd column (read-only) does not, and a quiz
  laid out before the library (`seeding:seedWidgets`) is given them.
* Build the fields as components thread 5a can lift into the folding editor, not as dialog state.

**The builtin fields stay** (ruled): a label, an answer and a Q# are worth special machinery. The
regularity rule, for a worker who finds a builtin making extra code appear: write "let any
schematized output do what builtin X does" and make X regular, never a workaround so X behaves
like a schematized output. Presenting the fields as virtual readonly widgetings inside
`Runner.sourceOf` is an internal tidy, not a row change.

## 5. Templateable, and a column's template (3a renames)

Two things share the word, and are kept apart in names, docs and UI copy:

* A **templateable** source is one whose own stored text is a template: nominated per quiz and
  per source, never per column (`quizzes.templateable`, from `templated`; the action
  `set_templateable`, `TemplatedEditor.tsx` renamed with it). Its filled text is what has been
  *templated*. Named in the plain-key grammar: a question's markdown field (`clueing`, `hint`,
  `full_answer`, `notes`, `recap`) or a `question` widgeting's label.
* A column's **template** is how one column draws a value, and touches no stored text.

## 6. The render pipeline, in order

1. **The run**, in run order (entries first), `liquidize` steps among it, each over the bag as of
   its place.
2. **The templateable sources filled in** over the finished bag (`Templating.bagOf`, after every
   widgeting has run).
3. **The column's ref**; a templateable widgeted now carries its filled text as its `value`.
4. **The column's formula.**
5. **The column's template.**
6. **The readout.**
7. **Markdown, then the sanitizer**, always last.

Two warnings:

* **The nomination fills at the end, never in run order.** A formula at position 3 reads the
  template as typed. A template that a later formula must read filled in is a `liquidize`.
* **A nominated or liquidized `aibot` runs model output as a template**: bounded as Liquid is
  (interpreted, own keys only, budgeted), and noted in `notes/security.md`.

## 7. Folding editors, columns leading (threads 5a, 5b)

* **The folded fields are a formulary fact**, beside `refresh` and `store`: an entry's family
  params, a `jsonata` widget's formula line, a `liquidize` widgeting's template line, nothing for
  `aibot` (a prompt does not fold).
* **The full panel is the folded line with more rows**: one component, the same fields in the
  same order, the fold hiding those below the first. `use-folds` keeps the fold per key, so it
  survives a reopen.
* **The column row leads** (`ColumnsEditor.tsx`). Its widgeting's folded line is a second row
  beneath it, not more fields in the same one (the row gives way under container queries,
  `RoomFor`), unfolding into the full widgeting panel. Several columns showing one widgeting each
  carry a copy; the quiz's watch keeps them in step. The widgeting's own panel lists its columns'
  foldables.
* **The column and widgeting dialogs retire**: the gear becomes an unfold, every field commits as
  it is made (§8).
* **The widget stays behind its door.** An edit to a widget is global and admin-only, and changes
  every quiz that works it; it keeps the widget editor, the usage line in front. The library modal
  and the toolbar's door are untouched.
* ***+ New column…*** gains "a new entry…" (any smith: an entry widgeting of a seeded family and
  its column, in one go, `planWidgetingEdit`) and, for an admin, "a new widget…".
* **The run-order sorter is in both places** (5b): the *Widgets* panel below the grid gains drag
  handles, its open state the widgeting's full panel (so a columnless widgeting is edited there);
  the manage dialog's *Widgetings* section becomes *Run order*, the drag list alone, tier marks
  kept. Entries at the head of each, not draggable. Both dispatch `move_widgeting`.
* **A one-question row preview in the column editor** (5b): a pulldown of the quiz's question
  labels (`use-preview-bag`'s picker, quiz select dropped), beneath it that question's
  `QuestionRow` drawn from `specsFor` and the quiz's run, read-only, grip, checkbox and ask
  handlers off.
* *As built (5a):* a `jsonata` widgeting's folded line is its widget's formula **read-only**, the
  widget being behind its door (an admin's *Edit the widget…* is in the open panel); a widgeting
  is not renamed before it is made but after, so **a column still headed as `namesFor` heads what
  it shows follows** a change of its ref, its formula (a part picked) or its widgeting's label
  (`retitledPatch`; `planWidgetingEdit`), and a header the author wrote stays. Whatever is made
  arrives open. *+ New widgeting…* and *+ New quiz widgeting…* stay beside the run order, the
  catalogue made at once as it is picked, until 5b moves them.

## 8. Removal, and the commit model (thread 4; 5a everywhere)

**Removal is one rule: a thing goes only once nothing shows or works it**, and the author clears
references from the outside in. A widget is removed only while no widgeting works it (as now);
a widgeting only while no column shows it, whole or a part, in either grammar until 3c; a column
freely. `delete_widgeting` refuses instead of cascading to columns, on the server and in the
browser (through the column model's `resolve`), with the sentence `ConfirmRemove`'s `refusal`
carries. Deleting a quiz still cascades: that is the quiz going.

What does not hold a widgeting back: a formula, a template or a `template_from.ref` naming it,
which reads `missing` afterwards, as a formula naming a removed widgeting does now; and its
templateable nomination, a mark on the source that goes with it, as now. A dangling column (its
ref naming a widgeting the quiz lacks) can then arise only through an import.

**Every change commits as it is made** (on blur, drop or click), undone by changing it back, with
the quiz's history as the record. No Apply, no Cancel. **The exception is a change with
consequences, such as a label**, which other things name: it keeps an explicit button, as the
hunt's *Rename* and *Relabel* have now. The manage dialog's Apply becomes a *Relabel* button
beside the quiz label; its Cancel becomes *Done* (thread 4). The nested dialogs' batching goes
with the dialogs (5a): put no new work into it. Every field's validator produces its own
sentence, as `ColumnRow.commit` does; the family params are the new case.

## 9. Reserved words (thread 2 lands them; 3c adds `categories`)

The Coach's rule: easier to take a word off later than to add one. Two namespaces.

### Per quiz: `ReservedWidgetingLabels` (`src/models/widgeting.ts`)

Where the bag's flat keys live. Today: `Question.exposed`, `rank`, `archived`, `secondary`,
`position`, `viz`, the stamps, `butnot`, `question`. Each addition is derived from the list that
defines it, never written out twice; where that list does not exist yet, it is written once in
the model that will own it, and the thread that adds the fields holds them to it by a test.

| group | words | derived from |
|---|---|---|
| bag's top level | `hunt`, `realm`, `quiz`, `qns`, `qn`, `qn_label`, `quiz_label`, `params`, `widgeting_label`; `categories` at 3c | the quiz bag's keys. `src/models/quiz-bag.ts` imports `quiz.ts`, which imports `widgeting.ts`, so the list sits beneath `widgeting.ts` and a test holds `QuizBagValidators.quizBag`'s shape to it |
| recap bag | `number` | the recap's place-from-1 (`Templating.inOrder`) |
| import | `forced_label` | the key an older export's question carries (`src/lib/jsonball.ts`) |
| widgeted's keys | `status`, `value`, `err`, `message`, `result_meta`, `digest`, `stale` | `WidgetedT`, the widgeted row, and the deferred staleness pair |
| column's fields | `source`, `formula`, `template`, `readout`, `collapsed`, `width_px`, `align` | `ColumnValidators.column`'s shape, once 3a gives it the four new fields |
| estimates' keys | `masie`, `artie`, `poppy`, `estimates`, `average` | `PersonaLabelVals`, and the parts list `Estimates` keeps |

`forced_label` was reserved (`c278b471`) and dropped when the override retired (`e03bd267`), but
the importer still reads it: a widgeting under it has its flat widgeted read as the question's
label. `2026-10-widgets.md` still says it is reserved.

`categories` waits for 3c: it is the seeded estimates widget's label until 3a renames it
`category_data`, and the note in `patterns.ts` that exempts it goes then.

### Every label: `ReservedLabelGroups` (`src/lib/vv/patterns.ts`)

`patterns.ts` imports nothing, so these are written out there, as groups beside `fields`,
`models` and the rest. A word in two groups is harmless; each group says why.

* **`types`**: `string`, `number`, `integer`, `float`, `boolean`, `object`, `array`, `list`,
  `json`, `date`, `time`, `datetime`, `enum`, `text`.
* **`engines`**: `liquid`, `mustache`, `template`, `templates`, `templated`, `js`, `ts`,
  `javascript`, `typescript`, `wasm`, `rust`, `python`, `py`, `apicall`, `worker`, `workers`,
  `script`, `scripts`, `code`, `eval`, `exec`, `html`, `css`, `sql`, `yaml`, `xml`, `markdown`,
  `md`, `bbcode`, `bbjank`, `prompt`, `prompts`, `formula`, `formulas`, `formulary`,
  `formularies`, `regex`.
* **`aggregates`**: `average`, `avg`, `mean`, `median`, `stdev`, `sum`, `total`, `count`, `min`,
  `max`. A widgeting wanting one says of what: `clueing_sum`.
* **`jsonata`**: `and`, `or`, `in`, `function`. A path cannot say them: `qn.and` will not parse.
* **`status`**: `result`, `results`, `error`, `errors`, `ok`, `stale`, `missing`, `current`,
  `blank`, `default`, `defaults`.
* **`grid`**: `row`, `rows`, `col`, `cols`, `cell`, `cells`, `header`, `headers`, `index`, `idx`,
  `sort`, `order`.
* **`self`**: `self`, `this`, `me`, `it`, `name`, `names`, `data`, `item`, `items`, `object`,
  `root`, `parent`.

A global word is refused for every label: hunt, realm, quiz, question, column, widget,
widgeting, ident. The row validators and the quiz's integrity check (`src/models/quiz.ts`) refuse
a reserved label as they do now. Nothing rewrites a row already holding one; before thread 2
deploys, the Coach checks production for labels the new words catch. An import holding one is
refused, with a sentence naming the word (thread 2). No seeded label may be a reserved word.

## 10. Schema: the `columnwise` chain, and the importer's promise (3a widens, 3c tightens)

`notes/deploy.md`'s dance (*Schema pushes*, *Serial Deploy*), on the model of the ledger's
`20261006-recap_widen`; one chain, `columnwise`.

* **Widen (3a)**: `columns.source` accepts both grammars; `formula`, `template`, `readout` and
  `collapsed` arrive optional, absence meaning identity, the default readout and not collapsed;
  `quizzes.templateable` arrives beside `templated`.
* **Backfill (3a)**, in order: `categories` becomes `category_data` (the widget's `label`; each
  widgeting's `widget_label`; each widgeting labelled `categories` or `categories_<n>`; each
  column source and each nomination naming one); the source grammar (`question.<x>` to `<x>`;
  `<w>.<part>` to `<w>` with `formula: '$.<part>'`; a plain label left); `templated` copied to
  `templateable` in the plain form. Writers write the new from 3a on.
* **Tighten (3c)**: `source` and a templateable source are a plain key or `quiz.<label>` only;
  `quizzes.templated` goes; the readers' fallbacks go; `categories` joins the reserved words, so
  the integrity check refuses what the backfill missed.
* **What nothing rewrites**: an author's formula reading `qn.categories`, which reads `missing`
  afterwards. The ledger row says so; the Coach greps the raw export before 3a deploys.
  `Estimates.isEstimating` reads the entry kind, not the label, so the spread and the personas are
  untouched.

Everything else this sprint is additive and needs no chain: `EntryKindVals` widened, optional
`config` fields, `params` tightened at the entrypoint.

**An export is a promise: the importer reads every shape the exporter has ever written.** A
paste from before the sprint translates on the way in, as the backfill does: its column sources
and nominations (`question.<x>`, `<w>.<part>`), its `templated`, its `categories` widget and
widgetings. Named in the code as "the grammar before October 2026", so the someday scan in
`whiteboard/TODO.md` finds each such reading. The exporter writes only the plain form.

## Superseded in `2026-10-widgets.md`

* *The reserved pattern*: `forced_label` is not reserved in the code; §9 restores it, with the
  rest of the lists.
* *Entries*: the four kinds become families with params (§2); `valueOf` takes the widgeting; the
  parts are a column formula, not a source (§4).
* *Who may do what*, and the vocabulary: "removing a widgeting removes its columns" becomes §8's
  rule.
* *The quiz tier*: "a column naming a quiz widgeting is refused" gives way to the ref
  `quiz.<label>` (§4).
* The formula table: a fourth formulary, `liquidize` (§3).
