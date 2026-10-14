# 2026-10-14: Sprint auth_todos done -- eight threads, eight PRs open, one stack

The sprint took the six auth items from `whiteboard/TODO.md`'s *Tiny Tasks*, plus a seventh the
Coach added midway and an eighth after it closed. Production is now `triquet.me`. There is
one userlabel check, with no "held" exception. Handles may be four characters. Eight more words
are reserved at the top level, and the reserved-list guard now judges every row. e2e signs in
with Google for real through a stand-in issuer, in CI too. Taking a handle makes the user's
sandbox, with its first quiz, and lands them there. The on-screen copy is held to sentence case,
written down in `notes/views.md`. Every thread was reviewed at `medium`: two fixed, five clean,
one flagged (thread 8, decided by the Coach, then clean). Every e2e proof was green with no
flakes. The sprint-end full run on the top was 326/326 (thread 8's proof). The plan and progress
files are in `whiteboard/20261013-auth_todos/`, and the [sprint doc](https://claude.ai/code/artifact/fb22a634-041c-45fe-ab92-4dc62532872c) mirrors them.

## The PRs, in the order they landed

One stack. Merge the top, #255, and every PR beneath it is marked merged.

| PR | Thread | Stacked on | Review |
|----|--------|------------|--------|
| [#247](https://github.com/mrflip/triquet/pull/247) | 1 `domain`: production is triquet.me | main (follows #245) | none (no code) |
| [#248](https://github.com/mrflip/triquet/pull/248) | 2 `one_userlabel`: one userlabel check; `check_reserved` guards the list | #247 | fixed (2) |
| [#250](https://github.com/mrflip/triquet/pull/250) | 3 `mock_google`: a stand-in for Google; sign up, in and verify tested through | #248 | fixed (2, docs) |
| [#251](https://github.com/mrflip/triquet/pull/251) | 4 `short_userlabel`: a userlabel may be four characters | #250 | clean |
| [#252](https://github.com/mrflip/triquet/pull/252) | 7 `more_reserved`: `bots`, `test`, `demo`, `sync`, `meta` | #251 | clean |
| [#253](https://github.com/mrflip/triquet/pull/253) | 5 `auto_sandbox`: the sandbox and first quiz, made on taking a handle | #252 | clean |
| [#254](https://github.com/mrflip/triquet/pull/254) | 6 `microcontent`: sentence case settled, strays fixed | #253 | clean |
| [#255](https://github.com/mrflip/triquet/pull/255) | 8 `reserved_guard`: `bot`, `tests`, `demos`; the guard reads every row | #254 | flagged, decided, then clean |

No migration: no row changed shape. Thread 2 tightens what a row may hold; with production's
people cleared, nothing should hold a newly refused word.

## Done by the Coach during the sprint

* The new domain's outside work: Vercel's domain and redirect, Convex production's `SITE_URL`,
  Google's consent screen.
* Confirmed: every new user gets a sandbox, and lands at it unless a more compelling return-to
  was saved.
* Waived `check_reserved` against production for thread 7's words ("the db is mostly empty"),
  and for thread 8's release, which first brings the guard production can run.
* Thread 8's review: "Waiver + fix docs" for the deploy order; "Strip them" for users' email and
  phone in the guard's pages.

## Open questions, in one place

1. **The sign-up cap** (#253). Every handle now makes a hunt, so once production holds
   `PA.HuntsInApp` (999) hunts, taking a handle is refused. The refusal is #254's "Your handle
   wasn't saved...". Raise the cap before production nears it, or take the handle without a
   sandbox when the app is full.
2. **Bursts of sign-ups** (#253). Each sign-up reads the whole `hunts` table to check the cap,
   so simultaneous sign-ups can hit Convex write conflicts and retry. A counter row would fix it.
3. **"Empty sandbox"** (#253). The first quiz can't be dropped on its own: every hunt is made
   holding one quiz, and a realm must hold at least one.
4. **The sandbox's titles** (#254). Both the sandbox and its first quiz are titled from the
   handle, titleized, so "Flip Kromer" twice and "Tester 7348 F 9 Ed 61 Ce". The suggestion is
   "Sandbox" (or "Flip's sandbox") and "First quiz".
5. **The rest of the copy list** (#254, ranked in `microcontent-survey.md`):
   * the sandbox page puts git's panels near the top and offers no way to verify;
   * Title Case default column titles, which only a migration can change in existing quizzes;
   * the export formats keep their capitals;
   * two of the Coach's own lines: "if that's you", and "share puzzles" said to a visitor with no
     account;
   * *Save* versus *Apply*, and three ways of asking for a missing field.
6. ~~**The reserved-list guard covers the top-level list only** (#248).~~ *Closed by #255*: the
   guard judges every row by its validator. Still true: a question's label and a hunt's org never
   move, so a base-list word either holds must stay off the list, or needs a migration.
7. ~~**More reserved forms?**~~ *Closed by #255*: `bot`, `tests`, `demos` reserved; `metas` free.
8. **Running the guard** (#255): it can check only a deployment that already runs
   `check_reserved:page`, so this release goes out under the waiver. After deploying, run
   `./scripts/doppledo prd_janitor scripts/check_reserved` once to see production as it stands.
9. **Housekeeping** (#250): an e2e dev server started before #250 has no stand-in beside it, so
   restart it once. The test-only header rides redirects as Playwright-on-Chromium behaviour; look
   again if another browser is added.
10. ~~**Strip more from the guard's pages?**~~ *Answered* ("Yes leave those fields out too"):
    landed into #255. A user's `title` stays, as it carries a real check (`titleish`) and is
    already shown to other users.

The weekly usage limit interrupted the sprint overnight. Threads 5 and 7 resumed with their
context once it reset, and nothing was lost.
