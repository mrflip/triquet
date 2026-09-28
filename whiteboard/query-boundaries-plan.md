# Query boundaries: the fixes

A plan for an agent, from the audit of 2026-09-28 (`whiteboard/audit-2026-09-28.md`, section 2).
The rules are in `notes/queries_hooks_and_subscriptions.md`; read it first. Each item below is
one commit on its own, with its own tests, and each one that moves a boundary is measured
before and after with the phase 4 harness (`whiteboard/convex_yay-progress.md`, *Measurements*:
database I/O per edit, bytes per browser per edit, a second browser watching).

Branch: `pnpm run newb query_boundaries`, off `main` once `20260928-audit_pass1` has merged.

## 1. Expression usage out of `hunts.open`

**Problem.** `hunts.open` (`convex/hunts.ts`) returns the hunt as a quiz's screen holds it, and
for each expression how many widgets across the hunt work it (`expressionUsageOf` in
`convex/reading.ts`). That count reads every widget of every quiz in the hunt, so the watch
reruns whenever any quiz's widgets change, and its read set grows with the hunt. The count is
shown in one place: the Expressions modal (`ExpressionsModal.tsx`, `usageNote`), and it decides
whether an expression may be removed (`ConfirmRemove`'s `refusal`).

**Change.**

* A new query function `expressions.forHunt({ hunt_id })` returning the hunt's expressions in
  order, each with its `usage` (`CountedExpressionT`). Reuse `expressionsOf` and
  `expressionUsageOf`; the projection is `expressionFrom` plus the count.
* `hunts.open` returns expressions without `usage`: `ShallowHuntT.expressions` becomes
  `readonly ExpressionT[]`. `shallowHuntOf` loses its `usage` argument.
* A hook `useCountedExpressions(hunt_id)` in `src/state/`, watched only by `ExpressionsModal`
  (which is mounted only while open). The widgets editor and `planExpressingEdit` read the
  hunt's expressions as before, without counts.
* `useHistoryFeed` in `use-hunt.ts` already strips `usage` before the mirror (`uncounted`);
  with no counts on the hunt, that step and `last.counted` go.
* `deleteExpression` on the server still checks usage in the transaction; unchanged.

**Tests.** `tests/convex/reading.test.ts` and a new `tests/convex/expressions.test.ts` for the
function; `tests/lib/rows.test.ts` for `shallowHuntOf`; the e2e expressions spec already
exercises the modal's usage note.

**Measure.** Database I/O of `hunts.open` per widget edit, before and after; and confirm that a
widget edit in quiz B no longer reruns quiz A's `hunts.open`.

## 2. Reviews are watched by the screen that shows them

**Problem.** `useHunt` watches `reviews.forQuiz` for every quiz screen, and `findingOf` will not
report the quiz as found until the reviews have arrived, so the smith's grid waits on a facet it
shows only in a panel at the bottom, and the review screen's facet is loaded even when nobody is
reviewing.

**Change.**

* A hook `useReviews(quiz_id)` in `src/state/`, returning `readonly ReviewedT[] | undefined`.
* `ReviewScreen` and `ReviewsPanel` (through `Panels`) call it themselves. `HuntHandle` loses
  `reviews`; `findingOf` loses its `reviews` argument; `Workbench` and `QuizRoute` stop passing
  reviews down.
* `ReviewsPanel` shows its "nothing shared yet" line only once the reviews have arrived; before
  that, nothing.

**Tests.** `tests/state/use-hunt.test.ts` (`findingOf` no longer waits on reviews); the e2e
reviews spec covers both screens.

**Note for the permissions phase.** `reviews.forQuiz` still hands every browser every review,
drafts included, and the smith's panel filters to the shared ones on the client. That is the
trial's rule and stays until the permissions phase; this item does not change it.

## 3. The quiz title commits on blur, like every other field

**Problem.** `QuizHeader.tsx` dispatches `retitle_quiz` on every keystroke as well as on blur.
Each keystroke is a mutation, and each mutation reruns `hunts.open` for every browser with the
hunt open (the title is on the quiz row the listing reads). Under Jazz this was a local write;
now it is a round trip per character.

**Change.** Drop the `onRetitle` call from `onChange`; `useDraft` already commits on blur. The
page title (`document.title` in `useHunt`) follows the committed title, one blur later, which
is fine.

**Tests.** The e2e quizzes spec asserts the title after a blur; check it does not rely on a
mid-typing update.

**Measure.** Function calls and database I/O for typing a ten-character title.

## 4. Replace the "never a query per row" guidance

**Problem.** Three documents still carry the line the code no longer follows:
`whiteboard/convex_yay-plan.md` (settled item 6), `notes/decisions/2026-09-convex.md` (*Rules
that follow*: "Never a query per row or per cell", and "a parent's children through the
parent's index"), and the history in `notes/stack.md`. The progress document lists them under
*Deviations*.

**Change.** Each line becomes a pointer to `notes/queries_hooks_and_subscriptions.md`, in a
sentence that states the rule as it now stands ("one watch per facet; components never
watch"). The decision record's *Rules that follow* keeps "every read goes through an index";
"a parent's children through the parent's index" becomes "a parent's children through the
parent's index, or by the ids the parent holds, as the questions are". Nothing under `convex/`
changes.

## 5. First paint, if the cloud makes it felt

**Problem.** A fresh tab paints its quiz after three round trips (socket, `hunts.open`, then
`quizzes.open`), and the per-question watches add one more before the grid fills. Measured at
225 ms locally and 400 ms at an 80 ms network; not felt locally.

**Change, only if the cloud numbers say so.** In `useQuiz`, a fetch of the quiz whole
(`hunts.whole` already exists; a `quizzes.whole({ quiz_id })` would be the narrower one) seeds
`held` while the per-question watches are on their way; `assembledQuiz` already returns
`undefined` until every question has arrived, and `held` already stands in. The wide function is
fetched once and never watched.

**Measure first.** Time to first grid on the cloud deployment, cold tab, sample-sized quiz.
Skip this item if it is under about 300 ms.

## Not in this plan

* Optimistic updates: the decision record says `move_question` first, after the cloud's numbers.
* `ConvexQueryCacheProvider` for instant switching between a realm's quizzes: worth trying on
  the cloud, costs bandwidth, needs its own measurement.
