# Thread 9: A change signal in place of live off-screen watches (2026-10-06)

Branch `20261006-change_signal`, PR pending, stacked on #140. Suites: typecheck, lint, vitest (142
files, 4091 passed, 1 skipped: the measurement) and e2e (259, lane 1) green.

Built by one worker and finished by a second, who found and fixed the e2e failure below.
Measured per smith tab on 20 quizzes x 40: 82 subscriptions become 45, and a 40-answer bot run in
another quiz sends 122 KB, not 3.4 MB. `thread-9-measured.md` has the table: read it before
changing the pace or the grain.

* **Built**:
  - **The signal** (server). `signals`, a new table: one row per quiz, `{ hunt_id, quiz_id,
    changed_at }` (`src/models/signal.ts`, `SignalValidators`, `SignalGrainMs` = 5 s), indexes
    `by_hunt_id`, `by_quiz_id`. `convex/signalling.ts`: a convex-helpers trigger on `quizzes`,
    `questions`, `widgetings`, `columns`, `widgeteds`, `reviews`, `reviewings` that moves the
    quiz's signal to `Date.now()` unless it moved within the grain, read once per mutation and
    quiz; a draft review's writes (and its verdicts') move nothing; a deleted quiz takes its signal
    with it. `convex/triggers.ts` now holds the one `Triggers` (stamps, then signals);
    `stamping.ts` exports its trigger. RLS rule `signals: read isOfHunt, never written` (the
    trigger writes beneath it). `quizzes.signals` (`zHuntQuery`, `affirmExportHunt`): a smith's
    alone, `[]` for anyone else.
  - **The fetching** (browser). `src/state/hunt-fetching.ts`: pure `seenNow`, `isStale`, `dueAt`,
    and `huntFetching`, which the feed holds. `hunt-feed.ts`: the quiz on screen stays `live` (the
    screen's frame, questions and now its `reviews.forQuiz` inside the live source); every other
    quiz is `fetched` (`quizzes.whole` + `reviews.forQuiz` by `client.query`). `WatcherT` gains
    `query`; `FeedSetupT` takes an optional `clock` and `pace`. `HuntReadingT`, `first`, `unread`,
    identity of unchanged parts, the stuck-quiz guard and the catch-up are as before.
  - Tests: `tests/convex/signalling.test.ts` (each table, the grain, drafts, deletion, who is
    answered), `tests/models/signal.test.ts`, `tests/state/hunt-fetching.test.ts` (the pacing, with
    a test clock), `tests/state/hunt-feed.test.ts` reworked (subscriptions, fetches,
    `whenRead`, focus handover, a 40-answer bot run). `tests/support/watching.ts`: the stand-in
    fetches, and `settle` counts fetches (`sent.fetched`) and waits for them; `addAll`, `noneSent`.
    `tests/support/clocks.ts`: `testClock()` over faked `Date`.
  - `testing:clearAll` (`convex/testing.ts`) clears table by table, a batch of 500 rows a run in
    all: side by side, it read a quiz's signal and then found it taken away by the quiz's deletion,
    and the e2e web server could not start; and every delete's triggers now read, so a batch per
    table passed Convex's 4,096 reads.
  - Docs: `notes/hunt_git.md` (*Watching and committing, by file*), `notes/convex.md` (*Change
    signals*), `notes/queries_hooks_and_subscriptions.md` (the feed, and the pattern),
    `notes/vocabulary.md` (**change signal**), the ESLint rule's message.
* **Decisions taken**:
  - **The pace** (`Pace`): `fetchEveryMs` 90 s (the Coach's "a minute or two"); `settleMs` 8 s
    (the 5 s grain plus 3 s for a write in flight); `clockSlackMs` 10 min.
  - **The grain lives on the server, the settling on the client.** A write within the grain of the
    last move is unsignalled, so a fetch holds everything a signal stands for only if it begins
    `settleMs` after the browser *saw* the signal move. Measured on this browser's clock alone, so
    clock skew does not enter, except for a signal heard the first time: dated by its own time,
    allowing 10 min of skew. A quiz touched within that window is fetched once more after it
    settles; a browser whose clock runs over 10 min fast could miss the last seconds of a burst
    at load until the quiz is next written.
  - **First fetch at once** (once the signals are heard); then at the later of "settled" and "a
    window after the last try", but no later than a window after the signal first moved, so a quiz
    written without pause is still fetched once a window.
  - **Hidden tabs fetch nothing**; shown again (`visibilitychange`), what moved is fetched at once.
  - **`whenRead`** (milestone, import, deletion) fetches every quiz whose signal moved, at once, and
    any listed while it waits; once each, so it never chases a signal still settling.
  - **Leaving a quiz on screen** hands its live reading to the fetched source as read now: no
    fetch until its signal moves.
  - **Reviews ride with the quiz's fetch** rather than keep a watch: one signal covers both. It
    costs bytes (a fetch carries the reviews, 39 KB on the large hunt, even when only a question
    changed); splitting the signal would save that.
  - **No backfill.** A quiz with no signal reads as never moved; every quiz is fetched once at a
    tab's first reading anyway, and its first write makes its row.
* **Deviations**: none of substance. `stamping.ts` no longer exports `triggers`
  (`convex/triggers.ts` does).
* **Discoveries**:
  - `/convex-reviewer` (named by the first worker and again by the second): no critical or
    important findings. Fixed: a mutation
    writing many rows of one quiz (an import, a deletion) read the signal at each row; now once
    per mutation (`settledIn`). Noted: `.first()` not `.unique()` on `by_quiz_id`, so a duplicate
    could never fail a write (OCC makes one unlikely); `Date.now()` only in the trigger (a
    mutation); reads bounded (`QuizzesPerRealm.max`, one realm per hunt); two indexes on an empty
    table need no `staged`; a reviewing's write reads its review (one `get`) to tell a draft.
  - **Contention.** Every write to a quiz reads its signal, so a write that moves it conflicts with
    writes to that quiz in flight beside it, which Convex retries and which then find it moved.
    At most once a grain per quiz; writes to different quizzes never meet.
  - The measurement's last assertion (a second feed's files equal the first's) failed once on the
    old code: one bot cell read `errored` in one feed, `missing` in the other. Not this thread's;
    it passed on the new code.
  - **What the signal does not see**: `reviews.forQuiz` reads each reviewer's ident, so a
    reviewer retitled or relabelled reaches an off-screen quiz's review files only at that quiz's
    next signal or a tab's first reading (a live watch reran at once). Rare and harmless; a trigger
    on `idents` moving every quiz the ident reviewed would close it.
  - A raw delete of a `signals` row beside a quiz's deletion (as `clearAll` did, side by side)
    can find it gone: the quiz's trigger takes it. Nothing but the trigger should write the table.
  - Browser APIs: only `setTimeout`, `document.visibilityState` and `visibilitychange` (both
    universal), and `requestIdleCallback` as before (with its fallback; Safari lacks it). Worth a
    WebKit look: that a backgrounded Safari tab fires `visibilitychange` on return.
* **For the Coach**: nothing to run on production but the deploy (a new, empty table). History
  in other smiths' tabs now lags a quiz's edits by up to about 90 s, as agreed.
