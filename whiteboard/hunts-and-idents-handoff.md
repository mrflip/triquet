# Hunts and idents: handoff after PR 4 (Convex phase 5)

For the agent picking up at PR 5 (huntings) of `whiteboard/hunts-and-idents.md`, built as phase 6
of `whiteboard/convex_yay-plan.md`. What the thread says the app should do still stands; how it
says to build it is Jazz's, and the plan's phase 6 says what replaces it. Read
`whiteboard/convex_yay-progress.md` first (its *Rules overrides* before touching `convex/`), and
`notes/decisions/2026-09-convex.md` for the shape of the data. This replaces the handoff written
after PR 3, whose Jazz mechanisms (`useKept` and the `in` lists, `use-held-rows`, the migration
steps, `nuke-jazz_local`) are gone with Jazz.

## Where things stand

* **PRs 1 to 4 are built.** PRs 1 to 3 (hunts, idents, reviews) came across in the move to
  Convex; PR 4 (reviewings) is phase 5, on `20260928-convex_phase5`, stacked on phase 4's branch.
  None of it is merged.
* **There is no migration step.** A schema change is pushed by `scripts/convex_dev`, which
  regenerates `convex/_generated/` (commit what it writes); a backend holding rows the new schema
  refuses is emptied with `scripts/convex_reset <role>`, or `scripts/convex_dev <role> --reset`.
  The e2e suite empties its own as it starts.
* **The duplicate-ident race is closed.** `assumeIdent` (`convex/writing/account_actions.ts`)
  reads the label inside the transaction, so two browsers taking one new label make one ident.
  `identForLabel` and `reviewFor` still take the earliest should two exist; nothing makes two now.

## The shape PR 4 left

PR 5 plugs into these.

* **Who is acting is resolved on the server.** `hunts.perform` takes `browser_key`, and
  `identFor(db, browser_key)` (`convex/reading.ts`) finds the ident the browser took on last.
  `writing/perform.ts` passes it to the review actions through `reviewer(ident_id)`, which refuses
  `notIdentified` without one. `add_hunting` and `remove_hunting` go through `perform` the same
  way; `new_hunt` is an account action (`idents.performAccount`, `writing/account_actions.ts`)
  and has the browser key already.
* **Review actions carry their own `quiz_id`** and never go through `reviseOpenQuiz`: a locked
  quiz is reviewable. `set_reviewing` and `peek_answer` (`writing/review_actions.ts`) find the
  reviewer's review by `by_quiz_id_and_ident_id` and the question by `questionOf`, refusing
  `reviewNotOpened` and `questionGone`.
* **A reviewing** (`models/reviewing.ts`, table `reviewings`) is one review's verdict on one
  question, made the first time the reviewer writes to it. `set_reviewing` moves an `empty`
  review to `draft`; `peek_answer` sets `peeked` once and moves nothing. A question's deletion
  takes its reviewings (`deleteQuestion`), so a quiz's deletion does too.
* **Reads.** `reviews.forQuiz` hands back each review with its reviewer's label and title and its
  reviewings (`ReviewedT` in `lib/rows.ts`), in one query. `useHunt` holds it as `reviews`.
  Nothing is filtered on the server yet: `sharedReviewsOf` (`models/review.ts`) is the
  client-side "shared only" filter, and `ReviewsPanel` its only caller; phase 7 deletes it.
* **Views.** `ReviewScreen.tsx` (`act=review`) opens the ident's review on mount and shows each
  question in rank order as a `ReviewQuestionRow`: the question read-only, the answer behind
  `AnswerLock` (whose `onReveal` dispatches `peek_answer`), then the verdict's fields (Comments a
  `GrowingField`, Guesses a `StretchField`, Get rate and Minutes a `NumberField`, three
  `ToggleButton`s). `ReviewsPanel` shows each shared review with a table of its verdicts; it
  spans the whole row of panels when it has one (`Panel`'s `wide`).

## For PR 5 in particular

* **The members panel** is a `Panel` too; `panels/Panels.tsx` is where it goes, smith view only.
* **The link a smith hands a reviewer** closes here (the plan's *Copy reviewer link*):
  `Routes.quizPath(labels, 'review')` and `CopyButton` already exist.
* **`hunts.list` and `hunts.open` take `browser_key`** in this phase. `useQuery` throws what a
  query throws, so keep a malformed argument from reaching one, as `use-hunt` already does for a
  hunt label that cannot be one.
* **e2e**: `otherVisitor(browser)` in `e2e/support.ts` is a second browser, a fresh browser key.
  `enterReview` in `e2e/reviews.spec.ts` is the deep-link way in for a fresh visitor; lift it into
  support if a second spec wants it. Once `hunts.list` lists only one's own hunts, no spec may
  assume it sees another's, which none should.
* **The cap**: `HuntingsPerHunt`, 99 proposed. Confirm it with the Coach before building, as the
  other caps were.

## Tooling conventions, still true

* MUI 9.4's `Stack` refuses `alignItems` as a direct prop beside `spacing` (a `tsc` overload
  failure); put it in `sx`, as `ReviewScreen.tsx` and `answer-lock.tsx` do.
* `useSearchParams` needs a `Suspense` boundary above it; MUI's `component={Link}` needs the
  client re-export in `components/NextLink.tsx`.
* Run e2e as `pnpm test:e2e:agent` (3003/3403) when a human's run may hold 3002. The suite is 165
  specs in about a minute; if it creeps toward several, something is reading too much.
