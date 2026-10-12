# Sprint `oauth`: progress

**Status: thread 5 landed (#232); the Coach's high review of it (5r) and thread 6 underway (2026-10-12). 7, 2, 1, 8, 3 and 4 landed (#226-#231).**

The running handoff, newer than `oauth-plan.md` wherever the two disagree. Each thread writes its
own section to `thread-<N>-<label>.md` beside this file; the orchestrator curates this one.

| # | Thread | Status | Branch | PR |
|---|--------|--------|--------|----|
| 1 | `split_account`: free the words "account" and "username" | landed #228 | `20261011-split_account` | [#228](https://github.com/mrflip/triquet/pull/228) |
| 2 | `clear_people`: delete production's people, keep its hunts | landed #227 | `20261011-clear_people` | [#227](https://github.com/mrflip/triquet/pull/227) |
| 3 | `converge`: users and huntships, everywhere | landed #230 | `20261011-converge` | [#230](https://github.com/mrflip/triquet/pull/230) |
| 4 | `adopt_script`: give a user a userlabel, admin, and hunts | landed #231 | `20261011-adopt_script` | [#231](https://github.com/mrflip/triquet/pull/231) |
| 5 | `google_signin`: the provider, the patch, the merge | landed #232 | `20261011-google_signin` | [#232](https://github.com/mrflip/triquet/pull/232) |
| 5r | `signin_review`: the Coach's `high` review of thread 5, fixes as their own PR | underway | `20261012-signin_review` | |
| 6 | `google_ui`: signing in, from both doors | underway | `20261012-google_ui` | |
| 7 | `google_pages`: homepage, privacy, terms, contact | landed #226 | `20261011-google_pages` | [#226](https://github.com/mrflip/triquet/pull/226) |
| 8 | `reserved_words`: survey and augment the reserved list | landed #229 | `20261011-reserved_words` | [#229](https://github.com/mrflip/triquet/pull/229) |
| 9 | `oauth_security`: a strong review | pending (1-8) | | |

Full e2e runs at landing: threads 3 and 5, and every fourth landing (thread 8 carries the fourth). So far every landing's `--touched` ran the whole suite: 7 (299/299), 2 (293/293), 1 (299/299), no flakes.

## Merging, revised

*Orchestrator (2026-10-11), newer than the plan's *Merging, for the Coach*:* **thread 8 merges
in the second step, after the clear**, not the first. Its review found idents are not
grandfathered: an ident whose label is newly reserved is locked out of its own hunts once its
session ends. That matters only while idents exist in production, so merge 8 no earlier than
thread 2's clear. The first step is #226, #227 and #228 (threads 7, 2, 1): merge #228.

## Reviews of landed threads

*Orchestrator:*

* **Thread 7, #226.** *Review: fixed.* One fix: the policy no longer says flatly that Triquet
  sets no cookies (Convex Auth's Google sign-in sets 15-minute OAuth cookies on the Convex site).
  Left, as wording for the Coach (`human/20261011-google_pages.md`, items 6 to 8): smiths visible
  through guessable hunt labels (thread 9 weighs it); images in questions load from other hosts;
  a deletion request naming a handle can't be verified. Full e2e 299/299, no flakes.
* **Thread 2, #227**, stacked on #226. *Review: clean.* The guard acts only when `--deployment`
  matches the deployment's own `cloudUrl` (read through `function-spec` with the same admin key
  as the action); the mutation touches only the people's tables. Left, minor: the deployment is
  checked once, and later `convex run`s pick it again from the environment (*Open, for threads 4
  and 8* in its thread file). Full e2e 293/293, no flakes.
* **Thread 1, #228**, stacked on #227. *Review: clean.* The split passes exactly the old checks,
  action for action. Left, minor and named in the PR: deploy skew (an old tab gets "Could not
  find public function" until it reloads; no shim), and the visible changes (`keyRefused`, the
  `userlabelClaimed` wording, the menu's name "You"). Full e2e 299/299, no flakes.
* **Thread 8, #229**, stacked on #228. *Review: clean*; full e2e 299/299 (the fourth landing's
  full run), no flakes. Its title ends "(merge after the clear)": idents are not grandfathered.
  Left: the check names hunts only (an ident with a reserved label and no hunt goes unlisted;
  moot once thread 3 drops idents); the script's "stays writable" wording, fixed at landing.
* **Thread 3, #230**, stacked on #229; merge only after the clear. *Reviews:* first `flagged`
  (an anonymous smith could relabel its sandbox), fixed by the worker; second `clean`. Left for
  thread 6: hide the Label field and the delete button from a sealed user (`mayOffer`). Then, on
  the Coach's word, `mayDeleteHunt` refuses a sealed user (`sealedDelete`); that change landed
  after the second review, unreviewed: **thread 9 covers it**. Full e2e 299/299, no flakes (one
  real failure before, in `routing.spec.ts`, fixed: the spec now vouches for its smith).
* **Thread 4, #231**, stacked on #230; merge after the clear. *Review: clean.* The one fix the
  reviewer was refused, the worker made in a better shape: `relabelUser` keeps a held userlabel
  and only retitles. Left for thread 9: `--smith-all` reaches anonymous sandboxes; relabelling an
  anonymous user holding a sandbox lets it make a second. Full e2e 298/299, one flake
  (`routing.spec.ts`'s hunt-history test, timing out after `forgetSession`, twice under load,
  green alone): **watch it**. Thread 5 now switches `adopt.ts` to its predicate.
* **Thread 5, #232**, stacked on #231; merge after the clear; production's Google keys only
  after it deploys. *Reviews:* first `flagged` (login CSRF, fixed at the exchange); second
  `flagged` (verifier lifetime); the Coach chose option 1 and approved the result unreviewed.
  Full e2e 284/301 under load climbing to 46, all 17 failures (3 `sheets`, 14 `widgets`) green
  alone: flakes. **The Coach asked for a `high` review of thread 5 as its own PR** (5r).
* **Thread 1's notes for thread 3** (`thread-1-split_account.md`): move the `hunts.performOuter`
  tests to `hunts.test.ts`; sealing goes in `mayMakeHunt` and `newHunt`; "anonymous" means two
  things today (Convex Auth's `isAnonymous`, no proof; and the actor's `{ kind: 'anonymous' }`,
  no userlabel asserted), and thread 3 should give them different words.

## What the threads have taught

*Orchestrator:*

* **The privacy policy binds later threads** (thread 7). It is written to be true today and once
  Google ships, with every Google claim conditional. What it promises:
  - **Thread 5** keeps only the email, name, picture and Google's account identifier, and asks
    Google only for `openid email profile`.
  - **Threads 6 and 9:** an email is shown to its owner alone.
  - **Thread 9:** anyone opening a hunt's address without being on it sees its smiths' names and
    handles (`hunts:open`, `NotOnHunt`). The policy says so; review it as a choice, not a leak.
    *Review (thread 7):* `/h/<label>` looks a label up across every org, and labels are guessable
    adjective_animal pairs, so a script could list every hunt's smiths. Thread 9 weighs that.
  - **The policy names one cookie exception** (the review's fix): Convex Auth's Google sign-in
    sets 15-minute OAuth state, PKCE, nonce and redirect cookies on the Convex site. **Thread 5:**
    set no other cookie, or change the policy with it.
* **Stable paths for the policies:** `Routes.privacyPath()` and `Routes.termsPath()` (thread 6
  links them). `SiteFooter` sits in the root layout; leave it there.
* **The janitor's guard is `scripts/janitor.ts`** (thread 2). A command calls `takeAim(argv)` and
  gets `{ aim, rest }`. With no `--deployment` it is a dry run. It acts only when the flag matches
  the deployment `convex function-spec` actually reaches: the `*.convex.cloud` subdomain, or host
  and port locally. It also exports `aim.said`, `dryRunCoda(aim)` and `stopOrThrow`. Threads 4 and 8
  build on it; `notes/deploy.md`, *Commands run by hand on production*, is where they add their
  steps.
  - *Review (thread 2):* the guard checks the deployment once, by reading its own `cloudUrl`
    with the same admin key the action uses. Each later `convex run` picks the deployment again
    from the environment. That matters only without a deploy key, if `.env.local` changes during
    the run. **Threads 4 and 8:** if the shared `convexRun` is yours to touch, pin the URL and
    admin key there for every run; otherwise leave it, and note it.
* **Thread 3 deletes thread 2's command** and keeps the guard, its test, and that deploy.md
  section. `thread-2-clear_people.md` lists exactly which files and lines go.
* **What thread 1 renamed** (thread 3 builds on it; details in `thread-1-split_account.md`):
  - User actions: the `userAction` union, `performUser` in `writing/user_actions.ts`,
    `affirmUserAction`, on the public mutation `idents.perform`.
  - **Two hunt unions, not one.** Making a hunt, and retitling, relabelling, rebranching or
    arranging one from outside a quiz, are the `outerHuntAction` union: `performOuterHunt` in
    `writing/hunt_actions.ts`, `affirmOuterHuntAction`, on `hunts.performOuter`. The existing
    `huntAction` must carry a quiz's affirms on the scoped `hunts.perform`, and `new_hunt` has no
    hunt to affirm, so joining them would have changed behaviour.
  - Browser: `useAwaitedActions`, with `useUserActions` and `useOuterHuntActions` over it.
  - Views: `UserMenu` (on screen, "You") and `ShowUser`. Thread 6 grows `UserMenu`.
  - The ask route's `accountOff` failure is `keyRefused`: it meant Anthropic's account.
  - *Review (thread 1):* clean; the split passes exactly the old checks, action for action.
    Removing a public function leaves an old tab broken until it reloads (deploy skew). The
    project has no policy on that; **thread 3**, which renames far more, should say so in its PR
    the same way, and not build shims.
* **Deletes go through the triggers** (thread 2): clearing reviews moves a quiz's change signal,
  as any deletion would. Signals are never deleted.

* **The reserved list governs new labels only** (thread 8, not yet landed). Hunt rows validate
  `label` with `CK.label` and `orglabel` with `CK.heldUserlabel` (shape plus the words every label
  avoids); the full list applies where a label is made (`HuntValidators.newLabel`). **Thread 3:**
  the user's `userlabel` and the huntship's copy use `CK.heldUserlabel`; choosing one uses
  `CK.userlabel` (sent to thread 3 directly, 2026-10-11). **Threads 3 and 6:** the one predicate is
  `Labelmaker.isReserved(word, { toplevel: true })`, which agrees word for word with `CK.userlabel`.
  No npm package: both candidates are unmaintained (2018, 2019).

* **What thread 3 built, for threads 4, 5, 6 and 9** (`thread-3-converge.md`, and
  `converge-map.md` for every renamed or added name):
  - **The actor** comes from `Actor.ofUser`, the one place `admin` is read:
    `{kind:'unlabelled'}` until a userlabel is held, then `{kind:'user', user_id, userlabel,
    usertitle, admin, anonymous}`. `TRIQUET_ADMINS` is gone; a local backend sets
    `TRIQUET_EVERYONE_ADMIN=yes`.
  - **Sealing reads `users.isAnonymous`**, not "has a Google account". **Thread 5's
    upgrade-in-place must clear it.** **Thread 4's** "signed in with Google" should agree with that.
  - **`createOrUpdateUser` is `userForSignIn`**: a new anonymous account gets a new user; a
    returning account its own; any other provider throws. Thread 5 extends it.
  - **`smithOfSandbox`**, in `writing/huntship_actions.ts`, is the named write for thread 5's merge.
  - **Test helpers:** `anonymousSession`, `anonymousUser`, `googleUser` (pulled forward from 5:
    it seeds a Google `authAccounts` row, never a sign-in). `PA.Convexid` now accepts
    convex-test's ids for Convex Auth's tables. **Thread 5 builds on these.**
  - **e2e's stand-in for Google is `testing:vouchFor`**: an internal mutation, refused unless
    `TRIQUET_CLEARABLE=yes`, that sets `isAnonymous: false`. It is no provider and signs nobody
    in. **Thread 9** reviews it (`notes/security.md`).
  - **Privacy:** no scoped database reaches `users`. Another user is known only by userlabel,
    title and anonymity, through the census. No query returns an email.
  - **For thread 6:** the sealing refusals say "Sign in with Google to … — coming soon". Today
    `NotOnHunt` tells an anonymous visitor to ask a smith to add them, which will be refused, and
    an anonymous smith opening its own sandbox at `!playtest` is told "Not yet on this hunt".
  - **Caught up onto thread 8:** everything naming a userlabel already held uses
    `CK.heldUserlabel` (user row, huntship copy, ghosting, `add_huntship`); claiming one stays on
    `CK.userlabel`. `isIdentlabel` is now `isHeldUserlabel`. `PA.ReservedLabels` still lists
    `ident(s)`, `identing(s)`, `hunting(s)`; left reserved.
  - *Review, first pass (flagged):* an anonymous smith could relabel its sandbox
    (`relabel_hunt` → `mayChangeHunt`, which never asks `Actor.isSealed`), making it no sandbox,
    so thread 5's `smithOfSandbox` would throw. Sent back as a directive. **Fixed** (`8aa7967a`):
    `Approve.mayRelabelHunt(claims)` refuses a sealed smith any relabel (`sealedRelabel`), through
    both `hunts.performOuter` and `hunts.perform`; `relabel_hunt` stays offerable, so **thread 6**
    can hide the label field with `mayOffer('relabel_hunt')`. Retitle, rebranch, arrange and
    delete were checked and keep a sandbox a sandbox. *Second review: clean.* Left for **thread
    6**: the gear (`HuntEditModal`) and the quiz's manage dialog still offer an anonymous smith the
    Label field; gate it on `Approve.mayOffer('relabel_hunt', claims)`.
  - **The Coach (2026-10-11): a sealed user may not delete a hunt** (plan, *The Coach's
    guidance*). Thread 3 adds it; **thread 6** hides the Workbench's delete button with `mayOffer`. The other five focus areas held: authorization through
    `user_id` and huntships; default-deny row rules keep `users`, `ghostings` and `auth*` out of
    scoped databases; every other seal; `vouchFor`'s gate; the userlabel race (one transaction);
    no query returns an email; `admin` read only in `Actor.ofUser`.
  - **For thread 9:** a smith adding a handle learns whether that user is anonymous (from the
    `sealedJoin` refusal); the privacy policy does not say so.

* **What thread 4 built** (`thread-4-adopt_script.md`): `adopt:plan` (a query, so the dry run
  cannot write) and `adopt:perform` (one transaction), over one shared plan; `scripts/adopt` on
  `takeAim`. **Pulled forward from thread 6:** `relabelUser` in `writing/user_actions.ts`
  relabels a user and rewrites its huntships' copies. *Orchestrator:* thread 6's settling
  mutation calls it and adds only the ghosting and the name choice. Also new:
  `grantHuntship` (through `placeOn`, refusing a sealed user) and `Huntship.holdsAtLeast`.
  The shared `convexRun` now shows the `Uncaught …` line in quiet mode; refusals for `convex run`
  are `ConvexError`s. The guard's one-check gap stays: pinning needs the admin key, which the
  guard never sees.
* *Review (thread 4): clean.* Plan cannot write; plan and perform share `planFor`; the
  refusals, idempotence, the copies rule and `convexRun`'s change hold. One fix was refused to
  the reviewer by the session's permissions, and the worker makes it at landing (plan/perform
  disagreeing on a since-reserved userlabel). **For thread 9:** `--smith-all` reaches anonymous
  sandboxes past sealing (safe at adoption time only); relabelling an anonymous user that holds
  a sandbox lets it make a second (`mayMakeHunt` checks only label == userlabel).
* **Permission refusals in reviewers' sessions** (threads 3 and 4): the auto-mode classifier
  refused a reviewer's read, then another's edit and `tsx -e`, in a worktree, as "Modify Shared
  Resources". Neither worked round it. The thread's own worker made each fix instead, on its own
  branch. Reported to the Coach.
* **Who runs the adopt command** (thread 4's question). *Orchestrator:* the pre-plan's
  *Production* step 5 stands: the orchestrator runs it, on the Coach's word at the time, after the
  sprint, saying the command in chat first and relaying its output whole. No worker runs it, and
  nothing in this sprint's run does. `--smith-all` also reaches anonymous sandboxes; production
  holds none at adoption time, as everyone is cleared first.

* **What thread 5 built, for threads 6 and 9** (`thread-5-google_signin.md`):
  - **The predicate** is `Actor.isSignedInWithGoogle(user)`, beside `Actor.ofUser`; `admin`
    counts only when it holds; `convex/adopt.ts` uses it.
  - **The one start** for both of thread 6's doors: `useGoogleSignIn()` in
    `src/state/use-google-sign-in.ts` returns `{ offered, start }`; `offered` (from the new
    `auth:offered` query) waits for the session.
  - **The pending name choice:** the merged-away user keeps its handle (so nobody takes it) and is
    marked `users.merged = { into_user_id, account_id }`; `nameChoiceFor(db, user_id)` in
    `convex/reading.ts` reads it in one indexed lookup. **Thread 6:** settle it with
    `User.relabelled` (the held-handle rule, which the merge uses), not `relabelUser`, which holds a
    new handle to the claim rules and would refuse a since-reserved merged handle.
  - **Decided beyond the table:** a known Google user holding no handle takes the anonymous user's
    handle and title outright, with no choice; the merged-away user is taken off the sandbox.
    Nothing is decided by email; two Google accounts sharing one email stay two users.
  - **`forgetSession` (`e2e/support.ts`) now leaves for `/privacy` first**, so an in-flight token
    refresh cannot write the forgotten session back. That explains the `routing.spec.ts` flake
    thread 4 saw.
  - *Review, first pass (flagged, significant):* **login CSRF through the patch's
    `authUserId`.** The sign-in route signs any verifier id from any browser, verifiers never
    expire, and `createOrUpdateUser` runs at the callback, before the `?code=` exchange. So a
    victim finishing an attacker's sign-in link upgrades the attacker's anonymous user with the
    victim's Google account (takeover), or merges the attacker's sandbox into the victim. Directed
    fix (plan, YOLO 9): decide upgrade and merge only once the finishing browser proves it is the
    starting one. The reviewer's fix kept: the merge test counts every refresh token. Minor:
    `nameChoiceFor` returns the first by userlabel, not the earliest, as its doc says; `convex_dev`
    discards only stdout of `env set`; a merged-away user's verifier rows stay.
    **Fixed** (`eb893732`): upgrade and merge are decided at the `?code=` exchange, where only
    the starting browser holds both code and verifier. The patch now goes beyond #306 (`dist/`
    only): no session at the callback; the verifier's session handed over at the exchange in a
    second `createOrUpdateUser` call; a code shown with the wrong verifier is spent. Our code:
    `accountUserAtCallback` (links the account to its own user or a new `users.provisional` one)
    and `userAtExchange` (decides the table; folds a provisional user into an upgraded anonymous
    one). Upstream #306 has the same hole: commenting there is for the Coach. **Thread 6:**
    `nameChoiceFor` returns the first merged-away user *by userlabel* (doc corrected, behaviour
    kept). **Thread 9:** the 8-digit code lives 2 minutes, unthrottled.
  - *Second review (flagged, significant):* the CSRF as reported is closed. But **a verifier is a
    never-expiring bearer credential for its starting session**: the sign-in route re-signs any
    verifier that exists, so whoever learns a victim's verifier id (history, localStorage, maybe
    logs) can finish with their own Google account and upgrade or merge the victim's anonymous
    user into it. Recommended: hand the session on only from a recently made verifier, and
    delete a verifier wherever its code dies. Fixes kept: `adopt` refuses a provisional user;
    `notes/security.md` states the guess window rightly (the link's maker can land the victim
    on `/privacy`, leaving the code unspent its whole 2 minutes). Minor: a `callbacks.redirect`
    limited to synced pages, or a throttle, would close that window; provisional users and
    orphaned verifiers are never swept. **The Coach decided: option 1** (plan, *The Coach's
    guidance*): bound the verifier, delete it wherever its code dies, a redirect limited to
    synced pages; a refused exchange leaves the person on their old anonymous session, with no
    confusing state. **Built** (`4c5351d4`): `SIGN_IN_START_MAX_AGE_MS` (15 minutes) in the
    patched `verifyCodeAndSignIn.js`; a verifier deleted wherever its code dies; `returnUrlFor`
    (`convex/auth.ts`, through `Routes.isSyncedPath`) allows only relative synced pages. **The
    installed client did strand the anonymous user** (a refused exchange cleared the stored
    session; one that threw left `isLoading` true for ever); the patch, now four parts beyond #306
    across three `dist/` files including `client.js`, keeps the stored session in both.
    **For thread 6:** `useGoogleSignInOutcome` (compares a fingerprint of the session token, kept
    in session storage, with the token on return) raises the notice "Google sign-in didn't
    finish / You're still `<handle>`, as before. Try again." and clears a leftover verifier;
    placed by one line in `ShowUser`, for thread 6 to move. No sweep (TODO). A test reached
    Google's public discovery document over the network before `fetch` was stubbed.
    **The Coach approved it and the wording ("wording is perfect"), and said land.**
  - **A near miss with the ground rule:** the first draft of the e2e spec followed the 302 to
    Google's real sign-in page (Playwright's `page.route` does not catch a server redirect).
    Nothing signed in; the spec now reads the 302 without following it. Reported to the Coach.

* **Thread 5r, `signin_review`** (the Coach, 2026-10-12): a `thread-reviewer` at `high` over
  all of thread 5, `77286214...8383d5b2`, committing its fixes on its own branch; a
  `thread-worker` then proves it and lands it as its own PR, stacked on #232. No fixes: no PR,
  and its findings go on #232.

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
