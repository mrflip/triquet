# Sprint `dbpolicy`: progress

The running handoff. Newer than `dbpolicy-plan.md` wherever they disagree. Each thread updates
its row below and adds its section above the others, newest first.

## Status

| # | Thread | Status | Branch | PR |
|---|---|---|---|---|
| 1 | Sessions and the actor | complete, reviewed (1 fix) | `20261004-dbpolicy_sessions` | #79 |
| 2 | `Approve`: pure policy and the dispatcher | complete, reviewed (clean) | `20261004-dbpolicy_approve` | #81 |
| 3 | One label, and integrity repairs | complete | `20261004-dbpolicy_one_label` | #82 |
| 4 | Denormalize | pending | | |
| 5 | Affirmations | pending | | |
| 6 | A scoped database handle | pending | | |
| 7 | Reads shaped by role | pending | | |
| 8 | Views ask `Approve` | pending | | |
| 9 | The library behind an admin helper | pending | | |
| 10 | Tighten | pending (merge waits on production backfills) | | |

## Thread 3: One label, and integrity repairs (2026-10-04)

Branch `20261004-dbpolicy_one_label`, PR #82, stacked on #81. Suites: typecheck, lint,
`pnpm test` (110 files, 2868), `pnpm test:e2e` (207) all green.

* **Built**:
  - **One label.** `forced_label` is gone from the row validators, trees and classes of hunts,
    quizzes and questions, from `rows.ts`, `exporting.ts`, `runner.ts` and
    `ReservedWidgetingLabels`; `Labelmaker.effectiveLabelOf` is gone and `Labelled` is
    `{ label }`. `relabelHunt`/`relabelQuiz` patch `label`. `huntForLabel` is one read of
    `by_label`; `by_forced_label` is dropped. Import (`models/import.ts`, `lib/importing.ts`) still
    reads a pasted `forced_label` and prefers it, for quizzes and questions alike; export no
    longer emits it.
  - **The widen.** `convex/schema.ts` lets the three tables still hold `forced_label` (string or
    null, optional, written by hand: `retiringForcedLabel`). `convex/migrations.ts`:
    `retireHuntForcedLabels`, `retireQuizForcedLabels`, `retireQuestionForcedLabels` (each folds
    a set override into `label` through the row validator and patches `forced_label: undefined`;
    a row without the field is left alone), and `runAll`, a series of every backfill defined
    (thread 1's `backfillIdentClaims`, then these three). Tested in
    `tests/convex/migrations.test.ts` on rows with the override set, null and absent, run twice,
    and through `runAll`.
  - **Quiz labels unique in a realm, on the server.** Index `quizzes.by_realm_id_and_label`,
    `quizForLabel(db, realm_id, label)` in `reading.ts`; `relabelQuiz` refuses `labelTaken` when
    another quiz holds the label. Tests: clash, own current label (no write), a label another
    hunt's quiz holds (allowed).
  - **`deleteQuiz(db, quiz_id)`** deletes every question, widgeting (through `deleteWidgeting`),
    column and review its quiz's indexes find, each with `for await`. `deleteQuizFrom` reads only
    the quiz row; `deleteHunt` passes ids. Tested with a question absent from `row_ordering`.
  - **`expectSound(tt)`** in `tests/support/soundness.ts` (with `faultsIn`, `heldIn`, and
    `SoundnessChecks`, a list of `{ title, faultsOf(held) }`), tested in
    `tests/support/soundness.test.ts` by breaking a deployment each way. Called at the end of the
    delete-quiz, delete-hunt, delete-questions and delete-widgeting tests and the `runAll` test.
    `eslint.config.mjs` names it an assertion function; `notes/testing.md` describes it.
  - Docs: `notes/vocabulary.md` (*label* now says one label; *forced_label*/*effective label*
    retired), `notes/deploy.md` ledger row.
* **Decisions taken**:
  - **`newQuiz` keeps its siblings check** (now by `.label`): it already reads the realm's
    quizzes for the cap and `freshLabelFor`, so the index would be one more read for nothing.
  - **`relabelQuiz` reads the holder by `open.realm_id`, in parallel with the quiz**, which is
    sound because `isPlaced` has checked the quiz is of that realm. **Thread 5:** when `isPlaced`
    gives way to `affirmForHunt`, the verified `realm_id` keeps that true.
  - **The id check is by field name.** Any field ending `_id` must name a row of the table
    `TableForIdField` gives (`hunt_id` → `hunts`, `user_id` → `users`, ...); a null is let be (an
    unclaimed ident); an `_id` field with no entry there is itself a fault. **Thread 4:** the
    `hunt_id`, `quiz_id`, `ident_id` you add are checked for existence already; add a check per
    copy (equals its source) as new entries in `SoundnessChecks`, and an entry in
    `TableForIdField` only for a new kind of id. Convex Auth's tables are not walked; `users` is
    read so `user_id` resolves.
  - **`expectSound` is not called after the bare `deleteWidgeting` helper**: it leaves the
    widgeting's columns to its caller by contract (`layout_actions` removes them, and that
    action's test does call it).
  - `deleteQuiz` deletes widgetings, columns and reviews by index too, not only questions.
* **Deviations**:
  - **`Retiring`, not `Backfilling`.** The plan says list `forced_label` under `Backfilling` in
    `tests/convex/schema.test.ts`, but that list is for fields the row validator writes and old
    rows lack; a field the schema still holds and no validator writes is what `Retiring` is for
    (as `bulk_ishes_last` was). **Thread 10:** empty `Retiring` as well as `Backfilling`, drop
    `retiringForcedLabel` from `schema.ts`, and drop the three migrations from `runAll`.
  - **`expectSound` lives in `tests/support/soundness.ts`**, not `tests/support/convex.ts`, so its
    checks have a file and a test of their own. It runs under the node project (convex-test does
    fine there for it).
  - **`runAll` pulled forward from thread 4 step 3.** Thread 4: append your six backfills to it
    in dependency order rather than creating it.
* **Discoveries**:
  - `notes/examples/` is gitignored: its exports were updated (`forced_label` lines gone; the one
    set override, `yummyostrich`, became that quiz's label) in this checkout only.
  - `ReservedWidgetingLabels` no longer reserves `forced_label` (as the plan asked), while import
    still reads that key off a pasted question. A widgeting now labelled `forced_label`, in an
    export pasted back, would be read both as the question's label and as that entry's value.
    Unlikely; the tighten (thread 10) may want to drop import's reading of it, or reserve it again.
  - `convex/_generated/` did not change: the API types derive from the modules, and an index is
    not in them. The agent backend took the push (index dropped and added) without a reset.
  - Tests that asserted an override (a hunt titled after it, `placeOf` preferring it,
    `freshLabelFor` avoiding it, `placeIn` missing a replaced label) are gone or now assert plain
    labels.
* **For the Coach**: run the backfill straight after this deploys (`notes/deploy.md` ledger):
  until it has, a hunt or quiz relabelled before answers only to the label it was made with.

## Thread 2: `Approve`: pure policy and the dispatcher (2026-10-04)

Branch `20261004-dbpolicy_approve`, PR #81, stacked on #79. Suites: typecheck, lint, `pnpm test`
(109 files, 2852), `pnpm test:e2e` (207) all green.

*Review:* `clean`, at medium; no fixes. Every decision matched the old rules apart from the
recorded changes (own review needs membership; an anonymous `retitle_ident` or `new_hunt` is
`notIdentified`). Left, minor: the own-role no-op (the worker's deviation, with the Coach); and
`Approve.every` and `ApproveValidators` now have no caller outside their test (the review deleted
them, then undid it because the plan said keep `every`; revisit once threads 5 and 6 settle
whether verdicts combine; `notes/policy_approve.md:152` uses it as its "BAD" example).

* **Built**:
  - `src/lib/approve.ts` (was `approval.ts`): one non-async `may…` per rule, each a doc-block list
    of rules and one guard per line beside its rule. A policy returns a **verdict**: `Allow`
    (`'allow'`) or a `Denialkind` (`notIdentified`, `notPermitted`, `ownHunting`, `botsOff`), each a
    `Refusalkind`, so its sentence is `RefusalNotices[...]`. `Approve.may` (boolean), `must`
    (throws `NotApprovedError`, which now carries `.denial`), `verdictOn` (the verdict), `every`
    (kept), `PolicyKeys`.
  - **The dispatch table**: groups `LayoutPolicies`, `LibraryPolicies`, `ContentPolicies`,
    `RealmPolicies`, `ReviewPolicies`, `HuntPolicies`, `AccountPolicies` (together
    `ActionPolicies`), and `ReadPolicies` (`read_hunt`, `read_review`, `read_library`,
    `count_usage`, `ask_anthropic_bot`). `EvidenceT` says what each key is handed; every action
    key takes `(claims, action: ActionT)` (the actor alone for `assume_ident`, `retitle_ident`,
    `new_hunt`), and each row is typed to take its own kind's action, so a missing row or a policy
    that cannot take that kind fails to compile. `verdictOn` throws for an unknown key, or an
    action handed under another kind's key (which is what makes its one type assertion sound).
    Account `retitle_hunt`/`relabel_hunt` share the hunt action's row.
  - `src/lib/actor.ts`: `HuntStandingVals`, `HuntClaimsT` (`ActorT & { hunt_id, standing }`),
    `MemberClaimsT`, `IdentRefT`, `claimsOn(actor, hunt_id, hunting)`, `isSmith`, `isReviewer`,
    `isMember` (a type guard), `roleOf` (throws for a stranger), `isOneself` (by id or label).
  - `src/models/review.ts`: class `Review` with `isShared`, `isHidden`, `isActiveOwner`, `ownOf`.
  - `convex/authorize.ts`: `claimsFor(db, hunt_id, actor)`, `affirmReadHunt`, `affirmReadReviews`,
    `affirmCountUsage`, `affirmPerform`, `affirmAccountAction`. The last two return a verdict; the
    mutations do `if (verdict !== Approve.Allow) { refuse(verdict) }`. `isPlaced`/`isQuizOfHunt`
    stay (plain guards now) for thread 5 to replace.
  - Tests: `tests/lib/approve.test.ts` (a case per guard; **the matrix**, keyed by kind with
    `satisfies` so a kind missing there fails to compile; dispatcher errors; `must`'s story and
    backstory); `tests/convex/authorize.test.ts` (each `affirm…`; `hunts.perform` as each standing,
    and with no session, agreeing with `Approve.verdictOn`); actor and review predicate suites.
* **Decisions taken**:
  - **Verdicts, not booleans**, so the `ownHunting` sentence (and thread 5's `quizLocked`) comes
    from the one decision rather than a second test. Thread 5: add `quizLocked` to
    `DenialkindVals`.
  - **Reads return booleans, writes verdicts**, from the `affirm…` functions: a query's denial is
    its empty value and needs no reason.
  - The library read asks `Approve.may('read_library', ctx.actor)` straight from `widgets.ts`:
    there is no evidence to gather.
  - `hunts.perform` keeps its `isAnonymous` guard: the policy says `notIdentified` too, but the
    guard narrows `actor` for `performAction`.
* **Deviations**:
  - `mayAskAnthropicBot(switchval)`, not `()`: the route reads `process.env` and hands the value
    in, so `approve.ts` reads no environment and has no `window` guard. The ask route's
    `moreinfo` backstory is dropped.
  - `mayChangeMembership(claims, target: IdentRefT)`, not `target_ident_id`: `add_hunting` names
    the member by label, and comparing labels costs no read. Consequence: a smith asking for the
    role they already hold is refused `ownHunting` (it was a silent no-op). Test changed.
  - `affirmReadReviews(db, reviews, actor)` over a quiz's set, not `affirmReadReview` per row: one
    hunting read for the lot, own review found in the set. **Pulled forward from thread 6 step 4**
    (evaluating the reader's own review once); thread 6 still owns the scoped handle and dropping
    the hand filter.
  - No `affirmChangeHunt`: nothing outside `authorize` called `mayChangeHunt`. Added
    `affirmCountUsage` and `claimsFor`.
  - Policies the plan's list did not name, for the account actions: `mayAssertUsername`,
    `mayRetitleIdent`, `mayMakeHunt`. `retitleIdent`/`newHunt` keep their own anonymous guards
    (type narrowing), now unreachable through `performAccount`.
  - `mayWriteReview` delegates to `mayReadHunt` (sonarjs refused two identical bodies).
  - `isReviewAction`, `ReviewActionT`, `ReviewActionKindVals` and the `TODO dbpolicy` are gone;
    `ApprovalNotices` became `RefusalNotices.botsOff`.
* **Discoveries**:
  - **`unicorn/prefer-combined-guards` contradicts `notes/policy_approve.md`.** Disabled with a
    reason file-wide in `approve.ts`, in a block in `Review.isActiveOwner`, and on one line of
    `affirmPerform`. Threads 5 and 6: expect it on every guard list.
  - `Approve.verdictOn(action.kind, claims, action)` type-checks for a union-typed action because
    every action key's evidence tuple uses the wide `ActionT`; the narrow types live in the rows.
  - **Thread 5**: `mayReviseQuiz(quiz, claims)` does not fit the `(claims, action)` row as is;
    either the claims carry the quiz (`claims.quiz`) and the row is a one-line adapter, or the
    evidence tuple for content/layout kinds grows. Thread 7: `mayExportHunt` is a new read key
    (`EvidenceT` and `ReadPolicies`). Thread 8: the browser builds claims with `Actor.claimsOn`,
    and an affordance check for an action key needs a sample action of that kind. Thread 9:
    `LibraryPolicies` is the block to move; `count_usage`'s evidence changes with it.
* **For the Coach**: (also in `HUMAN-whatsup.md`) whether to switch `prefer-combined-guards` off
  for policy code in `eslint.config.mjs`; whether the own-role no-op should come back.

## Thread 1: Sessions and the actor (2026-10-04)

*Orchestrator:* the worker that built this thread was interrupted during its wrap-up; a second
worker checked the *Done when*, committed the syndication below, ran the full suite, pushed, and
filed #79. Nothing was rebuilt. Separately, the Coach ruled on 2026-10-04 that a reviewer is sent
`full_answer` (the view's `AnswerLock` is a spoiler shield, not security); the plan's threads 4
and 7 now say so.

*Review:* `fixed`, at medium. Kept `b01892c`: a failed anonymous sign-in in `use-session.ts` is
retried every 3 seconds by the hook that started it, rather than leaving the visitor at the gate.
Left, minor: if that component unmounts before the retry fires, other screens wait for the next
mount; no backoff, and each failed retry logs; `use-session.ts` has no unit test of its own (the
e2e suite exercises it through the username gate).

Branch `20261004-dbpolicy_sessions`, PR #79, against `main` (carries the five planning commits of
`20261003-dbpolicy_a` beneath it; no PR beneath). Suites: typecheck, lint, `pnpm test` (109 files,
2740 tests), `pnpm test:e2e` (207) all green.

* **Built**:
  - Convex Auth, Anonymous only: `convex/auth.ts`, `convex/auth.config.ts`, `convex/http.ts`,
    `authTables` spread into `convex/schema.ts`; the three variables declared in
    `convex/convex.config.ts`. `scripts/convex_auth_keys <role>` mints throwaway keys (Node's
    `crypto`, RS256, the shape Convex Auth's manual setup prints) and sets them through a 0600
    temp file and `convex env set --from-file`; `scripts/convex_dev` calls it after the
    `TRIQUET_CLEARABLE` line. Does nothing when `JWKS` is set.
  - `src/lib/actor.ts`: `ActorT` (`AnonymousActorT | IdentActorT`), `Actor.anonymous` (frozen),
    `Actor.asIdent(user_id, ident)`, `Actor.isAnonymous`. A namespace of pure functions: thread 2
    adds `standing` and the predicates beside these.
  - `convex/functions.ts`: `askerOf(ctx)` is the one read path (token → `getAuthUserId` +
    `getAuthSessionId` → in parallel, the `authSessions` row and `identFor(db, user_id)`), and
    `zQuery`/`zMutation` put its result on `ctx` as `ctx.actor` and `ctx.user_id`.
    **Threads 5 and 6:** build `zHuntQuery`/`zHuntMutation` with `zCustomQuery(query, { args,
    input: async (ctx, args) => { const asker = await askerOf(ctx); ... } })`, not by reading
    identity again. `zInternalMutation` has no asker.
  - Every public function drops `browser_key`; `convex/authorize.ts` rules take `actor: ActorT`
    (`roleOn`, `mayReadHunt`, `mayChangeHunt`, `mayReadReview`, `mayWriteReview`,
    `mayReadLibrary`, `mayCountUsage`, `mayPerform`, `mayActOnAccount`). `mayReadReview` now
    guards `Actor.isAnonymous` first, closing the null-equals-null shape `policy_approve.md` warns
    of. `writing/perform` still receives `ident_id`; `hunting_actions`' `acting_id` is
    `acting_ident_id`; `use-hunt`'s `role: acting` is `role`.
  - Usernames held: `idents.user_id` (row validator `zid('users').nullable()`, schema optional by
    hand: the widen), backfill `migrations:backfillIdentClaims` (tested in
    `tests/convex/migrations.test.ts`), `Backfilling: { idents: ['user_id'] }`. `identings` is
    `{ user_id, ident_id }`, index `by_user_id`. `assumeIdent` claims through `claimFor`: own →
    take on; unclaimed (null or absent) → claim; another's → `usernameClaimed`. New refusals
    `notSignedIn`, `usernameClaimed` in `src/lib/notices.ts`.
  - Browser: `ConvexAuthProvider` in `src/app/providers.tsx`; `src/state/use-session.ts` signs in
    anonymously once per page (module-level single flight) and returns `{ ready }`; every hook in
    `src/state/` skips until ready. `useAccountActions` signs out on a `notSignedIn` refusal, so
    the next try has a fresh session. `src/state/browser-key.ts` and its test are gone.
  - Tests: `tests/support/convex.ts` has `signedIn(tt)` (a `users` + `authSessions` row and
    `tt.withIdentity({ subject: 'user|session' })`), `identified(tt, label)` → `{ as, user_id,
    ident_id, label, actor }`, `callerOf(by)`, and `seedHunt`'s `act(action, by)` taking a
    `Session` or the bare `tt` (no session). **For threads 2 and 5's matrix:** smith =
    `seeded.smith`, reviewer = `await join(label, 'reviewer')`, stranger = `await identified(tt,
    label)`, anonymous-with-session = `await signedIn(tt)`, no session = `tt`; each `Identified`
    carries `.actor` for calling a rule directly. New: `tests/lib/actor.test.ts`,
    `tests/convex/functions.test.ts` (`askerOf`, including a token whose session is gone).
  - e2e: `e2e/routing.spec.ts` › *turns a second browser away from a username the first holds…*
    No spec planted `triquet.browser_key`, so nothing else changed.
* **Decisions taken**:
  - **Step 1, confirmed**: manual setup is `auth.config.ts` (`domain: CONVEX_SITE_URL`,
    `applicationID: 'convex'`), `convexAuth({ providers })`, `auth.addHttpRoutes(http)`,
    `authTables`; env `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`. `getAuthUserId` only splits the
    token's `subject` (`userId|sessionId`) and never reads the database. The React side is
    `ConvexAuthProvider` (tokens in `localStorage`, namespaced by the deployment URL, so each
    browser context is its own session), `useAuthActions().signIn('anonymous')`, and `useConvexAuth()`.
    convex-test supplies identity with `tt.withIdentity({ subject })`. `@convex-dev/auth` 0.0.96 and
    `@auth/core` 0.41.1, both exact (0.41.1 is what the setup page installs).
  - **Step 5, proved**: on the `agent` backend a Node script signed in anonymously through
    `auth:signIn`, and a query then saw `getAuthUserId` and `getAuthSessionId` non-null; a
    tampered token was refused (*Could not verify OIDC token claim*). The local backend's
    `CONVEX_SITE_URL` defaults to `http://127.0.0.1:35xx`, so it fetches its own JWKS with no
    extra flags.
  - **The actor needs the session to exist**, not just a valid token: `askerOf` reads the
    `authSessions` row (in parallel with the identing, so no extra round). Without it a token
    outliving its session (signed out, or a backend emptied by `convex_reset`) would write
    identings for a dead user and strand the username it claimed.
  - **`ctx.user_id` beside `ctx.actor`**: `assume_ident` needs the session's user while the actor
    is still anonymous, and the plan's anonymous actor carries no id. `user_id` is null only for
    a request with no session (a lookup that found nothing). `retitleIdent` and `newHunt` take the
    actor rather than `user_id` (they act on its ident).
  - **Sessions last ten years, or a year unvisited** (`convex/auth.ts`), not Convex Auth's thirty
    days total: an anonymous session that ends strands its username. See *For the Coach*.
  - **`identified(tt, label)` returns the session already holding `label`** in that tester, so
    two hunts seeded with one smith label share a smith, as before. A test of a second session
    asserting a held username uses `signedIn`.
  - The browser is not told `user_id` (`IdentT` is `{ _id, label, title }`).
* **Deviations**:
  - `scripts/convex_auth_keys` generates the pair with Node's built-in `crypto` rather than
    `jose`: `jose` is only a transitive dependency under pnpm, and the output matches the manual
    setup's byte for byte in shape.
  - `IdentGate` needed no new state: it already showed the refusal's sentence in place and let the
    visitor try again; only its blurb changed.
  - `CLAUDE.md`'s *Architecture* still says `src/state/` holds "the browser key"; agents may not
    edit `CLAUDE.md` on an agent's word, so it is left for the Coach (it should say "the session
    (`use-session`)").
* **Discoveries**:
  - The planning branch's `convex/authorize.ts` imported `@/lib/approval.js`; the convex-test
    project cannot resolve the alias, so every Convex test failed. Now a relative import.
  - `convex.config.ts`'s declared `env` does not hide undeclared variables from `process.env`;
    Convex Auth reads them there. They are declared anyway, for the record.
  - Each anonymous `signIn` makes a `users` row, and `auth:signIn` is public: anyone with the URL
    can mint users. Not new in kind (anyone could mint idents), but a rate limit belongs on the
    *Later* list now.
  - `ownHunting`'s check and `retitleIdent`'s re-read of the ident are where they were; thread 2
    moves the former.
* **For the Coach**: (also in `HUMAN-whatsup.md`)
  - Production and preview deployments need `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL` before this
    deploys; `identings` cleared by hand; then `migrations:backfillIdentClaims`
    (`notes/deploy.md`, *Sessions*).
  - **Thread 10 should tighten `idents.user_id`** too (drop the schema's hand-written optional,
    the backfill, and `Backfilling`), which the plan's thread 10 list does not name.
  - Session lifetime (ten years / a year unvisited): confirm, or choose another.
  - Clearing a browser's site data now loses its username for good, until sign-in exists.
