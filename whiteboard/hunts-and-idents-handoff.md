# Hunts and idents: handoff after PR 5 (Convex phase 6)

For the agent picking up at PR 6 (permissions) of `whiteboard/hunts-and-idents.md`, built as phase 7
of `whiteboard/convex_yay-plan.md`. What the thread says the app should do still stands; its PR 6
text is written for Jazz's policy DSL, and the plan's phase 7 says what replaces it:
`convex/authorize.ts` stops being a seam and starts checking. Read
`whiteboard/convex_yay-progress.md` first (its *Rules overrides* before touching `convex/`), and
`notes/decisions/2026-09-convex.md` for the shape of the data.

**Before building: the Coach answers phase 7's one design question** (a query that may not
answer: `null` with a discriminant, or an error boundary). It is in the progress document's *For
the Coach*.

## Where things stand

* **PRs 1 to 5 are built.** PR 5 (huntings) is phase 6, on `20260928-convex_phase6`, stacked on
  phase 5's branch. None of it is merged.
* **Membership is kept, and only the pages follow it.** Every function still answers every
  browser: `mayChangeHunt` returns true, and `hunts.perform` asks nothing else. Phase 7 is where
  the server enforces what phase 6 shows.

## The shape PR 5 left

Phase 7 plugs into these.

* **A hunting** (`models/hunting.ts`, table `huntings`) is one ident's place on one hunt, with a
  role (`smith` or `reviewer`). One per (hunt, ident). Indexed `by_hunt_id` (the members) and
  `by_ident_id_and_hunt_id` (one ident's hunts, and one ident's role on one hunt).
* **Reads** (`convex/reading.ts`): `huntingFor(db, hunt_id, ident_id)` is the role lookup every
  rule needs; `huntingsFor(db, ident_id)` is one ident's hunts; `membersOf(db, hunt_id)` joins a
  hunt's huntings to their idents. `identFor(db, browser_key)` is the ident a browser is now.
* **Writes.** `new_hunt` (`writing/account_actions.ts`) refuses `notIdentified` and writes its
  maker's `smith` hunting in the same transaction. `add_hunting` and `remove_hunting`
  (`writing/hunting_actions.ts`) go through `perform` on `open.hunt_id` with `actor(ident_id)`;
  nobody changes their own hunting (`ownHunting`).
* **Queries.** `hunts.list({ browser_key })` lists only the caller's hunts, each with its role.
  `hunts.open({ hunt_label, browser_key })` returns the shallow hunt with `members` and the
  caller's `role` (null for a stranger). `quizzes.open`, `questions.open`, `reviews.forQuiz` and
  `hunts.whole` take no browser key yet; phase 7 adds it to each.
* **The browser.** `useHunt` returns `role`, and reads no quiz, reviews or history for a stranger.
  `QuizRoute` sends an address with no `act` to the role's presentation (`Hunting.actFor`), and
  shows `NotOnHunt` to a stranger or to a reviewer at `act=smith` (`Hunting.mayAct`). The
  `MembersPanel` (smith view, `panels/Panels.tsx`) adds and removes members and copies the
  reviewer link. `sharedReviewsOf` (`models/review.ts`) is still the client-side "shared only"
  filter; phase 7 deletes it when `reviews.forQuiz` returns only what the caller may read.

## For PR 6 in particular

* **Check the actor's own hunting inside the transaction.** `mayChangeHunt` must read
  `huntingFor(db, hunt_id, ident_id)` for the one acting, not only check the target. Two smiths
  removing each other at the same moment each read only the other's hunting, so both commit and
  the hunt is left with no smith. A read of one's own hunting puts the two in conflict, and
  Convex retries the loser, who is then refused.
* **The rules take the database now.** Today's `mayChangeHunt(browser_key, hunt_id)` is pure; the
  plan's rules (`mayReadHunt`, `mayChangeHunt`, `mayReadReview`, `mayWriteReview`) read huntings
  and reviews. Keep them the only place authorization is written, and keep `identFor(db,
  browser_key)` the one function the identity plan swaps for `ctx.auth`.
* **Wording is ready.** `NotOnHunt.tsx` already words "not on this hunt" and "not a smith here".
  A refused query answering `{ hunt: null, why }` (if the Coach picks that) can hand `QuizRoute`
  the same two cases. `RefusalNotices.notPermitted` is the mutation's sentence.
* **A reviewer's own review.** A reviewer writes reviews and reviewings through `perform` today,
  on `open.hunt_id`. `mayWriteReview` is "one's own", which `reviewFor(db, quiz_id, ident_id)`
  already scopes; the check a reviewer needs is that they are on the hunt at all.
* **e2e**: `addMember(page, label, role)` in `e2e/support.ts` puts a second visitor on the hunt;
  `otherVisitor(browser)` is a fresh browser key. The routing specs about a friend and the
  review specs already go through membership, so a server that refuses strangers should pass
  them unchanged. Phase 7's new specs are the ones that bypass the pages: a stranger's deep link,
  and a reviewer typing `act=smith`.

## Tooling conventions, still true

* MUI 9.4's `Stack` refuses `alignItems` as a direct prop beside `spacing` (a `tsc` overload
  failure); put it in `sx`.
* `useSearchParams` needs a `Suspense` boundary above it; MUI's `component={Link}` needs the
  client re-export in `components/NextLink.tsx`.
* `useQuery` throws what a query throws: keep a malformed argument from reaching one, as
  `use-hunt` does for a hunt label that cannot be one.
* The grid is `grid(page)` in e2e, the table named *Questions*: the page holds other tables.
* Run e2e as `pnpm test:e2e:agent` (3003/3403) when a human's run may hold 3002. The suite is 170
  specs in about a minute; if it creeps toward several, something is reading too much.
