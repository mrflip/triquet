# e2e triage: progress

**Status:** thread 6 underway. Threads 1 to 5 landed, in the order #156, #157, #158, #159, #160. The Coach released thread 6 on 2026-10-07; the open questions still stand in `human/20261006-sprint_e2e_triage_paused.md`.

## Status

| Thread | Label | Status |
|---|---|---|
| 1 | trim and mend the e2e specs; nominate vapid tests | landed #156 |
| 2 | a fast way in: backend-made hunt, session per worker | landed #160 |
| 3 | cover the error boundary | landed #157 |
| 4 | cover stats and the other light gaps | landed #159 |
| 5 | path-to-spec map, `pnpm e2e --touched`, scoped proof | landed #158 |
| 6 | per-container lock on full runs, catch up on acquiring | landing |

## Measurements

Full `pnpm e2e` runs on a lane, test-seconds summed from the run's JSON report:

| Run | Tests | Test-seconds | Wall | Mean | Conditions |
|---|---|---|---|---|---|
| Baseline, before the sprint | 259 | 1006 | 157 s | 3.9 s | lane 1, 10:09, seeded cache, load 2 |
| After thread 1 (#156) | 239 | 942 | 149 s | 3.9 s | lane 1, 11:30, warm cache, load 3 to 11 |
| Smoke tier (thread 5, not a proof) | 26 | 111 | 30 s | 4.3 s | lane 3, seeded cache, load 6 |
| Thread 5's proof (#158) | 244 | 1258 | 206 s | 5.2 s | lane 3, warm cache, load 45 as it began: not comparable |
| Thread 4's proof (#159) | 249 | 1267 | 202 s | 5.1 s | lane 2, seeded cache, load 25 as it began: not comparable |
| Thread 2, before (paired run, thread 1's top) | 239 | 1148 | 179 s | 4.8 s | lane 1, back to back with the next row |
| Thread 2, after (paired run) | 239 | 846 | 137 s | 3.5 s | lane 1, back to back with the row above |
| Thread 2, after, quietest run | 239 | 762 | 121 s | 3.2 s | lane 1 |
| Thread 2's proof, the final top (#160) | 249 | 1753 | 272 s | 7.0 s | lane 1, warm cache, load 27 rising to 46: not comparable |

*Orchestrator:* thread 1 saved about 6% of test-seconds and little wall time, since the twenty cut
were average tests. Nearly all the speed this sprint wants is thread 2's. Thread 5's proof ran at
load 45 beside two other lanes' work, so its slower mean is the machine, not the suite; it shows
the load effect the sprint is about. From #158 on, `pnpm e2e` logs `test_seconds` itself.

## What the threads have taught

*Review (thread 1):* `fixed`, at medium through `/code-review`. Every deleted test's claim was
checked against its cover and survives; the rewritten pixel checks still fail when the behaviour
breaks. Fixed: `failures` "never a code" now rules out the stub's `RateLimitError` and `429` too
(85101f5). Left, minor: the gear zip-name check sits behind the known milestone flake (as the
plan asked); the corner inset and chaining row heights are exact to the pixel, so watch for
subpixel flake; `toHaveURL(address)` in "a smith renames the hunt" passes at once, and a comment
says why it holds.

*Orchestrator:* from thread 1's `ready` report (its file, `thread-1-e2e_trim.md`, has the detail):

* **The suite has 236 tests now, down from 256**, in the same 23 spec files. No file was deleted or
  merged, so thread 5's map names the files as they stand.
* **Vitest renders no React yet.** Thread 1 declined the dash-readout unit test because it would be
  the repo's first React render under Vitest. Thread 4 meets the same question for
  `SyncUnconfigured`: if it adds React rendering to Vitest, it decides the environment once and
  adds the dash case beside it, as one line.
* **The suite's most frequent flake has a likely product cause.** `quiz-history.spec.ts`, the
  milestone test, tags the start commit under load because `HuntMirror.milestone` waits at most
  `ReadWaitMs` (5 s) for the feeds. Thread 2 cuts load; if the flake survives it, it is the
  Coach's question, not a spec fix.
* **Widget usage counts** are now asserted exactly on a widget of the spec's own, which no other
  spec can drift. That is the pattern for any count over the shared library.

*Orchestrator:* from thread 3's `ready` report (its file, `thread-3-e2e_error_boundary.md`):

* **`failQuery(page, fnpath, reason?)`**, at the end of `e2e/support.ts`, turns every answer to one
  Convex query into a failure until the spec calls `heal()`. It must be called before the page
  loads. Any later spec that needs a server-side failure uses it; none should hand-roll a socket rewrite.
* **The address check tests an org's shape but not the server's reserved-word rules**, so
  `/~ghost_id/<hunt>` reaches the error boundary instead of "No such hunt". Three of thread 3's
  tests lean on that gap; if it is closed, they switch to `failQuery`, as a comment in the spec says.
* **A product change rode along:** `PageFailed` now reports each failure to the console once under
  the dev server too, where StrictMode mounts it twice. Keeping it is the Coach's call.
* Thread 3's `@smoke` test is "trying again draws the page afresh, reporting each failure once, and
  a page whose cause is gone comes back whole".

*Review (thread 3):* `clean`, at medium through `/code-review`, then by hand. `failQuery` cannot
leak between tests (its route and listener are on the per-test page), rewrites only the named
query's answers, and a broken socket cannot pass the tests that look for its request id. The
once-guard still reports a fresh failure after *Try again*. Left, minor: a failure throwing the
very same object on every attempt would be reported once (nothing does today); `RefusedOrg`'s doc
could name `orgFrom` as the reason the address lets `~ghost_id` through.

*Orchestrator:* from thread 5's `ready` report (its file, `thread-5-e2e_touched.md`):

* **Every spec file now carries exactly one `@smoke` test and sits in a corner of `SpecCorners`**
  (`scripts/spine.ts`); unit tests fail otherwise. A new spec file needs both.
* **`test_seconds` is in the e2e log** (pulled forward from the ground rules' measuring), printed
  on the run's line and as a mean in `pnpm e2e:log`. Later threads measure from it, not by hand.
* **The map was revised against the imports.** `use-draft`, `use-session`, `offers.ts`,
  `postmortem`, `cells/fields` and `cells/markdown` reach the whole suite; `cells/` is mapped file
  by file; an alarms corner was added. The thread file lists every change.
* **For thread 6:** the lock and catch-up wrap the body of `e2e()` (the plan choice, then
  `runSuite`) when `args` is empty or `--touched`; choosing the plan after the catch-up keeps the
  scope right if the top moved.
* **Open for the Coach:** CLAUDE.md step 3 and the thread-worker agent's *Prove* still name only
  `pnpm e2e`. Whether sprint workers may prove with `--touched` is a policy call.

*Orchestrator:* from thread 3's `landed` report: its proving run (lane 2, load 22.6) failed two
specs that passed alone. `reviews.spec.ts`, the smith's note fold, failed a CSS check under load.
`widgets.spec.ts`, "every dialog has a close button", has a real cause: its `Close` lookup is not
exact and can match a generated title beginning "Closed…". Thread 4 adds `exact: true`, at the
orchestrator's request.

*Review (thread 5, first):* `flagged`, at medium through `/code-review`, then by hand. Fixed
(5ccfa95): the synced layout, the quiz pages, `QuizRoute`, `SiteHeader`, `shown-hunt`,
`use-address`, `use-ident` and `routes.ts` had mapped to the routing corner, though every quiz
spec opens through them; they now reach the whole suite. Significant: the quiz history mirror
(`hunt-mirror`, `hunt-feed` and the commit machinery) mapped to quiz-history and panels, though
`use-hunt` and the Workbench run through it. *Orchestrator:* the plan's map gloss already answers
this (verify against the imports; what every quiz screen opens through reaches the whole suite),
so the worker was resumed with it as a directive, and a second reviewer follows. Minor, left: the
bid checks scope before its catch-up (moved to thread 6's gloss); the `@smoke` tripwire counts
literal text; `src/models/review*` stays scoped, as planned.

*Orchestrator:* thread 5's mend (ddf1769) sends the whole mirror to the whole suite: `hunt-mirror`,
`hunt-feed`, `hunt-fetching`, `hunt-commits`, `commit-scheduler`, `huntfiles` and `huntgit`, the
history files `use-hunt.ts` and `Workbench.tsx` import. The worker rightly pushed back on the
orchestrator's directive to keep `FullHistoryDownload` and `full-history.md` in the corner:
`ExportImportPanel` mounts them on every quiz screen, so the second reviewer sends them to the
whole suite too. The map's file-by-file reading now lives in `thread-5-map-reading.md`, for anyone
changing `SpecCorners`.

*Review (thread 5, second):* `fixed`, at medium through `/code-review`, then by hand. The
mirror's import closure is complete, and nothing in it still matches a narrower rule. Fixed
(fe0a5a4): `FullHistoryDownload` and `full-history.md` reach the whole suite. Left, minor, for the
Coach: does the map's rule mean "opens through" (layout, route, data hooks) or "draws"? Read as
"draws", the panels, the grid and the quiz header would go to the whole suite too; the map keeps
them in corners whose specs notice a draw-time throw. Also minor: `HuntRepoList` is reached from
`QuizRoute` only through `QuizNotFound`, which routing covers, so it keeps its corner.

*Orchestrator:* from thread 4's `ready` report (its file, `thread-4-e2e_light_gaps.md`):

* **Unit tests can now render a view**, through `renderToStaticMarkup` in the existing `node`
  environment, with `renderedText` in `tests/support/rendering.tsx`; `vitest.config.ts` includes
  `*.test.tsx`. No package added. `notes/testing.md` limits it to what a view chooses to say.
* **No new spec file name**: the two-smith and members tests went into `routing.spec.ts`, so no
  corner line is needed; `stats.spec.ts` carries its one `@smoke`.
* **Every ident is an admin today**: only a browser with no username is refused the backfills.
  The stats spec relies on that for its admin view; once admin rights narrow, it needs an admin
  of its own. A product fact for the Coach.
* **A bare `getByRole('alert')` also matches Next's route announcer** after a client-side
  navigation. Filter alarms by their text (`AppNotices.changeNotKept`).
* **The pages run the React that Next bundles** (`19.3.0-canary-…`), not package.json's `19.3.0`.

*Review (thread 4):* `clean`, at medium through `/code-review`, then by hand. The two-smiths test
settles its order without a timer, and its no-alarm check cannot pass vacuously. The stats spec's
React version is read independently of the page's. The unit include widens to exactly the three
new `.test.tsx` files. Both `Close` lookups are exact. Left, minor: `renderedText` does not decode
the entities React writes, so the first test of text with an apostrophe fails loudly until a
decoder (a library, the Coach's call) is added.

*Orchestrator:* from thread 2's `ready` report (its files: `thread-2-e2e_fast_way_in.md`, and
`thread-2-measurements.md`, every run and the way in timed part by part, for anyone comparing
numbers or working on the way in again):

* **About 26% fewer test-seconds and 23% less wall** in a back-to-back pair on lane 1. Neither
  target was met: the way in is about 1.3 s (the hunt 0.1 s; the dev server's page load 0.8 s; the
  grid's wait for session, ident and hunt 0.55 s), and the mean test is 3.2 s at best, the rest
  being specs about the way in, the gear, and reviewers walking the front door.
* **A second visitor must be `otherVisitor(browser)`.** Any other context inherits the worker's
  session; `assumeIdent` on it, or on the default `page`, changes who the worker is and breaks every
  later test in that worker. Specs about idents keep `startAt: null`.
* **Each page load spends the stored refresh token**, and Convex Auth revokes the session when a
  spent token is reused more than 10 s later, so the worker's session is passed test to test, not
  copied.
* **Two hunts made at once conflict**, through the UI too, because `newHunt` reads every hunt to
  enforce the hunt cap. The fixture retries; it is a product question for the Coach.
* **`ConvexHttpClient.setAdminAuth` is internal in convex 1.46**, so admin calls go through
  `/api/run`, the plan's fallback.
* **The quiz-history milestone race recurred once under the build** ("a milestone names the branch
  it marks"), and not in seven dev-server runs: the `ReadWaitMs` question stands.

*Review (thread 2):* `fixed`, at medium through `/code-review`, then by hand. Fixed (c82beb7): the
fixture retried every `makeHunt` failure for 10 s; it now retries only Convex's
`OptimisticConcurrencyControlFailure` (reproduced: 3 of 24 parallel calls). Checked and sound:
`makeHunt` is internal, refuses before any write without `TRIQUET_CLEARABLE=yes`, and builds
through the public paths minus authorization; the deploy note is true; `e2e/admin.ts` talks only
to the lane's own backend and never surfaces the key; the kept session cannot cascade past one
test, since a failure replaces the worker. Left, minor: storage can be saved mid-refresh (harmless
inside Convex Auth's 10 s reuse window); every worker walks the front door once; under CI's one
worker, one ident smiths about 200 hunts.

