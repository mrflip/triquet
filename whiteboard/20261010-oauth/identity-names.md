# Identity names

Working doc, 2026-10-10, edited live with the Coach at
https://claude.ai/code/artifact/48666255-cdcb-444d-9c41-034c8d1d91dd. The doc is where the Coach
settles each word; this file is its copy in the repo, brought up to date as the doc changes.

Superseded in part (2026-10-11): `20261011-oauth_preplan.md` settles the names (account, user, huntship, ghosting) and wins where the two differ.

What we call each thing that says who is asking, in our code, in Convex Auth and in Google's
OAuth, so the OAuth sprint's plan and code use one word per thing.

## Words

Our words go in prose, notes and our own fields. Code that calls Convex Auth keeps its names
exactly. None of these words means "a person": one person may have many creds, principals,
sessions and idents.

| Concept | Our word | External name | Fixed by | Status |
| --- | --- | --- | --- | --- |
| A way of proving who is asking: one Google account, or one anonymous sign-in | **cred** | `authAccounts` row; Auth.js and better-auth call it an "account" | Convex Auth's table; habit | Proposed |
| The opaque id a cred carries | the cred's **provider id** | `providerAccountId`: Google's `sub` for a Google cred, a random UUID for an anonymous one | Convex Auth's field; OIDC | Proposed |
| What creds are linked to, and what holds idents | **principal** | `users` row, `Id<'users'>`, `userId`; our `user_id` fields | Convex Auth's table and API | Proposed |
| A signed-in browser | **session** | `authSessions` row, `sessionId` | Convex Auth | Proposed |
| A persona in the app | **ident** | ours: `idents` row | -- | Proposed |
| The human-readable name of an ident, unique across the app | **label** ("username" on screen) | ours: `idents.label`, validated by `userlabel` (6 to 24 lowercase letters, digits and single underscores, not a reserved word); copied as `hunts.orglabel`, the `~org` in a hunt's address | -- | Proposed |
| A record of a principal taking on an ident | **identing** | ours: `identings` row, append-only | -- | Proposed |
| Each row's own id | **`_id`** | Convex's `_id` | Convex | Proposed |

**What a principal is, exactly.** Convex Auth makes a new one for every anonymous sign-in, and
one for each Google account that signs in, unless that account's verified email matches an
existing principal's, in which case the new cred is linked to that principal. So one principal
per anonymous browser, and one per Google account (or per verified email). Never one per person.

## Models and identifiers

Every table or token that says who is asking, today with Google added, as `@convex-dev/auth`
0.0.96 has them. Rows marked *OAuth only* exist only once Google sign-in is built.

| Model | Our word | Whose | One per | Identifiers, and where each is held | Points to |
| --- | --- | --- | --- | --- | --- |
| Google account | -- | Google | Google account | `sub` (in Google's ID token); email | -- |
| `authAccounts` | cred | Convex Auth | Google account that signed in, or anonymous sign-in | `_id`; `provider` (`anonymous`, later `google`); `providerAccountId` (Google's `sub`, or a random UUID) | `userId` → `users` |
| `users` | principal | Convex Auth | anonymous sign-in, or Google account (or verified email, when creds link) | `_id`; `isAnonymous`; with Google, `email`, `name`, `image` | -- |
| `authSessions` | session | Convex Auth | signed-in browser | `_id`; `expirationTime` | `userId` → `users` |
| Access token (a JWT, not a row) | -- | Convex Auth | session, re-issued hourly | `sub` = `<users._id>\|<authSessions._id>`; `iss` = `CONVEX_SITE_URL`; `aud` = `convex`. Browser: `localStorage` `__convexAuthJWT`, namespaced by the Convex URL | names a principal and a session |
| `authRefreshTokens` | -- | Convex Auth | session, rotated on use | `_id`. Browser: `localStorage` `__convexAuthRefreshToken` holds `<refreshTokenId>\|<sessionId>` | `sessionId` → `authSessions` |
| `authVerifiers` (OAuth only) | -- | Convex Auth | sign-in under way | `_id` (browser: `localStorage` `__convexAuthOAuthVerifier`); `signature` | `sessionId` → the session that started it |
| `authVerificationCodes` (OAuth only) | -- | Convex Auth | finished Google callback | `code`, stored hashed; reaches the browser once as `?code=` | `accountId` → `authAccounts` |
| `idents` | ident | ours | persona | `_id`; `label`; `title` | `user_id` → `users`: the principal holding it (null if unheld) |
| `identings` | identing | ours | time a principal takes on an ident | `_id` | `user_id` → `users`; `ident_id` → `idents` |

Rows elsewhere point at an ident by `_id` (`huntings.ident_id`). URLs, screens and "add to hunt"
use its label.

The doc carries a drawing of the *Points to* column. Everything meets at the principal: creds and
sessions point at it, and so do idents (their holder) and identings. The access token names both
a principal and a session.

## Who mints each identifier

| Minter | What it mints |
| --- | --- |
| Convex | every `_id`, on insert |
| Google | the `sub` of a Google account |
| Convex Auth | an anonymous cred's UUID (`crypto.randomUUID()`); the access token, signed with `JWT_PRIVATE_KEY`; the refresh-token string; an OAuth verifier and its PKCE signature; the one-time `?code=` (8 random digits) |
| The Coach, or `scripts/convex_auth_keys` locally | the key pair `JWT_PRIVATE_KEY` and `JWKS` that tokens are signed and checked with |
| The person typing | an ident's label and title |
| Our code (`assumeIdent`) | the `idents` and `identings` rows, and which principal holds an ident |

## Traps

* **"User" is not a person.** A `users` row is a principal: one per anonymous sign-in, or one per
  Google account. An agent reading `user_id` assumes a human and reasons wrongly from there.
* **A Google account is not a person either.** One person may sign in with two Google accounts
  and get two principals.
* **Two different `sub`s.** Google's `sub` names a Google account and is stored as
  `providerAccountId`. Convex Auth's JWT `sub` is `<principal>|<session>`. Say "provider id" for
  the first; never bare `sub`.
* **Convex's `subject` is the JWT's.** `ctx.auth.getUserIdentity()` returns `subject`, `issuer`
  and `tokenIdentifier`, all about the token. So "subject" is no name for Google's `sub` here.
* **"Account" is taken twice.** Auth.js and better-auth call a cred an "account". Our code already
  uses "account" for what a visitor does before opening a quiz (`performAccount`,
  `accountAction`, `use-account-actions`).
* **"Credentials" in Convex Auth** means its non-OAuth provider kind (`ConvexCredentials`), which
  Anonymous is built on. "Cred" for every `authAccounts` row, Google ones included, stretches
  that slightly.
* **Names fixed at the boundary.** `users`, `userId`, `getAuthUserId`, `existingUserId`,
  `createOrUpdateUser`, `authAccounts`, `providerAccountId` stay as they are wherever we call
  Convex Auth.

## Open questions

- [ ] Settle each word in the table above (cred, provider id, principal, session).
- [ ] Rename our own `user_id` fields on `idents` and `identings` to `principal_id` (still
  `zid('users')`)? A schema change with a migration; or keep `user_id` and change only the prose.
- [ ] Once settled: one entry in `notes/vocabulary.md` giving each word, its Convex Auth name,
  and the traps above.
- [ ] Rewrite the OAuth sprint plan (`whiteboard/20261010-oauth/oauth-plan.md`) in the settled
  words.
- [ ] Should an identing tie an ident to a principal (as now) or to a cred? A principal is right
  if a second linked cred should not move idents.
- [ ] Free the word "account" (the Coach, 2026-10-11): our `account`-named dispatch and policy
  code (`performAccount`, `accountAction`, `use-account-actions`) does not deserve it. Not
  rewritten now; renamed when next touched. Once it is free, "account" can mean what Convex Auth
  means by it, and replace "cred".
- [ ] Fold the ident into Convex Auth's `users` row (one persona per user, GitHub-style), or keep
  idents apart (several per user)?
