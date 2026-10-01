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
| 6 | Views | complete: PR #72, stacked on #71 (reviewed: fixed) |
| 7 | The basic set and the catalogue | pending |
| 8 | Entry widgets | pending |

## Thread 6: Views (2026-10-01)

Branch `20261001-widget_views`, PR #72, stacked on #71. Suites: typecheck and lint clean; `pnpm test`
2651 passed (105 files); `pnpm test:e2e:agent` 197 passed (plus 3 environment checks). `origin/main`
had not moved. No schema change; `convex/_generated/` unchanged (a new function in an existing
module does not touch `api.d.ts`).

* **Built**:
  - **The widgeting editor** (`src/components/WidgetingsEditor.tsx`, `WidgetingDialog`): picks a
    widget (`WidgetPicker`, an MUI `Autocomplete` grouped by formulary, filtered on label, title and
    description), sets label and description, no formula box. One *+ New widgeting…* button replaces
    *+ New formula…* and *+ New prompt…*. Doors: *New widget…* (a new widgeting) opens the widget
    editor over it and picks what it made (held in `made` until the library's watch brings it
    back); *Edit the widget…* opens the widget it works. Planning is `src/state/widgeting-edit.ts`
    (`planWidgetingEdit`, `NewColumnWidthPx`), split from `widget-edit.ts`.
  - **The widget editor** (`src/components/WidgetEditor.tsx`, out of `LibraryModal.tsx`): a new
    widget chooses its formulary (`blankDraftOf`, `planNewWidget`); a held one shows the usage line
    (`role="status"`, named *Usage*) and swaps *Remove widget* for "It cannot be removed while a
    widgeting works it." while the count is above nought. `LibraryModal` gained *+ New widget…*.
    Words: `src/components/widget-words.ts` (`FormularyWords`, `usageLine`).
  - **The usage count**: `widgets.usage` (`convex/widgets.ts`), `usageOf` (`convex/reading.ts`),
    `mayCountUsage` (`convex/authorize.ts`: a smith of any hunt), `WidgetUsageT` (`src/lib/rows.ts`),
    cap `WidgetingsCounted` (999, then "at least"), hook `src/state/use-widget-usage.ts`.
  - **The Widgets panel** (`src/components/panels/WidgetsPanel.tsx`), in place of *Prompts used*:
    MUI `Accordion`s in run order, summary = label, formulary noun and widget label, chips for ok /
    errored / missing (`Runner.statusCounts`); details = descriptions, the formula or prompt in a
    `ReadonlyBox`, a prompt's input formula, and the advice button (sample: the lowest-Q# question).
  - **`templateIssue`** refuses `{{{name}}}` and `{{&name}}`, sections included, naming the first
    and pointing at `{{name}}`; `unfilledKeys` still reads them (it checks parsing only).
  - **e2e**: `addWidgeting`, `pickWidget`, `newWidgetingDialog` in `e2e/support.ts`.
* **Decisions taken**:
  - **The picker is an `Autocomplete`**, not a grouped `Select`: thread 7 makes it the catalogue,
    and a catalogue wants finding by typing.
  - **An *Edit the widget…* door** on an existing widgeting, beyond the plan's *New widget…*: the
    widgeting dialog lost its widget fields, and this keeps a widget one click from the quiz.
  - **Usage is counted for a smith of any hunt** (the decision note's "anyone who may edit the
    widget"), null for anyone else. While the count is still arriving the remove button shows, and
    the server's refusal is the backstop.
  - **The panel's summary names the widget by label, not title**: an accordion summary's accessible
    name is all its text, and the title collided with the grid's header buttons in e2e.
  - **A locked quiz's widgeting plan is nothing**; its fields are disabled, the widget door is not.
* **Pulled forward** (strike from thread 7): the picker is built as the catalogue: grouped,
  searchable, and tested on a quiz with no widgetings (`widgeting-edit.test.ts`). Thread 7 needs only
  to make new quizzes lean and point its fixtures and specs at `addWidgeting`.
* **Deviations**:
  - **The library's export and import stay on the Export panel's *Library* tab**; the note said
    thread 6 *may* move them to the widget editor, which is one widget's, not the library's.
  - **`notes/queries_hooks_and_subscriptions.md`** now says outright that a dialog-only facet is
    watched by that dialog's own hook: "components never watch" read as forbidding what its own
    rule about counts in one dialog asked for.
* **Discoveries**:
  - **A dialog's accessible name includes its Close button** ("New widget Close"), so `exact: true`
    on a dialog name never matches, and *New widget* substring-matches *New widgeting*: the specs use
    `/^New widget(?!ing)/`.
  - **A screenshot of a nested MUI dialog mid-fade** looks like the two overlapping; wait out the
    transition before judging.
  - **Thread 5's double-click finding stays unreachable**: the `td`'s re-ask handler fires only for
    `clueing_full`, `hint_full` and `butnot_full`, which come to numbers. Nothing here changes that;
    left unguarded.
  - **A widget's title cannot be edited in the UI** (only by library import). In the PR's questions.
* **For the Coach**: the two open questions above (library import's door; a Title field). No lint
  or type suppressions added.

*Review:* fixed. Kept `9d55a14` (a widget made through *New widget…* then removed through *Edit the
widget…* stayed in the picker, and Apply sent `add_widgeting` for it; `WidgetEditor` now takes
`onRemoved`, and the pick clears only for a new widgeting) and `87f2a0f` (the nested widget editor
checked labels against `library`, not `known`, so a just-written label could be taken twice).
`widgets.usage` authorization checked: counts only, smiths of some hunt, null otherwise, capped at
999. Nothing left.

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

*Orchestrator:* condensed after thread 6; PR #69, `losses.md` and `notes/deploy.md` hold the rest.

Branch `20261001-widget_tables`, PR #69, stacked on #68. Suites: `pnpm test` 2556 (unit and convex),
e2e 189. The worker was cut short once by the harness and resumed.

* **Built**: tables `widgets` (the global library, a union on `formulary`; `by_scope_and_position`,
  `by_scope_and_label`), `widgetings` (`by_quiz_id_and_position`, `by_widget_label`), `widgeteds`
  (`by_question_id_and_widgeting_id`, ready for thread 8's upsert, and `by_widgeting_id`);
  `expressions`, `bottings`, `quizzes.bulk_ishes_last` gone. Models `widget.ts` (redefined),
  `widgeting.ts` (`ReservedWidgetingLabels`, `Widgeting.forWidget` with `_2`, `_3`), `widgeted.ts`,
  `seeds.ts` (`SeedWidgets` 17, `DefaultWidgetings` 12), `service-status.ts`; `QuestionT.stored`;
  `QuestionViewVals` is `['butnot']`; the bot, botting, expression and guess models gone. Convex:
  `reading.ts` helpers (`libraryOf`, `widgetForLabel`, `isWorked`, `widgetingsOf`, `storedOf`,
  `allStoredOf`), `widgets.library` (any ident), `seeding:seedWidgets`,
  `writing/library_actions.ts`, widgeting actions in `layout_actions.ts`, `record_widgeted`.
  Browser: `Runner.sourceOf` from the new rows; one asked and one read-only cell; a *Library* tab in
  Export / Import. Serialization by `exposed` (`<label>.status`, `<label>.value`); mirror at
  `tq/widget/pub/<label>.tqwidget.json`. Bulk removed. `notes/deploy.md`, *Clearing the widget
  tables*, and its ledger row.
* **Decisions taken**: `insertQuiz` tops up the library with whatever its default widgetings work
  and it lacks (thread 7 drops this with the defaults); `scripts/convex_dev --seed` seeds every local
  role, and the e2e server and dev scripts pass it; library actions ignore quiz locks; an import
  naming a label twice merges it once, first wins; the asked cell's metaline reads
  `stored[label].ok.result_meta`.
* **Deviations**: pasted widgeted values are not imported until #66 lands; a paste holding
  widgetings but no questions changes nothing (open question).
* **Discoveries**: the library is global and e2e specs share a database, so a spec edits only
  widgets of its own (`freshWidgetLabel` in `e2e/support.ts`); without `--seed` a fresh backend lacks
  the five text seeds (previews are in that state); `Quiz.blank()` carries no widgetings while
  `Hunt.blank()` adds `defaultLayout()`; seeded rows never follow later fixture edits.
* **For the Coach**: the deploy is a hand procedure; the `dev` backend needs `--reset --seed`; one
  suppression on `Widget`; previews' seeding.

*Review:* fixed. Kept `6a84563` (the stored read only for formularies that `store`, keeping under
Convex's index-range bound), `7a408ce` (`forced_label` reserved), `7bf94ea` (the jsonata preview runs
over the widget's own input formula). Left, minor: the read bound near 999 questions by 5 `aibot`
widgetings.

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
