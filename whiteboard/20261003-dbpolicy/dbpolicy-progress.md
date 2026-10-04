# Sprint `dbpolicy`: progress

The running handoff. Newer than `dbpolicy-plan.md` wherever they disagree. Each thread updates
its row below and adds its section above the others, newest first.

## Status

| # | Thread | Status | Branch | PR |
|---|---|---|---|---|
| 1 | Sessions and the actor | complete, in review | `20261004-dbpolicy_sessions` | #79 |
| 2 | `Approve`: pure policy and the dispatcher | pending | | |
| 3 | One label, and integrity repairs | pending | | |
| 4 | Denormalize | pending | | |
| 5 | Affirmations | pending | | |
| 6 | A scoped database handle | pending | | |
| 7 | Reads shaped by role | pending | | |
| 8 | Views ask `Approve` | pending | | |
| 9 | The library behind an admin helper | pending | | |
| 10 | Tighten | pending (merge waits on production backfills) | | |

## Thread 1: Sessions and the actor (2026-10-04)

Branch `20261004-dbpolicy_sessions`, PR #79, against `main` (carries the five planning commits of
`20261003-dbpolicy_a` beneath it; no PR beneath). Suites: typecheck, lint, `pnpm test` (109 files,
2740 tests), `pnpm test:e2e` (207) all green.

* **Built**:
  - Convex Auth, Anonymous only: `convex/auth.ts`, `convex/auth.config.ts`, `convex/http.ts`,
    `authTables` spread into `convex/schema.ts`; the three variables declared in
    `convex/convex.config.ts`. `scripts/convex_auth_keys <role>` mints throwaway keys (Node's
    `crypto`, RS256, the shape Convex Auth's manual setup prints) and sets them through a 0600
    temp file and `convex env set --from-file`; `scripts/convex_dev` calls it after the
    `TRIQUET_CLEARABLE` line. Does nothing when `JWKS` is set.
  - `src/lib/actor.ts`: `ActorT` (`AnonymousActorT | IdentActorT`), `Actor.anonymous` (frozen),
    `Actor.asIdent(user_id, ident)`, `Actor.isAnonymous`. A namespace of pure functions: thread 2
    adds `standing` and the predicates beside these.
  - `convex/functions.ts`: `askerOf(ctx)` is the one read path (token → `getAuthUserId` +
    `getAuthSessionId` → in parallel, the `authSessions` row and `identFor(db, user_id)`), and
    `zQuery`/`zMutation` put its result on `ctx` as `ctx.actor` and `ctx.user_id`.
    **Threads 5 and 6:** build `zHuntQuery`/`zHuntMutation` with `zCustomQuery(query, { args,
    input: async (ctx, args) => { const asker = await askerOf(ctx); ... } })`, not by reading
    identity again. `zInternalMutation` has no asker.
  - Every public function drops `browser_key`; `convex/authorize.ts` rules take `actor: ActorT`
    (`roleOn`, `mayReadHunt`, `mayChangeHunt`, `mayReadReview`, `mayWriteReview`,
    `mayReadLibrary`, `mayCountUsage`, `mayPerform`, `mayActOnAccount`). `mayReadReview` now
    guards `Actor.isAnonymous` first, closing the null-equals-null shape `policy_approve.md` warns
    of. `writing/perform` still receives `ident_id`; `hunting_actions`' `acting_id` is
    `acting_ident_id`; `use-hunt`'s `role: acting` is `role`.
  - Usernames held: `idents.user_id` (row validator `zid('users').nullable()`, schema optional by
    hand: the widen), backfill `migrations:backfillIdentClaims` (tested in
    `tests/convex/migrations.test.ts`), `Backfilling: { idents: ['user_id'] }`. `identings` is
    `{ user_id, ident_id }`, index `by_user_id`. `assumeIdent` claims through `claimFor`: own →
    take on; unclaimed (null or absent) → claim; another's → `usernameClaimed`. New refusals
    `notSignedIn`, `usernameClaimed` in `src/lib/notices.ts`.
  - Browser: `ConvexAuthProvider` in `src/app/providers.tsx`; `src/state/use-session.ts` signs in
    anonymously once per page (module-level single flight) and returns `{ ready }`; every hook in
    `src/state/` skips until ready. `useAccountActions` signs out on a `notSignedIn` refusal, so
    the next try has a fresh session. `src/state/browser-key.ts` and its test are gone.
  - Tests: `tests/support/convex.ts` has `signedIn(tt)` (a `users` + `authSessions` row and
    `tt.withIdentity({ subject: 'user|session' })`), `identified(tt, label)` → `{ as, user_id,
    ident_id, label, actor }`, `callerOf(by)`, and `seedHunt`'s `act(action, by)` taking a
    `Session` or the bare `tt` (no session). **For threads 2 and 5's matrix:** smith =
    `seeded.smith`, reviewer = `await join(label, 'reviewer')`, stranger = `await identified(tt,
    label)`, anonymous-with-session = `await signedIn(tt)`, no session = `tt`; each `Identified`
    carries `.actor` for calling a rule directly. New: `tests/lib/actor.test.ts`,
    `tests/convex/functions.test.ts` (`askerOf`, including a token whose session is gone).
  - e2e: `e2e/routing.spec.ts` › *turns a second browser away from a username the first holds…*
    No spec planted `triquet.browser_key`, so nothing else changed.
* **Decisions taken**:
  - **Step 1, confirmed**: manual setup is `auth.config.ts` (`domain: CONVEX_SITE_URL`,
    `applicationID: 'convex'`), `convexAuth({ providers })`, `auth.addHttpRoutes(http)`,
    `authTables`; env `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`. `getAuthUserId` only splits the
    token's `subject` (`userId|sessionId`) and never reads the database. The React side is
    `ConvexAuthProvider` (tokens in `localStorage`, namespaced by the deployment URL, so each
    browser context is its own session), `useAuthActions().signIn('anonymous')`, and `useConvexAuth()`.
    convex-test supplies identity with `tt.withIdentity({ subject })`. `@convex-dev/auth` 0.0.96 and
    `@auth/core` 0.41.1, both exact (0.41.1 is what the setup page installs).
  - **Step 5, proved**: on the `agent` backend a Node script signed in anonymously through
    `auth:signIn`, and a query then saw `getAuthUserId` and `getAuthSessionId` non-null; a
    tampered token was refused (*Could not verify OIDC token claim*). The local backend's
    `CONVEX_SITE_URL` defaults to `http://127.0.0.1:35xx`, so it fetches its own JWKS with no
    extra flags.
  - **The actor needs the session to exist**, not just a valid token: `askerOf` reads the
    `authSessions` row (in parallel with the identing, so no extra round). Without it a token
    outliving its session (signed out, or a backend emptied by `convex_reset`) would write
    identings for a dead user and strand the username it claimed.
  - **`ctx.user_id` beside `ctx.actor`**: `assume_ident` needs the session's user while the actor
    is still anonymous, and the plan's anonymous actor carries no id. `user_id` is null only for
    a request with no session (a lookup that found nothing). `retitleIdent` and `newHunt` take the
    actor rather than `user_id` (they act on its ident).
  - **Sessions last ten years, or a year unvisited** (`convex/auth.ts`), not Convex Auth's thirty
    days total: an anonymous session that ends strands its username. See *For the Coach*.
  - **`identified(tt, label)` returns the session already holding `label`** in that tester, so
    two hunts seeded with one smith label share a smith, as before. A test of a second session
    asserting a held username uses `signedIn`.
  - The browser is not told `user_id` (`IdentT` is `{ _id, label, title }`).
* **Deviations**:
  - `scripts/convex_auth_keys` generates the pair with Node's built-in `crypto` rather than
    `jose`: `jose` is only a transitive dependency under pnpm, and the output matches the manual
    setup's byte for byte in shape.
  - `IdentGate` needed no new state: it already showed the refusal's sentence in place and let the
    visitor try again; only its blurb changed.
  - `CLAUDE.md`'s *Architecture* still says `src/state/` holds "the browser key"; agents may not
    edit `CLAUDE.md` on an agent's word, so it is left for the Coach (it should say "the session
    (`use-session`)").
* **Discoveries**:
  - The planning branch's `convex/authorize.ts` imported `@/lib/approval.js`; the convex-test
    project cannot resolve the alias, so every Convex test failed. Now a relative import.
  - `convex.config.ts`'s declared `env` does not hide undeclared variables from `process.env`;
    Convex Auth reads them there. They are declared anyway, for the record.
  - Each anonymous `signIn` makes a `users` row, and `auth:signIn` is public: anyone with the URL
    can mint users. Not new in kind (anyone could mint idents), but a rate limit belongs on the
    *Later* list now.
  - `ownHunting`'s check and `retitleIdent`'s re-read of the ident are where they were; thread 2
    moves the former.
* **For the Coach**: (also in `HUMAN-whatsup.md`)
  - Production and preview deployments need `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL` before this
    deploys; `identings` cleared by hand; then `migrations:backfillIdentClaims`
    (`notes/deploy.md`, *Sessions*).
  - **Thread 10 should tighten `idents.user_id`** too (drop the schema's hand-written optional,
    the backfill, and `Backfilling`), which the plan's thread 10 list does not name.
  - Session lifetime (ten years / a year unvisited): confirm, or choose another.
  - Clearing a browser's site data now loses its username for good, until sign-in exists.
