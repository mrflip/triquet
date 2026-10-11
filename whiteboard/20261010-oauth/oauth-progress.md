# Sprint `oauth`: progress

**Status: 7, 2, 1 and 8 landed (#226-#229); 3 landing (2026-10-11).**

The running handoff, newer than `oauth-plan.md` wherever the two disagree. Each thread writes its
own section to `thread-<N>-<label>.md` beside this file; the orchestrator curates this one.

| # | Thread | Status | Branch | PR |
|---|--------|--------|--------|----|
| 1 | `split_account`: free the words "account" and "username" | landed #228 | `20261011-split_account` | [#228](https://github.com/mrflip/triquet/pull/228) |
| 2 | `clear_people`: delete production's people, keep its hunts | landed #227 | `20261011-clear_people` | [#227](https://github.com/mrflip/triquet/pull/227) |
| 3 | `converge`: users and huntships, everywhere | landing (full e2e) | `20261011-converge` | |
| 4 | `adopt_script`: give a user a userlabel, admin, and hunts | pending (3) | | |
| 5 | `google_signin`: the provider, the patch, the merge | pending (3) | | |
| 6 | `google_ui`: signing in, from both doors | pending (5, 8) | | |
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
