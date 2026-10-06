# Thread 5: A path-to-spec map, `pnpm e2e --touched`, and a scoped proof the bid accepts (2026-10-06)

Branch `20261006-e2e_touched`. PR filed at landing; see the report. Suites: `pnpm justify` green;
the smoke tier ran green on lane 3. The full e2e proof comes at landing, since the branch changes
scripts the suite runs through.

## Measurement

| Run | Tests | Test-seconds | Wall | Load at start | Cache |
|---|---|---|---|---|---|
| `pnpm e2e:smoke` (lane 3, 11:52) | 26 (23 smoke and the 3 setup tests) | 111 | 30 s, 7 workers | 6.1 | seeded |

The plan guessed about 40 s for the smoke tier. It took 30 s, roughly a fifth of a full run.

* **Built**
  * **The map.** `SpecCorners` sits in `scripts/spine.ts`, beside `UnwatchedRules`. It is an ordered list of `{ corner, paths, specs }`, and the first match wins.
    * A path in it is a file or a prefix (`src/lib/ask/`, `src/components/panels/spread-`).
    * A path no rule names reaches the whole suite.
    * A spec file reaches only itself.
    * A path e2e cannot notice reaches nothing.
    * Functions: `reachOf`, `scopeOf`, `reachingWhole`, `outsideScope`.
  * **`pnpm e2e --touched`.** It prints the corner each changed path chose, before the suite starts, so you can stop it if you disagree. Then:
    * if every path maps to a corner, it runs their union as a `touched` run;
    * if any path reaches the whole suite, it runs everything as a `full` run;
    * if nothing reaches e2e, it runs nothing and says how to land.
    * A mapped spec file that is not there is skipped. A corner with none of its spec files there reaches the whole suite.
  * **The scoped proof.** The tally gains `scope`. `proofOf` takes a scoped proof while `outsideScope` finds nothing. Otherwise it refuses and names the paths; with `--skip-e2e "<why>"` it takes the skip path instead, as if there were no proof. Reruns keep the scope, and a full run drops it.
  * **The smoke tier.** One test of each of the 23 spec files is tagged `{ tag: '@smoke' }`. Only the option was added: no test was renamed or moved. `pnpm e2e:smoke` is `e2e --grep @smoke`, logged as a `chosen` run, never a proof.
  * **Pulled forward from the ground rules: test-seconds.** The log entry gains `test_seconds`: every result's duration, summed, retries and setup included (`E2eLog.testSecondsOf`). The run's line prints it. Each `pnpm e2e:log` row shows the mean, and touched runs get their own row.
  * **Documents.**
    * `notes/git_hygiene.md`: a new *Running only the corner*, between B's two choices and *When e2e is not worth running*. It names the smoke tier for what it is and says CI is the strict gate. *Finishing* B and D mention `--touched` and the scoped bid.
    * `notes/testing.md`: one `@smoke` test per spec file, and a new spec file goes into `SpecCorners`.
  * **Tests** (`tests/scripts/spine.test.ts`, `tests/scripts/e2e-log.test.ts`):
    * the map, case by case;
    * the scope and the refusal;
    * eight runs of the real script against a fake suite;
    * tripwires over the real tree: every map path exists, every named spec exists or is one of `stats` and `failing-pages`, every spec file sits in some corner, and every spec file has exactly one `@smoke` test.
* **Decisions taken**
  * `--touched` reads the committed changes since the branch's base, as the proof does. It takes no other arguments.
  * Prefix strings rather than globs: they are easier to read, and need no dependency.
  * A corner run that reaches the whole suite is logged and tallied as `full`, so the bid sees an unscoped proof.
  * **Smoke picks**, taking the furthest-walking test of each file and avoiding the known milestone flake:
    * alarms 7, archiving 120 (the gear un-archives), asking 53, bots 43, brand 8, categories 63;
    * chaining 99, client-first 26, entries 79, estimates 43, failures 42, grid 34;
    * importing 85, ishes 47, ordering 80, panels 203 (library out and in), prompts 72;
    * quiz-history 134 (the history survives a reload, not the milestone race), quizzes 46, reviews 26, routing 561, sheets 26, widgets 139.
* **Deviations** from the plan's map, after reading the imports (`src/` reverse import graph):
  * **To the whole suite:** `use-draft`, `use-session`, `offers.ts`, `postmortem`, `cells/fields` and `cells/markdown`. Every screen or every state hook imports them.
    * `offers.ts` is the Workbench's permissions, not asking.
    * `postmortem` is imported by a dozen hooks, not only `PageFailed`.
  * **Moved:**
    * `SortableList` → the gear (only the column and widgeting editors use it).
    * `QuestionTitle` → archiving and reviews (`ConfirmViz` and `ReviewsPanel` use it, the grid does not).
    * `CategoryWheel`, `PersonaCard` and `wheel-geometry` → categories alone: estimates never opens the wheel.
    * spread → estimates and panels.
  * **`cells/` split by file:**
    * `chain` adds reviews;
    * `readouts` adds the asking corner and widgets;
    * `answer-lock` → reviews;
    * `ErrBadge` → failures;
    * the entry cells → entries and estimates.
  * **Widened:**
    * `FoldButton` adds quizzes and reviews.
    * `use-reorder` → ordering, categories, widgets.
    * `QuizManageModal` adds archiving, categories, quiz-history.
    * `QuizRoute` adds reviews.
    * `HuntsList`, `HuntRoute` and `use-account-actions` add quiz-history.
    * `CategoriesRoute` adds routing.
    * The history lists (`HuntRepoList`, `OrphanedRepos`, `use-hunt-repos`, `huntgit`) add routing.
    * `models/review*` add the panels corner and quiz-history: `jsonball` carries reviews into the export and the history.
  * **Added:**
    * an alarms corner (`AlarmSnackbar`);
    * `MembersPanel` → routing;
    * `Panels.tsx` → panels, reviews, routing, estimates;
    * the brand files (`Logo`, `About`, the icons, `public/`);
    * `CopyButton`, `JsonFold`, `widget-words` and `room`, each to the corners that import it.
* **Discoveries**
  * Playwright runs the `environment` setup project under file filters and `--grep` alike, so touched and smoke runs still check the environment and warm the pages.
* **For later threads**
  * **Threads 3 and 4:** your spec files (`failing-pages`, `stats`) are already in the map. Tag exactly one test `@smoke`, or justify fails. A spec file with another name (say `collaborating.spec.ts`) must go into `SpecCorners` too, or the "every spec file sits in some corner" test fails.
  * **Thread 2:** my spec edits are one option added to one `test(` line per file.
  * **Thread 6:** the lock and its catch-up wrap the body of `e2e()`, from the `touchedPlan`/`{ kind: runKindOf(args) }` choice through `runSuite`, when `args` is empty or `--touched`. If the plan is chosen after the catch-up, the scope follows a top that moved.
* **For the Coach**
  * CLAUDE.md's step 3 and `.claude/agents/thread-worker.md`'s *Prove* still name only `pnpm e2e`. I left both: CLAUDE.md is yours, and the plan's documents were git_hygiene's. Whether a sprint's workers may prove with `--touched` is a policy call for you.
  * The map is judgment, and it leans conservative: unnamed means the whole suite.
