# Perf improvements: faster tests, leaner reads, smaller repaints

Sprint plan, 2026-10-09. Mode: **YOLO**. Review level: **medium**. At most **3** threads at once.
Issued by the Coach (Flip), in chat, after an analysis of where the time goes (summarized under
*Background*, below).
**Status: paused for the Coach, 2026-10-09: five threads landed (#207, #208, #210, #213, #218); thread 2 and thread 4's tally wait. See `human/20261009-sprint_perf_improvements_paused.md`.** `perf_improvements-progress.md`, beside this file, is newer than this plan
wherever the two disagree.

**What the Coach wants by the end**, in priority order:

1. The tests take less time: unit suite, `pnpm justify`, the land hold, and e2e.
2. The Convex functions do no needless work, which would cost money.
3. One change repaints only what it changed, which keeps UX development disciplined. The app
   already feels fine, so raw speed matters least.

**Out of scope:**
- a dependency graph over the widget chain (the Coach: "hold on dependency graph");
- `sortQuestions` running the chain server-side, which is being worked on elsewhere;
- the O(n²) `qns[label = $$.qn.chains_to]` lookups in the seeded formulas, which the Coach's
  thread on keyed widgetings addresses.

Where a thread is tempted toward one of these, write it to `whiteboard/TODO.md` instead.

## Background (the analysis this sprint acts on)

* **The wire does not send the whole quiz per mutation.** Mutations return `null`. Each question is
  its own watch (`questions.open`). Writes patch only changed fields (`changedFields`,
  `convex/writing/quiz_writing.ts`). Two reads are needlessly wide:
  - `questions.open` reads the quiz's whole widgetings range (`convex/questions.ts:30`), so any
    widgeting write reruns every question's query.
  - `makeHuntFor` reads every hunt in the app to check one cap
    (`convex/writing/account_actions.ts:105`), so hunts made side by side (seven e2e workers)
    conflict and retry.
* **The browser rebuilds the whole quiz on every change.**
  - `quizFromSeen` (`src/lib/rows.ts:269-277`) makes a fresh object for every question.
  - Convex's `useQueries` hands back a fresh record whenever any one watch changes.
  - So one question's update gives a new `QuizT`, `Workbench` reruns `runQuiz` over the whole quiz
    (`Workbench.tsx:76`), and every row and panel re-renders.
  - There is no `React.memo` anywhere in `src/` and no React Compiler.
  - `writing` (it becomes `unsaved`, in `useHunt`) and `inFlight` (in `useAsking`, held in
    Workbench) change on either side of every write and ask, so one committed edit costs about
    three full-tree renders.
* **Every render is expensive because nothing is cached.**
  - Liquid parses the template again on every fill (`src/lib/liquidry.ts:163`, no parse cache).
  - `useFace` calls `faceOf` unmemoized.
  - `bagOf` returns a fresh object on every call, so a memo keyed on it never hits.
  - `ReactMarkdown` parses every markdown face on every render.
  - Each row's `ChainPicker` lists every question: N² `<option>`s in all.
  - Panels stay mounted while folded (`panels/Panel.tsx:64`).
  - `ExportImportPanel` runs `Templating.filledQuiz(quiz, run)` inline on every render, even with
    the tab hidden (`ExportImportPanel.tsx:80`).
  - The jsonata timebox (`src/lib/formulas.ts:91-100`) reads `Date.now()` twice per AST node.
* **Tests.**
  - The unit suite takes 54 s wall, and `tests/scripts/spine.test.ts` alone takes 51.8 s. That sets
    how long `pnpm justify` takes, and how long `pnpm land` holds the spine.
  - E2e workers are fixed at 7 (`playwright.config.ts:38`). Above load 16, half the runs go red with
    flakes that pass alone, and each red run costs a rerun.
  - Every run pays 15–30 s of fixed setup in `scripts/convex_dev` and `scripts/convex_reset`: a
    push, two `env set` calls, and one CLI process per 500 rows to empty the backend.
  - `routing.spec.ts` makes all 48 of its tests go through the front door. `reviews.spec.ts` adds
    reviewers through the Members panel, at about 7.5 s per test.
  - The e2e log is `pnpm e2e:log`. The earlier triage is in `whiteboard/20261006-e2e_triage/`, and
    its `thread-2-measurements.md` has the per-step costs of a test's way in.

**Measure before and after.** Every thread records in its thread file a before-and-after number for
what it set out to shrink: wall time, test-seconds, reads per query, or renders per edit. Use
whatever instrument is cheapest and honest: vitest's timings, `pnpm e2e:log`, a unit test that
counts reads, or a React Profiler or render-count probe in a test. Don't hand-wave.

## Read first

Beyond CLAUDE.md and its auto-loads (`notes/stack.md`, `notes/testing.md`, `notes/convex.md`,
`notes/views.md`):

* This plan whole, and the progress document beside it.
* `notes/queries_hooks_and_subscriptions.md`, before touching a query, watch or state hook
  (threads 4 and 6).
* `notes/guidelines.md` (validation, documentation, testing), and `STYLE.md` before naming
  anything.
* `notes/git_hygiene.md`, *Running only the corner* and *When e2e is not worth running*, for
  threads 1–3, which change the test machinery itself.
* `whiteboard/20261006-e2e_triage/` (threads 2 and 3): what an earlier sprint already tried, and
  what the Coach decided there, such as keeping `next dev` for local e2e.

## Ground rules

`notes/git_hygiene.md` (*The spine*, *A thread, start to finish*, *Sprints*) and
`.claude/agents/thread-worker.md`. Particular to this sprint:

* **Behaviour does not change.** Every thread is a refactor or a test-machinery change: what a
  person sees and what the database holds stay as they are. A thread that finds it must change
  either says so in its report, and the change is the Coach's call.
* **No schema change, if it can be helped.** If thread 4 truly needs a new field or index, it
  follows CLAUDE.md and `notes/deploy.md`, *Schema pushes*: a widening with its backfill, and the
  PR title says so.
* **Library first, still.** For instance: MUI `Collapse`'s `unmountOnExit` before a hand-rolled
  unmount, and liquidjs's own `cache` option before a hand-rolled parse cache. A Convex counter
  (`@convex-dev/aggregate` or the sharded counter) is worth weighing against a hand-written count
  for thread 4, though either may be heavier than the cap deserves; say why in your thread file.
* **React Compiler is not part of this sprint.** Turning it on is a dependency and build decision
  (`notes/stack.md`, *Discuss*). Hand-place `memo`/`useMemo`/`useCallback` where it pays. If a
  thread finds the compiler would plainly do the job better, write that in `human/` for the Coach.
* **Hard things go to `whiteboard/TODO.md`**, under `## From perf_improvements sprint, thread N:
  ...`, and into the report.

## Decisions taken in YOLO

1. **"Do all the low-hanging fruit" is split in two.**
   - Thread 5 holds the caches that live in `src/lib` and the panels, which need no change to how
     the quiz is assembled.
   - Thread 6 holds the identity work: stable questions, `memo` on rows, and moving `unsaved` and
     `asking` down the tree. A memo on a row only pays once the row's inputs keep their identity,
     so 6 waits for 5.
2. **The e2e harness work is two threads.**
   - Thread 2 is the run's machinery (workers, setup).
   - Thread 3 is the specs' way in (fixtures).

   They touch different files, and splitting them keeps each proof's reach clear.
3. **The jsonata timebox is kept, and made cheaper** (thread 5). The depth check stays on every
   node. The clock is read every so many nodes, not on each.

## The threads

### 1. Split the spine's test file (`spine_test_split`)

> 1. yes split up the crasy test.

`tests/scripts/spine.test.ts` (1,394 lines) takes 51.8 s, all in one vitest worker.

- **What to do:**
  - Split it into files that run side by side, along its own seams: the pure helpers (to about
    line 356), and the integration groups of `node scripts/spine.ts, in a repository with
    worktrees` (from line 575): worktree and land; catchup, justify and bid; e2e, `--touched`
    and the lock; install, sweep and restack.
  - Shared fixtures (`isolatedEnv`, `FakeE2e`, `makeWorld` and the helpers beside them) move to
    one support module under `tests/scripts/`.
- **Look at the slowest tests themselves too:** a scratch world built once per describe, not once
  per test, where the tests only read it.
- **Measure:** the unit suite's wall time before and after, and the slowest file after.
- **Watch for:**
  - tests that share a temp directory or `HOME` and would now race in parallel;
  - vitest's `pool`/`maxWorkers` limits, which may cap the gain.
- **Touches:** `tests/scripts/` only (and perhaps `vitest.config.*`).
- **Depends on:** nothing.
- **Proof:** unit tests only, so `pnpm land --skip-e2e` applies (git_hygiene).
- **Look-ahead:** threads 2 and 3 may change `scripts/spine.ts` or its tests (`SpecCorners`, the
  e2e lock); whichever lands second rebases onto the split.

### 2. E2e workers follow the load; cheaper fixed setup (`e2e_load`)

> 2. yes to worker count following the load

- **What to do:**
  - `playwright.config.ts` sets `workers` from the machine as it stands at the start of the run:
    the cores free, by `os.loadavg()` and `os.cpus()`, clamped to between 2 and 7 locally, still
    1 on CI.
  - The choice is printed, and recorded in the e2e log if `scripts/spine.ts` writes one
    (`os.loadavg()` is already read there, around line 950).
- **Also trim the fixed setup every run pays** (from the analysis; the Coach agreed to all of it):
  - `scripts/convex_reset` empties the backend through one call, the way `e2e/admin.ts` reaches
    `testing:*`, not one CLI process per 500 rows;
  - the two `convex env set` calls become one;
  - the `convex dev --once` push is skipped when nothing under `convex/` has changed since the last
    push to that backend, if that can be known reliably. If not, leave it, and say why.
- **Measure:** fixed setup time before and after (a `--touched` or `e2e:smoke` run shows it), and
  the worker count the formula picks at a few loads.
- **Touches:**
  - `playwright.config.ts`;
  - `scripts/convex_dev`, `scripts/convex_reset`;
  - possibly `scripts/spine.ts`, `convex/testing.ts`.
- **Depends on:** nothing.
- **Proof:** a **full** e2e run, since this changes Playwright config.
- **Look-ahead:** thread 3 adds admin calls to `convex/testing.ts` too. Keep any new `testing`
  function in the same pattern, and put a shared helper in `e2e/admin.ts` rather than beside one
  spec.

### 3. The specs' way in: fixtures over the front door (`e2e_fixtures`)

> (from the analysis's suggestion list, "all that sounds good, proceed")

- **`routing.spec.ts`:**
  - Its file-wide `test.use({ startAt: null })` (line 8) sends all 48 tests through the front door.
  - Keep the UI way in only for the tests that are about the front door, the hunts list or making a
    hunt. Move the rest to the default fresh-hunt fixture (`enterFreshHunt`, `e2e/support.ts:239`).
- **`reviews.spec.ts` and anything else that adds a member through the Members panel:**
  - Use an admin call (`testing:addMember`, on the pattern of `makeHunt` in `e2e/admin.ts`) except
    in the tests that are about the Members panel.
  - Where several tests need a second visitor (`otherVisitor`), a worker-scoped second ident if that
    is safe.
- **Coverage must not shrink:** every UI path a moved test used to walk is still walked by at least
  one test. Say which in the thread file.
- **Measure:** test-seconds for `routing` and `reviews` before and after (`pnpm e2e <spec>`).
- **Touches:**
  - `e2e/routing.spec.ts`, `e2e/reviews.spec.ts`;
  - `e2e/support.ts`, `e2e/admin.ts`;
  - `convex/testing.ts`.
- **Depends on:** nothing (thread 2 touches the run, not the specs).
- **Proof:** `pnpm e2e --touched` reaches these specs. Add any spec the new fixture touches.
- **Look-ahead:** none beyond thread 2's note on `convex/testing.ts`.

### 4. Narrow two Convex reads: `questions.open` and `makeHuntFor` (`convex_reads`)

> 3. fix questions.open and makeHuntFor. sortQuestions is being worked on elsewhere.

**`questions.open`:**
- Today it reads `widgetingsOf(question.quiz_id)`, the quiz's whole widgetings range, then each
  widgeting's cell history. A write to any widgeting therefore reruns every question's watch.
- **Goal:** a question's watch reads only that question's rows, so it reruns only when that
  question, or what was stored for it, changes.
- **One way:**
  - read `widgeteds` by `question_id` alone (the `by_question_id_and_widgeting_id` index, prefixed
    on `question_id`), newest first per widgeting;
  - send the cells keyed by `widgeting_id`;
  - let the browser resolve ids to labels through the frame, which already reads the widgetings.
    That means the frame sends each widgeting's id; today `widgetingFrom` drops it.
- **Mind:**
  - `historyIn` reads only as far as the newest `ok` row. Keep that bound per cell, or bound the
    whole read (`notes/convex.md` on caps: a read never silently drops a row);
  - widgeteds left behind by a deleted widgeting (does `deleteWidgeting` delete them? check);
  - only stores (never `jsonata`) have rows;
  - the reviewer's path, which reads nothing stored.
- If the read cannot be narrowed without a schema change, or the result keyed by id ripples too far
  through `rows.ts`, say so and pick the smaller win.

**`makeHuntFor`:**
- It reads every hunt (`huntsOf`, `take(PA.HuntsInApp.max)`) to check the app-wide cap, so every
  hunt creation conflicts with every other.
- **Goal:** a hunt creation reads only what it must. Weigh:
  - counting through an index with a bound (`take(max + 1)` on a narrow index still reads rows);
  - a counter (`@convex-dev/aggregate` or the sharded counter: library first, but it may be
    heavier than one cap deserves);
  - whether the app-wide cap can be checked more cheaply some other way.
- Record the choice and why.

- **Measure:** reads per call before and after, in a `convex-test` unit test if it can count them.
  Also show that a widgeting write no longer touches a question's read set, by a test or by
  reasoning recorded in the thread file.
- **Touches:**
  - `convex/questions.ts`, `convex/reading.ts`, `convex/writing/account_actions.ts`;
  - `src/lib/rows.ts` (`seenQuestionFor`, `frameOf`, `quizFromSeen`, `widgetingFrom`);
  - their tests;
  - `convex/_generated/` if a module's exports change.
- **Depends on:** nothing.
- **Look-ahead:**
  - Thread 6 rewrites how `useQuiz` assembles questions (`assembledQuiz`, `quizFromSeen`). If this
    thread changes the reading's shape (cells keyed by id), keep the change at the projection in
    `rows.ts`, so thread 6 works on one shape.
  - The Coach's keyed-widgetings thread, elsewhere, also reshapes widgetings data. Keep the change
    small and local, and note in the thread file where it would meet that work.

### 5. Low-hanging fruit: caches in `src/lib`, folded panels unmounted (`render_caches`)

> 2. Do all the lowhanging fruit like memoizing templates on their inputs, unmounting.

**Templates and markdown:**
- Liquid parses each template once: liquidjs's own `cache` option, or a bounded cache by template
  text, in `src/lib/liquidry.ts`.
- `faceOf` (`cells/markdown.tsx`) and `useFace` are memoized on their inputs.
- `MarkdownFace` and `MarkdownText` are memoized on their text, so `ReactMarkdown` parses only
  what changed.

**Template data (`bagOf`, `src/lib/templating.ts`):**
- The same run and question give the same object: cached per run in a `WeakMap`, the way
  `WorkedOf` and `FinishedOf` already are. Then a memo keyed on it can hit.

**Panels:**
- A folded panel's body is unmounted (`Collapse` with `unmountOnExit`, `panels/Panel.tsx`).
- `ExportImportPanel` builds only the tab on show: `filledQuiz`, `sheetsExport` and the like move
  into the tab's own component, or into a `useMemo`.
- Check `Panels.tsx` for any other panel that works while hidden.

**The timebox (`boxed`, `src/lib/formulas.ts:91-100`):**
- Keep checking depth on every node.
- Read the clock only every N entries, with N chosen so the time limit still holds to within a few
  milliseconds.

**`ChainPicker` (`cells/chain.tsx:34`):**
- Build the options list once per quiz and share it, not once per row.
- If that needs the row's props reshaped, leave it to thread 6 and say so.

- **Measure:** `runQuiz` plus one full Workbench render for a 40-question fixture
  (`fixtures/` holds sample quizzes), before and after. A vitest bench or a timing in a unit test is
  fine.
- **Touches:**
  - `src/lib/liquidry.ts`, `templating.ts`, `formulas.ts`;
  - `src/components/cells/markdown.tsx`, `use-face.ts`, `fields.tsx`, `chain.tsx`;
  - `src/components/panels/`.
- **Depends on:** nothing.
- **Look-ahead:**
  - Thread 6 puts `memo` on `QuestionRow` and stabilizes its props. Shape the caches so a row
    handed the same question and run gets the same bag and faces back.
  - Don't reshape `QuestionRow`'s props here beyond what a cache needs: that is 6's.

### 6. One change, one row: stable question identity, `memo` on rows, state moved down (`stable_rows`)

> (from the analysis's suggestion list: "Stable question identity in `useQuiz`, `memo(QuestionRow)`,
> and `unsaved`/`asking` moved out of Workbench's state"; the Coach: "all that sounds good, proceed")

**Stable question identity:**
- `useQuiz` (`src/state/use-quiz.ts`) reuses the previous `QuestionT` for every question whose
  reading, and whose chain target, are unchanged. Cache per question, keyed by the reading object,
  which Convex keeps stable per watch even though the record around it is new.
- The `QuizT` is new only when something in it changed.
- The hunt feed assembles the quiz with the same function (`hunt-feed.ts:613`); let it share the
  win if that is natural.
- Note `useQuiz`'s `setHeld` during render (`use-quiz.ts:49`), which renders the route twice per
  change; keep that pattern only if it is still needed.

**`memo` on rows:**
- `QuestionRow` (and any other per-row or per-cell component that pays) is wrapped in `memo`.
- Its props stay stable from one render to the next:
  - callbacks that take an id, made once with `useCallback`;
  - the row's own slice of `run` and its chain target, not the whole run and the questions list;
  - no inline object literals.

**State moved down:**
- `unsaved` (`writing` in `useHunt`) and `asking` (`inFlight` in `useAsking`, held in Workbench)
  stop re-rendering the tree.
- Only what shows them reads them: a small store read with `useSyncExternalStore`, or a context
  whose value only those readers consume. Reuse whatever pattern `src/state` already has (the
  alarms context, for instance) before inventing one.

**`runQuiz`:**
- Still reruns whole whenever the quiz changes. That is the dependency-graph question, which is
  held. Don't attempt it.
- But a re-render with an unchanged quiz must not rerun it. It already doesn't; keep it so.

- **Measure:** renders per committed edit of one question in a 40-question quiz (rows rendered,
  and full-tree renders), before and after. The target is about one row plus the frame.
- **Touches:**
  - `src/state/use-quiz.ts`, `use-hunt.ts`, `use-asking.ts`, perhaps `hunt-feed.ts`;
  - `src/lib/rows.ts` (`quizFromSeen`, `assembledQuiz`);
  - `src/components/Workbench.tsx`, `QuestionTable.tsx`, `QuestionRow.tsx`, `cells/`.
- **Depends on:** thread 5, which owns the caches a row's memo depends on and `cells/` overlaps.
  Also on thread 4 if 4 changes the reading's shape in `rows.ts`: check the progress document when
  cut, and if 4 is still underway and touches `quizFromSeen`, wait for it.
- **Proof:** e2e `--touched` reaches the grid specs; a full run is likely, since this touches what
  every quiz page renders.

## For the Coach

* **The keyed-widgetings thread you have running elsewhere overlaps threads 4 and 6** in
  `src/lib/rows.ts` and the widgetings' shape. Whichever lands second rebases; thread 4 is told to
  keep its change local.
* **React Compiler** would cover much of thread 6's hand-placed memo. It's a *Discuss* item, not
  part of this sprint. Thread 6 will say whether it would have helped.
