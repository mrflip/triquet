# Rewidgeting: progress

The running handoff for `rewidgeting-plan.md`, newer than the plan wherever they disagree.
Workers add their sections below the table, newest first.

## Status

| Thread | Label | Status |
|---|---|---|
| 1 | Design note and vocabulary | complete: PR #67 (docs only, unreviewed) |
| 2 | The formulary seam, no data change | complete: PR #68, stacked on #67 (reviewed: fixed, flagged, then clean) |
| 3 | The data model, as a clean break | complete: PR #69, stacked on #68 (reviewed: fixed) |
| 4 | Pasted prompts | complete: PR #70, stacked on #69 (reviewed: fixed) |
| 5 | Status | complete: PR #71, stacked on #70 (reviewed: fixed) |
| 6 | Views | pending |
| 7 | The basic set and the catalogue | pending |
| 8 | Entry widgets | pending |

## Thread 5: Status (2026-10-01)

Branch `20261001-widgeted_status`, PR #71, stacked on #70. Suites: typecheck and lint clean;
`pnpm test` 2631 passed (103 files); `pnpm test:e2e:agent` 197 passed, after resetting and
re-seeding the `agent` backend (`scripts/convex_dev agent --reset --seed true`; a bare
`scripts/convex_reset agent` needs the backend already running). `origin/main` had not moved. No
schema change, no `convex/_generated/` churn.

* **Built**:
  - **One value body** (`WidgetedValue` in `src/components/cells/readouts.tsx`), shared by
    `WidgetedReadout` and `WidgetedAskCell`: a number grouped by thousands, text or a boolean as
    itself, a list or an object as compact JSON (`JsonText`, new in `src/components/JsonFold.tsx`),
    null or `''` as the muted dash. A list or an object gets a `FoldButton` beside the cell
    (`Pretty-print <column title>`) that pretty-prints it. `WidgetedReadout` takes a `label` now.
  - **Null is nothing**: `Widgeted.textOf` writes '' for an `ok` null (sheet, git table);
    `Widgeted.isNothing` and `Widgeted.isStructured` are new. The export keeps the null.
  - **Sorts by value** (`Sortings.sortValueOf`): a list by its length, an object of one key as what
    it holds, an object of several keys not at all. The ishes columns sort by span count again.
  - **Docs**: *How a value reads* in the decision note; the null rule in the vocabulary's status entry.
* **Decisions taken**:
  - **The fold sits beside the cell, not in it.** The asked cell is one `<button>`, and a
    `<details>` inside it would be a control nested in a control (and its click is cancelled by the
    button's). So the cell form is `JsonText` (compact or pretty) with the house `FoldButton` outside
    the button, and the readout cell does the same, for one look. `JsonFold` itself (the editors'
    labelled fold) is unchanged.
  - **Closed, the JSON wraps** rather than ellipsizing to one line: a cell already scrolls inside
    its row, so the closed fold shows everything, and opening it adds structure.
  - **One rule for null**: shown, written and sorted as nothing, status kept, export lossless.
  - **One-key objects sort as their member**, since a reply is always an object: `{ items }` sorts
    by count, as the ishes did before the sprint; dumdum's two keys do not sort, as the guess did
    not. In the PR's open questions.
* **Deviations**: none. `guess.tsx`, `ishes.tsx` and the butnot-ishes special cell were already
  gone (thread 3); nothing was left to retire.
* **Discoveries**:
  - **`sonarjs/function-return-type`** reads each return statement's printed type, ignoring the
    declared one, so a recursive JSON walk returning `value.length` beside `value` is refused;
    `orderedBy`/`membersOf` in `sortings.ts` are shaped around it.
  - **Folded rows and short rows** (28px, 56px) clip a pretty-printed fold; the cell scrolls, as
    every widgeted cell does. Fine for now; thread 6's panel or a later nicety may want more room.
* **For the Coach**: the sort rule for objects (above), yours to overturn. No lint or type
  suppressions added.

*Review:* fixed. Kept `0178aa8`: the formula preview read "Comes to " and nothing for a null result,
since `textOf` now gives `''` for an `ok` null; it now says "nothing (a dash in the grid)". Left,
minor: a quick double-click on a cell's fold button can reach the cell's double-click handler (a
re-ask in askable columns); unreachable today because askable sum columns hold numbers, but live
once an askable column can come to a list or object (threads 6, 8).

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
    `src/lib/vv/patterns.ts`: `Promptish` (16000), `Replykey`, `ReplyShape` (*Orchestrator:* after review, 15 deep, 2000 items a list, 1024 keys an object).
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

*Review:* fixed. Kept `a24874d` (an input formula coming to a JSONata function passed the object
check, then became `undefined`: the cell would have asked with no input; the check now runs after
`plainJson`) and `359055d` (vetting accepted replies Convex refuses to store: a row allows 16 levels
counting itself and 1024 keys an object; `ReplyShape` is now `{ depth: 15, items: 2000, keys: 1024 }`,
the decision note corrected). Gate otherwise sound. Left, minor: `{{{name}}}` and `{{&name}}` skip the
`escape` hook, so a list or object fills in as `[object Object]` (thread 6 settles it); older than
the thread, a non-JSON request body throws before the `try` and Next answers 500.

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

*Orchestrator:* condensed after thread 4; PR #68 and its description hold the full telling.

Branch `20261001-formulary_seam`, PR #68, stacked on #67. Suites: `pnpm test` 2347, e2e 193.

* **Built**: `src/lib/formulary/` (`formularies.ts`, `jsonata.ts`, `aibot.ts`, `runner.ts` with
  `runQuiz`, `widgetedFrom`, `statusCounts`, `inputOf`). The runner reads a `RunSource`
  `{ quiz, place, steps: [{ widgeting, widget }], storedOf }`; thread 3 replaced the stand-in source.
  `src/models/widgeted.ts` (`WidgetedT` and statics), `widgeting.ts`. The grid, sorts (browser and
  server), `exposure.ts`, `sheets.ts`, `quizgit.ts` and the preview read a `QuizRun`.
  `src/lib/expressed.ts` gone. Tests in `tests/lib/formulary/`, helpers in `tests/support/runs.ts`.
* **Decisions taken**: `run(widget, widgeting, bag)` works out the input itself, and the runner also
  calls `input` for `click` widgetings so a cell knows if it is askable; a widgeting labelled like a
  question key is left out of the bag; JSONata values are round-tripped to plain JSON.
* **Pulled forward**: thread 5's projection, thread 6's counts, parts of thread 3.
* **Discoveries**: `aibot.ts` imports `lib/ask/port.ts`, so the Convex bundle carries a `fetch` it
  never calls (harmless). The per-render cost, W widgetings by Q questions, is noted in
  `notes/database-decisions.md`, item 5.
* **For the Coach**: three `no-extraneous-class` disables (classes of statics), or an
  `allowStaticOnly` override for `src/lib/formulary/**`; `CLAUDE.md` still names `Expressed`.

*Review:* flagged, then clean. Kept `3fa8c76` (bulk busy marks only for `aibot`); the flagged
not-verbatim dumdum botting was fixed in `d1ca704` (since moot: thread 4's JSON route). Left, minor:
re-extracting from a sum cell does nothing when no widgeting works the numnum widget.

## Thread 1: Design note and vocabulary (2026-10-01)

*Orchestrator:* condensed after thread 4; the decision note is the record.

Branch `20261001-widgets_decision`, PR #67 (docs only, unreviewed), carrying the unmerged
`20261001-rewidgeting_start` and `20261001-rewidgeting_plan` beneath it.

* **Built**: `notes/decisions/2026-10-widgets.md` (new `notes/decisions/`), whose *Settled here* list
  outranks the plan's glosses; `notes/vocabulary.md` with the new words and a *Retiring* section.
* **Deviations**: the per-quiz seeding gives the whole default set to a quiz whose columns name any
  of it; imports keep pasted values per open PR #66 (into empty cells, `result_meta.imported`).
* **Discoveries**: PR #66 (the Coach's, not in this stack) and #67 both edit the vocabulary's *stale*
  entry; `src/lib/vv/patterns.ts` imports nothing, so the reserved pattern is built from words
  `src/models/widgeting.ts` supplies.
* **For the Coach**: confirm `butnot_ishes` as a seeded widget, dumdum's `{ guess, explanation }`,
  and the #66 reading; dangling decision-record links in `CLAUDE.md`,
  `notes/database-decisions.md`, `notes/vocabulary.md`.
