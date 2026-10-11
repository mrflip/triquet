# Sprint `oauth`: progress

**Status: 7 landed (#226); 1 and 2 landing; 8 underway (2026-10-11).**

The running handoff, newer than `oauth-plan.md` wherever the two disagree. Each thread writes its
own section to `thread-<N>-<label>.md` beside this file; the orchestrator curates this one.

| # | Thread | Status | Branch | PR |
|---|--------|--------|--------|----|
| 1 | `split_account`: free the words "account" and "username" | landing | `20261011-split_account` | |
| 2 | `clear_people`: delete production's people, keep its hunts | landing | `20261011-clear_people` | |
| 3 | `converge`: users and huntships, everywhere | pending (1, 2) | | |
| 4 | `adopt_script`: give a user a userlabel, admin, and hunts | pending (3) | | |
| 5 | `google_signin`: the provider, the patch, the merge | pending (3) | | |
| 6 | `google_ui`: signing in, from both doors | pending (5, 8) | | |
| 7 | `google_pages`: homepage, privacy, terms, contact | landed #226 | `20261011-google_pages` | [#226](https://github.com/mrflip/triquet/pull/226) |
| 8 | `reserved_words`: survey and augment the reserved list | underway | `20261011-reserved_words` | |
| 9 | `oauth_security`: a strong review | pending (1-8) | | |

Full e2e runs at landing: threads 3 and 5, and every fourth landing (none yet).

## Reviews of landed threads

*Orchestrator:*

* **Thread 7, #226.** *Review: fixed.* One fix: the policy no longer says flatly that Triquet
  sets no cookies (Convex Auth's Google sign-in sets 15-minute OAuth cookies on the Convex site).
  Left, as wording for the Coach (`human/20261011-google_pages.md`, items 6 to 8): smiths visible
  through guessable hunt labels (thread 9 weighs it); images in questions load from other hosts;
  a deletion request naming a handle can't be verified. Full e2e 299/299, no flakes.

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
