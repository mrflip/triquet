# Thread 9: Tighten the recap fields (2026-10-07)

Branch `20261007-recap_tighten`, PR filed at landing; see the report. Tightens Serial Deploy: recap
(#163). Suites: `pnpm justify` green (typecheck, lint, 155 files, 4908 passed, 1 skipped); e2e runs
at landing (`pnpm e2e --touched`).

* **Built**: thread 1's tightening checklist, every box, in `81eafb5` (code and tests) and
  `be9f1f7` (the ledger):
  - [x] `convex/schema.ts`: quiz `recap_head`, `recap_tail`, `templated`, question `recap`,
        widgeting `tier` derived from their row validators again, required; the comment paragraph
        about them gone.
  - [x] `src/lib/rows.ts`: `QuizFallbacks`, `QuestionFallbacks`, `WidgetingFallbacks` gone, with
        their uses in `frameOf`, `seenQuestionFor` (`SendableQuestionT` back to its pre-widening
        shape) and `widgetingFrom`.
  - [x] `convex/writing/quiz_writing.ts`: the spreads in `updateQuiz`, `updateQuestion`,
        `updateWidgeting`, and the import.
  - [x] `convex/writing/layout_actions.ts`: `templatedOf` gone; `rows.quiz.templated` read directly.
  - [x] `convex/writing/quiz_actions.ts`: `archiveStarters` reads the row as it is.
  - [x] `convex/migrations.ts`: the three backfills, their comment, their `Backfills` rows and
        imports gone; `Backfills` keeps the twelve stamp backfills.
  - [x] `tests/convex/schema.test.ts`: `Backfilling` empty.
  - [x] `tests/convex/migrations.test.ts`: *the recap backfills* and the recap case of
        *migrations.runAll* gone, with `recappedHunt`, `unwiden`, `recapFieldsIn`.
  - [x] `tests/lib/rows.test.ts`, `tests/convex/hunts.test.ts`: the fallback tests and
        `unwidened` gone; two rows tests kept their non-fallback half.
  - [x] `notes/deploy.md`: ledger rows for the widening (`20261006-recap_widen`, #163, with the
        note that production's deploy did not start its backfills and a Coach ran them) and for
        this tightening.
* **Decisions taken**:
  - A ledger row for the tightening itself as well as the widening, as `20261006-tighten_orglabel_viz`
    did: it names the one reason its push can be refused (a backend that missed the widening).
  - `recap_template` untouched: Absentable for good (thread 14).
* **Discoveries**:
  - Readers that leaned on absence beyond thread 1's list, all in tests, caught by typecheck and
    lint: raw `ctx.db.insert` rows without the fields in `tests/convex/hunts.test.ts` (three),
    `reading.test.ts`, `seeding.test.ts`, `tests/state/use-hunt.test.ts`, and
    `tests/support/soundness.ts`'s `widgeting.tier ?? 'question'` (thread 6's). Each now gives or
    reads the field as stored. No app reader leaned on a fallback.
  - `convex/_generated/` did not change.
  - **Rehearsal** on lane 4's agent backend: pushed the widened tree, made two hunts with
    `testing:makeHunt` (2 quizzes, 10 questions, 4 widgetings), stripped the five fields with a
    temporary, uncommitted internal mutation; each backfill's dry run showed the change;
    `node scripts/convex-migrations.ts run` said "Backfills: every one has finished.",
    `outstanding` empty, no row lacking a field. The tightened push then succeeded over that set,
    and `runAll` on it ran clean (stamps only). Stripped again, the tightened push was refused
    ("missing the required field `recap`"), as expected. The backend was emptied afterwards.
* **For the Coach**: merge after #163's backfills have finished on production, which the progress
  file says they have (run by hand, 2026-10-07). If the push is refused anyway, production keeps
  serving the widened version: run `migrations:runAll` and redeploy.
