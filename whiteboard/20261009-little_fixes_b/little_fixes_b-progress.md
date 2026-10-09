# Little fixes B: progress

The orchestrator's document. Newer than `little_fixes_b-plan.md` wherever the two disagree. Each
worker writes its own `thread-<N>-<label>.md` beside this file.

**Status: done, 2026-10-09. All four threads landed: #212, #214, #216, #217 (one stack, on #204). Closing proof: full e2e, 293 passed, 0 failed, on thread 2's landing. See `human/20261009-sprint_little_fixes_b_done.md`.**

Sprint doc (live mirror): https://claude.ai/code/artifact/8cc61164-58c9-4990-b805-f640ae8d3d7b

## Status

| Thread | Label | Status |
|---|---|---|
| 1. Gearbox: (i), entries note, remove-with-confirm, unique ids | lfb_gearbox | landed #212 |
| 2. Gearbox: rows line up, icon grammar | lfb_rows | landed #217 |
| 3. Panels: fold cycle, raw export, quiz export, tabs | lfb_panels | landed #214 |
| 4. Top bar, account, small removals, percent | lfb_topbar | landed #216 |

## What the threads have taught

*Review:* thread 1 (#212) -- **clean**, no fixes. Left, minor: `ColumnRefField` shows both items selected when one source is listed under two groups (cosmetic); an open archived-question delete still sends if revise permission lapses mid-question (the server refuses). Thread 1's `--touched` reached the whole suite (282 + 6 rerun green), so it counts as the sprint's first full run. Flakes: two in `entries.spec.ts`, two in `panels.spec.ts`.

*Review:* thread 3 (#214) -- **fixed**, two `fix:` commits: an imported quiz entry is now checked against the params the same paste revises its widgeting to (`quizEntriesCarried`); SpreadPanel's placeholder shares its one fold. Left, minor: a copy of a quiz with no questions imports nothing (`importInto`, predates the thread). Its `--touched` also reached the whole suite (285 + 5 rerun green). Flakes: `entries` (typed entry kept), `panels` (tabs in order; Copy; LL Export), `routing` (reviewer made smith).

*Review:* thread 4 (#216) -- **fixed**, three `fix:` commits: `entryParamsIssues` lays the kind's preset beneath the params it checks (a Percent at `{ min: 120 }` is refused); QuizRoute names no quiz to a visitor refused its mode; the account-menu spec says Escape to the menu. Left, minor: a Percent may be rebounded (worker's decision); the number field blocks typing past its max before the params widen (existing). The reviewer was refused a read-only grep of `use-hunt.ts` / `hunting.ts` by the permission check and did not work round it. Proved by the **full suite** (the sprint's second full run): 288 + 4 rerun green, plus three spec `fix:` commits (the switcher's menu reopens after a remount). Flakes: `importing` (explicit null), `panels` (LL Export's mode), `reviews` (smith's note folded), `widgets` (a column added for anything). Cosmetic: switching quizzes remounts the route, so the quiz crumb blinks and an open switcher closes.

*Review:* thread 2 (#217) -- **fixed**, one `fix:` commit: the readout toggle's tooltip said "as" twice. Checked sound: Templated is one state with the Templates section; the readout cycle round-trips with the select; `foldTo`'s Collapse wait. Left, minor: toggling Templated on two columns within one round trip can lose the first nomination (`set_templateable` sends the whole list; the Templates section had the race already; needs an optimistic update or add/remove actions); the folded toggle's unset wording is less specific than the select's. Proved by the **full suite**, the sprint's closing proof: 293 passed, 0 failed, no flakes, on `517b529c`.


* *Orchestrator:* **Thread 1 built `InfoTip` and `ConfirmRemove` as the standards** (`notes/views.md` names them). `InfoTip` (`src/components/InfoTip.tsx`): an (i) icon button with a Tooltip, one dense size; `Explained` wraps a field with one; `ExplicitField` takes `about`. `ConfirmRemove`: a text form and a bin form, same size, whose confirm is a Popover over the button (Keep where the button was). Threads 2 and 3 use these; e2e specs answer it with the helper `answerRemoval`.
* *Orchestrator:* **`categories` is already a reserved label** on the spine (#209, the columnwise backfills), so the plan's question to the Coach about bag-word labels is settled. Thread 1 fixed the menu for old rows (`refChoicesOf`, `choiceKeyOf`). DOM ids in the editors are `useId`, already scoped.
* *Orchestrator:* **Left for thread 2's sweep**: the new-entry picker's helper text, LL Export's smith's-note paragraph, the panels' blurbs; and "Reorder <label>" / "Widgeting <label>" each appear twice in the gearbox, since a widgeting and its column share a label by default.
* *Orchestrator:* **Thread 3's fold is `src/components/use-fold.ts`**: `FoldT = folded | open | big`, pure `nextFold` / `toggledFold` / `embiggenedFold`, and `useFold`. `Panel` takes `fold` / `onFoldChange` (no more `widened`). Panel ids come from `useId`. Thread 2 reuses the hook if it double-clicks titles.
* *Orchestrator:* **Thread 3's quiz copy** is `Exporting.quizCopyOf`, under a *Whole hunt | This quiz* toggle on Raw Export; it carries the library widgets the quiz uses under `pub.widgets`, and import now enters quiz-wide `widgeteds` with `enter_quiz_widgeted`. Copying to a bare login is two pastes (Widgets tab, then Import).
* *Orchestrator:* **For the Coach**: the *Widgets* tab now sits right above the *Widgets* panel. Thread 3 suggests retitling the panel *At work* / *Widgetings*, or the tab *Widget library*.
* *Orchestrator:* **#209 retired `quiz.templated`**; the field is `quiz.templateable`, set by `set_templateable`. Thread 2's gloss is corrected.
* *Orchestrator:* **Thread 4's header lives outside the database connection**; pages feed it through `src/state/shown.tsx` (was `shown-hunt.tsx`): `useShowHunt`, `useShowQuiz`, `useShowQuizActs`, `useShowAccount`. The quiz switcher is a crumb opening a `Menu` of links; *New quiz* / *Lock quiz* carry icons (e2e helpers `newQuiz` by exact name, `switcherQuizzes`). `AccountMenu` is a `Popover` with your name (editable), @label, *Your hunts*, *Be someone else*, *About*.
* *Orchestrator:* **`percent` widens the widget row's `config` union** in `convex/schema.ts` (no backfill, no Serial Deploy; `_generated` unchanged). A seed widget *Percent* (`percentage`) reaches production only when the Coach runs `seeding:seedWidgets` there (`human/20261009-lfb_topbar.md`).
* *Orchestrator:* **2026-10-09, about 10:00 UTC: an API session limit stopped threads 2 and 4 mid-step**; resumed at 11:10 with their context. Thread 4 had caught up and repaired two specs, clean, just before its full e2e run; thread 2 had asks 3 and 4 committed and its InfoTip sweep uncommitted in its worktree.
* *Orchestrator:* **Thread 2** built `RowSlots` (`src/components/room.ts`), `WidgetingTitle`, `FormularyMark.tsx` and the `FormularyIcons` map (by formulary: sigma, robot, keyboard, braces; `percent` takes entry's keyboard), and `ColumnToggles.tsx` (readout cycle, Templated, Collapsed). `Panel`, `TabbedPanel` and `ClosableTitle` take `about` (an (i) in the title bar); `blurb` stays only for news. The e2e helper `foldTo` now waits for a Collapse to finish opening (a race the blurb removal exposed). Left for the Coach: whether `Footnote.tsx`'s chain paragraph, `HuntsList`'s blurb and the login gate's guidance go behind an (i); whether "Reorder <label>" names are scoped by list.
