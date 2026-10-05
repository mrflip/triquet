# Sprint `little_fixes`: progress

The running handoff. Newer than `little_fixes-plan.md` wherever they disagree. Workers append
their sections below the table, newest first.

## Status

| Thread | Name                         | Branch | PR | Status  |
| ------ | ---------------------------- | ------ | -- | ------- |
| 1      | the ident gate               | `20261005-ident_gate` | #96 | merged via #99 |
| 2      | the hunts page lines up      | `20261005-hunts_aligned` | #99 | merged by the Coach; reviewed late (clean) |
| 1b     | the ident gate, follow-up    | `20261005-ident_gate_again` | #105 | complete |
| 3      | quiz mode: grid and widgets  | `20261005-quiz_grid_tidy` | #108 | complete |

## Thread 3: quiz mode -- the grid and the widgets panel (2026-10-05)

Branch `20261005-quiz_grid_tidy`, PR #108, stacked on #105. Suites: typecheck and lint clean;
`pnpm test` 124 files, 3485 tests; `pnpm test:e2e` 228 passed. The two panel specs added after
that run went into the widgets commit, and `panels.spec.ts` alone passed 23.

* **Built**:
  - *Values typeset by type* (`workbench.module.css`, `cells/fields.tsx`, `cells/chain.tsx`,
    `JsonFold.tsx`). String values are in the page face: Title, labelish and titleish entries,
    the chain picker, BUT NOT, formula strings and asked cells. Numbers use `tabular-nums` and
    sit right-aligned (`.sum`, and `.fieldNumber`, renamed from `.fieldQnum`, for Q# and number
    entries). Only JSON is monospace: `.json`, worn by `JsonText` itself. `.fieldData` is gone.
  - *One inset* for every box in a cell: 4px/5px padding plus a 1px border, now on
    `.readonlyCell` too. The label under a title gets the same inset (`.fieldNote`), and so do
    the headers (`.head` padding is `cell-pad + 6px`). The grid sets `line-height: 20px`.
  - *Folded rows are one line*: `FoldedRowPx` is 30, which is 20 plus 5 above and below.
    `.rowFolded` clamps each box's children to one line with an ellipsis. It hides every
    `.metaline` (the title's label, an asked cell's tier line) and drops `.askable`'s 44px
    minimum. `select.field` is held to 30px (it was 31, and that made folded rows 44 tall).
    `input.field` ellipsizes. `ButnotPreview` wraps its text in a div so the clamp reaches it.
  - *Corner* (`QuestionTable.tsx`, `.headCorner`): the cell has `height: 1px` so its stack can
    take the whole row's height. The fold sits at the top, batch select and select-all at the foot.
  - *Widgets panel* (`panels/WidgetsPanel.tsx`): each summary is a row of fixed-width boxes
    (`WidthFor`): label 190, widget 190, status 230, then the description snippet, flexible and
    ellipsized. The snippet uses the widgeting's description, or else the widget's, and is
    `visibility: hidden` while the row is open. A container query on the list (`RoomFor`) shows
    the description from 900, the widget from 720, the status from 520; the label always shows.
    `StatusSentence` colours the errored phrase `error.main`.
  - `statusLine`, `statusPhrases`, `StatusWords`, `NoCellsLine`, `StatusJoint` in
    `widget-words.ts`, with tests. `hiddenUntil` moved to `src/components/room.ts`, shared with
    `ColumnsEditor`.
  - e2e: new specs in `chaining.spec.ts` (a folded row is one line), `grid.spec.ts` (the
    corner) and `panels.spec.ts` (narrowing; the snippet giving way). The counts' text and the
    30px fold height are updated.
* **Decisions taken**:
  - **No column has a "type"**: a jsonata widget declares none. So a readout is typeset by its
    value (number, text, or list/object as JSON), and an entry by its `entry_kind`.
  - **Numbers right-aligned, Q# included**, for one rule. Q# now sits right under a left "Q#"
    header (open question in the PR).
  - **Status words**: `ok` is *current* and `missing` is *blank*, on screen only. Neither clashes
    with an existing widget meaning: *current* is used elsewhere only for "current ident", and
    *blank* is already the everyday word for an empty field or pill. The vocabulary records it.
    *Stale* has no count, since staleness is off (`whiteboard/20261003-widgets_todo.md`).
    `StatusWords` says where it will slot in.
  - **"Hide the label" (bullet 5) means the widget it works** ("prompt numnum_clueing"). The
    widgeting's own label is the row's name and always stays.
  - **No questions** says "no questions yet" rather than an empty status.
* **Deviations**: the header inset and the ⚠-badge room (`.askWrap:has(> .errBadge)`) were not
  asked for. The first lines headers up with the text below them. The second came up because
  body-face text collided with the badge.
* **Style inventory** (what each look meant, and what became of it). Kept, because each signifies
  something:
  - `.muted`: blank dash, failure, notices.
  - `.metaline`: label, ask tier and tokens, retry hint.
  - `.askable:disabled` opacity: unaskable or locked.
  - `.gripLocked`, `ErrBadge`, the estimate pills' difficulty colours.
  - The red errored count, which moved from the Chip to the sentence.

  Restyled, because the look said only where a value came from: `.fieldData` (Title, chain),
  and the 12px monospace on `.sum`, `.expressedText`, `.readonlyCell` and `.askable`.
* **Discoveries**:
  - **`pnpm test:e2e` empties `test-results/`.** Scratch scripts kept there die with it, so keep
    them in the scratchpad and import Playwright by absolute path.
  - The agent backend now holds idents `grid_shooter_*`, with demo hunts built from
    `whiteboard/20261001-review/20261001-questions.json` for the screenshots.
  - A select ignores `line-height`; only an explicit height holds it to the grid's line.
* **For the Coach**: the Q# alignment, and the left-sitting blank dash in number columns
  (pre-existing: a formula column cannot know it holds numbers). Both are in the PR.

Screenshots (`screenshots/thread3-*-{before,after}.png`; read them to review the look):
`grid-folded-dark-1400`, `grid-folded-right-light-1400` (the widget columns), `grid-open-dark-1400`,
`grid-folded-light-900`, `widgets-light-1400` and `widgets-dark-1400` (one row open),
`widgets-light-640` and `widgets-light-420` (narrowing).

## Thread 1b: the ident gate, the Coach's follow-up (2026-10-05)

Branch `20261005-ident_gate_again`, PR #105, follows #99. Suites: typecheck and lint clean;
`pnpm test` 124 files, 3477 tests; `pnpm test:e2e:agent` 226 passed.

* **Built**:
  - `src/components/IdentGate.tsx`: on the switch path, typing the held ident's label turns the
    primary into "Keep being <Title> (@label)". It and Enter go to `onward` without calling
    the server, and the cancel button is hidden meanwhile.
  - A too-short label is said (red, `AppNotices.usernameLength`) only after the field has been
    left once (a `left` flag set on blur). A bad character is said at once
    (`AppNotices.usernameShape`). The button is disabled for either.
  - `Ident.flawIn(typed)` (`src/models/ident.ts`) returns `'shape' | 'length' | null`.
    `PA.Identtyped` (`src/lib/vv/patterns.ts`) is the typed-text pattern it tests, after
    `deburr`: letters, numbers, spaces, hyphens and underscores, starting with a letter.
  - Tests: 15 cases in `tests/models/ident.test.ts`. In `e2e/routing.spec.ts`, the too-short
    spec is rewritten, and the bad-character and own-name specs are new.
* **Decisions taken**:
  - **Where the split lives.** The label validator already distinguishes the two
    (zod issue codes), but never sees a bad character: `Ident.labelFor` repairs every one
    (`flip!` becomes `flip`, `1flip` becomes `z1flip`, an emoji is dropped). So the shape check
    runs on the typed text, as a pattern beside `Identlabel`. The length check stays the label
    validator's. The model change is about 15 lines.
  - **"Unacceptable" means** a character that `labelFor` would drop or substitute beyond
    case-folding and space/hyphen-to-underscore. That includes `.` and `'`, which used to pass
    silently (an open question in the PR).
  - **The cancel is hidden** while the primary says "Keep being", rather than showing two
    buttons that say the same thing.
  - **Nothing typed** is a `length` flaw, so it is never red, even after blur.
* **Discoveries**:
  - The worktree's `agent` backend held rows from before main's `q1_preamble` field. It was
    refused on push and emptied with `scripts/convex_reset agent`; it is shared with the main
    checkout through the symlink.
  - The worktree has no `data/convex-e2e` link, so the finishing e2e run used `pnpm test:e2e:agent`.
  - `MembersPanel`'s add-a-member field could use `Ident.flawIn` too; it was left alone.
* **For the Coach**: should apostrophes and dots turn red, or pass quietly as underscores? Either
  way it is a one-character change to `PA.Identtyped`.

Screenshots (`screenshots/`, `-before` and `-after`, light and dark at 1100px; read them to
review the look): `thread1b-short-typing-*` (`flip`, still focused), `thread1b-short-left-*`
(after blur), `thread1b-badchar-*` (`flip!`), `thread1b-switch-own-*` (own label on the
switch path).
* *Review:* `clean`, at medium, over `origin/main...HEAD`. It probed `Ident.flawIn` against
  `labelFor` with inputs the tests skip (combining accents, `İ`, `ß`, `Æø`, tabs, runs of `_`/`-`)
  and found them consistent. Minor, left: `AppNotices.usernameLength` says "6 letters and
  numbers" though underscores count (`abc de` passes) -- wording only; `MembersPanel` could use
  `Ident.flawIn` (out of scope, as the worker said).

## Thread 2: the hunts page lines up (2026-10-05)

*Orchestrator:* written by the orchestrator from the worker's report, by the Coach's leave: the
worker's own write of this section was refused (see *Incident*).

Branch `20261005-hunts_aligned`, PR #99, stacked on #96. Suites: typecheck and lint clean;
`pnpm test` 123 files, 3284 tests; `pnpm test:e2e` 221 passed.

* **Built**: `src/components/HuntsList.tsx` -- each hunt is a row of a small MUI `Table` (as
  `MembersPanel`'s): Hunt (row header), Your role, the gear, Categories, Quizzes; cells share a
  baseline. Quizzes flow and wrap in their cell, 24px apart (was 8px). Under 720px of table
  width the Quizzes column hides and each hunt's quizzes take a full-width line beneath it: a
  container query on `TableContainer` with a `RoomFor` constant, as `ColumnsEditor` does; both
  layouts render and CSS shows one. Each quiz link starts with 🤔 (unlocked, "Still being worked
  on") or 🔒 (locked), a `span role="img"` with that phrase as `aria-label` and `title`. The
  "You are" line shows `(@label)` and wraps when narrow; the title there is edited in place, so
  it takes the new `Ident.atLabel` (`src/models/ident.ts`) rather than `Ident.byline` whole, and
  `byline` now uses `atLabel` too. e2e: `routing.spec.ts` matches `(@label)` and finds hunts as
  `row`/`rowheader`; one new spec checks the sigils and that two hunts' Categories links line up.
* **Decisions taken**: a lock sigil (🔒) for locked quizzes alongside the asked-for 🤔, so every
  quiz carries one; the sigil sits inside the link; 720px as the fold point. The last two are
  taste calls the worker flags for the Coach.
* **Discoveries -- for thread 3**: reuse the container-query hiding, **not** the Table. A
  widgeting row is an Accordion that opens to formula boxes and a copy button, which do not
  belong in table cells. Keep the Accordion; line its summary up with fixed-width boxes, as
  `ColumnsEditor`'s rows do; hide fields with `containerType: 'inline-size'` on the list, a
  `RoomFor` constant, and `{ display: { '@': 'none', [RoomFor.x]: 'block' } }` (`ColumnsEditor`'s
  `hiddenUntil`). Three `sx` traps: a Table's `'& th, & td'` rule outranks a cell's own `sx`; a
  container-query value of `undefined` does not restore the base value, so give both; table
  cells are border-box, so `minWidth` includes padding.
* **Incident**: a session of the Coach's (`validation_tighten`) was editing uncommitted in the
  same checkout. Testing an e2e failure its edits caused, the worker ran `git checkout 7f4d46b --
  src e2e tests` and back, overwriting six of its files (`src/lib/vv/checks/numbers.ts`,
  `src/lib/vv/kit.ts`, `src/lib/vv/patterns.ts`, `src/models/question.ts`, and two tests). The
  Coach has been told and is recovering them. **The sprint now runs in its own worktree,
  `.claude/worktrees/little_fixes`**; the main checkout is the other session's. Every later
  worker: run `git status` before any checkout or restore that names paths.
* **For the Coach**: the 720px threshold and the sigil inside the link are taste calls. The agent
  backend (port 3401) holds an ident `hunt_shooter` with three demo hunts made for screenshots.

Screenshots: `screenshots/thread2-hunts-*-{before,after}.png` -- light-1100, dark-1100, light-700,
light-390, dark-390.
* *Review:* `clean`, at medium, run after the merge over `55dddac...a4c1165` (#99's commits on
  main), its comment on #105. Minor, left: under 720px a hunt with no quizzes gets an empty
  padded row beneath it (cosmetic; hide that row when there are none, if the Coach minds);
  `Ident.byline` calls `this.atLabel`, so it would break passed detached (`.map(Ident.byline)`)
  -- no caller does.

## Thread 1: the ident gate (2026-10-05)

Branch `20261005-ident_gate`, PR #96, stacked on #95 (and carrying the unmerged
`20261003-but_not_quiz` quiz commits and `20261005-little_fixes_start` plan commits beneath it).
Suites: typecheck and lint clean; `pnpm test` 123 files, 3283 tests; `pnpm test:e2e` 220 passed.

* **Built**: `src/components/IdentGate.tsx` -- the submit reads `Log in as <label>` (the label as
  `Ident.labelFor` will claim it, updating as typed) and is disabled until
  `IdentValidators.identLabel` takes it; then it rests as plain **"Log in"**. The field shows
  `AppNotices.identLabelShape` as an error once something is typed and does not fit; an empty
  field shows nothing. On the switch path, a text `Button` "Keep being <Title> (@<label>)" sits
  left of the primary (both right-aligned, `flexWrap` so a long title wraps the pair onto two
  lines), replacing the "You are ... now." microcopy. `Ident.byline(ident)` in
  `src/models/ident.ts` writes "Title (@label)", tested in `tests/models/ident.test.ts`.
* **Decisions taken**:
  - "Keep being" goes to `then ?? huntsPath()` -- the same `onward` the submit and the
    already-logged-in redirect use, now computed once. On every path the app makes, `/?switch`
    carries no `then`, so this is the hunts page; a hand-made `/?switch&then=...` would make both
    buttons leave for the same place, which is what a cancel beside a submit should do.
  - It is a `Button` with `router.replace`, not a link: role "button", as a cancel is, and
    `replace` like the submit, so Back from the hunts does not return to the gate.
  - The old "You will be “label”." helper text is gone: the button says it now. The helper rests
    as `' '` so the field does not jump when the error appears.
  - `AppNotices.identLabelNeeded` is no longer used by the gate (the button cannot be pressed
    empty); `MembersPanel` still uses it, so it stays.
* **Discoveries**: `@label` is **new to the app** -- nothing wrote an ident that way before. The
  hunts page still says "You are <title> (label)." and `notices.ts`'s `smithsNamed` writes
  "Flip (flip_kromer)". Thread 2 can use `Ident.byline` for the first if it wants idents shown
  the same way; the notices are prose and were left alone.
* **For the Coach**: two small open questions, also in the PR: logging in as the ident you
  already are is offered and is a no-op (could disable, or become "Keep being"); and the shape
  error shows from the first keystroke, as the plan asked, rather than on blur.
* *Review:* `fixed`, at medium. Kept 161ca84: "Keep being" is now `disabled={busy}` like the
  submit -- pressing it while a log-in was in flight sent you to the hunts as the old ident, and
  then the log-in landed anyway. No findings left; the two Coach questions above are questions,
  not findings.

Screenshots (`screenshots/`, each `-before` and `-after`; read them to review the look):
`thread1-login-short-dark-1100` (an invalid label), `thread1-login-typed-light-1100` (a valid
one), `thread1-switch-empty-light-1100`, `thread1-switch-typed-dark-1100`,
`thread1-switch-typed-light-390` (the switch path, wide and narrow).
