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
| 7 | Reads shaped by role | complete, reviewed (clean) | `20261004-dbpolicy_role_reads` | #89 |
| 8 | Views ask `Approve` | underway | | |
| 9 | The library behind an admin helper | pending | | |
| 10 | Tighten | pending (merge waits on production backfills) | | |


## Thread 7: Reads shaped by role (2026-10-04)

Branch `20261004-dbpolicy_role_reads`, PR #89, stacked on #88. Suites: typecheck, lint, `pnpm test` (111 files, 2968), e2e (208, run as `pnpm test:e2e:agent`, the `e2e-agent` role) all green, first run.

*Review:* `clean`, at medium; no fixes, no findings. Checked that `hunts.whole`'s only caller is
the Export box a reviewer cannot reach, that the review views read only fields on
`Question.sentTo.reviewer`, that the smith's list covers every field (so the history feed still
runs for smiths), that nothing read the dropped `_creationTime`/`hunt_id`/`quiz_id`, and that
`questions.open` reads widgetings only for a standing sent `stored`.

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

## Threads 1 to 6, in brief

*Orchestrator:* a digest of what later threads build on. The whole sections, as their workers
wrote them, are in `dbpolicy-done.md`: read it when this is not enough. Thread 10 reads it whole.

### Thread 6: A scoped database handle (#88; review clean)

* **Builders** in `convex/functions.ts`: `zHuntQuery({ args, empty, affirm, handler })`,
  `zHuntMutation({ args, returns, affirm, handler })`. They run `affirm` on the plain db inside
  `emptyIfDenied` / `refusingInvalid`, then hand the handler `ctx.claims`, a scoped `ctx.db`, and
  (mutations) `ctx.census`. Built so: `hunts.whole`, `hunts.perform`, `quizzes.open`,
  `questions.open`, `reviews.forQuiz`.
* **`convex/policy_rules.ts`**: one `(claims, row)` rule per table, `defaultPolicy: 'deny'`;
  `WritingRules` and `ReadingRules` differ only in `reviews.read` (queries filter by
  `mayReadReview`, mutations see the hunt's every review). Hunt-owned tables: `hunt_id` matches.
  Reviews and reviewings are written by their writer or a smith. `idents` readable, never
  written; identings and auth tables unreachable. `widgets`: read `read_library`, write
  `change_library` (a `RowPolicies` key, `mayChangeHunt` today; thread 9 re-points it).
* **`Unscoped`** at the top of `convex/authorize.ts` names every function holding the whole db,
  with a reason; the public-function test checks every function is scoped or listed.
* **The census** (`CensusT`, `censusOf(db)` in `convex/reading.ts`): cross-hunt answers (an id
  or a boolean, never a row) for `relabelHunt`'s label clash and `deleteWidget`'s `isWorked`.
* A rule violation throws convex-helpers' plain `Error`: a bug, not a refusal. Rows without
  their copies are invisible to a scoped db (`runAll` first).

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
