# Thread 12: The Coach's follow-ups on templates and the recap (2026-10-07)

Branch `20261007-recap_followups`; the PR is filed at landing (see the report). Suites: `pnpm justify`
green (typecheck, lint, 4879 unit tests). Targeted e2e green: `grid`, `entries`, `recap`,
`quiz-entries`. `pnpm e2e --touched` runs at landing. One test in `e2e/reviews.spec.ts` (the smith's
note folded to a line) fails on the base commit too, alone, with workers=1: it was already broken
before this thread.

* **Built**:
  - **Images everywhere.** `Markdown.Allowlist` (`src/lib/markdown.ts`) keeps `img` for every field,
    only at a whole `https` address (the `ImageSrcRE` check stays), with its alt text. Thread 4's
    `TemplatedAllowlist`/`TemplatedRenderOptions` are gone, and so is the `templated` flag on
    `MarkdownText`, `MarkdownFace` and `FaceT`. In a grid cell (`MarkdownFace` not `inInput`) an image
    is held to `CellImageMaxPx` (96) by `sx`, `objectFit: contain`; everywhere else it is held only to
    the box's width. `GrowingField` measures again when an image in its face loads (`useImageLoads`: a
    native capture-phase `load` listener on the face, since `load` does not bubble).
  - **Categories in the bag**: `categories`, the hunt's in its total order, each `{ label, title }`,
    built once in the runner's frame (`frameOf`). Every bag has it: a formula's (`QuizBag`, and the
    JSON Schema in `QuizBagValidators`), and a template's (`TemplateBag`).
  - **Viz flags**: each question in every bag carries `archived` and `secondary` (yes-or-nos,
    `ArchivedField`/`SecondaryField` in `src/models/question.ts`, set in `baseQns`). Both are now in
    `ReservedWidgetingLabels`.
  - **`qns` and `quiz.questions`** in a **template's** bag (`Templating.bagOf`, via `bagOver`): `qns`
    holds the questions a screen shows (not the archived; the alternates included), and
    `quiz.questions` holds every one. `qn` is still the question itself, archived or not.
    `Quiz.bagKeys` (`exposed` plus `questions`) is what a widgeting for the whole quiz may not be
    labelled (`isQuizReserved`, `planWidgetingEdit`).
  - **The recap reads templated texts filled in**: `Templating.filledBagOf(quiz, run)` is the bag
    for no question with every question's templated texts filled in, each over its own question's
    bag, once: its fields, and the text-valued widgeted of a templated widgeting. `Recap.bagOf` reads
    it (so do `played`'s fields), and the Recap panel fills its head and tail over it.
  - **Default recap template** skips the alternates (`{{^secondary}}` inside `{{#rank}}`).
  - Tests: markdown (images in every field, cell height), runner (flags, a formula's `qns` keeps the
    archived, categories), templating (`bagOf` split, categories, `filledBagOf`), recap (filled
    fields and text entries, alternates out, numbering after an alternate, the flags, categories,
    `in_order` recipe closing gaps 1-5), quiz (`questions` reserved), widgeting, quiz-bag. One e2e
    test, `e2e/grid.spec.ts`: an image answered late in a clueing is held to 96px and the row grows
    to it. Without the re-measure, it fails.
  - Docs: `notes/vocabulary.md` (*bag*, *reserved*, *template bag*, *recap bag*),
    `notes/stack.md` (react-markdown's allowlist), the jsonata advice prompt (`qns` holds the
    archived, the flags, `categories`), the Recap panel's template blurb,
    `human/20261007-recap_template.md` (default verbatim, gap list), `whiteboard/TODO.md`
    (thread 4 and 16 items struck, thread 12's section), `human/20261007-recap_followups.md`.
* **Decisions taken**:
  - **A formula's `qns` keeps every question; only a template's drops the archived.** The seeded
    BUT NOT formulas (`butnot_ishes`, `butnot_full`, `butnot_numeral`, `clueing_plus_butnot_full`,
    `clueing_plus_butnot` in `src/models/seeds.ts` and the library fixtures) read the chained-to
    question as `qns[label = $$.qn.chains_to]`, and the LL export shows the hint of a chain to an
    archived question on purpose (`recordsOf`: "a chain to one still shows its hint"). Dropping the
    archived from a formula's `qns` would blank those formulas for such a chain, and existing
    libraries keep their old copies of the seeds. The cost: the two bags differ (a formula leaves
    the archived out with `$not(archived)`). The JSON Schema and advice prompt say so.
  - **The flag is named `secondary`**, after the model's viz value (the vocabulary's *secondary,
    an alternate*), beside `archived`.
  - **The default skips alternates, still numbering by `rank`.** `rank` counts an alternate's place,
    so the question after one is numbered one high. It was already one high before (with the
    alternate shown); now the alternate's block is gone too. The `in_order` column closes it.
  - **No-Q# questions stay out of the default.** Putting them last in plain mustache needs a second
    copy of the whole question block (a template cannot include another). The `in_order` recipe,
    rewritten, puts them last, numbered on, and leaves out alternates, the archived and the blank.
  - **Images: the one allowlist, for every field**, reviewers' texts included (the Coach's
    "everywhere"). The privacy cost is noted for thread 7 (below).
* **Discoveries**:
  - A column's copy of the questions (the `in_order` list) holds templated fields **as typed**: a
    formula reads the bag before anything is filled. So gap 9 stays open down the column road.
  - An image's `load` does not bubble, so the face listens natively in the capture phase. React's
    own handling of `load` on a parent was not tested or relied on.
  - The shared `refs/stash` is repo-wide: a worktree's `git stash list` shows the other worktrees'
    stashes too. Pop by checking the top is yours.
* **For thread 7**: images now show in reviewers' texts, so a reviewer can make every smith who
  opens the Reviews panel fetch an image of their choosing (no referrer, lazily, but by the viewer's
  address). Thread 7 decides whether reviewers' texts keep images. In TODO.
* **For the Coach**: three newly reserved labels (`archived`, `secondary` for any widgeting;
  `questions` for a quiz-wide one). Check production for them before merging
  (`human/20261007-recap_followups.md`). No lint or type suppressions.
