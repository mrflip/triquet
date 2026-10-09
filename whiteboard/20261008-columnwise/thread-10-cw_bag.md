# Thread 10: One bag shape (2026-10-09)

Branch `20261009-cw_bag`, PR filed at landing; see the report. The PR title ends
`(Serial Deploy: bagshape)`. Suites: `pnpm justify` green (5,700 unit tests); a full `pnpm e2e` at
landing (its result is in the report and the PR's Tests: line).

* **Built**:
  - **One shape, made in one place.** `Bagged` (`src/models/quiz-bag.ts`) makes each piece the bag
    and the jsonball share: a question (`position`, `label`, own fields, `viz`, `chains_to` by
    label, ISO stamps), the quiz's own fields, the hunt's, the realm's, the categories keyed by
    label (`{ label, title, position }`), a widgeted as `{ status, value }`, and `keyed` (questions
    by label, once per list, a WeakMap as the parked `qnbag` had it). `Runner.baseBagOf` is the one
    place a bag is made; the formula bags add `params` and `widgeting_label`, the template bag
    (`Templating.bagOf`, now `Runner.BaseBag`) reads it as it is. `Exporting.quizBodyOf`,
    `huntBall` and `categoriesBall` build from `Bagged` too.
  - **The bag's top level**: `hunt`, `realm`, `categories`, `quiz`, `questions`, `question`,
    `hunt_label`, `realm_label`, `quiz_label`, `question_label`, `params`, `widgeting_label`
    (`QuizBagKeys`, `QuizBagValidators.quizBag`, the advice's JSON Schema). `QuizPlace` carries the
    hunt's branch and stamps and the keyed categories. `run.qnsAt`/`qnsAfter`/`frame.qn_labels`
    are `questionsAt`/`questionsAfter`/`question_labels` (still lists, in the quiz's order).
  - **The ball**: `Jsonball.keyedOf` puts `label` beside `position` (questions, widgetings,
    columns), as do the categories and the library's widgets; each quiz carries its `label`; a
    quiz-tier widgeted sits beside the quiz's own fields, as in the bag (`widgeteds` gone).
    `Quiz.bagKeys` names every quiz field, so no quiz-tier widgeting takes one.
  - **Liquid**: a `values` filter (`Templating.valuesOf`); `in_order` takes keyed questions. Both
    LiquidJS behaviours the plan asked for are pinned (`tests/lib/templating.test.ts`): a bare
    `for` over a keyed collection hands `[label, value]` pairs, and `for x in coll | values` loops
    over nothing.
  - **Columns**: the bag word `qns` is `questions` (`BagWordVals`), its field presets `$.*.<field>`
    (and the categories'); `butnot` looks its target up by label (`Columns.thingOf`,
    `LiquidizeFormulary`'s `pickedOf`); a formula'd column passes a failed widgeting through as the
    run has it, failure and all, since the bag holds none.
  - **The seeds** speak the new words; the chained sums read
    `(question.chains_to ? $lookup(questions, question.chains_to))`, O(1) a cell where the search
    was O(n). The default recap template loops `questions | in_order`.
  - **The rewrite** (`src/models/before-october.ts`): `beforeOctoberFormula`,
    `beforeOctoberTemplate`, `beforeOctoberRef`, and a helper per stored row
    (`beforeOctoberWidgetTexts`, `beforeOctoberParams`, `beforeOctoberColumn`,
    `beforeOctoberQuizTexts`, `beforeOctoberTemplated`). Idempotent; pinned by cases, by
    idempotence over them, and by `fixtures/seeds-2026-10-09.json` (the seeds before this thread,
    which rewrite to exactly the seeds now, and the default recap template likewise).
  - **The importer** reads every paste through it (`beforeOctoberBagRead` after
    `beforeOctoberRead`; `beforeOctoberWidget` for the library).
  - **The backfills** (`convex/migrations.ts`, the `bagshape` chain): `backfillBagshapeWidgets`,
    `...Widgetings`, `...Columns`, `...Quizzes`, `...Questions`, `...Widgeteds`, at the end of
    `Backfills`; raw, so no stamp moves. **Rehearsed** on lane 1's agent backend: the base
    (`2d4f775b`) pushed, reset and seeded (the old seed texts), then this branch pushed and
    `migrations:runAll`: every seeded widget came out as `seeds.ts` reads, `outstanding` `[]`.
    `convex/_generated/` did not change.
  - Docs: the record's §12 (and §4, §9 in the new words), `notes/vocabulary.md`, `STYLE.md`'s
    `qn` tag, `notes/security.md`, the ledger row in `notes/deploy.md`,
    `human/20261009-cw_bag.md`.
  - The parked `20261009-cw_budgets-qnbag-parked` was read and retired:
    `attic/20261009-cw_budgets-qnbag-parked` (local tag).

* **Decisions taken** (YOLO; each a two-way door):
  1. **The shape is the export's piece by piece**, not its root: the bag's `quiz` is the ball's
     quiz less its questions and layout, its `questions` sit at the top. The departures and their
     reasons are the record's §12 table.
  2. **What is worked out stays out of the ball**: `rank`, `archived`, `secondary`, an estimate's
     parts. A rank renumbers every question when one moves, which would rewrite every git file.
  3. **Quiz-tier widgeteds sit flat in the ball**, as in the bag and as a question's do, rather
     than the bag moving to `quiz.widgeteds.<label>`: the column ref `quiz.<label>` keeps naming
     what the bag holds. Cost: seven more names reserved from quiz-tier widgeting labels (the
     human/ note's grep).
  4. **The template bag's `questions` holds the archived**, as the formula bag's does; `qns`
     (shown) and `quiz.questions` (all) are gone. The rewrite turns an old `qns` loop into
     `questions | values | reject: "archived"`, so a stored template reads as it did.
  5. **`hunt_label` and `realm_label` join the top**, beside `quiz_label` and `question_label`, for
     regularity; reserved from widgeting labels.
  6. **The categories** are keyed by label in the wheel's total order, each with its `title` and
     wheel `position`, in both the bag and the ball (the ball gained `label` and `title`).
  7. **Every member of an ordered collection carries its `label`** in the ball (the widgets too);
     members, reviews and verdicts, unordered, are as they were.
  8. **`Hunt.exposed`, `Realm.exposed` and `Quiz.exposed` are gone**: the bag no longer draws on
     them. `Question.exposed` stays (the reserved words, `sentTo`).
  9. **The rewrite runs on every import**, idempotent, as `plainOf` does: `qn` and `qns` stay
     reserved from every label, so text naming them can mean only the old words. A Liquid loop
     variable named `qn` is renamed with its uses.
  10. **What reads an input of its own is left**: a widget's formula or template is rewritten only
     where its input formula is `$` (or absent); prompts never; JSONata strings never (so
     `{ 'qn': qn }` keeps its key).
  11. **A column's formula, and `template_from`'s, read what the ref picks, never the bag**, so
     they are rewritten only where that ref picked a list now keyed (`qns`, `categories`): their
     bare `$` becomes `$.*` (`beforeOctoberPicked`), in the importer and the backfill alike, so
     `$count($)` and the menu's old presets (`$.title`, `$.label`) read as before. A category read
     by its label (`$.tv`), or `$` handed to `$lookup`/`$keys`/`$each`/`$sift`, is left, as a
     formula of today reads it. (The orchestrator's call, after review.)
  12. **`notes/examples/20261008-but_not_recap.json` is not rewritten**: it is gitignored in the
     main checkout, which agents do not write, and the importer reads it as it is.
  13. **The backfills stay in `Backfills`** with no tightening to retire them; any later PR may.

* **Deviations**:
  - The plan asked for questions keyed "in quiz order" with `position`: done; the bag's questions
    are keyed by label in that order, so `questions.*` and `| values` list them in it.
  - A failed widgeting read by a `liquidize` `template_from` now says
    "failed: its own cell says why." rather than repeating the failure, which the bag no longer
    holds.

* **Discoveries**:
  - JSONata `$count($)` over a keyed object is 1: a formula over the `questions` word wants
    `$.*`, which `beforeOctoberPicked` now writes for a formula stored over `qns` or `categories`.
  - LiquidJS's `.size` counts an object's keys; `.first` reads nothing on one.
  - The git-attic report shows `20261009-cw_tighten` and `20261009-cw_optimistic` holding commits
    this branch's base lacks (the spine moved under it: `spine_test_split`, thread 11): expect a
    catch-up at landing. Thread 11 touches `src/state/` and views; this thread touched a few views'
    help copy (`QuizManageModal`, `RecapPanel`, `JsonataFields`, `LiquidizeFields`) and
    `src/state/widget-edit.ts`'s doc examples.

* **Review** (`fixed`): `c42a5c5f` (the rewrite leaves today's `categories.<label>`, `categories.*`
  and `$lookup(categories, ...)` alone; a library paste of today's formulas read nothing before)
  and `4cbe5209` (`backfillBagshapeQuestions` leaves only a refused field, not the whole
  question). Then, at the orchestrator's call, `beforeOctoberPicked` (decision 11) and the
  rename of a bare `value` in `beforeOctoberTemplated`. The reviewer's other minor findings are
  left as notes: they are in its report and the PR's review comment.

* **For the Coach** (also in `human/20261009-cw_bag.md`):
  - Merge as a Serial Deploy (`bagshape`); before it, one grep for newly reserved quiz-tier
    labels. The seeded butnot and ish widgets are rewritten by the backfill; nothing to paste.
  - Every hunt's git files change once.
  - `whiteboard/20261008-columnwise/prd_checks.mts` (the orchestrator's) could gain a section for
    the grep above, and for stored texts reading `.err`, or a column whose source is `qns` with a
    formula.
