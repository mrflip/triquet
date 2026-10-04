# Relational integrity: what to strengthen, and when

As of `25aeb7a`, 2026-10-03. Draws on `association-census.md` §6 and `authz-review.md` §6.
Three buckets: **now** (small, safe, should precede or ride with the policy work), **soon**
(deserves a thread of its own), and **not sweating** (noted, not forbidden: each is contemplated
for a future sprint, or for whenever other work makes it natural).

The one framing fact: Convex has no foreign keys and no unique indexes. Every cascade, restriction
and uniqueness here is a write path in `convex/writing/`, and the reads tolerate a duplicate by
taking the earliest. That is adequate as long as (a) every write path is index-driven rather than
dependent on another row being in step, and (b) every uniqueness the browser relies on is also
checked on the server.

## Now

Each of these is a morning's work, needs no new concept, and closes a hole a client with edited
code could walk through or that a single missed update would open.

1. **Server-side uniqueness for `relabel_quiz`.** `relabelQuiz` leaves uniqueness within the realm
   to the caller, and only `QuizManageModal` checks. Add the check `newQuiz` already does
   (`quizzesOf(realm)` → effective labels, refuse `labelTaken`), and normalize a relabel back to
   the minted label to `forced_label: null`, as `relabelHunt` does. Two quizzes answering to one
   address is the worst integrity failure the app can have, since labels *are* the addresses.

2. **Make the quiz cascade index-driven.** `deleteQuiz` deletes the questions `row_ordering`
   lists; a question absent from the array would survive its quiz with its widgeteds and
   reviewings. Delete questions through `by_quiz_id` (the index exists and is otherwise unread),
   and delete widgetings through `deleteWidgeting` rather than a bare `db.delete`, so each
   cascade is self-sufficient. Same `for await` shape as `deleteQuestion`.

3. **A removed member's review.** Decide and enforce one of: (a) reviews stay, visible to smiths,
   but the ex-member's own-review read requires membership; (b) reviews are deleted with the
   hunting. My recommendation is (a): the review is the smiths' evidence, and a `mayReadReview`
   that says `own && member` is one line. Either way, today's state (ex-member keeps reading and
   writing their review) is unintended.

4. **Denormalize `hunt_id` onto `quizzes`.** The one schema change in this bucket, and the one
   that most helps the policy work: it lets `open` shrink to `{ quiz_id }`, removes
   `isPlaced`/`isQuizOfHunt` from `authorize`, and saves `quizzes.open` a read per run. Immutable
   field, so no fan-out. Ships with a migration (`@convex-dev/migrations`, backfill from
   `realms.hunt_id`; `notes/deploy.md`, *Schema pushes*: widen optional → backfill → tighten).
   Add `.index('by_hunt_id', ['hunt_id'])` while there: hunt-wide reads want it.

5. **A table-driven authorization test.** Every `huntAction` kind × {smith, reviewer, stranger,
   nobody} → expected verdict, in one test, so an action added without a policy row fails loudly.
   Not a code change to the app, but it is the net under everything in `soon`.

## Soon

Each wants a thread. They are ordered as `sprint-draft.md` orders them.

6. **The policy layer** (`authz-review.md` §2–§5): actor built once per request; `ActionVerbs`
   table; rules per table over `(actor, row)`; `visible` / `entitled` / `ensure`; lock moves out
   of `revisable()`. Integrity refusals stay in `writing/`.

7. **Row-level security through `convex-helpers`** for reads, so a listing is filtered by rule
   rather than by hand (`reviews.forQuiz`, `hunts.list`). Needs `hunt_id` on the rows it reaches,
   which is why (4) precedes it and (9) follows it.

8. **Role-shaped exposure.** Reviewer projections without `full_answer` (until `peek_answer` has
   been recorded for that question), without `notes`/`alt_text`, without stored `aibot` replies;
   `hunts.whole` smith-only. The browser's `AnswerLock` becomes a view of what it was given.

9. **`hunt_id` on `widgetings`, `columns`**, and then on `widgeteds` and `reviewings` when RLS
   reaches them. Same immutability argument as (4); each is a schema push, so batch them.

10. **Library writes behind admin**, on a mutation of their own (`authz-review.md` §8).

11. **`/api/ask` carries and checks the actor** (`authz-review.md` §9).

12. **Stale `aibot` answers.** Editing a widget's prompt or tier leaves every stored reply as
    recorded, with nothing marking it as answered to an older prompt. Not integrity in the
    relational sense, but the same family: a reference (the reply) to something (the prompt) that
    changed underneath it. Record the widget's revision (or a hash of prompt + config) on the
    widgeted at write time, so a cell can say "answered to an earlier version". Product call on
    what the cell then shows.

## Not sweating

Contemplated for a future sprint, or for when other work makes one natural. None is forbidden.

* Resolving duplicate labels (two rows under one label after a race) by anything stronger than
  "the earliest wins". OCC inside one mutation already prevents the race for every write that
  checks; the remaining exposure is (1) above.
* An integrity sweeper: a scheduled job or an internal mutation that finds orphans (a widgeted
  whose question or widgeting is gone, a reviewing whose review is gone, a `chains_to` naming no
  sibling, a `row_ordering` entry naming no row) and reports or repairs them. Useful once there
  is production history worth auditing; today the cascades are complete.
* Convex Ents, or any edge-declaring layer, for cascades and uniqueness. The hand-written
  cascades are small and tested; revisit if the model grows more tables or a per-hunt widget scope.
* Denormalized child counts for the caps. The caps are small and the counting reads are bounded.
* Writes for realms (relabel, retitle, reorder, add a second realm). None exists; the model allows
  up to 99.
* `chains_to` held by id rather than label. The label form survives export round-trips, and a
  question's label is never revised, so it cannot dangle through a rename today. Revisit only if
  labels become editable.
* `quizzes.realm_id` indexed with `label` for a direct address lookup, instead of scanning the
  realm's quizzes (≤999) for the effective label. Cheap enough as is.
* Making `peeked` more than a record. Once (8) withholds the answer server-side, `peeked` is the
  gate's own state and needs nothing further.
