# Thread 5: google_signin (2026-10-11)

Branch `20261011-google_signin`, PR filed at landing; see the report. Caught up onto thread 4
(#231) before review. Suites at `ready`: justify green; a full e2e run before the catch-up, 300/301,
its one failure a race in `forgetSession` now fixed (below); the spec alone 8/8 since. The new
spec run without Google keys, as CI runs it: offered `false`, the redirect test skipped.

**Review (flagged: login CSRF), fixed** in `9c896f7e`, on the orchestrator's directive. Deciding at
Google's callback through `authUserId` let anyone's sign-in link have the clicker's Google account
upgrade (take over) or merge into the link-maker's anonymous user. Now Google's callback only links
the account (to its own user, or a new **provisional** one), and the upgrade, merge or switch is
decided at the `?code=` exchange, where the browser has proved it started the sign-in (it holds
the verifier it kept and the code Google sent it). The patch grew for it. Chosen over "a claim
after the exchange": smaller, atomic, and it reuses Convex Auth's own proof. The attack, the
decision, why, and what is left: `notes/security.md` (the entry on login CSRF); the patch's exact
lines: `notes/stack.md`, *Authentication*. After the fix: justify green, convex-test 775/775 (the
attack tests among them), the Google spec 5/5; no full e2e since.

**Second review, the Coach's option 1 (bound the verifier), built.** The exchange hands the
starting session on only from a verifier made within `SIGN_IN_START_MAX_AGE_MS` (15 minutes, in
the patch) and refuses it whole otherwise; a verifier dies with its code (wrong verifier, expired,
replaced); `returnUrlFor` (`convex/auth.ts`, the `redirect` callback, over `Routes.isSyncedPath`)
sends a browser back only to a `(synced)` page, so the code is spent as it lands. The Coach's two
conditions: the installed client **did** strand the anonymous user on a refused exchange (it
cleared the stored tokens; a thrown one loaded for ever), so the patch now keeps the session in
both (DOM-tested); a refused exchange changes no row of the browser's user (convex-tested for a
stale verifier, a wrong one and an expired code, upgrade and merge). The tab then says so:
`useGoogleSignInOutcome` (placed in `ShowUser`, one line, through the page's alarm) compares a
SHA-256 of its token, noted in its own session storage as it left (never the token), with the one
it came back on, and clears the verifier key Convex Auth left; the notice is
`GoogleSignInUnfinished` / `googleSignInUnfinishedNotice` in `src/lib/notices.ts` (**wording a
draft for the Coach**). No sweep of dead sign-ins: `whiteboard/TODO.md`. After it: justify green;
the Google and routing specs 54/54; no full e2e since.

* **Built**:
  - **The patch**: `patches/@convex-dev__auth@0.0.96.patch` (in `pnpm-workspace.yaml`, `dist/`
    only): the `authUserId` half of upstream's PR #306, handed on at the code's exchange rather
    than the callback; the verifier kept, unsigned, until then; an OAuth code spent by a wrong
    verifier. `notes/stack.md` says when to drop it (not merely when #306 ships).
  - **The provider**: `convex/auth.ts` lists `Google` only where `googleKeyed()` (both
    `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`, declared in `convex.config.ts`), with
    `GoogleScope = 'openid email profile'` set explicitly. **`auth:offered`** (in `Unscoped`)
    answers `{ google }`.
  - **The table**: `userForSignIn` (`convex/writing/user_actions.ts`) validates what Convex Auth
    hands over (`UserValidators.signIn`), then for Google `userForGoogle`, in two steps by its
    `type`: at the callback (`oauth`), `accountUserAtCallback` links the account to its user or
    a new `provisional` one (`User.provisional`); at the exchange (`verification`),
    `userAtExchange` decides: new account and
    anonymous browser, upgrade in place (`User.fromGoogle`: `isAnonymous: false`, email, name,
    image; the provisional user deleted); new account otherwise, the provisional user kept;
    known account, switch, or `mergeInto` when the
    browser's anonymous user holds a userlabel. Every Google sign-in refreshes email, name and
    picture. Nothing reads an email.
  - **The merge** (`mergeInto`): the account's user is made smith of the sandbox
    (`smithOfSandbox`) and the anonymous user taken off it (`removeHuntship`); the anonymous user is
    marked `users.merged = { into_user_id, account_id }`, never deleted, and every session of it and
    their refresh tokens are deleted (`endSessionsOf`).
  - **The pending name choice**, for thread 6: the merged-away user **keeps its userlabel** (so
    nobody else can take it) and its title. `nameChoiceFor(db, user_id)` (`convex/reading.ts`, one
    indexed read on `users.by_merged_into` = `['merged.into_user_id', 'userlabel']`) answers the
    merged-away user still holding a userlabel **whose userlabel comes first alphabetically** (the
    index's order; not the earliest, as an earlier draft said), or null. Thread 6 settles it by taking
    that userlabel off the merged user: into a ghosting (`userlabel`, `user_id` = merged user,
    `into_user_id`, `account_id`, all on the `merged` mark), or onto the carrying user. Either way
    the next pending choice, if any, comes up by itself.
  - **The predicate**: `Actor.isSignedInWithGoogle(user)` in `src/lib/actor.ts`, beside
    `Actor.ofUser`: the user is not anonymous. `ofUser` counts `admin` only when it holds
    (`TRIQUET_EVERYONE_ADMIN` still makes everyone one locally). `convex/adopt.ts` now asks it.
  - **Browser**: `src/state/use-google-sign-in.ts`: `useGoogleSignIn()` answers `{ offered,
    start }`, `offered` true only when the deployment offers Google **and** the session is ready;
    `startGoogleSignIn(signIn, here)` is the one start, coming back to the same page.
  - **`scripts/convex_dev`** sets both keys on a local backend from the Doppler config, through a
    0600 file (`env set --from-file`), before the push; it removes them under a config without them.
  - **Tests**: `tests/convex/writing/user_actions.test.ts` (every row of the table, refusals, the
    email rule, what of Google's profile is kept, admin through a sign-in);
    `tests/convex/auth.test.ts` (Convex Auth's own `store` driven past Google's part: proves the
    patch, `auth:offered`, no provider without keys); `reading.test.ts` (`nameChoiceFor`,
    `googleAccountOf`); model and actor tests; `tests/state/use-session.dom.test.tsx` (the real
    Convex Auth provider and `useSession` meeting a `?code=` return: no anonymous sign-in during
    the exchange; checked by mutating `useSession` to ignore `isLoading`, which fails it);
    `e2e/google-sign-in.spec.ts` (in `SpecCorners`).
  - **Notes**: stack (*Authentication*, the patch), deploy (*Google sign-in*, and step 1 of the
    clear's steps), security (four entries, two older ones mended), convex (*Who is asking*),
    vocabulary (upgrade, switch, merge, name choice), testing (the DOM test exception).

* **Decisions taken**:
  1. **No linking by email, ever.** A custom `createOrUpdateUser` turns Convex Auth's verified-email
     linking off; we decide by account and browser alone. Tested: two Google accounts sharing an
     email are two users.
  2. **A known Google user holding no userlabel**, merged into from an anonymous browser holding
     one, **takes that userlabel and title outright** (`User.relabelled`, held-userlabel rules),
     with nothing to choose. The table did not cover it.
  3. **The merged-away user is taken off its sandbox.** Nobody can be signed in as it again, so
     it would be a dead member beside its heir.
  4. **Only the `authUserId` half of #306** is patched in, moved to the exchange (the review): its
     `scope` override would let a browser ask Google for more than the privacy policy says.
  5. **`emailVerificationTime` is not written**: Convex Auth's default Google profile drops
     `email_verified`, and nothing needs it. The row keeps email, name, image only; anything else
     Google sends is dropped by `UserValidators.googleProfile` before a write.
  6. **The e2e redirect is read, not navigated.** `page.route` does not catch a server's 302, and a
     first draft loaded Google's real sign-in page (nothing signed in). The spec now reads the
     deployment's 302 with `page.request.get(..., { maxRedirects: 0 })`.
  7. **`useGoogleSignIn().offered` waits for the session**, so a door cannot start a sign-in
     before the browser's user exists to go with it.

* **Deviations**:
  - `e2e/google-sign-in.spec.ts` skips its redirect test where the backend has no Google keys
    (CI, by the sprint's rule), with `eslint-disable-next-line playwright/no-skipped-test` and the
    reason. Its other test checks `auth:offered` against the keys everywhere.
  - **`forgetSession` (`e2e/support.ts`) changed**: it now goes to `/privacy` (no Convex client)
    before clearing storage. A trace showed the page before still refreshing its token when the
    session was cleared, and writing it back; the next page then signed in as the old user. Thread 4
    saw the same flake under load. My heavier `convex/auth.ts` (it imports `functions.ts` for
    `auth:offered`) widened the window to four failures in five; base passed four of four. Fixed in
    the helper, not the spec.
  - The DOM project now holds one test that is not a render count (`notes/testing.md` says so).

* **Discoveries**:
  - **Keys set after a push take effect without one**: on a local backend the Google routes went
    from 404 to live once the env was set. `convex_dev` sets them before the push anyway.
  - **The `?code=` exchange is unauthenticated** (Convex Auth calls it while `isLoading`), so the
    browser's anonymous session is never deleted by it: after an upgrade or a switch, that session
    row lingers until it expires, its tokens overwritten in the browser. Harmless; the merge
    deletes the merged user's sessions itself. A failed exchange removes the stored tokens, and
    `useSession` then signs in afresh (tested); after an upgrade, signing in with Google again
    recovers the user.
  - With Google's discovery, Convex Auth sets only the PKCE and `RedirectTo` cookies (no state or
    nonce): within what the policy says.

* **For thread 6**:
  - Read `nameChoiceFor` for the owner's user; settle it with `relabelUser` plus the ghosting
    write. **Careful:** `relabelUser` holds a *new* userlabel to the claim rules
    (`User.labelled`), which would refuse a merged-away userlabel reserved since it was claimed.
    `User.relabelled` holds it to `heldUserlabel`; use that rule when the user takes the merged
    userlabel.
  - Clear the merged user's `userlabel` before the carrying user takes it (`by_userlabel` is
    read with `.first()`, and two holders at once would break the free check).
  - The button reads `useGoogleSignIn()`; both doors call its `start`. The unfinished-sign-in notice is raised already (the page's
    alarm, from `ShowUser`); move it to a view of its own if the doors want it nearer.
  - Nothing of the browser's user is decided until the `?code=` exchange: a door's view after the
    round trip reads the result from `users.current`, never anything the callback wrote.
  - The merged user's other unfinished sign-ins' `authVerifiers` stay (no index finds them by
    session); the starting one is deleted by the patched exchange. It has no `authVerificationCodes`.

* **For the Coach**: upstream's PR #306 has the same login CSRF as written (its own example
  links at the callback); worth a comment there, which is yours to make. Set production's two keys before the clear (`notes/deploy.md`, step 1, path
  A). CI never tests the redirect (no Google keys there, by the sprint's rule); local runs under
  `dev_e2e` do.
