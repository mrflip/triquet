# OAuth: one user, huntships, and Google sign-in

Sprint plan, 2026-10-11. Mode: **YOLO**. Review level: **medium**. At most **3** threads at once.
Issued by the Coach (Flip): `/sprint oath YOLO`, "plan and execute the sprint described in
whiteboard/20261010-oauth", which is `20261011-oauth_preplan.md` beside this file.
**Status: threads 1-5, 7, 8 landed (#226-#232); the Coach's high review of 5 and thread 6 underway (2026-10-12); 9 last.** `oauth-progress.md`, beside this file, is newer
than this plan wherever the two disagree.

The earlier plan in this file (three threads, an app-made hand-off, 2026-10-10) is superseded and
is in git's history; nothing below depends on it.

## The authority

**`20261011-oauth_preplan.md` is the Coach's spec.** Every worker reads it whole before anything
else: *What the Coach decided*, *The models and their names*, *Where and when each name changes*
and *Production* bind every thread, not only the one that names them. Its thread texts are
quoted verbatim below, each followed by the orchestrator's gloss. Where a gloss and the pre-plan
disagree, the pre-plan wins, unless `oauth-progress.md` records why it no longer does.

## Read first

Beyond CLAUDE.md and its auto-loads (`notes/stack.md`, `notes/testing.md`, `notes/convex.md`,
`notes/views.md`):

* `20261011-oauth_preplan.md`, whole.
* `notes/vocabulary.md` and `STYLE.md`, before naming anything. The pre-plan's names (account,
  user, session, userlabel, handle, huntship, ghosting, sandbox) win over anything older.
* `notes/guidelines.md`, before designing an entrypoint or a row validator.
* `notes/queries_hooks_and_subscriptions.md`, before adding a query, a state hook or a `useQuery`.
* `notes/convex.md`, *Who is asking*, and `convex/_generated/ai/guidelines.md`.
* `notes/deploy.md`, *Schema pushes: the two modes*: threads 2, 3 and 4. Thread 3 drops tables.
* `notes/security.md`: every thread adds to it where it makes a security decision.
* Background, read when your thread touches the subject:
  - `oauth-progress.md`, *Convex Auth, as installed*: what 0.0.96 does and does not do.
  - `convex-auth-v2.md`: why we stay on v1. Thread 5.
  - `google-oauth-keys.md`: the keys and path A. Threads 5 and 7.
  - `identity-names.md`: the naming work. The pre-plan's names win.
* Convex Auth as installed, not from memory: `node_modules/@convex-dev/auth/dist/server/`
  (`implementation/users.js`, `oauth/`), and `.../react/client.js`.

## Ground rules

`notes/git_hygiene.md`, `notes/git_hygiene-laptop.md` (*A thread, start to finish*, *Sprints*),
and `.claude/agents/thread-worker.md`. What is particular to this sprint:

* **No agent touches production.** Threads 2, 4 and 8 write commands meant for
  `./scripts/doppledo prd_janitor ...`. They prove them on their own lane's local backend and in
  convex-test, and never run them under a production config, not even as a dry run. Running
  them is the Coach's step (*Production*, in the pre-plan).
* **Nothing automated signs in to Google**, ever. No test account, and no Google credential in any
  config an agent or CI reads, beyond the dev client's ID and secret that Doppler already holds
  for local backends. Tests stop at the redirect: they intercept it and read its URL, and never
  follow it. The merge rules are proven in convex-test.
* **No provider that signs anyone in without proof** may exist on a deployment that could serve
  people: no "fake Google" credentials provider, gated or not. A thread that finds it cannot test
  without one reports `blocked`.
* **Google is offered only where configured.** A deployment without `AUTH_GOOGLE_ID` and
  `AUTH_GOOGLE_SECRET` lists only Anonymous, and the browser shows no button.
* **The words.** "Username" is banned from new text from the first commit of every thread: the
  word is `userlabel` in code, and "handle" on screen. "Account" in our own code means only
  Convex Auth's `authAccounts`. A user, an account and a session are not a person; never write
  as if they were.
* **Convex Auth's tables.** From thread 3 on, `users` is ours to write: a custom
  `createOrUpdateUser` writes it, through the Zod row validator in `src/models/user.ts`. The other
  `auth*` tables stay Convex Auth's. The one exception is thread 2's clear, which deletes them all
  (`notes/security.md` gets an entry).
* **`convex/_generated/` conflicts are regenerated, never hand-merged.** Threads 1, 2, 4, 5 and 8
  each add or move Convex functions, so landings will meet there. Push to your lane's backend
  (`scripts/convex_dev`) and commit what it writes.
* **Hard things go to `whiteboard/TODO.md`**, under a section headed
  `## From oauth sprint, thread N: <label>`, and into the report. No heroics.
* **Prove with `pnpm e2e --touched`.** Most threads touch `convex/` or `src/models/` and so reach
  the whole suite anyway. The orchestrator asks for a full run at landing where *Which proof*
  says to: thread 3 (schema), thread 5 (a dependency patch), and every fourth landing.

## Merging, for the Coach

The pre-plan merges production in two steps: first threads 1 and 2, then, after the clear,
everything else at once. The spine lands threads in the order they finish, so **every PR
beneath thread 3's in the stack** can go in the first step, except thread 8: *Orchestrator
(revised 2026-10-11):* its review found idents are not grandfathered, so thread 8 merges no
earlier than the clear. See `oauth-progress.md`, *Merging, revised*. Thread 3's PR and everything above it waits for the
clear. Thread 2 always lands beneath thread 3, since 3 depends on it.

## Decisions taken in YOLO

*Orchestrator:*

1. **Sprint name and place.** The Coach's `oath` is read as `oauth`, and the sprint runs in the
   existing `whiteboard/20261010-oauth/` they named. This file was rewritten in place.
2. **The spine started over.** The spine's one commit merged as #224 under a new SHA, so on the
   Coach's "rebase on main", `pnpm restack` put the main checkout back on `main` at `29850126`.
   Every thread is cut from there.
3. **Thread 2's clear stays a command, not a backfill.** `notes/deploy.md` empties a table with a
   backfill, which runs by itself when the PR merges. The Coach chose a command run by hand, with
   a dry run, after an export (*Production*). That choice stands.
4. **The deployment guard is shared.** Threads 2, 4 and 8 each run a command under
   `prd_janitor`. Thread 2 builds the dry-run default and the flag naming the target deployment
   as one small helper in `scripts/`, which 4 and 8 reuse. Thread 3 keeps the helper when it
   deletes thread 2's command.
5. **The name choice after a merge.** Thread 5 records a pending name choice, shaped for thread 6.
   Thread 6 builds the mutation that settles it (`relabelUser`, per the pre-plan's rename table)
   and writes the ghosting.
6. **Thread 3 catches up before its review** (2026-10-11). Thread 8 landed beneath it while it
   built, and the catch-up changes code (the user's and huntship's userlabels move to
   `CK.heldUserlabel`) across about seven files. So the reviewer reads the branch after the
   catch-up, not before.
7. **Thread 3's `testing:vouchFor` stands, pending review.** It is e2e's stand-in for Google: an
   internal mutation, refused unless `TRIQUET_CLEARABLE=yes`, that clears `isAnonymous`. It is no
   provider and signs nobody in, so it is not the "fake Google" the ground rules forbid. But it is
   a way past sealing on test backends, so its reviewer and thread 9 check its gate.

8. **"Signed in with Google" is one predicate: the user is not anonymous** (`users.isAnonymous`
   false; the actor's `anonymous`), as sealing already reads it (thread 3). Threads 4 and 5 run
   side by side, and both need it: 4 for the admin flag and grants, 5 for admin counting at all.
   Only thread 5's upgrade (a Google account joining) clears the flag in production; e2e's
   `testing:vouchFor` clears it only where `TRIQUET_CLEARABLE=yes`. Thread 5 owns the predicate's
   home (beside `Actor.ofUser`); thread 4 reads the user's flag directly if 5 has not landed, and
   switches to the predicate at catch-up.

9. **Thread 5's login-CSRF finding is fixed in thread 5, not held** (2026-10-11). Its review
   found that the patch lets a sign-in started in one browser upgrade or merge the starting
   user when it is finished in another (the victim's), because Convex Auth decides at the
   callback, before the `?code=` exchange that ties the flow to the starting browser. The worker
   is directed to keep the Coach's behaviour (upgrade, switch, merge) but decide upgrade and merge
   only once the finishing browser has proven it is the starting one: at the exchange (a wider
   patch) or by a claim afterwards. If neither can be made secure without a large rewrite, it
   reports `blocked`. *Why not pause:* it is code that reaches production only through the
   Coach's merge and the Coach's keys. Dropping upgrade and merge would reverse the Coach's
   decision, and the app's own one-time hand-off would reverse the Coach's choice of the patch.
   **Production's Google keys wait until this is reviewed.**

10. **The high review's finding on thread 5 is fixed in its own PR** (2026-10-12). The redirect
    rule checked only a path's first segment, so a crafted link could land on a 404 that never
    spends the code. A `thread-worker` in the review's worktree fixes it, and falls back to `/`
    on a refused `redirectTo`. It also makes the unfinished-sign-in notice compare the session
    id, not the refreshed JWT (the Coach's "no confusing state"). A second reviewer reads its
    commits; then it lands as its own PR, stacked on #232.

## The Coach's guidance during the sprint

* **2026-10-11: thread 5's verifier: option 1.** Hand the starting session on only from a recently
  made verifier, and delete a verifier wherever its code dies (`human/20261011-sprint_oauth_paused.md`).
  The Coach's conditions: "Make sure it can't succeed leaving the person without their old anon
  record. Or leaving a confusing oauth state." *Orchestrator:* so a refused exchange leaves the
  browser on its old anonymous session, with nothing half-linked, and a plain notice; the client's
  behaviour on a failed exchange is checked first. Also a `callbacks.redirect` limited to synced
  pages (closing the guess window). No sweep (no crons); noted in TODO. The result goes to the
  Coach before it lands.
* **2026-10-11: thread 5 approved to land,** and the notice wording ("Google sign-in didn't
  finish" / "You're still `<handle>`, as before. Try again.") approved as it stands.
* **2026-10-12: "please run a code reviewer on high as its own pr".** *Orchestrator's reading:*
  review all of thread 5 (#232) at `high`, with its fixes landing as a PR of their own, stacked
  on #232. Thread 6 runs beside it.

* **2026-10-11: an anonymous (sealed) user may not delete a hunt.** "No new hunt, no delete hunt
  for anonymous seems easier to reason about." `deleteHunt` takes a hunt holding up to one quiz
  with it, so an anonymous user could delete its sandbox's work and then make a fresh one.
  Thread 3 adds the refusal before it lands, or folds it in after. `new_hunt` stays as it is: a
  sealed user makes only its sandbox, at most one. *Orchestrator's reading:* "no new hunt" means
  no hunt beyond the sandbox. Making the sandbox automatically when a handle is taken would be the
  other reading, and is not being built.

## The threads

| # | Thread | Depends on |
|---|---|---|
| 1 | `split_account`: free the words "account" and "username" | nothing |
| 2 | `clear_people`: a command that deletes production's people and keeps its hunts | nothing |
| 3 | `converge`: users and huntships, everywhere | 1, 2 |
| 4 | `adopt_script`: give a user a userlabel, admin, and hunts | 3 |
| 5 | `google_signin`: the provider, the patch, the merge | 3 |
| 6 | `google_ui`: signing in, from both doors | 5, 8 |
| 7 | `google_pages`: homepage, privacy, terms, contact | nothing |
| 8 | `reserved_words`: survey and augment the reserved list | nothing |
| 9 | `oauth_security`: a strong review | everything above |

**Order.** 1, 2 and 7 start at once. 8 starts when the first of them lands. 3 is cut once 1 and
2 have landed; then 4 and 5 run side by side; then 6, once 5 and 8 have landed; then 9.

### 1. `split_account`: free the words "account" and "username"

*The Coach's text:*

> * **Split** our `account`-named dispatch and policy code by noun, with no behaviour change and no
>   rewrite of what the functions do:
>   - claiming and retitling a userlabel (`assumeIdent`, `retitleIdent`) go to
>     `writing/user_actions.ts`, behind a user-action union and dispatcher;
>   - making a hunt, and retitling, relabelling or arranging the categories of one, join
>     `writing/hunt_actions.ts` and the hunt-action union.
>   - The browser's `use-account-actions` splits the same way.
> * **Ban "username":**
>   - it becomes `userlabel` in code, documents, notice keys and test names;
>   - on screen it becomes "handle", in every notice and label a visitor reads.
> * **Grep says what is left.** No `account` remains in our own code but where it means Convex
>   Auth's.
> * `notes/vocabulary.md` gains the new nouns: account, user, session, userlabel, handle, huntship,
>   ghosting, sandbox, anonymous.
>
> *Depends on:* nothing. *Look-ahead:* thread 3 rewrites what moved into `user_actions.ts`. Keep
> this thread to moves and names, so thread 3's diff stays about meaning.

*Orchestrator's gloss.*

* **Touches:**
  - `convex/writing/account_actions.ts`, moving to `user_actions.ts` and into `hunt_actions.ts`;
  - `convex/writing/perform.ts`, `convex/functions.ts`, `convex/authorize.ts`;
  - `src/models/actions.ts` (the unions), `src/lib/approve.ts`, `src/lib/actor.ts`,
    `src/lib/notices.ts` (the keys), `src/lib/vv/patterns.ts` (prose only);
  - `src/state/use-account-actions.ts`, `src/state/shown.tsx`;
  - the views named for accounts: `AccountMenu.tsx`, `ShowAccount.tsx` and the components that
    use them, plus `IdentGate.tsx`'s on-screen words;
  - the tests and e2e specs that follow, and `notes/vocabulary.md`. About 50 files say
    "username".
* **Depends on:** nothing.
* **Look-ahead:**
  - Name the views by what they show: a menu of the person's own user is not an "account" menu.
    Thread 6 grows that menu into *signed in as …* and *Sign out*.
  - Make each move a commit of its own, before any edit, so `git log --follow` and thread 3's
    diff both read cleanly.
  - Thread 8 edits the reserved lists in `src/lib/vv/patterns.ts` beside you. Change only that
    file's prose there.
  - Idents stay idents until thread 3. Rename only "account" and "username" here.

### 2. `clear_people`: delete production's people, keep its hunts

*The Coach's text:*

> * **An internal mutation** that deletes, in batches, every row of:
>   - `users`, `authAccounts`, `authSessions`, `authRefreshTokens`, `authVerifiers`,
>     `authVerificationCodes`, `authRateLimits`;
>   - `idents`, `identings`, `huntings`, `reviews`, `reviewings`.
>
>   Hunts, realms, quizzes, questions, widgetings, columns, widgeteds, signals and the library are
>   untouched.
> * **A script that drives it**, run as `./scripts/doppledo prd_janitor scripts/clear_people`:
>   - a **dry run by default**, printing each table's count;
>   - it acts only with a flag naming the deployment it is aimed at, so it cannot be pointed at the
>     wrong one by accident;
>   - it repeats until nothing is left, and says what it deleted.
> * **Written against today's schema**, since it runs before thread 3's push. Thread 3 then deletes
>   it along with the tables it empties.
> * `notes/deploy.md` gains the Coach's steps (*Production*, above).
> * **Tests** on a local backend: the people go, the hunts stay, and a second run deletes nothing.
>
> *Depends on:* nothing. It must reach production before thread 3 does.

*Orchestrator's gloss.*

* **Touches:**
  - a new `convex/` module holding the internal mutation and an internal count query;
  - `scripts/clear_people`, with its guard as a helper in `scripts/`;
  - `notes/deploy.md` and `notes/security.md` (this deletes Convex Auth's tables, the one
    exception to leaving them alone);
  - tests: convex-test for the mutation, and a unit test of the script's guard.
* **Depends on:** nothing.
* **Look-ahead:**
  - Threads 4 and 8 run commands under `prd_janitor` too (*Decisions taken in YOLO*, 4). Build the
    dry-run default and the flag naming the target deployment as one helper they can reuse. It
    checks the flag against the deployment the key actually names, not against a string the
    caller typed twice.
  - Thread 3 deletes this command but keeps the helper.
  - Prove it on your own lane's backend only. Never run it under a production config.

### 3. `converge`: users and huntships, everywhere

*The Coach's text:*

> The heaviest thread.
>
> * **The schema changes in one step.**
>   - The `users` table is inlined in `convex/schema.ts`, keeping Convex Auth's fields and indexes
>     (`email`, `phone`), from a new `src/models/user.ts` row validator.
>   - `huntships` and `ghostings` are added.
>   - `reviews` and `reviewings` take a required `user_id`.
>   - `idents`, `identings` and `huntings` are dropped.
>   - Production's rows are gone by then (*Production*), so no backfill and no tighten. A local
>     backend is reset (`scripts/convex_reset`).
> * **The app runs on the new model.**
>   - `askerOf` builds the actor from the user's own `userlabel` and `title`.
>   - `Approve`'s policies and the `affirm…` functions speak `user_id` and huntships.
>   - Copies follow the copies rule.
>   - Row-level security rules move to the new tables.
>   - The browser's hooks and views follow.
> * **The custom `createOrUpdateUser` lands here, unpatched:**
>   - anonymous sign-in inserts an anonymous user with no userlabel;
>   - a returning account returns its user.
>   - (Google arrives in 5.)
> * **A userlabel is free** only if no user holds it, no ghosting holds it, and no hunt carries it as
>   `orglabel` (*The models*, above). Only thread 4's command may give out one that only an
>   address holds.
> * **Admin becomes the user's `admin` flag**, read when the actor is built. No environment
>   variable lists admins in production; a local backend keeps "everyone is an admin".
> * **Sealing is policy** (`Approve`). An anonymous user:
>   - may take a userlabel;
>   - may make exactly one hunt, its sandbox, labelled with its own userlabel;
>   - may not be added to any hunt, nor add anyone to its sandbox;
>   - may not review.
>
>   The refusals say "sign in with Google to …" (the button arrives in 6; until then the notice
>   only says it is coming).
> * **No identings.** Choosing a userlabel is one write to the user.
> * **Thread 2's clearing function and script are deleted**, with the tables they empty.
>
> *Depends on:* 1, 2. *Look-ahead:*
> * Thread 5's merge needs a function, *make this user smith of that sandbox*, that bypasses
>   sealing only for the Google user. Write it as a named write in `writing/`, not inline.
> * Thread 6 needs "suggest a userlabel from a name" (`Ident.labelFor` today), kept as a pure
>   function on `User`.

*Orchestrator's gloss.*

* **Touches** nearly everything that says ident or hunting:
  - `convex/schema.ts` and `convex/` throughout;
  - `src/models/` (`ident.ts`, `identing.ts` and `hunting.ts` give way to `user.ts`, `huntship.ts`
    and `ghosting.ts`);
  - `src/lib/actor.ts` and `approve.ts`;
  - `src/state/use-ident.ts`, `IdentGate.tsx` and their callers;
  - `tests/support/`, `e2e/`, `scripts/convex_dev` (`TRIQUET_ADMINS`);
  - `notes/convex.md`, `notes/vocabulary.md`, `notes/security.md`.
* **The schema push** is a schema step (`notes/deploy.md`). It drops three tables and reshapes
  two, with no backfill, because production is cleared by thread 2's command first. Say so in the
  PR's description, with the Coach's steps, and make the title name the clear as a precondition.
  Reset your lane's backends; e2e backends are made fresh.
* **`convex/_generated/`** goes in a commit of its own.
* **Depends on:** 1 and 2.
* **Look-ahead:**
  - The two named functions in the Coach's text (smith-of-sandbox, and `User`'s label
    suggestion).
  - Name the test helpers so thread 5 can add a Google-user helper beside the anonymous ones.
  - Thread 4 sets the `admin` flag; thread 5 makes it count only for a user signed in with Google.
    Keep where the actor reads the flag in one place.
  - Thread 8's reserved list is read through `Labelmaker.isReserved`, if it has landed. The
    free-userlabel check calls that, not a copy.
  - Whiteboard TODO's **O3** (unheld legacy idents) dies with idents: strike it there, saying why.
  - Keep thread 2's guard helper when you delete its command.
* **Proof:** a full e2e run at landing.

### 4. `adopt_script`: give a user a userlabel, admin, and hunts

*The Coach's text:*

> * **An internal mutation**, which can:
>   - find a user, by `_id`, by userlabel, or by the Google email of its account (for a one-time
>     lookup with the Coach watching; never a standing rule);
>   - set its userlabel, past the address rule (the command line is trusted);
>   - set or clear its `admin` flag;
>   - grant it a role on one hunt by address (`~org/hunt`), or on every hunt.
>
>   The user must be signed in with Google for the admin flag or any grant. The mutation is
>   idempotent and never lowers a role, and it returns what it changed.
> * **A script wrapping it**, with a dry run that says what it would do:
>   - in production: `./scripts/doppledo prd_janitor scripts/adopt --email <the Coach's> --userlabel
>     mrflip --admin --smith-all`;
>   - in dev, against a local backend.
> * `notes/deploy.md` gains it, in the Coach's steps.
>
> *Depends on:* 3. Can run beside 5.

*Orchestrator's gloss.*

* **Touches:** a new `convex/` module, `scripts/adopt` (on thread 2's guard helper),
  `notes/deploy.md`, convex-test.
* **Depends on:** 3.
* **Look-ahead:**
  - "Signed in with Google" is a fact thread 5 makes possible: on thread 3's model, a user with
    an account whose provider is `google`. Test it with a seeded Google account row; never with a
    sign-in.
  - Thread 5 lands beside you, so agree with its definition through the progress document, or
    read it from 5's code if 5 lands first.
  - Use thread 3's role grant and huntship writes, not a second copy of them.

### 5. `google_signin`: the provider, the patch, the merge

*The Coach's text:*

> * **`pnpm patch`** `@convex-dev/auth`, carrying PR #306's change: `createOrUpdateUser` is handed
>   the signing-in session's user. List it in `notes/stack.md`, with the PR, and a note to drop
>   the patch when a release carries it.
> * **The Google provider** joins Anonymous only where `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are
>   set on the deployment. A query tells the browser whether Google is offered.
> * **`scripts/convex_dev`** sets those two on a local backend, from the same names in the Doppler
>   config it runs under. All three dev configs carry them: a web client in Google project
>   1034248949886, which accepts `http://127.0.0.1:3500` and `:3501`'s
>   `/api/auth/callback/google` (checked 2026-10-11).
> * **`createOrUpdateUser`**, for an OAuth sign-in:
>
>   | The account is | The signing-in browser's user is | Then |
>   |---|---|---|
>   | new | anonymous | **upgrade in place**: the account joins that user, which is no longer anonymous |
>   | new | signed in with Google, or none | a new user. Linking a second Google account is a later, explicit action |
>   | known | anonymous with nothing (no userlabel) | switch to the account's user |
>   | known | anonymous, with a userlabel | **merge**: the account's user continues; it is made smith of the sandbox, if there is one; a pending name choice is recorded (thread 6 asks it); until answered, the account's user's handle stands |
>   | known | signed in with Google as another user | switch. **Never merge two Google users** |
>
>   A merged-away user is never deleted: it is marked, its sessions deleted, and its userlabel goes
>   into `ghostings` once the name choice is settled.
> * **Admins must be signed in with Google:** an anonymous user's `admin` flag counts for nothing.
> * **Tests:**
>   - convex-test for every row of the table, for the refusals, and for admin needing Google;
>   - e2e up to the redirect (the URL's `client_id`, `redirect_uri` and `scope`, intercepted, never
>     followed).
>   - Nothing automated signs in to Google.
> * **Documents:** `notes/stack.md` (*Authentication*, the patch), `notes/deploy.md` (production's
>   two keys, path A), `notes/security.md` (the merge rules, the patch, the admin flag and why not
>   email, what we store from Google), `notes/convex.md` (*Who is asking*).
>
> *Depends on:* 3.

*Orchestrator's gloss.*

* **Touches:**
  - `package.json` and `patches/` (the `pnpm patch`);
  - `convex/auth.ts`, `convex/convex.config.ts` (the two keys, declared optional);
  - `scripts/convex_dev`;
  - a public query in `Unscoped`, saying why;
  - `src/state/use-session.ts` and a sign-in function in `src/state/`;
  - convex-test and an e2e spec;
  - the four notes the Coach names.
* **The ports in the Coach's text** (3500, 3501) are the Coach's own lanes. An agent's lane has
  other ports, which the dev client does not accept. That is fine, since nothing follows the
  redirect; but do not add an agent's ports to the client, and do not hand-set `SITE_URL`
  (`scripts/lanes.ts` owns ports).
* **Account linking by verified email** is Convex Auth's default for OAuth. Decide, write down and
  test what it does beside the table above. Two Google accounts with one email must never merge
  two users.
* **Depends on:** 3.
* **Look-ahead (thread 6):**
  - Keep the start of a Google sign-in in one function in `src/state/`, which both of 6's doors
    call.
  - Shape the pending name choice so 6 can read it with one query and settle it with one mutation.
  - The query that says whether Google is offered is what 6's button reads.
* **Proof:** a full e2e run at landing (it patches a dependency).

### 6. `google_ui`: signing in, from both doors

*The Coach's text:*

> * **From the first screen**, before a handle:
>   - "Sign in with Google" beside choosing a handle;
>   - after the round trip, the person is offered a handle prepared from their Google name or the
>     part of their email before the @, through the same pure function as today, checked against
>     taken, retired and reserved userlabels;
>   - they confirm or edit it.
> * **As an anonymous user:** "Sign in with Google to keep `mrflip` on every device", where the
>   sealing refusals point.
> * **The merge's name choice:**
>   - "This browser was `mrflip`; your Google account is `flippy`. Keep which?";
>   - choosing the anonymous handle relabels and retitles the user, and rewrites its huntships'
>     copies;
>   - addresses never change.
> * **Signed in:**
>   - a menu shows the email to its owner, and *Sign out*;
>   - *Sign out* warns that the browser goes back to having no handle.
> * **The button follows Google's sign-in branding guidelines**: Google's own "G" mark and wording.
>   Brand verification checks this. It is an MUI `Button` with Google's published asset, not
>   Google's JavaScript library, which serves a different flow.
> * MUI components, per `notes/views.md`.
>
> *Depends on:* 5, and 8 (suggestions must skip reserved words).

*Orchestrator's gloss.*

* **Touches:**
  - the gate (`UserlabelGate`, after thread 3) and the user menu from thread 1;
  - a dialog for the name choice;
  - the settling mutation, which calls thread 4's `relabelUser` (*Orchestrator:* ~~`relabelUser`~~
    was pulled forward by thread 4) and adds the ghosting write and the name choice;
  - the sealing notices in `src/lib/notices.ts`;
  - Google's "G" asset under `public/`;
  - e2e up to the redirect, and convex-test for the settling mutation.
* **Depends on:** 5 and 8.
* **Look-ahead:**
  - Thread 9 reviews what a browser can learn of another user. The email shows only in the
    owner's own menu, and comes from a query that returns it to its owner alone.
  - Thread 7's footer is on every page. Do not move it.

### 7. `google_pages`: what Google asks a public app to have

*The Coach's text:*

> * **A homepage** Google can link: `/about`, made to describe what Triquet is and does, in a sentence
>   or two above the fold, and to link the privacy policy and terms. It must be public and
>   prerendered, with no sign-in in front of it.
> * **`/privacy`**, in plain language:
>   - what we store: a handle and title; quizzes and what is written in them; for a Google account,
>     the email, name and picture Google sends, and no other Google data;
>   - who sees what (a handle and title to a hunt's members; an email to its owner alone);
>   - that a session is kept in the browser's storage;
>   - that a question asked of a bot is sent to Anthropic;
>   - how to have one's data deleted: by asking the contact address, until an in-app way exists;
>   - the date it last changed.
> * **`/terms`**: short and plain. The service as it is, the person's content theirs, no abuse, and
>   the right to remove what breaks the rules.
> * **A contact**: `info@triquet.me` (the Coach, 2026-10-11), in the policy and the footer.
> * **A footer** on every page linking About, Privacy and Terms.
> * **Static pages:** markdown content rendered as the app's other documents are, and prerendered.
> * **The wording is a draft for the Coach to approve.** The thread says so in its report, and
>   writes no legal claims beyond what the app does. It reads the code to make the policy true
>   (what is stored, where, who can read it).
> * **`google-oauth-keys.md`** gains the exact URLs to enter on Google's branding page.
>
> *Depends on:* nothing; can run beside 1 and 2.

*Orchestrator's gloss.*

* **Touches:**
  - `src/app/about/`, and new `src/app/privacy/` and `src/app/terms/`, outside the `(synced)`
    group, so no Convex client is in front of them;
  - their markdown;
  - a footer component in the root layout;
  - e2e (new spec files go in `SpecCorners`);
  - `google-oauth-keys.md`.
* **Depends on:** nothing.
* **Look-ahead:**
  - Thread 8 reserves `privacy` and `terms` as top-level words. Name the routes exactly so.
  - The policy describes the app as it will be once Google sign-in ships (the pre-plan's model),
    not as it is today: say so in the draft, and keep it true to the pre-plan's decisions.
  - Thread 6's sign-in screen may link the policy, so give it a stable path.

### 8. `reserved_words`: survey and augment the reserved list

*The Coach's text:*

> A userlabel is now also an address (`/~label/…`) and a sandbox's hunt label.
>
> * **Survey** what `PA.ReservedLabels` and `PA.ReservedToplevel` (`src/lib/vv/patterns.ts`, read
>   through `Labelmaker.isReserved`) hold today, against:
>   - every top-level route in `src/app/` (`about`, `api`, `c`, `h`, `my`, `stats`, and the coming
>     `privacy` and `terms`);
>   - the words a userlabel should not be: `admin`, `support`, `root`, `triquet`, `google`,
>     `anonymous`, `handle`, the names of roles, and the like.
> * **Library first.** A maintained reserved-usernames list on npm (their word) may do most of this.
>   Weigh one against a list of our own, per `notes/stack.md`.
> * **Grandfathering.** Existing hunt labels and `orglabel`s stay valid; the list governs new ones.
>   Write a read-only check, for the Coach to run against production (`prd_janitor`), that names
>   any `orglabel` or hunt label the new list would refuse.
>
> *Depends on:* nothing; can run beside 1 and 2. Lands before 6.

*Orchestrator's gloss.*

* **Touches:**
  - `src/lib/vv/patterns.ts` (`ReservedLabelGroups`, `ReservedToplevelGroups`, and the prefixes
    and forms beside them);
  - `src/lib/labelmaker.ts` (or wherever `isReserved` lives) and its tests;
  - perhaps a package (`notes/stack.md` says when one may simply be installed);
  - a read-only internal query and a script for the check.
* **Depends on:** nothing.
* **Look-ahead:**
  - Thread 3's free-userlabel check, and thread 6's suggestions, both ask "is this userlabel
    reserved?". Give them one predicate for userlabels, if the existing one does not already
    answer that exactly.
  - The check's script runs under `prd_janitor` (read-only): reuse thread 2's guard helper if 2
    has landed. Otherwise, write the script so it can adopt the helper later, and note that in
    your thread file.
  - Grandfathering means existing rows still pass validation when read, and when written back
    unchanged. Make sure a reserved word added now cannot make an existing hunt unwritable.

### 9. `oauth_security`: a strong review

*The Coach's text:*

> Review the sign-in path, the patch, `createOrUpdateUser`'s table, sealing, the admin flag, the
> clear and adopt commands, the claim rules, and what a browser can learn about another user (email
> above all). Fix what is certain. Note the rest in `whiteboard/TODO.md` and `notes/security.md`.
>
> *Depends on:* everything above.

*Orchestrator's gloss.*

* **Touches** whatever it finds.
* **How:** the worker reads the sprint's diff as a whole, `29850126..` the top, and the patch
  under `patches/`, using the `convex-reviewer` and `security-review` skills where they fit, with
  a hand read of every public function's authorization.
* **The review of this thread** is of its fixes, as for any thread.
* **Depends on:** threads 1 to 8 landed.

## For the Coach

The pre-plan's *For the Coach* stands: export production and set its two Google keys before the
clear; approve the privacy and terms wording when thread 7 lands. Also:

1. **The merge order** above (*Merging, for the Coach*): everything beneath thread 3's PR can
   merge in the first step.
2. **Your own local backends** (the `dev` and `e2e` roles in the main checkout) will refuse thread
   3's schema once you pull it. `scripts/convex_reset dev` empties one; no agent touches them.
