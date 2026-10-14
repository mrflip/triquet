# Thread 5: auto_sandbox (2026-10-13)

Branch `20261013-auto_sandbox`, PR filed at landing; see the report. Suites at `ready`: justify
green (6506 unit tests); as chosen specs on the lane, `routing`, `google-sign-in`, `stats`,
`failing-pages`, `client-first` and `reviews` 94/96 (two `routing` specs read the hunts list's
name field after a sign-up; fixed), then `routing` 56/56. No full run yet: `pnpm e2e --touched` at
landing runs the whole suite (the branch reaches `convex/` and `e2e/support.ts`).

* **Built**:
  - **The sandbox is made as the handle is taken**: `assumeUserlabel` (`convex/writing/user_actions.ts`)
    takes the userlabel and calls `makeSandboxFor` (new, `convex/writing/hunt_actions.ts`, over
    `makeHuntFor`) in the same mutation, for every user, anonymous or signed in with Google. The
    sandbox is `~label/label`, its maker its one smith, holding the one blank quiz every new hunt is
    made with (`insertHunt`: label = the hunt's, title its label titleized, `BlankQuestionQty`
    blank questions). Not retroactive: only taking a handle through `users.perform` makes one.
  - **Where a new user lands**: `Routes.isCompelling(path)` and `Routes.signedUpPath(then,
    userlabel)` in `src/lib/routes.ts`, unit-tested case by case. `UserlabelGate` notes that the
    visitor took their handle on this visit (a ref set before `act`) and, when the user arrives by
    sync, sends them to `signedUpPath`; a visitor who already held a handle is sent on as before
    (`then`, or `/my/hunts`). One gate serves both ways in, so a Google sign-up from the front door
    (back at `/` or `/?then=…` through `returnUrlFor` and `use-google-sign-in`, both unchanged)
    lands the same way.
  - **e2e**: `landedAfterSignUp` asks `Routes.signedUpPath` and, for the sandbox, waits for the
    hunt page's members table to name the user a smith. `startHunt` now opens the sandbox's quiz
    from the sandbox's page (the new private `openSandboxQuiz`) instead of making a hunt from the
    hunts list. `environment.setup.ts` warms the front door, the sandbox's page, the quiz and the
    hunts list. Specs that hard-coded `/my/hunts` after a sign-up now go through the helper:
    `routing` (seven tests, and one new: *lands a visitor who has just said who they are at their
    sandbox…*), `google-sign-in` (four; the sign-in page's "brings them back to their profile" is
    now "lands them at their sandbox", and signs up to prove it).
  - Unit tests: `tests/convex/users.test.ts` (the sandbox and its smith, its first quiz listed,
    a Google user's sandbox, sealing after it, the full app refusing the handle, and hunt counts on
    the existing refusals); `tests/convex/writing/user_actions.test.ts` (a merge between two users
    who each took their handle carries both sandboxes on).
  - Notes: `notes/vocabulary.md` (*sandbox*, *anonymous*), `notes/e2e.md`. The TODO line is struck.

* **Decisions taken**:
  1. **What counts as compelling**: a path is compelling only when `isSyncedPath` takes it **and**
     it names something in an org: an org's address (`/~org`, a hunt, its quizzes or categories, a
     quiz) or an old address of a hunt or quiz (`/h/…`, `/c/…`). So beyond the Coach's three
     (`/`, `/my/hunts`, `/my/profile`), **`/signin` and `/stats` are not compelling**, nor is any
     path that opens no database (`/privacy`, `/about`), nor anything off-site. Defined by
     inclusion, so a page added later is not compelling until it is named: the failure is mild
     (a new user lands in their sandbox).
  2. **Only a sign-up lands at the sandbox.** A visitor arriving at the front door already holding
     a handle (a returning Google sign-in, a reload) is sent on as before, to `then` or their hunts.
     The Coach's "land them at their sandbox once they have a handle" is read as the moment of taking it; a returning user may
     have no sandbox (made before this thread, or deleted).
  3. **The first quiz is not a separate step**, because it cannot be: every hunt is made holding
     one blank quiz (`insertHunt`), and a hunt is never without one (`PA.QuizzesPerRealm.min` is 1;
     `deleteHunt` is the only way down from one). Should the Coach say "no quiz", the nearest is a
     sandbox whose one quiz is the same blank quiz; nothing to separate.
  4. **A full app refuses the handle** (`huntsFull`) rather than taking it without a sandbox: one
     write, no user holding a handle taken here without its sandbox. See *For the Coach*.
  5. **The unit tests' `googleUser`/`anonymousUser` write the userlabel straight to the row**
     (`tests/support/convex.ts`), as the command line gives one, so they stay "on no hunt" as their
     docs promise; going through `users.perform` would have given each a sandbox and moved ~60
     tests that count hunts or make the sandbox by hand. The tests of taking a handle call
     `users.perform` themselves.
  6. **`HuntsList`'s by-hand path is unchanged**: the server makes the sandbox with `makeHuntFor`
     directly (its label is the userlabel: nothing to retry), so the list's retry loop is neither
     duplicated nor needed for it. The list still offers a sealed user with no sandbox its sandbox,
     and hides the button once it has one, as before.

* **Discoveries**:
  - **`PA.HuntsInApp` (999) now caps sign-ups too**: every handle taken makes a hunt, so the app
    holds at most about 999 users less the other hunts, after which taking a handle is refused
    with "The app holds at most 999 hunts." Before, an anonymous user could fill the same room by
    making its sandbox by hand, so no new exposure, but the ceiling is now reached by ordinary use.
  - `scripts/adopt` giving a user its first userlabel makes no sandbox (it goes through
    `relabelUser`, not `assumeUserlabel`); and since every anonymous user taking a handle now holds
    its sandbox, `adopt` will refuse to relabel nearly every anonymous user (its guard against a
    second sandbox). Both as intended; noted for whoever runs `adopt`.
  - A merge into a user that took its handle after this thread leaves that user smith of two
    sandbox-shaped hunts (its own and the merged browser's), each at its own address. Tested.
  - Every e2e sign-up (each worker's two kept users, `assumeUserlabel`, `signUpWithGoogle`) now
    makes a hunt; the backend is cleared each run, far below 999.

* **Left by the review** (clean, no fixes; in the PR's open items):
  - A full app refuses the handle itself (decision 4): the Coach's call, below.
  - At that refusal the front door says only "The app holds at most 999 hunts.", not that the
    handle was not taken: copy, for thread 6.
  - Every sign-up now reads the whole `hunts` table for the cap (`huntsOf`), so a burst of
    sign-ups can meet Convex write conflicts (retried, but contended). A counter row would end it;
    outside this thread.

* **For the Coach**:
  - **The hunt cap.** Raise `PA.HuntsInApp` (and so `PA.HuntsPerOrg`, a tenth of it) before
    production nears ~999 users, or say to take the handle without a sandbox when the app is full
    (a few lines in `assumeUserlabel`; the landing would then need to know none was made). How many
    hunts production holds now decides how soon.
  - Thread 6 reviews the copy this adds: none on screen beyond test titles; the landing reuses the
    hunt page as it stands.
