# Thread 2: Jsonballs, and Import and Export through them (2026-10-05)

Branch `20261005-jsonballs`, PR pending. Suites: typecheck, lint, vitest (129 files, 3742 tests)
green; e2e `panels`, `entries`, `importing` green in lane 2 (34 tests); the full e2e suite runs at
landing.

* **Built**:
  - `src/lib/jsonball.ts` (`Jsonball`) owns the shapes: a body type per resource
    (`HuntBodyT`, `CategoryBodyT`, `MemberBodyT`, `QuizBodyT` with `QuestionBodyT`,
    `WidgetingBodyT`, `ColumnBodyT`, `ReviewBodyT` with `VerdictBodyT`, `WidgetBodyT`);
    `ballAt(keypath, body)`; `merged(balls)` (es-toolkit's `merge`, inputs untouched);
    `keyedOf` (a list to a keyed collection with `position`) and `listedOf` (back, by
    `position`, the key as `label`); `PastedValidators` and `quizzesIn` / `widgetsIn`, which read
    anything pasted.
  - `src/lib/exporting.ts` (`Exporting`), rebuilt: `huntBall`, `categoriesBall`, `membersBall`,
    `quizBall` (and `quizBodyOf`), `questionsBall`, `reviewBall`, `widgetBall`, each returning a
    `PlacedBallT` (`{ address, ball }`, the ball built at `Addresses.keypathOf(address)`);
    `libraryBall`; and for a whole hunt `HuntSnapshotT`, `ballsOf(snapshot)` (every ball, the
    questions alone included), `wholeOf(snapshot)` (every merged ball, merged: Raw Export),
    `snapshotOf(shallowHunt, whole, library)` and `placeOf(snapshot)` (org and hunt).
    `huntExported`, `quizExported`, `libraryExported` are gone.
  - `src/lib/importing.ts` reads through `Jsonball.quizzesIn` / `widgetsIn`; the shape validators
    left `src/models/import.ts` for `Jsonball.PastedValidators`. `WidgetValidators.library` is
    gone (the old library shape, unused but in its own test).
  - Raw Export (`RawExport.tsx`, now handed the screen's hunt for its wheel and members) emits
    `wholeOf`; the Library tab emits `libraryBall`; the per-quiz history's `.tq.json` is now
    `quizBodyOf`. Panel blurbs say what each box takes.
  - `fixtures/exports/`: every older shape, with a README; `tests/lib/importing.test.ts`,
    *older exports*, proves each still imports.
  - Tests: `tests/lib/jsonball.test.ts`, `tests/lib/exporting.test.ts` (rewritten), and in
    `tests/convex/hunts.test.ts` *a quiz's export, imported into an empty quiz*: the defining
    round trip through the real server functions.
  - `notes/vocabulary.md`: **jsonball**.

## The shapes

```jsonc
{ "label": "spring_hunt", "title": "…", "branch": "main",                  // hunt.tqh.json
  "categories": { "tv": { "position": null }, "art": { "position": 8 } },  // every category; null is the pool
  "members": { "pat_smith": { "title": "Pat", "role": "smith" } },
  "quizzes": { "home": { "legends": {                                      // quizzes/home/legends.tqq.json
    "title": "…", "smiths_note": "…", "q1_preamble": "…", "locked": false,
    "questions":  { "leon": { "position": 0, "qnum": "1", "clueing": "…", "chains_to": "nantes", …,
                              "dumdum": { "status": "ok", "value": … } } },
    "widgetings": { "dumdum": { "position": 0, "widget_label": "dumdum", "description": "", "params": {} } },
    "columns":    { "title":  { "position": 0, "title": "Title", "source": "question.title", "width_px": 100 } },
    "reviews":    { "lee_jones": { "overall": "…", "verdicts": { "leon": { "get_rate": 40, … } } } } } } },
  "widgets": { "pub": { "dumdum": { "position": 1, "formulary": "aibot", … } } } }
```

The questions alone: `{ "questions": { …as in the quiz's ball… } }`.

## Decisions taken

* **Keys are labels, and a body carries no `label` of its own**: the key is the label, so the two
  can never disagree. The hunt's own `label` is the exception (its key path is the root).
* **The questions alone are `{ questions: { <label>: … } }`**, the quiz's `questions` value
  rooted at the quiz: no array (urls.md), it names no quiz so it pastes into any, and the Import
  box reads it as one quiz. A hand-trimmed `{ questions: { leon: { clueing: "x" } } }` imports.
* **Realms are not written** (thread 0's open point): every hunt holds only `home`, so no
  `realms` kind was added to `Addresses`, and a realm's title is not in any ball.
* **`isMerged` stays as it was; its doc block now says** a widget's ball merges into the hunt's
  (the widgets it works, `widgets.pub.*` beside `quizzes`) and into the library.
* **Raw Export now carries categories, members and the widgets the hunt's quizzes work**: it is
  the merge of the hunt's balls, as the repository will be. It carries no reviews: `hunts.whole`
  reads none, and a query for them is thread 4's.
* **Left out of every ball**: ids, `last_sortkey`, a reviewing's `peeked`, draft reviews and
  reviews whose reviewer is gone. A review's `phase` is left out too: only shared ones are written.
* **Every category is written**, with `position: null` for one in the pool, so the TSV is 24 rows.
* **`position` is reserved as a widgeting label** (`Jsonball.PositionField`), since a question's
  widgeteds sit beside its fields.
* **The org is `orgOf(members) ?? ''`** in `Exporting.placeOf`: no key path or file hangs on it.
* **An export's quiz is chosen as before** (label, then title, then first); summaries now say
  "Read as a hunt of N quiz(zes)" for any shape holding quizzes by realm.
* **Workspace exports import again** (`{ quizzes: [...] }`, dropped on 2026-09-28): their chains
  named ids, now resolved to the target's label, or none.

## Deviations

* The import still ignores a pasted quiz's columns, title, smith's note, preamble and lock, as it
  always has ("how someone else was working"). So the defining test reproduces a quiz's questions
  (order, fields, chains, what each widgeting came to, entries) and its widgetings, not its columns.

## Discoveries

* For thread 3: `Exporting.ballsOf(snapshot)` is `huntFiles` less the writing: each
  `PlacedBallT`'s address gives `Addresses.filepathOf`, the ball is the JSON. A TSV falls out of
  each ball's leaf: a keyed collection is a row per key (`label` column from the key), a single
  record one row with keypath columns. `notes/hunt_git.md`'s index still shows arrays and
  `realm.tq.json`; *The shapes* above is what is built.
* For thread 4: `HuntSnapshotT` (and `ReviewSourceT`, `MemberSourceT`) is what the balls are
  made from; a review's verdicts need the quiz's question ids to name questions by label.
* The old Raw Export ran each quiz against the default wheel (`Runner.placeOf` without one);
  `ballsOf` runs it against the hunt's own.
* The per-quiz history (`quizgit`) writes the new body, so each quiz's next commit rewrites its
  `.tq.json` once. Thread 5 retires it anyway.

## Review

Medium review, one commit added (`e0b9f45`: a fixture for the 2026-09-27 hunt-with-ids export,
proving its id chains import by label).

* **Significant, decided by the Coach: keep the `position` reservation.** It sits on
  `WidgetingValidators.row`, and `updateWidgeting` re-validates the whole row, so in a quiz
  already holding a widgeting labelled `position`, editing it, or removing or moving any other
  widgeting so its position shifts, is refused; Raw Export would overwrite its value with the
  question's position; a re-import would type the index into a number entry's cells. The Coach
  will read production's widgetings for a label of `position` (and `forced_label`, `id`) and
  relabel any hits **before the PR merges**.
* **Minor, left:** a widgeting labelled `forced_label` makes a re-import refuse every question
  (widgeteds sit beside question fields). Pre-existing, not a regression.

## For the Coach

* **Merge only after the production check** of widgetings labelled `position` comes back empty,
  or its hits are relabelled (*Review*, above).
* Should Raw Export also be offered for one quiz alone, to someone who may not export the hunt?
  `Exporting.quizBall` exists; the panel offers only the hunt, as before.
* Should Import also carry a pasted quiz's columns (and title, note)? It never has.
