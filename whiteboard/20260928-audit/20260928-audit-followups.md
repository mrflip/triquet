# Audit follow-ups

What the Coach set aside from the audit of 2026-09-28 (`20260928-audit.md`) to
look at in a session of its own, each with where it is described. Nothing here is planned;
each is a thread to open. The query-boundary items are in `20260928-query-boundaries-plan.md`
and the view habits in `20260928-views-after-convex.md`; neither is repeated here.

## To handle later

* **The unused utility library** under `src/lib/`: `strings.ts`, `collections.ts`, `props.ts`,
  `errors.ts`, `type-tools.ts`. Outside their own tests, only `Inconsistent` and the three
  functions `vv/reporting.ts` calls are used. Audit §4, first bullet.
* **The second validator kit**: `lib/vv/kit.ts` (`Kit`) beside `lib/validator.ts`
  (`ValidatorKit`), overlapping aliases under different names; only `vv/checks/*` import the
  first. Audit §4, *Two kits*.
* **`inspectify-browser.ts`**, a `util.inspect` for the browser, used by the error map to quote
  a refused value. Audit §4.

## Kept on purpose

* **The unused validator checks** (`vv/checks/contact.ts`, `vv/checks/numbers.ts`, most of
  `vv/checks/strings.ts` and `vv/patterns.ts`): the Coach means to incorporate them. Not a
  finding; don't re-flag.

## Two questions to settle

### Rows and trees

Every domain noun has two validated shapes. The **row** (`QuestionValidators.row`,
`QuizValidators.row`, ...) is what Convex stores and what `hunts.perform` writes: a question's
row carries `quiz_id` and its chain as the target's *label*; a quiz's row carries `realm_id`
and `row_ordering`; bot replies are rows of `bottings`. The **tree** (`question`, `quiz`,
`realm`, `hunt`) is what the browser holds and what Export emits: a quiz nests its questions,
a question's chain is the target's *id*, its cells (`guess`, `clueing_ishes`, `hint_ishes`)
are projected from the newest bottings, and every field has a default so a half-typed question
is legal. `lib/rows.ts` projects rows into trees on the way out.

Since 2026-09-28 nothing writes a tree: an import sends patches by label, a blank quiz is
inserted as rows, and `replace_open_quiz` is gone. So the tree validators, their defaults, and
the integrity checks on `quiz` and `hunt` (a chain that dangles, two questions with one id, a
widget naming an expression the hunt lacks) run only in tests and fixtures (`Hunt.fill`,
`Quiz.blank`, `tests/support/seed.ts`). In production the tree is a **type**.

The question is whether to keep the tree as a validated shape at all. The case for dropping
it: reads are never validated (the rule), the tree's defaults describe a birthplace the browser
no longer is, and two validators for one noun invite drift (a field added to the row and not
the tree, or the reverse). The tree types would then be derived from the row validators and
the projection (`QuizT` = the frame plus its questions, each a row plus its cells), and
`Question.blank`/`Quiz.blank`/`Hunt.blank` and `mintId`-as-id would move to test support. The
case for keeping it: the fixtures are trees and lean on `Hunt.fill`'s checks to catch a bad
fixture early, Export's shape wants a name, and the mirror serialises the tree. Either way,
`chains_to` meaning an id in one shape and a label in the other is the one translation worth
removing; the picker would then hold labels, as the rows do.

A deeper version of the same question is whether plain data plus namespaces of statics is the
shape the models should stay in, or whether the app wants instances. The audit's answer
(2026-09-28, in chat): stay plain; React, Convex, Zod and JSON all take plain data, and the
classes that appear in mature apps of this kind are services, not data. Reopen only with a
concrete pain the namespaces cannot answer.

### `hunts.open`

`hunts.open` (`convex/hunts.ts`) is the watch every quiz screen holds: the hunt's row, its
realms, every quiz row of every realm, its expressions, and, for each expression, how many
widgets across the hunt work it (`expressionUsageOf` in `convex/reading.ts`). That count reads
every widget of every quiz, so the watch reruns whenever any quiz's widgets change and its
read set grows with the hunt. The count is shown in one place, the Expressions modal, and
decides whether an expression may be removed.

The quiz rows it reads also carry `locked`, `last_sortkey`, `bulk_ishes_last` and
`row_ordering`, so a sort, a lock or a recalculation of any quiz reruns the listing's watch
for every browser with the hunt open (about 10 KiB read each time; nothing is sent when the
result is unchanged).

Two changes, each its own commit and each measured with the phase 4 harness, are planned in
`20260928-query-boundaries-plan.md`: item 1 moves the usage counts to an
`expressions.forHunt` query function watched only by the modal, so `hunts.open` stops reading
widgets; item 2 moves the reviews to the screen that shows them. A third, not planned, is a
`quiz_state` row of its own for the fields the listing does not need
(`20260928-views-after-convex.md`, item 7); it is a schema change and the progress document
records the Coach's choice to leave it. **Open:** whether items 1 and 2 go to an Opus session
as planned, or into the audit branch.

## Flagged, for the Coach to look into

* **JSONata's timebox** (`lib/formulas.ts`, around line 98) hooks `__evaluate_entry` and
  `__evaluate_exit`, which JSONata's own exerciser uses but which are not public API; pinned at
  1.8.9. Audit §4.
* **Two validation libraries**, the one wanted not the one used. Audit §4 *Two kits* and §5
  `validator.ts`.
* **Three registries of in-flight writes** (`Writing.count`, the `writing` state, the mirror's
  `writing` set). `20260928-views-after-convex.md`, item 4. A thread of its own.
* **The commit scheduler keeps its own timer.** Tried on 2026-09-28: es-toolkit's `throttle`,
  and its lodash-shaped `_.throttle` and `_.debounce` with `maxWait`, reschedule the trailing
  call on every call inside the window, and only fire "once per window" when a *later* call
  arrives after it. So "commit `seconds` after the first edit, whatever follows", which
  `tests/state/commit-scheduler.test.ts` pins, is not expressible with them. The per-quiz
  `setTimeout` in `src/state/commit-scheduler.ts` stays; record it under *Hand-rolled on
  purpose* in `notes/stack.md` if the Coach agrees. (The resize hook, a true debounce, now
  uses `_.debounce`.)
* **`React.JSX.Element`, `React.ReactNode`, `React.KeyboardEvent` used as a global namespace**
  in several components without importing `React`. Compiles under the automatic runtime's
  types; `import type { ReactNode }` is the ecosystem's grain and what `app/layout.tsx` does.
  Audit §1, *Framework practice*; raised twice, not yet answered.
* **`reviews.forQuiz` hands every review, drafts included, to every browser**, and the smith's
  panel filters to the shared ones on the client. Known, and marked for the permissions phase;
  here so it is on a list. Audit §1.
* **Raw elements left inside the grid's cells**: the chain picker's `<select>`
  (`cells/chain.tsx`) and the error badge's `<button>` (`cells/ErrBadge.tsx`). Under the bespoke
  grid decision; not changed on 2026-09-28 when the chrome's were.

## Complexity, one session each (audit §5)

* `convex/writing/quiz_writing.ts`: the tree-to-rows diff is gone (the import change of
  2026-09-28); what is left is the update helpers and the inserts.
* `src/lib/importing.ts`: one pass now, no ids; the three payload shapes remain.
* `src/components/QuestionRow.tsx` and `cells/fields.tsx`: row-height negotiation through
  layout effects and a resize token. Inherent to the approved grid.
* `src/state/use-hunt.ts`: four concerns in one hook. `20260928-views-after-convex.md`,
  items 3 to 5.
* The git mirror as a subsystem: `quizgit.ts`, `quiz-mirror.ts`, `commit-scheduler.ts`,
  `changes.ts`, `exposure.ts` and half of `exporting.ts`.
* `src/models/botting.ts`: the second half went with `record_botting`; what is left is the
  projection from rows to cells.
* `src/lib/validator.ts`: the callable wrapper and its unwrapping are two thirds of the file.
* `src/lib/strings.ts` and `src/lib/vv/reporting.ts`: an eight-case sentence joiner serving
  one error map.
* `hunts.open` as a query: `20260928-query-boundaries-plan.md`, item 1.
