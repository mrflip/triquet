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
| 6 | A scoped database handle | complete, reviewed (clean) | `20261004-dbpolicy_scoped_db` | #88 |
| 7 | Reads shaped by role | complete | `20261004-dbpolicy_role_reads` | #89 |
| 8 | Views ask `Approve` | pending | | |
| 9 | The library behind an admin helper | pending | | |
| 10 | Tighten | pending (merge waits on production backfills) | | |


## Thread 7: Reads shaped by role (2026-10-04)

Branch `20261004-dbpolicy_role_reads`, PR #89, stacked on #88. Suites: typecheck, lint, `pnpm test` (111 files, 2968), e2e (208, run as `pnpm test:e2e:agent`, the `e2e-agent` role) all green, first run.

* **Built**:
  - **`Question.sentTo`** (`src/models/question.ts`), beside `exposed`: per standing, the fields
    a question's reader is sent besides its id. Smith: all ten (`exposed` plus `stored`).
    Reviewer: `chains_to`, `clueing`, `full_answer`, `hint`, `label`, `qnum`, `title`. Stranger:
    none. It is the one place the Coach's ruling on the rest of the list lands. Also
    `Question.isSent(fieldname, standing)`, `Question.isSentWhole(standing)`, and the type
    `QuestionFieldname`.
  - **`seenQuestionFor(row, stored, claims)`** (`src/lib/rows.ts`) replaces `seenQuestionOf`. It
    picks `_id` plus `sentTo[claims.standing]`, by standing alone. `SeenQuestionT` is now a union
    over standings (`SeenQuestionAsT<SS>`). `quizFrom` (export, server) projects as a smith.
  - **`questions.open`** projects by `ctx.claims.standing`. It reads widgetings and widgeteds only
    for a standing sent `stored`: a reviewer's watch reads neither, so an aibot's record no longer
    reruns it.
  - **Browser**: `quizFromSeen` fills a field the reader was not sent with a blank (`Unsent`,
    as a fresh question's). `useQuiz`, `ReviewScreen` and the rest still take a whole `QuizT`.
    `useHistoryFeed` (`src/state/use-hunt.ts`) runs only where `Question.isSentWhole(standing)`,
    a smith's.
  - **`Approve.mayExportHunt(claims)`**: `return mayChangeHunt(claims)`, after `mayWriteReview`'s
    precedent (a body identical to `mayChangeHunt` trips `sonarjs/no-identical-functions`). The
    key `export_hunt` is in `EvidenceT` and `ReadPolicies`. **`affirmExportHunt`** in
    `convex/authorize.ts`; `hunts.whole` affirms with it, so it is null for a reviewer.
  - `AnswerLock` and `ReviewScreen` doc blocks say the lock is a spoiler shield, not a security
    boundary.
  - **Tests**:
    - `Question.sentTo` (the smith's list is every field, and `exposed` plus `stored`),
      `isSent`, `isSentWhole`.
    - `seenQuestionFor` for each standing, and `quizFromSeen` blanking a reviewer's unsent fields.
    - `questions.open`: a reviewer gets exactly the list, `full_answer` before and after
      `peek_answer`, no `notes`, `alt_text` or `stored`; a smith gets everything.
    - A reviewer's assembled quiz: frame equal to the smith's, `smiths_note` included.
    - `hunts.whole` null for a reviewer; `mayExportHunt` per standing; `affirmExportHunt`.
    - e2e `reviews.spec`: a reviewer sees clueing, the chained BUT NOT and the locked answer,
      never the smith's notes; peeks, reloads, sees *Seen before*, and reveals again.
  - Docs: `notes/convex.md` (a paragraph under *Who is asking*), `notes/vocabulary.md` (**sent**;
    the lock), `notes/queries_hooks_and_subscriptions.md` (a facet's shape may depend on the
    reader).
* **Decisions taken**:
  - **The decision point: where a reviewer's browser reads a question.** I checked:
    - **Review screen**: reads `_id`, `qnum`, `clueing`, `title`, `chains_to`, `full_answer`, the
      target's `hint`. `ReviewsPanel` reads `title` and `qnum`.
    - **Grid**: a reviewer cannot reach `Workbench` (`Hunting.mayAct`), nor its cells, column
      readouts, preview bag (`useOtherQuiz`) or export box.
    - **History feed**: the one break. `useHistoryFeed` ran for every standing. It runs every
      formula over the quiz and commits a git table of every exposed field. Fed a reviewer's
      projection, it would have committed notes, alt text and every stored cell as blanked, and
      run formulas on the blanks.

    I left the facet as one type, filled with blanks in the browser, and kept the history to a
    standing that reads each question whole. A typed reviewer's quiz (`ReviewQuizT` through
    `useQuiz`, `useHunt` and `QuizRoute`) would make `HuntHandle` a union by standing, which is
    thread 8's ground, for no gain: no view a reviewer reaches reads the withheld fields. Thread
    8's plan is unchanged, so not blocked.
  - **One projection for every standing.** A smith's reading is `_id` plus their list too, so
    it no longer carries `_creationTime`, `hunt_id` or `quiz_id`. `quizFromSeen` dropped them
    anyway, so the tree a smith's formulas read is unchanged.
  - **The history gate asks the data, not the role**: `Question.isSentWhole(standing)`, not
    `standing === 'smith'`. The reason is the reading's shape, not a permission.
* **Discoveries**:
  - **For thread 8:** `useHistoryFeed`'s gate is a fact about data, so leave it as it is. The
    export box can ask `Approve.may('export_hunt', claims)`, which takes `HuntClaimsT`, once
    `useHunt` exposes claims.
  - **Not done (a backstop):** a reviewer's queries still *could* read widgeteds through the
    scoped database: `ReadingRules.widgeteds.read` is hunt-only. Nothing a reviewer calls reads
    them now. A smith-only read rule for widgeteds in queries would make that a rule, not a
    convention. Rules cannot hide fields of a row, so questions stay a projection.
* **For the Coach**:
  - **The rest of the reviewer's list** is still the proposal: it now lives in
    `Question.sentTo.reviewer`. Change it there.
  - Should a reviewer's queries be barred from widgeteds by rule (the backstop above)? It is a
    one-line rule and a test.

## Thread 6: A scoped database handle (2026-10-04)

Branch `20261004-dbpolicy_scoped_db`, PR #88, stacked on #86. Suites: typecheck, lint, `pnpm test` (111 files, 2951), `pnpm test:e2e` (207) all green, first run.

*Review:* `clean`, at medium; no fixes, no findings. Checked the wrapper as `policy_rules.ts`
uses it, every write `hunts.perform` makes against its table's rule, the census keeping the
cross-hunt checks whole, the reviews read rule, and the public-function test. Recorded, not a
bug: rows without their `hunt_id` copy are invisible to a scoped database, so `runAll` must run
before this deploys (already the ledger's rule).

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

## Threads 1 to 5, in brief

*Orchestrator:* a digest of what later threads build on. The whole sections, as their workers
wrote them, are in `dbpolicy-done.md`: read it when this is not enough. Thread 10 reads it whole.

### Thread 5: Affirmations (#86; review clean)

* **Affirms**, three shapes in `src/models/actions.ts`: `huntAffirms` (`ident_id`, `hunt_id`,
  `standing`), `quizAffirms` (+ `quiz_id`), `affirms` (+ `realm_id`). `hunts.perform` takes
  `affirms`; `hunts.whole` `huntAffirms`; `quizzes.open`, `reviews.forQuiz` `quizAffirms`;
  `questions.open` `huntAffirms` (checks `question.hunt_id`). `idents.performAccount` and
  `hunts.open` take none. Browser: `useAffirms(hunt, quiz_id)` in `src/state/use-affirms.ts`.
* **`affirmForHunt(db, affirms, actor, queries)`**: anonymous guard, one `EST.allKeyed` round,
  one guard per affirm; returns `ClaimsOf<AT>`. Gone rows pass (the write says `quizGone`).
* **Denials are thrown** (`NotApprovedError`) by every `affirm…`; mutations refuse them
  (`refusalFor`), queries answer empty (`emptyIfDenied`).
* **The lock is policy**: `quizLocked` is a `Denialkind`; `Approve.mayReviseQuiz(quiz, claims)`
  through the adapter `mayReviseClaimedQuiz(claims)` on `Actor.QuizClaimsT` (`quiz: { locked } |
  null`), for every `QuizRevisionKind`. A reviewer is told `notPermitted`, not `quizLocked`.
* **Writing takes rows from the claims** (`OpenQuizT` carries `quiz` and `realm`).
* **Affirms are watch arguments**: a change of standing or ident re-asks the quiz's watches and
  shows *Opening…* for a round trip (thread 8 may keep the last quiz on screen).
* e2e once lost five `widgets.spec` tests to the local backend's 1 s timeout under load; a rerun
  passed. Rerun before calling it red.


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
