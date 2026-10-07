# Thread 15: The recap template reads the question's own fields, and says OR ELSE (2026-10-07)

Branch `20261007-recap_fields`, PR filed at landing; see the report. Stacked on thread 14 (#171).
Suites: `pnpm justify` green (typecheck, lint, 4857 unit tests); `pnpm e2e e2e/recap.spec.ts`
green (6); `pnpm e2e --touched` runs at landing.

* **Built**:
  - `src/lib/recap.ts`: each question played carries `quoted`, `oneline` and `below`, each a
    `ShapedT` (`Record<TemplatableField, string>`) holding every one of the question's own
    markdown fields (`clueing`, `hint`, `full_answer`, `notes`, `recap`) shaped for one place:
    `{{quoted.clueing}}`, `{{oneline.full_answer}}`, `{{below.recap}}`. `quoted_body`,
    `answer_line` and `recap_below` are gone, and the recap no longer reads `chains_to` or
    `LLSmithExport.bodyOf`. The shapers are `quotedOf` (was `quotedBodyOf`), `oneLineOf`, and
    `belowOf` (was `recapBelowOf`).
  - `DefaultTemplate` spells the question's line itself, and quotes the question's **own** hint
    after `...OR ELSE...`, only when it has one, inside `{{#hint}}..{{/hint}}`. Inside that
    section mustache pushes the hint string, `BagContext.lookup` finds no `quoted` on a string,
    and walks up to the played item: `{{quoted.hint}}` resolves. `BagContext` unchanged. The
    answer's section is `{{#full_answer}}`.
  - Tests (`tests/lib/recap.test.ts`): the pinned *EverythingNote* now says `...OR ELSE...` with
    each question's own hint (Q1 given a two-line hint with emphasis, Q3 shows its own; no BUT NOT
    anywhere); a test that the chained-to hint is never shown; a multi-line hint stays in its
    quote; `Recap.bagOf` shapes each field, keyed by field.
  - Docs: `notes/vocabulary.md` (*recap bag*, *hint*), the Recap panel's template blurb,
    `human/20261007-recap_template.md` (the new names, the OR ELSE block, and how to rename a
    thread-14 template), `whiteboard/TODO.md` (names updated; columns are not shaped).
* **Decisions taken**:
  - **OR ELSE as its own paragraph** inside the quote (clueing, blank, `...OR ELSE...`, blank,
    hint), not inline after the clueing as the plan's gloss sketched: the note keeps the shape the
    league's readers know from BUT NOT, and only the words change. Inline is a one-line edit for an
    author who prefers it.
  - **Every field shaped every way** (15 strings per question), not only the three the default
    uses: an author can write `{{quoted.notes}}` or `{{oneline.hint}}` without a code change.
  - **The old names dropped, not kept.** Keeping them meant keeping the composite and the chained
    BUT NOT inside the recap, which is what the Coach asked to be rid of. #171 is unmerged, so the
    only template written under them is the Coach's own; a template using them fills them in as
    nothing, silently. The how-to says how to rename.
  - Sections key on the field (`{{#hint}}`, `{{#full_answer}}`), not on the shaped value: the
    template reads the question's fields, as asked. A hint or answer of nothing but spaces would
    write an empty OR ELSE or spoiler; not worth the less legible key.
* **Discoveries**:
  - `quoted`, `oneline`, `below` (like `number` and `pct`) win over a widgeting of the same
    label inside `{{#played}}`; these are likelier column labels than `quoted_body` was. Such a
    column stays reachable through `{{#qns}}` (the recap bag's `qn` is empty). Minor; not in TODO.
  - Only a question's own fields are shaped; a text column set into a quote has the old trouble
    (in TODO).
* **Review** (clean, no fixes). Minor, in the PR's open questions: a hint of nothing but spaces
  opens an empty OR ELSE (`hint` is `textish`, not trimmed on write; `full_answer` is `noteish`,
  trimmed, so an empty spoiler cannot happen from stored rows); every field is shaped every way on
  each rebuild (five markdown parses per question for `quoted` alone), worth acting on only if a
  large quiz feels slow; `quoted`, `oneline`, `below` hide a column of the same label inside
  `{{#played}}`.
