# Rewidgeting: bots and expressions become one family, on the data layer

Sprint plan, 2026-10-01. Mode: **YOLO**. Review level: **medium** (thread 1 is docs only, so
unreviewed). Issued by the Coach (Flip).
**Status: thread 4 underway.** Threads 1 (PR #67, docs only), 2 (PR #68) and 3 (PR #69) done.

Eight threads, stacked in order. `rewidgeting-progress.md`, beside this file, is newer than this
plan wherever the two disagree.

## Read first

Beyond CLAUDE.md and its auto-loads (`notes/stack.md`, `notes/testing.md`, `notes/convex.md`,
`notes/views.md`):

* **`notes/decisions/2026-10-widgets.md`** once thread 1 has written it: from thread 2 on, it is
  the design every thread builds to, and this plan's *Background* below is its source.
* `notes/vocabulary.md` and `STYLE.md`, before naming anything. Thread 1 rewrites the
  vocabulary; threads after it name things in its words (widget, widgeting, widgeted,
  formulary, input formula), never the retiring ones, even in code that still sits on the old
  tables.
* `notes/guidelines.md`, before designing an entrypoint or a row validator.
* `notes/queries_hooks_and_subscriptions.md`, before adding a query function, a state hook or a
  `useQuery` (threads 3, 5, 6).
* `notes/deploy.md`, *Schema pushes* and the migration ledger (thread 3).
* `convex/_generated/ai/guidelines.md`, before touching `convex/`.
* Today's machinery, by area: `src/models/{widget,botting,bot,bot-label,bot-status,expression,
  layout,quiz-bag,question}.ts`; `src/lib/{formulas,expressed,formula-prompt,exposure,
  exporting,importing,sheets,sortings,quizgit,labelmaker}.ts`; `src/lib/ask/*`,
  `src/lib/bots/port.ts`, `src/lib/vv/patterns.ts`; `src/state/{use-asking,use-bots,
  widget-edit}.ts`; `src/components/{WidgetsEditor,ExpressionsModal,ExpressionFields,
  JsonFold,SortableList}.tsx` and `src/components/cells/`.

## Ground rules

`notes/git_hygiene.md` (*A thread, start to finish*, *Sprints*) and
`.claude/agents/thread-worker.md` govern. Particular to this sprint:

* **The Coach's prompt is the instruction**, and its *Background* below is the settled design.
  Every call in it is made; a worker who finds one wrong says so in the report and builds it
  anyway unless it cannot be built.
* **No migration dance.** No `@convex-dev/migrations` migration, no widened-then-tightened
  schema, no `Backfilling` entries in `tests/convex/schema.test.ts`, and the schema change in
  one PR (thread 3). The seeding mutation is the only data-moving code; it is idempotent and
  small. A simple additive migration through `notes/deploy.md` is fine where a thread needs
  one; where carrying data across would take translation code, **drop the data and report it**
  (thread report, `losses.md` in this directory, and the PR).
* **Local backends are yours to empty.** After a schema change, `scripts/convex_reset agent`
  and `scripts/convex_reset e2e-agent` and push again. Never the `dev` or `e2e` roles, never
  production.
* **The ask route stays the one server function.** Its contract changes (thread 4); nothing
  joins it, and no new route handler appears.
* **Library first.** `mustache` (thread 4) is the expected proposal for template rendering,
  listed in `notes/stack.md` when installed; `crypto.subtle` needs no dependency (and nothing
  this sprint hashes anyway).
* **Lost behaviour is stated.** Staleness, bulk recalculation and numnum's prose list of spans
  go on purpose this sprint. Each thread that removes one says so in its PR.

## Background (the Coach's, verbatim)

> The tool computes things per question in two ways today: **expressions** (JSONata formulas,
> owned by the hunt, seeded into every hunt) put to work in a quiz as **expressings**, and two
> hard-coded **bots** (dumdum guesses the clueing; numnum lists the number-like spans in the
> clueing or the hint) connected to a quiz as **bottings**, whose replies are rows in `bottings`
> and are projected onto three question fields (`guess`, `clueing_ishes`, `hint_ishes`) that the
> formulas read. The bots' prompts, tiers and legal (bot, textkind) pairs are code. A new quiz
> gets every expression, all three bottings and the columns for them, which suits one specific
> quiz and nobody else's.
>
> This sprint makes both the same kind of thing, on the data layer, so an author can paste in
> their own prompt and a new quiz starts lean. Three nouns replace five:
>
> * A **formulary** is the generic runner behind a widget: code, never a row. This sprint has
>   `jsonata` (today's expression) and `aibot` (today's bot); `entry` comes last; `script` and
>   `api` are for later. Each is a class of statics with one interface: `check(widget)`,
>   `input(widget, bag)`, `run(widget, widgeting, bag)`, `advice(widget, widgeting, sample)`,
>   plus two facts it reports: `defaultInput` (the input formula a new widget starts with: `$`
>   for `jsonata`, `{ 'clueing': qn.clueing }` for `aibot`) and `refresh` (`live` for `jsonata`,
>   worked out on render; `click` for `aibot`, asked from the cell as today; neither for `entry`).
> * A **widget** is a reusable definition, global to start:
>   `{ scope: 'pub', label, title, description, formulary, formula, input_formula, config, position }`.
>   `formula` is the JSONata expression or the prompt template. `input_formula` is a JSONata
>   expression that culls the bag to what the widget reads: for `aibot` the small object the
>   template is rendered over (`{{clueing}}` placeholders, as the prompts have now); an input
>   that comes to nothing means "do not ask". `config` is formulary-specific (`servicelabel`,
>   `model_tier`, `max_tokens` for `aibot`; empty for `jsonata`). Its key outside the database is
>   `pub/<label>`; it serializes at `widget/pub/<label>`, one file per widget, and the library
>   exports and imports on its own, apart from any hunt.
> * A **widgeting** is one widget put to work in one quiz:
>   `{ quiz_id, widget_label, label, description, params, position }`. `position` is the run
>   order: each widgeting's bag holds the widgeteds of those before it. `params` is validated and
>   unused this sprint, and reaches the bag. The label defaults to the widget's, growing `_2`,
>   `_3` while taken: that generation is `Labelmaker`'s, as every label's is. Uniqueness among
>   siblings, the reserved words and every other stricture are Zod's, in the row validators and
>   the quiz's integrity check, as they are today; a typed label that is taken or reserved is
>   refused by them.
> * A **widgeted** is what one widgeting came to for one question (as *expressed* is for an
>   expressing today; the model cannot be called `result`), stored for formularies that store
>   (`aibot` appends, as `bottings` does today; `entry` upserts) and computed on render for
>   `jsonata`: `{ question_id, widgeting_id, status, value, message, result_meta }`. `status` is
>   `ok` or `errored`; a cell with no row is `missing`. `value` is JSON, untyped. `result_meta` (the field keeps
>   its name) is a free bag (tier applied, approximate tokens, truncation, the raw failure response). Everyone
>   reads a widgeted as `{ status, value, err }`, where `err` is a newer failure riding along on
>   an `ok` value.
>
> The rules that follow from that, all settled:
>
> * **The question bag is flat.** A widgeting's widgeted sits at `qn.<label>` beside the question's own
>   fields, and under each of `qns`. Widgeting labels may not match the question's exposed
>   fields, its views (`butnot`, `butnot_ishes`), `rank`, or `question`; that pattern is derived
>   from the `exposed` lists in one place beside the label pattern, never a second list, and
>   enforced by the validators.
> * **Staleness is off this sprint.** Here there is no `stale` on a widgeted; the ishes'
>   `asked_text` comparison goes with `bottings`; the seeds' `{ value, stale }` form becomes a
>   bare value; the grid's greyed stale marks disappear. Accepted. The design it will have, for
>   thread 1 to record and for nobody to build yet:
>
>   ```
>   input_data = input_formula(bag)                    -- may carry `_dependencies`
>   digest     = hash(jsonify({ formula, config, input_data }))
>   input_data = input_data without `_dependencies`    -- what the template renders over
>   stale      = stored.digest !== digest
>   ```
>
>   Nothing is inferred from a formula: the input formula is the author's statement of what
>   the widget reads. Each widgeted publishes its `digest` forward in the bag, and a widget that
>   reads another's widgeted declares it by naming that digest in `_dependencies`, which is
>   folded into its own digest and stripped before the template renders. `stored` is the newest
>   `ok` row; with none, nothing is compared. The `digest` column arrives with that sprint.
> * **Bulk recalculation is off this sprint.** "Recalculate all", the batched prompt, the
>   `bulk_ishes` job and `bulk_ishes_last` go. Note in HUMAN-whatsup at the end that the run was
>   already slower than it should be, for the day bulk returns.
> * **Keep a lid on migration code.** Production holds one hunt of 27 questions. What a person
>   typed (questions, quizzes, hunts, reviews, idents) must survive; what the tool can make again
>   (seeded expressions, default layouts, the bots' replies) need not. A simple migration through
>   `notes/deploy.md`'s procedure, such as adding a field existing rows lack, is fine wherever
>   the work needs one. What to avoid is complex code that translates existing rows into the
>   new shapes: where carrying data across would take that, **drop the data instead and report
>   it**, in your thread's report, in `losses.md` in the sprint directory, and in the PR. The
>   Coach reviews what was dropped and what migration code was written, and will pull back
>   anything that grew. The expectation for thread 3 is that `expressions`, today's `widgets`
>   and `bottings` are not translated: their tables are cleared by hand at deploy, and one
>   idempotent seeding mutation re-creates the library and the default widgetings.
> * **Imports of every kind merge by label.**
> * **The ask route stays the one server function.** Its contract changes; nothing joins it.
> * **Everything else in CLAUDE.md holds**: library first (`mustache` for template rendering is
>   the expected proposal; `crypto.subtle` needs no dependency), Zod at every entrypoint, MUI for
>   views, `STYLE.md` and `notes/vocabulary.md` before naming anything.

## Threads

### 1. Design note and vocabulary

> Write `notes/decisions/2026-10-widgets.md`: the three nouns and the formulary, the four row
> shapes and their validators' fields, the formulary interface, the flat bag and the reserved
> pattern, serialization paths, the status words, and staleness as designed and deferred, in
> the form the other decisions take. Update `notes/vocabulary.md`: add *formulary*, *widget*
> (redefined), *widgeting*, *widgeted*, *input formula*; retire *expression*, *expressing*,
> *botting*, *slot*, *stale* and *last_err* or mark them as retiring; keep *bot* as a model with
> a brief, now an `aibot` widget. Docs only: no code, so no code review. Flag in the PR any place
> where the design note had to decide something this plan left loose.

*Orchestrator:* **done, PR #67.** Every loose end below is settled in the note's *Settled here*
list; from here on the note wins over these glosses. Two refinements of plan calls: YOLO call 1
(seeding by columns) widened, and imports keep pasted values per open PR #66.

*Gloss.* Docs only: `notes/decisions/2026-10-widgets.md` (new directory) and
`notes/vocabulary.md`. No review (no code). Read the code it describes before writing, so the
note names real files.

*Look-ahead*, the things this note must settle because later threads build on them; each is a
place the prompt left loose, so each goes in the PR's flag list:

* **No decision record is visible to copy.** `notes/decisions/` does not exist outside
  `/aside/` (CLAUDE.md's `decisions/2026-09-client-first.md` pointer dangles). Use a plain
  decision-record form -- status and date, context, decision, consequences, deferred -- and
  say so in the PR.
* **Module and file names**: the formulary directory (`src/lib/formulary/` unless there is a
  better word), the model files (`src/models/widget.ts` redefined, `widgeting.ts`,
  `widgeted.ts`), and the name of the projected read type (`{ status, value, err }`).
* **Where the seeds fixture lives.** `convex/` may import only `src/lib` and `src/models`, and
  the seeding mutation reads the fixture, so it cannot live in `fixtures/`. Name the path.
* **The bag's new paths.** Widgeteds sit at `qn.<widgeting label>`, so today's
  `qn.clueing_ishes`, `qn.hint_ishes` and `qn.guess` become `qn.numnum_clueing`,
  `qn.numnum_hint` and `qn.dumdum` (the default layout's widgeting labels; the *columns* keep
  their own labels). Say what each aibot widget's `value` is -- the JSON object its prompt asks
  for, e.g. `{ guess }` and `{ items: [...] }` -- since thread 3 stores it, thread 4's route
  returns it, and the seed formulas read it. Getting it once means the formulas are rewritten
  once.
* **`butnot_ishes`** is a reserved view that today mirrors the chained-to question's clueing
  ishes. With replies under widgeting labels that can vary per quiz, say what it becomes: a
  view that reads a fixed label, or a seeded `jsonata` widget. Thread 5 retires its special
  cell either way.
* **Who may edit a `pub` widget** (every smith of any hunt, per the design record) and what
  `authorize.ts` checks for it; who may count its usage across hunts (thread 6's "worked by"
  line reads across hunts the ident may not be on: counts only).
* **Write policy by formulary**: `aibot` appends, `entry` upserts, `jsonata` stores nothing;
  the `widgeteds` index that makes the upsert one read (thread 8).
* **The reserved pattern vs `notes`**: a widgeting cannot be labelled `notes` while `notes` is
  an exposed question field. Thread 8's "default `notes` entry widgeting" therefore cannot be
  called `notes`; the note should say so, so thread 8 starts knowing it.

### 2. The formulary seam, no data change

> Build `src/lib/formulary/` (or the name the design note chose): the interface, the `jsonata`
> and `aibot` formularies wrapping today's `Formulas`, `Expressed`, `lib/ask/*` and the three
> hard-coded bots, and one runner that walks a quiz's widgets in position order and yields,
> per question, every widget's widgeted as `{ status, value, err }` by label. The grid, the
> sorts, the exports and the sheet read through the runner. The bag gains `qn.<label>` for every
> widget, expressings included (an expression's value enters the bag for the first time, in run
> order); the old `qn.guess`, `qn.clueing_ishes` and `qn.hint_ishes` stay as aliases until
> thread 3 removes them. Tests mirror the new module. No schema change, no row change.

*Orchestrator:* **done, PR #68** (reviewed twice: one `fix:` kept, one flagged finding fixed on
resume). Pulled forward and struck from later threads: the status projection (`Runner.widgetedFrom`,
thread 5), per-widgeting counts (`Runner.statusCounts`, thread 6), and from thread 3 the formulary
kinds and config validators, `WidgetedT`, the bag's `params` and `widgeting_label`, the seeded
`aibot` input formulas and value shapes.

*Gloss.* New `src/lib/formulary/` (or thread 1's name) with `tests/lib/formulary/` mirroring
it; reads `src/models/widget.ts` (today's union of expressings and bottings) as the stand-in
for widgetings, and `bottings` rows for stored widgeteds. Touches the grid's cells, the
sortings, `exporting`, `sheets`, and the bag in `quiz-bag.ts`.

*Look-ahead*:

* **Thread 1 named it**: `src/lib/formulary/{formularies,jsonata,aibot,runner}.ts`, `WidgetedT`
  for the read, and each formulary runs over its *input*, not the bag. Follow the note.
* **Name in the new words now.** The runner's types and functions say widget, widgeting,
  widgeted, so thread 3 swaps the runner's data source, not its vocabulary.
* **Project the status here.** Thread 5 says the projection lives in the runner: newest `ok`
  row, any newer `errored` row as `err`, no row `missing`. Build it now (the bottings rows
  already have that shape) and thread 5 becomes views and retirements; declare it as pulled
  forward.
* **Run order is the bag.** Each widgeting's input bag holds the widgeteds of those before it,
  under every `qns[*]` as well as `qn`. Think about the per-render cost (every formula, every
  question) without optimizing it: correctness first, and note the shape for the memoization
  item already in `notes/database-decisions.md`.
* The `{ value, stale }` form still flows this thread; don't build on it.

### 3. The data model, as a clean break

> The three tables: `widgets` (from `expressions`, widened and global), `widgetings` (from
> today's `widgets`, one shape), `widgeteds` (from `bottings`), each from its row validator in
> `src/models/`, with `convex/schema.ts`, `reading.ts`, `authorize.ts` and the `hunts.perform`
> actions for adding, editing, moving and removing widgets and widgetings. The seeding mutation:
> the thirteen seed expressions as `jsonata` widgets and the three prompts as `aibot` widgets
> (dumdum's clueing; numnum's clueing; numnum's hint), with their tiers and token room, inserted
> when absent; and for every existing quiz with no widgetings, the widgetings today's default
> layout gives, under the labels its columns already name. The seed texts move out of
> `lib/ask/prompts.ts` and `models/expression.ts` into one seeds fixture the mutation reads. The
> bag's new paths, with the seed formulas rewritten to them and the three question fields,
> `BotSlots`, `bot.ts`, `bot-label.ts` and `bot-status.ts` gone; the aibot formulary keeps a
> temporary mapping from the three seeded widget labels to today's three ask jobs until thread
> 4 replaces the route. The reserved-label pattern. The library's own export and import; the
> hunt's export, sheet, mirror (`widget/pub/<label>`) and import following `exposed`. Bulk
> recalculation removed. Existing rows follow the rule on migration code above: the three old
> tables are expected to be cleared and re-seeded, not translated. Write the Coach's deploy
> procedure into `notes/deploy.md` with a ledger row saying what is cleared and why: export the
> hunt; clear the three old tables in the Convex dashboard (a push is refused while a table
> absent from the schema holds documents); deploy; run the seeding mutation; re-ask the bots.
> End with `losses.md` in the sprint directory: every table cleared, every row kind in it, what
> re-creates each and what nothing does.

*Orchestrator:* **done, PR #69** (review: three `fix:` commits kept). The worker was cut short by
the harness once and resumed; its convex-test helper caught a duplicate-label import bug, fixed
(first occurrence wins). Pulled forward and struck below: thread 4's service-reporting bots route;
thread 5's single cell (minus `JsonFold`), stale marks and marked seeds; thread 6's renames
(`WidgetingsEditor`, `LibraryModal`, `JsonataFields`) and the server's refusal to remove a worked
widget. `losses.md` is in this directory.

*Gloss.* The biggest thread. `src/models/{widget,widgeting,widgeted}.ts`, `convex/schema.ts`,
`convex/reading.ts`, `convex/authorize.ts`, `convex/writing/*` and `hunts.perform`;
`convex/_generated/` regenerated (its own commit); the seeds fixture and the seeding mutation;
`src/lib/vv/patterns.ts` for the reserved pattern; `Labelmaker` for `_2`, `_3`; exports,
imports, sheet and mirror; the removal of bulk (`src/lib/ask/bulk.ts`, `bulk_ishes_last`, the
"Recalculate all" button and `e2e/recalculate.spec.ts`); a large e2e churn (`bots`, `ishes`,
`expressions`, `asking`, `sheets`, `importing`, `quiz-history` specs). Splitting the PR's
commits so each passes is worth effort; one PR for the schema change is the rule.

*Look-ahead*:

* **From thread 2** (its progress section has the detail):
  - Replace `Standins.sourceOf` with a `RunSource` built from the new tables; callers change only
    that argument. `standins.ts` is the one file meant to go.
  - `LibraryWidgetT` becomes `WidgetT` as `src/models/widget.ts` is redefined.
  - Delete the `{ value, stale }` riders: `LiveRun.stale`, `QuizRun.stale`, `Runner.isStale`.
  - **The bots' cells lose their source.** `GuessCell` and `IshesCell` read the question's reply
    fields, which go here. Point them at `WidgetedT` (and `result_meta`), or pull thread 5's single
    cell body forward (`WidgetedReadout` in `cells/readouts.tsx` already shows any `WidgetedT`);
    the worker's call, declared.
  - The hunt's JSON export (`exporting.ts`) and the git table's per-botting fields start reading
    the runner once the reserved pattern exists.
  - `result_meta.reply_text` holds dumdum's verbatim reply; store it as one more key.
* **Seed the per-quiz widgetings by what columns name, not by "has none"** -- as the note
  refines it: a quiz with no widgetings whose columns name *any* of the default set gets the
  *whole* default set; a lean quiz gets nothing. The default list lives in `src/models/seeds.ts`,
  not read from `layout.ts`, which thread 7 shrinks. The mutation also re-points the column whose
  source is `question.butnot_ishes` to the new seeded `butnot_ishes` widget (thread 1's call).
* **Open PR #66** (the Coach's, not in this stack: import carries the bots' replies, marked
  stale) may land on main before this thread finishes. If it has, the finishing rebase brings it
  in: its import of replies becomes the note's rule (a pasted `ok` value into an empty cell,
  marked `result_meta.imported`), and its stale half is retired with the rest.
* **Store the aibot values in the shape thread 4's route will return** (thread 1's call), so
  thread 4 changes the route and not the rows or the formulas.
* **The seeds' `{ value, stale }` form has to go here**: its `stale` reads the ishes'
  `asked_text` comparison, which leaves with `bottings`. Rewrite the seed formulas to bare
  values while rewriting their paths, and declare it as thread 5's work pulled forward; thread 5
  keeps the views' side.
* **The `widgeteds` table admits thread 8's upsert**: an index on (question, widgeting) serves
  both the newest-row read and the upsert.
* **The library's export and import** need a door in the UI (the Export panel is the natural
  one); thread 6 may move it into the widget editor.
* Deploy procedure and ledger row in `notes/deploy.md`; `losses.md` in this directory. Both are
  for the Coach, before the deploy.

### 4. Pasted prompts

> The ask route's new contract: a rendered prompt, a model tier and token room in; a JSON object
> out, vetted as today (strings clipped, control characters refused, size bounded) before it is
> kept. `Approval` and the credentialed-services check stay; ~~`lib/bots/port.ts` reports services,
> not bots.~~ *(Done in thread 3.)* Template rendering with `mustache` (propose it per the library-first rule; HTML
> escaping off) over the input formula's object; an input that comes to nothing is not asked.
> The three seeded `aibot` widgets run through the new contract and the thread-3 mapping goes.
> The advice prompt generalized from `lib/formula-prompt.ts` to every formulary, saying in words
> what shape the author wants back. The `aibot` widget editor: prompt, input formula, config,
> with a live preview against a chosen question of the distilled object and the rendered prompt.

*Gloss.* `src/app/api/` ask route, `src/lib/ask/*` (contract, replies, prompts, models, tokens),
`src/lib/bots/port.ts`, `src/models/ask.ts`, the aibot formulary, `src/lib/formula-prompt.ts`
generalized into every formulary's `advice`, `notes/stack.md` for `mustache`.

*Look-ahead*:

* **From thread 3**: the ask route still answers from the seeds fixture (`seededWidgetFor`), so
  library edits to the seeded prompts don't reach the model: that mapping is what this thread
  removes. Numnum's seeded prompts already ask for `{"items": [...]}`; dumdum's is today's, to
  change here with the route -- in `src/models/seeds.ts`, which production has not yet seeded (the
  Coach deploys the stack, so one seeding sees the final fixture). The editor to extend is
  `LibraryModal.tsx` with `JsonataFields.tsx` beside it. The library is global and e2e specs share a
  database: an e2e spec edits only widgets of its own (`freshWidgetLabel` in `e2e/support.ts`).
  The review added `forced_label` to `ReservedWidgetingLabels`; add it to the decision note's
  *reserved pattern* while you are in the note for advice.
* **Build the aibot editor as the aibot arm of thread 6's widget editor**: one modal whose
  fields follow the formulary (start from `ExpressionsModal`/`ExpressionFields`; renaming it
  now is fine if it comes naturally, declared). Thread 6 then adds the jsonata arm, the usage
  line and the removal refusal rather than replacing anything.
* **The advice prompt** says in words what shape the author wants back; the route asks for "a
  JSON object" and no more (no result schema this sprint).
* **A free-form relay is more abusable** than three fixed jobs: keep `Approval` and the
  credentialed-services check exactly as strict, bound the prompt's size as well as the
  reply's, and say in HUMAN-whatsup that the rate limiting `notes/stack.md` lists under *Later*
  has moved closer.

### 5. Status

> ~~`ok`, `errored`, `missing`, projected in one place (the runner) from the newest `ok` row and
> any newer `errored` row.~~ *(Built in thread 2.)* ~~One cell body for every widgeted~~ *(thread 3)*: a scalar as text, anything else
> through the existing `JsonFold`; ~~one badge for `err`; `refresh: click` cells are askable,
> others read-only.~~ *(thread 3)* Sorts read `value`; the sheet and export write it. Retire the per-cell
> special cases (`guess.tsx`, `ishes.tsx`, the butnot-ishes mirror as a special cell), ~~the
> ishes' stale mark and the seeds' marked form.~~ *(thread 3)* Known regression to state in the PR: numnum's
> list of spans shows as folded JSON rather than its current prose list; a nicer presentation
> for a list of items is a later nicety, not this thread's.

*Orchestrator:* the projection was built in thread 2 (`Runner.widgetedFrom`), and thread 3 built the
single cell (`WidgetedAskCell` beside `WidgetedReadout`, one `ErrBadge`) and removed the stale marks
and the seeds' marked form; struck above. Left: `JsonFold` for non-scalars (objects show as JSON text
today), retiring what remains of `guess.tsx`/`ishes.tsx`, sorts and exports by `value` (the BUT NOT
ishes column sorts as text now, and a stored `ok` of `null` writes "null" but sorts as absent).

*Gloss.* `src/components/cells/` (a new single widgeted cell; `guess.tsx`, `ishes.tsx` and the
butnot-ishes special case retired; `ErrBadge.tsx` as the one badge), `JsonFold`, the sortings,
`exporting`, `sheets`. If thread 2 built the projection, this thread is views and deletions.

*Look-ahead*: thread 6's Widgets panel counts ok, errored and missing per widgeting;
`Runner.statusCounts` (thread 2) already gives them.

### 6. Views

> Two editors with different scopes. The **widgeting editor**, from the quiz page: pick a widget
> from the library (grouped by formulary), set the label, description and place in the run
> order (the existing `SortableList`), and a "New widget..." door that opens the other editor.
> The **widget editor**, from the library (today's `ExpressionsModal`, ~~kept and renamed~~ *(renamed `LibraryModal` in thread 3)*):
> formulary, formula, input formula, config, the live preview `ExpressionFields` has, the advice
> button, a line saying "worked by N widgetings across M quizzes, in H hunts", and removal
> refused while anything works it. The **Widgets panel** below the grid replaces *Prompts
> used*: the quiz's widgetings in run order, each with its formulary, its formula or prompt
> readable, its advice button, and counts of ok, errored and missing. MUI first, per
> `notes/views.md`.

*Orchestrator:* the panel's counts come from `Runner.statusCounts` (thread 2). Thread 3 renamed the
editors (`WidgetingsEditor.tsx`, `LibraryModal.tsx`, `JsonataFields.tsx`), adapted minimally, and the
server already refuses removing a worked widget; the editor's usage line and its refusal in the UI
remain. A *Library* tab in Export / Import holds the library's own export and import.

*Gloss.* `src/components/WidgetsEditor.tsx` becomes the widgeting editor; `ExpressionsModal`
becomes the widget editor (thread 4 may have started it); `src/state/widget-edit.ts` splits
along the two scopes; a new Widgets panel in `src/components/panels/` replaces *Prompts used*;
a query for the usage line (counts across hunts) in `convex/`, per
`notes/queries_hooks_and_subscriptions.md`.

### 7. The basic set and the catalogue

> A new quiz starts with columns for `label`, `title`, `qnum`, `clueing`, `full_answer` and
> `notes`, and no widgetings; `hint`, `chains_to` and `alt_text` stay on the question row with
> their columns opt-in. A new hunt seeds nothing (the library is global and seeded once). The
> widgeting editor's picker is the catalogue. `src/models/layout.ts`, `Hunt.blank`,
> `insertHunt` and the e2e fixtures follow.

*Gloss.* `src/models/layout.ts`, `Hunt.blank`, `insertHunt` (`convex/writing/`), the e2e
fixtures and environment (`e2e/environment*.ts`, `e2e/support.ts`) and every spec that assumed
the bots' or sums' columns on a new quiz: those specs add the widgetings they need through the
picker or a fixture.

### 8. Entry widgets

> The `entry` formulary: `config.entry_kind` one of `text`, `number`, `labelish`, `titleish`;
> no formula, no input, `refresh` neither; its cell is the existing field editors committing on
> blur to a `widgeteds` row that is **upserted**, one per (question, widgeting), rather than
> appended. A default `notes` entry widgeting may replace the starter set's `notes` column if
> that reads cleanly; otherwise `notes` stays a question field. Do not move `hint`, `alt_text`
> or `notes` off the question row: that is a data move, and a later call. Record in
> HUMAN-whatsup what moving them would take.

*Gloss.* The `entry` formulary, the upsert mutation, a cell built from the existing field
editors (`src/components/cells/fields.tsx`, `use-draft`), the widget editor's `entry` arm, and
`HUMAN-whatsup.md`.

*Look-ahead*: the reserved pattern forbids a widgeting labelled `notes` while `notes` is a
question field, so a default `notes` entry widgeting does not read cleanly; expect `notes` to
stay a question field this sprint, and say so.

## Decisions taken in YOLO

The orchestrator's calls, each a two-way door. Workers add theirs to their progress sections.

1. *(Planning; refined by thread 1.)* Thread 3 seeds a quiz's widgetings only when its columns
   name some of the default set (then the whole set), rather than giving every quiz with no
   widgetings the old defaults, so that the idempotent mutation stays harmless once thread 7's
   lean quizzes exist.
2. *(Planning.)* The seed formulas lose their `{ value, stale }` form in thread 3, not thread 5,
   since the ishes' staleness they read leaves with `bottings` there.
3. *(Planning.)* The decision note uses a plain decision-record form, since none of the earlier
   decisions is visible outside `/aside/`.
4. *(Thread 1, accepted.)* The rest of the note's *Settled here* list: notably `butnot_ishes` as a
   seeded `jsonata` widget (its view retires), dumdum's value as `{ guess, explanation }`, numnum's
   as `{ items }`, a third formulary fact `store`, and pub-widget edits under `mayChangeHunt`.
5. *(Thread 1, accepted.)* Imports keep pasted values per open PR #66, into empty cells only.
6. *(Thread 2 review, flagged.)* Dumdum's botting keeps its reply verbatim: the raw text rides in
   `result_meta.reply_text` and `Standins.bottingOf` prefers it. Adopted over rewording the
   validators' "verbatim" promise, so a partial landing of #68 loses nothing.
7. *(Thread 3 helper's finding.)* An import naming one widget label twice merges it once, the first
   occurrence winning, rather than refusing: imports merge by label.
8. *(Thread 3, accepted.)* `insertQuiz` tops up the library with the default widgetings' widgets it
   lacks (thread 7 drops it); `scripts/convex_dev --seed` seeds every local role; library actions
   ignore quiz locks; pasted widgeted values wait for #66.

## For the Coach

* Thread 1's minor questions, answered by YOLO for now (above), yours to overturn: `butnot_ishes`
  as a seeded widget; dumdum's `{ guess, explanation }`; the reading of #66.
* Thread 2's: three `eslint-disable-next-line @typescript-eslint/no-extraneous-class` on classes
  of statics (`JsonataFormulary`, `AibotFormulary`, `Widgeted`), or an `allowStaticOnly` override
  for `src/lib/formulary/**`, your pick; and `CLAUDE.md` still names the deleted `Expressed` as an
  example namespace (`Runner` would do).
* **Thread 3's deploy is a hand procedure**: `notes/deploy.md`, *Clearing the widget tables*, and
  `losses.md` here. Land and deploy the stack together (at least through thread 4): the seeding
  mutation inserts only what is absent, so production should be seeded once, from the final fixture.
* Your `dev` backend refuses the new schema until reset (`--reset --seed`); `pnpm dev` now passes
  `--seed`. Previews get only the twelve widgets a new quiz brings unless `build:vercel` adds
  `--preview-run seeding:seedWidgets` (deploy config left alone).
* Thread 3's open question: a paste holding widgetings but no questions changes nothing today
  (its widgetings dropped too). Merge them?
* A known limit (thread 3 review): the stored read takes one index range per question per storing
  widgeting, so roughly 999 questions by 5 `aibot` widgetings passes Convex's per-transaction
  bound. Fine at today's sizes; a read by widgeting or paging would lift it.
* Thread 3's suppression: one more `no-extraneous-class`/`no-static-only-class` disable, on `Widget`.
* PR #66 and #67 both edit `notes/vocabulary.md`'s *stale* entry: a small docs conflict for
  whichever lands second.

* CLAUDE.md points at `notes/decisions/2026-09-client-first.md`, and `notes/database-decisions.md`
  at `decisions/2026-09-convex.md`; neither exists outside `/aside/` since `af677fb`. Thread 1
  creates `notes/decisions/` afresh.
* The sprint skill models its plan on `whiteboard/convex_yay-plan.md`, which now lives under
  `/aside/`; this plan follows `whiteboard/20260930-foldable_ui/foldable_ui-plan.md` instead.
* The deploy of thread 3 onward is yours: the procedure lands in `notes/deploy.md`, what is lost
  in `losses.md`. Nothing is deployable piecemeal after thread 3 without that procedure.
