# Sprint `oauth`: progress

**Status: paused. The plan is superseded by `20261011-oauth_preplan.md` (2026-10-11), awaiting the Coach. No thread cut.**

Mirrored live at https://claude.ai/code/artifact/89643f81-3e20-48c4-9cde-ef9268d7a1c6 (the files here win).

The running handoff. Newer than `oauth-plan.md` wherever the two disagree. Each thread writes its
own section to `thread-<N>-<label>.md` beside this file; the orchestrator curates this one.

| # | Thread | Status | Branch | PR |
|---|--------|--------|--------|----|
| -- | Keys guide (the Coach's item 1) | written by the orchestrator: `google-oauth-keys.md` | -- | -- |
| 1 | `oauth_google`: Google joins Anonymous | pending | | |
| 2 | `oauth_handoff`: the username comes along | pending (needs the Coach's yes on the mechanism) | | |
| 3 | `oauth_privacy`: a privacy page | pending (only if wanted) | | |

## What we know so far

*Orchestrator:*

* **The spine started over.** The spine through #218 merged under new SHAs (rebased on GitHub),
  so the main checkout was put back on `main` at `origin/main` (`a9a35002`) with the Coach's
  word, before anything was written. Every thread is cut from there.
* **Convex Auth 0.0.96 sets the callback URL** to
  `(CUSTOM_AUTH_SITE_URL ?? CONVEX_SITE_URL) + /api/auth/callback/<provider>`.
* **Convex Auth 0.0.96 records the signing-in session but does not pass it on.** The verifier
  holds the session that started an OAuth sign-in, and `upsertUserAndAccount` is handed it, but
  neither the default `createOrUpdateUser` nor a custom one sees it. Hence thread 2.
* **Accounts are linked by verified email by default.** An OAuth or OIDC provider counts as
  verifying unless `allowDangerousEmailAccountLinking: false`. Anonymous users have no email, so
  there is nothing to collide with today.
* **The React provider holds `isLoading` true while it exchanges `?code=`.** It also strips the
  code from the URL with `replaceURL`. `useSession` waits on `isLoading`, so it should not race;
  thread 1 proves it.

### Anonymous to Google: checked against the latest Convex Auth (the Coach asked, 2026-10-10)

*Orchestrator:* the Coach had heard from other agents that upgrading an anonymous user was
straightforward. Checked at the source on 2026-10-10:

* **Which line we are on.** `@convex-dev/auth` 0.0.96 is npm's `latest` (2026-09-30) and the head
  of the repo's default branch, `main`, which its README calls "the current stable release (v1)".
  That is what we pin.
* **v2 is a rewrite in progress.** It lives on the `reboot` branch, published as
  `2.0.0-alpha.2` under the `alpha` tag (2026-09-16), and was still landing commits on
  2026-10-09. It is rebuilt as Convex components: the app writes `createUser` and `onSignIn`
  mutations. Not for us yet.
* **v1 docs.** *Advanced → Account linking* links accounts only by verified email or phone, or
  through a custom `createOrUpdateUser`. That callback is handed `existingUserId`, the user of the
  *account* being signed in to, never the session that started the sign-in. The page carries a
  commented-out line, "This is required when you configure anonymous sign-in", with nothing
  under it.
* **v1 code.** The OAuth verifier records the signing-in session (`verifier.sessionId`), and
  `upsertUserAndAccount` receives it, but it is passed to neither the default nor the custom
  callback. The callback runs in the HTTP action Google redirects to, which carries no bearer
  token, so `getAuthUserId(ctx)` there is null.
* **v2 alpha.** `CreateUserFn` is handed `{ provider: { name, accountId, profile } }`, and
  `OnSignInFn` that plus `userId`. Neither carries the current session. The v2 *Anonymous* doc
  says nothing about upgrading.
* **Upstream.** Issue get-convex/convex-auth#231, "Transfer Anonymous to OAuth user"
  (better-auth's anonymous plugin, which has this, is the model it cites), is open with no
  answer.

**Conclusion.** "Straightforward" holds for libraries that ship it (better-auth's `linkAccount`).
In Convex Auth, the session needed is captured internally and then dropped. Thread 2's options
stand as planned:

1. The app's own one-time hand-off.
2. Google required to take a username.
3. A one-line `pnpm patch` handing `existingSessionId` to `createOrUpdateUser`. This is the
   smallest code, but it means patching a pinned dependency, and taking over user creation for
   every provider. Not recommended.

### Names for who is asking

*Orchestrator:* `identity-names.md`, beside this file, is being settled with the Coach in its own
live doc (https://claude.ai/code/artifact/48666255-cdcb-444d-9c41-034c8d1d91dd). The proposed
words are **cred** (`authAccounts`), **principal** (`users`, never a person), **session**, plus
our ident, label and identing. Read it before writing any plan text or code about sign-in; the
plan will be rewritten in its words once they are settled.
