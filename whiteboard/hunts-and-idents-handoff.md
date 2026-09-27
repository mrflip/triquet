# Hunts and idents: handoff after PR 3

For the agent picking up at PR 4 (reviewings) of `whiteboard/hunts-and-idents.md`. The plan still
stands; this is what building PRs 1 through 3 taught, and where the built code differs from the
plan. Read `notes/vocabulary.md`'s *Playtesting* section too -- `review` and `phase` are built;
`reviewing` is only named there so far.

## Where things stand

* **`20260927-hunts_playtesting` holds PRs 1 through 3**, three commits for PR 3: the reviews
  table and its actions, the review screen and the panel, and the e2e spec. Unit (1983), lint,
  type, migration and e2e (152) suites green. Neither PR is merged or deployed.
* **The e2e database was reset before this PR's run** (`./scripts/doppledo dev_e2e
  ./scripts/nuke-jazz_local`, no e2e server running) because the migration added a table. Expect
  to do the same before PR 4's first e2e run, per the note below.
* PRs 1 and 2 must still deploy together with PR 3, or the author's existing `playing` widgets
  break and reviews will have no `reviews` table to write to.

## The shape PR 3 left

Read these before adding reviewings; PR 4 plugs into all of them.

* **Rows.** `HeldRows`/`HuntContents`/`QuizRows` (`state/quiz-rows.ts`) all gained a `reviews`
  field, scoped and subscribed exactly like `bottings`: `huntQueries` adds `app.reviews.where({
  quiz_id: { in: quiz_ids } }).orderBy('$createdAt')`, `use-held-rows.ts` subscribes and keeps it
  through `useKept` the same way. `quizRowsOf` filters a quiz's reviews out of the held rows.
  `reviewRowFor(reviews, ident_id)` finds one ident's review, taking the earliest should two
  exist -- it relies on the query's own `orderBy('$createdAt')`, the same trick `huntRowFor` plays
  off `DirectoryQueries.hunts`. **Reviewings will need the same second-dependent-key pattern
  bottings use**: `reviewingsQuery(review_ids)` keyed off the reviews actually held, exactly as
  `bottingsQuery` is keyed off the questions held. Follow that shape in `use-held-rows.ts` rather
  than inventing a new one.
* **The acting ident is threaded through `perform`, not carried on the action.** Decided the
  question the PR 2 handoff left open: `perform(db, held, open, ident_id, action)` takes a new
  positional argument, and `useHunt`'s `dispatch` supplies it from its own `useIdent()` call (see
  `use-hunt.ts`). Every existing action ignores the parameter; only `open_review`, `set_overall`
  and `set_review_phase` read it. `tests/support/jazz.ts`'s `act` grew a second, optional
  `ident_id` parameter (default a fresh random uuid) for the same reason. **`set_reviewing` and
  `peek_answer` will use this parameter too** -- do not add a second way of saying who is acting.
* **Review actions carry their own `quiz_id`, rather than relying on `open.quiz_id`.** The plan
  writes them as `{ quiz_id, ... }`, and the implementation takes that literally:
  `state/review-actions.ts`'s functions take `(db, held, quiz_id, ident_id, ...)`, not an
  `OpenQuiz`. `perform`'s switch passes `action.quiz_id` for these three cases, not `open.quiz_id`
  -- in practice always the same value today, since the review screen only ever acts on the open
  quiz, but it means these functions do not need `OpenQuiz` at all. Follow the same shape for
  `set_reviewing`/`peek_answer`, which the plan writes the same way.
* **A review is never refused for a locked quiz.** `review-actions.ts` does not go through
  `reviseOpenQuiz` (which checks `rows.quiz.locked`) at all -- it calls `quizRowsOf` and
  `transact` directly. This is deliberate, not an oversight: a lock is what a finished draft sent
  out for playtesting looks like, so refusing a review on one would defeat the milestone. Keep
  `set_reviewing` and `peek_answer` off `reviseOpenQuiz` too.
* **The client-side "shared only" filter** is `sharedReviewsOf` in `models/review.ts`, one small
  function so PR 6 can delete it whole. `ReviewsPanel` is the only caller today; the per-question
  table PR 4 adds to it should read through the same filtered list, not add a second filter.
* **Views.** `ReviewScreen.tsx` (`act=review`) reads `quiz`, `ident` and `reviews` as props from
  `QuizRoute`, which gets them from `useHunt`'s now-wider `HuntHandle` (`reviews:
  readonly ReviewRow[]`, the open quiz's reviews, every ident's). It opens the ident's review on
  mount (`open_review`, idempotent), shows each question in rank order (`Rank.inRankOrder`) via a
  `ReviewQuestionRow`, then an Overall `TextField` (autosaving through `useDraft`, same pattern as
  every other field) and share/withdraw buttons. `PR 4's per-question fields belong inside
  `ReviewQuestionRow`, added after the answer lock, per the plan's row-height rule -- see below.
  `cells/answer-lock.tsx` is the lock: `revealed`/`confirming` state, nothing stored. **It takes
  only `{ answer }` today.** PR 4 needs a `peeked` callback fired the moment `revealed` first
  becomes true; add it as an optional prop rather than reworking the dialog.
  `panels/ReviewsPanel.tsx` (under the smith's grid, first among the panels) lists every shared
  review by reviewer title (resolved through the new `useIdents()` hook in `state/use-ident.ts`,
  a whole-table subscription like the hunt directory) and overall note, verbatim. PR 4 adds a
  compact per-question table to each block, read-only, as the plan describes.

## Where the build differs from the plan

* **No UI switches between `act=smith` and `act=review` yet.** A reviewer's link is the smith's
  address with `?act=review` typed over `?act=smith`; there is no button offering it. This
  matches the plan's "wide open is still wide open" note and is unchanged from the PR 2 handoff --
  not a new gap, just still true.
* **`AnswerLock` has no callback yet.** See above; it is the one place PR 4 must extend rather
  than just plug into.
* **`otherVisitor` moved from `routing.spec.ts` into `e2e/support.ts`**, per the PR 2 handoff's
  own suggestion ("lift it into support.ts when a second spec wants it"). `reviews.spec.ts` is
  that second spec. Its `test.afterEach` registration needed an
  `eslint-disable-next-line unicorn/no-top-level-side-effects` -- reported here as CLAUDE.md asks:
  the alternative (registering the hook lazily, inside `otherVisitor`) does not work, because
  Playwright hooks must be registered during file collection, not from inside a running test.
* **MUI's `Stack` in this install (`@mui/material` 9.4) refuses `alignItems` as a direct prop**
  whenever another prop like `spacing` is also given -- a `tsc` overload-resolution failure, not a
  runtime one. `ExpressionsModal.tsx` already worked around this by putting `alignItems` inside
  `sx`; `ReviewScreen.tsx` and `answer-lock.tsx` follow the same workaround. Do the same rather
  than fighting the overload.

## Known race, carried forward and not touched

**A duplicate ident under a slow server** (from the PR 2 handoff) is still unresolved: two idents
sharing one label can arise if a browser that has never synced does not hear from the server
within `ServerLookupMillis`. It now also means a reviewer's identity could, in principle, split
across two idents with one label, splitting their reviews the same way. The Coach's instruction
for this round was explicit: **do not fix this now** -- prove out reviews first, then raise it.
Nothing in PR 3 makes it more or less likely than PR 2 already did; `reviewRowFor`'s "take the
earlier" rule is the same mitigation `huntRowFor` already uses, not a new one.

## For PR 4 in particular

* **Schema**: `reviewings { review_id: uuid, question_id: uuid, get_rate?: int, guesses: string,
  comments: string, minutes?: float, keep_it: boolean, needs_fact_check: boolean,
  elimination_candidate: boolean, peeked: boolean }`, relations to `reviews` and `questions`, in
  `src/db/schema.ts`; a `models/reviewing.ts` beside `models/review.ts`. Run
  `./scripts/doppledo dev_claude ./scripts/jazz_migration` once the schema and model are in place,
  same as PR 3's migration (a plain `createTables`, no edits needed) -- but check, don't assume.
* **Row height**: reuse `GrowingField` and `StretchField` from `cells/fields.tsx` exactly as the
  grid's `QuestionRow.tsx` does, so *Comments* (growing) and everything else (stretched) settle on
  one height together. Do not write a third field component for the review screen.
* **The answer lock's `peeked` flag**: add an optional `onReveal` prop to `AnswerLock`, called
  once, the first time `revealed` becomes true (a `useRef` guard, since `revealed` can toggle back
  and forth after that). Wire it from `ReviewQuestionRow` to `set_reviewing`'s `peeked: true` --
  the reviewing row should already exist or be made lazily, per the plan ("Rows are made lazily,
  on the first commit to that question's row").
* **`ReviewsPanel`'s per-question table**: add it per shared review block, reading the same
  `sharedReviewsOf` list this PR already filters with; join each review's reviewings by
  `review_id`. Needs the reviewings equivalent of `quizRowsOf`'s `reviews` field -- give
  `QuizRows` a `reviewings` field the same way, filtered by the questions' ids rather than the
  quiz's, since a reviewing points at a question, not a quiz.
* **Tests**: model bounds (get rate 0/100/101/-1, minutes 0/2.5/-1); `perform.test.ts` cases for
  `set_reviewing` (upserts, a patch leaves absent fields alone, moves the review to `draft`) and
  `peek_answer` (sets `peeked` once, idempotent after); e2e -- the reviewer fills a row, the
  comments field grows the row and the guesses field does not, the smith sees the row after
  sharing. `e2e/reviews.spec.ts` is the file to extend, not a new one.

## Jazz, alpha.56, learned the hard way

Everything the PR 2 handoff said here still holds; nothing in PR 3 contradicted it. Worth
restating the two most load-bearing for PR 4:

* **The shared test server holds every test's rows, and every hunt table is readable by every
  account.** Scope assertions to your own hunt, quiz or ident id; never assert a table's count.
  `tests/state/perform.test.ts`'s new `open_review`/`set_overall`/`set_review_phase` blocks all
  filter by a freshly minted `ident_id`, never by counting `app.reviews` whole.
* **Whole-table subscriptions don't survive the e2e suite.** `reviews` is scoped by quiz ids in
  `huntQueries`, same as questions/widgets/columns; keep `reviewings` scoped the same way, by
  question ids the way `bottingsQuery` is. `idents` stays a legitimate whole-table read
  (`useIdents`), because it is small and already read whole for `useIdent`; do not scope it.
* **After a schema change the e2e database can wedge.** Reset with
  `./scripts/doppledo dev_e2e ./scripts/nuke-jazz_local`, no e2e server running, before PR 4's
  migration's first e2e run.

## Next.js, tooling and e2e conventions

Unchanged from the PR 2 handoff:

* `useSearchParams` needs a `Suspense` boundary above it; MUI's `component={Link}` needs the
  client re-export in `components/NextLink.tsx`. Stale `.next-agent*/types` /
  `.next-e2e/types` folders need deleting after a route rename.
* Read `notes/testing.md`'s Playwright section before writing more e2e. `e2e/support.ts`'s
  `otherVisitor(browser)` is now there for any spec that wants a second visitor;
  `enterReview(reviewer, link)` in `e2e/reviews.spec.ts` is a private helper for the deep-link
  login flow reviews need -- lift it into support.ts too if a third spec wants exactly that
  sequence (a fresh visitor arriving at a deep link rather than at `/my/hunts`).
* The full suite is 152 specs now, still around three minutes locally. If it creeps toward
  twenty, something is reading every hunt's rows again -- reviews or reviewings included.
