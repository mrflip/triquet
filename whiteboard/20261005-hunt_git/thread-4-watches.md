# Thread 4: Watches at the grain of the files (2026-10-05)

Branch `20261005-watches`, PR pending. Suites: typecheck, lint, vitest (132 files, 3867 tests, 1
skipped: the measurement, below) green; e2e untouched by this thread (nothing on screen changed,
and nothing calls the feed yet), run at landing.

* **Built**:
  - `quizzes.whole` (`convex/quizzes.ts`): one quiz whole, for a smith (`Approve.mayExportHunt`),
    exactly as the export holds it: the quiz's `.tqq` file in one result. Null on any denial,
    a reviewer included. `affirmExportHunt` (`convex/authorize.ts`) now takes a quiz's affirms
    too, handing on the quiz row. `convex/reading.ts`: `quizRowsFor(db, quiz)` and
    `wholeQuizOf(db, quiz)`, for a quiz row already in hand; `wholeHuntOf` reads each quiz
    through them (one read fewer per quiz). No change to `convex/_generated/` (a new function in
    an existing module regenerates nothing).
  - `src/state/hunt-feed.ts`: **`watchHunt(client, { hunt_label, affirms, focus }, onReading)`**,
    the feed, and **`useHuntFeed(hunt_label, huntAffirms, open_quiz_id, onReading)`**, the hook
    around it (smiths only; nothing for anyone else). Pure parts, exported and tested:
    `huntPartOf`, `quizPartOf`, `widgetsPartOf`.
  - `src/lib/exporting.ts`: `ballsOf` split into its parts, `huntLevelBalls`, `quizBallsIn`
    (runs the quiz where it sits) and `workedBalls`. `reviewBall` writes a reviewing's verdict
    fields alone (`Jsonball.VerdictFieldnames`), so a review as `reviews.forQuiz` reads it (ids,
    `peeked`) goes in as read; before, its spread would have written them.
  - `src/lib/huntfiles.ts`: `changesBetween(ante, post)` (`{ written, removed }`, path order)
    and `isSameFiles`. `Tsv.byCode` exported for the path order.
  - `tests/support/watching.ts`: `standInFor(session)`, a stand-in for the Convex client's
    watches over convex-test: shares a subscription between watches of one query and arguments,
    and `settle()` reruns every subscribed query, tells the watches whose result changed, and
    counts what the server would have sent. The feed is tested through it against the real
    query functions (`tests/state/hunt-feed.test.ts`), under the `unit` project (node):
    convex-test runs there fine.
  - Docs: `notes/hunt_git.md`, *Watching and committing, by file*, as built (a table of the
    watches); `notes/queries_hooks_and_subscriptions.md`, the feed as the second exception to
    "one screen hook".

## What thread 5 is handed

* `useHuntFeed(labels.hunt, huntAffirms, quiz_id, onReading)` in `useHunt`, in place of
  `useHistoryFeed` (same guard: `Question.isSentWhole`). `onReading` may change from render to
  render; the latest is called. Changing `open_quiz_id` moves the feed's watches (`focus`),
  without a new reading and without reopening the hunt.
* A **`HuntReadingT`**: `hunt` (the `ShallowHuntT`: `_id` keys the repository, `branch` the
  commits), `parts` (`'hunt'`, each quiz by `_id` with its `QuizT` and realm label, `'widgets'`),
  `files` (every part's together: every file but `README.md`), and `first`.
* **`first: true` is the first full reading** (every listed quiz read whole): the catch-up
  commit's input. Nothing is handed on before it. After it, a reading comes only when some file's
  body changed; a part unchanged is the very same object as in the last reading, so
  `prev.parts.get(key) !== next.parts.get(key)` says which quiz moved, and
  `Changes.quizChanges(prevPart.quiz, nextPart.quiz)` what for the message.
  `Huntfiles.changesBetween(prev.files, next.files)` says what to write and remove.
* A quiz newly listed joins once read (its files are neither written nor removed before); a
  quiz whose watch is changing hands, or answers null while still listed (a denial), stands as
  last read. **Only the quiz list removes a quiz's files.** Nothing is handed on while
  `hunts.open` shows no hunt or a standing not sent whole (deleted, relabelled, demoted): a
  relabel remounts the hook on the new label, whose `first` reading the catch-up handles.

## Measured

On a hunt of 20 quizzes of 40 questions: **82 subscriptions** (44 the screen's own), 2.6 MB for
the first full reading; an author's edit on screen sends one 1.9 KB question (the screen's own),
another smith's edit elsewhere one 86 KB quiz; making one quiz's files takes 38 ms, every quiz's
760 ms. The whole table, and how to rerun it, is in `thread-4-measured.md`: read it before
moving a watch's grain, or deciding when thread 5 works out its readings.

## Decisions taken

* **A quiz not on screen is one watch, `quizzes.whole`, not a frame and a watch per question.**
  The earlier draft of the plan asked for "the questions whole in one result"; the file is the
  quiz whole, so the frame rides in the same result (a frame edit on a quiz nobody here has
  open is rare). It is the export's own read (`wholeQuizOf`), so the files the feed writes are
  the export's by construction, and the defining test holds the feed's first reading equal to
  `huntFiles` of the rows.
* **The quiz on screen is read as the screen reads it** (frame and per-question watches, the
  same arguments), so it costs no subscription of its own, and an author's edit is sent once,
  as one question, not as an 86 KB quiz. This is `useHistoryFeed`'s machinery, kept.
* **Reviews reuse `reviews.forQuiz`** (shared with the screen for the quiz on screen). For a smith
  it sends the shared reviews and their own (a draft goes only to its author, never anyone
  else); `reviewBall` writes the shared ones. No new review query.
* **The library is watched whole** (`widgets.library`), as thread 3 asked, and the hunt through
  `hunts.open`, both the screen's own.
* **Smiths only, in two places**: the hook runs only for a standing sent every question whole,
  and `quizzes.whole` answers null to anyone else (the export's policy, `mayExportHunt`).
* A reading is handed on **once per moment**: the client tells each watch in turn, synchronously,
  so the feed gathers them on a microtask and reads once.
* **A failing watch** is reported (`Postmortem`) once per failure and read as not arrived, so one
  broken quiz holds its files as last read rather than stopping the feed. Before the first full
  reading, it holds the first reading back.
* The feed's tests use convex-test under the `unit` project, not `tests/convex/`, since what is
  tested is `src/state/`: the stand-in is the browser's client, the query functions are real.

## Deviations

* The gloss named `src/state/use-hunt.ts` and `quiz-mirror.ts`: neither is touched. The feed is
  a module of its own and nothing calls it yet, as the handoff asked ("don't wire it to git").
* `notes/hunt_git.md` said "one query function for the hunt-level files … one per quiz for its
  frame, its questions, and its shared reviews": as built, see *Decisions taken*.

## Discoveries

* **Retitling or relabelling the hunt, rearranging the wheel, or any library change makes every
  quiz's files again**: the run's place holds the hunt's label and title and the wheel's order.
  760 ms of main-thread work on the large hunt, once per such change. Thread 5 may want the
  reading (or the commit) put off to idle time; the feed itself does it inline.
* An edit in the quiz on screen remakes that quiz's files: 38 ms on a 40-question quiz, beside
  the screen's own run of the same quiz.
* `localQueryResult()` on the React client is the stored result (same object until it changes),
  so identity memos hold across readings; the stand-in mimics this.
* Raw Export still carries no reviews (thread 2's note). `reviews.forQuiz` per quiz is how the
  feed reads them; the export could read them the same way if wanted.

## For the Coach

* **Minor, open:** `quizzes.whole` trades subscriptions for bytes. On the large hunt: 82
  subscriptions, and 86 KB to every other smith's open tab for each edit (or bot cell) in a quiz
  they do not have on screen; a watch per question for every quiz would be 842 subscriptions
  and 1.9 KB an edit. A bot run over a 40-question column of a quiz someone else has open is
  about 3.4 MB to each such tab, against 80 KB. Built as the plan's draft had it; switching is
  one line in `watchHunt`'s `follow` (read every quiz `live`), should the bytes matter more
  than the subscriptions.
* `/convex-reviewer` (applied by hand to the diff): no critical or important findings.
  Suggestion: `quizzes.whole` reads one quiz in one transaction (its questions, and a range of
  stored cells per question and stored widgeting), as the export already does for every quiz at
  once; a quiz at the caps (999 questions, 99 widgetings) would pass Convex's read limits in
  both. Pre-existing for the export, and far from today's quizzes.
