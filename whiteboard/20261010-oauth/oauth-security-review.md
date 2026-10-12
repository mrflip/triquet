# The oauth sprint's security review (thread 9, 2026-10-12)

The whole sprint, `29850126...bbbcd155` (threads 1 to 8, and 5r), read for what the pre-plan asks
of thread 9: the sign-in path, the patch, `createOrUpdateUser`'s table, sealing, the admin flag,
the clear and adopt commands, the claim rules, and what a browser can learn of another user, email
above all. Read this for a finding's evidence and recommendation; `thread-9-oauth_security.md` has
the summary, `notes/security.md` the briefs, `whiteboard/TODO.md` the open items.

## How

* `/code-review high` over the range (13 findings, none verified by the skill); each checked
  against the worktree's files.
* The `security-review` skill: a finder over the whole diff, then a filter at confidence 8. Nothing
  passed the filter; its two Low items are F3 and F4 below.
* The `convex-reviewer` checklist over `convex/`: no database `.filter`, no unbounded `.collect`,
  no `Date.now()` in a query, an index for every lookup, every public function through
  `functions.ts`'s builders (so through `askerOf`). Nothing beyond the code review's efficiency
  notes.
* By hand: every public Convex function's authorization (`Unscoped` and the scoped builders), the
  row rules (`policy_rules.ts`), the patch against the installed originals
  (`node_modules/@convex-dev/auth/dist/`: `userOAuth.js`, `verifyCodeAndSignIn.js`, `users.js`,
  `signIn.js`, `verifierSignature.js`, `react/client.js`), and each item of the progress document's
  *For thread 9* list.

## Findings

| # | Finding | Severity | Disposition |
|---|---|---|---|
| F1 | The front door's `?then=` is an open redirect for a visitor holding a handle (`/?then=/%09/evil.example`) | Medium | **Fixed** (three `fix:` commits: mine, and the review's two) |
| F2 | `hunts:open` lists smiths' handles and titles (Google names, by default) to anyone, enumerably | Low to Medium (privacy) | Left: the Coach's call |
| F3 | A verifier can be re-signed, so a leaked verifier id works for its whole 15 minutes | Low | Left: a fifth part to the patch |
| F4 | `adopt --email` trusts an email Google may not have verified | Low | Left: the Coach watches the one run |
| F5 | "Signed in with Google" fails open when `isAnonymous` is absent | Low (hardening) | Left: recommended |
| F6 | `adopt` and sandboxes: `--smith-all` reaches them; a relabelled anonymous user may make a second; a relabel frees the old handle | Low (command line only) | Left: recommended |
| F7 | `sealedJoin` tells a smith a handle is anonymous; the policy is silent | Low (privacy) | Left: wording |
| F8 | Sign out leaves the hunt histories in a shared browser | Low (privacy) | Left: wording or a clear |
| F9 | `/api/ask` answers any POST (O1), still | pre-existing | Left: bring-your-own-key is unblocked |

### F1: the front door's `then` (fixed)

`Routes.thenFrom` refused a `then` starting `//` or `/\`, by its first characters. A browser drops
tabs and newlines from an address before reading it, so `/<tab>/evil.example` passed and became
`//evil.example`, another site. `UserlabelGate` sends a visitor who holds a handle to `then` at
once (`router.replace`), and a Google sign-in comes back to the page it left, query and all, so
a link `/?then=/%09/evil.example` sends someone off-site straight after signing in. It predates
the sprint, but it is on the sign-in path and the fix is local. `thenFrom` now reads the path as a
browser will (`onSite`, which `isSyncedPath` already did inline, now shared), refuses any
backslash, and answers the path as read. Tests: tab, newline, CR LF, tab plus backslash, a
backslash anywhere, and the escaped tab as `useSearchParams` hands it over.

*The review of this thread found two more, fixed on the branch by the reviewer:*
* **Dot segments.** Reading the path as a browser does resolves `.` and `..`, so
  `/.//evil.example` read as the path `//evil.example`, and answering the path as read handed the
  router a protocol-relative address: an open redirect that the first fix itself opened (before it,
  that input stayed on-site). `onSite` now refuses a path that reads as `//…`.
* **A parse failure.** `new URL` throws on an address with a tab before an unparseable
  host (`/?then=/%09/[`): `thenFrom` threw in the front door's render, and `isSyncedPath` in Convex
  Auth's `redirect` callback, which then threw instead of falling back to `/`. `onSite` now answers
  null for an address no browser could read.

### F2: smiths shown to strangers, enumerably

`hunts:open` (`Unscoped`) answers a caller not on the hunt with `{ why: 'notOnHunt', smiths }`,
each a handle and title. It runs for a caller with no session at all (`askerOf` gives the
unlabelled actor; `mayReadHunt` says `notIdentified`; the smiths are returned anyway). Given no
`orglabel` (an old `/h/<label>` address), it finds the hunt by label across every org
(`huntForLabel`). Labels are `unique-names-generator` adjective_animal pairs: 1,202 by 355, about
430,000. So a script can list every hunt's smiths. Since thread 6, the front door offers a Google
user its Google name as its title, so those titles are often real names. The privacy policy says
smiths are shown to whoever opens an address, so this is a choice, not a leak, as thread 7 said;
what is new is the scale and the real names.

*Recommendation:* list smiths only to a caller holding a handle (not a crawler's anonymous session
with none), and only for an address naming the org; or show a stranger handles without titles.
Either changes the policy's wording. TODO O3's note said "anyone with a userlabel": it is anyone,
corrected.

### F3: a verifier can be signed again

Convex Auth's `verifierSignature` (the `/api/auth/signin/google?code=<verifier id>` route) patches a
fresh signature onto any verifier that exists. The Coach's option 1 bounds what that buys: the
exchange hands on the starting session only within `SIGN_IN_START_MAX_AGE_MS` (15 minutes), and a
verifier dies with its code. Within those 15 minutes, though, whoever learns the id (from local
storage, or a log) can sign it in their own browser, finish at Google with their own account, and
exchange their own code with it: the victim's anonymous user is upgraded into the attacker's new
Google account, or merged into the attacker's existing user (who becomes smith of the sandbox).
`notes/security.md` already states the bearer property; this is the cheap way to close most of it.

*Recommendation:* refuse to sign a verifier twice. The victim's own browser signs it on its way to
Google, which is the only signing anyone needs. Our callback clears the signature, so "signed
before" needs a mark of its own (a field on the verifier, or deleting the signature only at the
exchange). A fifth part to the patch, so the Coach's to approve.

### F4: `adopt --email` and Google's `email_verified`

`adopt:perform` finds a user by the `email` on its row, refusing if more than one has it. The row's
email is Google's claim, kept without `email_verified`: Auth.js's Google profile drops it, and
`UserValidators.googleProfile` keeps only email, name and image. Someone who signed in before the
Coach with a Google account claiming the Coach's address, unverified, would be the one match if
the Coach had not signed in. The pre-plan's order (the Coach signs in, then the command runs, with
the Coach watching) covers it, and a second holder is refused.

*Recommendation:* the dry run could name the user's Google name and when it was made, so the Coach
recognizes their own. Or keep `email_verified` and refuse a find by an unverified email, which
would add a field the privacy policy does not name.

### F5: "signed in with Google" fails open

`User.isAnonymous` is `isAnonymous === true`, and `Actor.isSignedInWithGoogle` is its negation. A
row with no `isAnonymous` is therefore signed in with Google: unsealed, and its `admin` flag
counts. Every writer of `users` sets the field today (`User.anonymous`, `User.fromGoogle`,
`User.provisional`, `testing:vouchFor`), so nothing reaches it now.

*Recommendation:* `isAnonymous === false` for signed in, and sealed otherwise. Three convex-tests
insert users without the field and expect them joinable (`huntship_actions.test.ts`,
`hunts.test.ts`, `testing.test.ts`). Left, as it moves thread 5's one predicate and every sealing
policy with it for no live bug.

### F6: `adopt` and anonymous sandboxes

Thread 4's open items, weighed:
* `--smith-all` covers every hunt, anonymous users' sandboxes included, and `--smith ~anon/anon`
  reaches one: the adopted user becomes a smith there, and could delete, relabel or add members to
  the sandbox. At the one planned run, production holds no sandboxes.
* Relabelling an anonymous user that holds a sandbox lets it make a second (`mayMakeHunt` reads only
  label == userlabel), and a later merge finds only the new one (`huntInOrg(label, label)`).
* A userlabel `adopt` relabels a user away from is left free (thread 4's decision: no merge, no
  ghosting), unless a hunt's address holds it.

*Recommendation:* skip anonymous users' sandboxes in `--smith-all`, refuse `--smith` on one, and
refuse relabelling an anonymous user that holds a sandbox. Either ghost the old userlabel, or say
in the outcome that it is now free. All need a deploy key, so none is urgent.

### F7: `sealedJoin` and anonymity

A smith adding a handle is refused with `sealedJoin` when its user is anonymous, so learns that. The
policy's *Who sees what* does not say so. *Recommendation:* add a line to the policy, or word the
refusal as "can't be added yet" without saying why.

### F8: sign out on a shared browser

`useSignOut` ends the session and reloads at `/`. The hunt histories (isomorphic-git mirrors in
IndexedDB) stay, and the next person at that browser can read them. The policy says clearing the
site's data removes them; the sign-out question does not. *Recommendation:* say so in the question,
or offer to clear them.

### F9: the ask route

TODO O1: `/api/ask` answers any POST on the server's key. The Coach's plan was bring-your-own-key
once OAuth exists; it exists now. Pre-existing, noted only.

## What held

* **Login CSRF, closed.** Google's callback links the account only (to its own user, or a new
  provisional one) and reads nothing of the starting browser's. The starting session is handed on
  only at the `?code=` exchange, which needs the code Google sent and the verifier the browser kept;
  a mismatched verifier spends the code and deletes the verifier. A sign-in link finished in a
  victim's browser leaves its code there, refused. A victim cannot be signed in to an attacker's
  account the other way round either.
* **The patch matches its notes.** Four parts beyond #306's `authUserId`, against the installed
  originals: no session at the callback; the verifier kept, unsigned, until the exchange; a code
  spent by a wrong verifier, or expired, or replaced, takes its verifier; the exchange refuses a
  verifier older than 15 minutes, whole. The client part keeps the stored session on a refused or
  failed exchange, and never takes another browser's.
* **The redirect rule** (`returnUrlFor`, `isSyncedPath`): relative synced pages only, read against
  a fixed origin, so a tab or newline trick is refused, and anything else falls back to `/`;
  an address `new URL` cannot parse threw there instead, until the review's second fix (F1).
* **The table** (`userAtExchange`, `mergeInto`): never by email; two Google users never merged; an
  upgrade folds the provisional user away in the same mutation; nobody is ever signed in as a
  provisional user; a merged-away user's sessions and refresh tokens go, and `askerOf` reads a
  token whose session is gone as no session; a sign-in started before a merge finds its session
  gone, and is taken as one from no session (a switch, or a new user).
* **Name choice** (`settle_name_choice`): only by the user merged into, between exactly the two
  handles, once; the other handle ghosted; no address moves.
* **Sealing**, including `sealedDelete`, which landed after thread 3's second review: an
  anonymous user makes only its sandbox, never relabels or deletes it, never adds anyone, is never
  added (`addHuntship`, `grantHuntship`, `smithOfSandbox` all ask `join_hunt`), never reviews.
  `hunts.test.ts` and `approve.test.ts` hold `sealedDelete`.
* **Admin**: read only in `Actor.ofUser`, and only for a user signed in with Google; written only
  by internal `adopt:perform`, which refuses an anonymous or provisional user.
  `TRIQUET_EVERYONE_ADMIN` is set only by `scripts/convex_dev`.
* **The stand-ins**: `testing:*` are internal, and each refuses without `TRIQUET_CLEARABLE=yes`,
  which only `scripts/convex_dev` sets. `vouchFor`'s email and `mergeInto`'s mark sign nobody in.
* **Email**: `users:own` alone returns one, of the session's own user, by the id the session gives.
  Elsewhere a user reaches the browser as its face (userlabel, title, anonymous) or a huntship's
  copy. No scoped database reaches `users`, `ghostings` or Convex Auth's tables (default-deny).
  The browser shows the email in the user menu and on the front door, to its owner.
* **The claim rules**: a userlabel is taken in one transaction, free only while no user, ghosting
  or address holds it, and claimable only past the reserved list.
* **The clear**: deleted by thread 3, with its tables. The janitor guard's one check stays, as
  thread 2 recorded.
* **Deploy skew**: no shims, as the Coach recorded; nothing to carry out.
* **Recorded and still so**: the 8-digit code, unthrottled, now spent on landing; no sweep of
  provisional users or dead verifiers (TODO); `forgetDeadSignIns` clearing other tabs' verifiers
  (one verifier slot upstream breaks concurrent sign-ins anyway); a thrown `createOrUpdateUser`
  leaving its code alive its 2 minutes (the code is already stripped from the address); the two
  narrow races in `use-google-sign-in.ts` (a notice only); sign-out's two open questions (TODO,
  thread 6). None is a way in.

## Not security, from the code review

In TODO under thread 9: `holderOfUserlabel`'s read width; `auth:offered` built on `zQuery`;
duplicated copy-rewriting in `retitleUser` and `adopt`'s `relabelFor`; a variable named `name` in
`UserlabelGate`; the patch's two copies of "delete this code's verifier". Dismissed: the patch's
`catch (error)` (upstream's style, in `node_modules`' `dist/`, which no lint reads).
