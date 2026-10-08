# Columnwise: progress

The orchestrator's document: status, and what the threads have taught, newer than
`columnwise-plan.md` wherever the two disagree. Each worker's own account is its
`thread-<N>-<label>.md`, beside this file.

## Status

| Thread | Label | Status |
|---|---|---|
| 1 | design note and vocabulary | landed #191 (docs only, no review) |
| 2 | entry families | landing (review flagged; Coach ruled: production grep gate; full e2e) |
| 3a | columns widen (Serial Deploy) | landed #193 |
| 4 | removal and commit model | landed #192 |
| 3b | column expression authoring | underway |
| 7 | `liquidize` formulary | pending |
| 6 | free regex (optional) | pending |
| 5a | folding editors | pending |
| 5b | run order in both places, row preview | pending |
| 8 | seeds pass (optional) | pending |
| 3c | columns tighten (last) | pending |

Full e2e runs carried by: thread 4 (#192; its `--touched` reached the whole suite: 253 passed, 6 flakes cleared alone); thread 3a (#193: 256 passed, 5 flakes cleared alone, load 9 to 26); thread 2 asked for one (the fourth landing).

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

### From thread 2's review (flagged, ruled)

* *Orchestrator:* the reviewer found that a label under a newly reserved word fails on **read**
  too: `src/lib/addresses.ts` and `openHunt` check slots with `label`/`userlabel`, so such a
  hunt, realm or quiz cannot be opened, and such a username cannot be asserted again or join a
  hunt. **The Coach ruled: gate on a production grep**, no change to the read paths. Thread 2's
  `human/` note, thread file and PR (`Before merging:`) carry the gate.
