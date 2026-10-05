# Thread 3: A hunt's files (2026-10-05)

Branch `20261005-hunt_files`, PR pending, stacked on #126. Suites: typecheck, lint, vitest (131
files, 3811 tests) green; e2e `panels` and `importing` green in lane 1 (30 tests); the full e2e
suite runs at landing.

* **Built**:
  - `src/lib/huntfiles.ts` (`Huntfiles`): `huntFiles(snapshot)` (every file, by path: the README,
    then each of `Exporting.ballsOf`'s balls as its JSON and its TSV); `filesOf(balls)` (any set
    of balls' files, made from them alone); `jsonOf`, `tsvOf` (one ball's bodies); `Readme`,
    `ReadmePath`, and `MergeCommand`, the `jq` line, built from `Addresses.MergedPathspec`.
  - `src/lib/tsv.ts` (`Tsv`): the one table writer. `textOf(records)` (sorted key-path header,
    rows by label, one line to a row), `recordsOf(keyed)` (a keyed collection as labelled rows),
    `cellOf(val)`.
  - `src/lib/exporting.ts`: a `PlacedBallT` now carries its `body` (what its table is made from);
    `quizBalls(place, realm, quiz, run, reviews)` is one quiz's balls alone (its own, its
    questions alone, each shared review), and `ballsOf` uses it; `placeOf` names the org with
    `orgFor` (`rows.ts`), as the URLs do.
  - `src/lib/addresses.ts`: `MergedPathspec = '*.tq?.json'`.
  - Tests: `tests/lib/tsv.test.ts`, `tests/lib/huntfiles.test.ts` (against the real git and
    jq: `git ls-files '*.tq?.json'` finds exactly the merged balls, not `questions.qq.json`;
    merging them, by `Jsonball.merged` and by the README's own `jq` line, is `wholeOf(snapshot)`;
    a question's edit dirties exactly the quiz's `.tqq.json`, `questions.qq.json`, and one line
    of `questions.qq.tsv`). The two-quiz snapshot fixture moved from `exporting.test.ts` to
    `tests/support/snapshots.ts` for both.
  - Docs: `notes/hunt_git.md` rewritten as built (status, shapes, rules, index, what is left
    out); `notes/decisions/urls.md` writes the realm `home` (Decision 1) and rule 10 with the
    pre-extension.

## Decisions taken

* **A TSV cell escapes rather than quotes**: `\t`, `\n`, `\r` and `\\`, nothing quoted, so one
  line is always one row and a diff shows one changed line per changed row; the text reads back
  exactly. Not Copy for Sheets' `pasteSafe` (`<br/>`, tab to space): that is lossy and made for
  pasting into a spreadsheet. Not Papa Parse's quoting (what the old `hunt_git.md` and today's
  `quizgit` use): a quoted field keeps its line breaks, so one row spans lines. A list, or an
  empty object, is a cell of compact JSON; null or a missing field, an empty cell. Sorting is
  by code unit.
* **Every table has a `label` column**, from the key for a collection's members, from the
  address for a single thing (the quiz's label, the widget's, the hunt's own).
* **What each table's rows are**: hunt, quiz, widget one row each; categories, members and the
  questions alone a row per member; the quiz's row leaves out its questions (they have their own
  table). **A review is a row per question it gave a verdict on**, its `overall` left to its
  JSON: the old spec's choice, and far more legible than one row of seven columns per question.
  The plan's gloss ("a single record is one row") would make it one row: a minor question below.
* **The README is the same for every hunt** (it names none), so it never changes and "written
  once" holds whoever writes it. Its table of paths is built with `Addresses.filepathOf` over
  placeholder labels, so it cannot drift from the files.
* **`placeOf` throws for a hunt with nobody on it** (`orgFor`'s contract) where it used to name
  an empty org. Nothing reaches it with no members: the screen's hunt always holds its viewer.

## Deviations

* `notes/hunt_git.md` said tables are "quoted by Papa Parse"; they escape instead (above), as the
  orchestrator's look-ahead asked ("escape, don't break rows").

## Discoveries

* **For thread 4/5**: every watch result maps to files without the rest of the hunt:
  `Huntfiles.filesOf([Exporting.huntBall(place, hunt)])`, likewise `categoriesBall`,
  `membersBall`, `widgetBall(widget, position)`, and for a quiz
  `filesOf(Exporting.quizBalls(place, realm, quiz, run, reviews))`. A widget's `position` is its
  place in the whole library, so a widget added to or removed from the library ahead of it
  rewrites the files of every widget after it: thread 4 should watch the library, not each
  widget.
* Which widgets are written depends on every quiz (`ballsOf` writes those any quiz works), so a
  widget's files come and go with the quizzes' widgetings, not with the widget itself.
* `git status --porcelain`'s lines begin with a space: `trim()` the whole output and the first
  path loses its first letter. Use `trimEnd()`.
* The quiz's one-row table is very wide (four columns per grid column, four or more per
  widgeting): 141 columns for the classic layout. That is the Coach's "even if that's
  silly"; the questions' table is the legible one.

## Review

Medium review, `fixed`: one commit added (`e53cb04`: `Tsv.textOf` escapes the header's column
names as it escapes cells, since a free-form key holding a tab or a line break split the header).
Minor findings left:

* **Dotted column names can collide**: `{ a: { b: 1 } }` and a literal `'a.b'` key both become
  column `a.b`, and the `.tsv` loses one value (the `.json` keeps both). Reachable only through
  free-form keys (a widgeting's value, a widget's config). A column-naming decision, left.
* The jq test fails rather than skips where jq is missing; its error names jq, and CI's ubuntu
  runners have it.
* **For thread 4**: a quiz's files also depend on the library and the wheel (through its `run`),
  so a change to either rewrites every quiz's `.tqq` files.

## For the Coach

*The orchestrator recommends keeping all three as built: a row per question for reviews, the
quiz's one-row table (the Coach asked that every TSV read the same way), and the escapes.*

* **A review's table: a row per question (as built), or one row** as the plan's gloss reads?
  One line in `Huntfiles.recordsOf` either way.
* The quiz's table is one very wide row. If it is not worth having, the quiz could write its
  JSON alone; every other resource keeps both.
* The TSV escapes (`\n` written as backslash-n) read oddly in a spreadsheet: the tables are for
  diffs, and Copy for Sheets remains the spreadsheet's export.
