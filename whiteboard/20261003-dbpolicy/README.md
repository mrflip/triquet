# 20261003-dbpolicy: relational integrity and the access-policy layer

Written 2026-10-03 against `25aeb7a`, while the Coach was away. Read in this order:

1. **`association-census.md`** -- every association between models: field, nullability,
   cardinality, deletion and update policy; the association tables on their own; has-X-through;
   §5 the security policy enforced today, by model; §6 what the census turned up.
2. **`authz-review.md`** -- whether the way policy is specified and implemented meets best
   practice; where policy and business logic are mixed and how to separate them; which checks
   still need a database read under a zero-cost actor and what denormalizing buys; many readers;
   admin and the library; `/api/ask`.
3. **`integrity-plan.md`** -- now / soon / not sweating.
4. **`dbpolicy-plan.md`** and **`dbpolicy-progress.md`** -- the sprint plan, standing alone for
   its workers, and its seeded progress document. The plan supersedes this directory's other
   documents wherever they differ (it follows `notes/policy_approve.md`: affirms and claims,
   `Approve.may`/`must`, Convex Auth first, more denormalization).

Nothing here is committed: the checkout stood on `20261001-quiz_review`, which is the Coach's quiz
branch, so the files are left in the working tree for the Coach to place.

## Assumptions made

* **The trusted actor exists.** Per the brief: every request carries `is_admin`, `smith_of`,
  `reviewer_of`. In the trial these are built from `identings` and `huntings`; the design puts
  that behind one builder so the swap is one place.
* **Defending against an edited client is a present capability**, and the review treats it so:
  all writes pass `hunts.perform`/`idents.performAccount` with server-side rules, all reads pass
  query functions with server-side rules, Zod at the door. The gaps found are gaps *in* that
  defence (reviewer field exposure, library writes, `/api/ask`), not its absence.
* **`convex-helpers`' row-level-security and custom-function modules count as *Use***, since the
  package is already *Use* for its Zod bridge. Flagged for the Coach's word in thread 4.
* **Lock, archive, read-only and version rules are resource-state rules** in the same policy
  engine, evaluated against a row already fetched, never an extra read.
* **Integrity refusals stay with the write** (`labelTaken`, `widgetGone`, caps): they are facts
  about the data, true for every actor, and are not policy.
* **Denormalizing `hunt_id` is acceptable** because the field is immutable (no row ever changes
  hunt), following `questions.hunt_id` and `reviews.hunt_id`.
* **Smiths' note stays visible to reviewers.** `ReviewScreen` shows it and the review of 2026-10-01
  told reviewers to read it first.

## Questions for the Coach

1. **Disclosure.** `hunts.open` tells a non-member the hunt exists and names its smiths. Keep
   that as the one resource whose existence is public? The *visible* access mode otherwise makes
   absent and forbidden indistinguishable.
2. **A removed member's review.** Keep it, visible to smiths, with the ex-member's own-review read
   now requiring membership (my recommendation)? Or delete it with the hunting?
3. **Exactly what a reviewer sees.** Proposed: `title`, `qnum`, `clueing`, the chained question's
   `hint` (the BUT NOT), `smiths_note`, the frame's columns that show those; `full_answer` only
   after `peek_answer`; never `notes`, `alt_text`, stored `aibot` replies, `hunts.whole`.
4. **Admin in the trial.** Until the identity design lands, is an env-listed set of ident labels
   an acceptable `is_admin`? And: when the library is admin-only, what does a smith do who wants a
   new widget mid-build (propose it? a per-hunt widget scope later?).
5. **Production migration** for `quizzes.hunt_id` (thread 2): widen → backfill → tighten per
   `notes/deploy.md`. Agents never deploy; who runs it, and when?
6. **`/api/ask`** currently needs no identity. Is making it refuse anonymous asks in scope for
   this sprint (thread 7 design) or separate?
7. **Stale `aibot` answers** after a prompt edit (integrity-plan 12): product call on whether a
   cell should say so.
8. Housekeeping: `CLAUDE.md` points at `notes/decisions/2026-09-client-first.md`, and
   `notes/stack.md` at `2026-09-path-routing.md` and `2026-09-resource-urls.md`; none of the three
   exists (`notes/decisions/` holds only `2026-10-widgets.md`, which notes the same).
