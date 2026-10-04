# Sprint `dbpolicy`: progress

The running handoff. Newer than `dbpolicy-plan.md` wherever they disagree. Each thread updates
its row below and adds its section above the others, newest first.

## Status

| # | Thread | Status | Branch | PR |
|---|---|---|---|---|
| 1 | Sessions and the actor | complete, reviewed (1 fix) | `20261004-dbpolicy_sessions` | #79 |
| 2 | `Approve`: pure policy and the dispatcher | complete, reviewed (clean) | `20261004-dbpolicy_approve` | #81 |
| 3 | One label, and integrity repairs | complete, reviewed (1 fix) | `20261004-dbpolicy_one_label` | #82 |
| 4 | Denormalize | complete, reviewed (clean) | `20261004-dbpolicy_denormalize` | #83 |
| 5 | Affirmations | complete, reviewed (clean) | `20261004-dbpolicy_affirm` | #86 |
| 6 | A scoped database handle | complete | `20261004-dbpolicy_scoped_db` | #88 |
| 7 | Reads shaped by role | pending | | |
| 8 | Views ask `Approve` | pending | | |
| 9 | The library behind an admin helper | pending | | |
| 10 | Tighten | pending (merge waits on production backfills) | | |


## Thread 6: A scoped database handle (2026-10-04)

Branch `20261004-dbpolicy_scoped_db`, PR #88, stacked on #86. Suites: typecheck, lint, `pnpm test` (111 files, 2951), `pnpm test:e2e` (207) all green, first run.

* **Built**:
  - **`convex/policy_rules.ts`**: one rule per table, `{ read, modify, insert }`, each a non-async
    `(claims, row) => boolean` that reads nothing, adapted to convex-helpers' `Rules` once
    (`asHelperRules`), `defaultPolicy: 'deny'`. `WritingRules` (mutations) and `ReadingRules`
    (queries, which differ only in `reviews.read`). `scopedReader(db, claims)`,
    `scopedWriter(db, claims)`. Claims type `ScopeClaimsT` = `ClaimsOf<HuntAffirmsT>` plus an
    optional `own_review`.
    - `hunts`: own id for read and modify; never insert.
    - realms, quizzes, questions, widgetings, columns, widgeteds, huntings: `row.hunt_id ===
      claims.hunt_id` for all three.
    - `reviews`: query read is `Approve.may('read_review', review, claims, own)`, where `own` is
      `claims.own_review` when it is of the review's quiz and null otherwise. Mutation read is
      hunt-only, so caps count and cascades delete every review. Write (modify and insert):
      hunt, then one's own, then a smith.
    - `reviewings`: hunt-only read; write as reviews.
    - `widgets`: read `read_library`; write `change_library`, a new `Approve` key (a `RowPolicies`
      group, `mayChangeHunt` today) that thread 9 re-points.
    - `idents`: read always, never written. identings and the auth tables have no rule, so they are
      unreachable.
  - **Builders** in `convex/functions.ts`: `zHuntQuery({ args, empty, affirm, handler })` and
    `zHuntMutation({ args, returns, affirm, handler })`. Each wraps `zQuery`/`zMutation`. It runs
    `affirm(ctx, args)` on the plain db inside `emptyIfDenied(empty)` (queries) or
    `refusingInvalid` (mutations). Then `handler({ ...ctx, db: scoped, claims, census? }, args)`.
    Context types: `HuntQueryCtx<CT>`, `HuntMutationCtx<CT>` (adds `census`), `AskingQueryCtx`,
    `AskingMutationCtx`. `isHuntScoped(fn)` reads a `WeakSet` of what the builders made.
  - **Converted**: `hunts.whole`, `hunts.perform`, `quizzes.open`, `questions.open`,
    `reviews.forQuiz` (hand filter gone: `reviewsOf(ctx.db, quiz_id)` through the reading rules).
    `affirmReadReviews` now returns `ReviewClaimsT` (quiz claims plus `own_review`). It reads the
    own review by `reviewFor` in the same round, so there is still one membership read, plus one
    `.first()`.
  - **`Unscoped`** at the top of `convex/authorize.ts`: `module:name` to reason. It lists auth's
    three, `idents:current`, `idents:performAccount`, `hunts:list`, `hunts:open`,
    `widgets:library`, `widgets:usage`. `hunts.list`'s doc block says it needs no rule.
  - **Census**: `CensusT`/`censusOf(db)` in `convex/reading.ts` (`huntIdForLabel`, `isWorked`),
    answering with an id or a boolean. `perform(db, census, claims, action)`,
    `relabelHunt(db, census, hunt_id, label)`, `performLibrary(db, census, action)`,
    `deleteWidget(db, census, label)`. `performAccount` passes `censusOf(db)` from its plain db.
  - **Tests**:
    - `tests/convex/policy_rules.test.ts`: per hunt-owned table and `hunts`, a smith's scoped
      writer on hunt A cannot `get`, list, `patch`, `delete` or `insert` hunt B's row, and can
      do all of it to its own.
    - Same file: identings and auth unreachable; idents read-only; widgets by standing; reviews'
      write rule and read rules (mutation vs query); `delete_quiz` (with another reviewer's draft
      review and reviewing) and `delete_hunt` through `hunts.perform`, the other hunt unchanged,
      `expectSound`; the rule tables' shape.
    - Public-function test: scoped list, and the rest equal to `Unscoped`'s keys.
    - `censusOf`, and `change_library` agreeing with the library actions' matrix row.
    - `affirmReadReviews`'s tests now read through `scopedReader`.
    - Raw test inserts given their copies (hunts, questions, quizzes tests).
  - Docs: `notes/convex.md` (*Who is asking*), `notes/vocabulary.md` (*scoped database*,
    *census*), `notes/queries_hooks_and_subscriptions.md`, `notes/stack.md` (`rowLevelSecurity`
    under `convex-helpers`).
* **Decisions taken**:
  - **The builders wrap the handler rather than use the `input` hook.** convex-helpers runs
    `input` before the function's Zod args are parsed, and sees only its own Convex-validated
    args. An `input` that throws cannot answer a query's empty value either. `affirm` is a field
    of the definition, so each function says which `affirm…` it rests on.
  - **Idents are readable, never writable, through the scoped database** (the plan said
    unreachable). `add_hunting` finds its member by label (`identForLabel`), and `reviews.forQuiz`
    shows each reviewer's label and title. An ident is a public persona; `user_id` is on the row,
    but nothing scoped returns a row whole.
  - **Two rule sets, differing only for reviews.** A mutation reads reviews to count them
    (`openReview`'s cap) and to delete them (cascades). Hiding drafts from it would undercount and
    orphan rows. A query shows what it reads, so it filters by `mayReadReview`.
  - **Reviews and reviewings are written by their writer or a smith.** convex-helpers' `modify`
    covers patch and delete alike, and a smith's cascades delete others' reviewings.
  - **The widgets rule asks `Approve` by a new key, `change_library`**, rather than an action
    kind, since the rule has no action in hand.
  - A rule violation throws convex-helpers' plain `Error` (*no read access or doc does not
    exist*, *write access not allowed*, *insert access not allowed*), which is not a refusal. It
    should only ever fire on a bug.
* **Deviations**:
  - **The census** is not in the plan. Two writes in `hunts.perform` must see every hunt:
    `relabelHunt`'s label clash and `deleteWidget`'s `isWorked`. Through the scoped database,
    another hunt's label or widgetings read as absent, a silent integrity hole. They ask the
    census, built from the plain db by `zHuntMutation`. When thread 9 moves library actions to
    `widgets.perform`, `deleteWidget` goes with it and passes `censusOf(ctx.db)` (or keeps the
    census) on whatever builder that is.
  - Reviewings do not defer to `mayReadReview` (the plan's step 2): a rule reads nothing, and a
    reviewing does not carry its review's phase. They are seen only through a review in hand
    (thread 4's finding).
* **Discoveries**:
  - **Cost, by inspection.** Not measured on a backend: convex-test has no read counts, and
    local backends give no per-function usage. convex-helpers' wrapper filters each row in JS
    over the same index ranges, so there are no extra document reads where ranges are per hunt
    (all of ours). Its `.take(n)` iterates until `n` rows pass. A write's `get` comes before the
    write, which Convex caches. The one added read is `reviews.forQuiz`'s own-review `.first()`.
    The census keeps the cross-hunt index reads as cheap as before. A scan through the scoped
    `isWorked` would have read every hunt's widgetings of that label.
  - **The wrapper did not fight the Zod builders or convex-test**, once the builder wrapped the
    handler. One cast is needed: `zHuntMutation`'s inner handler returns `never`, because
    `ReturnValueInput<RV>` does not resolve for a generic `RV`.
  - **A patch or replace is judged by the row as it stands**, not as it would become. A patch
    could move a row's `hunt_id` to another hunt. Nothing writes a copy after insert, so it is
    left as is.
  - **Rows without their copies are invisible to a scoped database.** Five tests' raw inserts
    lacked `hunt_id`/`quiz_id` and failed until given them. `runAll` must have run before this
    deploys (already the ledger's rule).
  - **For thread 7:** `ctx.claims.standing` is on every hunt query's context. `questions.open`'s
    handler is where to project.
  - **For thread 9:** add `'widgets:perform'` to `Unscoped` (or give it a library-scoped builder).
    Re-point `change_library` in `RowPolicies` to `mayChangeLibrary`, with `LibraryPolicies`
    beside it. `deleteWidget` takes a census.
* **For the Coach**: idents are reachable (read-only) through a hunt's scoped database, against the
  plan's step 2; say if you would rather copy reviewer label and title onto reviews (a schema
  widen) and resolve `add_hunting`'s member some narrower way.

## Thread 5: Affirmations (2026-10-04)

Branch `20261004-dbpolicy_affirm`, PR #86, stacked on #83. Suites: typecheck, lint, `pnpm test` (110 files, 2930), `pnpm test:e2e` (207) all green; the first full e2e run lost 5 `widgets.spec` tests to the local backend's 1 s function timeout under load, which passed alone and on a clean rerun.

*Review:* `clean`, at medium; no fixes. Checked that the affirm guards cover all `isPlaced` and
`isQuizOfHunt` did, and that `QuizRevisionKindVals` covers every action the lock used to gate.
Left, minor: for an anonymous actor `affirmForHunt` refuses before the round, so reads already
started in `queries` go unawaited (at most a Convex warning); and a quiz not yet backfilled is
denied as another hunt's (settled: `runAll` runs before threads 5 to 9 deploy).

* **Built**:
  - **Affirms.** `ActionValidators.open` is gone; `huntAffirms` (`{ ident_id, hunt_id, standing }`),
    `quizAffirms` (+ `quiz_id`) and `affirms` (+ `realm_id`) replace it in `src/models/actions.ts`
    (types `HuntAffirmsT`/`QuizAffirmsT`/`AffirmsT`, and `…DNA` for the browser). Who takes what:
    `hunts.perform` `{ affirms, action }`; `hunts.whole` `{ affirms: huntAffirms }`;
    `quizzes.open` and `reviews.forQuiz` `{ affirms: quizAffirms }`; `questions.open`
    `{ question_id, affirms: huntAffirms }`.
  - **`affirmForHunt(db, affirms, actor, queries)`** in `convex/authorize.ts`: an anonymous guard,
    then one `EST.allKeyed` round (the actor's hunting, the quiz and realm when their ids are
    affirmed, and the caller's `queries`, nested in the same round), then one guard per line:
    ident, standing, quiz's hunt, quiz's realm, realm's hunt. A quiz or realm that is gone passes
    (the write refuses `quizGone`, as before). Returns `ClaimsOf<AT>`: the actor, the affirms, the
    rows read (`quiz`, `realm` only when affirmed), and the queries' results by name. Mismatch
    throws `Approve.NotApprovedError` (`notIdentified` / `notPermitted`, story `{ affirm }`).
    `isPlaced`/`isQuizOfHunt` are deleted.
  - **The affirm functions** now throw a denial rather than return a boolean or verdict:
    `affirmReadHunt` (generic over the affirms' shape; hands back the claims, quiz included),
    `affirmReadQuestion` (new: the question read in the round, held to the hunt),
    `affirmReadReviews(db, quizAffirms, actor)` (reviews read in the round), `affirmPerform`
    (returns `PerformClaimsT`, with `named`, the quiz the action names, read in the round and held
    to the hunt), `affirmCountUsage`, `affirmAccountAction`. Each is a round, at most one extra
    guard, and one `Approve.must`; no `await` after the round.
  - **Denial shapes.** `refusalFor` (`src/lib/refusals.ts`) turns a `NotApprovedError` into a
    refusal of its kind, so `refusingInvalid` refuses denials in mutations. `emptyIfDenied(empty,
    read)` in `convex/functions.ts` answers one with the facet's empty value in queries (it
    catches `NotApprovedError` only). Every hunt query and `widgets.usage` use it.
  - **The lock is policy.** `quizLocked` is a `Denialkind`; `Approve.mayReviseQuiz(quiz, claims)`
    (anonymous, not smith, gone quiz allowed, locked, allow), with a one-line row adapter
    `mayReviseClaimedQuiz(claims)` reading `claims.quiz`. `Actor.QuizClaimsT = HuntClaimsT & { quiz:
    Pick<QuizRowT, 'locked'> | null }` is the evidence for every `QuizRevisionKind`
    (`ContentActionKindVals` + `LayoutActionKindVals`, new in `actions.ts`). `Quiz.isLocked`.
  - **Writing takes rows from the claims.** `perform(db, claims, action)`. `OpenQuizT` is now a
    `convex/writing/quiz_writing.ts` type: the ids plus `quiz` and `realm` rows. `openQuizRow(open)`
    is synchronous; `revisable` checks only that the quiz exists; `reorderQuiz` takes the quiz row
    (`importQuestions` re-reads it after writing its order); `newQuiz` uses `open.realm`;
    `deleteQuizFrom`, `setLock`, `openReview` take the named quiz row. `layoutOf(db, quiz)` in
    `reading.ts` reads a layout for a row in hand. Widgetings and columns copy the verified
    `claims.hunt_id`; `relabelQuiz` looks its clash up by the verified `realm_id`. `writing/`
    mentions `locked` only in `setLock` (and `perform`'s `set_lock` case).
  - **Browser.** `src/state/use-affirms.ts`: `useAffirms(hunt, quiz_id)` → `{ huntAffirms,
    quizAffirms }`, each memoized on its primitive fields (from `useIdent` and the shallow hunt).
    `useHunt`, `useQuiz(affirms, quiz_id)`, `useOtherQuiz(hunt, quiz_id)` (`usePreviewBag` passes
    the hunt it had), `useWholeHunt` and the history feed send them.
  - **Tests.** `affirmsOf(tt, by, place)` in `tests/support/convex.ts` (an `AffirmsBag`: `hunt`,
    `quiz`, `action`), `PlaceT`; `seedHunt`'s `act` affirms honestly for whoever acts (the smith's
    affirms for an anonymous caller). The matrix gains a fifth column, a smith of a locked quiz,
    and a test that the `Revisers` rows are exactly `QuizRevisionKindVals`. Forged-affirm tests:
    `affirmForHunt` guard by guard; `hunts.perform` refuses eight forgeries `notPermitted` writing
    nothing; `quizzes.open`, `questions.open`, `reviews.forQuiz`, `hunts.whole` answer empty for a
    wrong standing, another's ident, a quiz/question of another hunt. Also `emptyIfDenied`,
    `refusalFor` on a denial, `layoutOf`, `Quiz.isLocked`, `mayReviseQuiz`.
  - Docs: `notes/vocabulary.md` (*affirms*; *claims* and *affirm…* updated), `notes/convex.md`
    (*Who is asking*), `notes/queries_hooks_and_subscriptions.md` (affirms on a hunt's queries),
    `notes/stack.md` (`EST.allKeyed`).
* **Decisions taken**:
  - **Denials are thrown, everywhere.** Every `affirm…` throws `NotApprovedError` (affirm mismatch
    or policy no) and hands back what it read; mutations turn it into a refusal, queries into
    their empty value. Thread 6's builders: call `affirmForHunt` (or the affirm function) inside
    the handler body wrapped in `emptyIfDenied` for a query, and put the claims on `ctx`; an
    `input` hook that throws cannot answer a query's empty value, so the query builder wraps the
    handler rather than relying on `input` alone.
  - **`affirmForHunt` guards the anonymous actor itself**, before any read, so a builder calls it
    with `ctx.actor` as is. Signature order is `(db, affirms, actor, queries)`; `queries` is
    required (`{}` for none) because a default generic resolves to `{}`, which lint refuses.
  - **Gone rows pass** affirmation (null quiz, realm, named quiz, question): the write refuses
    `quizGone` etc., as before, and a query answers null. A quiz present with its realm gone now
    passes too (it carries `hunt_id`), where `isPlaced` refused it; the test changed.
  - **`questions.open` takes `huntAffirms`**, not `quizAffirms`, and checks `question.hunt_id`:
    a per-question quiz read would add a read per watched question for nothing.
  - **`mayReviseQuiz` allows a gone quiz** (null) so the write's `quizGone` sentence survives; the
    smith check comes before the lock, so a reviewer is told `notPermitted`, not `quizLocked`.
* **Deviations**:
  - **`idents.performAccount` takes no affirms**: an account action names its hunt in the action,
    comes from the hunts list before a quiz is open, and its claims are one read
    (`claimsFor`); thread 6 lists it as an exception anyway. `hunts.open` (by label) likewise.
  - `affirmReadReviews` reads the affirmed quiz too (one more `get`, in the same round) so the quiz
    is held to the hunt like every other quiz affirm.
* **Discoveries**:
  - **A change of standing or ident re-subscribes the quiz's watches.** Affirms are watch args, so
    when `hunts.open` delivers a new role (a smith re-roles you) or `idents.current` a new ident,
    the frame, every question and the reviews are asked again with the new affirms, and the
    screen shows *Opening…* for a round trip (the grid remounts). Rare, and the stale ones answer
    empty rather than throw. Thread 8 may want `useQuiz` to keep the last quiz while new affirms
    are on their way.
  - Convex's argument validators refuse extra fields, so a browser must send exactly the shape a
    function takes: `useAffirms` gives `huntAffirms` and `quizAffirms` separately for that reason.
  - Raw test inserts of quizzes without `hunt_id` are now denied as another hunt's (one test fixed).
  - The first full e2e run failed 5 consecutive `widgets.spec` tests with *Function execution timed
    out (maximum duration: 1s)* on `hunts:perform` and `quizzes:open`, right after the runaway-
    formula test; alone, and on a full rerun, all passed. Load on the local `e2e` backend, I
    believe, not this change (which reads fewer rows per request than before); worth watching.
* **For the Coach**: one more `unicorn/prefer-combined-guards` disable (on `holdsTo` in
  `convex/authorize.ts`), with the policy note's reason.

## Threads 1 to 4, in brief

*Orchestrator:* a digest of what later threads build on. The whole sections, as their workers
wrote them, are in `dbpolicy-done-1-4.md`: read it when this is not enough. Thread 10 reads it whole.

### Thread 4: Denormalize (#83; review clean)

* **Copies**: `quizzes.hunt_id` (index `by_hunt_id`); `hunt_id` on widgetings and columns;
  `hunt_id`, `quiz_id` on widgeteds; `hunt_id`, `quiz_id`, `ident_id` on reviewings;
  `ident_label`, `ident_title` on huntings (the one fan-out, in `retitleIdent`). Every insert
  writes them; `membersOf` reads members off the huntings; `isQuizOfHunt` is one `db.get`.
* **Every hunt-owned table now carries `hunt_id`**: realms, quizzes, questions, widgetings,
  columns, widgeteds, reviews, reviewings, huntings.
* **Reviewings are only read through a review already in hand** (and cascaded by question on
  delete). Thread 6's reviewing rule can be hunt-only for reads, ownership via `ident_id` for
  writes; reads must not require ownership (a smith reads others' shared reviews).
* **Fallbacks until the backfill runs** (`huntIdOf`, `huntIdOfLayoutRow`, `reviewingCopiesOf`,
  `membersOf`'s ident read, and the four update helpers that fill copies in): per
  `notes/deploy.md`. **New code in threads 5 to 9 reads the copies directly, with no fallback**:
  `runAll` runs before they deploy. Thread 10 removes the fallbacks.
* Widgetings and columns copy `open.hunt_id`, verified today by `isPlaced`; thread 5's verified
  claims must keep that true. `reviews.forQuiz` still reads each reviewer's ident (not policy).

### Thread 3: One label, and integrity repairs (#82; review fixed 1)

* One `label` per row; `quizForLabel` (index `by_realm_id_and_label`); `relabelQuiz` refuses
  `labelTaken`, looking the clash up by `open.realm_id` (sound only while the realm is verified:
  thread 5). `deleteQuiz(db, quiz_id)` deletes children by index.
* **`expectSound(tt)`** in `tests/support/soundness.ts`: a list, `SoundnessChecks`; any `_id`
  field is checked to name a row via `TableForIdField`. Call it after any cascade or insert path.
* **`migrations:runAll`** runs every backfill in order. `forced_label` is under `Retiring`.

### Thread 2: `Approve` (#81; review clean)

* **A policy returns a verdict**: `Approve.Allow` or a `Denialkind` (also a `Refusalkind`).
  `may` (boolean), `must` (throws), `verdictOn` (verdict). Read-side `affirm…` return booleans;
  write-side return verdicts, refused as such.
* **The table**: grouped (`LayoutPolicies`, `LibraryPolicies`, `ContentPolicies`,
  `RealmPolicies`, `ReviewPolicies`, `HuntPolicies`, `AccountPolicies`, `ReadPolicies`); action
  rows take `(claims, action)`, each typed to its kind; `EvidenceT` says what a key is handed. The
  matrix in `tests/lib/approve.test.ts` is keyed by kind with `satisfies`.
* **Claims**: `HuntClaimsT` (`ActorT & { hunt_id, standing }`), `Actor.claimsOn(actor, hunt_id,
  hunting)`; server `claimsFor(db, hunt_id, actor)`. `affirmReadReviews` judges a quiz's whole
  set of reviews with one membership read.
* `mayChangeMembership` compares by id or label (a smith re-adding themselves is `ownHunting`).
  Account kinds have `mayAssertUsername`, `mayRetitleIdent`, `mayMakeHunt`.
  `mayAskAnthropicBot(switchval)`: the route reads the environment, not `approve.ts`.
* **`unicorn/prefer-combined-guards`** contradicts `notes/policy_approve.md`: disable with a
  reason where it bites, and report it (the Coach may settle it in `eslint.config.mjs`).

### Thread 1: Sessions and the actor (#79; review fixed 1)

* Convex Auth, Anonymous only. **`askerOf(ctx)`** in `convex/functions.ts` is the one read
  path; `zQuery`/`zMutation` put `ctx.actor` and `ctx.user_id` on `ctx`. Later builders call
  `askerOf` in their `input` hook. The actor requires a live `authSessions` row.
* `src/lib/actor.ts`: `ActorT`, `Actor.anonymous`, `asIdent`, `isAnonymous` (plus thread 2's).
* **Test actors** (`tests/support/convex.ts`): smith `seeded.smith`, reviewer
  `join(label, 'reviewer')`, stranger `identified(tt, label)`, anonymous with a session
  `signedIn(tt)`, no session bare `tt`; `seedHunt`'s `act(action, by)`; each `.actor` for calling
  a rule directly.
* `idents.user_id` is widened (thread 10 tightens it). Sessions last ten years, or a year
  unvisited (the Coach to confirm).
