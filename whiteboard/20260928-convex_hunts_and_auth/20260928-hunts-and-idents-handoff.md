# Hunts and idents: handoff after PR 6 (Convex phase 7)

The playtesting thread (`whiteboard/hunts-and-idents.md`) is built: PRs 1 to 6, the last three as
phases 5 to 7 of `whiteboard/convex_yay-plan.md`. What comes next is the identity plan (the
plan's *Identity, later*), which the Coach issues. Read `whiteboard/convex_yay-progress.md` first
(its *Rules overrides* before touching `convex/`), and `notes/decisions/2026-09-convex.md` for the
shape of the data and the rules.

## Where things stand

* **PR 6 (permissions) is phase 7**, on `20260928-convex_phase7`, off phase 6 as the Coach rebased
  it onto `main`. Not merged.
* **The server enforces membership.** `convex/authorize.ts` holds every rule: `roleOn`,
  `mayReadHunt`, `mayChangeHunt`, `mayReadReview`, `mayWriteReview`, and `mayPerform` for
  `hunts.perform`. Every query below the hunts list takes `browser_key` and answers only what the
  caller may read: `hunts.open` says why not (`notOnHunt` with the smiths, or `noSuchHunt`), the
  rest answer null or leave rows out.
* **The honour system stays in one respect**: anyone may take on any ident, so the rules are as
  strong as that. A rule turns on the ident (`identFor(db, browser_key)`), never on the key.

## For the identity plan in particular

* **One function to change.** `identFor` (`convex/reading.ts`) becomes a read of `ctx.auth`
  (`tokenIdentifier`, per Convex's guidelines), and `browser_key` goes from every argument list:
  the queries in `hunts.ts`, `quizzes.ts`, `questions.ts`, `reviews.ts`, `idents.ts`, and
  `hunts.perform`. No rule in `authorize.ts` should need to change.
* **The browser's side.** `useBrowserKey` feeds `useHunt`, `useQuiz`, `useWholeHunt`,
  `useHuntsList`, `useIdent` and `useAccountActions`; each skips its query while the key is null
  (server render, hydration). An auth client's loading state takes its place.
* **The ask route** is still unauthenticated. If it must know who is asking, it moves into a
  Convex action (plan, settled item 7).

## Tooling conventions, still true

* MUI 9.4's `Stack` refuses `alignItems` as a direct prop beside `spacing` (a `tsc` overload
  failure); put it in `sx`.
* `useSearchParams` needs a `Suspense` boundary above it; MUI's `component={Link}` needs the
  client re-export in `components/NextLink.tsx`.
* `useQuery` throws what a query throws: keep a malformed argument from reaching one, and have a
  query the caller may not read answer what they may see rather than throw.
* The grid is `grid(page)` in e2e, the table named *Questions*: the page holds other tables.
* In the convex tests, `seedHunt` puts a smith on every hunt it seeds and `act` acts as them;
  `join(label, role)` puts someone else on it, and `identified` makes a stranger.
* Run e2e as `pnpm test:e2e:agent` (3003/3403) when a human's run may hold 3002. The suite is 170
  specs in about a minute; if it creeps toward several, something is reading too much.
