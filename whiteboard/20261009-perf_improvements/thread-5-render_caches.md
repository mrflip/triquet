# Thread 5: render_caches (2026-10-09)

Branch `20261009-render_caches`, PR filed at landing; see the report. Suites: `pnpm justify` green
(5664 unit tests). A first e2e run of the branch (which `--touched` made the full suite) went 254
of 288; all 34 red were this branch's and are repaired (below), and each repaired spec passes.

* **Built**:
  - `src/lib/liquidry.ts`: each renderer reads a template once and remembers it by its text
    (`readerFor`: up to `ReadMax` 4096 templates or 4M characters, then forgotten all at once and
    begun again), a template that will not read included. `render`, `issueOf` and `globalsOf`
    share it.
  - `src/lib/formulas.ts`: the timebox (`boxed`) checks depth at every step, as before, and reads
    the clock once every `StepsPerReading` (256) steps rather than twice a step.
  - `src/lib/templating.ts`: `bagOf` (and `filledBagOf`, and every bag `bagOver` makes) hands back
    the very same bag for the same run and question (`BagsOf`, a `WeakMap` by the run's
    questions), and what the bags of one run share (`quiz`, `qns`) is made once.
  - `src/components/cells/`: `useFace` memoizes `faceOf` on its text and bag; `MarkdownText` and
    `MarkdownFace` are wrapped in `memo`; `ChainPicker`'s options are made once for every picker
    of a quiz (`chainOptionsOf`, a `WeakMap` by the `questions` array), each picker filtering out
    itself and the archived.
  - `src/components/panels/`: a `Panel`'s body is built the first time it is opened
    (`Collapse`'s `mountOnEnter`) and kept after; `TabbedPanel` builds a tab when it is first shown
    and keeps the tabs left; the Spreadsheet and LL Export tabs work out their text inside their
    own components (`SheetsExport`, `FilledLeagueExport`); the Recap panel's work is in
    `RecapBody`. A paste sent from another quiz's Import is now read by `useArrival`
    (`ImportForm.tsx`), called by `ExportImportPanel`, so it is still read as the quiz opens with
    the panel folded.
  - Measuring: `tests/support/big-quiz.ts` (`bigQuiz()`, forty classic-layout questions, chained,
    spotters answered, clueing and notes templated; `bigHuntFor`, `smithClaimsOn`), and
    `tests/components/Workbench.bench.tsx`, run by
    `pnpm vitest bench --run --project 'unit (bench)' --reporter=default Workbench` (never part of
    the unit suite). `eslint.config.mjs` gains `triquet/benches`, turning off `expect-expect`,
    which reads each `bench(...)` as a test.
* **Measured** (the bench, 64 samples each, base and branch interleaved twice at load 6 to 10):

  | | before | after |
  |---|---|---|
  | `runQuiz`, 40 questions | 49.1 to 49.3 ms | 36.3 to 39.4 ms |
  | Workbench rendered whole, run included | 209.8 ms | 125.2 to 130.6 ms |
  | clock reads per `runQuiz` | 117,143 | 1,853 |
  | timebox overrun past a 20 ms deadline (median, p90, max) | 0.05, 0.2, 0.3 to 1.9 ms | 0.14, 0.7 to 1.2, 2.1 to 4.1 ms |

  A CPU profile of twenty renders, before: per render, `runQuiz` 46 ms, the folded Recap panel's
  note 30 ms, the hidden LL Export tab 18 ms, markdown parsing 14 ms, `ChainPicker` 3.3 ms. After:
  the panels' share is gone, `ChainPicker` is 0.9 ms. The bench renders on the server
  (`renderToString`), so it shows a first render only; the memos (`useFace`, `MarkdownText`,
  `MarkdownFace`) pay on re-renders, which it cannot see. The bench's module runner makes each read
  of `clockNow` dearer than a browser does, flattering the `runQuiz` gain a little.
* **Decisions taken**:
  - **`mountOnEnter`, not `unmountOnExit`**: the plan named unmounting, but the panels hold state
    a person would lose (the Import and Library pastes and logs, the Members form, LL Export's
    mode, the spread table's sort, a copy's note), and `Panel` and `TabbedPanel` promised
    to keep it. Built on first open and kept after, a panel nobody opens costs nothing, and one
    opened behaves as before.
  - **The parse cache is a `Map` of our own**: liquidjs's `cache` option holds only templates read
    from files, and its LRU is not exported. Recorded in `notes/stack.md`, *Hand-rolled on
    purpose*, beside JSONata's and the regexes' caches, with `lru-cache` named for a fourth.
  - **`faceOf` is memoized per box (`useMemo`), not in a module cache**: a cache by bag would hold
    a face for every draft typed into a templated box.
  - **256 steps a reading**: a step is about a microsecond, so a reading every quarter
    millisecond; measured above, still within a few ms.
* **Deviations**:
  - What is in the console: a recap template that will not fill is reported once the Recap panel
    is first opened, no longer as the page opens. Nothing on screen changes.
  - A folded panel never opened holds no body, so its triangle's `aria-controls` names nothing
    until then, as MUI's Accordion does with `unmountOnExit`.
  - Two e2e changes: `showTab` (`e2e/support.ts`) found a folded panel by the hidden tab it held,
    and now opens the Export / Import panel by its title (33 of the 34 red). One spec,
    `widgets.spec.ts` (*a column can be added for anything...*), typed into a relabelled column's
    panel before the relabel landed; it won only while every change cost a slow render (slowing
    each render by 80 ms made it pass again here). It now waits for the relabel, as
    `notes/testing.md` asks.
  - Two unit tests model time as clock readings (`ticking` in `runner.test.ts`, the column's in
    `columns.test.ts`); each reading now stands for `StepsPerReading` steps.
* **Discoveries**:
  - Faster renders exposed a spec racing the server; others may race the same way. A **full e2e
    run at landing** is the safer proof.
  - For thread 6: a row handed the same run gets the same bag (`Templating.bagOf`), and so the
    same faces; `ChainPicker` reuses its options while `quiz.questions` keeps its identity.
    `QuestionRow`'s props are untouched. `bigQuiz()` is there to measure on.
  - The unit project has no DOM, so a re-render cannot be counted there; thread 6 needs a DOM
    (`happy-dom`, a dev dependency to propose) or an e2e probe. In `whiteboard/TODO.md`.
  - What is left of a render: JSONata's evaluation (most of `runQuiz`, the O(n²) lookups held out
    of this sprint), markdown on a first render, and a panel opened and folded again, which still
    renders with every change (React's `<Activity>`, in `whiteboard/TODO.md`).
* **For the Coach**: the `mountOnEnter` choice over the plan's `unmountOnExit`; the recap
  template's console report waiting for the panel; the new *Hand-rolled on purpose* entry.
