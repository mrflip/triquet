# 2026-10-01: Rewidgeting thread 8 -- entry widgets, and moving hint, alt_text and notes into them

* **Entries are built.** A widget of the `entry` formulary is typed into: its config names what its
  cells take (`text`, `number`, `labelish`, `titleish`), and its cell is the grid's own field
  editor for that kind, committing on blur to the cell's one `widgeteds` row (upserted; an emptied
  cell deletes it). Make one from *New widget…* in the widgeting editor, formulary *An entry*.
  The library seeds none, so the picker's *Entries* group is empty until someone makes one -- say
  if a generic seeded entry (a `remark`, say) would earn its place.
* **Three calls for you to overturn**, all in `notes/decisions/2026-10-widgets.md`, *Entries*:
  an entry's kind is fixed once made, as its formulary is (the values typed hang on it); an
  emptied cell holds no row, so it reads `missing`, not an `ok` of nothing; and **an entry's value
  rides the hunt import now**, merged as a question's own field is (a value replaces, null
  empties), rather than waiting on PR #66 with the `aibot` replies: it is what a person typed, and
  the export is their exit door.
* **`notes` stays a question field**, as the plan expected: while `notes` is an exposed question
  field, no widgeting may be labelled `notes`, so a default `notes` entry would have to be called
  something else, and a quiz would show two notes.

### Moving `hint`, `alt_text` and `notes` into entries: what it would take

Not done (a data move, and a later call). Read for the day it is wanted:

1. **The widgets.** Three seeded entry widgets. `notes` fits `text` as built. `alt_text` is read
   aloud as written, so it wants a plain text kind (no markdown face; `StretchField` has a `plain`
   prop already). `hint` is the hard one: its box grows and, with the clueing, decides the row's
   height (`GrowingField`); an entry's text box only stretches to the row. A fifth kind, or a
   `grows` flag on the kind.
2. **The bag and every formula.** Out of `Question.exposed`, each name frees for a widgeting
   label, and `qn.hint` becomes `{ status, value, err }`: every formula reading `qn.hint`,
   `qn.notes` or `qn.alt_text` (the seeded `numnum_hint` input and `clueing_with_butnot`, and any
   author's) must read `.value`, guarded by status. The seeds can be rewritten; an author's
   formulas cannot be found and fixed for them.
3. **The core features that read `hint` by name.** BUT NOT is the tool's own mechanic: the
   chained-to question's hint, shown by `cells/chain.tsx`, `ReviewScreen`, the sheet's `butnot`
   column and the league export (`ll-smith-export.ts`). As a widgeting, that is a core view knowing
   a label -- what retiring the `butnot_ishes` view undid. **My recommendation: `hint` stays a
   question field, as `chains_to` does; move only `notes` and `alt_text`.**
4. **The data.** A migration through `notes/deploy.md`: for each quiz, a `notes` (and `alt_text`)
   widgeting; for each question with a non-empty value, its row; then the question fields dropped
   (widen, copy, tighten -- three pushes). That is translation code of the kind this sprint chose
   not to write; small, but it touches every quiz and question.
5. **What follows the fields.** The starter layout's `notes` column re-pointed to the widgeting
   (so a new quiz starts with one widgeting again); `QuestionField`, `QuestionRow`'s field cases,
   `ImportableFieldnames`, `ClearedValueFor` and the question validators lose them; the league
   export reads the run; the git mirror's `question.notes` column becomes `notes.status` and
   `notes.value`, one diff of churn in every quiz's history. The hunt export keeps the key `notes`
   if the widgeting keeps the label, and this thread's import already reads an old export's bare
   `"notes": "..."` as an entry's value -- the one part that is free.
