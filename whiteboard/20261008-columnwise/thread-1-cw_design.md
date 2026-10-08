# Thread 1: Design note and vocabulary (2026-10-08)

Branch `20261008-cw_design`, PR filed at landing; see the report. Docs only: `pnpm justify` green,
no e2e (git_hygiene, *When e2e is not worth running*).

* **Built**:
  - `notes/decisions/20261008-columnwise.md`, the decision record: entries first (§1), families
    and params (§2), `liquidize` (§3), the column's ref, formula, template, readout, collapse, the
    sheet and sorts, the source menu (§4), templateable vs template (§5), the render pipeline and
    its two warnings (§6), folding editors (§7), removal and the commit model (§8), the reserved
    words as groups (§9), the `columnwise` chain and the importer's promise (§10), and what it
    supersedes in `2026-10-widgets.md`. Each piece names its thread.
  - `notes/vocabulary.md`: *Widgets* gains `liquidize`, *params*, *family*, *removal*, the folding
    editor; the run order puts entries first; the tier admits `liquidize` and the `quiz.<label>`
    ref. *Columns and the bag* gains *ref*, *part*, a column's *formula*, *template*, *readout*,
    *collapsed*; *reserved* widens. *templated* becomes *templateable*; the category-estimate
    entry names `category_data`.
  - `notes/security.md`: a line for model output run as a template, and computed images linked.
  - `notes/decisions/2026-10-widgets.md`: a *Revised by* line at the top and a pointer at each
    place the new record changes (entries, the quiz tier, the reserved pattern, removal).

* **Decisions taken** (where the preplan left it open; each is in the record, normative, and the
  Coach may overrule before code moves):
  1. A new dated record rather than an addendum, as the plan's gloss suggested.
  2. **Identity is the formula's absence.** `$` is not identity for a widgeting (it reads the
     whole widgeted); an emptied formula box removes the field.
  3. A field or a top-level word has no status, so the column's formula always runs on it; the
     formula's own outcome reads as a `jsonata` widgeted's (nothing is `missing`, a failure
     `errored`).
  4. **Default readout**: as the cells choose today; `markdown` for a column with a template or
     showing a `liquidize`.
  5. **Computed values reach markdown with images linked** (`Templating.bagOf`'s `&#33;[` rule),
     through the column template's `value` and the markdown readout alike. Recorded in
     `notes/security.md`.
  6. **A sort reads the formula's value**, never the template's text; the sheet carries the
     template's text (what the column shows).
  7. **The ref admits the view `butnot`**: the ruled backfill (`question.<x>` to `<x>`) makes
     `question.butnot` into `butnot`, so the resolver must take it. It stays a view, out of the bag.
  8. **`qn` is not a ref.** §3's first menu named "the `qn` object"; the later ruling's list (and
     the plan's 3b gloss) does not. Following the later one.
  9. **Default params on the widget** are the family's params, each optional, flat in `config`
     beside `entry_kind`; the widgeting's params overlay them key by key.
  10. **`liquidize`**: `template` and `template_from` are exclusive; `template_from.formula` must
      come to a string, else `errored`. Its folded line is its template line.
  11. **Removal**: formulas, templates and `template_from.ref` naming a widgeting do not hold it
      back (they read `missing` after, as formulas do now); its templateable nomination goes with
      it, as `deleteWidgeting` does today.
  12. **Commit model**: labels in general (quiz, column, widgeting) keep an explicit button, as the
      "anything with consequences, such as editing a label" ruling reads.
  13. **Reserved-word mechanics**: the bag's top-level keys as one list beneath `widgeting.ts`,
      with a test holding `QuizBagValidators.quizBag` to it (an import cycle forbids deriving it
      directly, *Discoveries*); lists that do not exist yet (the column's four new fields,
      `digest` and `stale`) written once in the owning model and held to it later by a test.

* **Deviations**: the vocabulary's *template helper* entry still described mustache sections
  (`{{#quote}}..{{/quote}}`); `lib/templating.ts` has them as Liquid filters (`| quote`). Fixed
  while editing the neighbouring *templateable* entry. No later thread's work pulled forward.

* **Discoveries**:
  - **`forced_label`** was reserved (`c278b471`) and dropped when the override retired
    (`e03bd267`); the importer still reads it (`src/lib/jsonball.ts`, `src/lib/importing.ts`). The
    record restores it.
  - **Import cycle**: `src/models/quiz-bag.ts` imports `quiz.ts`, which imports `widgeting.ts`, so
    `ReservedWidgetingLabels` cannot read the bag's shape directly. Thread 2: put the top-level
    key list beneath `widgeting.ts` and test the bag's shape against it.
  - **Global words reach every label**: `PA.Unreserved` is applied by the `label` check
    (`src/lib/vv/checks/strings.ts`) to hunts, realms, quizzes, questions, columns, widgets,
    widgetings and usernames alike. A seeded entry widget for a new family cannot be labelled
    `number`, `text`, `boolean` or `enum` (the `types` group).
  - **The integrity check needs nothing new for reserved words**: `QuizValidators.quiz`'s
    widgetings are `WidgetingValidators.widgeting`, whose `widgetingLabel` carries the pattern.
  - A nominated `aibot` widgeting is not filled today: `filledQnOf` fills only a string value, and
    a bot's value is an object. Model output reaches a template as its text through a `jsonata`
    string over a reply, or (thread 7) `template_from`.
  - `whiteboard/TODO.md`, *Figure out reserved words vs our own use of them*: §9 settles the
    `categories` half at 3c. The orchestrator may strike or trim it once 3c lands.

* **For the Coach**:
  - **Before thread 2 (minor for this thread, but it changes thread 2's code)**: a label already
    written that a new global word catches (a column `total`, a widgeting `average`, a username
    `python`). Rows read back are never validated, so production keeps working; but an **old
    export holding one** meets the importer's promise. Options: (a) the importer refuses it with a
    sentence naming the word, and the author edits the paste; (b) the importer relabels it
    (`Labelmaker.firstFree`), which breaks whatever names it by label (formulas, columns).
    **Answered by the orchestrator: (a)**, refused with a sentence naming the word, built by
    thread 2; the Coach greps production's raw export before thread 2 deploys. One line in §9.
  - **`category`**, singular, is a noun of the tool and not reserved anywhere; suggested for 3c
    with `categories` (the note in `patterns.ts` exempts both). A suggestion for the Coach, not in
    the record.
  - Read decisions 2, 4, 5, 8 and 11 above most closely: each shapes what a later thread builds.
