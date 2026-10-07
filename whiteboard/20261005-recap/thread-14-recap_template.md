# Thread 14: An editable recap template, in pure mustache over markdown (2026-10-07)

Branch `20261007-recap_template`, PR filed at landing; see the report. Suites: `pnpm justify` green
(typecheck, lint, 4850 unit tests); `e2e/recap.spec.ts` green (its new template test among them);
`pnpm e2e --touched` runs at landing.

* **Built**:
  - `src/lib/recap.ts` rewritten: `DefaultTemplate` (mustache over markdown), `templateOf(quiz)`,
    `bagOf(quiz, run)` (the **recap bag**: `Templating.bagOf(run, null)` plus `recap_head` and
    `recap_tail` filled in, plus `played`), `noteOf(quiz, run)` -> `{ bbjank, issue }` (fill once,
    `Bbjank.toBbjank` once), and the pre-shapers `quotedBodyOf`, `oneLineOf`, `recapBelowOf`.
    `blockOf`, `bbjankOf` and `CorrectPctRE` are gone; `CorrectPctLabel = 'correct_pct'`.
  - Each played item: the question as `qns` holds it, templated fields filled in, plus `number`,
    `quoted_body`, `answer_line`, `recap_below`, `pct` (these win over a widgeting of the same label).
  - Quiz field `recap_template`, **Absentable** (optional in the model and row validators for good,
    `noteish.min(1)`; listed under `Absentable` in `tests/convex/schema.test.ts`). No migration.
    `set_recap_template` (`recap_template: string | null`, null clears) under `mayReviseClaimedQuiz`;
    `setRecapTemplate` in `convex/writing/quiz_actions.ts`. Ball export writes it only when present;
    import carries it, a null or `''` clearing it.
  - `RecapPanel`: a folded *Recap template* `Accordion` below the tail, monospace, red with the issue
    as helper text when broken, "(the default)" / "(the quiz's own)" in its summary. The note follows
    the template draft as typed.
  - `src/components/cells/use-face.ts`: `useFace` (faceOf + report) and `useTemplateIssueReport`,
    `console.error('Triquet: could not fill in the template in <field> of [question <label> in]
    quiz <label> — <issue>', { field, quiz, question })`, once per change of issue. Used by the grid's
    `GrowingField`/`StretchField` (so every templated field and text entry), the recap head and tail,
    and the recap template.
  - `src/lib/bbjank.ts`: `mdast-util-definitions` (definitions found inside quotes and list items,
    first wins), `indentsQuoted(markdown)` exported, and a quote's `{AS: ...}` read from a heading as
    well as a paragraph (a `---` under the opening line no longer loses the speaker).
  - Docs: `notes/vocabulary.md` (*recap template*, *recap bag*, *played*, *pre-shaped*),
    `notes/stack.md` (mdast-util-definitions), `whiteboard/TODO.md` (thread 5's items struck,
    thread 14's section), `human/20261007-recap_template.md` (how to write one).
* **Decisions taken**:
  - **Flat played items**, not `{{qn.x}}` inside `{{#played}}`: the same shape `{{#qns}}` already
    gives field templates.
  - **Default template** pinned exactly against thread 5's output for a quiz with head, tail,
    BUT NOT, verse, multi-paragraph recap, `correct_pct`, a templated clueing and a blank question
    (`tests/lib/recap.test.ts`, *EverythingNote*). It uses `***` for the rule (a `---` would
    setext the head's last line), `{{#played.0}}` so the rule appears only when a question follows,
    one `{{! comment }}` saying so, and `{{#answer_line}}` so a blank answer writes no empty spoiler.
  - **Back to default without a button** (the Coach): emptying the box and leaving it puts the
    default back in the box and clears the field (`useDraft`'s tidy); saving text identical to the
    default also clears it, so the quiz keeps following the default.
  - **A broken template** fills in as typed (thread 4's rule), so the note shows it; the box says why.
  - **Console reports** fire per change of the issue text, on drafts too (a half-typed section logs
    once, then again only if the message changes). No template text in the report.
  - `pct` from a column labelled exactly `correct_pct` (the Coach's answer; thread 12's item taken over).
* **Deviations** from thread 5's note, all from converting one document instead of each text:
  - A clueing's verse followed straight by prose gets a blank line after the `[/list]` (the
    closer forScreen inserts reads as the author's once inside the quote). The screen shows a gap there too.
  - An answer's own emphasis nests the other way: `[i][b]Hamlet[/b][/i]`.
  - A blank answer writes `Answer:` alone, not an empty spoiler.
  - Improvements that fall out: a clueing opening `1984.` keeps its number; a clueing opening with
    verse opens on the line below `1.` as a quote; a recap opening `---` stays a rule.
* **Pulled forward** (strike from later threads): `mdast-util-definitions` into bbjank (thread 10's,
  Coach-approved); "`correct_pct` only" (thread 12's).
* **Discoveries**:
  - One document means one set of link definitions: `[1]` defined in two questions resolves to the
    first everywhere. And an unclosed fence in the head swallows the rest. Both in TODO.
  - mustache comments (`{{! }}`) pass `Templating.issueOf`, so a template can document itself.
  - The field template has no pre-shaped values; the same structural catch applies to a templated
    field interpolated into a quote. TODO.
* **For the Coach**: `human/20261007-recap_template.md` is the how-to. The Next dev overlay will count
  the new console errors as issues while a template is broken (dev only).
