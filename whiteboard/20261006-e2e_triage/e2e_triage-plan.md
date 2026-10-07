# e2e triage: a suite that is fast, honest, and runs only its corner

**Date:** 2026-10-06. **Mode:** normal. **Review level:** medium. **At once:** 3. **Issued by:** flip,
in session e2e_triage. **Status:** done: threads 1 to 7 landed (#156 to #160, #169, #176). The Coach released thread 6 (the lock)
on 2026-10-07, and asked in chat for thread 7, a follow-up to it.

Words: **way in** = what every test does before it is about anything: say who it is at the front
door, make a hunt, open its quiz (`startHunt` in `e2e/support.ts`). **Corner** = the specs the
suite would run for a change to one area of the tree. **Scoped proof** = an e2e proof over a corner
rather than the whole suite. **Stampede** = several full runs on one machine, each timing the
others out.

## What the suite costs today, and why

Measured from the JSON report of the last green full run (lane 1, 2026-10-06 10:09) and the e2e
log (`pnpm e2e:log`, 15 runs that day):

| | |
|---|---|
| Tests, test-seconds, wall | 259, 1006 s, 160 s on 7 workers |
| Mean per test | 3.9 s |
| A test with no hunt fixture (brand, the front door) | 0.2 to 1.0 s |
| The heavy beforeEach specs (ishes, bots, chaining, estimates, reviews) | 6 to 8 s a test |
| Full runs ending at load 32 or more | 2 of 2 red |
| Full runs ending at load 16 to 32 | 2 of 4 red |
| Full runs ending below load 16 | 0 of 4 red |
| Cold build cache | 2 of 2 red, mean 7.1 min; seeded, 0 of 6 red, mean 2.7 min |

So: roughly half of every test is its way in, walked through the UI; the heavy specs then add
widgetings and columns through three nested dialogs before they begin. About one test in six
proves what another already proves. And the suite goes red with load, not with code: nothing is
shared between lanes but the CPU.

The local run stays on the **dev server**, on purpose: it has caught what the build did not, and
the build (CI's) has caught what dev did not. The seeded-cache numbers above say dev mode is not
the problem; a cold cache and load are. Nothing in this sprint changes the server a local run uses,
and nothing loosens CI.

## Read first

Beyond CLAUDE.md's auto-loads (`notes/testing.md` loads itself for anything under `e2e/`):

* `e2e/support.ts` whole, and `playwright.config.ts`.
* `notes/git_hygiene.md`: *Finishing* and *When e2e is not worth running*.
* `scripts/spine.ts`: `e2e`, `proofOf`, `land`, `DocsOnlyRules`, `UnwatchedRules`, `e2eWatched`;
  and `scripts/e2e-log.ts` for the tally and the log entry.
* `convex/testing.ts` (`clearAll`, the one test-only function and the pattern for another) and
  `scripts/convex_dev` (what a run starts, and where the role's `cli.env` is).
* `.claude/agents/thread-worker.md`.

## Ground rules

`notes/git_hygiene.md` and the thread-worker definition bind every thread. Particular to this sprint:

* **Measure, and write the numbers down.** Every thread that changes what a run costs ends with a
  full `pnpm e2e` on its lane and puts the log line (tests, test-seconds, wall, load, cache) in its
  thread file, before and after. The progress document keeps the running tally.
* **CI stays strict.** No thread touches `.github/workflows/ci.yml` except to keep it working.
  The local cheats this sprint builds are explicit, logged, and scoped; CI runs everything, always.
* **The dev server stays the local default.** `pnpm test:e2e:built` remains the way to check the
  build by hand.
* **Keep the support helpers' names and signatures** (`startHunt`, `assumeIdent`, `newHunt`,
  `addWidgetings`, `addColumns`, `stubAsk`, the locators): thread 2 makes them fast underneath so
  that threads 3 and 4, written beside it, land on the same names.
* **A test about the way in uses the way in.** The front door, the hunts list, a friend's link,
  the members panel: those specs keep walking the UI (`test.use({ startAt: null })`). The shortcut
  is for specs that are about something else.
* **Trim means delete, nominate means list.** Thread 1 deletes what its text names and lists the
  rest for the Coach in `human/`; no thread deletes a test the plan did not name without saying so
  in its report.

## Threads

### 1. Trim the vacuous and duplicate specs, and mend the practice gaps

Coach's text, verbatim:

> trim the vacuous ones. Sometimes I see weak models, asked to write tests, just start filling in
> "pad right for 6 characters does ... . pad right for eight characters does ..." like they're a
> 7th grader just going thru the motions. If you see tests of the framework, vapid tests like
> that, also nominate them (we won't eliminate all, but I think they can be cancerous as other
> agents will follw the example)
>
> fix the other practice gaps as you suggest

**Delete** (each proves what another test already proves, or cannot fail for the reason its title gives):

* `e2e/panels.spec.ts`: "Refresh export, beside Copy, reads the hunt again" (nothing changes
  between the two reads; fold a real refresh into "the export is read only when asked", or drop).
  "the info button beside the LL Export mode explains each mode", "the quiet note beside it
  explains, in a dialog, how to see the history", "every read-only export box has a Copy button"
  (copy text and counts; they break on wording before they catch a bug).
* `e2e/grid.spec.ts`: "the page never scrolls sideways, however wide the grid is" (never widens,
  reads once; the real claim belongs in "the corner's fold sits at its top" once a wide widgeting
  is on screen, as a retrying `expect.poll`). "a fresh hunt's quiz opens with blank questions"
  (inside "a fresh quiz starts lean").
* `e2e/sheets.spec.ts` "clicking the box selects the lot" and `e2e/panels.spec.ts` "a refused
  clipboard falls back to selecting the text": keep one, and assert the selection spans the value
  (`selectionStart === 0 && selectionEnd === value.length`), which is what "the lot" means.
* `e2e/widgets.spec.ts`: "a text column shows text" and "a column keeps what it shows after a
  reload" (inside "changing a widget's formula changes every column that works it, and survives a
  reload"). In "a widget says how far it is put to work", replace the `\d+` regex with the counts
  this hunt is owed at least (one widgeting, one quiz, one hunt), using `toContainText` on each.
* `e2e/bots.spec.ts` "with credentials, a never-asked cell invites the author to ask" (it is
  `e2e/asking.spec.ts` "a never-asked cell invites the author to ask").
* `e2e/asking.spec.ts` "with the network off the rest of the page still edits, sorts and saves"
  (it is `e2e/client-first.spec.ts` "asking is the one server function"); "a failure reads as a
  sentence and invites a retry" (inside `e2e/failures.spec.ts` "a cell that has only ever failed").
* `e2e/reviews.spec.ts` "asks before revealing the answer, and hides it again without asking"
  (inside the two tests after it).
* `e2e/quiz-history.spec.ts`: "the history downloads from the gear as a zip named for the hunt",
  "editing a quiz builds a history that a milestone can tag", "a milestone marks the edit made a
  moment ago" (all inside "an edit commits only the files it changed, its message naming the
  quiz", which should also assert the zip's name).
* `e2e/archiving.spec.ts` "the corner button leaves batch mode as well as entering it" (merge
  into "a button to change how a question is shown stands only in batch mode").
* `e2e/categories.spec.ts` "says so for a hunt there is not" (routing's "moves to a quiz's own
  realm from a stale one" already visits the categories path of a hunt there is not).
* `e2e/ordering.spec.ts` "a decimal Q# leaves the question where it is" (the first half of
  "Renumber Q# tidies the numbers").
* `e2e/ishes.spec.ts` "an uncomputed sum reads as a dash, never as a zero": move the claim to a
  unit test of the readout (`src/components/cells/readouts.tsx` or wherever the dash is drawn)
  and delete the spec; it pays a four-dialog beforeEach for one glance.

**Mend** (the practice gaps):

* Pixel assertions that will flake on a font or theme change before they catch a logic change:
  `grid.spec.ts` "the grid opens folded" (`toHaveCSS('height', '30px')`), `chaining.spec.ts`
  "folded, a row is one line" (`<= 20`, `<= 43`), `grid.spec.ts` "the corner's fold sits at its
  top" (`< 16`). Assert the thing the number stands for: the folded row carries `data-folded`,
  the snippet has `-webkit-line-clamp: 1`, the box's height equals its folded sibling's, the fold
  button's top is within the corner's top by a tolerance derived from the theme's spacing, not a
  literal. Where a literal is the only honest check, say in a comment what it is tied to.
* `stubIshes` in `ishes.spec.ts` does not `unroute` first as `stubAsk` does; use `stubAsk` or
  give it the same guard.
* The one-shot `expect(await ...)` reads not covered by the "not yet" rule of `notes/testing.md`:
  `sheets.spec.ts` "a header row of column labels" and "a line break in a field" read
  `inputValue()` straight; `quizzes.spec.ts` "a smith renames the hunt" reads `page.url()` straight.
  Wrap in `expect.poll` or a locator assertion.

**Nominate** (list, do not delete), in `human/20261006-vapid_tests.md`: a pass over `e2e/` and
`tests/` for tests that exercise the framework or the library rather than our code (a test that
zod refuses a number for a string, that MUI renders a button, that `Array.toSorted` sorts), tests
that walk a parameter through values with no failure mode behind each step, and tests whose title
restates their inputs. The bar is `notes/testing.md`, *Choosing Examples*: each case ties to a
plausible failure mode. My own skim of `tests/models/*.test.ts` and `tests/app/palette.test.ts`
found purposeful cases, so expect the list to be short; say so if it is. Each nomination: the
file, the `it` or `test` title, one line on why, and whether you would cut it.

Likely touches: the spec files named, `e2e/support.ts` only if a helper goes unused, one unit test
file for the dash readout, `human/`. Depends on: nothing. Look-ahead: thread 2 rewrites the way in
beneath the same helper names, so delete and mend, but do not restructure `beforeEach` blocks.

### 2. Make the way in fast: a backend-made hunt, and a session kept per worker

Coach's text, verbatim:

> I think the main answer is to make the scripts run fast.

And from the assessment the Coach accepted: *"authenticate once per worker and set up state
through an API. A `testing:makeHunt` internal mutation beside `clearAll`, plus a worker-scoped
ident, would let the fixture go straight to the quiz URL."*

Target: the `FreshHunt` way in under one second, and the mean test under 2.5 s, with no spec
changing what it asserts. Two parts:

* **The session.** Convex Auth keeps the anonymous session in the browser's storage, and the ident
  is the username that session asserts (`src/state/use-session.ts`, `use-ident`). Playwright's
  pattern is a worker-scoped fixture that signs in once and hands each test a context with that
  `storageState`. A worker's tests then share one ident; every spec already finds its rows by its
  own labels, and the specs about idents and the hunts list go in by themselves (`startAt: null`),
  so sharing is safe. Check the one spec that depends on a session *holding* a username
  (`routing.spec.ts` "turns a second browser away from a username the first holds"): it makes its
  own, and keeps doing so.
* **The hunt.** A test-only function beside `clearAll` in `convex/testing.ts`, `makeHunt`, refused
  unless `TRIQUET_CLEARABLE=yes`, that does what `new_hunt` in `convex/writing/account_actions.ts`
  does for the ident the worker holds, and returns the quiz's address. **Internal**
  (`zInternalMutation`, as `clearAll` is), never public: its shape is "act as the ident this
  argument names", which must be unreachable from a browser by construction, not by an argument
  check; the env guard is the second lock, not the first. The spec process drives it with the
  role's admin key from `data/convex-<role>/cli.env` (there in every lane, and in CI, since
  `scripts/convex_dev` writes it; `scripts/convex_reset` reads it the same way), through a Convex
  HTTP client with admin auth, from one helper in `e2e/` that reads the file and makes the client.
  Confirm first that admin auth on the HTTP client is a supported surface in the pinned Convex
  version (the `convex-docs` skill); if not, the CLI's own `/api/run` endpoint with the admin key
  header is the fallback. Then `page.goto(address)` and wait for the grid. Keep `startHunt(page)`
  as the UI way in for the specs that are about it.
* **The heavy beforeEach blocks.** `addWidgetings` and `addColumns` walk three dialogs per item.
  Give `makeHunt` optional `widgetings` and `columns` lists, so a spec that is not about the gear
  asks for its layout up front, and keep the dialog-walking helpers for the specs that are
  (`widgets`, `prompts`, `entries`). Convert `ishes`, `bots`, `chaining`, `estimates`, `asking`,
  `failures`, `reviews` (the smith's side) and `panels` to ask up front.

Guardrails to keep: `notes/convex.md` on a new function (Zod at the door, internal unless there
is a reason); the client-first rule is untouched (this is a Convex function, not a server route).
Measure before and after, as the ground rules say, and note the peak memory if you can see it
(`/usr/bin/time -v` around `pnpm e2e` gives maximum resident set size for the runner; the browsers
and the dev server are separate processes, so say which you measured).

Likely touches: `e2e/support.ts`, `playwright.config.ts`, `convex/testing.ts`,
`convex/_generated/` (its own commit), `tests/convex/testing.test.ts`, the specs converted.
Depends on: thread 1 (fewer specs to convert, and no two threads deleting and rewriting the same
blocks). Look-ahead: threads 3 and 4 are written beside this one on the helper names as they stand;
thread 5 reads nothing of this but benefits from every second.

### 3. Cover the error boundary

Coach's text, verbatim:

> covering the error boundary -- yes, seems worth many tests /understatement

`src/app/(synced)/error.tsx` draws `PageFailed` (`src/components/PageFailed.tsx`) when a page
throws as it draws: the failure, the postmortem's summary, the request id and function path when
the server kept the reason to itself, a *Try again* button, and one report to the console.
Nothing in `e2e/` reaches it today.

Cover, in a new `e2e/failing-pages.spec.ts`:

* A page that throws shows the alert with `AppNotices.pageFailed`, the summary, and the request
  line when there is one; the console gets one report, not one per render.
* *Try again* redraws, and a page whose cause is gone comes back whole (the grid, the quiz name).
* The boundary holds the header: the site header and the way home stay usable above the alert.
* Each of the synced pages (hunt, quiz, categories, hunts list) fails into the same boundary.
* Nothing the failure says leaks: no stack, no row id, no admin key.

How to make a page throw without a hook in production code, in order of preference: (a) an
address the route handler reads but a Convex function refuses at its Zod door (look for a label
or realm the route passes through unvalidated); (b) `page.routeWebSocket` on the Convex socket,
rewriting one query's result frame into an error frame, which is what a server-side throw looks
like to the client; (c) blocking the Convex HTTP action the page needs. If none of these reaches
the boundary, say so in your report and propose the smallest test-only trigger for the Coach to
approve; do not add one on your own.

Likely touches: the new spec, `e2e/support.ts` (a helper to fail the next query). Depends on:
thread 1. Look-ahead: write on the helper names as they stand; thread 2 changes nothing you call
by name.

### 4. Cover the stats page and the other uncovered corners, lightly

Coach's text, verbatim:

> stats page is admin facing but also a bit of a contraption, yes tests but they don't have to
> be diabolical. the others in nothing covers can also be covered lightly.

* **Stats** (`src/app/(synced)/stats/page.tsx`, `src/components/Stats.tsx`, `src/state/use-stats.ts`,
  `convex/stats.ts`): it opens, it names the build stamp and the versions, it says the browser is
  connected, and the backfills table shows for an admin and the "not an admin" line for anyone
  else. Find out how the suite can be an admin (`Approve.may('read_backfills', ...)`); if it
  cannot without production-code changes, cover the non-admin view and say so.
* **"This build has no database"** (`SyncUnconfigured`): it shows only when `NEXT_PUBLIC_CONVEX_URL`
  is unset at build time, which no e2e run can arrange without a second build. A unit test of the
  provider's choice is the right cover; note it and move on.
* **Two smiths on one cell**: `routing.spec.ts` proves a friend's edit reaches the author. Add the
  other direction, and both typing into the same cell: the later edit wins, nothing is lost
  elsewhere, and neither page alarms.
* **The member panel**: it offers add and remove only, so "change a role" is not a gap; cover
  remove-then-add-as-the-other-role once, as a reviewer becoming a smith.

Likely touches: `e2e/stats.spec.ts` (new), additions to `routing.spec.ts` or a new
`e2e/collaborating.spec.ts`, possibly `tests/app/providers.test.tsx`. Depends on: thread 1.
Look-ahead: as thread 3.

*Orchestrator, after thread 5's `ready`:* every spec file must carry exactly one `@smoke` test and
sit in a corner of `SpecCorners` in `scripts/spine.ts`, or justify fails once thread 5 lands.
`stats.spec.ts` is mapped already; a new file of any other name (`collaborating.spec.ts`) needs
a corner line of its own. Vitest renders no React yet (thread 1): if the `SyncUnconfigured` test
adds React rendering, add the dash-readout case beside it.

### 5. A path-to-spec map, `pnpm e2e --touched`, and a scoped proof the bid accepts

Coach's text, verbatim:

> yes please to the path-to-spec.

Today `UnwatchedRules` and `e2eWatched` in `scripts/spine.ts` answer "could e2e notice this
path"; the only cheats are a full run or `--skip-e2e <reason>`. Build the next step:

* **The map**, beside those rules: an ordered list of `(rule over a path) -> spec files`, first
  match wins, with a final rule that means *the whole suite*. The corners, from reading every spec:
  - `src/components/cells/`, `QuestionRow`, `QuestionTable`, `QuestionTitle`, `FoldButton`,
    `use-folds`, `use-draft`, `use-reorder`, `SortableList`: grid, chaining, ordering, archiving,
    ishes, estimates, entries
  - `src/components/panels/`: panels, sheets, importing, entries
  - `WidgetEditor`, `WidgetingsEditor`, `ColumnsEditor`, `LibraryModal`, `QuizManageModal`,
    `DangerZone`, `PreviewPicker`, `JsonataFields`, `AibotFields`, `EntryFields`,
    `widget-words`: widgets, prompts, entries, quizzes
  - `src/lib/ask/`, `src/app/api/`, `src/state/use-asking*`, `use-bots*`, `offers.ts`: asking,
    bots, failures, prompts, ishes, client-first
  - `src/lib/routes.ts`, `src/app/(synced)/` (pages and layout), `IdentGate`, `HuntsList`,
    `HuntRoute`, `HuntEditModal`, `NotOnHunt`, `QuizNotFound`, `SiteHeader`, `use-address`,
    `src/state/use-ident*`, `use-session`: routing, brand, failing-pages
  - `ReviewScreen`, `ReviewsPanel`, `convex/reviews.ts`, `convex/writing/review_actions.ts`,
    `src/models/review*`: reviews
  - `CategoryWheel`, `CategoriesRoute`, `wheel-geometry`, `PersonaCard`, `spread-*`: categories,
    estimates
  - the quiz history mirror under `src/state/`, `src/lib/huntfiles*`, `HuntRepoList`,
    `OrphanedRepos`, `FullHistoryDownload`, `HuntBranch`: quiz-history, panels
  - `Stats`, `use-stats`, `convex/stats.ts`, `build-stamp`: stats
  - `PageFailed`, `error.tsx`, `postmortem`: failing-pages
  - anything else under `src/`, all of `convex/`, `src/models/`, `src/lib/rows.ts`,
    `e2e/support.ts`, `playwright.config.ts`, `package.json`, the lockfile: the whole suite
  Verify each line against the imports before trusting my reading; a component I filed in one
  corner may be used in two, and then it maps to both.
* **`pnpm e2e --touched`**: the paths the branch changes since its base (`changedPaths`) through
  the map; if every path maps to a corner, run those spec files and record a **scoped proof**
  (the tally's new `scope: string[]`, the spec files run; the log entry's kind `touched`);
  if any path means the whole suite, say so and run it all. Print which corner each path chose,
  so a worker can disagree.
* **The bid**: `proofOf` accepts a scoped proof when the branch's changed paths still map inside
  its scope at bid time; a path added since that maps outside it refuses, naming the path, as a
  missing proof does now. A full proof stands as it does. `--skip-e2e` stays for the cases the
  map does not know.
* **A smoke tier**: one test per spec file tagged `@smoke` (Playwright's `{ tag: '@smoke' }` on
  the test; 1.63 supports it), chosen as the test that walks furthest through that corner, and
  `pnpm e2e:smoke` running `--grep @smoke`. About 25 tests, 40 seconds wall. A smoke run is a
  `chosen` run in the log and the tally, never a proof: it is the quick signal before a full run
  when the map says "the whole suite", not a substitute for one. `notes/testing.md` says which
  test of a new spec file carries the tag, and that there is exactly one.
* **The documents**: `notes/git_hygiene.md`, *Finishing* and *When e2e is not worth running*,
  gain the third option between "run it all" and "skip", name the smoke tier for what it is, and
  say that CI is the strict gate. `tests/scripts/spine.test.ts` and `tests/scripts/e2e-log.test.ts`
  cover the map, the scope, and the refusal.

Likely touches: `scripts/spine.ts`, `scripts/e2e-log.ts`, their tests, `package.json`,
`notes/git_hygiene.md`. Depends on: nothing in code; cut it after thread 1 lands so the map names
the spec files that survive, and add `stats` and `failing-pages` lines whether or not threads 3
and 4 have landed (a line naming a file that is not there yet is harmless; say so in a comment).

### 6. A per-container lock on full runs, held until the Coach releases it

Coach's text, verbatim:

> A lock will be per container, and I usually run 2-3 containers. I think the main answer is to
> make the scripts run fast. Let's see what the other changes do, so put lock last in the plan
> and have the sprint runner hold on it. Also make sure that after the lock releases they
> restack, as it's very likely the previous contestant just restacked the git tree

**Held** until the Coach said so, after reading the measurements threads 1, 2 and 5 left in the
progress document. *Orchestrator:* released by the Coach on 2026-10-07.

When released: `pnpm e2e` (full and `--touched` runs, not reruns or chosen specs) takes a lock
beside the e2e log (`$TQ_WORKTREES/.e2e-lock`, so it is one per container, which the Coach
accepts: 7 workers stay; what queues is a second full run on the same box). A run that finds it
held says whose lane holds it and since when, waits, and **on acquiring it runs `pnpm catchup`
first**, since the holder very likely landed and the top has moved; only then starts the suite.
A catch-up that conflicts releases the lock and stops, as `catchup` does. The log entry gains
`waited_s`. Never a lock in CI (`process.env.CI`), and never one that outlives its process: use a
library that takes the lock with the process's lifetime (`proper-lockfile` is the usual one; list
it in `notes/stack.md`), not a bare file we must remember to remove.

Likely touches: `scripts/spine.ts`, `scripts/e2e-log.ts`, their tests, `notes/git_hygiene.md`,
`notes/stack.md`, `package.json`. Depends on: thread 5 (the same functions), and the Coach's word.

*Orchestrator, after thread 5's first review:* `land` checks a proof's scope in `proofOf`, before
the hold and before its own catch-up, an order older than this sprint. A spec file the top gains,
in a corner the branch proved, is then not required by that bid. Thread 6 already reorders a
catch-up ahead of the run; when it is cut, it also moves the scope check after the bid's catch-up,
or says why not.

### 7. A checkout that moves onto a new dependency installs it

Coach's word, in chat on 2026-10-07, choosing "Install, then fix": the orchestrator runs
`pnpm install` in the main checkout, then cuts "a small follow-up thread: spine.ts imports
proper-lockfile lazily, and catchup/land reinstall when the lockfile changed."

*Orchestrator:* thread 6 landed `import * as Lockfile from 'proper-lockfile'` at the top of
`scripts/spine.ts`, and only `pnpm worktree` installs packages (into the new worktree). So the main
checkout, and any worktree that caught up onto #169, failed every spine command with
`ERR_MODULE_NOT_FOUND` until someone ran `pnpm install`. Two halves:

* **Lazy:** spine.ts reaches proper-lockfile only where the lock is taken (a dynamic `import()`
  inside `takeE2eLock`, or however reads best), so `sweep`, `top`, `worktree`, `catchup` and `land`
  never need a package they do not use.
* **Reinstall on move:** wherever the spine moves a checkout's files to a commit whose
  `pnpm-lock.yaml` differs from the one it stood on (`catchup` in a worktree; `land`, `sweep` and
  the replay moving the main checkout onto a new top), run `pnpm install --frozen-lockfile
  --prefer-offline` there, as `worktree` already does, and say so in one line. Only a lockfile
  change triggers it. The main checkout's `node_modules` is derived state, so the spine installing
  there is the same kind of write as the landing that moved it; note that in `notes/git_hygiene.md`.

Likely touches: `scripts/spine.ts`, `tests/scripts/spine.test.ts`, `notes/git_hygiene.md`. Depends on:
thread 6 (landed, #169).

## Running order

Thread 1 first, alone. Then 2, 3, 4 and 5 may run side by side (cap 3: start 2, 3, 5; 4 when one
lands). Thread 6 waits on the Coach.

## For the Coach

* **Dev server locally, build in CI: kept**, as you said. The one place I would still spend a
  thought is the cold-cache case, which was red both times it ran: thread 2 cuts page loads, which
  is most of what a cold dev server compiles under seven workers, so measure before adding anything.
* **Thread 2's test-only function** is internal, driven with the admin key, as `clearAll` is:
  decided in chat on 2026-10-06, the reasoning in thread 2's text. It follows the client-first
  decision (a Convex function, not a server route).
* **Thread 3 may need a trigger.** If no address or socket trick reaches the error boundary, the
  worker will propose the smallest test-only one and stop. That is the one place this sprint may
  come back to you before thread 6.
* **The `@smoke` tier** is in thread 5, at your word on 2026-10-06.
* **Across containers** the lock does nothing, as you note. If the stampede stays after threads 2
  and 5, the next lever is a lock file on a path the containers share, which is a question about
  the mounts, not the scripts.
