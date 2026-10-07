# Thread 4: Field templates (2026-10-06)

Branch `20261006-recap_templates`, PR filed at landing; see the report. Suites: `pnpm justify`
green (typecheck, lint, 4690 unit tests); `e2e/entries.spec.ts` green (its new templated-clueing
test among them); the full e2e runs at landing.

* **Built**:
  - `src/lib/templating.ts`, imported `import * as Templating from '../lib/templating'`:
    - `fill(template, bag)` -> `{ markdown, issue }`: mustache, escaping off, never throws. A
      string fills in as it is, a widgeted (`{{qn.photo}}`) as its value's text, a number or
      yes-or-no as its text, anything else as JSON. A template with an issue comes back as typed,
      with the issue, so `markdown` is always ready for the parser.
    - `issueOf(template)`: refuses what does not parse, raw tags (`{{{x}}}`, `{{&x}}`: never
      needed with escaping off, and they would put a widgeted in as `[object Object]`), and
      partials (`{{> x}}`).
    - `bagOf(run, question_id | null)` -> `TemplateBag`: the formula's bag less `params` and
      `widgeting_label`, with `qns` and `qn` as they stand after **every** widgeting has run (so a
      template sees every column). `null` is for a text of the quiz's own (recap head, tail):
      `qn` empty. **The one place a template's bag is made**: thread 6 widens it here, or in the
      runner's `frame.quiz`, which it already reads.
    - `filledQuiz(quiz, run)`: the quiz with its questions' templated fields filled in, for an
      export (the LL Export uses it). `templatableSources(quiz, library)`, `templates(quiz,
      source)`, `sourceOfField(field)`.
  - `src/lib/markdown.ts`: `TemplatedAllowlist` (the one allowlist plus `img` with `src` and `alt`)
    and `TemplatedRenderOptions`, both built from the one allowlist.
  - `components/cells/markdown.tsx`: `faceOf(text, bag)`; `MarkdownText` and `MarkdownFace` take
    `templated` (images kept) and `issue` (said above the text). An image is drawn lazily, with
    no referrer, never wider than its box. `GrowingField`, `StretchField` and `EntryCell` take a
    `bag` (null when untemplated); `QuestionRow` passes one for each nominated field and text
    entry; `QuestionTable` and `Workbench` pass `quiz.templated` down.
  - `src/components/TemplatedEditor.tsx`: the gear's *Templates* section, a checkbox per markdown
    field (clueing, hint, full answer, notes, recap) and per text entry, each tick sending the
    whole list (`set_templated`).
  - Tests: `tests/lib/templating.test.ts`, `tests/components/cells/markdown.test.tsx` (the order:
    a value holding markdown renders as markdown; one holding `<script>`, an `<img onerror>` or a
    `javascript:` link renders inert, including a link the template opens and the value closes),
    image cases in `tests/lib/markdown.test.ts`, one e2e in `e2e/entries.spec.ts`.
* **Decisions taken**:
  - **mustache, not handlebars** (the plan's call): logic-less. Its context is replaced by
    `BagContext`, which reads only the bag's **own** keys: `{{constructor}}`, `{{qn.toString}}`,
    `{{qns.map}}`, a string's `length` all come to nothing, and no function is ever called. Every
    lookup and section pass spends one of a budget of 10,000, and a fill longer than 100,000
    characters is refused: a list-in-a-list-in-a-list cannot hang the page.
  - **Images only in templated fields.** The Coach's "with this enabled, users can add images" read
    strictly: untemplated fields still fetch nothing on sight. An image needs a whole `https`
    address naming a host: the sanitizer's own protocol check lets relative addresses through
    (`/api/..`, `//elsewhere`), so `src` must also match `/^https:\/\/[^\s/\\]/`, in the schema
    itself, so the sanitizer is still the step that decides. No `title` on an image.
  - **Order, as the Coach set it**: fill (cleans nothing) -> `react-markdown` (HTML is text) ->
    `rehype-sanitize`, last. Nothing touches a value before mustache or the text before the parser.
  - **A widgeted fills in as its value.** `{{qn.photo}}` is the column's value; `{{qn.photo.value}}`
    works too. A section over a widgeted (`{{#qn.photo}}`) is always entered, missing or not: use
    `{{#qn.photo.value}}`.
  - **Offered for nomination**: the five markdown fields and text entries only. Any other widgeting
    is listed only while already nominated, so it can be let go.
  - **Exports**: the LL Export reads templated fields filled in. Copy for Sheets, the jsonball and
    the table keep the source as typed: they are round-trip formats.
  - **Self-reference** reads the source: a templated clueing's `{{qn.clueing}}` is its own text
    as typed. Categories are not in the bag (TODO).
  - A broken template shows its text as typed with the issue in red above it on the face; the box
    gets `aria-invalid`.
* **Pulled forward**: nothing from later threads. **For thread 5**: `Templating.fill(text,
  Templating.bagOf(run, null)).markdown` for the recap head and tail, `bagOf(run, question._id)`
  for a question's nominated fields (or `filledQuiz(quiz, run)` once for all of them), then
  `Bbjank.toBbjank`. `fill` never throws; show `issue` beside the editor if you like. **For thread
  6**: quiz widgeteds put in `run.frame.quiz` reach templates as `quiz.<label>` with no change
  here. **For thread 7**: the order is pinned by `tests/components/cells/markdown.test.tsx`;
  `BagContext` is the only departure from stock mustache.
* **Discoveries**:
  - hast-util-sanitize's `protocols` allows any relative URL; a regex in `attributes` closes it.
  - A controlled checkbox waits on the server's round trip, so Playwright's `check()` reports no
    change; the spec clicks and then waits on `toBeChecked`.
  - Left in `whiteboard/TODO.md`, *From recap sprint, thread 4*: the review screen shows templated
    fields as typed; a templated image reaches the LL Export as markdown; categories in the bag;
    an image loading after a row measured itself; a shared template check for prompts and fields.
* **For the Coach**: three `eslint-disable-line` comments in tests (`unicorn/prefer-https`, and
  once `sonarjs/no-clear-text-protocols`), on cases that feed a plain-http image address on
  purpose. `notes/stack.md`'s mustache entry names the second importer; `notes/vocabulary.md`'s
  *templated* entry says what filling in is.
* **Review** (`fixed`): bf0c200 counts what tags fill in against `FilledMax` as it fills, so a
  whole list filled again and again is stopped early; 8462415 gives templating a mustache writer
  of its own, its cache emptied after each fill and check. Left open, minor, and in the PR:
  - Two quick ticks in *Templates* can lose the first: each sends the whole list from the last
    server state. A per-source action, or local pending state, would fix it.
  - A long literal section can still repeat up to the pass budget before the final length check:
    bounded, not stopped early.
  - `{{#qns}}` walks archived questions too, as formulas do.
  - The image tests could add entity-encoded and backslash addresses (checked by hand; they hold).
