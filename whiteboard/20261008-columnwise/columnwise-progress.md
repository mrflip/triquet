# Columnwise: progress

The orchestrator's document: status, and what the threads have taught, newer than
`columnwise-plan.md` wherever the two disagree. Each worker's own account is its
`thread-<N>-<label>.md`, beside this file.

## Status

| Thread | Label | Status |
|---|---|---|
| 1 | design note and vocabulary | landed #191 (docs only, no review) |
| 2 | entry families | landed #196 (the spine restarted: #191-#193 merged) |
| 3a | columns widen (Serial Deploy) | landed #193 |
| 4 | removal and commit model | landed #192 |
| 3b | column expression authoring | landed #197 |
| 7 | `liquidize` formulary | landed #201 |
| 6 | free regex (optional) | landed #198 |
| 5a | folding editors | landed #199 |
| 5b | run order in both places, row preview | landed #202 |
| 8 | seeds pass (optional) | landed #200 |
| 9 | compute budgets (added) | landed #206 |
| 3c | columns tighten (last of the chain) | landed #209 |
| 10 | one bag shape (added) | building (lane 1) |
| 11 | optimistic updates (added) | landing (review fixed); full e2e |

Full e2e runs carried by: thread 4 (#192; its `--touched` reached the whole suite: 253 passed, 6 flakes cleared alone); thread 3a (#193: 256 passed, 5 flakes cleared alone, load 9 to 26); thread 2 (#196: full run, four flakes cleared alone; after a final rebase, `--touched` with five more); thread 3b (#197: `--touched` reached the whole suite, 272 passed, 3 flakes cleared alone). thread 6 (#198: full run, six flakes cleared alone). thread 5a (#199: `--touched` reached the whole suite, 3 flakes cleared alone); thread 8 (#200: full run on 802bf283, 272 passed, 10 flakes cleared alone). thread 7 (#201: `--touched` reached the whole suite, 276 passed, 7 flakes). thread 5b (#202: `--touched` reached the whole suite, 278 passed, 8 failed and each passed alone; one of them real, repaired in the spec, `0964306`). thread 9 (#206: full run, 279 passed, 7 flakes cleared alone). thread 3c (#209: full run on e15f0db2, 281 passed, 7 flakes cleared alone; the run the Coach asked for before 10 and 11). Next full runs: 10's and 11's landings, and the sprint's end.

## What the threads have taught

*Orchestrator:* the Coach answered at the start (2026-10-08): code threads start once thread 1
lands, without waiting for the Coach's read; optional threads 6 and 8 both run.

### From thread 1 (the decision record)

`notes/decisions/20261008-columnwise.md` is now the normative design: read it before the
preplan, and take its numbered decisions as settled. Those that most shape later threads
(`thread-1-cw_design.md` has all thirteen):

* **Identity is the formula's absence** (2, 3a, 3b): `$` is not identity; an emptied formula box
  removes the field. A field or top-level word has no status, so a formula always runs on it.
* **Default readout** is as the cells choose today; `markdown` for a column with a template or
  showing a `liquidize`. **Computed values reach markdown with images linked** (3b, 7).
* **A sort reads the formula's value**, never the template's text; the sheet carries the
  template's text (3b).
* **`qn` is not a ref**; **`butnot` is** (the backfill makes `question.butnot` into it), and it
  stays a view, out of the bag (3a).
* **Default params** are the family's params, each optional, flat in `config` beside
  `entry_kind`; the widgeting's params overlay them key by key (2).
* **Removal** (4): formulas, templates and `template_from.ref` naming a widgeting do not hold it
  back; only a column showing it does. Its templateable nomination goes with it.
* **Labels in general** (quiz, column, widgeting) keep an explicit button (4, 5a).
* **Reserved words** (2): the bag's top-level keys as one list *beneath* `widgeting.ts` (an import
  cycle, `quiz-bag.ts` -> `quiz.ts` -> `widgeting.ts`, forbids deriving it), held to
  `QuizBagValidators.quizBag` by a test. Global words reach **every** label (hunts, realms, quizzes,
  questions, columns, widgets, widgetings, usernames): a seeded entry widget cannot be labelled
  `number`, `text`, `boolean` or `enum`. The integrity check needs nothing new: a quiz's
  widgetings already carry the pattern. `forced_label` goes back on the list.
* *Orchestrator, ruling for thread 2:* **the importer refuses** a label a new reserved word catches,
  with a sentence naming the word (thread 1's option (a), in line with the preplan's "the integrity
  check must refuse a quiz already holding one"). The Coach greps production's raw export before
  thread 2 deploys.
* *For 3c, the Coach's call:* thread 1 suggests reserving `category` (singular) beside
  `categories`.
* A nominated `aibot` widgeting is not filled today (`filledQnOf` fills only a string value); model
  output reaches a template through a `jsonata` string over a reply, or thread 7's `template_from`.

### From thread 4 (removal and commit model, #192)

* **`columnsShowing(quiz, label)`** (`src/lib/columns.ts`) finds the columns showing a widgeting
  through `resolve`, counting `kind: 'widgeting'`. 3a: if a plain-key ref to a widgeting (or
  `quiz.<label>`) gets another kind, carry `columnsShowing` along. 5a: reuse it for the widgeting
  panel's list of columns. `widgetingRemovalRefusal` is the one sentence, server and editor.
* `delete_widgeting` refuses (kind `widgetingShown`) rather than cascading; `deleteColumns` was
  folded into `deleteColumn`. The manage dialog: *Relabel quiz* beside the label, *Done* alone at
  the foot; the hunt's button is *Relabel hunt* (an `aria-label`). `closeManage` in
  `e2e/support.ts` clicks Done.
* *Review:* `clean`, no fixes. Left for 5a, both minor: *Done* drops a label typed but not
  relabelled (the Coach may want an unsaved mark); the quiz label draft is set once from
  `quiz.label`, so a relabel elsewhere while the dialog is open would be undone by a click on
  *Relabel*. 5a rebuilds these editors and takes both.

### From thread 3a (columns widen, #193, Serial Deploy: columnwise)

* **The ref** (`src/models/column.ts`): `refOf` parses a plain key (a question field, `butnot`, a
  key `label`/`rank`/`archived`/`secondary`, a widgeting label, a word `quiz`/`hunt`/`realm`/
  `categories`/`qns`) or `quiz.<label>`; `plainOf`/`beforeOctoberOf` read the old grammar until 3c.
  `resolve` finds on `qn` first, then the top level. `columnPatch` takes `null` to take
  `formula`/`template`/`readout` off.
* **What a column shows** is `Columns.shownOf(spec, run, templateable, question_id)`, worked by
  its formula through `JsonataFormulary.worked` once per run; the sheet (`cellTextOf`) and the
  sorts (`sortValueFor`) go through it. A formula's input comes from the formula bag
  (`run.qnsAfter`, archived included), templateable sources filled. 3b adds template and readout
  as later stages of the same path.
* **Already drawn** (pulled forward from 3b): a formula'd column read-only
  (`QuestionRow.workedBody`; `$.masie` as `EstimatePartReadout`), keys, words and `quiz.<label>`
  as readouts. 3b builds the menu, `template`, `readout`, `collapsed` and the double-click.
* **templateable**: `quizzes.templateable`, `set_templateable`, `TemplateableEditor.tsx`; the one
  fill is `Templating.finishedQnsOf(run, templateable)` (thread 7 shares it).
* **Decision (the Coach may overrule):** a `missing` widgeted with parts beside it (an empty
  estimates cell) is worked on by the formula, so a backfilled `$.masie` keeps its value
  (`27bf8b3`, reverts cleanly; the record's §4 amended). A new estimates column is headed
  *Category Data*.
* `run.parts` and `Runner.widgetedOf`'s part argument are gone: parts live only in the bag.
* **3c's checklist is in `thread-3a-cw_widen.md`**, ten items, with the ledger row drafted.
* *Review:* `fixed`: `8562e8b` (`updateColumn` reads the stored column plain before merging) and
  `ab77f54` (the importer's `categories` relabel follows the backfill's first-free rule,
  `categoryDataLabelsFor`). Left: the reviewer's `shadowedBy` (a renamed or deleted `categories`
  widgeting misses a column whose plain source is `categories`; only before the backfill or 3c),
  **refused to the reviewer by the permission check, so waiting on the Coach, not routed**; the
  relabel rule held twice (3c drops the migration's copy); no unit test of its own for `8562e8b`.

### From thread 2 (entry families, #196)

*Orchestrator:* the Coach merged #191-#193 while thread 2 landed, so #196 starts the spine afresh.

* **Families** (`src/models/widget.ts`): `EntryFamilyVals`, `EntryFamilyOf`, `OfferedEntryKindVals`;
  params validators per family (`numberParams`, `textParams`, `enumParams`, `noParams`;
  `EntryParamsOf` by kind); `entryConfig` a union by `entry_kind`, each arm the family's params as
  the widget's defaults; `labelish`/`titleish` are `EntryPresets` of `text`.
* **The formulary** (`src/lib/formulary/entry.ts`): `paramsOf(widget)`, `inForce(widget,
  widgeting)`, `valueOf(widget, widgeting)`, `kindValueOf(widget)`; `Formularies.paramsOf(widget)`
  dispatches, `jsonata`/`aibot` the open record. **7 and 6 build on these.**
* **Reserved words**: the record's groups are in; a widgeting's params keys are held to them but
  for `EntryParamnames` (derived from `EntryParamsOf`), through `PA.isUnreserved(val, allowed)`,
  which sits on the spine's Set-based `PA.Unreserved.rule` (`c6e6943`, landed beside this thread):
  `ValidatorKit.labelAllowing(allowed)` and `Labelmaker.isReserved(label, { allowed })`. A new
  family's param names join the allowlist by being in its validator. `categories` is not yet
  reserved (3c).
* **Views**: `cells/fields.tsx` `TruthField` (a tri-state checkbox) and `ChoiceField` (a native
  select); `cells/entry.tsx` draws every family from the params in force through
  `cells/use-entering.ts`; **`EntryParamsFields.tsx`**, the params editor (one field per key of the
  family's validator, each committing as left), in the widgeting dialog and the widget editor:
  5a lifts it, 6 adds its regex field there. The run-order list: *Entries* above the sortable rest;
  `runOrderIdxOf` maps a drop onto the whole order. The Widgets panel says params (`paramsGist`).
* **Imports** hold an entry's value to its kind, not its params; params are checked where
  written. A cell refuses what its params refuse before sending, through the page's alarm.
* Seeds `memo`, `figure`, `yes_no`, `choice`. `PA.Weburl` uses `\p{White_Space}` (an RE2 test
  on the spine).
* *Review:* `flagged` → ruled. Fixed: `c420fbf` (`EntryFormulary.numberBoxOf`: a number box shows a
  held value as it is). Left, minor: a refused value stays in its box (`useDraft`); git history
  lists a hunt under a new word by id; a widget's defaults can clash with a widgeting's params.
* **For the deploy (the Coach):** before, the hard grep gate (`human/20261008-cw_families.md`);
  after, `seeding:seedWidgets`.

### From thread 3b (column expression authoring, #197)

* **Stages** (`src/lib/columns.ts`): `ColumnSpec` carries `template`, `readout`, `collapsed`;
  `drawnOf` is the formula's value (`shownOf`) then the template through `Templating.fill` with
  `value`; `templatedTextOf` the sheet's text; `readoutOf` the readout in effect (own, else
  `markdown` with a template, else null); **`isTypedInto` / `isDrawnByEditor` hold the
  editability rule** (thread 2's checkbox and select go through `EntryCell`, so it covers them).
  Sorts read the formula's value; the sheet carries the template's text.
* **The menu** (`src/lib/column-menu.ts`): `refChoicesOf` (grouped refs); `presetsFor` over
  **`PresetSources`, the list thread 8 extends**.
* **Generic fields**: `FormulaField.tsx` (MUI Autocomplete over presets), `TemplateField.tsx`;
  each commits on blur, emptying removes the field, each says its sentence. **Column fields**
  (`ColumnFields.tsx`): `ColumnRefField`, the four stage fields and `ColumnStagesFields`, each
  `{ column, locked, onCommit(patch) }`, no dialog state: **5a lifts them**, and moves the row's
  local fold into `use-folds`.
* Libraries weighed for the fields: CodeMirror and Monaco (heavy, *Discuss*),
  `react-simple-code-editor` (a highlighter by hand); MUI only.
* Grid: a double-click on a head collapses (20px, turned header, empty cells, width kept);
  `DrawnReadout` (plain, markdown, code, label) for read-only cells. Importer carries a pasted
  column's stages onto a held one, and takes them off when absent (recorded).
* Decisions: a template runs only on `ok`; a readout applies only to read-only cells; images in
  values a person did not type are linked under markdown; a ref change keeps formula and template.
* *Review:* `clean`, no fixes. Left, minor: **a double-click on a sortable head sorts (and saves
  that sort) before it collapses** (the Coach's call; a timer is a tripwire); `bagOver` links
  images in `{{ qn.<computed> }}` even in the sheet; `textedOf`'s key joins with `\n`; a collapsed
  column in the card layout cannot be restored from its hidden head (columns editor only).

### From thread 6 (free regex, #198)

* **The `regex` param** of a `text` entry: `{ source, flags }` beside the named `pattern` (a cell
  must match both); one line, at most 200 characters, compiling, flags from `imsu` in order.
* **recheck** runs in Convex's default runtime through its pure build's `checkSync`
  (`recheck/lib/browser.js`); `performance.now()` moves inside a mutation, `Date.now()` does not.
  `src/lib/redos.ts` is its only importer (200 ms a pattern, 500 ms a change; `vulnerable`, every
  `unknown`, out-of-budget all refused). `convex/writing/regex_vetting.ts` (`refuseRiskyRegexes`)
  runs in `addWidgeting`, `editWidgeting`, `addWidget`, `editWidget`, `importWidgets`; a pattern
  the row already holds is not re-checked. A stored pattern is compiled once
  (`src/lib/regexes.ts`) and handed to Zod in `EntryFormulary.valueOf`.
* **`RegexField.tsx`**, a field any form can use; recheck reaches the browser only by `import()`
  (its own 2.8 MB chunk), checked on recheck's worker. The planner does not ask recheck (it is
  synchronous); the server makes the final call. `pnpm-workspace.yaml` ignores recheck's JVM jar
  and native binaries.
* *Review:* `clean`. Left, minor: a `regex` written by a direct call before the deploy is never
  checked (**the PR's "Before deploying:" query**); an unexpected status refuses with a garbled
  sentence; the lazy-load guard misses multi-line imports; the compiled memo never shrinks;
  **5b: a preview testing cells against draft params would run an unchecked pattern: preview from
  stored params only.**

### From thread 5a (folding editors, #199)

* **The folded fact**: each formulary says what its widgeting folds to, beside `refresh` and
  `store`: `folded` is `'params'` (entry), `'formula'` (jsonata, the widget's, read-only), `null`
  (aibot); thread 7 adds `'template'`.
* **`WidgetingPanel.tsx`**: folded, one row (label, what it works, tier mark, folded line); open,
  the same row with more beneath (label with *Relabel*, description, the widget with the admin's
  *Edit the widget…*, the columns showing it via `columnsShowing`, removal with thread 4's refusal).
  **5b uses it as the Widgets panel's open state.**
* **`ColumnsEditor.tsx`**: each column a panel, its row unfolding into `ColumnMoreFields`; a
  column showing a widgeting has that widgeting's panel beneath it. *+ New column…* is a menu
  ("Showing something the quiz has…", "A new entry…", and for a library-changer "A new widget…"),
  each making its column at once. `ColumnDialog` and `WidgetingDialog` are gone.
* **`ExplicitField.tsx`**: "Not kept yet: Relabel keeps it." while a label is typed and not kept;
  its draft follows the stored label otherwise. Every label field uses it.
* **Folds** survive a reopen: `useFoldSet(scope)` in `Workbench`, scoped by quiz id, keys per place
  (`layout-folds.ts`); anything just made arrives open.
* **Decision (the Coach may confirm):** a header still automatic follows what its column shows, its
  formula and its widgeting's relabel (`retitledPatch`); a typed header stays.
* **For 5b:** *+ New widgeting…* and *+ New quiz widgeting…* (an inline catalogue) need a home when
  the section becomes *Run order*. e2e helpers in `e2e/support.ts`: `pickWidget`, `widgetingPanel`,
  `columnPanel`, `unfoldBy`, `foldBy`, `relabelWidgeting`, `columnAdded`.
* *Review:* `fixed`: folded params stop showing what was sent once the stored params move
  (`pendingShown`); `ExplicitField` forgets typed text once the stored text changes. Left, minor,
  in TODO: `retitledPatch` reads a column as last loaded (a race with a title blur; the real fix is
  optimistic updates on the quiz's dispatch); a refused relabel still retitles its column;
  `ExplicitField` gives way to a relabel made elsewhere while typing (documented).

### From thread 8 (seeds pass, #200)

* **Presets for the seeded sums**: `SeedPresets` in `src/models/seeds.ts` (by widget label:
  `numnum_clueing`, `numnum_hint`, `butnot_ishes`), built from the same `SumOf` as the seeded
  widgets; offered by a `seedPresets` source in `ColumnMenu.PresetSources`. The four reshaping
  sums **stay in the seed list** (a seeded sum's cell re-asks on a double-click; a formula'd
  column is read-only).
* **Naming through presets**: `FormulaPreset.names`; `ColumnMenu.namesOf` and `namerOf(quiz,
  library)`; `retitledPatch` takes an optional namer and `useColumnCommit` requires one, so a
  column still headed after what it shows takes a preset's header when its formula is picked.
* A preset on a failed ask (no earlier ok) shows the errored badge where the seeded sum shows the
  dash: by design, now in the record. *Review:* `clean`.
* **`pnpm lane` is shadowed** by pnpm 12's own `lane` command (it says "All packages are on the
  main lane"): `pnpm run lane` or `node scripts/lanes.ts lane` give the project's lane. CLAUDE.md
  still says `pnpm lane` (the Coach's).

### From thread 7 (`liquidize`, #201)

* **`LiquidizeFormulary`** (`src/lib/formulary/liquidize.ts`): either tier, `live`, stores nothing,
  input `$`; the template from the widget's `formula`, the widgeting's `template`, or
  `template_from: { ref, formula }` (a ref in the plain grammar, `ColumnValidators.ref`; no formula
  reads as a column with none does, the field or a widgeting's `value`: the Coach may overrule).
  Text out; blank is `missing`, unreadable is `errored`. Seed `blurb` (*Template*).
* **Limits** (`src/lib/liquidry.ts`): `failkind` `syntax` | `runtime` | `limit`; a `limit` stops
  the column (`stops: true`). **Column budget 250 ms** (`columnMs` on the formulary; the runner's
  `deadlineOf` per column per run), on **`clockNow()` (`performance.now()`)**: `Date.now()` stands
  still inside a Convex mutation, so LiquidJS's own `renderLimit` never fired on the server;
  `clocked` replaces its check (in 10.30.0, `Render.renderTemplates` only; pinned by the exact
  version and a test). A render past its deadline stops before parsing (`d01e061`).
  **The budget holds between pieces and loop turns, not inside one filter call: thread 9.**
  `thread-7-budgets.md` has the probe table.
* **Allowlists per formulary**: `jsonata` and `aibot` params through `WidgetingValidators.openParams`
  (no reserved word); entry and liquidize their strict validators' keys; the row validator allows
  `FormularyParamnames` (every formulary's param names).
* `readoutOf(spec, widget)`: a liquidize column defaults to markdown, images linked.
* **In 5a's panel** (catch-up `2f9535e`, unreviewed, small): `folded: 'template'`;
  `LiquidizeTemplateLine` in `FoldedLine`; `LiquidizeParamsFields` in the open panel.
* *Reviews:* first `flagged` (ruled: stop on a limit plus a column budget; one allowlist per
  formulary); second `flagged` (ruled: land; the rest to thread 9). Thread 6's recheck timing
  tests (`redos.test.ts` "a word said twice, by a backreference"; `layout_actions.test.ts` "refuse
  a regular expression with a sentence naming it") flake under load 25+: thread 9 steadies them.

### From thread 5b (run order and row preview, #202)

* **Run order in both places**: the Widgets panel lists widgetings in run order, with the
  new-widgeting menus (*+ New widgeting…*, *+ New quiz widgeting…*) at its head; the gear's dialog
  says the run order as plain lines. A row preview above the columns shows one question's row.
* **Catch-up with 7**: #201's `TemplateInForce` became a `liquidize` arm of `WidgetShown` in the
  open panel; thread 7's template spec moved from the manage dialog to the Widgets panel
  (`973868d`).
* **A real e2e failure, repaired**: near the foot of the page the Autocomplete's list opens above
  its box and covers *+ New widgeting…*; the spec presses Escape first (`0964306`).
* *Review:* fixed (`705db76`: the new-widgeting picker renders only while the layout is revisable);
  seven minor findings in the thread file; `ColumnsEditor`'s pickers staying mounted after the quiz
  locks in TODO.
* **For the Coach**: decisions 1-3 in `thread-5b-cw_runorder.md` (the menus at the panel's head;
  the run order as plain lines; the folded row's description snippet gone).

### From thread 3c (columns tighten, #209)

* Every item on 3a's checklist is done. The importer's old-grammar reading lives in
  `src/models/before-october.ts`. The estimate parts live in `src/lib/estimates.ts`.
  `categories` and `category` are reserved for widgeting labels.
* **The schema push is not the gate:** a column's `source` is a plain string to Convex, so section 5
  of `prd_checks.mts` (and `migrations:outstanding`) gates the merge. The ledger row says so.
* *Review:* `fixed` (`2e7f12ae`, the ledger row); minor findings in `whiteboard/TODO.md`.

### From thread 9 (compute budgets, #206)

* **One clock** (`src/lib/clock.ts`, `clockNow()` on `performance.now()`) for every budget.
  Liquid reads its deadline on each value read, the `*_exp` filters are refused, there are caps of
  100k per step and 1M per render, and `{% capture %}` is capped too. A column's templates get
  250 ms (`fillWithin`). `Runner.RunMs` is 5 s and binds only the browser, and `Columns.workedOf`
  holds a column's formula to it.
* **Sorts are worked out in the browser.** `sort_questions` carries `question_ids`, and the server
  checks them (`sortStale`) and writes the order. **No mutation runs an author's formula or
  template any more.**
* **The sort-after-edit race was accepted (option 1)**, with three marked e2e waits (widgets,
  ordering, client-first) that thread 11 removes. Typing in a cell and then clicking a header
  always hits it.
* *Reviews:* first `flagged` (ruled: sort on the client, loose limits, the keyed bag moved to
  thread 10); second `fixed` (`9a6eed2`).
* **Before deploying:** grep for `*_exp` (the runbook, section 4). Tabs opened before the deploy
  can't sort until reloaded.

### From thread 9's review (flagged, ruled)

* *Reviewer:* `RunMs` (1 s) stops the classic layout's butnot columns from about 200 questions,
  and leaves the server sort no headroom under Convex's 1 s mutation limit; column formulas
  (`workedOf`) sit outside every budget. Root causes: `sort_questions` runs the whole quiz on the
  server, and `ButnotHint` (`qns[label = $$.qn.chains_to]`) is O(n²).
* **The Coach ruled:**
  - Every bag also carries the questions keyed by label, generic, so the butnot lookup is O(1).
    `qns` stays the ordered list. No code defending butnot or the ishes, which are to become
    expressions later.
  - Sort on the client: the browser sends the order, the server checks it and writes it.
  - Loose time limits.
  - Be judicious: the Coach is opening a separate thread on sending the whole quiz on every
    update.
  - Done in thread 9.

### From thread 2's review (flagged, ruled)

* *Orchestrator:* the reviewer found that a label under a newly reserved word fails on **read**
  too: `src/lib/addresses.ts` and `openHunt` check slots with `label`/`userlabel`, so such a
  hunt, realm or quiz cannot be opened, and such a username cannot be asserted again or join a
  hunt. **The Coach ruled: gate on a production grep**, no change to the read paths. Thread 2's
  `human/` note, thread file and PR (`Before merging:`) carry the gate.
