# Thread 9: the feed, measured on a large hunt, before and after the change signal (2026-10-06)

For anyone weighing what a smith's tab costs Convex on a hunt it is not looking at all of, or
tuning `Pace` (`src/state/hunt-fetching.ts`). From `thread-9-change_signal.md`; the method and the
"before" are `thread-4-measured.md`'s.

`TQ_MEASURE_FEED=1 pnpm vitest run tests/state/hunt-feed.test.ts` (as in `thread-4-measured.md`);
20 quizzes x 40 questions, focused on quiz 1, per smith tab. "Before" is this branch's start with
the bot burst made 40 answers; "after" drives the edits on a test clock (other smith 20 s apart,
bot 1 s apart), then waits out a window. Function calls are results sent (a rerun whose result
did not change is not counted by the stand-in).

| What | Before | After |
|---|---|---|
| Subscriptions | 82 | 45 (the screen's 43, `hunts.open`, `quizzes.signals`) |
| First full reading | 82 results, 2,611 KB | 45 watch results, 147 KB + 38 fetches, 2,464 KB |
| Author, 10 edits on screen | 10, 22 KB | 10 + 10 signal reruns (0.7 KB), 22 KB |
| Other smith, 10 edits in another quiz | 10 `quizzes.whole`, 905 KB | 10 signal reruns (1.5 KB) + 3 fetches (6 calls), 389 KB |
| Bot run, 40 answers in another quiz | 40 `quizzes.whole`, 3,452 KB | 8 signal reruns (1.2 KB) + 1 fetch (2 calls), 122 KB |
| Hunt retitled | 1, 7.5 KB | 1, 7.5 KB |

One quiz whole: 82 KB; every quiz's signal: 0.1 KB.
