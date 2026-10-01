# Rewidgeting: progress

The running handoff for `rewidgeting-plan.md`, newer than the plan wherever they disagree.
Workers add their sections below the table, newest first.

## Status

| Thread | Label | Status |
|---|---|---|
| 1 | Design note and vocabulary | complete: PR #67 (docs only, unreviewed) |
| 2 | The formulary seam, no data change | complete: PR #68, stacked on #67 (reviewed: fixed, flagged, then clean) |
| 3 | The data model, as a clean break | complete: PR #69, stacked on #68 (reviewed: fixed) |
| 4 | Pasted prompts | complete: PR #70, stacked on #69 |
| 5 | Status | pending |
| 6 | Views | pending |
| 7 | The basic set and the catalogue | pending |
| 8 | Entry widgets | pending |

## Thread 4: Pasted prompts (2026-10-01)

Branch `20261001-pasted_prompts`, PR #70, stacked on #69. Suites: typecheck and lint clean;
`pnpm test` 2611 passed (103 files); `pnpm test:e2e:agent` 196 passed. `origin/main` had not
moved, so the finishing rebase replayed nothing. No schema change, and no `convex/_generated/` churn.

* **Built**:
  - **The route's contract** (`src/lib/ask/contract.ts`, `src/app/api/ask/route.ts`). In:
    `{ prompt, ...aibotConfig }`. Out: `{ ok, value, truncated, model_tier_applied, approx_tokens }`,
    or a failure kind; `cutShort` is new (`lib/notices.ts`). The route streams the prompt to the
    tier's model with a one-line system prompt asking for a single JSON object, and reads the text
    (`answerOf`: a code fence is forgiven).
  - **Vetting** (`src/lib/ask/replies.ts`: `vetReply`, `shapeIssue`). It clips strings, and
    refuses control characters, Convex-unkeepable keys, depth, breadth and size. The bounds are in
    `src/lib/vv/patterns.ts`: `Promptish` (16000), `Replykey`, `ReplyShape` (16 deep, 2000 a level).
    `WidgetedJson` (40000) is unchanged.
  - **Rendering** (`src/lib/ask/prompts.ts`: `renderPrompt`, `templateIssue`, `unfilledKeys`) with
    mustache. `AibotFormulary.prompt` renders a widget for a bag. `AibotFormulary.input` hands on
    plain JSON (`Formulas.plainJson`, `Formulas.isFunction`, which now also knows JSONata's
    `_jsonata_lambda`).
  - **Advice** (`src/lib/formulary/advice.ts`: `advicePrompt`, `AdviceSpec`). Each formulary
    supplies its spec. `lib/formula-prompt.ts` is gone, and its test moved to `advice.test.ts`.
  - **The editor**: `AibotFields.tsx`, and `PreviewPicker.tsx` with `use-preview-bag.ts` (shared
    with `JsonataFields`). `LibraryModal` opens every widget, with fields that follow the
    formulary. `WidgetingsEditor`'s `PromptDialog` mirrors `FormulaDialog`: *＋ New widget…*, then
    `AibotFields`. In `widget-edit.ts`: `JsonataDraft | AibotDraft`, `BlankAibotDraft`,
    `planWidgetEdit`, `draftOf`.
  - **Gone**: `SeededAsks`, `guessValueOf`, `textOf`, `seededWidgetFor`, `lib/ask/errs.ts`,
    `TextkindVals`, and the route's `IshItemsFormat`. Dumdum's seed prompt asks for
    `{"guess", "explanation"}`.
  - **Docs**: the decision note (route as built, advice, `forced_label` in the reserved pattern),
    `notes/stack.md` (mustache), HUMAN-whatsup.
* **Decisions taken**:
  - **The browser renders; the route never sees a template.** The decision note's interface
    table already said so. The route bounds the prompt it is sent.
  - **`servicelabel` rides in the request** beside tier and room (the whole `aibotConfig`), so
    the credentials check reads the widget's own service. In PR #70's open questions.
  - **No structured output; JSON read from text.** An open object cannot be a structured-output
    schema (`additionalProperties` must be false), and Opus 5 refuses a prefill.
  - **`cutShort` is a new failure kind** rather than `unreadable`: it says what to do (more tokens).
  - **A template that does not parse, or a prompt past its bound, is recorded as an errored
    widgeted** (message only, `result_meta: {}`), asking nothing, so the cell says why. An input
    that fails still records nothing, as before.
  - **The widget editors do not refuse a broken template on Apply**, as the formula editor does
    not refuse a broken formula: the field names it as typed, and the cell fails without asking.
  - **A new prompt widget starts** on `{ 'clueing': qn.clueing }`, the quick tier and 1024 tokens
    (`BlankAibotDraft`). The *+ New prompt…* dialog now opens on *＋ New widget…*, as the formula
    dialog does, where it used to open on the library's first prompt.
  - **`unfilledKeys`** reads only the template's top level. Keys inside a section are the
    section's business.
* **Pulled forward** (strike from thread 6): the library's gear opens prompts (`LibraryModal`'s
  `aibot` arm), and the widget editor's fields follow the formulary. Thread 6 adds the usage line,
  the removal refusal in the UI, and the formulary choice for a widget made from the library itself
  (new widgets are still made only from a quiz's widgetings).
* **Deviations**: none from the plan. One from the decision note's sketch: the advice prompt's
  section on a widgeting's purpose is worded "in this quiz" for both formularies (aibot's said
  "here").
* **Discoveries**:
  - **A new widgeting of a new widget got a number's column width** (78px), because the plan
    looked its formulary up in a library that did not hold it yet. It is fixed (`widget-edit.ts`
    reads the draft's formulary). It never showed before, because only formulas could be new.
  - **Convex refuses some object keys** (`$`-led, non-ASCII, over 1024 characters) anywhere in a
    value, `CVX.any()` columns included. A model's reply is vetted against that now. A `jsonata`
    value is never stored, so it is unaffected.
  - **Any backend seeded before this thread holds dumdum's old prompt** (seeding inserts only what
    is absent). Its guesses come back `unreadable` until it is reset or the prompt is edited. The
    e2e roles are emptied every run; `agent` and the Coach's `dev` are not. Also in HUMAN-whatsup.
  - **Opus 5 thinks by default** (adaptive), and that thinking spends `max_tokens`. The careful
    tier's 4000 tokens hold today's spans; a pasted prompt with a long answer on the careful tier
    may come back `cutShort`. The route sets no `thinking` or `effort`, as before.
* **For the Coach**:
  - **Rate limiting has moved closer** (HUMAN-whatsup): the route relays any prompt while asking is on.
  - **`mustache` installed** without asking first, as the plan proposed and the stack rule allows.
  - **`servicelabel` in the request**: keep it, or have the route assume `claude`?
  - **No lint or type suppressions added.**

## Thread 3: The data model, as a clean break (2026-10-01)

Branch `20261001-widget_tables`, PR #69, stacked on #68. Suites: typecheck and lint clean;
`pnpm test` 2555 passed (104 files: unit 2164, convex 391); `pnpm test:e2e:agent` 189 passed.
`origin/main` had not moved, so the finishing rebase replayed nothing. `convex/_generated/` changed
by 288 bytes (`api.d.ts`), small enough to ride in the `feat:` commit.

* **Built**:
  - Tables (`convex/schema.ts`): `widgets` is now the global library (a union on `formulary`,
    indexes `by_scope_and_position`, `by_scope_and_label`); `widgetings` (`by_quiz_id_and_position`,
    `by_widget_label`); `widgeteds` (`by_question_id_and_widgeting_id`, which serves the
    newest-first cell walk and will serve thread 8's upsert as one read, and `by_widgeting_id`).
    `expressions` and `bottings` gone; `quizzes.bulk_ishes_last` gone.
  - Models: `src/models/widget.ts` redefined (`WidgetT`, `JsonataWidgetT`, `AibotWidgetT`,
    `WidgetRowT`, `WidgetPatch`, `Widget.fill/keyOf/titleOf/exported`, `JsonataDefaultInput`,
    `AibotDefaultInput`, the `library` export shape); `src/models/widgeting.ts` (validators, the
    reserved pattern `ReservedWidgetingLabels`, `Widgeting.forWidget` with `_2`, `_3`);
    `src/models/widgeted.ts` gains the row, the browser's `record`, and the stored-history
    validators; `src/models/seeds.ts` (`SeedWidgets` 17, `DefaultWidgetings` 12);
    `src/models/service-status.ts`; `QuestionT.stored`, `RankField`; `QuestionWidgetLabel` moved to
    `column.ts`, `QuestionViewVals` is `['butnot']`. Gone: `bot`, `bot-label`, `bot-status`,
    `botting`, `expression`, `guess` models; `ish.ts` keeps the item shapes only.
  - Convex: `reading.ts` (`libraryOf`, `widgetForLabel`, `isWorked`, `widgetingsOf`, `cellRowsOf`,
    `storedOf`, `allStoredOf`); `convex/widgets.ts` (`widgets.library`, any ident);
    `convex/seeding.ts` (`seedWidgets`); `convex/writing/library_actions.ts` (add, edit, move,
    delete refused while worked, import by label); widgeting actions in `layout_actions.ts`;
    `record_widgeted` in `quiz_actions.ts`; `authorize.ts`'s header and `mayReadLibrary`.
  - Browser: `useHunt` watches the library (and the history feed does); `Runner.sourceOf` from the
    new rows replaces `Standins` (gone); asks record `record_widgeted`; one asked cell
    (`WidgetedAskCell`) and one read-only cell for every widgeting; the widgetings editor
    (`WidgetingsEditor.tsx`), the library modal (`LibraryModal.tsx`), `JsonataFields.tsx`; a
    *Library* tab in Export / Import for the library's own export and import.
  - Serialization: the hunt export's flat `{ status, value }` per widgeting; the sheet and git
    table by `exposed` (`<label>.status`, `<label>.value`); the mirror's
    `tq/widget/pub/<label>.tqwidget.json`; import merges widgetings by label.
  - Bulk removed: `src/lib/ask/bulk.ts`, the button, `apply_bulk_ishes`, the `bulk_ishes` job,
    `e2e/recalculate.spec.ts`.
  - Docs: `notes/deploy.md` (*Clearing the widget tables*, and a ledger row), `losses.md` here,
    `notes/convex.md` and `notes/queries_hooks_and_subscriptions.md` brought up to date.

* **Decisions taken**:
  - **`insertQuiz` gives the library whichever of its default widgetings' widgets it lacks**, so a
    new quiz never works a missing widget. Thread 7 drops this with the defaults.
  - **`scripts/convex_dev --seed`** runs `seeding:seedWidgets` after the push (and any reset). The
    e2e server and the three dev scripts pass it, so every local role's library is seeded as
    production's will be. Thread 7, whose new quizzes start lean, already has its library on every
    local role from this.
  - **Library actions are not refused by a quiz lock**, as the hunt's expressions were not.
  - **An import naming one label twice merges it once**, the first occurrence (`import_widgets`
    and `insertAbsentWidgets`; the orchestrator's call on the convex helper's finding).
  - **The asked cell's metaline** (tier, cut short, tokens) reads the stored row's `result_meta`
    (`question.stored[label].ok.result_meta`); `WidgetedT` itself stays `{ status, value, err }`.
  - **The seeded numnum prompts already ask for `{"items": [...]}`**: the route's structured output
    returns that shape already. Dumdum's prompt is today's, for thread 4 to change with the route.
* **Pulled forward** (strike from the later threads):
  - From thread 4: `/api/bots` reports services (`src/models/service-status.ts`; `bot-status.ts` gone).
  - From thread 5: one cell for every widgeted (`WidgetedAskCell` beside `WidgetedReadout`, one
    `ErrBadge` on `WidgetedErrT`), minus `JsonFold`: an object shows as its JSON text. The seeds'
    `{ value, stale }` form and every stale mark are gone. Left for thread 5: `JsonFold` for objects.
  - From thread 6: the renames `WidgetsEditor`→`WidgetingsEditor`, `ExpressionsModal`→`LibraryModal`,
    `ExpressionFields`→`JsonataFields`, each adapted minimally to the new model; removing a widget is
    refused on the server while any widgeting works it (the editor does not count usage yet).
* **Deviations**:
  - **Pasted widgeted values are not imported**: PR #66 has not landed, and the note's rule 13
    waits on it. `importInto`'s doc says so.
  - **A paste with widgetings but no questions changes nothing** ("holds no questions"); its
    widgetings are dropped too. Untested; a ruling would settle it.
* **Discoveries**:
  - **The library is global, and the e2e specs share one database**: a spec that edits a seeded
    widget changes it for every spec running beside it. `e2e/widgets.spec.ts` (was
    `expressions.spec.ts`) edits only widgets of its own (`freshWidgetLabel` in `e2e/support.ts`).
    Threads 4, 6 and 8 should keep to that.
  - **A fresh backend's library holds only what seeding or a new quiz gave it.** Without `--seed`,
    a new quiz brings its twelve default widgets and nothing else: the five text seeds are missing.
    Previews are in that state today (HUMAN-whatsup).
  - **`record_widgeted` on a widgeting whose widget is gone is refused `notStored`**, not
    `widgetGone` (unreachable today: a widget is not removed while worked).
  - **A stored `ok` value of `null`** is written as the text "null" by the sheet and git table, but
    sorts as absent. Thread 5's cell and sort work is the place to settle it.
  - **Zod refusal notices are joined with `;; `** (`src/lib/refusals.ts`), which reads oddly in an
    alarm; older than this thread.
  - **`Quiz.blank()` carries no widgetings**, while `Hunt.blank()` adds `defaultLayout()`: a unit
    fixture that wants the defaults spreads `defaultLayout()` itself.
  - **Seeded production rows will not follow later fixture edits**: `seedWidgets` inserts only
    what is absent. Thread 4, changing dumdum's prompt with the route, either lands before the
    sprint's deploy (one seeding then) or revises a seed still holding its old text.
* **For the Coach**:
  - **The deploy is a hand procedure**: `notes/deploy.md`, *Clearing the widget tables*, and
    `losses.md` beside this file for what it loses.
  - **Your `dev` backend refuses the new schema** until it is reset (`--reset --seed`) or cleared
    the same way; `pnpm dev` now passes `--seed`.
  - **One lint suppression**: `eslint-disable-next-line @typescript-eslint/no-extraneous-class,
    unicorn/no-static-only-class` on `Widget` (`src/models/widget.ts`), a class of statics over a
    union, as `Widgeted` is.
  - **Previews** would want `--preview-run seeding:seedWidgets` in `build:vercel`; deploy config
    left alone.
* **Other files**: `losses.md` here (read before the deploy, or to know what a re-seeded quiz
  lacks).

*Review:* fixed. Kept: `6a84563` (`allStoredOf` read an index range per question for every
widgeting, `jsonata` included, overrunning Convex's per-transaction bound on a few hundred
questions; now only formularies that `store`); `7a408ce` (`forced_label` reserved: the export's flat
widgeteds could overwrite it and break re-import; the decision note doesn't list it yet);
`7bf94ea` (the jsonata preview ignored the widget's own input formula). Left, minor: the stored
read still overruns at roughly 999 questions by 5 `aibot` widgetings (needs a read by widgeting or
paging); the ask route answers from the seeds fixture until thread 4; the BUT NOT ishes column shows
raw JSON and sorts as text until thread 5.

## Thread 2: The formulary seam, no data change (2026-10-01)

Branch `20261001-formulary_seam`, PR #68, stacked on #67. Suites: typecheck and lint clean;
`pnpm test` 2346 passed; `pnpm test:e2e:agent` 193 passed. `origin/main` had not moved, so
there was nothing to replay.

* **Built**:
  - `src/lib/formulary/`:
    - `formularies.ts`: the interface, its types (`InputOutcome`, `LiveRun`, `AskedT`), and the
      lookup `formularyFor`.
    - `jsonata.ts`: `JsonataFormulary`, wrapping `Formulas` and the reading `Expressed` did.
    - `aibot.ts`: `AibotFormulary`; `SeededAsks`, the temporary map from widget label to the
      route's fixed job; `guessValueOf`.
    - `runner.ts`: `runQuiz`, `widgetedOf`, `inputOf`, `stepOf`, `bagsAt`, `statusCounts`,
      `widgetedFrom` (the projection), `placeOf`, and the `QuizBag` and `QuizPlace` types.
    - `standins.ts`: today's rows as a `RunSource`. This is the one file thread 3 replaces.
  - Models:
    - `src/models/widgeted.ts`: `WidgetedT`, its validator, `StoredWidgetedT`,
      `WidgetedHistoryT`, `WidgetedRecordT`, and the `Widgeted` statics.
    - `src/models/widgeting.ts`: the type `WidgetingT`.
    - `src/models/widget.ts`: `FormularykindVals`, the `jsonataConfig` and `aibotConfig`
      validators, `AibotTokensMax`, and `LibraryWidgetT`.
  - Every reader of a worked-out column takes a `QuizRun`: the grid, the sorts (browser and
    server), `exposure.ts`, `sheets.ts`, `quizgit.ts` and the expression preview.
  - Asks go through `AibotFormulary.run` and are keyed by widgeting label. `src/lib/expressed.ts`
    is gone.
  - Tests: `tests/lib/formulary/`, `tests/models/widgeted.test.ts`, and `tests/support/runs.ts`
    (`runOf`, `runHolding`).
* **Decisions taken**:
  - **The runner reads a `RunSource`**: `{ quiz, place, steps: [{ widgeting, widget }], storedOf }`.
    Thread 3 builds one from the new tables in place of `Standins.sourceOf`. Callers then change
    only that argument.
  - **`run(widget, widgeting, bag)` works out the input itself**, as the design sketch has it.
    The runner also calls `input` separately for `click` widgetings, so a cell knows whether it
    is askable (`Runner.inputOf`).
  - **The retiring `{ value, stale }` form rides beside `WidgetedT`, not in it**:
    `LiveRun.stale`, and `QuizRun.stale` read by `Runner.isStale`. The bag gets the bare value.
    Thread 3 deletes both.
  - **`LibraryWidgetT` is an interim name**, because `WidgetT` still means a quiz's widget.
    Thread 3 renames it as it redefines `src/models/widget.ts`.
  - **A widgeting whose label matches a key a question already has in the bag** (its exposed
    fields, `rank`, the three aliases) is left out of the bag, never shadowing the question's own
    field. Thread 3's reserved pattern makes this unreachable.
  - **Dumdum's reply** is split into `{ guess, explanation }` for the bag, each trimmed. The
    answered record also keeps the reply verbatim in `result_meta.reply_text`, and
    `Standins.bottingOf` records that as the botting's `reply_text`, so the botting stays verbatim
    as `models/botting.ts` promises (the reviewer's finding, fixed on the branch). Thread 3 may
    store `result_meta.reply_text` as one more key of the free bag. Thread 4's JSON-object route
    makes it moot.
  - **`useBots().unavailableNotice` takes a widget** and checks its `config.servicelabel`
    against the bots route's statuses. The notice text is unchanged.
* **Deviations**:
  - **The bots' cells (`guess.tsx`, `ishes.tsx`) still read the question's reply fields** for
    their body and metaline. Askability, the in-flight state and the ask itself come from the
    runner. Retiring the cells is thread 5's.
  - **The hunt's JSON export (`exporting.ts`) does not read the runner.** It carries no
    worked-out values today, and flat widgeteds in it would collide with question fields until
    the reserved pattern exists (thread 3).
  - **The git table keeps today's exposed fields per botting.** Its expressing columns read the
    runner, as the sheet's do.
* **Pulled forward** (strike from the later threads):
  - From thread 5: the status projection, `Runner.widgetedFrom`.
  - From thread 6: per-widgeting counts, `Runner.statusCounts`.
  - From thread 3: `FormularykindVals` and the config validators in `src/models/widget.ts`;
    `WidgetedT` and its validator; the bag's `params` and `widgeting_label`; the seeded `aibot`
    input formulas (in `standins.ts`); and the `aibot` value shapes in the bag.
* **Discoveries**:
  - **Thread 3 must give the bots' cells something to read.** When `guess`, `clueing_ishes` and
    `hint_ishes` leave the question, `GuessCell` and `IshesCell` have nothing left. Either thread
    3 points them at `WidgetedT` and `result_meta`, or it pulls thread 5's single cell forward.
    `WidgetedReadout` (`cells/readouts.tsx`) already shows any `WidgetedT`.
  - **The `aibot` formulary imports `lib/ask/port.ts`** (a `fetch`), so the Convex bundle now
    includes it through `runner` (the server-side sort). Nothing calls it there; the push and
    convex-test are both fine with it.
  - **JSONata's objects have no prototype**, and its lists carry markers. `jsonata.ts` hands on
    plain JSON (a `UU.jsonify` round trip) so a value is honest `JsonT`.
  - **The per-render cost** is noted in `notes/database-decisions.md`, item 5. It is W
    widgetings by Q questions: an input formula and a formula per `jsonata` cell, an input
    formula per `aibot` cell, and one copy of each question's bag entry per widgeting.
  - **The expression editor's preview** reads the bag before the widgeting being edited. A new
    expression, not yet worked by any widgeting, reads the bag after every one.
* **For the Coach**:
  - **Three `eslint-disable-next-line @typescript-eslint/no-extraneous-class`** comments, on
    `JsonataFormulary`, `AibotFormulary` and `Widgeted`. These are classes of statics with no
    instance fields. An `allowStaticOnly` override for `src/lib/formulary/**` would be the
    alternative.
  - **`CLAUDE.md` still names `Expressed`** as an example namespace under *Architecture*. The
    module is gone, and I left `CLAUDE.md` for you to edit.

*Review:* flagged, then clean. First pass kept one fix, `3fa8c76` (a bulk run marked busy any
widgeting whose label matched a seeded bot, a `jsonata` one included; now `aibot` only); flagged
dumdum's botting no longer verbatim, fixed by the resumed worker in `d1ca704` on the orchestrator's
direction. Left, minor: re-extracting from `clueing_full`/`hint_full`/`butnot_full` does nothing
when no widgeting works the numnum widget (follows from keying asks by widgeting);
`Standins.metaOf` does not rebuild `reply_text` from stored history (no effect today; moot after
threads 3-4). Second pass over `d1ca704`: clean.

## Thread 1: Design note and vocabulary (2026-10-01)

Branch `20261001-widgets_decision`, PR #67, carrying the two unmerged ground branches beneath it
(`20261001-rewidgeting_start` on `20261001-rewidgeting_plan`, neither with a PR). Suites, after
the rebase onto `origin/main`: typecheck and lint clean, `pnpm test` 2289 passed, `pnpm test:e2e`
193 passed. Docs only.

* **Built**: `notes/decisions/2026-10-widgets.md`, in a new `notes/decisions/`: the design
  threads 2 to 8 build to. Its *Settled here* list, at the end, is every call it made where this
  plan left one loose. `notes/vocabulary.md`: the new words fill its *Widgets* section, the old
  ones sit under *Retiring*, and *Widgets and columns* became *Columns and the bag*.
* **Decisions taken** (the note has the detail and the reasons). Names: `src/lib/formulary/`
  holding `formularies.ts`, `jsonata.ts`, `aibot.ts`, `runner.ts`; `src/models/widget.ts`,
  `widgeting.ts`, `widgeted.ts`; `WidgetedT` is the `{ status, value, err }` read and `WidgetedRowT`
  the row. Every formulary runs over its input, not the bag. A third reported fact, `store`. The
  widget row is a union on `formulary`, with config schemas in the model. The seeds fixture is
  `src/models/seeds.ts`, and the seeding mutation is `seedWidgets` in `convex/seeding.ts`. The
  bag's paths are `qn.dumdum` (`{ guess, explanation }`), `qn.numnum_clueing` and `qn.numnum_hint`
  (`{ items }`). `butnot_ishes` becomes a seeded `jsonata` widget, and its view retires. The bag
  gains `params` and `widgeting_label`. A widgeting exposes `status` and `value`. The mirror path is
  `tq/widget/pub/<label>.tqwidget.json`. Widget actions ride `hunts.perform` under
  `mayChangeHunt`. The indexes are listed in the note.
* **Deviations**: two refinements of plan calls.
  - The orchestrator's YOLO call 1 is refined: the seeding mutation creates the **whole** default
    set for a quiz whose columns name any of it. A column can be removed while its widget is kept,
    so "only what columns name" could seed a sum without the numnum widgeting it reads. A lean
    quiz still gets nothing.
  - The note's import rule follows open **PR #66** (the Coach's reversal of "replies are recorded
    by asking, never pasted"): a pasted `ok` value of a stored widgeting goes into a cell with no
    row, marked `result_meta.imported`.
* **Discoveries**:
  - PR #66 is open and not in this stack. It makes guesses go stale and carries replies on
    import. Its stale half is retired by this sprint. Its edit to `notes/vocabulary.md`'s *stale*
    entry conflicts with #67's move of that entry under *Retiring*: a docs-only conflict for
    whichever lands second.
  - `src/lib/vv/patterns.ts` imports nothing, on purpose, so the reserved pattern cannot read
    `Question.exposed` there. The note gives it a builder that takes the words, which
    `src/models/widgeting.ts` hands it.
  - The seeded prompts are already about 960 characters. An `aibot` formula needs a bound larger
    than `formulaish`'s 999 (the note says 3600).
  - Today's action kinds `add_widget` and its siblings act on a quiz's widgets. In thread 3 they
    come to mean the library's.
* **For the Coach**:
  - Confirm `butnot_ishes` as a seeded widget (or prefer the view reading `numnum_hint`).
  - Confirm dumdum's `{ guess, explanation }`.
  - Confirm the #66 reading.
  - `CLAUDE.md`, `notes/database-decisions.md` and `notes/vocabulary.md` still link decision
    records that are not in the tree.

*Review:* none: docs only, per the sprint skill. *Orchestrator:* both deviations accepted and the
plan's glosses revised to match; the note's *Settled here* list now outranks the plan's glosses.
