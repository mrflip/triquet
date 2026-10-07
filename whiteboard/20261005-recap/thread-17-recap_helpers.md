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
  - `Recap.DefaultTemplate` uses them, closing thread 16's gaps 6 to 8 in the default itself:
    `> {{#quote}}{{clueing}}{{/quote}}`, `> {{#quote}}{{hint}}{{/quote}}`,
    `~~**{{#oneline}}{{full_answer}}{{/oneline}}**~~`, `{{#apart}}{{recap}}{{/apart}}`. The pinned
    *EverythingNote* now keeps Q1's verse and OR ELSE hint inside its quote and Q3's two-line
    answer on one line in its spoiler; thread 16's gap tests for 6 to 8 now hold the default to the
    closed output, and their JSONata recipes (`quoted_*`, `answer_line`, `recap_below`) are gone
    from the tests and the how-to (`in_order` and `solved_by` stay).
  - Docs: `notes/vocabulary.md` (*template helper*; the default reads the helpers), `notes/stack.md`
    (mustache entry), the Recap panel's template blurb, `human/20261007-recap_template.md` (a
    *template helpers* section; gaps 6 to 8 marked closed), `whiteboard/TODO.md` (thread 16's
    "mustache lambda" item struck).
  - **Longnote** (added mid-thread at the Coach's word): `PA.Longnote` (`{ ...Noteish, max: 20_000 }`,
    `src/lib/vv/patterns.ts`), `CK.longnote` (`src/lib/vv/checks/strings.ts`, as `noteish`: trimmed,
    the same characters, to 20,000), `longnote` in the `Validator` kit. Applied to the quiz's
    `smiths_note`, `recap_head`, `recap_tail` and `recap_template` (`src/models/quiz.ts`); the
    actions, the import and the schema all read those validators. Tests: `strings.test.ts`,
    `tests/models/quiz.test.ts` (each long text takes 20,000 and refuses one more; the Q1 preamble
    still stops at 3600), and the two tests that pinned a recap head or tail at 3600 now pin 20,000.
    `notes/vocabulary.md` names it under *smith's note* (`noteish` is named nowhere else in
    vocabulary or STYLE).
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
  - **Where longnote stops**: the quiz's four long texts only. `q1_preamble` (a short pointer to
    the smith's note) and a question's fields (a question's worth of text) stay `noteish`. It only
    raises a limit, so every stored row fits: no migration, no backfill. Convex validators carry no
    string length, so `convex/schema.ts` and `_generated/` are unchanged; `tests/convex/schema.test.ts`
    needed nothing. No UI input caps these four (the smith's note and recap boxes set no `maxLength`).
  - **Budgets**: each helper call spends one of `FillBudget`; what a helper adds (`> ` per line)
    counts against `FilledMax` as it goes.
* **Deviations**: built on thread 16's branch before it landed. Thread 16 was blocked (the main
  checkout's uncommitted `src/lib/recap.ts`), so this branch was rebased locally onto
  `20261007-recap_basic` as it stood (d92ba4f) to switch the default; `pnpm catchup` onto 16's
  landing drops its commits as already applied.
* **Discoveries**:
  - Mustache's own lambda path (a function found by lookup, called with the raw section text and a
    `render`) would have meant letting `lookup` return functions; overriding `renderSection` is
    smaller and keeps the "nothing in the bag is called" rule absolute.
  - A section token is `[kind, name, beg, end-of-opening, tokens, beg-of-closing]`; `@types/mustache`
    types it `string[]`, hence one cast (`SectionTokenT`) in `templating.ts`.
  - The recap bag's `played` shaped values and the helpers are now twins built from the same
    shapers (`lib/shaping.ts`); whether `played` stays is the Coach's call (TODO).
* **For the Coach**: the landing needs the main checkout's uncommitted `src/lib/recap.ts` gone, as
  thread 16's does. No lint or type suppressions.
