# Columnwise: preplan

Date: 2026-10-08. A pre-plan, written in chat with the Coach (Flip) before the sprint plan
exists. It records what the conversation found, the shape we converged on, the Coach's rulings,
the agent's refinements (marked), a rough thread order, and the calls still open. The sprint plan
(`columnwise-plan.md`) is to be written from this by the `/sprint` orchestrator once the open
calls at the end are settled.

**The ask.** Adding a column a person can type into is nine clicks through three nested dialogs,
one of them admin-only. The author's intent is a spreadsheet's "add a column": the column should
lead, and the library and the run order should become the advanced views they are for most
authors. Along the way, entries gain the expressive power of a validator without the library
filling with one-offs, and a column gains a small expression so a rounded or upcased value does
not need a widgeting of its own.

## What the survey found

* **An entry depends on nothing.** `EntryFormulary.input` answers `missing` unconditionally and
  there is no formula (`src/lib/formulary/entry.ts`). Any run order that puts every entry ahead of
  every `jsonata` and `aibot` widgeting is valid and loses nothing; it is strictly better than the
  default, which puts `aibot` first, since an `aibot` input formula may read a typed entry. So
  position is meaningless for an entry, and the author is asked to order something with no order.
* **The entry widget layer is vestigial.** A widget is global and admin-only, which earns its
  keep when it carries a reusable formula or prompt. An entry widget carries an `entry_kind` and
  nothing else, and there are five kinds; the library can hold five meaningfully distinct entry
  widgets. The three nested dialogs are the cost of carrying the layer anyway.
* **The path today**, for a fresh kind of entry: the gear; past *Columns*, which comes first and
  dead-ends (a new column's *Shows* menu offers only widgetings the quiz has); *Widgetings*, *+ New
  widgeting*, the picker; *New widget…* (admin only); the formulary select, defaulted to `jsonata`,
  changed to `entry`; label, description, kind; Apply; back in the widgeting dialog, label, Apply.
  `planWidgetingEdit` (`src/state/widgeting-edit.ts`) already pairs the widgeting with a column,
  placed before the alt text column, so no column step is needed. The toolbar's *Widget library*
  door only does the middle of this and sends you back to the gear.
* **A column shows at most one widgeting; a widgeting has any number of columns**, including
  none (a `jsonata` step read only by later formulas) and several (the estimates widgeting's
  `masie`, `artie`, `poppy` parts). Many-to-one, not one-to-one.
* **The bag is already uniform.** `qn.clueing` and `qn.dumdum` sit side by side, and the reserved
  pattern guarantees a widgeting never shadows a question field. The `question.` prefix in a
  column's source (`QuestionWidgetLabel`, `src/models/column.ts`) and the `<widgeting>.<part>`
  grammar are special cases of the column, not of the data.
* **The manage dialog's Apply and Cancel are misleading.** Apply does one thing, the quiz label
  (`QuizManageModal.tsx`, `relabel_quiz`); every other field has committed on blur, drop or click
  by the time the buttons are reached, and Cancel reverts nothing. The nested dialogs (column,
  widgeting, widget editor) do batch to Apply. Two commit models, with no way to tell which a
  field follows without trying it.
* **`params` is waiting.** `WidgetingValidators` has `params`, a validated, size-bounded record
  reaching the bag, "unused by every widget so far", and revisable through `widgetingPatch`.
* **The grid's TSV is column-driven** (`specsFor` in `src/lib/sheets.ts`), so anything a column
  does to what it shows, the sheet does too.
* **Existing foldables.** `FoldButton.tsx`, `use-folds.ts` and `JsonFold.tsx` are in
  `src/components/`, over MUI's Collapse. The *Widgets* panel below the grid
  (`panels/WidgetsPanel.tsx`) already lists the quiz's widgetings in run order, each folded to a
  line of fields that unfolds to the description, the formula or prompt, and the advice button.
* **An existing preview picker.** `PreviewPicker.tsx` and `use-preview-bag.ts` let the widget
  editors point a live preview at any quiz of the hunt and any of its questions, starting on the
  open quiz's lowest-numbered one.

### Since the survey: the recap sprint landed (restacked 2026-10-08)

Main gained 239 commits between the survey above and this revision, most of them the recap
sprint (`whiteboard/20261005-recap/`). What it changed that this plan stands on:

* **A widgeting has a tier**, `question` or `quiz` (`WidgetingTierVals`): a `quiz` widgeting runs
  once for the whole quiz over a bag whose `qn` is empty, its widgeted sits in every later bag as
  `quiz.<label>`, it is stored in `quiz_widgeteds`, it has no column, and it is shown and typed
  into in the new **Quiz entries** panel. Only a `jsonata` widget and an entry of one value may
  run at `quiz` (`Widgeting.runsAt`). The tier is fixed once made.
* **One run order, both tiers mixed** as the author placed them; the gear's *Widgetings* list
  shows both, each row marked *each question* or *whole quiz*. (A fixed *questions pivot* was
  tried and retired within the sprint.)
* **Templating is LiquidJS**, not mustache (`lib/templating.ts`, its one importer; mustache
  stays only for `aibot` prompts and is slated to follow). A quiz **nominates** which sources are
  *templated* (`quizzes.templated`): the source's own text is a template, filled in over the
  template bag before it is shown or exported. Nominated per quiz and per source, never per
  column, so the recap and every export know which text to fill in without asking the grid. The
  nomination names a source **in the column's grammar**, `question.<field>` or a widgeting label
  (`QuizValidators.templatedSource`).
* **The bag** gained `categories` (the hunt's, in total order) at its top level, `archived` and
  `secondary` on each question, and `quiz.<label>` for quiz widgetings. `archived` and `secondary`
  joined `ReservedWidgetingLabels`; `recap` is a question field, so it is reserved through
  `Question.exposed`. The recap bag gives each played question a `number`.
* **Admins are named by the deployment** (`TRIQUET_ADMINS`), so most smiths cannot write the
  library at all: the entry-without-the-library path is not a convenience but the only path.
* **The widgeting planner moved** to `src/lib/widgeting-edit.ts`, and a new column's starting
  width into `src/models/layout.ts`, so the server can lay a quiz out as the dialogs do.
* **The migration dance has been run twice** (`notes/deploy.md` ledger, `20261006-recap_widen`
  and `20261007-recap_tighten`): the `columns` migration below follows those rows.
* **Proving** changed (`whiteboard/20261006-landing_flow/`): workers prove with `--touched` or
  more, and the orchestrator asks for a full run on risky threads.

## The shape

### 1. Entries run first (ruled)

Entries are not ordered, at either tier: a `quiz` entry reads nothing just as a `question` one
does. The runner puts every entry widgeting ahead of the rest; the run-order list shows them at
its head, not draggable, and the dragged list is the `live` and `click` widgetings of both tiers,
mixed as the recap sprint left them. `position` stays on the row (the order among entries is
arbitrary and harmless).

*Agent:* the guarantee holds only while an entry has no formula. A future kind with a computed
default, or estimate parts that read another widgeting, would reintroduce a dependency; the
decision record says so, so nobody builds it by accident.

### 2. One entry widget per primitive family (ruled)

The Coach's framing: a number widget (min, max, integer or real, from the widgeting), a string
widget (min and max length, pattern), boolean, enum, and the existing category estimates.

*Agent's reasoning for it, recorded:* what must be frozen is the **family**: a number stored where
text is expected breaks formulas, sorting and the cell editor. Constraints are different: a raised
minimum bites only on the next edit, since nothing validates rows read back. So the family lives
on the widget, which a widgeting names by a label it cannot change, and the constraints live in
the widgeting's `params`, which the author may revise. One singular entry widget with the family
inside `params` would put the frozen and the revisable in one bag and need a rule telling them
apart. The family is really the **cell editor**: number field, text field, checkbox, select,
pills. That is code, as a formulary is, and it is what the picker offers. Five or six seeded
widgets, added to only when a new editor exists.

What each family takes from its widgeting, roughly:

| family | params | editor |
|---|---|---|
| `number` | `min`, `max`, `integer` | `NumberField`, driving its `signed` and `fractional` |
| `text` | `max_length`, `pattern`, `lines` (`one` or `many`) | `PlainField` or `StretchField` |
| `boolean` | none; an emptied cell is `missing`, so it is tri-state for free | a checkbox |
| `enum` | `options`, a list of strings | a select |
| `estimates` | as now | pills |

**Which families run at the quiz tier** is `Widgeting.runsAt`'s to say, per family: `number`,
`text`, `boolean` and `enum` are entries of one value and may; `estimates` may not, as now. The
Quiz entries panel types into a `quiz` entry with the same cell the grid uses, so the checkbox
and the select appear there too.

**No schema library is needed.** Each family's params is a small Zod object in
`src/models/widget.ts`, beside `entryConfig`; the earlier idea of storing a JSON Schema fragment
is superseded by families. The one new mechanism: **a formulary reports a validator for a
widgeting's params, given the widget** (`paramsOf(widget)`), beside the `config` validator it
reports for the widget. `entry` hands back the family's; `jsonata` and `aibot` hand back the open
record they have now. The server checks params against it in `addWidgeting` and the widgeting
patch (it already fetches the widget, `widgetForLabel`); the client planner has the library.
`EntryFormulary.valueOf` takes the widgeting as well as the widget.

**`pattern`** is author-written code against every typed cell, so it is a ReDoS vector as a free
regex. Ruled: named patterns (`label`, `oneline`, `url`) in the first code thread; a free regex
in a later thread of its own, which takes the ReDoS question with it (a checker library or a
timebox, never a bare `new RegExp` over author text). `labelish` and `titleish` are presets of
`text` (ruled): no new widgets of those kinds are offered; rows holding them stay valid.

**Default params on the widget** (ruled: yes): an admin seeds `difficulty` as a number entry
preset to 1 to 10, and a widgeting still overrides. `config` gains the family's params, optional,
beside `entry_kind`.

### 2b. The `liquidize` formulary (ruled)

A widget that renders a Liquid template, given the full standard bag any other widgeting gets at
its place in the run order. The widgeting provides the template either as a static string in its
control panel, or as a field picked the way the column picker works: a top-level attribute of the
bag, and a JSONata expression over it, `$` by default. Its output is a string.

*Agent's shape for it:*

* **A `jsonata` widget's twin with another engine.** Refresh `live`, store nothing, runs at either
  tier (`runsAt` says yes), worked out at its place in run order over the same bag a formula gets
  there, with images linked as `Templating.bagOf` links them. `input_formula` is `$` by default,
  and the template is rendered over what the input came to, as an `aibot` prompt is over its.
* **Where the template comes from**, by the family rule (§2): the widget's `formula` is a static
  template, the admin's default; the widgeting's params may hold a static `template` of its own,
  or a `template_from` of `{ ref, formula }` whose text is read from the bag. `paramsOf` reports
  the validator. So an `aibot` at position 2 emits a template and a `liquidize` at position 9
  with ref `dumdum` renders it over the bag as of position 9; later widgetings read the result.
* **Output is always a string**, markdown by convention: a column showing it defaults to the
  markdown readout and sorts as text. An empty render reads as `missing`; a template that will
  not parse reads as `errored`, with Liquid's own sentence, as `Templating.fill` returns it.
* **One fill path.** The templateable nomination is, in words, "liquidize this source over the
  finished bag, in place", and both go through `Templating.fill`. Whether the nomination is
  rebuilt as a `liquidize` over the finished bag internally is the worker's call, not a row change.
* **Later, not now:** the recap template is a quiz-tier `liquidize` over `qns`, and the recap head
  and tail are quiz-tier liquidizes; the formulary makes that a fold rather than a feature.
* The advice prompt, the Widgets panel's unfolded view and the widget editor each take a
  `liquidize` arm beside `jsonata` and `aibot`, as the rewidgeting sprint's seams provide for.

### 3. The column: a uniform menu, and an expression (ruled)

Each column picks from one menu: every field of the question, every widgeting's output (an entry,
a formula's result, a bot's reply), the `quiz` object, the `qn` object. Beside the pick is room
for a JSONata expression, defaulting to identity, "the thing". Where the thing's schema is known,
the author is offered a list of field names, or "other" with the expression. The reason to allow
an expression over even a scalar: round it, convert its units, upcase it, without making a
widgeting.

*Agent's refinements:*

* **A column ref is a plain key** (ruled): `quiz`, `title`, `my_widget_result`, in the bag's own
  words. A column cannot refer to a column, so the ref space is the bag's and the column label
  space stays its own. Ruled, after the restack: a ref is **one plain key, resolved against `qn`
  first and then the bag's top level**: a question's field, a `question` widgeting's label,
  or `quiz`, `hunt`, `realm`, `categories`, `qns`. A value the same in every row is still worth a
  column when the formula pulls an answer out of it. The two namespaces are disjoint by
  construction: every top-level bag word is reserved from widgeting labels, which is why the
  seeded `categories` widget is renamed (*Schema*). The one dotted form is **`quiz.<label>`**, a
  `quiz` widgeting's widgeted. `quiz`, `qn`, `qns`, `hunt` and `realm` are already refused for
  every label (`PA.ReservedLabelGroups.models`, applied by `label` itself); *Reserved words*,
  below, has what else to add.
* **`formula` is the field's name** (ruled), and the parallel with a widget is exact: a `jsonata`
  widget is an input formula that culls the bag and a formula worked out over what that came to;
  a column is a ref that picks a thing and a formula worked out over it, in the same language,
  through the same evaluator and limits. **Its input is the thing as the bag holds it**: a field
  is the field; a widgeting is the whole widgeted, `{ status, value, err }` and, for an estimates
  entry, its parts beside them. Absent, the column shows what it shows today: a field itself, a
  widgeted's `value`. Present, `$.masie` is a persona's chance and `$.value.guess` is dumdum's
  guess. The one bend in the parallel: a widget's formula is a prompt for `aibot`; a column's is
  only ever JSONata.
* **The builtin fields stay as they are** (ruled). A label is already special, and an answer or a
  question number are reasonable things to index, so machinery for a few special fields is
  wanted, not a smell. The rule for a worker who finds a builtin field (categories, say) making
  extra code appear: write "let any schematized output do what builtin X does" and make X
  regular, never "a workaround so X behaves like a schematized output". Whether the runner presents the fields as *virtual* readonly
  widgetings at the head of the run order is an internal tidy for `Runner.sourceOf`, not a row
  change (the Coach pointed neither toward nor away from readonly widgetings). Not rows: the
  fields are the question's own columns, per standing in `Question.sentTo`, keyed by the hunt
  export, and `clueing` is promised never to be rewritten by the tool.
* **The parts mechanism dissolves.** `categories.masie` becomes the estimates widgeting with the
  expression `$.masie`; the parts stay on the widgeted in the bag, where formulas already read
  them (`Estimates.partsOf`). `WidgetingPartVals` leaves the column's grammar (see *Schema*, below,
  for what happens to stored sources).
* **Three rules make the expression a view, not a second widgeting.** It is not in the run
  order, enters no bag and nothing reads it; its input is the one thing picked, never the bag,
  so combining two things is a widgeting, mechanically. It runs only on an `ok` value: `missing`
  and `errored` pass through, so the dash and the badge keep working and nobody writes
  `$.status = 'ok' ? …`. An entry cell is editable only while the expression is identity: a
  rounded number has no inverse to type into; the pills likewise. Identity skips evaluation, so
  the common case costs nothing.
* **The sheet follows** (ruled). The grid's TSV is built from the column specs, so a column's
  expression shapes its cell in the sheet: the sheet is the grid as a sheet, what you see. The
  raw export (`lib/exporting.ts`) carries rows, not the grid, and is untouched; and nothing
  imports the sheet, so there is no round trip to protect.
* **A column says how its cell is drawn** (ruled): an optional `template`, **Liquid** (no
  mustache anywhere, ruled), filled in through `lib/templating.ts` over the question's template
  bag with the expressed value added as `value`, under the same limits and the same own-keys-only
  reading; and an optional `readout`, one of `plain`, `markdown`, `code`, `label`, saying how the
  text is drawn, defaulting by what the column shows as the cells choose today. The field is
  called `template`, not `liquid` (ruled): the convention names the role, not the engine, as
  `formula` is not `jsonata` and `recap_template` is not `recap_liquid`. **Two different things
  share the word**, and the vocabulary keeps them apart in one sentence: a *templated* source (the
  recap sprint's) is one whose stored text is itself a template, nominated per quiz and never per
  column; a column's *template* is how one column shows a value, and touches no stored text.
* **The nomination list is renamed `templateable`** (ruled). It names sources whose own stored
  text is a template, the input, filled in before anything shows it; the filled text is what has
  been *templated*, the output. The quiz field (`quizzes.templated`), the action
  (`set_templated`), `TemplatedEditor.tsx` and the vocabulary entry rename with it, the field by a
  small rename migration in thread 3's series (widen with both, copy, tighten).
* **A dynamic value with a template's full power, at the end**, is the templateable nomination,
  which exists: nominate an `aibot` widgeting by label and its value's text is filled in at show
  time over `Templating.bagOf`, the bag **after every widgeting has run**, so a reply emitted at
  run-order position 2 reads the results of positions 3 to 9. **At a point in the run order**, it
  is the `liquidize` formulary (§2b). The render pipeline is then: the run, `liquidize` steps
  among it; the templateable sources filled over the finished bag; the column's ref, whose
  widgeted now carries the filled text as its `value`; the formula; the column's template; the
  readout; markdown and the sanitizer. Two things the decision record states: **the nomination
  fills at the end, never in run order** (a formula at position 3 reads the template as typed; a
  template that must be read filled in by a later formula is a `liquidize`), and **a nominated or
  liquidized `aibot` runs model output as a template**, bounded as `notes/security.md` already
  says Liquid is (interpreted, own keys only, budgeted); the note gains a line. So a column is a short pipeline: the ref picks the thing, the formula works a
  value out of it, the template makes text of the value, the readout draws it. Each stage is
  optional and absent by default. An entry cell is editable only while the formula is identity
  and there is no template.
* **A collapsed column** (ruled): double-clicking a column's head collapses it to the width of
  its turned header's unpadded text height, and again restores it, so a column can stay in the
  sheet without being looked at. *Agent:* a `collapsed` boolean on the column, optional, beside
  the width it keeps, so the second double-click has the width to come back to; the grid draws a
  collapsed column with its turned header (`headkind: 'vertical'`, which a narrow column already
  has) and empty cells; the sheet is unchanged by it. Below `WidthPxMin`, since it is a state and
  not a width.
* **Field-name lists need a result schema per source.** Question and quiz have one, an entry
  family has one; a `jsonata` or `aibot` widget does not, and stays without (ruled): result
  schemas come the day something else needs them, not for the menu. Those sources offer "other".
* **Evaluation** goes through `Formulas.evaluate`, under the same timebox and depth guard as a
  formula; `lib/formulas.ts` stays the only importer of `jsonata`. Sorting by a column sorts by
  the expressed value under the existing rules.

### 4. Folding editors, columns leading (ruled)

Each widget (formulary) defines a **one-line folded** edit control, a subset of its full power,
as Illustrator's and Photoshop's panels do. A column row can unfold its widgeting's one-liner
inline, and that in turn into the full widgeting panel. The column's gearbox includes the
widgeting's gearbox. Each column pointing at a widgeting carries a copy of its folded controls,
which is fine: they edit one row and the quiz's watch keeps every copy in step. The widgeting's
own gearbox shows each of its columns' foldable edit components.

*Agent's refinements:*

* The folded fields are a formulary fact beside `refresh` and `store`: an entry's family params,
  a `jsonata` widget's formula line, nothing for `aibot` (a prompt does not fold).
* Borrow the panels' other habit: the full panel *is* the folded line with more rows, the same
  fields in the same order, and the fold hides those below the first. One component, one set of
  fields, a fold state (`use-folds` already tracks it per key, so folds survive a reopen). The
  separate column dialog and widgeting dialog then go: the gear becomes an unfold.
* **The widget stays behind its door.** An edit to it is global, admin-only, and changes every
  quiz in every hunt that works it; it keeps the widget editor with the usage line in front.
* The column row already gives way under container queries (`RoomFor` in `ColumnsEditor.tsx`).
  The folded line is a second row beneath the column row, not more fields in the same one.
* *+ New column…* gains "a new entry…" (any smith) and, for an admin, "a new widget…", making
  widgeting and column in one go; `planWidgetingEdit` already does this pairing from the other
  side.
* **The run-order sorter is in both places** (ruled): the manage dialog keeps a *Run order*
  section, the drag list alone, and the *Widgets* panel below the grid, which already lists the
  widgetings in run order folded, gains the handles too; both dispatch `move_widgeting`. The
  entries sit at the head of each, not draggable (§1). The panel's open state is the widgeting's
  full panel, the same component the column row unfolds into, so the columnless widgeting is
  edited there and nothing needs a second home.
* **A row preview in the column editor** (ruled). A pulldown for one question's label, beside the
  column list, and beneath it that question's grid row drawn live from the columns as they are
  being edited, so a width, an alignment, a title or an expression is seen as it changes. *Agent:*
  `QuestionRow` drawn from the same `specsFor` the grid uses and the quiz's run, with the question
  picked through `use-preview-bag`'s picker (quiz select dropped: the columns are this quiz's);
  read-only, and the grip, checkbox and ask handlers off. The preview is one question so the
  dialog stays light. Only ever needed within the manage dialog, which is wide (`maxWidth="lg"`).
* The library modal and the toolbar's door are untouched.

### 5. Removal: only a widgeting no column shows (ruled)

No lovely UX for removing a widgeting: it is refused while any column shows it, whole or a part.
*Agent:* this makes the chain one rule. The library already refuses to remove a widget while a
widgeting works it; widget, widgeting, column each go only when nothing refers to it, and the
author clears references from the outside in. `ConfirmRemove`'s `refusal` prop carries the
sentence. The server's `delete_widgeting` refuses instead of cascading to columns; deleting a quiz
still cascades, since that is the quiz going. A column showing a part counts as showing it
(`resolve`). The dangling state, a column whose source names a widgeting the quiz no longer has,
can then arise only through an import. The vocabulary's "removing a widgeting takes its columns"
flips to "a widgeting is removed only once no column shows it", written once for all three levels.

### 6. Commit model (ruled)

No Apply and no Cancel: every change commits as it is made (on blur, drop or click), undone by
changing it back, with the quiz's history as the record. The exception is **anything with
consequences, such as editing a label**, which keeps an explicit button, as the hunt's *Rename*
and *Relabel* have now. The manage dialog's Apply becomes a *Relabel* button beside the quiz
label; its Cancel becomes *Done*. The nested dialogs' batching goes with the dialogs (§4).
Each field's validator therefore has to produce a sentence on its own, as `ColumnRow.commit`
does; the family params are the new case.

## Reserved words: proposed additions (agent, at the Coach's request)

The Coach's rule: easier to take a word off later than to add one. Two findings first:

* **`forced_label` is not reserved from widgeting labels**, though `2026-10-widgets.md` (*The
  reserved pattern*) says the thread-3 review added it. A widgeting so labelled has its flat
  widgeted overwrite the import's key. Add it.
* The route segments are safe: a hunt sits under `/h/`, an org under `~`, and the fixed words
  after a hunt (`quizzes`, `categories`) are never a label's position. Nothing to add there.

Proposed for `ReservedWidgetingLabels` (the per-quiz namespace, where the bag's flat keys live),
each derived from the list that defines it rather than written out, as the existing ones are:

* **Every top-level key of the bag**, derived from `QuizBagValidators`' shape: `qn_label`,
  `quiz_label`, `params`, `widgeting_label` and **`categories`** join `hunt`, `realm`, `quiz`,
  `qns`, `qn`, which the global list has. A ref resolves against `qn` first, so a widgeting under
  any of them would shadow the bag. `categories` is the seeded estimates widget's label today,
  hence the rename below, and the note in `patterns.ts` that exempts it goes.
* **`number`**, which the recap bag gives each played question as its place from 1 (it is in
  the `types` group below as well; this is the second reason).
* **`forced_label`**, as above.
* **The widgeted's own keys**: `status`, `value`, `err`, `message`, `result_meta`, and the
  deferred `digest` and `stale`. `qn.status` beside `qn.foo.status` is a trap for a formula.
* **The column's own fields**, so an export's columns and a bag never read alike: `source`,
  `formula`, `template`, `readout`, `collapsed`, `width_px`, `align`.
* **The keys inside the estimates widgeted** (ruled, the stricter view): the persona labels
  from `PersonaLabelVals` and the parts (`estimates`, `average`), from the list `Estimates`
  keeps once `WidgetingPartVals` leaves the column.

Proposed for the global `ReservedLabelGroups`, as new groups:

* **`types`**: `string`, `number`, `integer`, `float`, `boolean`, `object`, `array`, `list`,
  `json`, `date`, `time`, `datetime`, `enum`, `text`. Beside `kind` and `type`, which are there.
  (`text` ruled in: `hint_text` is fine either way.)
* **`engines`** (ruled in, the Coach's list and the agent's additions in the same spirit):
  `liquid`, `mustache`, `template`, `templates`, `templated`, `js`, `ts`, `javascript`,
  `typescript`, `wasm`, `rust`, `python`, `py`, `apicall`, `worker`, `workers`, `script`,
  `scripts`, `code`, `eval`, `exec`, `html`, `css`, `sql`, `yaml`, `xml`, `markdown`, `md`,
  `bbcode`, `bbjank`, `prompt`, `prompts`, `formula`, `formulas`, `formulary`, `formularies`,
  `regex`. (`api` is in `routes` already; `function` in `jsonata`.)
* **`aggregates`** (ruled in): `average`, `avg`, `mean`, `median`, `stdev`, `sum`, `total`,
  `count`, `min`, `max`. What a sheet or a formula calls a reduction; a widgeting wanting one
  says of what, `clueing_sum`.
* **`jsonata`**: `and`, `or`, `in`, `function`. Keywords a path cannot say: `qn.and` will not
  parse, so a widgeting so labelled can never be read by a formula.
* **`status`**: `result`, `results` (the retired noun), `error`, `errors`, `ok`, `stale`,
  `missing`, `current`, `blank`, `default`, `defaults`.
* **`grid`**: `row`, `rows`, `col`, `cols`, `cell`, `cells`, `header`, `headers`, `index`,
  `idx`, `sort`, `order`. What a sheet or the grid itself calls its parts.
* **`self`**: `self`, `this`, `me`, `it`, `name`, `names`, `data`, `item`, `items`, `object`,
  `root`, `parent`. `name` is the word STYLE.md bans as a variable and the one a bag lookup
  mistakes first. `items` is the ishes' key inside a widgeted, as `status` is, so it goes here
  by the same reasoning; `item` with it.
Thread 1 writes the lists into the decision record; thread 2 lands them, as the integrity check
(`src/models/quiz.ts`) must refuse a quiz already holding one, and a seeded widget's label must
not be among them (`categories` is not, by the note in `patterns.ts`).

## Schema: one small migration, the rest additive

Production holds quizzes, and their column rows hold sources in today's grammar:
`question.title`, `question.butnot`, `categories.masie`; since the recap sprint, so does each
quiz's `templated` list. The Coach wants every source in the plain-key form, so `columns` and
`quizzes` take the dance `notes/deploy.md` (*Schema pushes*) prescribes, and it is a small one:
two string fields, a rewrite with no judgment in it.

* **Widen**: `source` accepts both grammars; `formula`, `template`, `readout` and `collapsed`
  arrive optional.
* **Backfill** (`@convex-dev/migrations`, the `convex-migrate` skill, on the model of the
  ledger's `20261006-recap_widen`): `question.<x>` becomes `<x>`; `<w>.<part>` becomes `<w>` with
  `formula: '$.<part>'`; a plain widgeting label is left. **`quizzes.templated` holds the same
  grammar** (`templatedSource`) and is rewritten in the same migration, `question.<field>` to
  `<field>`.
* **Tighten**: `source` and a templated source are a plain key, a bag word or a widgeting label;
  the part grammar and the prefix are gone from both validators, `QuestionWidgetLabel` and
  `WidgetingPartVals` with them.
* **The `categories` widget becomes `category_data`** (ruled), in the same series, ahead of the
  grammar rewrite, since both touch `columns.source`. Three things carry the label. In order:
  the widget's `label`; each widgeting's `widget_label`; each widgeting's own `label` where it is
  `categories` or `categories_<n>`, to `category_data` or `category_data_<n>`, since a widgeting
  label is what a ref resolves against `qn`; each column's `source` naming such a widgeting; each
  quiz's `templated` entry likewise. The seed (`src/models/seeds.ts`) and the default widgeting
  label follow. Nothing to widen: `category_data` is a legal label already. The tightening adds
  `categories` to the reserved words, and the quiz integrity check then refuses what the backfill
  missed. **What nothing rewrites**: an author's own formula reading `qn.categories`, which reads
  as `missing` afterward; the ledger row says so, and the Coach greps the raw export before the
  deploy. `Estimates.isEstimating` reads the entry kind, not the label, so the spread, the
  personas and the parts are untouched.
* **Imports keep a reading of the old grammar for good** (ruled), and of the old widget name, as `widgets_todo.md` keeps one
  for old exports: a pasted export from before the sprint translates its columns on the way in
  (`question.<x>` to `<x>`, `<w>.<part>` to `<w>` with `formula: '$.<part>'`), named in the code
  as the grammar before October 2026, and the exporter writes the plain form. Old exports are the
  only copy of some quizzes. The rule in words: an export is a promise, and the importer reads
  every shape the exporter has ever written. `whiteboard/TODO.md` carries the Coach's note to
  scan for such readings one day, so each is findable.
* The ledger row in `notes/deploy.md`, the `Backfilling` entry in the schema test, and a local
  backend emptied and pushed again, as the note prescribes.

Everything else is additive: `EntryKindVals` widens with `boolean` and `enum`, rows holding
`labelish` and `titleish` stay valid; `widgetings.params` is already there and its validator
tightens per family at the entrypoint, never on read; `widgets.config` gains the family's
default params, optional.

## Threads, in rough order

Threads 2, 3 and 4 are independent and can run together; 5 waits for 2, 3 and 4; 7 waits for 2;
6 and 8 are optional, 6 after 2. **The prompts' move from mustache to Liquid is underway in
another container and is not this sprint's**: nothing here touches a prompt, and the column's
template and `liquidize` go through `lib/templating.ts` either way.

1. **Design note and vocabulary.** A decision record under `notes/decisions/` (or an addendum to
   `2026-10-widgets.md`) with: entries first and why it holds only without a formula; the family
   on the widget, the constraints in `params`, and `paramsOf`; the column expression and its three
   rules; the uniform source menu and the end of parts in the column grammar; folding, with the
   widget behind its door; the removal chain as one rule; the commit model and its exception.
   `notes/vocabulary.md` updated (*Columns and the bag*, *Widgets*). Docs only; the Coach reads it
   before code moves.
2. **Entry families.** `boolean` and `enum` kinds and their cells; per-family params validators
   and `paramsOf` on the formulary interface; the server and the planner checking params against
   the widget's family; `valueOf(widget, widgeting)`; number and text params driving the existing
   fields; named patterns (`label`, `oneline`, `url`); default params on the widget;
   `Widgeting.runsAt` per family and the new cells in the Quiz entries panel; entries of either
   tier first in the runner and at the head of the run-order list; the reserved words landed, with
   the integrity check. Seeds for the new families. Tests beside `tests/lib/formulary/entry.test.ts`,
   `tests/models/widget.test.ts`; `e2e/entries.spec.ts`.
3. **The column expression and the plain-key source.** The migration series (*Schema*): the
   `category_data` rename, the `templateable` rename, then the `columns` and `templateable`
   grammar, in a PR of its own with its ledger rows; optional `formula`, `template` (Liquid over
   the template bag with `value`), `readout` and `collapsed`, with the double-click on the head; evaluation on `ok` only through
   `Formulas.evaluate`; identity skips; the entry-cell editability rule; the sheet and the sorts
   following; the source menu over the bag's words; field-name lists where a schema is known,
   "other" elsewhere; parts as expression presets; the import's reading of the old grammar. Tests beside `tests/lib/columns.test.ts`,
   `tests/models/column.test.ts`, `tests/lib/importing.test.ts`; `e2e/grid.spec.ts`,
   `e2e/sheets.spec.ts`, `e2e/importing.spec.ts`.
4. **Removal and commit model.** `delete_widgeting` refuses while a column shows it, server and
   client, with the sentence; the manage dialog's *Relabel* and *Done*. Small; parallel to 2 and 3.
5. **Folding editors.** The column row leading, with its widgeting's folded line beneath and the
   full panel below that; the formulary's folded fields; the widgeting panel listing its columns'
   foldables; the run-order sorter in the *Widgets* panel below the grid, entries at its head, and
   the manage dialog's *Widgetings* section gone; *+ New column…* making an entry widgeting and
   its column in one go (`src/lib/widgeting-edit.ts`); the column and widgeting dialogs retired,
   the tier marks kept on the run-order rows; the one-question row preview in the column
   editor. `e2e/widgets.spec.ts`, `e2e/entries.spec.ts`, `e2e/panels.spec.ts`.
6. **Free regex patterns.** A `regex` named pattern taking author text, with its ReDoS answer
   (a checker library from `notes/stack.md`'s process, or a timebox), in a thread of its own after
   2. Optional this sprint.
7. **The `liquidize` formulary.** The class in `src/lib/formulary/liquidize.ts`, its config and
   params validators, its arms in the runner, the advice, the widget editor and the Widgets panel,
   a seeded `liquidize` widget, and the templateable nomination's fill sharing its path. After 2
   (params families and `paramsOf`); parallel to 3, 4 and 5.
8. **Seeds pass (optional).** With a column able to reshape one value, the seeded sums that only
   reshape one widgeted (`clueing_full`, `clueing_numeral`, `hint_full`, `hint_numeral`) can be
   expression presets; those reading two things or another question (`butnot_*`,
   `clueing_plus_*`) stay widgetings. Existing quizzes that work them are untouched either way.

## Open calls for the Coach

Settled in chat: entries run first and are not ordered; one entry widget per family, constraints
in `params`; the uniform column menu with an expression beside it, identity by default, field
names where a schema is known; folding from the column row into the widgeting, the widget behind
its door; the run-order sorter in the panel below the grid; a one-question row preview in the
column editor; a widgeting is removed only when no column shows it; commit as you go, with an
explicit button only where a change has consequences, such as a label; no Apply and no Cancel.

Ruled 2026-10-08, from the first draft's open calls: every column source in the plain-key form,
with the small `columns` migration above; `labelish` and `titleish` are `text` presets; named
patterns in the first code thread and a free regex in a later one; the sheet follows the
expression; default params on the widget, yes; result schemas wait for whatever else needs
schemas; the sorter in both places; **mode YOLO, review level medium**.

Also ruled: the importer reads the old column grammar for good; every proposed reserved word goes in, the stricter view; the builtin fields stay, with the regularity rule for a worker who meets one making
extra code; the sheet carries what the column shows, since that is what is pasted into a
spreadsheet; a column collapses on a double-click of its head; `template` is mustache.

Ruled after the restack: a ref is one plain key resolved against `qn` then the bag's top level,
every top-level bag word included; the seeded `categories` widget and its widgetings are renamed
`category_data` by migration and `categories` is reserved; the column's extraction field is
`formula`, over the thing as the bag holds it; `quizzes.templated` joins the grammar migration.

Also ruled: the column's template is Liquid and the field is `template`; no mustache anywhere,
the prompts' move being another container's; the `engines` group of reserved words; the
nomination list is `templateable`; the `liquidize` formulary (§2b).

Nothing is open. The preplan is ready to become the sprint plan.
