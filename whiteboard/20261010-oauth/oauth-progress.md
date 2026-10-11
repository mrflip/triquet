# Sprint `oauth`: progress

**Status: threads 1, 2 and 7 underway (2026-10-11).**

The running handoff, newer than `oauth-plan.md` wherever the two disagree. Each thread writes its
own section to `thread-<N>-<label>.md` beside this file; the orchestrator curates this one.

| # | Thread | Status | Branch | PR |
|---|--------|--------|--------|----|
| 1 | `split_account`: free the words "account" and "username" | underway | `20261011-split_account` | |
| 2 | `clear_people`: delete production's people, keep its hunts | underway | `20261011-clear_people` | |
| 3 | `converge`: users and huntships, everywhere | pending (1, 2) | | |
| 4 | `adopt_script`: give a user a userlabel, admin, and hunts | pending (3) | | |
| 5 | `google_signin`: the provider, the patch, the merge | pending (3) | | |
| 6 | `google_ui`: signing in, from both doors | pending (5, 8) | | |
| 7 | `google_pages`: homepage, privacy, terms, contact | underway | `20261011-google_pages` | |
| 8 | `reserved_words`: survey and augment the reserved list | pending (a free slot) | | |
| 9 | `oauth_security`: a strong review | pending (1-8) | | |

Full e2e runs at landing: threads 3 and 5, and every fourth landing (none yet).

## What the threads have taught

*Orchestrator:* nothing yet.

## Convex Auth, as installed (checked 2026-10-10)

*Orchestrator:* the evidence behind the pre-plan's choices. It was checked against the source,
not from memory.

* **Which line we are on.** `@convex-dev/auth` 0.0.96 is npm's `latest` (2026-09-30), the head of
  `main` ("the current stable release (v1)"), in maintenance mode. v2 is an alpha rewrite on the
  `reboot` branch; see `convex-auth-v2.md`.
* **The callback URL** is `(CUSTOM_AUTH_SITE_URL ?? CONVEX_SITE_URL) + /api/auth/callback/<provider>`.
* **The signing-in session is recorded but not passed on.** The OAuth verifier holds the
  session that started the sign-in (`verifier.sessionId`), and `upsertUserAndAccount` is handed it.
  But neither the default `createOrUpdateUser` nor a custom one sees it. The callback runs in
  the HTTP action Google redirects to, which carries no bearer token, so `getAuthUserId(ctx)`
  there is null. Upstream PR #306 hands it on; thread 5 carries that change as a `pnpm patch`.
* **Accounts are linked by verified email by default.** An OAuth or OIDC provider counts as
  verifying unless `allowDangerousEmailAccountLinking: false`. A custom `createOrUpdateUser` takes
  over that decision, so thread 5 decides it explicitly.
* **The React provider holds `isLoading` true while it exchanges `?code=`**, and strips the code
  from the URL. `useSession` waits on `isLoading`, so it should not race an anonymous sign-in.
  Thread 5 proves it.
* **Upstream issue #231**, "Transfer Anonymous to OAuth user", is open with no answer.
