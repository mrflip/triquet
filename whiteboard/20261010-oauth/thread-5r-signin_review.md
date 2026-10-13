# Thread 5r: signin_review (2026-10-12)

This PR holds the fixes from the Coach's `high` review of thread 5,
[#232](https://github.com/mrflip/triquet/pull/232). Branch `20261012-signin_review`, PR filed at
landing; see the report. Stacked on #232. Suites at `ready`: justify green (6277 unit tests, 1
skipped); the Google sign-in and routing specs alone 54/54. At landing: the full suite (see the
report and the PR's Tests: line).

**Second review: `fixed`**, two commits on this branch. `60629cd3`: an org's address passes only
as `Addresses.urlOf` writes it, since `locationFrom` decodes an escaped page word
(`/~pat_smith/quiet_otter/quizze%73`) that Next's router does not, and that landed on a 404 with the
code unspent. `7b649fee`: `sessionOf` reads a token it cannot decode, or a `sub` that is no string,
as `'none'` rather than throwing. Its minor note, left for the Coach: an address with an escaped
letter (`%5F`, `%21edit`), or an old `/h/` address whose label fails `CK.label`, now falls back to
`/` rather than coming back to that page.

* **Built** (five `fix:` commits, the first the reviewer's):
  1. *The reviewer's* (`40dd3eb8`): `startGoogleSignIn` takes back its session-storage note when
     `signIn('google')` throws.
  2. **`Routes.isSyncedPath` matches whole pages** (`src/lib/routes.ts`). An org's address
     (`/~…`, the `~` unescaped) passes when `Addresses.locationFrom` reads it as a kind one of its
     pages shows (`org`, `hunt`, `quizzes`, `categories`, `quiz`), in a mode only for a quiz, and
     not a raw record: the same reading `useAddressed` makes, so the two cannot disagree. The
     other synced pages pass shape for shape (`SyncedShapes`: `/my/hunts`, `/stats`, `/h/<label>`,
     `/h/<label>/<label>/<label>`, `/c/<label>/categories`), each label slot held to `CK.label`;
     `/` passes; a trailing slash does not. `SyncedToplevel` is gone. The filesystem test now walks
     `src/app/(synced)/`, filling each dynamic folder with a sample, and fails if a page is refused
     or a folder holding none (`/my`, `/h/<hunt>/<realm>`, `/~org/hunt/quizzes/<realm>`) is
     allowed. The reviewer's `/h/x/y` and `/~any/hunt/nothing` are among the cases.
  3. **A refused `redirectTo` falls back to `/`** (`returnUrlFor`, `convex/auth.ts`), never
     followed; a deployment with no `SITE_URL` still throws. The callback-route test now checks a
     synced page, `/privacy` and another site end at the page, `/` and `/`.
  4. **The unfinished-sign-in notice compares sessions, not tokens.** `sessionOf(token)` (the
     session half of the JWT's `sub`, `<user>|<session>`, through `jose`'s `decodeJwt`) replaces
     `fingerprintOf`; `isUnfinished` is synchronous now, and so is the hook's effect.
  5. **`useGoogleSignInOutcome`'s own tests**: `tests/state/use-google-sign-in.dom.test.tsx`, over
     Convex Auth's real provider and the page's alarm: back on the same session in a refreshed
     token (cancelled at Google), notice raised and the leftover verifier cleared; a refused
     exchange, notice raised; a finished one, nothing; no note, nothing, and the verifier left be.
     The first case fails against the old fingerprint comparison (checked).
  - Notes: `notes/security.md` (the redirect entry corrected, the fallback, the session compare),
    `notes/stack.md` (`jose`), `notes/testing.md` (the second DOM test of a hook).

* **Decisions taken**:
  1. **Exact shapes, not a root `not-found.tsx` mounting the provider.** A provider on every 404
     would open the database, and sign a new anonymous user in, for every mistyped or scanned
     address, and put a Convex client in front of pages kept free of one. The shapes are not
     fragile: an org's addresses reuse the pages' own reader, and the filesystem test catches a
     page added or moved.
  2. **`jose` installed directly** (`^6.2.12`, npm's latest, the major `@auth/core` already pulls,
     so no new copy): `notes/stack.md`'s rule for the plainly boring answer, recommended by the
     neighbouring library (Convex Auth signs with it). Listed under *Authentication*. **The Coach
     is told afterwards, as that rule asks.**
  3. **The session's id is kept in session storage as is**, not hashed: it is in the token in
     local storage already, and grants nothing.
  4. **Refused, though harmless to allow:** an org with its `~` escaped (`/%7E…`; no browser writes
     one), a trailing slash, an old address whose hunt slot is no label. Each falls back to `/`.
  5. `returnPathOf` (the browser's side) keeps its own fallback to `/`, now the same answer the
     deployment would give; kept so the round trip never asks for what it would be refused.

* **Deviations**: none from the review's directions.

* **Discoveries**:
  - Nothing but its test read `SyncedToplevel`, so removing it touched nothing else.
  - The old fingerprint test passed 12/12 locally only because the user query answered before the
    refresh; the new DOM test's refreshed-token case is the regression guard.

* **Noted, not fixed** (for thread 9, and the PR's open questions):
  1. `forgetDeadSignIns` clears every `__convexAuthOAuthVerifier*` key, which can end a sign-in
     under way in another tab. Convex Auth's single verifier slot already breaks two concurrent
     sign-ins upstream.
  2. The patch has two copies of the "delete this code's verifier" logic, in `userOAuth.js` and
     `verifyCodeAndSignIn.js`.
  3. The note can be taken during the in-flight `await signIn` if the outcome effect's deps change
     in that window, raising the notice as the tab leaves.
  4. If our `createOrUpdateUser` throws at the exchange, the mutation rolls back, and the code and
     its verifier survive until the code's 2 minutes run out (the 15-minute bound still applies).

* **For thread 6**: `useGoogleSignIn` (`{ offered, start }`) is unchanged. In the same file,
  `fingerprintOf` is gone (`sessionOf` instead) and `isUnfinished` returns a boolean, not a promise.

* **For the Coach**: `jose` was added as a direct dependency without asking first (Decisions, 2).
