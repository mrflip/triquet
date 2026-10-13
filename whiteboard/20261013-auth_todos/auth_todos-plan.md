# Auth todos: the domain, the userlabel rules, a mock Google, the sandbox made for you, the copy

Sprint plan, 2026-10-13. Mode: **normal**. Review level: **medium**. At most **3** threads at once.
Issued by the Coach (Flip), as `/sprint auth_todos` (the threads, verbatim below; the same items
head `whiteboard/TODO.md`'s *Tiny Tasks*). **Status: threads 1-3 landed (#247, #248, #250); thread 4 landing; thread 5 underway.** `auth_todos-progress.md`, beside
this file, is newer than this plan wherever the two disagree.

The spine was empty at planning: the oauth sprint and its follow-ups (#226-#246) are merged, and
the main checkout stands on `main` (`45056488`). The first cut starts a fresh spine.

## Read first

Beyond CLAUDE.md and its auto-loads (`notes/stack.md`, `notes/testing.md`, `notes/convex.md`,
`notes/views.md`, `notes/e2e.md`):

* `notes/vocabulary.md`, *Users* through *sandbox*, and the label paragraph (*userlabel*, *handle*,
  reserved words), before naming anything. The auto-memory holds two standing rules: an identity is
  not a person, and "username" is banned (`userlabel` in code, "handle" on screen). The Coach's text
  below says "username": read it as userlabel.
* `whiteboard/20261010-oauth/oauth-progress.md` (the summary; skip the per-thread reviews unless your
  thread touches them), and the thread files it names for your corner: thread 5's
  (`thread-5-google_signin.md`: the provider, the patch of Convex Auth, the merge) for threads 3 and
  5; thread 8's (`thread-8-reserved_words.md`) for threads 2 and 4.
* `notes/security.md`, the oauth sprint's entries (2026-10-11 onward). Threads 2 and 3 each add or
  amend one.
* `notes/deploy.md`, *Schema pushes: the two modes*, before threads 2, 4 or 5 (each touches a row
  validator or what a row may hold).
* The code: `convex/auth.ts` (providers, `returnUrlFor`), `convex/writing/user_actions.ts`
  (`userForSignIn`, taking a userlabel), `convex/writing/hunt_actions.ts` (`new_hunt`),
  `src/lib/vv/checks/strings.ts` and `src/lib/vv/patterns.ts` (`Userlabel`, the reserved lists),
  `src/lib/labelmaker.ts`, `src/components/HuntsList.tsx` (the sandbox made by hand today),
  `e2e/google-sign-in.spec.ts`, `e2e/support.ts` (`assumeUserlabel`), `e2e/admin.ts` (`vouchFor`,
  `mergeInto`).

## Ground rules

`notes/git_hygiene.md`, `notes/git_hygiene-laptop.md` (*A thread, start to finish*, *Sprints*) and
`.claude/agents/thread-worker.md`. Particular to this sprint:

* **Strike the TODO line.** Each thread's item is a bullet in `whiteboard/TODO.md`'s *Tiny Tasks*:
  the thread that does it deletes that bullet (and any TODO entry its work makes moot, said in its
  thread file).
* **Nothing touches production, Google's console, Vercel's domains or Doppler.** What those need
  for the new domain or the mock goes in the thread file's *For the Coach*.
* **Prove with `pnpm e2e --touched`**, and `pnpm e2e:smoke` for a quick signal while building.
  Threads 2-5 reach `src/models/`, `convex/` or `e2e/support.ts`, so their corner is the whole
  suite anyway. A new spec file gets one `@smoke` test and a `SpecCorners` entry in
  `scripts/spine.ts`.
* **Test titles take `"`** (the TODO's *Soon* item): new tests are written that way.

## Threads

Wave one, side by side: 1, 2 and 3. Then 4 (after 2); 5 (after 3); 6 last (after 1-5).

### 1. The domain is triquet.me (`domain`)

*Coach's text:* "rename “triquet.vercel.app” to “triquet.me” everywhere"

Gloss: every live mention: `convex/auth.ts`'s `returnUrlFor` examples, `.claude/skills/pullchef/SKILL.md`
(production's `stats.json` and `/stats`), `scripts/measure-latency.ts`'s usage line, the notes, and
any metadata the app sets for its own address (search `metadataBase`, `SITE_URL`, Open Graph, the
policies' and about page's links). Records of what was measured or decided then
(`notes/20260928-cloud_measurements-a.md`, the measurement in
`notes/decisions/20260928-database-decisions.md`), finished sprints' whiteboards and `human/` keep
the name they were written with; a dated record is not "live". Where code or tests derive the
production address, one constant if there is none. *For the Coach*: what lies outside the repo
(Convex production's `SITE_URL`, Google's authorized origins and redirect URIs, Vercel's domain and
its redirect from the old name). Depends on: nothing. **Look-ahead:** thread 6 reads the same
pages for copy; leave wording alone beyond the address.

### 2. No held userlabel (`one_userlabel`)

*Coach's text:* "remove heldUserlabel. It skips the top-level reserved words, so a handle claimed
before a word was reserved stays valid. <-- we don't need this"

Gloss: one userlabel check, `CK.userlabel` (top-level words and all), wherever `heldUserlabel`
stands today: `src/lib/vv/checks/strings.ts`, `src/lib/validator.ts`, the models (`user`, `hunt`'s
org, `huntship`, `adoption`, `ghosting`, `actions`), `convex/hunts.ts`, `convex/testing.ts`,
`src/lib/addresses.ts` (`isHeldUserlabel`), and the doc blocks, `notes/vocabulary.md` and
`notes/security.md` (amend the 2026-10-11 thread 8 entry: a word reserved later now locks its
holder's rows out of writes and its address out of reach, so the list is grown only after
`scripts/check_reserved` names no holder). Keep `scripts/check_reserved`, which becomes that guard;
say so in its doc block. A row validator grows stricter: no shape changes, so no migration, but
the thread file says what a row already holding a top-level word would meet (production's clear
leaves none; the Coach runs `check_reserved` before deploying if unsure). TODO's *Not yet* entry
on a sealed user's sandbox under a later-reserved word is moot: strike it. Depends on: nothing.
**Look-ahead:** thread 4 changes `PA.Userlabel`'s length beside this; thread 5 makes the sandbox
labelled with the userlabel, now one check for both.

### 3. A mock Google, and signing up, in and verifying, tested through (`mock_google`)

*Coach's text:* "Set up oauth2-mock-server -- or other, as you recommend -- and beef up the tests
around signup signin and verify"

Gloss: **`oauth2-mock-server`** (Node, in-process, an OIDC issuer with discovery and JWKS, claims
settable per test through its `beforeTokenSigning` hook) is the orchestrator's recommendation over
a Docker issuer (`mock-oauth2-server`, Kotlin) or a Playwright route stub (which cannot reach the
token exchange, made by the Convex backend, not the browser). A devDependency the Coach named; list
it in `notes/stack.md`. The shape, for the worker to settle and record:
* the issuer runs per lane (a port of its own in `scripts/lanes.ts`, never passed by hand), started
  beside the e2e role's backend (Playwright's global setup or `webServer`, as the suite does its
  other servers);
* the e2e backend's Google provider points at it: the issuer, and placeholder Google keys, set by
  the scripts on that role's backend only (`scripts/convex_dev`), so `googleKeyed()` is true in CI
  as locally, and the redirect test stops skipping. The override is read only where a mock issuer is
  named, and can never point production's provider elsewhere by accident: write the decision into
  `notes/security.md`. If Convex Auth or `oauth4webapi` refuses an `http://localhost` issuer, find
  the sanctioned switch rather than patching around it, and say which;
* specs that go all the way through: a new visitor signs **up** with Google from the front door
  (picks a handle, lands signed in); a standalone account **verifies** from the user menu (keeps
  its handle and hunts, `email_verified`, `locale`, `hd` kept); a returning person signs **in** on a
  fresh browser and is switched to their user (and the merge case `mergeInto` stands in for today,
  driven for real where it can be); an unverified email; a refused consent (the issuer's error
  redirect). Where a real flow now covers what `vouchFor`/`mergeInto` stood in for, say which
  stand-ins could go; remove them only where nothing else uses them;
* unit tests in `tests/convex/auth.test.ts` and `users.test.ts` for any case the e2e cannot reach
  cheaply.
Depends on: nothing. **Look-ahead:** thread 5 changes what a new signup lands on (its sandbox and
first quiz) and extends these specs to say so; write the signup assertions so the landing is one
helper it can change.

### 4. A userlabel may be four letters (`short_userlabel`)

*Coach's text:* "relax username cap to four, not six, characters"

Gloss: `PA.Userlabel.min` 6 -> 4, its message, and everything that states six: doc blocks
(`strings.ts`'s), the handle field's helper text and suggestions (`UserModel`'s
`SuggestionNumbers` and the suggesting code), the vocabulary, the about/help copy if it says, and
the tests that pin six (unit and e2e). A floor lowered admits more: no migration. A sandbox is
labelled with its userlabel, and `PA.Label.min` is 2, so four fits. Check the reserved lists for
four- and five-letter words that were safe only by length (`mail`, `auth`, `home`, `blog`, `help`,
`info`, `team`...): they are listed, so nothing to add, but confirm and say so. Depends on: 2
(the same lines of `strings.ts`).

### 5. The sandbox and its first quiz, made for you (`auto_sandbox`)

*Coach's text:* "Auto-create the sandbox / first quiz"

Gloss: a new user that takes its handle gets its sandbox (`~label/label`, `Hunt.isSandbox`) and
one first quiz in it, in the same mutation that takes the handle (one transaction: no half-made
user), and lands at its sandbox (`~label/label`), unless a more compelling return-to address was
saved: one that names a hunt, a quiz or another page with work on it. `/my/hunts`, `/` and
`/my/profile` are not compelling (the Coach, 2026-10-13); write the rule as one tested function
beside the routes (`src/lib/routes.ts`), and say what else it counts as not compelling. The same
for a person who signs up with Google from the front door, whose return-to rides through
`returnUrlFor` and `use-google-sign-in`.
Not retroactive: users who have a handle already are left as they are. `HuntsList`'s make-it-by-hand
path stays for a user with no sandbox (one made before this, or one that deleted it), so its retry
loop is reused or simplified, not duplicated. The first quiz is blank, with the default title a new
quiz takes. `e2e/support.ts`'s `assumeUserlabel` and the specs that assume an empty hunts list
change: fix the helper, not each spec. Extend thread 3's signup specs to assert the landing.
Depends on: 3 (its signup specs and helper). **Look-ahead:** thread 6 reviews the copy this adds.

### 6. The microcontent, consistent (`microcontent`)

*Coach's text:* "Review microcontent for consistency and style (eg title caps consistency)"

Gloss: every string a person reads: buttons, menu items, dialog titles, tooltips, field labels and
helper text, notices (`src/lib/notices.ts`), alarms, empty states, page titles. Survey first, list
the inconsistencies by kind in the thread file, then settle the conventions (Material's sentence
case is the default: "Sign in with Google", "New hunt"), and write them as a short section of
`notes/views.md` so later work keeps them. Fix them in commits by kind. The e2e suite finds controls
by name: change the specs with the copy, in the same commits. Content pages (`src/content/`) only
for headings' case; their prose is the Coach's. Depends on: 1-5 (it reviews what they add).

## Decisions taken

1. **`oauth2-mock-server`** is chosen for thread 3 (the Coach's suggestion, confirmed: reasons in the gloss).
2. **"Everywhere" means every live mention** (thread 1); dated records keep the old name.
3. **A sandbox is made for every new user, anonymous or Google-signed-up**, on taking a handle,
   with one blank quiz (thread 5). *Confirmed by the Coach, 2026-10-13:* "yes, it's reasonable to
   give every user an empty sandbox." And: "unless there's a more compelling return-to url saved
   (my/hunts, /, my/profile are not compelling), land them at their sandbox once they have a
   username." So the landing is the sandbox's hunt page, not the quiz.
4. **Sentence case** is the default convention thread 6 holds the copy to, unless its survey finds
   the app already settled on another.

## For the Coach

* Thread 1 lists what the new domain needs outside the repo (Convex `SITE_URL`, Google's console,
  Vercel). Nothing changes there until you do it.
* Thread 2 makes a row already holding a newly reserved word unwritable; production's clear leaves
  none, but `scripts/check_reserved` against production before deploying settles it.
* ~~Decision 3 (sandbox for Google sign-ups too)~~: confirmed by the Coach, 2026-10-13.
