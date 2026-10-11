# OAuth: Google sign-in beside the anonymous session

Sprint plan, 2026-10-10. Mode: **normal** (interactive). Review level: **medium**. At most **3**
threads at once. Issued by the Coach (Flip), in chat.
**Status: superseded (2026-10-11) by `20261011-oauth_preplan.md`, which the Coach will hand to `/sprint`. No thread cut.**
`oauth-progress.md`, beside this file, is newer than this plan wherever the two disagree.

## The Coach's request, verbatim

> google oauth normal interactive mode.
>
> 1. make a whiteboard file describing how to sign up for a key that I can use for a few hundred
>    people (i.e. not just a friends and beta testers key). If there will be big steps to getting
>    the one I want describe also what to do for the other kind. (I've already done parts of this).
>    - I do not have a custom domain or paid plan at vercel. If vercel, doppler or convex offer
>      integrations that will simplify this, describe them; I may choose to do that in place of the
>      barely ten minutes to get the other keys.
>
> 2. make a thread plan for adding oauth according to the traditional method.
>    - if it involves new features of convex (eg workers) that we're not using already, go ahead
>      and just let me know what they are.
>    - if it involves a tighter coupling to server side code, pause and let me know -- I'm hoping
>      to remain client-first as long as reasonable.
>
> As always, no heroics, and strive to be library first following standard best practices

Item 1 is `google-oauth-keys.md`, beside this file, written by the orchestrator while planning.
Item 2 is the threads below.

## What "the traditional method" comes to here

Convex Auth's own Google provider (`@auth/core/providers/google`), the authorization-code flow
with PKCE and state, run by Convex Auth on the deployment's HTTP actions. The browser calls
`signIn('google', { redirectTo })`; Convex Auth's action sends it to Google. Google returns to
`<deployment>.convex.site/api/auth/callback/google`, where Convex Auth exchanges the code,
upserts the user and account, and redirects to `SITE_URL` with a one-time `?code=`. The React
provider we already mount (`ConvexAuthProvider`) trades that for a session.

**Client-first holds.**
* No Next.js route handler, no middleware, and not `@convex-dev/auth/nextjs`, which is only for
  server rendering, which we do not do.
* The pages stay static. The only server in the flow is Convex's HTTP actions, which already
  serve Convex Auth's JWKS (`convex/http.ts`).
* The one thing that would step toward the server is path C's optional Vercel rewrite, in the
  keys file. No thread here takes it.

**No new Convex features.** We already use HTTP actions, Convex Auth and its tables. What is new:

* Two deployment environment variables, `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.
* One app table, `handoffs`, in thread 2 (a new table, so no migration).
* No crons, no workers, no components, no Node actions.

## Read first

Beyond CLAUDE.md and its auto-loads:

* `google-oauth-keys.md`, beside this file: what the Coach will set up, and where previews and
  dev stand.
* `notes/convex.md`, *Who is asking*, all of it, and `convex/_generated/ai/guidelines.md`.
* `notes/stack.md`, *Authentication*. Google "joins `Anonymous` in the list".
* `notes/deploy.md`, the paragraph on Convex Auth's keys (around line 58) and *Sessions (dbpolicy
  thread 1)*: the pattern the Coach's steps follow.
* `notes/security.md`, and `notes/guidelines.md` before designing the hand-off's entrypoints.
* The code:
  - `convex/auth.ts`, `convex/auth.config.ts`, `convex/http.ts`, `convex/convex.config.ts`
    (declared env).
  - `convex/functions.ts` (`askerOf`), `convex/idents.ts`, `convex/writing/account_actions.ts`
    (`assumeIdent`, `claimFor`), and `convex/authorize.ts` (`Unscoped`).
  - `src/state/use-session.ts`, `use-ident.ts`, `use-account-actions.ts`, and
    `src/app/providers.tsx`.
  - `src/components/IdentGate.tsx`, and `src/lib/notices.ts` (`usernameClaimed`, which already
    says "create an account on the device where you first chose it").
  - `scripts/convex_dev`, `scripts/convex_auth_keys`, `scripts/lanes.ts`.
* Convex Auth as installed (0.0.96), not from memory:
  - `node_modules/@convex-dev/auth/dist/server/oauth/convexAuth.js` (the callback URL).
  - `.../implementation/users.js` (account linking by verified email, and what
    `createOrUpdateUser` is and is not handed).
  - `.../react/client.js` (how `?code=` is consumed, and `isLoading` held through it).

## Ground rules

`notes/git_hygiene.md` (*The spine*, *A thread, start to finish*, *Sprints*) and
`.claude/agents/thread-worker.md`. Particular to this sprint:

* **Nothing automated signs in to Google**, ever: no test account, no stored Google credential in
  any config an agent or CI reads. Tests stop at the redirect (its URL's `client_id`,
  `redirect_uri`, `scope`, `code_challenge`), and the hand-off is proven in convex-test, over
  sessions made with `signedIn(tt)` and their kin.
* **No provider that signs anyone in without proof** may exist on a deployment that could serve
  people: no "fake Google" credentials provider, gated or not. If a thread finds it cannot test
  without one, it stops and asks.
* **Google is offered only where configured.** A deployment without `AUTH_GOOGLE_ID` lists only
  `Anonymous`, and the browser hides the button: previews, e2e and agent backends, unless a
  Doppler config hands a dev client to a local one.
* **Convex Auth's tables stay its own** (`notes/convex.md`): we read `users` for the email and
  name it stores, and never write them. Moving who holds an ident is our write, to our tables.
* **The private key, client secrets and any Google profile** never go in a log, a refusal, a
  test fixture or a chat. A Google cred's email is shown only to sessions of the principal it belongs to.

## The threads

| # | Thread | Depends on | Coach's call needed |
| --- | --- | --- | --- |
| 1 | `oauth_google`: Google joins Anonymous | nothing | no |
| 2 | `oauth_handoff`: the username comes along | thread 1 | yes: the hand-off is hand-rolled |
| 3 | `oauth_privacy`: a privacy page | nothing | only if wanted |

### 1. `oauth_google`: Google joins Anonymous

*The Coach's text:* "make a thread plan for adding oauth according to the traditional method", the
provider half.

**What it touches.**
* `convex/auth.ts`: `Google` in the providers list, only when the deployment has
  `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`, both declared optional in `convex/convex.config.ts`.
* A way for the browser to know whether Google is offered, so the button shows only where it
  works. A small public query is the likely shape: in `Unscoped`, with why.
* `src/state/use-session.ts`.
  - The anonymous sign-in must not race the `?code=` exchange on return. Convex Auth holds
    `isLoading` through it, which `useSession` already waits on. Prove it with a test, don't
    assume it.
  - A Google session is "ready" like any other.
* The view, MUI components:
  - "Sign in with Google" where a visitor takes a username (`IdentGate`), and in whatever menu
    the header offers a signed-in session.
  - Who you are signed in as (the email, shown only to its owner) and *Sign out*, which leaves
    the browser on a fresh anonymous session.
  - `redirectTo` is the path the visitor was on, relative, so `SITE_URL`'s rule holds.
* `scripts/convex_dev` sets `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` on a local backend when the
  Doppler config it runs under has them (the Coach's dev client), beside the throwaway JWT keys.
* Tests:
  - convex-test for the gated provider list and the query.
  - A unit test that `useSession` does not sign in anonymously while a code is being exchanged.
  - e2e on a backend given a dummy client ID: the button shows, and clicking it heads for
    `accounts.google.com` with the expected parameters. Intercept the navigation, never follow
    it.
* Documents:
  - `notes/stack.md`, *Authentication*.
  - `notes/deploy.md`: the Coach's steps, pointing at `google-oauth-keys.md`'s path A.
  - `notes/env_vars_tokens_and_keys.md`.
  - `notes/security.md`: what we store from Google (email, name, picture, in Convex Auth's
    `users`), and that Convex Auth links accounts by verified email by default.

**Depends on:** nothing.

**Look-ahead.**
* Thread 2 hooks in exactly where this thread starts the redirect, and right after the return.
  Keep the start of the sign-in in one function (in `src/state/`), so thread 2 can add a step
  before it.
* What a session signed in with a Google cred is called on screen is still its ident's title, not
  the Google account's name. The username stays the app's identity; a Google cred only proves which principal holds it.

### 2. `oauth_handoff`: the username comes along

*The Coach's text:* as for thread 1, the half that keeps what people already have.

**The problem.**
* Today a browser's anonymous user holds its usernames (`idents.user_id`). Signing in with Google
  makes a session for a **different** user, the Google one.
* Convex Auth 0.0.96 does record the anonymous session that started the sign-in (on its
  verifier), but hands it to no callback. Its upstream "upgrade anonymous" is not there.
* Without help, every existing username would stay stranded with an anonymous session nobody can
  reach from a second device. That is the "anonymous here, signed in there" collision
  `notes/stack.md` deferred to now.

**The proposed mechanism: a one-time hand-off.** It is small and hand-rolled, so it needs the
Coach's yes (CLAUDE.md, *Library first*, step 3). See *For the Coach*.
1. Just before the redirect, a browser whose anonymous session holds an ident calls
   `idents.offerHandoff`. The server writes a `handoffs` row: the anonymous user, a SHA-256 of a
   random secret it makes with Web Crypto, and an expiry about ten minutes out. It returns the
   secret, which the browser keeps in `sessionStorage`.
2. Back from Google, the new session calls `idents.takeHandoff(secret)`. That one mutation:
   - finds the row by hash and checks its expiry;
   - moves every ident the anonymous user holds to the Google user, appending identings so the
     ident the browser was on stays current;
   - deletes the row.
3. Any failure (expired, already taken, no row) is said plainly, and nothing moves.
4. An offer replaces that user's earlier one, so there is at most one row per user and no cron.

The secret proves only what the anonymous session token in the same browser's storage already
proves. It is no weaker, and it lives minutes, not a year.

**What it touches.**
* `src/models/` (a `handoff` row validator) and `convex/schema.ts`: a new table, so no
  migration. `convex/_generated/` is regenerated.
* `convex/idents.ts` and `convex/writing/account_actions.ts` (next to `claimFor`), and
  `convex/authorize.ts` (`Unscoped`, with why).
* `tests/support/soundness.ts` if any copy is involved; there should be none.
* The browser's sign-in function from thread 1, and a step after the return.
* `src/lib/notices.ts`: `usernameClaimed` says "sign in with Google on the device where you first
  chose it".
* Documents:
  - `notes/security.md`, an entry for the hand-off.
  - `notes/stack.md`, *Hand-rolled on purpose*, with the Coach's yes.
  - `notes/convex.md`, *Who is asking*, a paragraph on who holds an ident once Google is in.
* Tests in convex-test:
  - the happy path;
  - expired, reused, wrong and foreign secrets;
  - a Google user who already holds idents (they keep both, and the browser's current one wins);
  - two tabs racing to take one hand-off.

**Depends on:** thread 1.

**Look-ahead.** Whiteboard TODO's **O3** (unheld legacy idents go to the first session asserting
them) sits right beside this. Do not fix it here; note in the report whether Google sign-in
changes its answer.

### 3. `oauth_privacy` (only if wanted): a privacy page

*The orchestrator's addition, not the Coach's text.*

**What it touches.** A static `/privacy` page: what we store (username, title, quizzes; with
Google, the email, name and picture Google sends), who sees it, how to have it deleted. It is
linked from `/about` and the footer, so Google's branding page has a privacy-policy URL on the
app's own domain.

Run it only if the console refuses to publish without one, or the Coach wants it anyway.

**Depends on:** nothing; it can run beside thread 1.

## Order

Thread 1, with thread 3 beside it if wanted. Then thread 2.

Production gains Google sign-in when the Coach merges thread 1 and sets the two keys. The
hand-off follows with thread 2. Until thread 2 is merged, someone who already holds a username
should not sign in with Google, or they will find it held by their anonymous self. So the Coach
may prefer to merge 1 and 2 together.

## For the Coach

1. **The hand-off is hand-rolled** (thread 2). Yes, or the alternative?
   - The alternative: Google sign-in becomes required to take a new username, and the handful of
     usernames already held anonymously are reassigned once, by hand, with an internal mutation
     run from the dashboard.
   - That alternative needs no token, but every new visitor must sign in with Google before
     doing anything, which gives up the anonymous first visit we chose in October.
2. **Which key path**: A (publish now, unbranded) is recommended; see `google-oauth-keys.md`.
   Path C's Vercel-rewrite variant would be the one step toward the server, and needs your word
   before anyone builds it.
3. **Thread 3**, the privacy page: wanted?
4. **Bring-your-own-key asking** (TODO, O1: "once there is OAuth, asking becomes
   bring-your-own-key") is not in this sprint. Say if you want it planned as a thread 4.
