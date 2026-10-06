# Thread 5: the map, read against the imports (2026-10-06)

Where `SpecCorners` (`scripts/spine.ts`) departs from the plan's map gloss, and which test of each
spec file carries `@smoke`. Read this before moving a file between corners, or a tag between tests.
The map was checked against a reverse import graph of `src/` and a reading of every spec's tests. The
review's changes (the quiz screens' way in and the history mirror, both sent to the whole suite) are
in `thread-5-e2e_touched.md`, *Decisions taken*.

## Departures from the plan, after reading the imports

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
  * The history lists (`HuntRepoList`, `OrphanedRepos`, `use-hunt-repos`) add routing.
  * `models/review*` add the panels corner and quiz-history: `jsonball` carries reviews into the export and the history.
* **Added:**
  * an alarms corner (`AlarmSnackbar`);
  * `MembersPanel` → routing;
  * `Panels.tsx` → panels, reviews, routing, estimates;
  * the brand files (`Logo`, `About`, the icons, `public/`);
  * `CopyButton`, `JsonFold`, `widget-words` and `room`, each to the corners that import it.

## The smoke picks

Spec file and line of the test tagged `@smoke`:

* alarms 7, archiving 120 (the gear un-archives), asking 53, bots 43, brand 8, categories 63;
* chaining 99, client-first 26, entries 79, estimates 43, failures 42, grid 34;
* importing 85, ishes 47, ordering 80, panels 203 (library out and in), prompts 72;
* quiz-history 134 (the history survives a reload, not the milestone race), quizzes 46, reviews 26, routing 561, sheets 26, widgets 139.
