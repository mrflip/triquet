# Thread 17: Mustache helpers for the recap's conveniences (2026-10-07)

Branch `20261007-recap_helpers`, PR filed at landing; see the report. Stacked on thread 16. Landed
unreviewed at the Coach's word. Suites: `pnpm justify` green; `pnpm e2e --touched` runs at landing.

* **Built**:
  - `src/lib/templating.ts`: `Templating.Helpers`, a frozen registry of three **template helpers**,
    each called only as a section, the section filled in first and then shaped:
    `{{#quote}}..{{/quote}}` (every line after the first opens `> `), `{{#oneline}}..{{/oneline}}`
    (joined onto one line), `{{#apart}}..{{/apart}}` (a leading `---`/`===` set a blank line
    apart). Templating's writer is now a `FillWriter` (a `Mustache.Writer` whose `renderSection`
    checks the registry by the section's exact name before the bag). Every template that goes
    through `Templating.fill` has them: field templates, recap head and tail, the recap template.
    Not the `aibot` prompt templates (`lib/ask/prompts.ts`), which use mustache on their own.
  - `src/lib/shaping.ts` (`import * as Shaping`): `quotedOf`, `oneLineOf`, `belowOf`, moved
    unchanged from `recap.ts` (which still uses them for `played`'s pre-shaped fields), so
    templating can use them without importing the recap.
  - Tests: `tests/lib/templating.test.ts` *Helpers* (each helper, composition both ways, a helper
    in a `{{#qns}}` item, on a column, the line-break rule, and safety: bare names, a value naming a
    helper, a value holding a helper's section, a function under a helper's name, inherited names,
    case, budget and length); `tests/lib/shaping.test.ts` (moved from `recap.test.ts`, one case added).
  - Docs: `notes/vocabulary.md` (*template helper*), `notes/stack.md` (mustache entry).
* **Decisions taken**:
  - **Override the writer's `renderSection`, not mustache's lambdas.** A mustache lambda is a
    function found by lookup; `BagContext.lookup` still never hands back a function. The helper is
    found by name in app code, gets the section's filled-in text, and returns a string. So nothing
    in the bag can ever be called, and a value that is or names a function stays data.
  - **The name clash** (thread 15's `oneline` bag value, and any column labelled `quote`,
    `oneline` or `apart`): the **bare names are the helpers'**. `{{#oneline}}` is always the helper;
    `{{oneline}}` and `{{quote}}` fill in nothing (as asked); `{{^quote}}` always shows. A dotted
    key that starts with one reads the bag as ever: `{{oneline.full_answer}}`,
    `{{#oneline.full_answer}}`, and a column so labelled as `{{quote.value}}`. No rename needed.
    The cost: a column labelled `quote` can no longer be tested with `{{#quote}}`; write
    `{{#quote.value}}`.
  - **A section whose closing tag stands on a line of its own keeps its last line break**; one
    closed on the same line keeps none, whatever the field ends with. The shapers drop trailing
    blank lines, so without this rule `{{#apart}}` on its own lines would glue the next line on.
    Decided from the template's text, never the data.
  - **Budgets**: each helper call spends one of `FillBudget`; what a helper adds (`> ` per line)
    counts against `FilledMax` as it goes.
