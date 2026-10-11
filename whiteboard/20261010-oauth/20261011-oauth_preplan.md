# Pre-plan: one user, huntships, and Google sign-in

2026-10-11. Drafted by the orchestrator from the Coach's decisions in chat (2026-10-10 and 11),
for the Coach to review and hand to `/sprint`. It supersedes the threads in `oauth-plan.md`.
Background, kept for reference rather than as instructions:

* `google-oauth-keys.md`: the keys, and path A.
* `identity-names.md`: the naming work. This file's names win where they differ.
* `convex-auth-v2.md`: why we stay on v1.
* `oauth-progress.md`: the evidence on Convex Auth.

## What the Coach decided

* **Stay on Convex Auth v1** (0.0.96), with a small `pnpm patch`: upstream's open PR #306, which
  hands the signing-in session's user to `createOrUpdateUser`.
* **The ident and the user become one.** The person-facing record is Convex Auth's `users` row,
  extended with our columns. We keep it as a rich record, because we give it richer behaviour.
* **"Account" and "user" mean what Convex Auth means.** An *account* is one way in (anonymous, or
  a Google account), and belongs to exactly one *user*. For now, an email address is treated as
  the same thing as a Google account.
* **"Username" is banned; the word is `userlabel`**, as with our other `…label` names
  (`orglabel`): in code, documents, notice keys and test names. **On screen, a person reads
  "handle".**
* **No `account` in our own code.** What `performAccount` dispatches splits by noun: claiming and
  retitling a userlabel go to `writing/user_actions.ts`, making and changing hunts to
  `writing/hunt_actions.ts`.
* **Anonymous users get the least we can give.** A userlabel, and one **sandbox**: a hunt named
  for themselves (`~label/label`), with no other members. They are never added to anyone else's
  hunt, never review, never administer.
* **A `/~foo/…` segment never changes once made.** `hunts.orglabel` is an **address**, copied
  once. It is not a pointer to an owner: after a merge, the user who holds a sandbox may have
  another name than its address says.
* **Merging**, when an anonymous user's browser signs in with a Google account that already has a
  user:
  1. the Google account's user continues, and is made smith of the anonymous user's sandbox,
     which keeps its address;
  2. one userlabel or the other is kept, as the person chooses;
  3. the other userlabel is recorded for eventual release.
  Anonymous users never have an org to carry across.
* **Production keeps its hunts and loses its people** (the Coach, 2026-10-11). Every user,
  account, session, ident, identing and membership in production is deleted; the hunts, and
  everything under them, stay at their addresses. The Coach signs in again with Google, claims
  `mrflip`, and the orchestrator runs a one-off command making them smith of every hunt.
* **The pages and policies Google asks for** are part of this sprint: a homepage that describes
  the app, a privacy policy, terms, and a contact.
* **Moving a quiz to another hunt is not planned**, unless the work forces it (*Not in this
  sprint*, below).

## The models and their names

| Model | Table | What it is | Identifiers | Notes |
|---|---|---|---|---|
| **account** | `authAccounts` (Convex Auth; its name is fixed) | one way in: anonymous, or one Google account | `_id`; `provider`; `providerAccountId` (Google's `sub`, or a random UUID for anonymous) | belongs to exactly one user (`userId`). Never our code's word for anything else |
| **user** | `users` (Convex Auth's name, our extended row) | the persona: what holds a userlabel, and what everything else points at | `_id`; **`userlabel`** (the `userlabel` validator; unique, set once, absent until chosen); `title`; `admin` (a flag, set only from the command line); Convex Auth's `isAnonymous`, `email`, `name`, `image` | **We write it.** A custom `createOrUpdateUser` means Convex Auth no longer does, so a Zod row validator in `src/models/user.ts` validates every write, as for any other table |
| **session** | `authSessions` (Convex Auth) | one signed-in browser | `_id` | unchanged |
| **hunt** | `hunts` | unchanged | `_id`; `label`; `orglabel` (an address, never changed) | a sandbox is a hunt whose `label` equals its `orglabel`, made by an anonymous user |
| **huntship** | `huntships` (new; replaces `huntings`) | a user's place on a hunt, with its role | `_id`; `hunt_id`; `user_id`; copies `userlabel` and `usertitle` (`notes/convex.md`, *Copies*); `role` | at most one per hunt and user |
| **review** and **reviewing** | `reviews`, `reviewings` | unchanged in kind | `ident_id` becomes `user_id` | production's are deleted with their reviewers (the Coach, 2026-10-11) |
| **ghosting** | `ghostings` (new, append-only) | a userlabel retired by a merge, held reserved until released | `_id`; `userlabel`; the user who held it; the user it merged into; the account whose sign-in caused it | the Coach's word |
| ~~ident~~, ~~identing~~, ~~hunting~~ | `idents`, `identings`, `huntings` | gone | | dropped outright by thread 3, after production's are deleted |

**When a userlabel is free.** No user holds it, no ghosting holds it, and no hunt carries it as
its `orglabel`. The last rule keeps a stranger from becoming, say, `alice`, and appearing to own
the hunts addressed `~alice/…`. It is what makes a ghosting releasable only once no hunt carries
its label. **Only the command line can give out a userlabel that only a hunt's address holds**
(thread 4), which is how the Coach gets `mrflip` back after production's people are deleted.

**Admin is a flag on the user, set only from the command line** (the Coach, 2026-10-11).
* **Why not by userlabel:** `TRIQUET_ADMINS` names userlabels today, and a userlabel goes to
  whoever claims it first. After production's people are deleted, `mrflip`, and admin with it,
  would be anyone's for the taking.
* **Why not by email:** a Google account's email can change, and a Workspace address can be
  reassigned to someone else. Google says to identify an account by its `sub`, never its email.
* **What it rests on:** the deploy key (`prd_janitor`), which is the root of trust already. The
  user row is bound to the Google account's `sub` through its account, so nothing drifts.
* **The rules:** an admin must be signed in with Google, and no environment variable lists
  admins in production.

**Words in the browser.** A userlabel is a **handle** on screen. *Anonymous* and *signed in with
Google* are what a person reads; the code says `isAnonymous`.

**Org.** Not a model yet. The full org model (orgs owning hunts, org memberships with admin
rights, merges taking the higher right) is a later sprint. Nothing here may assume that
`orglabel` names an owner.

## Where and when each name changes

| Old name in our code | New name | Where | Thread |
|---|---|---|---|
| `account` in our dispatch and policy code: `performAccount`, `accountAction`, `AccountActionDNA`, `affirmAccountAction`, `AccountOutcome`, `writing/account_actions.ts`, `use-account-actions.ts`, and the plumbing named for them | split by noun. **User actions** (claim a userlabel, retitle): `writing/user_actions.ts`, a user-action union and dispatcher, `use-user-actions.ts`. **Hunt actions** (make a hunt; retitle, relabel, arrange its categories): into the existing `writing/hunt_actions.ts` and the hunt-action union. The worker names the dispatchers | moved, not rewritten (the Coach: "don't rewrite them, but they don't deserve the keyword") | 1 |
| "username" | **`userlabel`** in code, documents, notice keys and test names; **"handle"** in on-screen text | everywhere | 1 for what exists, and every later thread for what it writes |
| `idents`, `Ident`, `IdentT`, `IdentValidators.identLabel`, `ident_id`, `Actor`'s `ident_id`, `idents.current`, `useIdent`, `IdentGate`, `identForLabel`, `assumeIdent`, `retitleIdent` | `users` (our columns), `User`, `UserT`, `UserValidators.userlabel`, `user_id`, `useUser` (or `useMe`), `UserlabelGate`, `userForUserlabel`, `assumeUserlabel`, `retitleUser` (and, in 6, `relabelUser`) | `convex/`, `src/models/`, `src/lib/` (`actor`, `approve`), `src/state/`, `src/components/`, `tests/`, `e2e/` | 3 |
| `identings` | gone; merges write `ghostings` | `convex/writing/` | 3 |
| `huntings`, `Hunting`, `HuntingValidators`, `ident_label`, `ident_title`, `add_hunting`, `remove_hunting`, `huntingFor` | `huntships`, `Huntship`, `HuntshipValidators`, `userlabel`, `usertitle`, `add_huntship`, `remove_huntship`, `huntshipFor` | as above | 3 |
| test helpers `identified(tt, label)`, `signedIn(tt)`, e2e `assumeIdent` | the worker names them, by the rule that a helper says what kind of user it makes (named anonymous, Google) | `tests/support/`, `e2e/` | 3, extended in 5 |
| `TRIQUET_ADMINS` (userlabels) | the user's `admin` flag, set by thread 4's command. A local backend keeps "everyone is an admin" | `src/lib/actor.ts`, `scripts/convex_dev`, `notes/deploy.md` | 3 (the flag), 5 (signed in with Google) |

**When:**
* Rename before building. Thread 1 frees "account" and "username" before anything starts using
  them in their new senses.
* Thread 3 moves the code to the new nouns in one go, so no file ever holds both.
* Documents change in the thread that changes the code they describe, with
  `notes/vocabulary.md` first.

## Production

There is nothing to carry across, so there is no widen-and-backfill chain: the old tables are
emptied, then the new schema replaces them in one push.

1. **The Coach exports production** (`npx convex export`) and keeps the file.
2. **Merge threads 1 and 2, and let them deploy.** Nothing changes for visitors; thread 2's clearing
   function is now on production.
3. **Clear, then deploy at once.**
   - Run thread 2's command against production: `prd_janitor`, dry run first to see the counts,
     then for real. It deletes every row of `users`, Convex Auth's other tables, `idents`,
     `identings`, `huntings`, `reviews` and `reviewings`. Every browser is signed out.
   - Then merge threads 3 to 9 straight away, and let them deploy.
   - If someone visits in between, they leave a row the new schema refuses, and the push stops.
     Clear again and redeploy: the clear is idempotent.
4. **The Coach signs in with Google**, with any handle or none. (`mrflip` is held by hunts'
   addresses, so it can't be claimed in the app.)
5. **The orchestrator runs thread 4's command**, on the Coach's word at the time.
   - The Coach confirms in chat which user is theirs. The command finds it by the Google email,
     once, with the Coach watching. That is safe as a one-time act; it is not a standing rule.
   - The command gives that user the userlabel `mrflip`, marks it admin, and makes it smith of
     every hunt.
   - It is a write to production, run as `prd_janitor`. It is said in chat before it runs, and
     its output is relayed whole.

## Threads

Each thread's text is the orchestrator's draft, for the Coach to edit before `/sprint`.

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

### 1. `split_account`: free the words "account" and "username"

* **Split** our `account`-named dispatch and policy code by noun, with no behaviour change and no
  rewrite of what the functions do:
  - claiming and retitling a userlabel (`assumeIdent`, `retitleIdent`) go to
    `writing/user_actions.ts`, behind a user-action union and dispatcher;
  - making a hunt, and retitling, relabelling or arranging the categories of one, join
    `writing/hunt_actions.ts` and the hunt-action union.
  - The browser's `use-account-actions` splits the same way.
* **Ban "username":**
  - it becomes `userlabel` in code, documents, notice keys and test names;
  - on screen it becomes "handle", in every notice and label a visitor reads.
* **Grep says what is left.** No `account` remains in our own code but where it means Convex
  Auth's.
* `notes/vocabulary.md` gains the new nouns: account, user, session, userlabel, handle, huntship,
  ghosting, sandbox, anonymous.

*Depends on:* nothing. *Look-ahead:* thread 3 rewrites what moved into `user_actions.ts`. Keep
this thread to moves and names, so thread 3's diff stays about meaning.

### 2. `clear_people`: delete production's people, keep its hunts

* **An internal mutation** that deletes, in batches, every row of:
  - `users`, `authAccounts`, `authSessions`, `authRefreshTokens`, `authVerifiers`,
    `authVerificationCodes`, `authRateLimits`;
  - `idents`, `identings`, `huntings`, `reviews`, `reviewings`.

  Hunts, realms, quizzes, questions, widgetings, columns, widgeteds, signals and the library are
  untouched.
* **A script that drives it**, run as `./scripts/doppledo prd_janitor scripts/clear_people`:
  - a **dry run by default**, printing each table's count;
  - it acts only with a flag naming the deployment it is aimed at, so it cannot be pointed at the
    wrong one by accident;
  - it repeats until nothing is left, and says what it deleted.
* **Written against today's schema**, since it runs before thread 3's push. Thread 3 then deletes
  it along with the tables it empties.
* `notes/deploy.md` gains the Coach's steps (*Production*, above).
* **Tests** on a local backend: the people go, the hunts stay, and a second run deletes nothing.

*Depends on:* nothing. It must reach production before thread 3 does.

### 3. `converge`: users and huntships, everywhere

The heaviest thread.

* **The schema changes in one step.**
  - The `users` table is inlined in `convex/schema.ts`, keeping Convex Auth's fields and indexes
    (`email`, `phone`), from a new `src/models/user.ts` row validator.
  - `huntships` and `ghostings` are added.
  - `reviews` and `reviewings` take a required `user_id`.
  - `idents`, `identings` and `huntings` are dropped.
  - Production's rows are gone by then (*Production*), so no backfill and no tighten. A local
    backend is reset (`scripts/convex_reset`).
* **The app runs on the new model.**
  - `askerOf` builds the actor from the user's own `userlabel` and `title`.
  - `Approve`'s policies and the `affirm…` functions speak `user_id` and huntships.
  - Copies follow the copies rule.
  - Row-level security rules move to the new tables.
  - The browser's hooks and views follow.
* **The custom `createOrUpdateUser` lands here, unpatched:**
  - anonymous sign-in inserts an anonymous user with no userlabel;
  - a returning account returns its user.
  - (Google arrives in 5.)
* **A userlabel is free** only if no user holds it, no ghosting holds it, and no hunt carries it as
  `orglabel` (*The models*, above). Only thread 4's command may give out one that only an
  address holds.
* **Admin becomes the user's `admin` flag**, read when the actor is built. No environment
  variable lists admins in production; a local backend keeps "everyone is an admin".
* **Sealing is policy** (`Approve`). An anonymous user:
  - may take a userlabel;
  - may make exactly one hunt, its sandbox, labelled with its own userlabel;
  - may not be added to any hunt, nor add anyone to its sandbox;
  - may not review.

  The refusals say "sign in with Google to …" (the button arrives in 6; until then the notice
  only says it is coming).
* **No identings.** Choosing a userlabel is one write to the user.
* **Thread 2's clearing function and script are deleted**, with the tables they empty.

*Depends on:* 1, 2. *Look-ahead:*
* Thread 5's merge needs a function, *make this user smith of that sandbox*, that bypasses
  sealing only for the Google user. Write it as a named write in `writing/`, not inline.
* Thread 6 needs "suggest a userlabel from a name" (`Ident.labelFor` today), kept as a pure
  function on `User`.

### 4. `adopt_script`: give a user a userlabel, admin, and hunts

* **An internal mutation**, which can:
  - find a user, by `_id`, by userlabel, or by the Google email of its account (for a one-time
    lookup with the Coach watching; never a standing rule);
  - set its userlabel, past the address rule (the command line is trusted);
  - set or clear its `admin` flag;
  - grant it a role on one hunt by address (`~org/hunt`), or on every hunt.

  The user must be signed in with Google for the admin flag or any grant. The mutation is
  idempotent and never lowers a role, and it returns what it changed.
* **A script wrapping it**, with a dry run that says what it would do:
  - in production: `./scripts/doppledo prd_janitor scripts/adopt --email <the Coach's> --userlabel
    mrflip --admin --smith-all`;
  - in dev, against a local backend.
* `notes/deploy.md` gains it, in the Coach's steps.

*Depends on:* 3. Can run beside 5.

### 5. `google_signin`: the provider, the patch, the merge

* **`pnpm patch`** `@convex-dev/auth`, carrying PR #306's change: `createOrUpdateUser` is handed
  the signing-in session's user. List it in `notes/stack.md`, with the PR, and a note to drop
  the patch when a release carries it.
* **The Google provider** joins Anonymous only where `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are
  set on the deployment. A query tells the browser whether Google is offered.
* **`scripts/convex_dev`** sets those two on a local backend, from the same names in the Doppler
  config it runs under. All three dev configs carry them: a web client in Google project
  1034248949886, which accepts `http://127.0.0.1:3500` and `:3501`'s
  `/api/auth/callback/google` (checked 2026-10-11).
* **`createOrUpdateUser`**, for an OAuth sign-in:

  | The account is | The signing-in browser's user is | Then |
  |---|---|---|
  | new | anonymous | **upgrade in place**: the account joins that user, which is no longer anonymous |
  | new | signed in with Google, or none | a new user. Linking a second Google account is a later, explicit action |
  | known | anonymous with nothing (no userlabel) | switch to the account's user |
  | known | anonymous, with a userlabel | **merge**: the account's user continues; it is made smith of the sandbox, if there is one; a pending name choice is recorded (thread 6 asks it); until answered, the account's user's handle stands |
  | known | signed in with Google as another user | switch. **Never merge two Google users** |

  A merged-away user is never deleted: it is marked, its sessions deleted, and its userlabel goes
  into `ghostings` once the name choice is settled.
* **Admins must be signed in with Google:** an anonymous user's `admin` flag counts for nothing.
* **Tests:**
  - convex-test for every row of the table, for the refusals, and for admin needing Google;
  - e2e up to the redirect (the URL's `client_id`, `redirect_uri` and `scope`, intercepted, never
    followed).
  - Nothing automated signs in to Google.
* **Documents:** `notes/stack.md` (*Authentication*, the patch), `notes/deploy.md` (production's
  two keys, path A), `notes/security.md` (the merge rules, the patch, the admin flag and why not
  email, what we store from Google), `notes/convex.md` (*Who is asking*).

*Depends on:* 3.

### 6. `google_ui`: signing in, from both doors

* **From the first screen**, before a handle:
  - "Sign in with Google" beside choosing a handle;
  - after the round trip, the person is offered a handle prepared from their Google name or the
    part of their email before the @, through the same pure function as today, checked against
    taken, retired and reserved userlabels;
  - they confirm or edit it.
* **As an anonymous user:** "Sign in with Google to keep `mrflip` on every device", where the
  sealing refusals point.
* **The merge's name choice:**
  - "This browser was `mrflip`; your Google account is `flippy`. Keep which?";
  - choosing the anonymous handle relabels and retitles the user, and rewrites its huntships'
    copies;
  - addresses never change.
* **Signed in:**
  - a menu shows the email to its owner, and *Sign out*;
  - *Sign out* warns that the browser goes back to having no handle.
* **The button follows Google's sign-in branding guidelines**: Google's own "G" mark and wording.
  Brand verification checks this. It is an MUI `Button` with Google's published asset, not
  Google's JavaScript library, which serves a different flow.
* MUI components, per `notes/views.md`.

*Depends on:* 5, and 8 (suggestions must skip reserved words).

### 7. `google_pages`: what Google asks a public app to have

* **A homepage** Google can link: `/about`, made to describe what Triquet is and does, in a sentence
  or two above the fold, and to link the privacy policy and terms. It must be public and
  prerendered, with no sign-in in front of it.
* **`/privacy`**, in plain language:
  - what we store: a handle and title; quizzes and what is written in them; for a Google account,
    the email, name and picture Google sends, and no other Google data;
  - who sees what (a handle and title to a hunt's members; an email to its owner alone);
  - that a session is kept in the browser's storage;
  - that a question asked of a bot is sent to Anthropic;
  - how to have one's data deleted: by asking the contact address, until an in-app way exists;
  - the date it last changed.
* **`/terms`**: short and plain. The service as it is, the person's content theirs, no abuse, and
  the right to remove what breaks the rules.
* **A contact**: `info@triquet.me` (the Coach, 2026-10-11), in the policy and the footer.
* **A footer** on every page linking About, Privacy and Terms.
* **Static pages:** markdown content rendered as the app's other documents are, and prerendered.
* **The wording is a draft for the Coach to approve.** The thread says so in its report, and
  writes no legal claims beyond what the app does. It reads the code to make the policy true
  (what is stored, where, who can read it).
* **`google-oauth-keys.md`** gains the exact URLs to enter on Google's branding page.

*Depends on:* nothing; can run beside 1 and 2.

### 8. `reserved_words`: survey and augment the reserved list

A userlabel is now also an address (`/~label/…`) and a sandbox's hunt label.

* **Survey** what `PA.ReservedLabels` and `PA.ReservedToplevel` (`src/lib/vv/patterns.ts`, read
  through `Labelmaker.isReserved`) hold today, against:
  - every top-level route in `src/app/` (`about`, `api`, `c`, `h`, `my`, `stats`, and the coming
    `privacy` and `terms`);
  - the words a userlabel should not be: `admin`, `support`, `root`, `triquet`, `google`,
    `anonymous`, `handle`, the names of roles, and the like.
* **Library first.** A maintained reserved-usernames list on npm (their word) may do most of this.
  Weigh one against a list of our own, per `notes/stack.md`.
* **Grandfathering.** Existing hunt labels and `orglabel`s stay valid; the list governs new ones.
  Write a read-only check, for the Coach to run against production (`prd_janitor`), that names
  any `orglabel` or hunt label the new list would refuse.

*Depends on:* nothing; can run beside 1 and 2. Lands before 6.

### 9. `oauth_security`: a strong review

Review the sign-in path, the patch, `createOrUpdateUser`'s table, sealing, the admin flag, the
clear and adopt commands, the claim rules, and what a browser can learn about another user (email
above all). Fix what is certain. Note the rest in `whiteboard/TODO.md` and `notes/security.md`.

*Depends on:* everything above.

**Order.**
* 1, 2, 7 and 8 together.
* Then 3, then 4 and 5 side by side, then 6, then 9.

**Production** merges in two steps: first 1 and 2; then, after the clear, everything else at once
(*Production*, above).

## For the Coach

1. **Before the clear:** export production, and set the production deployment's two Google keys
   (path A, `google-oauth-keys.md`).
2. **Approve the wording** of the privacy policy and terms when thread 7 lands.
3. **Done (2026-10-11):**
   - the dev client's redirect URIs;
   - the Doppler keys renamed `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`;
   - the screen word, "handle";
   - production's people to go, its hunts to stay; its reviews and reviewings go too;
   - admin is a flag set from the command line, not a list of emails or userlabels;
   - the support address is `info@triquet.me`.

## Not in this sprint

* **The org model** (World A): orgs owning hunts, org memberships with admin rights. A later
  sprint, built so that `orglabel` stays an address.
* **Bring-your-own-key asking** (TODO, O1).
* **Linking a second Google account to a user.**
* **Deleting one's own data from inside the app.** The privacy policy offers it by request until
  then.
* **Moving a quiz to another hunt.** Only if forced. If it is, these need thinking about first:
  - widgetings (copy without overwriting or merging, as the Coach described);
  - the quiz's categories (taking the `into` hunt's);
  - reviews and reviewings, whose reviewers are the old hunt's members;
  - the per-hunt git repository and its history;
  - change signals;
  - columns that name widgetings.
