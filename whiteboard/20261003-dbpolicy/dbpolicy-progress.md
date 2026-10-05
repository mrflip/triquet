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
| 5 | Affirmations | underway | | |
| 6 | A scoped database handle | pending | | |
| 7 | Reads shaped by role | pending | | |
| 8 | Views ask `Approve` | pending | | |
| 9 | The library behind an admin helper | pending | | |
| 10 | Tighten | pending (merge waits on production backfills) | | |


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
