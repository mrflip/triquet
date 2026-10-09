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
  medium-slow fills cannot add up to the same harm. The clock is read inside a filter's call too,
  and the column's own template, the templateable fills and the run as a whole are budgeted alike:
  §11. Time is read on `performance.now()` (`Clock.clockNow`), which moves inside a Convex
  mutation where `Date.now()` stands still. A template that will not read costs only its own cell:
  one read from the bag differs question by question.
* **One fill path.** Through `Templating.fill`, shared with the templateable nomination (§5),
  which is "liquidize this source over the finished bag, in place". Whether the nomination is
  rebuilt internally as a `liquidize` is the worker's call; it is not a row change.
* Arms in the runner, the advice, the widget editor and the Widgets panel, beside `jsonata` and
  `aibot`; a seeded `liquidize` widget.
* Later, not now: the recap template as a quiz-tier `liquidize` over `questions` (to
  `whiteboard/TODO.md`).

## 4. The column: a short pipeline (threads 3a, 3b)

A column is a **ref** that picks one thing from the bag, a **formula** that works a value out of
it, a **template** that makes text of the value, and a **readout** that draws the text. Each stage
is optional and absent by default; a column of a ref alone shows what columns show today.

### The ref: one plain key (3a)

`source` keeps its field name and holds a **ref**: one plain key, in the bag's own words,
resolved against `question` first and then the bag's top level (`qn` until thread 10, §12).

* Against `question`: a question's field (`title`, `clueing`, `rank`, `archived`, any key a question has
  in the bag), the question's view `butnot` (worked out as now; not in the bag, and reserved
  from widgeting labels as a field is), or a `question` widgeting's label.
* At the top level: `quiz`, `hunt`, `realm`, `categories`, `questions` (`qns` until §12). A value the same in every row is
  still worth a column when the formula pulls an answer out of it.
* **The one dotted form is `quiz.<label>`**, a `quiz` widgeting's widgeted.
* Nothing else. A column never names a column: the ref space is the bag's, and the column label
  space stays its own. The two lookups never collide, because every top-level bag word is
  reserved from widgeting labels (§9).

The grammar before October 2026 (`question.<field>`, `<widgeting>.<part>`) was read by the
readers until 3c, and is read by the importer for good (§10), from `src/models/before-october.ts`.
Since 3c the column grammar knows no parts: `Estimates` keeps its own list (`Estimates.PartVals`),
and a part column is named by its preset (`ColumnMenu`'s part presets carry their names).

### The formula (3a reads it, 3b authors it)

`formula` is JSONata, the field's name by the exact parallel with a widget: a `jsonata` widget is
an input formula culling the bag and a formula over what that came to; a column is a ref picking
a thing and a formula over it, in the same language, through the same evaluator and limits
(`Formulas.evaluate`, its timebox and depth guard; `lib/formulas.ts` stays the one importer of
`jsonata`). The bend in the parallel: a widget's formula is a prompt for `aibot`; a column's is
only ever JSONata.

**Its input is the thing as the bag holds it**: a field is the field; a widgeting is the whole
widgeted, `{ status, value }` (its failure not in the bag since §12), with an estimates entry's parts beside them. So `$.masie` is
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
a number dressed by a template still sorts as a number. *Amended by thread 9:* a sort is worked out
in the browser, over the run it already holds (`Sortings.sortedIdsOf`); the `sort_questions` action
carries the order, every question's id, and the server checks it holds exactly the quiz's questions
(`sortStale` otherwise) and commits it with the sortkey. No mutation runs the quiz.

### The source menu (3b)

One menu for every column: every question field and view, every `question` widgeting's output,
`quiz`, each `quiz.<label>`, `hunt`, `realm`, `categories`, `questions`; the formula beside it.

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
* *As built (5b):* **the run order's two homes share one list** (`RunOrderList`, split by
  `runOrderListsOf`, a drop placed by `runOrderIdxOf`). The *Widgets* panel's rows are widgeting
  panels, each folded row adding how its cells stand, its open rows the widget's formula or
  prompt verbatim and the advice button; its old description snippet went with its old row. The
  dialog's *Run order* rows are lines (handle, label, what it works, tier mark, description), with
  nothing to unfold. **The new-widgeting menus live at the head of the *Widgets* panel**, the one
  place every widgeting, columnless or not, is edited; the dialog's *Widget library…* button went
  with them (the toolbar keeps the door). The **row preview** sits above the column list,
  `QuestionRow` under the grid's own heads (`ColumnHead`), from the stored quiz and the screen's
  run only, so a draft (an unchecked `regex` among them) never reaches it.

## 8. Removal, and the commit model (thread 4; 5a everywhere)

**Removal is one rule: a thing goes only once nothing shows or works it**, and the author clears
references from the outside in. A widget is removed only while no widgeting works it (as now);
a widgeting only while no column shows it, whatever its formula makes of it; a column
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
| bag's top level | `hunt`, `realm`, `categories`, `quiz`, `questions`, `question`, `hunt_label`, `realm_label`, `quiz_label`, `question_label`, `params`, `widgeting_label` (since §12; `qns`, `qn` and `qn_label` before); and `category`, one of the `categories` (3c, a call made in YOLO) | the quiz bag's keys. `src/models/quiz-bag.ts` imports `quiz.ts`, which imports `widgeting.ts`, so the list sits beneath `widgeting.ts` and a test holds `QuizBagValidators.quizBag`'s shape to it |
| recap bag | `number` | the recap's place-from-1 (`Templating.inOrder`) |
| import | `forced_label` | the key an older export's question carries (`src/lib/jsonball.ts`) |
| widgeted's keys | `status`, `value`, `err`, `message`, `result_meta`, `digest`, `stale` | `WidgetedT`, the widgeted row, and the deferred staleness pair |
| column's fields | `source`, `formula`, `template`, `readout`, `collapsed`, `width_px`, `align` | `ColumnValidators.column`'s shape, once 3a gives it the four new fields |
| estimates' keys | `masie`, `artie`, `poppy`, `estimates`, `average` | `PersonaLabelVals`, and the parts list `Estimates` keeps |

`forced_label` was reserved (`c278b471`) and dropped when the override retired (`e03bd267`), but
the importer still reads it: a widgeting under it has its flat widgeted read as the question's
label. `2026-10-widgets.md` still says it is reserved.

`categories` joined at 3c, once 3a had renamed the seeded estimates widget `category_data`, and
`category` with it; the note in `patterns.ts` that exempted both went then. Neither is a global
word: a hunt, quiz, question or column may still be labelled either.

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
* **`jsonata`**: `and`, `or`, `in`, `function`. A path cannot say them: `question.and` will not parse.
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
* **Tighten (3c, done)**: `source` and a templateable source are a plain key or `quiz.<label>` only;
  `quizzes.templated` goes; the readers' fallbacks go; `categories` joins the reserved words, so
  the integrity check refuses what the backfill missed. The Convex schema holds `source` as a
  string, so its push cannot refuse an old-grammar source: the row validator refuses it on the
  row's next write, and the Coach's check of production (`prd_checks.mts`, section 5) finds any
  before merging.
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

## 11. Compute budgets (thread 9)

Every place an author's template or formula is worked, or a model's reply read as one, is bounded
in time, on `Clock.clockNow()` (`performance.now()`), which moves inside a Convex function where
`Date.now()` stands still. Only the browser runs a quiz now (a sort is worked out there, §4 *The
sheet and the sorts*), so the bounds on a run are the browser's, and loose.

* **Liquid** (`Liquidry`, every renderer of the app: field, column, recap and `liquidize`
  templates, and the prompts once they move to Liquid). The render's clock is read at every piece
  and every turn of a loop, and at every value read (`ClockedContext`), so a filter working through
  a list (`where`, `has`, `map`, `sort` by a property), or a long path read from each item, is
  stopped inside its one call. The `*_exp` filters are refused as the template is read, as
  `include` is, the sentence naming the twin (`where_exp` → `where`): one item's expression may be
  a template of filters, a list's length squared of work. No one step may make or be handed more
  than `ItemsMax` (100,000: a range, a list a filter is handed, a text a filter makes), nor a
  render more than `AllocMax` (1,000,000) all told, where Liquid's own default was 10,000,000;
  `push`, `unshift` and `concat` are charged for everything they add, so no list holds one long
  thing many times over; the app's own filters are charged as Liquid's are.
* **A column of fills** has `Templating.ColumnMs` (250 ms) all told, spent fill by fill
  (`Templating.fillWithin`, a `ColumnBudgetT`), whenever each is asked: in one pass, or cell by
  cell as the grid draws them, the time between cells not counted. A limit stops the column; every
  later fill says the same, its own text as typed. A `liquidize` widgeting's column, a column's own
  template (`Columns.textOfShown`), and each templateable source (`finishedQnsOf`, and through it
  the export's `filledQuiz`) each has one.
* **JSONata** (`Formulas.evaluate`): its timebox (`TimeboxMs`, 100 ms a formula) reads the moving
  clock, and it takes a deadline, the sooner wins. A formula's column has no budget of its own: a
  formula reading every question for each (`qns[label = $$.qn.chains_to]`, as the seeded `butnot`
  sums do) takes about a quarter second over 300 questions, so a tight column's bound would stop
  honest columns. A widgeting's column of formulas is held by the run's bound; a column's own
  formula (`Columns.workedOf`, worked out apart from the run, for the grid and the sorts) has a
  bound of the same length, `Runner.RunMs`, for its whole column, and stops there as at a timeout.
* **The run** (`Runner.RunMs`, 5000 ms): the most a run's live columns may take all told, a loose
  bound on how long one change may hang a page. *Amended:* it was a second, a mutation's whole
  time, while the server ran the quiz to sort; that left a sort no headroom, and stopped a
  300-question classic layout's chained sums. A column under way when it runs out is stopped as at
  its own bound; a column begun after reads that the quiz took too long to work out. Input
  formulas, and a `template_from`'s formula, are worked out by the same deadline; an asked
  widgeting's inputs stop at the first that will not.
* **Not bounded here**: a face (a templateable field's cell in the grid, `faceOf`) fills its own
  text with `RenderMs`, cell by cell, outside any column's budget; one runaway text costs its own
  cell a second at each draw. And a JSONata range of millions (`[1..10000000]`) allocates in one
  step before any timebox is asked (in a mutation, past its 64 MB; no mutation runs one now). Both
  in `whiteboard/TODO.md`.

## 12. One bag shape (thread 10)

*The Coach:* "make a clean break and have expressions widgets and templates accept a bag of the same
shape as the export", converging the formula bag, the template bag and the jsonball (git and Raw
Export), with `qn` become `question` and `qns` become `questions`, the `*_label` fields at the
bag's top, and the jsonball given `label`, `viz` and the stamps.

**One shape, made in one place.** `Bagged` (`src/models/quiz-bag.ts`) makes each piece, and the
runner (`Runner.baseBagOf`, the one place a bag is made) and the exporter (`Exporting.quizBodyOf`)
both use it:

* **A question**: its `position` in the quiz's order, its `label`, its own fields (`qnum`,
  `clueing`, `hint`, `title`, `alt_text`, `notes`, `full_answer`, `recap`), its `viz`, its
  `chains_to` by label, its stamps as ISO text; and what each widgeting came to, under the
  widgeting's label, as `{ status, value }`.
* **The quiz's own fields**: `label`, `title`, `smiths_note`, `q1_preamble`, the recap's head, tail
  and template (null for the default), `templateable`, `locked`, `last_sortkey`, the stamps; and
  each widgeting run once for the whole quiz, under its label, flat beside them. `Quiz.bagKeys`
  holds every one of those names, and the ball's `questions`, `widgetings` and `columns`, so no
  quiz-tier widgeting takes one (the ball's `widgeteds` key is gone).
* **The hunt**: `label`, `title`, `branch`, the stamps. **The categories**: keyed by label, in
  the wheel's total order, each `{ label, title, position }`, the slot or null for the pool.
* **A failure is in neither.** The cell, the badge and the run keep it; a `liquidize`
  `template_from` reading a failed widgeting says only whose it was.
* **Every member of an ordered collection carries its `label` beside its `position`** in the
  ball: questions, widgetings, columns, categories, and the library's widgets.

**The bag's top level**: `hunt`, `realm`, `categories`, `quiz`, `questions` (every question by
its label, in the quiz's order, the archived among them), `question`, `hunt_label`,
`realm_label`, `quiz_label`, `question_label`, and the running widgeting's `params` and
`widgeting_label`. A template's bag is the same less the last two.

**Where the bag departs from the export, and why.** Each is allowed by the Coach's "efficiency of
widgeting execution and elegance of widgeting formulae", or is what only drawing needs.

| What | The bag | The ball | Why |
|---|---|---|---|
| The questions | at the top, `questions`, beside `question` | under the quiz, `quiz.questions` | Elegance: what a formula reads most, beside the one it is worked out for. Efficiency: they change at each step of the run, the quiz's fields do not; one keyed object a step, shared by every bag of it (`Bagged.keyed`) |
| What is worked out | a question's `rank`, `archived` and `secondary`; an estimate's parts on its widgeted | none | Worked out from what the ball holds (`qnum`, `viz`, the value and the wheel). A rank renumbers every question when one moves: in the ball it would rewrite every git file at each sort |
| Where it sits | `hunt_label`, `realm_label`, `quiz_label`, `question_label` | the keys of its path | The Coach's ruling: denormalized to the top for formulas |
| The running widgeting | `params`, `widgeting_label` | none | The widgeting's, not the quiz's |
| The realm | `realm`, its label and title | a key of the path | A ball has no place for a realm's title without a ball of its own; a formula reads nothing else of it |
| The layout | none | `widgetings`, `columns` | How the quiz is worked and drawn, not what it holds |
| Results so far | the widgetings before the running one | every one | The run order |
| The hunt beyond the quiz | none | members, the library, shared reviews | Not the quiz's |
| Drawing only (the template bag) | templateable texts filled in; images in a computed value made links; the recap's `number` (`in_order`) | as typed | Rendering, per the Coach |

**Keyed collections, read.** JSONata: `questions.*` lists them; `$lookup(questions, label)` finds
one, and since `$lookup` refuses a null key, the question chained to is `question.chains_to ?
$lookup(questions, question.chains_to)` (the seeded `butnot` and ish sums, which no longer search
the list: O(1) where it was O(n)). Liquid: `{{ questions[question.chains_to].hint }}` finds one;
`{% assign list = questions | values %}{% for each in list %}` loops, since a `for` tag takes no
filter (`{% for x in questions | values %}` loops over nothing) and a bare `for` over a keyed
object hands each turn a `[label, question]` pair; `in_order` takes the keyed questions as they
are; `.size` counts them. Both are pinned by tests (`tests/lib/templating.test.ts`).

**A template's questions changed meaning.** `qns` held the questions a screen shows and
`quiz.questions` every one; now `questions` holds every one, each saying whether it is `archived`.
A template that skipped the archived says so: `questions | values | reject: "archived"`. The recap
(`in_order`) skips them as before.

**The rewrite** (`src/models/before-october.ts`, `beforeOctoberFormula`, `beforeOctoberTemplate`,
`beforeOctoberRef` and the per-row helpers): a heuristic, written once, idempotent, read by the
importer for good (as the grammar before October 2026 is) and by the `bagshape` backfills
(`convex/migrations.ts`) over production's stored texts. A formula's words outside its strings
and comments; a template's inside its tags and outputs only, so a templateable field's prose is
never touched; a formula or template reading an input of its own (an `aibot` prompt, a widget
whose input formula is not `$`), and a column's formula (it reads what its ref picks), are left.
`qn` and `qns` stay reserved from every label, so text naming them can mean nothing else. The
seeds' texts before and after are pinned (`fixtures/seeds-2026-10-09.json`): the rewrite of the
old is exactly the new. What it cannot rewrite: `human/20261009-cw_bag.md`.

**No schema change**: the backfills rewrite text, so nothing widens or tightens. Their pull request
is a Serial Deploy (`bagshape`), since it adds backfills; any later one may retire them once
production's deploy has said they finished.

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
