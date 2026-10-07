# Thread 1: Widen the recap fields (2026-10-06)

Branch `20261006-recap_widen`, PR filed at landing; see the report. Suites: `pnpm justify` green
(typecheck, lint, 4522 unit tests); e2e not yet run (it runs at landing).

* **Built**: every field of the plan's Decision 3, widened in end to end as `774d2ae` did
  `q1_preamble`, in one commit (`feat: quizzes have a recap head and tail ...`):
  - **Models**: quiz `recap_head`, `recap_tail` (noteish, default `''`), `templated` (list of
    sources, default `[]`); question `recap` (noteish, default `''`, in `questionPatch`);
    widgeting `tier` (`'question' | 'quiz'`, default `'question'`, `WidgetingTierVals`,
    `DefaultTier`, not in `widgetingPatch`). Row validators require each, without defaults.
  - **Actions** (`src/models/actions.ts`, `src/lib/approve.ts` all `mayReviseClaimedQuiz`):
    `set_recap_head`, `set_recap_tail` (content); `set_templated` (layout, so it sits beside the
    widgetings it names; refusal `untemplatable` for a widgeting the quiz lacks); `recap` through
    `edit_question`; `tier` through `add_widgeting`. Server: `setQuizNote` (now carries all four
    quiz notes: perform's switch hit sonarjs's 30-case cap), `setTemplated` in
    `layout_actions.ts`; `editWidgeting` carries a templated label along on a rename,
    `deleteWidgeting` drops it.
  - **Projection** (`src/lib/rows.ts`): `QuizFallbacks`, `QuestionFallbacks`,
    `WidgetingFallbacks`, used by `frameOf`, `seenQuestionFor`, `widgetingFrom`, and by
    `updateQuiz`/`updateQuestion`/`updateWidgeting` in `quiz_writing.ts`.
  - **Jsonball**: export writes all five; import carries `recap_head`/`recap_tail` like the smith's
    note, `templated` after the widgetings and columns (`afterLayout`) minus widgetings the quiz
    will not have (logged), a question's `recap` like `notes`; a pasted widgeting at another tier
    than the held one is skipped. Old exports still import (fixtures under `fixtures/exports`).
  - **Backfills** `backfillQuizRecaps`, `backfillQuestionRecaps`, `backfillWidgetingTiers`, at the
    end of `Backfills`; `Backfilling` in `tests/convex/schema.test.ts`.
  - **Vocabulary**: *recap*, *templated*, *tier* in `notes/vocabulary.md`.
* **Decisions taken**:
  - Names kept as the plan predicted. `tier` is not a bot's *model tier* (`model_tier`); the
    vocabulary says so.
  - `templated` names sources **as a column names what it shows**: `question.<field>` or a
    widgeting's label, so thread 4 can map a column's `source` straight onto it, and
    `widgetingLabelOf` reads both. Templatable question fields: `clueing`, `hint`, `full_answer`,
    `notes`, `recap` (`TemplatableFieldVals` in `src/models/quiz.ts`), the ones an author writes
    markdown into. Widening that list later needs no migration; narrowing it would. Any widgeting
    may be templated; thread 4 may offer only text entries. Quiz fields are not nominable (the
    recap head and tail are always templated).
  - `Quiz.fill` refuses a templated widgeting the quiz lacks, as it refuses such a column.
  - Question `recap` is **exposed** (`qn.recap` in the bag, so templates can read it), sent to
    smiths only, and counted by `Question.isBlank`. Being exposed (and in the jsonball's question
    body) makes `recap` a reserved widgeting label: see *For the Coach*. The quiz's head, tail and
    `templated` are not exposed.
  - `tier` is fixed once made, like `widget_label`: not in the patch. Thread 6 may revisit.
  - The backfills hold only what they write to its validator (as the stamp backfills do), not the
    whole row as `774d2ae` did: a row the validators now refuse (a widgeting labelled `recap`)
    cannot stop the series.
* **Discoveries**:
  - `convex/_generated/` did not change: nothing to commit there.
  - Rehearsed on the agent role: old-shaped rows imported (`npx convex import`), each backfill's
    dry run, `node scripts/convex-migrations.ts run` ("Backfills: every one has finished."),
    `migrations:outstanding` empty, every row filled, a widgeting labelled `recap` included.
  - For thread 4: `QuizValidators.templatedSource`/`templated` and `TemplatableFieldVals` are the
    validators; send the whole list with `set_templated`.
  - For thread 5: `recap` has no column or cell editor yet (`QuestionFieldVals`, `QuestionRow`);
    adding it to `QuestionFieldVals` widens the column source pattern, no migration needed.
  - For thread 6: `add_widgeting` already takes `tier: 'quiz'`, and nothing in the runner looks
    at it: a quiz-tier widgeting runs per question until thread 6 says otherwise.
* **Tightening checklist (thread 9)**: undo each of these, nothing else.
  - [ ] `convex/schema.ts`: drop the hand-written `recap_head`, `recap_tail`, `templated`
        (quizzes), `recap` (questions), `tier` (widgetings) and the comment paragraph about them.
  - [ ] `src/lib/rows.ts`: drop `QuizFallbacks`, `QuestionFallbacks`, `WidgetingFallbacks` and
        their uses in `frameOf`, `seenQuestionFor` (and `SendableQuestionT`), `widgetingFrom`
        (the `tier = ...` default).
  - [ ] `convex/writing/quiz_writing.ts`: the fallback spreads in `updateQuiz`, `updateQuestion`,
        `updateWidgeting`, and the import.
  - [ ] `convex/writing/layout_actions.ts`: `templatedOf` falls back to `QuizFallbacks.templated`;
        read `rows.quiz.templated` directly.
  - [ ] `convex/writing/quiz_actions.ts`: `archiveStarters` spreads `QuestionFallbacks`.
  - [ ] `convex/migrations.ts`: drop the three backfills, their comment, their `Backfills` rows,
        and the imports they alone use; `Backfills` keeps the stamps'.
  - [ ] `tests/convex/schema.test.ts`: empty `Backfilling`.
  - [ ] `tests/convex/migrations.test.ts`: drop *the recap backfills* and the recap case in
        *migrations.runAll* (with `recappedHunt`, `unwiden`, `recapFieldsIn`).
  - [ ] `tests/lib/rows.test.ts` and `tests/convex/hunts.test.ts` (*written before the recap and
        the tiers*, and `unwidened`): drop the fallback tests.
  - [ ] `notes/deploy.md`: the ledger row for this commit and the three backfills.
* **For the Coach**:
  - Before merging this PR, check production holds no widgeting labelled `recap`
    (`human/20261006-recap_widen.md` has the one-line query). Agents do not touch production.
  - Merge order: up to and including this PR, wait for its deploy to log `Backfills: every one has
    finished.`, then the rest. Vercel runs the backfills on deploy.
