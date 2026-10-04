# Sprint `dbpolicy`: sign-in, a policy layer, and relational integrity

**Date:** 2026-10-04. **Mode:** normal. **Review level:** medium. **Issued by:** flip, via
`/sprint`. **Status:** threads 1 to 5 done (#79, #81, #82, #83, #86); thread 6 underway.

Ten threads, stacked in order. The planning branch `20261003-dbpolicy_a` sits beneath thread 1,
so its commits (this directory, `notes/policy_approve.md`, `Approval.every`) ride into thread 1's PR. This document and `dbpolicy-progress.md` beside it are everything
a thread needs about the sprint; where they disagree, the progress document is newer.

## What the sprint is for

Today a browser says who it is by passing a self-minted `browser_key` as an argument, and anyone
may take on any ident. Authorization is a handful of async functions in `convex/authorize.ts`,
called by convention at the top of each public function; the lock on a quiz is enforced inside the
business code; a reviewer is sent every field of every question and the browser hides the answer.

When the sprint is done:

* A browser has a **session** (Convex Auth, anonymous provider) and **asserts a username** (an
  ident label) on top of it, and is asked for one before anything else. Identity arrives on
  `ctx` rather than as an argument.
* **Policy is pure and shared.** `src/lib/approve.ts` holds non-async `mayActionResource`
  functions (`mayReadReview`, `mayReviseQuiz`) that decide from evidence handed to them, and run
  in the browser and on the server alike. `Approve.may(key, …)` and `Approve.must(key, …)`
  dispatch to them by key.
* **Evidence is collected in one place.** `convex/authorize.ts` holds async
  `affirmActionResource` functions (`affirmReadReview`): each takes what the client says is true
  (its **affirms**), checks all of it against the database in one parallel round, and hands the
  verified **claims** to the pure function. Business code past that point trusts its inputs.
* **Rows carry what policy needs**, so that one round is enough: `hunt_id` on every row a hunt
  owns, and a few more denormalized fields.
* **The database handle is scoped**: after affirmation, a function can only see rows of the hunt
  it was affirmed for.
* **Reads are shaped by role**: a reviewer is sent what a review needs. That includes the
  answer: hiding it until revealed is a "no spoilers" shield in the view, not a security rule.
* Three integrity holes are closed.

## Read first (every thread)

`CLAUDE.md` auto-loads. Beyond it, before designing anything:

* `notes/policy_approve.md` -- **what a policy function in this sprint aims for.** Evidence
  gathered in one parallel round of `.get`/`.first`; decisions readable as prose, one guard per
  line; a named value rather than `null` for a named state; dispatch tables rather than
  membership tests; plain guards rather than compound booleans. These are aims with reasons
  behind them: see *When a directive does not fit*.
* `notes/convex.md`, `convex/_generated/ai/guidelines.md`, `notes/queries_hooks_and_subscriptions.md`.
* `notes/guidelines.md` (validation, the patch pattern), `notes/vocabulary.md`, `STYLE.md`.
* `notes/deploy.md`, *Schema pushes* -- threads 1, 3, 4 and 10 change row shapes.
* `notes/testing.md`.
* `dbpolicy-done-1-4.md` (beside this plan) holds threads 1 to 4's handoffs whole; the progress
  document carries their digest. Read the whole only where the digest is not enough.

## The model in brief

Thirteen tables. Convex has no foreign keys and no unique indexes: every cascade and every
uniqueness is code in `convex/writing/`, safe because a mutation is one transaction.

| Table        | Belongs to (field)                                     | Notes                                                                        |
| ------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `idents`     | --                                                     | A persona, named by `label` (fixed) with a `title`. No delete path. Thread 1 adds `user_id`, the session that claimed it |
| `identings`  | ident (`ident_id`)                                     | Associates assertion of identity (eg oauth) with ident record. Keyed by `browser_key` today |
| `hunts`      | --                                                     | Unit of membership, addressed by `label`                                     |
| `huntings`   | hunt (`hunt_id`), ident (`ident_id`)                   | Membership with `role`: `smith` or `reviewer`. One per pair                  |
| `realms`     | hunt (`hunt_id`)                                       | Only `home` exists. No write path                                            |
| `quizzes`    | realm (`realm_id`)                                     | `locked`, `row_ordering` (ids of its questions, in order)                    |
| `questions`  | quiz (`quiz_id`), hunt (`hunt_id`)                     | `chains_to` names a sibling by label                                         |
| `widgetings` | quiz (`quiz_id`); widget by `widget_label`             | A library widget put to work in a quiz                                       |
| `columns`    | quiz (`quiz_id`)                                       | `source` names a question field or a widgeting label                         |
| `widgeteds`  | question (`question_id`), widgeting (`widgeting_id`)   | What a widgeting stored for a question                                       |
| `widgets`    | --                                                     | The library every hunt shares (`scope: 'pub'`)                               |
| `reviews`    | quiz (`quiz_id`), ident (`ident_id`), hunt (`hunt_id`) | `phase`: `empty`, `draft`, `shared`                                          |
| `reviewings` | review (`review_id`), question (`question_id`)         | One reviewer's verdict on one question; `peeked`                             |

Where code lives: row validators in `src/models/<noun>.ts`; `convex/schema.ts` derives tables
from them; `convex/reading.ts` holds indexed reads; `convex/writing/` the actions; `convex/<noun>.ts`
the public functions; `convex/functions.ts` the function builders; `src/lib/rows.ts` the
projections from rows to what a screen shows; `src/state/` the browser's hooks; `tests/` mirrors
all of it and `tests/support/convex.ts` holds the test helpers.

Every write goes through one of two mutations: `hunts.perform` (an action from inside a quiz,
described in `src/models/actions.ts` as `huntAction`) and `idents.performAccount`
(`accountAction`). Every read is a query function returning `null` or `[]` when the asker may
not see it: a watch that throws takes the page down, so **a query answers a denial with its
empty value rather than throwing**.

## The policy rules the sprint must preserve

These are today's rules; a thread changes one only where it says so.

* **Smith** of a hunt: reads and changes everything of the hunt, including who is on it, except
  their own membership (nobody adds, re-roles or removes themselves).
* **Reviewer** of a hunt: reads the hunt; opens and writes their own review of any of its quizzes.
* **Not on the hunt**: is told the hunt exists and who its smiths are, nothing else.
* **Reviews**: one's own is always readable *while one is on the hunt* (new in thread 2: today
  membership is not checked). Another's only when `shared`, and then by a smith, or by a reviewer
  whose own review of that quiz is `shared`.
* **A locked quiz** refuses changes to its contents and layout. It does not refuse: making,
  deleting, locking or unlocking quizzes; hunt and membership actions; library actions; reviews.
* **The library**: readable by anyone who has asserted a username; changed by a smith acting from
  a quiz (until thread 9, which puts it behind an admin check that approves everyone for now).

## Vocabulary for this sprint

Add these to `notes/vocabulary.md` in the first thread that uses each.

* **session** -- a Convex Auth sign-in; anonymous for now. Gives a `users` row id.
* **actor** -- who a request is from, as a tagged value built once per request and placed on
  `ctx`: `{ kind: 'anonymous' }` when no username has been asserted (signed in or not), or
  `{ kind: 'ident', user_id, ident_id, ident_label }`. A tagged value rather than `null`, so
  that "anonymous" is a state with a name.
  **Naming:** `actor` (as a variable, field or parameter) is the whole tagged value. Something
  that holds an id or a label of the one acting is named for what it holds: `ident_id`,
  `user_id`, `ident_label`, and where it has to be told apart from another ident in the same
  scope, `acting_ident_id`. The same goes for `claims` and `affirms`: the object, not one of its
  fields.
* **standing** -- an actor's place on one hunt: `'smith'`, `'reviewer'` or `'stranger'`, for
  the same reason.
* **affirms** -- what the client says is true about its situation, sent with a request:
  `{ ident_id, hunt_id, standing }` and, where relevant, `realm_id`, `quiz_id`.
* **claims** -- affirms after the server has checked every one against the database, plus any
  rows it fetched in the same round. Code handed claims trusts them.
* **`affirmActionResource`** -- async, in `convex/authorize.ts`: collects evidence in one parallel
  round, verifies the affirms, calls the pure function.
* **`mayActionResource`** -- non-async, in `src/lib/approve.ts`: decides from claims and a row.
* **`Approve.may(key, …)` / `Approve.must(key, …)`** -- the dispatcher: looks the policy function
  up by key; `may` answers, `must` throws when the answer is no.

## Ground rules particular to this sprint

* **Check Convex and Convex Auth APIs with `/convex-docs` before writing against them.** Where
  this plan and a library's current documentation differ, the documentation is right; note the
  difference in your progress section.
* **Schema changes.** Local backends are emptied (`scripts/convex_reset <role>`) and pushed
  (`scripts/convex_dev agent true`); commit what the push regenerates under `convex/_generated/`
  in a commit of its own. Production is migrated in two steps (`notes/deploy.md`, *Schema
  pushes*): the thread that adds a field ships the **widen** (field optional in `convex/schema.ts`
  by hand, row validator strict, a backfill in `convex/migrations.ts`, the field listed under
  `Backfilling` in `tests/convex/schema.test.ts`). **Thread 10 tightens.** Threads between may
  assume the field is present on every row: the backfills run before they are deployed.
* **Deploys are the Coach's**, and so is the `dev` backend. Work against the `agent` and
  `e2e-agent` roles.
* **Integrity refusals stay with the write.** `labelTaken`, `widgetGone`, `questionGone`, the caps:
  facts about the data, true for every actor. They are not policy, and stay where they are.
* **Each thread ends green:** `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e`.

## When a directive does not fit

The steps below were written before the code was. They serve the goals in *What the sprint is
for*; where a step stops serving them, the goal wins and the step is what changes.

If a directive would make the code worse (more reads than before, a contortion to satisfy a
rule's letter, something a reader would not understand without this plan), the answer is a better
plan, not a workaround and not compliance on paper. Bring the work to a committed point and say
what you found and what you would do instead. When the better plan stays inside your thread and
nothing later builds on the directive, take it and record it under *Deviations*. When later
threads build on it, report `blocked` with your recommendation, so the plan is changed once
rather than bent thread by thread.

The places this is most likely, each a decision point for the thread named:

* **One parallel round** (thread 5). The aim is evidence gathered without one read waiting on
  another. Some checks have a genuine second step: a row found by label whose hunt is only then
  known, a reviewing reached through its review. First ask whether a denormalized field removes
  the step, and if so add it to thread 4's table (or propose it, if thread 4 is done). If none
  reasonably does, two rounds written plainly are better than one round reached by fetching
  speculatively or by asking the client for things it does not naturally hold.
* **The client's affirms** (thread 5). They are meant to be things the browser already has. If
  assembling them means threading values through many components, or one watch waiting on
  another only to learn what to affirm, say so: deriving that fact on the server may be the
  better trade.
* **Denormalized fields** (thread 4). Each is meant to be written once and left. If one turns
  out to need upkeep beyond the single fan-out listed, or its backfill is awkward, leave it out
  and say what it would have cost.
* **Pure policy functions** (thread 2). If a decision needs data that does not sit naturally in
  claims, say so rather than growing claims into a bag of everything or reaching for the
  database inside a `may…`.
* **The scoped handle** (thread 6). If the wrapper costs reads, fights the Zod builders or
  `convex-test`, or makes handlers harder to follow, report it with what you measured; a
  thinner check at the builder may do the job.
* **Reads shaped by role** (thread 7). If a per-standing projection breaks something the grid or
  the facets rely on, the shape of the facet is the question, not a special case in the view.
* **Convex Auth on a local backend** (thread 1). If it will not verify its own tokens there, that
  is a finding about the plan, to report before anything is built on it.

A *Done when* line describes the intended end state. A thread that ends somewhere else for a good
reason says where, and why.

## Threads

| # | Thread | Schema change |
|---|---|---|
| 1 | Sessions and the actor | `idents`, `identings`, auth tables |
| 2 | `Approve`: pure policy and the dispatcher | no |
| 3 | One label, and integrity repairs | `forced_label` off three tables (widen) |
| 4 | Denormalize | six tables (widen) |
| 5 | Affirmations | no |
| 6 | A scoped database handle | no |
| 7 | Reads shaped by role | no |
| 8 | Views ask `Approve` | no |
| 9 | The library behind an admin helper | no |
| 10 | Tighten | threads 3 and 4 (tighten) |

---

### Thread 1: Sessions and the actor

**Goal.** Replace the `browser_key` argument with a Convex Auth anonymous session. A visitor is
signed in silently on first load and is then asked for a username, every time a session has none.
A username belongs to the session that claimed it: someone asserting one that another session
holds is told to try a different one, or to create an account on the device they claimed it from
(which cannot be done yet; Google sign-in is not part of this sprint, so leave the provider list
easy to extend). Every function reads who is asking from `ctx.actor`.

**Steps.**

1. `/convex-docs`: Convex Auth setup (manual, not the interactive installer), the `Anonymous`
   provider, `getAuthUserId`, `authTables`, the React provider, use against a self-hosted backend,
   and how `convex-test` supplies an identity. Write down what you confirm in your progress section.
2. Install `@convex-dev/auth` and the `@auth/core` version it requires, pinned exact. In
   `notes/stack.md` move *Authentication* from Discuss to Use, saying what was chosen and that
   Google is deferred.
3. **Keys for local backends.** Convex Auth needs `JWT_PRIVATE_KEY`, `JWKS` and `SITE_URL` set on
   the deployment. Add `scripts/convex_auth_keys <role>`: generates a key pair the way Convex
   Auth's manual setup documents, and sets the three with `convex env set`, doing nothing when
   `JWKS` is already set. Call it from `scripts/convex_dev` beside the `TRIQUET_CLEARABLE` line.
   The keys are throwaway, live only in the backend, and stay out of the repo.
   Production's are the Coach's to set (see *For the Coach*).
4. Add `convex/auth.config.ts`, `convex/auth.ts` (`convexAuth({ providers: [Anonymous] })`) and
   `convex/http.ts` (the auth routes). Spread `authTables` into `defineSchema` in
   `convex/schema.ts`; note in `notes/convex.md` that these tables are Convex Auth's and not
   derived from a row validator.
5. **Prove it before going further.** On the `agent` backend, sign in anonymously from a scratch
   page or script and confirm a query sees a non-null `getAuthUserId`. Each role's HTTP actions
   are on port `35xx` (`scripts/convex_backend`); the backend must be able to verify its own
   tokens there. If it cannot, stop and report `blocked` with what you found.
6. `src/models/identing.ts`: replace `browser_key` with `user_id: zid('users')`. Schema index
   `by_user_id`. `convex/reading.ts` `identFor(db, user_id)`. `src/models/ident.ts`: add
   `user_id: zid('users').nullable()`, the session that claimed the username; null for an ident
   nobody has claimed yet (the idents that exist before this thread).
7. `src/lib/actor.ts` (pure, shared): the `ActorT` tagged union from *Vocabulary*, with
   `Actor.anonymous`, `Actor.isAnonymous(actor)`, and a doc block and tests.
8. `convex/functions.ts`: the builders (`zQuery`, `zMutation`) build the actor once (session →
   `users` id → newest identing → ident) and add it as `ctx.actor`. Remove the `browser_key`
   argument from every public function in `convex/` and read `ctx.actor` instead. Where a
   handler passed `ident?._id ?? null`, pass the actor; inside `convex/authorize.ts` replace
   `ident_id === null` tests with `Actor.isAnonymous`. Keep to the naming rule under
   *Vocabulary* as you go: a parameter that receives the actor is `actor`; one that still
   receives an id stays `ident_id`. Two existing names to put right while here: `acting_id` in
   `convex/writing/hunting_actions.ts` (an ident's id, which after this thread could be mistaken
   for a session's) becomes `acting_ident_id`, and `role: acting` in `src/state/use-hunt.ts`
   (a role under the name of a person) keeps the name `role`.
9. `convex/writing/account_actions.ts`: `assumeIdent`, `retitleIdent` and `newHunt` take the
   session's `user_id`. A request with no session is refused with a new refusal kind
   (`notSignedIn`, sentence in `src/lib/notices`). Asserting a username, by case:
   - no ident has that label: make it, claimed by this session, and take it on;
   - the ident is claimed by this session: take it on;
   - the ident is unclaimed (`user_id` null): this session claims it and takes it on;
   - the ident is claimed by another session: refuse with a new kind (`usernameClaimed`), whose
     sentence offers the two ways forward: try a different username, or create an account on the
     device it was claimed from.
   The claim check and the write are in one mutation, so two sessions asserting one new username
   at once leave one holder.
10. Browser: `src/app/providers.tsx` uses Convex Auth's React provider. Add
    `src/state/use-session.ts`: signs in anonymously when there is no session, and says whether
    the session is ready. Delete `src/state/browser-key.ts` and its test. Each hook in
    `src/state/` that passed `browser_key` drops it and skips its watch until the session is ready.
    The gate that asks for a username (`IdentGate`) stays, shows the `usernameClaimed` sentence
    in place, and lets the visitor try again.
11. Tests. In `tests/support/convex.ts`, `identified(tt, label)` makes a `users` row, asserts the
    username through `idents.performAccount`, and returns a tester bound to that identity
    (`tt.withIdentity`) with the `ident_id`; `seedHunt`'s `act` takes that in place of a
    `browser_key`. Update every test that passed `browser_key`. `tests/convex/authorize.test.ts`
    lists every public function: add Convex Auth's.
12. e2e: any spec that plants `triquet.browser_key` in storage goes through the username gate
    instead. Each browser context is its own anonymous session.
13. `notes/convex.md`: remove the "user identifier as an argument" departure. `notes/deploy.md`:
    add to the migration ledger that `identings` is cleared by hand before this deploys (its old
    rows do not fit, and it is only history: every browser asserts its username once more), and
    list the three environment variables.

**Done when.** No function takes `browser_key`; a fresh browser on `pnpm dev:agent` is asked for
a username and then works as before; two browser contexts are two actors, and the second is
turned away from the first's username with the sentence above (unit-tested and in one e2e spec).

**Leaves for later threads.** `ctx.actor`, `Actor`, and the identity-bound test helpers.

*Orchestrator, after thread 1 (#79):* the actor is built by `askerOf(ctx)` in `convex/functions.ts`,
which also puts `ctx.user_id` beside `ctx.actor`; later builders call `askerOf` in their `input`
hook rather than reading identity again. The rules in `convex/authorize.ts` already take
`actor: ActorT`, so thread 2 renames and moves them rather than rethreading identity. Test actors
for the matrix: `seeded.smith`, `join(label, 'reviewer')`, `identified(tt, label)` (stranger),
`signedIn(tt)` (anonymous with a session), bare `tt` (no session); the progress document has the
details.

---

### Thread 2: `Approve` -- pure policy and the dispatcher

**Goal.** Every policy *decision* becomes a non-async function in `src/lib/approve.ts`, written
to `notes/policy_approve.md`, reachable through `Approve.may` / `Approve.must`. The async
functions in `convex/authorize.ts` keep collecting evidence the way they do now, but are renamed
`affirm…` and delegate the decision. One behaviour change: one's own review needs membership.

**Steps.**

1. `git mv src/lib/approval.ts src/lib/approve.ts` and its test. Import it everywhere as
   `import * as Approve from …`. Rename `of` → `may` and `need` → `must`; keep `every` and
   `NotApprovedError`.
2. Add `standing` to the vocabulary and to `src/lib/actor.ts`: `HuntStandingVals =
   ['smith', 'reviewer', 'stranger']`, and predicates `Actor.isSmith(claims)`,
   `Actor.isReviewer(claims)`, `Actor.isMember(claims)`. Claims here are
   `ActorT & { hunt_id, standing }`.
3. In `src/models/review.ts` add the predicates a decision reads as prose: `Review.isShared`,
   `Review.isHidden` (not shared), `Review.isActiveOwner(review, claims)` (the actor wrote it
   *and* is a member of its hunt).
4. Write the pure functions in `src/lib/approve.ts`, one per rule in *The policy rules the sprint
   must preserve*: `mayReadHunt(claims)`, `mayChangeHunt(claims)`, `mayWriteReview(claims)`,
   `mayReadReview(review, claims, ownReview)`, `mayReadLibrary(actor)`, `mayCountUsage(…)`,
   `mayChangeMembership(claims, target_ident_id)` (smith, and not oneself), and
   `mayAskAnthropicBot()` (today's environment switch, still server-only). Each has a doc block
   listing its rules in order, one guard per line with the rule beside it, and one test per line.
5. **The dispatch table.** `src/models/actions.ts` carries a `TODO dbpolicy sprint` asking for
   this. In `approve.ts`, a table from every `huntAction` kind and every `accountAction` kind to
   its policy function, typed `as const satisfies Record<Kind, PolicyFuncT>` so a new action kind
   without a row fails to compile. `Approve.may(key, …)` looks up and calls; an unknown key
   throws. Replace `isReviewAction(action) ? … : …` in `mayPerform` with the lookup. In this
   thread content and layout actions map to `mayChangeHunt`; thread 5 gives them
   `mayReviseQuiz`.
6. `convex/authorize.ts`: rename each async function `affirm…` (`affirmReadHunt`,
   `affirmChangeHunt`, `affirmReadReview`, `affirmPerform`, `affirmAccountAction`). Each gathers
   what it gathers today, builds claims, and returns the pure function's answer. Move the
   "nobody changes their own membership" check out of `convex/writing/hunting_actions.ts` into
   `mayChangeMembership`, keeping the `ownHunting` refusal's sentence for the author.
7. `src/app/api/ask/route.ts` and `src/lib/ask/failures.ts`: call `Approve.must`.
8. **The matrix test**, as data, in `tests/lib/approve.test.ts`: every action kind × standing
   (`smith`, `reviewer`, `stranger`, and the anonymous actor) → the expected verdict. Plus, in
   `tests/convex/`, one pass through `hunts.perform` per standing proving the server agrees.

**Done when.** `convex/authorize.ts` contains no decision logic beyond calling `Approve`;
`grep -rn "Approval\." src convex tests` is empty; the matrix covers every kind (the `satisfies`
makes the compiler check that).

**Leaves for later threads.** The dispatch table and the matrix, which threads 5, 7, 8 and 9
extend rather than rewrite.

*Orchestrator, after thread 2 (#81):* what later threads build on, beyond the plan's words.
* **A policy returns a verdict**: `Approve.Allow` or a `Denialkind` that is also a `Refusalkind`
  (its sentence is `RefusalNotices[...]`). `may` answers a boolean, `must` throws, `verdictOn`
  gives the verdict. Read-side `affirm…` functions return booleans, write-side ones verdicts.
* **The table** is grouped (`LayoutPolicies`, `LibraryPolicies`, `ContentPolicies`,
  `RealmPolicies`, `ReviewPolicies`, `HuntPolicies`, `AccountPolicies`, `ReadPolicies`); every
  action row takes `(claims, action)`, typed to its own kind; `EvidenceT` says what each key is
  handed. Claims are built with `Actor.claimsOn` (server: `claimsFor` in `authorize.ts`).
* **`unicorn/prefer-combined-guards` contradicts `notes/policy_approve.md`** and is disabled, with
  a reason, where it bites. Until the Coach rules on an `eslint.config.mjs` override, later
  threads do the same and report each disable.

---

### Thread 3: One label, and integrity repairs

**Goal.** Remove `forced_label`, then close three integrity holes.

**Background.** Hunts, quizzes and questions each carry a minted `label` and a nullable
`forced_label` that overrides it; "the label in force" is `forced_label ?? label`
(`Labelmaker.effectiveLabelOf`, about forty call sites). The override was meant for a label that
would follow the title unless set by hand. That was not built: a label is minted once and nothing
regenerates it. What the pair does today is remember the minted label after a relabel, which
nothing reads as a key (row ids are the stable keys). Its costs: a hunt is found by two index
reads and a `.filter`; a question's `forced_label` is written by no path at all; several places
read the bare `label` where the label in force was meant.

After this thread there is one `label`. Relabelling a hunt or a quiz changes it. A question's
label stays fixed, as now.

**Steps.**

1. Row validators: remove `forced_label` from `src/models/hunt.ts`, `quiz.ts` and `question.ts`
   (rows, trees, class declarations, `blankRow`s). In `convex/schema.ts` keep it on the three
   tables as a hand-written optional field (the widen), and drop the `by_forced_label` index.
   Add `by_realm_id_and_label` to `quizzes`, beside `by_realm_id` (which stays: it gives a
   realm's quizzes in the order they were made).
2. A backfill per table in `convex/migrations.ts`: where `forced_label` is set, copy it into
   `label`; then remove the field from the row. List the field under `Backfilling` in
   `tests/convex/schema.test.ts`. Test it on rows with the override set, null, and absent.
3. `relabelHunt` (`convex/writing/hunt_actions.ts`) and `relabelQuiz`
   (`convex/writing/quiz_actions.ts`) patch `label`. `huntForLabel` in `convex/reading.ts`
   becomes one indexed read.
4. **Quiz labels unique within a realm, on the server.** `relabelQuiz` trusts its caller today;
   only the browser checks. Look the new label up through `by_realm_id_and_label` and refuse
   `labelTaken` when another quiz holds it; `newQuiz` can check the same way. Tests for the
   clash and for relabelling to one's own current label.
5. Replace every `Labelmaker.effectiveLabelOf(x)` with `x.label`, and remove `effectiveLabelOf`
   and the `Labelled` type's `forced_label`. Remove `forced_label` from `src/lib/rows.ts`,
   `src/lib/exporting.ts`, `src/lib/formulary/runner.ts`, and from `ReservedWidgetingLabels` in
   `src/models/widgeting.ts`.
6. Import (`src/models/import.ts`, `src/lib/importing.ts`) keeps accepting a `forced_label` in a
   pasted export and prefers it, so files exported before this thread still match their
   questions and quizzes. Export stops emitting it. Update `notes/examples/` and the fixtures.
7. `notes/vocabulary.md`: retire *forced_label* and *effective label*. `notes/deploy.md`: a
   ledger row for the backfill.
8. **Delete a quiz's questions by index.** `deleteQuiz` in `convex/writing/quiz_writing.ts`
   deletes the questions `row_ordering` lists, so a question missing from that array would
   outlive its quiz. Delete every question the `by_quiz_id` index finds (`for await`, as
   `deleteQuestion` iterates), and delete each widgeting through `deleteWidgeting` rather than a
   bare `db.delete`. `deleteQuiz` then needs only the quiz's id; simplify its callers. Test with
   a question row deliberately absent from `row_ordering`.
9. **An integrity check for tests.** In `tests/support/convex.ts`, `expectSound(tt)`: walks every
   table and asserts each id field names a row, each `row_ordering` matches its quiz's questions,
   each `chains_to` names a sibling, each column `source` names something showable, and no two
   quizzes of a realm (or two hunts) share a label. Call it at the end of the delete-quiz,
   delete-hunt, delete-questions and delete-widgeting tests.

**Done when.** `grep -rn forced_label src convex` finds it only in the import reader, the widened
schema and the backfill; the behaviours above are tested; `expectSound` passes after every
cascade.

**Leaves for later threads.** `expectSound`, which thread 4 extends to the new fields; one
`label` per row, which thread 4 can copy or index without a derived field; the tighten, which
thread 10 does.

*Orchestrator, after thread 3 (#82):* `expectSound` lives in `tests/support/soundness.ts`, its
checks a list (`SoundnessChecks`); any field ending `_id` is already checked to name a row (via
`TableForIdField`). `migrations:runAll` exists (thread 1's backfill, then thread 3's three).
`forced_label` is listed under `Retiring`, not `Backfilling`, in `tests/convex/schema.test.ts`.

---

### Thread 4: Denormalize

**Goal.** Put on each row what policy needs, so that any affirmation is one parallel round of
`.get`/`.first` wherever that is reasonable. All but one of these fields stay as written (a quiz
does not move between hunts),
so they cost a field and no upkeep.

| Table | Add | Copied from | Index |
|---|---|---|---|
| `quizzes` | `hunt_id` | its realm | add `by_hunt_id` |
| `widgetings` | `hunt_id` | its quiz | -- |
| `columns` | `hunt_id` | its quiz | -- |
| `widgeteds` | `hunt_id`, `quiz_id` | its question | -- |
| `reviewings` | `hunt_id`, `quiz_id`, `ident_id` | its review | -- |
| `huntings` | `ident_label`, `ident_title` | its ident | -- |

`huntings.ident_title` is the one that changes: `retitleIdent` must also patch that ident's
huntings (bounded by the hunts one ident is on; read them with `huntingsFor`).

**Steps.**

1. For each table: add the field to the row validator in `src/models/<noun>.ts` (strict); in
   `convex/schema.ts` make it optional by hand over the derived fields (the widen); add the index.
2. Every insert writes the new fields. The inserts are in `convex/writing/quiz_writing.ts`
   (`insertQuiz`, `insertLayout`, `insertWidgeted`, `upsertWidgeted`, `insertHunt`),
   `layout_actions.ts` (`addWidgeting`, `addColumn`), `review_actions.ts` (`setReviewing`,
   `peekAnswer`, via `Reviewing.blank`), `hunting_actions.ts` (`addHunting`),
   `account_actions.ts` (`newHunt`), and `convex/seeding.ts`. `Quiz.blankRow` and
   `Reviewing.blank` gain the arguments.
3. Backfills in `convex/migrations.ts`, one per table, each copying from the parent named above,
   appended to the existing `runAll` (thread 3 made it) in dependency order (quizzes before widgetings, columns,
   widgeteds; reviews before reviewings). List each field under `Backfilling` in
   `tests/convex/schema.test.ts`. Test each backfill on rows written without the field.
4. Use them: `membersOf` in `convex/reading.ts` reads label and title off the hunting instead of
   one `db.get` per member. `huntIdOf` (quiz → realm → hunt) is replaced by `quiz.hunt_id`.
   `isQuizOfHunt` in `convex/authorize.ts` becomes one `db.get`.
5. Extend `expectSound`: every denormalized field equals its source, each copy a new entry in
   `SoundnessChecks` (`tests/support/soundness.ts`). The new id fields are checked to exist
   already.
6. `notes/convex.md`: a short section, *Denormalized fields*, with the table above and the rule
   (copy at insert; immutable unless listed; the one fan-out).
7. `notes/deploy.md`: a ledger row for these backfills.

**Done when.** No policy check or membership listing reads a parent row only to learn the hunt;
`expectSound` verifies every copy; the backfills are tested.

**Leaves for later threads.** `hunt_id` everywhere (threads 5, 6).

*Orchestrator, after thread 4 (#83):* every hunt-owned table carries `hunt_id`. Until `runAll`
runs, old rows lack their copies, so thread 4's readers fall back to the parent (a list in the
progress digest); new code in threads 5 to 9 reads the copies directly. Thread 10 removes the
fallbacks.

*Orchestrator:* the `by_question_id_and_ident_id` index once listed here served thread 7's
server-side answer mask, which the Coach has since ruled out (see thread 7). Add it only if
something else wants it.

---

### Thread 5: Affirmations

**Goal.** The client sends its evidence; the server verifies all of it in one parallel round and
proceeds on verified claims. This replaces the sequential lookups in `convex/authorize.ts` and
moves the quiz lock out of the business code.

**Steps.**

1. `ActionValidators.open` in `src/models/actions.ts` becomes `affirms`: `{ ident_id, hunt_id,
   standing, realm_id, quiz_id }`. The public functions that took `open`, or a bare `hunt_id` or
   `quiz_id` to authorize by, take `affirms` (queries need only the fields relevant to them:
   publish narrower validators as needed). The browser has all of these from `hunts.open` and
   `idents.current`; `src/state/use-hunt.ts` assembles and sends them.
2. A keyed parallel await: `allKeyed` from `es-toolkit` (an object of promises to an object of
   results; it is in the installed 1.52.0).
3. `affirmForHunt(db, affirms, queries, ctx)` in `convex/authorize.ts`: in **one** `allKeyed`
   round fetch the actor's hunting on `affirms.hunt_id` (`huntingFor`), the quiz and realm when
   affirmed (`db.get`), and whatever extra `queries` the caller passes. Then compare, one guard
   per line: the actor's `ident_id` is the affirmed one; the hunting's role (or `'stranger'` when
   none) is the affirmed standing; `quiz.hunt_id` and `realm.hunt_id` are the affirmed hunt;
   `quiz.realm_id` is the affirmed realm. Any mismatch is a denial. Return claims: the verified
   affirms plus the fetched rows. Delete `isPlaced` and `isQuizOfHunt`.
*Orchestrator, after thread 2:* the lock's refusal comes from the verdict: add `quizLocked` to
`DenialkindVals`, so `mayReviseQuiz` returns it and no second check is needed. `mayReviseQuiz(quiz,
claims)` does not fit the table's `(claims, action)` row shape: either the claims carry the quiz
(`claims.quiz`, which step 3's claims already hold) and the row is a one-line adapter, or the
evidence for content and layout kinds grows. Prefer the first. `isPlaced`/`isQuizOfHunt` are still
there for step 3 to delete.

4. Rewrite each `affirm…` function on top of it, in the shape `notes/policy_approve.md` sketches
   for `affirmReadReview`: anonymous guard, one `affirmForHunt`, one call to the pure function,
   and ideally no `await` after the round.
5. **Denial in a mutation is a refusal** (`notPermitted`). **Denial in a query is the facet's
   empty value** (`null` or `[]`) rather than a throw: add a small wrapper in `convex/functions.ts`
   so query handlers do not each catch.
6. **The lock becomes policy.** Add `mayReviseQuiz(quiz, claims)` to `Approve`: a smith, and the
   quiz not locked. In the dispatch table map every action that changes a quiz's contents or
   layout to it (the actions that today go through `openQuizRow`, `reviseOpenLayout` or
   `reorderOpenQuiz` in `convex/writing/`), and leave realm, hunt, membership, library and review
   actions on their own rows. `revisable()` in `quiz_actions.ts` then checks only that the quiz
   exists. The author must still be told *why*: when a smith is denied only by the lock, the
   refusal is `quizLocked` with its sentence. Remove the comments in `convex/writing/` that
   restate lock policy.
7. Business functions in `convex/writing/` receive rows from the claims where they would
   otherwise re-fetch the quiz they are acting on.
8. Extend the matrix test with the locked dimension (locked × every kind × smith). Add tests that
   a false affirm (wrong standing, a quiz of another hunt, another's `ident_id`) is denied in a
   mutation and empty in a query.

**Done when.** Each `affirm…` function gathers its evidence in one parallel round and reads as a
flat list of guards, or its progress note says why that one could not and what it does instead;
`convex/writing/` mentions `locked` only in `setLock`; a stale or forged affirm is turned away
before business code runs.

**Leaves for later threads.** Claims on `ctx` for thread 6; `mayReviseQuiz` for thread 8.

*Orchestrator, after thread 3:* `relabelQuiz` looks up a clashing quiz by `open.realm_id`, which is
sound only because `isPlaced` has checked the quiz is of that realm. The verified `realm_id` in
the claims must keep that true when `affirmForHunt` replaces `isPlaced`.

---

### Thread 6: A scoped database handle

**Goal.** After affirmation, the `db` a handler holds can only see and write rows of the affirmed
hunt, whatever the handler asks for. This is the structural backstop: a function that forgets a
check still cannot leak another hunt.

**Steps.**

1. `/convex-docs`: `convex-helpers`' row-level security (`wrapDatabaseReader`,
   `wrapDatabaseWriter`) and custom function builders. List the module in `notes/stack.md` under
   the existing `convex-helpers` entry.
2. `convex/policy_rules.ts`: one rule per table, each a non-async function of `(claims, row)`
   that reads nothing. *Orchestrator, after thread 4:* reviewings are only read through a review
   already in hand, so the reviewings rule can be hunt-only for reads and ownership (its
   `ident_id`) for writes; it must not require ownership to read (a smith reads others' shared
   reviews). Hunt-owned tables (`realms`, `quizzes`, `questions`, `widgetings`,
   `columns`, `widgeteds`, `reviews`, `reviewings`, `huntings`): the row's `hunt_id` is the
   claims' hunt. `reviews` and `reviewings` additionally defer to `Approve.mayReadReview`.
   `hunts`: its own id. `widgets`: readable by a non-anonymous actor. `idents`, `identings` and
   the auth tables: not reachable through the scoped handle at all.
3. In `convex/functions.ts`, builders that run the affirmation and then replace `ctx.db` with the
   wrapped handle: `zHuntQuery`, `zHuntMutation`. Functions that act before any hunt is in play
   (`idents.current`, `idents.performAccount`, `hunts.list`, `hunts.open`) keep the plain
   builders and are named in a short list at the top of `convex/authorize.ts` with the reason.
4. Convert the hunt-scoped public functions. Remove the hand filter in `reviews.forQuiz`: query
   by the function's own criteria and let the rule filter. ~~Evaluate the reviewer's own review
   once, from the set already read, not once per row.~~ *Pulled forward by thread 2*:
   `affirmReadReviews` judges a quiz's whole set with one membership read; keep that property.
5. `hunts.list` reads the actor's huntings directly and needs no rule; say so in its doc block.
6. Tests: for each hunt-owned table, a handler given claims for hunt A cannot `get`, `query`,
   `patch` or `delete` a row of hunt B. Extend the public-function test: every public function
   is either built with a hunt-scoped builder or on the named exceptions list.

**Done when.** No public function outside the exceptions list holds an unscoped `db`.

*Orchestrator, after thread 5 (#86):* every `affirm…` now throws `NotApprovedError`; mutations
refuse it (`refusalFor`), queries answer empty through `emptyIfDenied` in `convex/functions.ts`.
An `input` hook that throws cannot answer a query's empty value, so `zHuntQuery` wraps the handler
in `emptyIfDenied` and calls `affirmForHunt(db, affirms, ctx.actor, queries)` (or the affirm
function) inside it, putting the claims on `ctx` before handing over the scoped `db`.
`affirmForHunt` guards the anonymous actor itself. Affirms come in three shapes (`huntAffirms`,
`quizAffirms`, `affirms`); `questions.open` takes `huntAffirms` and checks `question.hunt_id`.
`idents.performAccount` and `hunts.open` take no affirms: both belong on the exceptions list.

---

### Thread 7: Reads shaped by role

**Goal.** A reviewer is sent only what a review needs.

**The Coach's word (2026-10-04):** don't mask the answer on the database side when reading a
reviewer's question. Hiding it is more like a "no spoilers" tag than a security interdiction. So
`full_answer` is sent to a reviewer whether or not they have peeked. `AnswerLock` stays as the
browser's spoiler shield, and `peeked` stays a record of the reveal.

**What a reviewer is sent** (the rest is still a proposal; see *For the Coach*): of a question,
`_id`, `label`, `title`, `qnum`, `clueing`, `chains_to`, `hint`, `full_answer`. Not `notes`,
`alt_text`, or anything a widgeting stored. Of a quiz: its frame as today, including
`smiths_note`. `hunts.whole` (the export) is for smiths only.

**Steps.**

1. `src/models/question.ts`: beside `Question.exposed`, a list per standing of the fields that
   standing is sent. `src/lib/rows.ts`: `seenQuestionFor(row, stored, claims)` chooses the
   projection by standing alone; no reviewing is read for it.
2. `convex/questions.ts` `open`: project by the claims' standing. A reviewer's result carries no
   `stored`. (*After thread 5:* `questions.open` takes `huntAffirms`, so the standing is in its
   claims already.)
3. `src/components/ReviewScreen.tsx`: `AnswerLock` keeps hiding the answer until the reviewer
   reveals it, as now. Its doc block says it is a spoiler shield, not a security boundary.
4. `hunts.whole`: add `mayExportHunt(claims)` (smith) to `Approve` and its affirmation (a new
   read key: `EvidenceT` and `ReadPolicies`).
5. Tests: a reviewer's `questions.open` has `full_answer` (peeked or not) and has no `notes`,
   `alt_text` or `stored`; `hunts.whole` is `null` for a reviewer. An e2e pass through the review
   screen.

**Done when.** The query results a reviewer can call hold what the list above says, and no more.

---

### Thread 8: Views ask `Approve`

**Goal.** A view offers what the server would accept, and decides with the same functions the
server uses.

**Steps.**

1. `src/state/use-hunt.ts` exposes the browser's claims for the open hunt (the actor, the hunt,
   the standing, the open quiz's row).
2. Replace role tests in components and in `src/models/hunting.ts` (`Hunting.mayAct`) with
   `Approve.may(key, …)` on those claims: the lock's effect on editing affordances, the members
   panel, the library editor, the export box, the review screen's entry.
   *Orchestrator, after thread 2:* the browser builds claims with `Actor.claimsOn`. An
   affordance check by action key needs a sample action of that kind, since every action row
   takes `(claims, action)`: decide whether a view asks with a sample action or the table grows a
   kind-only entry point.
3. The dispatcher in `use-hunt.ts` checks `Approve.may` for an action before sending it, and
   treats a failure there as a programming error to report, not a notice to show.
4. Tests for each gated affordance under each standing.

*Orchestrator, after thread 5 (#86):* the browser's affirms come from `useAffirms(hunt, quiz_id)`
in `src/state/use-affirms.ts`; the claims for `mayReviseQuiz` are `Actor.QuizClaimsT` (hunt claims
plus `quiz: { locked } | null`). Affirms are watch arguments, so a change of standing or ident
re-asks the quiz's watches and shows *Opening…* for a round trip (the grid remounts). Consider
having `useQuiz` keep the last quiz on screen while the new affirms' answers arrive.

**Done when.** `grep -rn "role ===" src/components src/state` finds nothing that decides
permission.

---

### Thread 9: The library behind an admin helper

**Goal.** Changing the shared library is an admin act, on a mutation of its own, decided by one
helper. For now the helper approves every actor; who is really an admin is a later decision, and
when it is made only the helper changes.

**Steps.**

1. `Actor.isAdmin(actor)` in `src/lib/actor.ts`: returns true, with a doc block saying this is
   the one place admin standing is decided and that it approves everyone until that is settled.
2. `Approve.mayChangeLibrary(actor)`: the actor has a username, and `Actor.isAdmin`.
   `mayCountUsage` becomes the same rule.
3. Move the library action kinds (thread 2's `LibraryPolicies` block, and `count_usage`'s
   evidence with it) out of `huntAction` into a `libraryAction` union and a
   `widgets.perform` mutation, so an admin act no longer rides a hunt's mutation or needs a quiz
   on screen.
4. The library editor (`LibraryModal`, `WidgetEditor`, `src/state/widget-edit.ts`) dispatches to
   the new mutation, and asks `Approve.may` before showing its write affordances.
5. Matrix rows and tests for the new mutation, including one that stubs `Actor.isAdmin` false and
   sees the write refused and the affordances gone.

**Done when.** No library write goes through `hunts.perform`; the only place that knows who is
an admin is `Actor.isAdmin`.

---

### Thread 10: Tighten

Merging this one waits on the Coach running the backfills of threads 3 and 4 on production; say
so at the top of the PR.

**Steps.** For each field thread 4 added, and for `idents.user_id` (thread 1's widen): make it
required in `convex/schema.ts` (remove the hand-written optional). For `forced_label`, which thread 3 left optional on three tables: remove
it from the schema (`retiringForcedLabel`), and the two lines in `relabelHunt` and `relabelQuiz`
that clear a lingering one (the compiler will point at them). Remove thread 4's fallbacks for rows
without their copies (`huntIdOf` becomes `quiz.hunt_id`; `huntIdOfLayoutRow` and
`reviewingCopiesOf` become the row's fields; `membersOf`'s ident read; the four update helpers'
fills); the full list is thread 4's section in `dbpolicy-done-1-4.md`. Drop the backfills from
`convex/migrations.ts` and from `runAll`, empty `Backfilling` and `Retiring` in
`tests/convex/schema.test.ts`, and complete the ledger rows in `notes/deploy.md` with the commit
that still holds each backfill.

## For the Coach

1. **Production environment for Convex Auth** (thread 1): `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`
   on the production deployment, through Doppler; and `identings` cleared by hand before thread
   1 deploys.
2. **Existing usernames** (thread 1): idents made before this sprint are unclaimed, and the first
   session to assert one claims it. That is how today's users get theirs back, and also how
   someone else could get there first.
3. **More than one username per session** (thread 1): as planned, a session that asserts a second
   unclaimed username holds both and is the newest. Say if a session should hold one only.
4. **The admin helper approves everyone** (thread 9). Until it is given a real rule, anyone with a
   username may change the library, where today it takes a smith of the hunt on screen.
5. **What a reviewer is sent** (thread 7): settled for the answer (sent, shielded only in the
   view: the Coach, 2026-10-04); the rest of the list under that thread is still a proposal.
6. **Backfills between merges.** Thread 3's (`forced_label` into `label`) wants running straight
   after thread 3 deploys: until it has, a relabelled hunt or quiz answers to its minted label
   again. Thread 4's wants running before threads 5 to 9 deploy.
   *Orchestrator, after thread 3:* `migrations:runAll` runs every backfill in order. Run it
   straight after each deploy that brings one: until then, besides answering to old labels, a
   new hunt or quiz label could take one an unmigrated override holds.
7. **Import's `forced_label` key** (thread 3): import still prefers a pasted `forced_label`, but
   the label is no longer reserved for widgetings; a widgeting labelled `forced_label` would be
   read both ways on re-import. Unlikely. Thread 10 can drop the key from import, or reserve the
   label again: say which.
