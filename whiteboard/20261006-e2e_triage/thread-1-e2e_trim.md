# Thread 1: Trim the vacuous and duplicate specs, and mend the practice gaps (2026-10-06)

Branch `20261006-e2e_trim`. PR filed at landing; see the report.
The review added one commit: `failures` "never a code" now also refuses the stub's error name and status. Suites: `pnpm justify` green
(4399 unit tests), and `pnpm e2e` proved: 239 passed, no flakes in the proving run. One known flake turned up during the build (below).

**No spec file was deleted or merged.** Thread 5's map can name the same 23 spec files as before.

## Measurement

| | Tests | Test-seconds | Wall | Load | Cache |
|---|---|---|---|---|---|
| Before (progress baseline, lane 1, 10:09) | 259 | 1006 | 157 s, 7 workers | 2 at start | seeded |
| After (proving run, lane 1, 11:30) | 239 | 942 | 149 s, 7 workers | 3.2 at start, 10.6 at end | warm |

`e2e/` now holds 236 `test(...)` calls, down from 256. The 259 and 239 count the setup project as well. The mean test is unchanged at 3.9 s: the twenty cut were average tests, so the saving is about 64 test-seconds (6%). Wall time barely moves, since the run is bound by its slowest workers. Thread 2's way in is where the time is.

* **Built**
  * Twenty e2e tests deleted, each one named in the plan.
    * `panels`: Refresh export, the LL mode tooltip, the Full History help dialog, and "every read-only box has a Copy".
    * `sheets`: "clicking the box selects the lot".
    * `grid`: "opens with blank questions" and "never scrolls sideways".
    * `widgets`: "a text column shows text" and "a column keeps what it shows after a reload".
    * `bots`: the credentialed invitation.
    * `asking`: "network off" and "a failure reads as a sentence".
    * `reviews`: "asks before revealing".
    * `quiz-history`: the gear zip, "editing builds a history a milestone can tag" and "a milestone marks the edit made a moment ago".
    * `archiving`: "the corner button leaves batch mode".
    * `categories`: "says so for a hunt there is not".
    * `ordering`: "a decimal Q#".
    * `ishes`: "an uncomputed sum reads as a dash".
  * The mends the plan named. Pixel literals now assert what they stand for:
    * the open row's box against a folded sibling's;
    * the snippet's height against its own line-height;
    * the folded long row against the blank fifth;
    * the corner's fold and batch button against the corner's own computed padding and border.
  * `stubIshes` goes through `stubAsk`. The one-shot reads in `sheets` and `quizzes` are now `expect.poll` and `toHaveURL`.
  * `human/20261006-vapid_tests.md`: the nominations.
* **Where a covering test fell short, the missing claim was folded in.** I checked each deletion against the test said to cover it.
  * `grid` "starts lean" now asserts five blank clueings.
  * `grid` "the corner's fold" now proves the sideways claim for real: the viewport narrowed to 700, the grid wider than that, and the page not scrolling.
  * `panels` "a refused clipboard" now covers both select paths, the refused Copy and a click on the box, with the selection spanning the whole value.
  * `widgets` "changing a widget's formula" now goes from a number to text (`$uppercase`), and asserts both columns after the reload.
  * `asking` "a never-asked cell" gains `toBeEnabled`.
  * `client-first` "asking is the one server function" now also edits a title, sorts by it, and finds it after the reload.
  * `failures` "a cell that has only ever failed" gains "Double-click to try again", and no failure code in the cell.
  * `reviews`: the verdict test gains the "Reveal the answer?" heading, and the answer hidden after "Hide answer".
  * `quiz-history` "an edit commits only the files it changed" gains:
    * the gear's zip name;
    * the full milestone tag pattern;
    * the tagged file holding the edit.
  * `archiving` "a button to change how a question is shown" gains:
    * `aria-pressed` and the select-all checkbox, on entering batch mode;
    * on leaving it, `aria-pressed` false, no checkbox, no change buttons, and the grips back.
  * `ordering` "Renumber Q#" asserts the order before the renumbering as well as after.
* **Decisions taken**
  * Refresh export is dropped, not reworked. A refresh that shows a change needs an edit to another quiz made by someone else: an edit on screen withdraws the box, and so does opening the other quiz. A second browser for one button was not worth it.
  * Of the two selection tests, I kept the one in `panels`, with the click path folded into it. It also asserts the "Selected" notice, which is the "never silence" half.
  * The widget usage test now makes a widget of its own (`freshWidgetLabel`) and asserts the exact sentence, "Worked by 1 widgeting across 1 quiz, in 1 hunt." The plan asked for `toContainText` floors on a shared widget. Exact counts on a private widget are stronger and cannot drift with the other specs.
  * The `sheets` header test drops its `toSorted` self-comparison: the alphabetical literal it is compared to already pins the order.
* **Deviations**
  * **No unit test for the dash.** The plan said to move "an uncomputed sum reads as a dash, never as a zero" to a unit test of the readout. Both halves are already covered:
    * "never as a zero" is the formula's job, and `tests/lib/formulary/runner.test.ts` pins it ("read a never-asked cell as missing, not as nought").
    * The dash drawn for a missing sum is asserted in e2e by `ishes` "BUT NOT ishes mirrors the chained-to hint" (`toHaveText('–')` before the ask).

    A readout unit test would also be the repository's first React render under Vitest: a `.tsx` include and an environment choice, made for one `status === 'missing'` branch. I judged that a test of React rather than of our code, the kind this thread is trimming. Thread 4 may want React rendering for `SyncUnconfigured`; if it adds it, a dash case is one line there.
* **Discoveries**
  * **A known flake, reproduced.** `quiz-history` "an edit commits only the files it changed ..." failed once among 7 workers: the milestone tagged the start commit, not the title edit. It passed alone three times, and in two runs of the whole spec. The e2e log already lists it as the suite's most frequent flake.
    * `HuntMirror.milestone` waits on the tab's writes and on the feeds, but the feeds only up to `ReadWaitMs` (5 s).
    * Under load, a milestone can therefore mark the state from before the edit. That is a product race, not the spec's.
    * Folding the two deleted milestone tests into this one does not change its odds: they made the same claim the same way.
    * I did not add a wait to hide it.
  * `pnpm lane` prints pnpm's own "All packages are on the main lane." rather than the lane; `node scripts/lanes.ts lane` prints `1`.
* **For the Coach**
  * The vapid-test nominations: `human/20261006-vapid_tests.md`. The e2e list is short (seven). The unit list is mostly one pattern: one `it` per member of a constant, such as the 19 per-kind lock refusals.
  * The milestone race above: whether `ReadWaitMs` is the right floor under load is a product question.
