# Sprint `auth_todos`: progress

**Status: done (2026-10-14). Every thread landed: #247, #248, #250, #251, #252, #253, #254, #255, one stack, all open. Sprint-end full run 326/326, no flakes (thread 8's landing proof). See `human/20261014-sprint_auth_todos_done.md`.**

*Orchestrator (2026-10-14, after the close):* the Coach answered question 10 ("Yes leave those fields out too"): a follow-up lands into #255 (`pnpm land --into 20261014-reserved_guard`), leaving users' `name`, `image`, `locale`, `hosted_domain` and the two verification timestamps out of the guard's pages too. *Landed* (thread 8b, into #255 at `16a9974b`): review fixed one doc line; the worker had also stripped `title`, which the orchestrator put back on the reviewer's case (the one such field with a real check, `titleish`, and already shown to other users), so the list is the Coach's exactly. e2e full 326/326, no flakes. Then, at the Coach's word ("Squash your commits if there are many back and forths"), the stack is squashed branch by branch: each branch's sweeps folded into one, each review fix folded into the commit it amends, every branch's tip tree unchanged, pushed with leases.

The running handoff, newer than `auth_todos-plan.md` wherever the two disagree. Each thread writes
its own section to `thread-<N>-<label>.md` beside this file; the orchestrator curates this one.

| # | Thread | Status | Branch | PR |
|---|--------|--------|--------|----|
| 1 | `domain`: the domain is triquet.me | landed #247 | `20261013-domain` | [#247](https://github.com/mrflip/triquet/pull/247) |
| 2 | `one_userlabel`: no held userlabel | landed #248 | `20261013-one_userlabel` | [#248](https://github.com/mrflip/triquet/pull/248) |
| 3 | `mock_google`: a mock Google; signup, signin, verify tested through | landed #250 | `20261013-mock_google` | [#250](https://github.com/mrflip/triquet/pull/250) |
| 4 | `short_userlabel`: a userlabel may be four letters | landed #251 | `20261013-short_userlabel` | [#251](https://github.com/mrflip/triquet/pull/251) |
| 5 | `auto_sandbox`: the sandbox and its first quiz, made for you | landed #253 | `20261013-auto_sandbox` | [#253](https://github.com/mrflip/triquet/pull/253) |
| 6 | `microcontent`: the microcontent, consistent | landed #254 | `20261014-microcontent` | [#254](https://github.com/mrflip/triquet/pull/254) |
| 7 | `more_reserved`: five more top-level reserved words | landed #252 | `20261013-more_reserved` | [#252](https://github.com/mrflip/triquet/pull/252) |
| 8 | `reserved_guard`: `bot`, `tests`, `demos`; the guard reads every label | landed #255 | `20261014-reserved_guard` | [#255](https://github.com/mrflip/triquet/pull/255) |

Full e2e runs at landing: none yet (the fourth landing carries one). Thread 1 landed with e2e skipped (doc comments and notes only); thread 2's `--touched` ran the whole suite, 319/319, no flakes; thread 3 ran the full suite, 325/325, no flakes (on the top before thread 2; `google-sign-in` and `routing` rerun after, 75/75). Thread 4, the fourth landing, carried a full run: 325/325, no flakes. Thread 7's `--touched` ran the whole suite, 325/325, no flakes; thread 5's, 326/326, no flakes. Thread 6 proved with the full suite (326/326). Thread 8, added after, the eighth landing and the last, carried the full run again: 326/326, no flakes; it is the sprint-end run.

*Orchestrator (2026-10-14):* the sprint stopped overnight when the account hit its weekly usage
limit; threads 5 (building, three commits in) and 7 (landing, caught up) were resumed with their
context once it reset. Thread 4's failure notice came after it had landed; nothing lost.

## What the threads have taught

*Orchestrator:*

* **Production's address is written once**, in `notes/deploy.md` beside `SITE_URL`; no code
  derives it (no `metadataBase`, canonical link or sitemap), so no constant was added (thread 1).
* **The new domain's outside work is done** (the Coach, 2026-10-13): Vercel's domain and redirect,
  Convex production's `SITE_URL`, Google's consent screen.

* **One userlabel check, `CK.userlabel`**, top-level words and all, for every row and argument
  that held `heldUserlabel` (thread 2, #248). `User.relabelled` is folded into
  `User.labelled`; `Addresses.isHeldUserlabel` is `isUserlabel`. A userlabel now always passes
  `HuntValidators.newLabel`, so **thread 5's sandbox needs no check of its own**.
* **`scripts/check_reserved` is the guard before the reserved list grows** (thread 2): it now
  reads every held userlabel (users, ghostings) and every hunt's org and label from a deployment
  (`check_reserved:held`) and judges them against the *checkout's* list, so it is run before the
  list deploys. Hunts whose own label becomes reserved are harmless (checked only when made).
* **For thread 4**: the userlabel's length is stated only in `PA.Userlabel` now; six survives in
  `PA.Userlabel.msg`, `tests/models/user.test.ts` ("shorter than six", `'flips'`) and
  `tests/lib/vv/checks/strings.test.ts` (`'fivee'`).
* **Google signs in for real in e2e, CI included** (thread 3, #250): `oauth2-mock-server`
  as `scripts/mock-google.ts`, on a fourth port per role in `scripts/lanes.ts`, started by
  `scripts/convex_dev` beside every e2e backend with placeholder keys. `convex/auth.ts` honours
  `TRIQUET_MOCK_GOOGLE_ISSUER` only where `TRIQUET_CLEARABLE=yes`, and only for an `http`
  loopback (`mockGoogleIssuerOf`; `notes/security.md`). No Google test skips any more.
* **For thread 5**: where a new user lands is one helper, `landedAfterSignUp(page, label, then?)`
  in `e2e/support.ts`; `assumeUserlabel` and `signUpWithGoogle(page, { account, label, from })`
  both end in it. A spec drives the stand-in with `answerGoogleAs(page, freshGoogleAccount({...}))`
  or `'refused'` (`e2e/google.ts`). A deep-link sign-up spec (landing back on a hunt) already
  exists: the case thread 5 keeps.
* **For thread 6**: the user menu closes itself if opened just after a return from Google
  (`ShowUser` hands the header `null` while `useMe` reloads). Thread 3's spec waits it out
  (`userMenuSaying`); thread 6 takes it if it is cheap, else TODO.
* `testing:mergeInto` is gone (the merge is real now); `vouchFor` stays for kept sessions.
* **A userlabel is 4 to 24 characters** (thread 4, #251), stated once in `PA.Userlabel`;
  the unfinished-handle notices read the minimum from it. Every name now gets a handle suggestion
  (`Flip` -> `flip`, `Jo` -> `jo_2`). No reserved words added: the short words were already kept,
  since hunt labels have always been allowed from two characters. A four-letter sandbox label is
  a valid hunt label (tested), as thread 5 needs.
* **A brand-new backend picks up the stand-in on its first run** (thread 3 checked from cold: 23/23),
  so `scripts/convex_dev`'s order of settings is fine as it stands.
* **Taking a handle makes the sandbox** (thread 5, #253): `assumeUserlabel` calls
  `makeSandboxFor` in the same mutation, for every user; the sandbox holds the blank quiz every
  new hunt is made with (a realm must hold one, so the quiz cannot be dropped separately). Only a
  sign-up lands at the sandbox (`Routes.signedUpPath`, `Routes.isCompelling`: compelling = an
  `/~…` address or an old `/h/…`, `/c/…`); a returning sign-in goes where it went before.
  **For thread 6**: the sandbox page is now every new user's first screen; its copy is worth a look.
* **Open for the Coach (thread 5)**: every handle now makes a hunt, so `PA.HuntsInApp` (999)
  caps sign-ups (`huntsFull`). The worker chose to refuse and recommends raising the cap before
  production nears ~999 users.
* **For thread 6, gathered**: (a) the user menu closes itself if opened just after a return from
  Google (`ShowUser` hands the header `null` while `useMe` reloads; thread 3); (b) the full-app
  refusal at taking a handle says only "The app holds at most 999 hunts." (`RefusalNotices.huntsFull`),
  not that the handle wasn't taken (thread 5); (c) the sandbox page is every new user's first
  screen now (thread 5).
* **The app's copy is sentence case**, now written down in `notes/views.md`, *Microcontent*
  (thread 6, #254); the survey and the Coach's ranked list are `microcontent-survey.md`
  (on thread 6's branch until it lands). The user menu "closing itself" after Google was measured
  and is not that: a click in the first ~300 ms, before hydration, is lost; no fix.
* **The reserved-list guard reads every row** (thread 8, #255): `check_reserved:page` hands
  back 100 rows of one of our tables at a time (Convex Auth's refused; users' `email` and `phone`
  left out, the Coach's call), and `scripts/check_reserved` judges each whole row by the
  checkout's own row validator, so it guards growth of either list, and any tightened validator.
  It can check only a deployment already running `page`: this release goes out under thread 7's
  waiver. `bot`, `tests`, `demos` are top-level reserved too.

## Reviews of landed threads

* **Thread 1, #247.** *Review: none* (no code in the diff). e2e skipped, reason in the PR. Minor
  left: the finished oauth sprint's `google-oauth-keys.md` still shows the old consent-screen
  values; left as a record.
* **Thread 2, #248.** *Review: fixed.* Kept: `adopt:plan` refuses a grant to a user whose
  userlabel the list now keeps (perform threw in `placeOn`); `check_reserved:held` walks only
  holders through `by_userlabel`. Left, minor, both recorded in the thread file's *Discoveries*
  before landing: `mergeInto` refuses an anonymous browser holding a newly reserved handle signing
  in to an account holding none; the guard covers growth of the **top-level** list only (a word
  added to `PA.ReservedLabelGroups` locks every row so labelled, which needs its own survey: a
  Coach's scope call). Worker's note: a hunt's org never moves, so a word an org holds must stay
  off the list.
* **Thread 3, #250.** *Review: fixed.* Two documentation fixes (`lanes.ts`'s comment naming the
  script; `notes/security.md`'s amendment on which stand-ins went). The guard, the header's
  confinement, the ports and the gating checked and sound. Left, in the PR's open items: a dev
  server started before this branch has no stand-in (restart it); the header rides redirects as
  Playwright-on-Chromium behaviour; the user menu closing just after Google (thread 6). The
  reviewer's cold-start doubt was settled by the worker (passes from cold). One suppression:
  `eslint-disable-line unicorn/prefer-https` in `tests/convex/auth.test.ts`.
* **Thread 4, #251.** *Review: clean.* Every suggestion `suggestionsFor` can offer passes the
  server's own check; the notices read `PA.Userlabel.min`; the routes a short org could clash with
  are reserved. Left for the Coach (in the PR): free short words that might deserve reserving
  (`bots`, `test`, `demo`, `sync`, `meta`), each needing `check_reserved` against production first.
  Thread 3's specs needed no change at the catch-up.
* **Thread 7, #252.** *Review: clean.* The five words (`bots`, `test`, `demo`, `sync`, `meta`;
  new groups `trials` and `craft`) reach every reader of the top-level list; nothing depends on
  the group keys. The Coach waived `check_reserved` against production; the PR's open items say
  how to run it anyway. Left for the Coach: `bot`, `tests`, `demos`, `metas` stay free.
* **Thread 5, #253.** *Review: clean.* Sound: one write for handle and sandbox (a `huntsFull`
  rolls back the userlabel), no label collision, no second sandbox, the smith huntship, no open
  redirect (`onSite`), the gate telling a new visitor from a returning one, the test helpers. Left:
  a full app refuses the handle itself (the Coach's call); the refusal's copy (thread 6); each
  sign-up reads the whole `hunts` table for the cap, so bursts may hit write conflicts (a counter
  would fix it; outside the sprint). The first quiz cannot be split off: every hunt is made with
  one, and a realm must hold one.
* **Thread 6, #254.** *Review: clean.* No missed spec on any changed string; `RefTitles` labels
  match their old text; `noRoomForSandbox` only through `makeSandboxFor`; `ownSandbox` only on the
  viewer's own sandbox. The reviewer's wording minor was taken before landing ("This is your
  sandbox: a hunt of your own, named for your handle, to try things in."). The Coach's ranked list
  is `microcontent-survey.md`, *For the Coach*. Full suite 326/326, no flakes: the sprint-end run.
* **Thread 8, #255.** *Review: flagged, then clean.* The first review kept no fixes and flagged
  two findings, both decided by the Coach and built: the guard cannot check production before
  this release deploys ("Waiver + fix docs": `notes/deploy.md` and the thread file say so), and
  whole user rows reached the guard's machine ("Strip them": `email`, `phone` left out). Its minor
  (a hunt named twice) taken. The second review, over the new commits only: clean. Left for the
  Coach: whether to also leave out `name`, `image`, `locale`, `hosted_domain` and the two
  verification timestamps. Full suite 326/326, no flakes: the sprint-end run.
