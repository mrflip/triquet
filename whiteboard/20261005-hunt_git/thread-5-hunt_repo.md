# Thread 5: One repository per hunt (2026-10-05)

Branch `20261005-hunt_repo`, PR pending, stacked on #128. Suites: typecheck, lint, vitest (132
files, 3840 tests, 1 skipped: thread 4's measurement) and the full e2e suite (248) green in lane 1.

* **Built** (`notes/hunt_git.md`, *Watching and committing, by file*, has it as built):
  - `src/lib/huntgit.ts` (`Huntgit`), replacing `quizgit.ts`: the repository at `/hunts/<hunt
    _id>` on the hunt's branch. `commitFiles` and `commitWhole` (the latter keeping the paths
    `keep` holds, and writing the README with the first commit only) commit only what differs
    from the tip's blobs (`git.hashBlob`), nothing when it holds them; `markTip`, `tagFor`,
    `hasHistory`, `zipHuntRepo`; the `/quizzes` readers for thread 6.
  - `src/state/hunt-mirror.ts` (`HuntMirror`), replacing `quiz-mirror.ts`: `noteReading`,
    `trackWrite`, `flushPending`, `milestone`, `markedChange`, `downloadHuntRepo`.
  - `src/state/hunt-commits.ts`: `commitReading` (dirty files, or the hunt whole), `messageFor`
    and `summaryLines` (`~hunt ~members`, `legends: quiz ~title, leon +clueing, reviews ~lee_jones`,
    `+legends`, `-legends`, `legends: caught up`, `widgets ~dumdum`).
  - `src/state/commit-scheduler.ts`, keyed by hunt, holding each hunt's baseline and latest
    reading.
  - `src/state/hunt-feed.ts`: `HuntReadingT.unread` and the guard; idle readings, `settleFeeds`,
    `feedsRead`; one feed kept per hunt (`KeepMs`). `Huntfiles.isQuizFile`.
  - Wiring: `useHunt` runs `useHuntFeed(…, HuntMirror.noteReading)` in place of `useHistoryFeed`;
    Workbench's import and question deletion, and the gear's milestone, go to the hunt's repository.
  - Removed: `quizgit.ts`, `quiz-mirror.ts`, `exposure.ts` (only the per-quiz `.qq.tsv` used it),
    their tests, and `papaparse`.
  - Tests: `tests/lib/huntgit.test.ts`, `tests/state/hunt-commits.test.ts` (both against the real
    git CLI), `commit-scheduler.test.ts` (rewritten for hunts), `hunt-feed.test.ts` (the guard,
    idle readings, `whenRead`); `tests/support/gitfs.ts`, and `tests/support/readings.ts`
    (`readingOf(snapshot, { first, unread })`). e2e `quiz-history.spec.ts` downloads the hunt's
    zip and asks the real git about it.
  - Docs: `notes/hunt_git.md` (status, tags, *Watching and committing* as built),
    `notes/vocabulary.md` (*mirror*), `notes/stack.md`, `notes/queries_hooks_and_subscriptions.md`.

## Decisions taken

* **Tags**: `<branch>_<quiz>_<mark>_<stamp>z`, e.g. `main_legends_m_20261005120000z`; marks
  `m`, `import`, `delete`; a clash in one second takes `_2`. Branch first so a branch's tags list
  together, the quiz next so its milestones are told apart within the hunt. Follows the label
  regex, but can run past a label's 40 characters (branch and quiz both long), and cannot be
  parsed back into branch and quiz (both may hold `_`): a name, not a key.
* **The stuck-quiz guard is in the feed and the commit, both.** The feed's first reading waits
  for every listed quiz to *answer*: read whole, or found unreadable (a watch failed, or the quiz
  answered null while listed). An unreadable quiz goes in `reading.unread` (realm and label, by
  id), with no part and no files. A whole commit keeps every tip path of an unread quiz
  (`Huntfiles.isQuizFile`), so it is never removed by a catch-up; the message names no removal;
  when it can be read it joins as `legends: caught up`. A quiz still loading (no answer, no
  failure) is waited for, as before: that is a slow network, not a stuck quiz.
* **760 ms off the edit's path: idle readings.** The feed makes its readings in
  `requestIdleCallback` (2 s timeout; `setTimeout(0)` where there is none, as in Safari and node),
  so the screen renders the change before the feed works out the files. Git work stays async
  behind the scheduler's debounce. Readings coalesce while one is pending.
* **One feed per hunt, kept across screens** (`KeepMs` = 10 s after the last screen lets go).
  Next remounts the quiz page on every move between quizzes, so without it every quiz switch
  restarted the feed: a full re-read of the hunt (2.6 MB on the large one) and a first reading
  whose catch-up mislabelled a new or deleted quiz as `catch up`. Thread 4's `focus` now does
  what it was built for.
* **A tab's first reading is the catch-up, written whole, at once** (not after the wait). Its
  message: `start: the hunt as this browser first read it` (no history yet), `catch up: changes
  made while this browser was away`, or, when this tab read the hunt before (its feed was let go
  and started again), the summary of what moved since that reading.
* **Milestone, import and deletion wait to have heard everything** (`feedsRead`, 5 s at most,
  `ReadWaitMs`) before the commit they tag: an import's new questions arrive on watches opened as
  the import lands, so flushing at once tagged a commit without them (as `useHistoryFeed` also
  did; the old e2e checked only that a tag existed). The commit *before* an import or deletion
  only settles (no waiting), so the change itself is never held up by the mirror.
* **A branch switch** commits what was waiting to the old branch, then the hunt whole to the
  new one (`catch up: the hunt as it stands, on taking up branch draft_two`). Checking out a
  branch seen before is forced: the working tree is always rewritten from the hunt.

## Deviations

* **Pulled forward from thread 6**: the gear's *Download as git* and the Full History tab's
  download give the hunt's repository, named for the hunt; two e2e tests of the per-quiz
  repository lists are gone. What is done and what is left for thread 6, with the helpers it can
  use: **`thread-5-for-thread-6.md`**, beside this file. Read it before touching the downloads,
  the hunts page's folded list, or `QuizNotFound`.

## Discoveries

* **isomorphic-git ends every message with a newline**: compare `%s`, not `%B`.
* A review's jsonball names its quiz in its key path, so relabelling a quiz rewrites its review
  files' bodies too; the message compares a moved file's piece at its key path, so a relabel
  reads `royals: quiz ~label`, not `reviews ~lee_jones`.
* **Next remounts the quiz page per quiz** (no hunt-level layout). Anything per hunt that should
  survive a quiz switch needs keeping outside React (as the feed now is) or a layout under
  `[org]/[hunt]`. The hunt's own page runs no feed, so a branch switched there is committed when
  a quiz screen next reads the hunt.
* The first reading of a large hunt still works out every quiz's files (≈760 ms) in one idle
  callback at page load. If it bites, split the first reading's quizzes across idle callbacks.
* An interrupted commit (a tab closed mid-write) can leave the index holding files the tip does
  not; the next commit would carry them. Rare, and they are the hunt's own files from moments
  before; left as is.

## For the Coach

* The tag scheme (above): names a quiz, runs long, cannot be parsed back. The alternative that
  keeps tags short is `<quiz>_<mark>_<stamp>z` without the branch, at the cost of today's "a
  milestone names the branch it marks".
* `papaparse` is uninstalled (nothing used it once the per-quiz `.qq.tsv` went); `notes/stack.md`
  keeps it as the choice for spreadsheet TSV/CSV.
