# Guardrails for Authorization / Approve code

* Client-side code should effortlessly never present the opportunity for a user to cause a policy error:
  - client: "list all foos" server: "here are all foos you're allowed to read"
  - client: `if (Approve.may(action, resource) { ... view with that can do that ... })` -- client-side checks are on the way in
* shared code for client and server authorization policy
* specific code review guardrails

## Client supplies full suite of evidence

The client should send all evidence they have in hand for making the policy decision
For example: a quiz question can be viewed by a reviewer on a hunt or a smith on a hun

## Policy functions need tighter code:

* Exactly one parallel Promise.all containing .get's or .first's only, each of modest size: no await this then await that.
* Avoid deeply-nested conditionals

## Decision functions should be readable as prose.

I should see a comment block that
* lays out a clear decision path
* has a crystal-clear mapping to the actual logic of the code
* matches exactly a test or block of tests

BAD: tangled boolean logic; sequential awaits; smooshed comment

```ts
/**
 * Whether `ident_id` may read `review`, with its verdicts: always their own; another's only once
 * it is shared, and then by a smith of its hunt, or by a reviewer there whose own review of the
 * quiz is shared too, so no reviewer reads the others' before they have made up their own mind.
 */
export async function mayReadReview(db: Reader, review: Doc<'reviews'>, ident_id: Id<'idents'> | null): Promise<boolean> {
  if (review.ident_id === ident_id) { return true }
  if (ident_id === null || review.phase !== 'shared') { return false }
  const role = await roleOn(db, review.hunt_id, ident_id)
  if (role !== 'reviewer') { return role === 'smith' }
  const own = await reviewFor(db, review.quiz_id, ident_id)
  return own?.phase === 'shared'
}
```

```ts

// This is a pencil sketch; the idea is
// * client sends in affirmations of everything that might help establish just cause for accessing data
// * all affirmations are checked against ground truth in parallel db calls
// * after passing through the checkWhateverAffirms, code can trust those values
//
// things like mayReadReview should not be called on lists of reviews

/** Whether `ident_id` may read `review`. In order:
 *
 * * Anonymous users may not read reviews
 * * Only reviewers and smiths can read reviews
 * * Anyone may read their own review
 * * In-progress reviews are not visible to other users
 * * Smiths on the review's hunt may read it
 * * Reviewers for this hunt may read it once they have shared a review for this quiz
 * * Everyone else may not
 */
export async function affirmReadReview(db: Reader, review: Doc<'reviews'>, affirms: MayReadReviewAffirms, ctx: CTX): Promise<boolean> {
  if (Actor.isAnonymous(ctx))             { return false } // Anonymous users may not read reviews
  const claims = await affirmForHunt(db, affirms, { hunt_id: review.hunt_id }, {
    ownReview: reviewFor(db, review.quiz_id, ctx),
  }, ctx)
  return Approve.mayReadReview(claims)
}
export interface MayReadReviewAffirms { ident_id: Id<'idents'> | null, hunt_id: Id<'hunts'>, role: HuntRole }

/** Whether `ident_id` may read `review`. In order:
 *
 * * Anonymous users may not read reviews
 * * Only reviewers and smiths can read reviews
 * * Anyone may read their own review
 * * In-progress reviews are not visible to other users
 * * Smiths on the review's hunt may read it
 * * Reviewers for this hunt may read it once they have shared a review for this quiz
 * * Everyone else may not
 */
function mayReadReview(review, claims) {
  if (Actor.isAnonymous(claims))            { return false } // Anonymous users may not read reviews
  if (Review.isActiveOwner(review, claims)) { return true  } // Any hunt's current reviewers may read their own review
  if (Review.isHidden(review))              { return false } // In-progress reviews are not visible to other users
  if (Actor.isSmith(claims))                { return true  } // Smiths on the review's hunt may read it
  if (Actor.isReviewer(claims)) {
    return ownReview && Review.isShared(ownReview)  // if they've shared a review for this quiz and are currently a reviewer on the hunt
  }
  return false                                      // otherwise, deny
}

/** Verify that the client's situation is as they assert. Database calls are awaited in parallel with
 * data the client will need to finish their policy check as a courtesy
 *
 */
function affirmForHunt(db, affirms, demands, queries, ctx) {
  const { ident_id } = ctx
  const results = await EST.allKeyed({
    ...queries,
    hunting: huntingFor(db, demands.hunt_id, ctx.ident_id),
    ident:   identFor(db, ...),
  })
  const { hunting: { role }, ident } = results
  if (! _.isEqual(affirms, { ...demands, role, ident_id })) { throw Errors.NotAuthorized(...) }
  return { ...demands, ...results, ident_id, role, ident_label, hunt_id }
}

```

## Null means "absent", never a named state

`null`/`undefined` may only mean "no value here." Flag code where null stands in for a domain state you could name, such as anonymous user, unlimited, all items, default, or root. That state needs a named sentinel and a predicate.

Why: null-as-state is unreadable at the call site and indistinguishable from "forgot to set it." Two nulls also compare equal, so equality checks silently pass between unrelated absences. Watch especially for ownership or equality checks where both sides can be null.

Test: if explaining the null takes a noun ("null is the anonymous user", "null means no limit"), it needs a name.

Don't flag null for genuinely missing data: unset optional fields, lookups that found nothing, nullable DB columns, `??` defaults. This rule is about meaning, not the keyword.

BAD (security hole: when `review.ident_id` is null, anonymous users pass the first check):
```ts
if (ident_id == review.ident_id) { return true }
if (ident_id == null) { return false }
```

BETTER:
```ts
// library
export const ANONYMOUS_ID = Symbol.for('ANONYMOUS_ID')
export type IdentID = string | typeof ANONYMOUS_ID
export function isAnonymous(ident_id: IdentID): boolean { return ident_id === ANONYMOUS_ID }

// call site
if (isAnonymous(ident_id)) { return false }
if (ident_id === review.ident_id) { return true }
```

Symbols don't survive JSON or the database. At those boundaries, map the sentinel to a reserved constant or a tagged value (`{ kind: 'anonymous' }`) and convert back on read.

## Consider using dispatch rather than membership

BAD: if there is ever an action that is neither a review, nor a hunt change, it will still consult mayChangeHunt

```ts
export async function mayPerform(db: Reader, quiz: OpenQuizT, ident_id: Id<'idents'>, action: HuntActionT): Promise<boolean> {
  // const named = 'quiz_id' in action ? action.quiz_id : null
  const verdicts = await Promise.all([
    isReviewAction(action) ? mayWriteReview(db, quiz.hunt_id, ident_id) : mayChangeHunt(db, quiz.hunt_id, ident_id),
    // ...
  ])
  return Approve.every(verdicts)
}
export function isReviewAction(action: HuntActionT): action is ReviewActionT {
  return (ReviewActionKindVals as readonly string[]).includes(action.kind)
}
```

BETTER: easy to read and maintain (yep, if I can change the hunt I should be able to retitle it). Brittle in a good way: if nothing is in the dispatch, code will crash (which is better than possibly approving). Better typechecking. O(1).

```ts
const ReviewPolicyFuncs = {
  open_review: mayWriteReview,
  set_overall: mayWriteReview,
  // ...
} as const satisfies Record<ReviewActionKind, ReviewPolicyFuncT>
const HuntPolicyFuncs = {
  retitle_quiz: mayChangeHunt,
  foo_bar_of:   mayFooBarOfHunt,  // HuntPolicyFuncT can ensure functions get right signature
  // ...
} as const satisfies Record<HuntActionKind, HuntPolicyFuncT>
const PolicyFuncs = { ...ReviewPolicyFuncs, ...HuntPolicyFuncs }
/** returns the policy function or throws */
function policyFuncFor(action) { /* ... */ }
```

## Avoid complex boolean expressions:

BAD:
```ts
  return realm.hunt_id === quiz.hunt_id && (fetchedQuiz === null || quiz.realm_id === fetchedQuiz.realm_id)
```

BETTER:
```ts
    if (realm.hunt_id !== quiz.hunt_id) { return false }
    if (fetchedQuiz === null)           { return true }
    return (quiz.realm_id === fetchedQuiz.realm_id)
```