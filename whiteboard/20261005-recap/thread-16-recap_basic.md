# Thread 16: The default recap template stands on the app's basic tools (2026-10-07)

Branch `20261007-recap_basic`, PR filed at landing; see the report. Stacked on #172. Landed
unreviewed, at the Coach's word. Suites: `pnpm justify` green (typecheck, lint, unit tests, 47 in
`tests/lib/recap.test.ts`); `pnpm e2e e2e/recap.spec.ts` green (6); `pnpm e2e --touched` at landing.

* **Built**:
  - `Recap.DefaultTemplate` (`src/lib/recap.ts`) reads only `{{#qns}}`, each question's fields and
    columns by label, `{{recap_head}}`/`{{recap_tail}}`, and plain mustache: `{{#rank}}` skips
    archived and Q#-less questions, `{{rank}}` numbers, `{{clueing}}`, `{{hint}}`, `{{full_answer}}`,
    `{{recap}}` bare, `{{correct_pct}}` as a column. The rule under the head is now unconditional.
    `played`, `quoted`, `oneline`, `below`, `pct`, `number` are untouched in the recap bag.
  - Tests (`tests/lib/recap.test.ts`): the pinned *EverythingNote* follows the new output (its gaps
    show); an author's own `jsonata` column in place of the Correct Answer line; *The default
    template's gaps, and the columns that close them*: per gap, the default's output and the
    recipe's, and the everything quiz by a template reading every recipe (it comes back to the old
    note but for the templated clueing). The recipes there (`Recipes`) are written as an author
    types them, and match the how-to's text.
  - The Recap panel's template blurb names `{{#qns}}` first, `played` as optional.
  - Docs: `human/20261007-recap_template.md` (the default verbatim, where `played`/`quoted`/
    `oneline` came from, the gap list with recipes), `notes/vocabulary.md` (*recap bag*),
    `whiteboard/TODO.md` (thread 16's section: what only the app can close).
* **Decisions taken**:
  - **`{{#rank}}` as the filter** and `{{rank}}` as the number: rank is blank for archived and
    Q#-less questions, so the one plain section leaves out archived questions and a fresh quiz's
    blank rows. `{{qnum}}` would show the author's Q# (decimals, duplicates) and keep archived rows.
  - **The rule under the head always**, not `{{#qns.0}}`: a fresh quiz holds blank rows, so that
    test was true for any quiz with a row; always is the same in practice and reads plainer. The
    quiz-level `in_order` column restores "only when a question follows" (gap 5).
  - **Recipes proven in tests, not shipped**: no library widgets added; the Coach decides.
* **Deviations**: e2e `recap.spec.ts` fills its rows in Q# order (the default loops the quiz's own
  order now), and its broken-head test expects the rule under the head.
* **Pulled in from the Coach's checkout**: the main checkout held an uncommitted edit to
  `src/lib/recap.ts` writing the (old) default as one template literal. This branch writes the new
  default the same way, `` `...`.trim() `` -- trimmed, because the Recap panel compares the trimmed
  box with `DefaultTemplate` to put a quiz back on the default, and an untrimmed literal (as in the
  Coach's edit) would never match, saving the default as the quiz's own.
* **Discoveries**:
  - A quiz-level `jsonata` widgeting's value can be a list a template loops over
    (`{{#quiz.in_order.value}}`); wrap it in `[...]`, or a single question comes back as an object
    and `.0` misses. It must sit below the question widgetings to read their columns.
  - `$exists(null)` is true in JSONata: test a widgeted's value with `$type(...) = 'number'`.
    `$trim` collapses newlines, so a multi-line field is split before trimming.
  - The bag has no alternate flag (`viz` is not exposed): alternates and Q#-less questions cannot
    be told apart by template or formula. Thread 12's `archived` should come with it.
* **For the Coach**: the first `pnpm land` was refused: the main checkout would not switch, over
  your uncommitted `src/lib/recap.ts` (the template-literal rewrite of the old default). This branch
  carries that form with the new content; discarding the edit there lets the landing go through.
  The gap list is in `human/20261007-recap_template.md`; three gaps need the
  app (alternates, Q#-less questions, templated fields), the rest close with a column.
