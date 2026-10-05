# Thread 4: the feed, measured on a large hunt (2026-10-05)

What `watchHunt` costs, for anyone weighing `quizzes.whole` against a watch per question, or
planning when thread 5 commits. From `thread-4-watches.md`.

`TQ_MEASURE_FEED=1 pnpm vitest run tests/state/hunt-feed.test.ts` (about 4.5 minutes; writes
`data/measurements/hunt-feed.txt`). A hunt of 20 quizzes of 40 questions, classic layout (12
widgetings, 21 columns), every bot (3) answered for every question, 2 shared reviews of each quiz
with a verdict on every question; the feed focused on quiz 1. Bytes are each result's JSON, as
the stand-in counts it; the wire adds a little.

| What | Results sent | Bytes |
|---|---|---|
| Subscriptions held | 82 (44 the screen's own: hunt, library, the open quiz's frame, 40 questions and reviews) | |
| First full reading | 82 | 2,556 KB (`quizzes.whole` 19 / 1,669 KB; `reviews.forQuiz` 20 / 782 KB; `questions.open` 40 / 85 KB; hunt 7 KB; library 9 KB; frame 4 KB) |
| The author, 10 edits in the quiz on screen | 10 (`questions.open`) | 21 KB, all of it the screen's own anyway |
| Another smith, 10 edits in another quiz | 10 (`quizzes.whole`) | 878 KB |
| A bot answering 10 cells in another quiz | 10 (`quizzes.whole`) | 866 KB |
| The hunt retitled | 1 (`hunts.open`) | 7 KB |

* One question as `questions.open` sends it: 1.9 KB; one quiz as `quizzes.whole`: 86 KB.
* The repository's files: 190, 5.5 MB (the quiz's one-row table and its `.tqq.json` repeat the
  questions, as designed).
* Making one quiz's files (run, balls, JSON, tables): 38 ms on this machine; every quiz's, which
  a change to the library, the wheel, or the hunt's title or label asks (each is in the run's
  place): 760 ms.
* Read every quiz a watch per question instead, and the same hunt holds **842** subscriptions,
  a foreign edit sends 1.9 KB rather than 86 KB.
