# Thread 3: Panels: the fold cycle, the raw export, the quiz export, the tabs (2026-10-09)

Branch `20261009-lfb_panels`, PR filed at landing; see the report. Suites: `pnpm justify` green
(two earlier runs lost `tests/scripts/git-attic` and `automerge` to timeouts at a load near 50;
they pass alone); `e2e/panels.spec.ts` and `e2e/importing.spec.ts`
green, two of panels' tests flaking under load in `preparedExport` and passing on rerun.

One commit per ask, in the order the Coach listed them (the first two share a commit, being one
state):

* **Built**:
  - **The fold cycle** (`src/components/use-fold.ts`): `FoldT` = `folded | open | big`, the pure
    turns `nextFold` (the double-click cycle; `bigOffered` false skips big), `toggledFold` (the
    fold button: a big panel folds outright), `embiggenedFold` (the arrows: big from folded or
    open, open from big), and `useFold(initial, { bigOffered, held })`. `Panel` is built on it:
    a double-click on its title turns it folded, open, big, folded; a page's own panels and the
    row's whole-row-wide ones (`wide`) cycle folded and open alone. `Panel`'s `widened` /
    `onWidenedChange` became `fold` / `onFoldChange` (SpreadPanel, the one holder, grows its
    chart when `fold === 'big'`). "Big but folded" can no longer be.
  - **Panel ids**: `panel-${title}` became React's `useId()` (`-heading`, `-body`), which is drawn
    from the component's place in the tree: the parents' chain, as thread 1's rule asks.
  - **Raw Export's stand-in** (`ReadonlyBoxStandIn`, `boxHeightPx`, in `ReadonlyBox.tsx`): before
    the hunt is read, an empty finely outlined box half the box's height, and the Prepare button
    in the row where Copy will be. The Export / Import panel's boxes (Spreadsheet, Raw Export,
    the quiz copy, the library's, LL Export's) take `resizable`: a native resize grip.
  - **Widgets tab**: the Library tab is titled Widgets; blurbs and doc blocks follow. Its boxes
    keep their names (*Library export*, *Import library*).
  - **The quiz export** (`Exporting.quizCopyOf`): Raw Export has a *Whole hunt | This quiz*
    toggle (`ToggleButtonGroup`) above its box, the hunt first. This quiz is `quizBodyOf` less
    `locked`, with the worked widgets' balls (`pub.widgets...`) merged at its root, no label:
    `Jsonball.quizzesIn` reads it as one quiz (shape `quiz`), `Jsonball.widgetsIn` as widgets. It
    is made from the screen, so it is never stale and needs no Prepare.
  - **Import carries the quiz's own entries**: `widgeteds` on a pasted quiz (new optional
    `PastedQuizT.widgeteds`) is typed back into the quiz-tier entry widgetings the quiz will
    have (`enter_quiz_widgeted`, after the widgetings and columns, before the questions), held
    to the widget's kind and the widgeting's params; a new `quizEntryLog` and summary clause.
    Whole-hunt Raw Exports carried these already and now import them too.
  - **Recap and Quiz entries** traded places in `Panels.tsx`.
  - Tests: `tests/components/use-fold.test.ts`, `tests/components/panels/ReadonlyBox.test.ts`,
    `quizCopyOf` and the copy's round trip in `tests/lib/exporting.test.ts`, `widgeteds` in
    `tests/lib/jsonball.test.ts`; e2e: the double-click cycle and arrows (`panels.spec.ts`), and a
    quiz copied into a new quiz's Import bringing questions, a column and a widgeting
    (`importing.spec.ts`, *a quiz copied*).
* **Decisions taken**:
  - The quiz export takes **two pastes** where the target library lacks its widgets: the Widgets
    tab first, then Import. That is the flow Import's blurb already prescribed, and it keeps
    Import from writing the shared library (a `change_library` act, ordered across two
    dispatchers). A one-paste Import that adds the missing widgets first is a reasonable
    follow-up if the Coach wants it.
  - A toggle rather than two boxes on Raw Export: one box's room, and the existing specs'
    `preparedExport` still finds the hunt's Prepare button by default.
  - Double-click on a panel title sets `userSelect: none` on the heading, so the gesture does not
    also select a word.
  - The resize grip is the native textarea grip (Decision 5), not a custom handle.
* **Deviations**: none from the plan. Pulled forward: nothing.
* **Discoveries**:
  - The "Widgets" tab now sits directly above the "Widgets" panel, and they read as alike: the
    tab is the shared library, the panel the widgets this quiz puts to work. Suggest retitling
    the panel *At work* or *Widgetings* (vocabulary's word for a widget put to work), or the tab
    *Widget library*, which is also the button's name over the grid. Screenshot:
    `panels-members-big-desktop.png`.
  - Thread 1 (`InfoTip`) had not landed when this was built, so the Raw Export and Widgets tab
    blurbs stay as microcopy for thread 2's sweep; the Raw Export blurb grew a sentence on
    copying a quiz elsewhere.
  - A quiz with no questions still cannot be imported (`importInto` refuses a paste holding
    none), so copying an empty quiz's widgetings and columns alone does nothing. Left as is.
  - For thread 2: `use-fold.ts`'s pure turns work on any fold, including a `FoldSet`'s rows; a
    row that holds only a boolean today can hold a `FoldT` instead.
  - Screenshots, desktop and 420px, in the thread's scratch directory
    (`.../scratchpad/lfb_panels/`): `raw-unprepared-*`, `raw-prepared-*`, `raw-quiz-*`,
    `widgets-tab-*`, `panels-members-big-*`.
* **For the Coach**: whether the Widgets tab and Widgets panel want telling apart (above); and
  whether the quiz copy should import its widgets in one paste.
