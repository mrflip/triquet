# Authorization review: policy, implementation, and where it mixes with business logic

As of `25aeb7a`, 2026-10-03. Companion to `association-census.md` (§5 is the as-is policy by
model). The Coach's framing for this review:

* Identity is rock-solid, and every request arrives with a **trusted actor**: `is_admin`, the hunts
  it smiths, the hunts it reviews. No lookup needed for any of that.
* Admin acts (editing a global resource) carry an extra trust token, possibly to another endpoint.
* Permissions are uniform across a hunt's objects given one's membership, and will grow
  resource-state rules: archived hunts, read-only parts, version history, old versions read-only.
* Business code should be confident: it discovers only what it may see and performs only what it
  was invited to. A separate layer defends resources against an edited client.
* Design space: ≤100 smiths, ≤500 reviewers, ≤100 active hunts per person; be defensive about
  very many *readers*.

Yes, the brief makes sense, and the codebase already has the shape it asks for in outline: every
write goes through one mutation that asks `authorize` before `perform`, every read goes through a
query function that asks `authorize` before projecting, and Zod stands at the door. What it lacks
is a *layer*: the rules are a set of functions called by convention, the resource-state rules
(lock) live in the business code, and reads are role-gated but not role-shaped. Details follow.

## 1. Verdict in brief

**Defensible today.** A browser that edits its own code cannot write anything a smith of the open
hunt could not write, cannot read a hunt it is not on, and cannot read another's unshared review.
The mutation chokepoint, fail-closed defaults, and the test that enumerates every public function
are genuinely good.

**Four real gaps**, in order of consequence:

1. **Reads are role-gated, not role-shaped.** A reviewer receives every field of every question
   (`full_answer`, `hint`, `notes`, `alt_text`), every stored `aibot` reply (which may guess the
   answer), the whole frame, and can call `hunts.whole` for the export. The browser hides the
   answer behind `AnswerLock`; `peeked` records an honor-system reveal. "A reviewer should only see
   what is necessary for a review" is a client promise, not a server one.
2. **The shared library is writable by any smith of any hunt**, through `hunts.perform`, with no
   admin gate. That is a cross-tenant write: one hunt's smith changes every hunt's prompt.
3. **The action's context is client-asserted.** `open` carries `hunt_id`, `realm_id`, `quiz_id`
   and the rule is asked of `hunt_id`; `isPlaced`/`isQuizOfHunt` then verify the triple is
   coherent. It works, but it is three reads to check what one denormalized field would make
   unnecessary, and a mistake there is an authorization bypass rather than an integrity bug.
4. **`/api/ask` has no authorization.** `Approval.need(null, …)` is an environment switch. Anyone
   with the URL spends the server's model credits.

Everything else is structure: how the rules are stated, where they are enforced, and what will
happen when archived/read-only/versioned arrive.

## 2. Does the way policy is *specified* meet best practice?

Today the specification is: a prose block at the head of `convex/authorize.ts`, seven predicate
functions (`roleOn`, `mayReadHunt`, `mayChangeHunt`, `mayReadReview`, `mayWriteReview`,
`mayPerform`, `mayActOnAccount`, `mayReadLibrary`, `mayCountUsage`), and one list in
`src/models/actions.ts` (`ReviewActionKindVals`) that decides which actions a reviewer may take.

| Practice | Status | Note |
|---|---|---|
| One place for rules | ✅ mostly | `authorize.ts`, by convention. Lock, "never your own hunting", and "review never refused for a locked quiz" are stated and enforced in `writing/` instead |
| Fail closed | ✅ | An action not in `ReviewActionKindVals` needs a smith. A query returns `null`/`[]`. A missing env var says no |
| Declarative, enumerable rules | ❌ | The action→capability mapping is implicit: "review actions, else smith". There is no table one can read, diff, or test exhaustively |
| Actor is a first-class value | ❌ | Each handler does `identFor` (2 reads) and passes `ident_id`; `roleOn` reads `huntings` again. With the trusted-actor assumption this is all one object built once per request |
| Resource-state rules in the policy | ❌ | `locked` is checked in `quiz_actions.revisable()`. Archived/read-only/version rules would go the same way unless moved |
| Field exposure is a policy decision | ❌ | `lib/rows.ts` projects one shape per facet regardless of role |
| Rules are tested as a matrix | ◐ | `authorize.test.ts` covers 3 roles × 4 predicates and the review visibility lattice, and enumerates public functions. It does not cover every action kind × role |
| Policy is portable to the identity change | ◐ | Swapping `browser_key` for real identity touches every handler's first line |

**Recommendation.** State the policy as data, in one module, with three parts:

```ts
// convex/policy/actor.ts -- built once per request from the trusted identity; 0 reads
type Actor = { ident_id: Id<'idents'>, is_admin: boolean, smith_of: ReadonlySet<Id<'hunts'>>, reviewer_of: ReadonlySet<Id<'hunts'>> }
roleOn(actor, hunt_id): HuntRole | null        // pure

// convex/policy/verbs.ts -- what one can do, and to what
type Verb = 'read' | 'revise' | 'arrange' | 'export' | 'review' | 'manage_members' | 'manage_hunt' | 'admin_library'
const ActionVerbs: Record<HuntActionT['kind'], { verb: Verb, on: 'quiz' | 'hunt' | 'review' | 'library' }>

// convex/policy/rules.ts -- per table: where its hunt is, and the rule for each verb, over (actor, row)
const Rules = {
  quizzes:    { hunt: 'hunt_id', read: member, revise: smith.and(unlocked), arrange: smith, ... },
  questions:  { hunt: 'hunt_id', read: member, revise: smith.and(quizUnlocked), expose: byRole },
  reviews:    { hunt: 'hunt_id', read: own.or(shared.and(smith.or(reviewerWhoseOwnIsShared))), write: own },
  widgets:    { read: identified, write: admin },
  ...
}
```

`archived`, `read_only`, and "this is an old version" become more combinators on the same rows
(`unlocked`, `notArchived`, `isCurrentVersion`), evaluated against a row already in hand. The
business code never mentions them.

## 3. Does the way policy is *implemented* meet best practice?

| Practice | Status | Note |
|---|---|---|
| Server-side enforcement on every path | ✅ | Every public function checks; the client never decides |
| A chokepoint for writes | ✅ | `hunts.perform` + `idents.performAccount`; `authorize` then `perform` |
| Structural, not conventional, enforcement | ❌ | A new query that forgets `mayReadHunt` typechecks and passes. The public-function enumeration test will *list* it, but nothing proves it authorizes |
| Row filtering by rule | ◐ by hand | `reviews.forQuiz` filters per row with `mayReadReview`. `hunts.list` filters by `huntingsFor`. Each is a bespoke RLS |
| Field redaction by rule | ❌ | None |
| Cacheable public reads | ❌ | `browser_key` is an argument of every query, so no two browsers share a cached result or a subscription |
| Mutation reads inside its transaction | ✅ | Every action reads what it checks inside the same transaction; OCC serializes label races |
| Validation before authorization | ✅ | Zod on args at the door, then `authorize`, then `perform` |
| Refusals typed, messages author-facing | ✅ | `lib/refusals`, `notPermitted`/`notIdentified` |

**Recommendation.** Use the toolkit before hand-rolling (the Library-first rule):

* **`convex-helpers/server/customFunctions`** (`customQuery`, `customMutation`) to build the
  actor once and put it on `ctx`. We already use the Zod flavour (`zCustomQuery`); the same
  `input` hook is where `ctx.actor` is made. A function that wants to act then *cannot* forget
  authorization: it reaches for `ctx.actor` and `ctx.access`, and the raw `ctx.db` is not offered.
* **`convex-helpers/server/rowLevelSecurity`** (`wrapDatabaseReader`, `wrapDatabaseWriter`) for
  the "list resource x fitting criteria y and see only what I may" requirement. A rule per table
  takes `(ctx, row)` and says read / insert / modify; every `db.get`, `db.query`, `db.insert`,
  `db.patch`, `db.replace`, `db.delete` through the wrapped handle obeys it. The business code
  then queries by its own criteria only, and the policy filters. `convex-helpers` is already
  *Use* in `notes/stack.md`; this is another module of the same package (assumption: that makes
  it *Use* too, said so in `README.md` here).
* **Field exposure** is not something RLS does. Put it in `lib/rows.ts` as role-aware projections
  (one `exposed`-style list per role per model, as `Question.exposed` already is for formulas),
  chosen by the policy layer's verdict: `expose(actor, question)`.
* **Access modes** as the vocabulary the business code uses (§5).

One caution on RLS: its rule runs per row read, so a rule that needs the row's hunt must find it
*on the row*. That is the strongest reason for the denormalization in §6; without it, RLS would do
one `db.get` per row, which the rest of this project has been careful never to do.

## 4. Where policy and business logic are mixed

Found by reading `convex/` and the browser's role use. Each with where it should live.

| Where | What | Kind | Should live |
|---|---|---|---|
| `convex/authorize.ts:134-161` `isPlaced`, `isQuizOfHunt` | Verifies the client's `open` triple is coherent | Integrity, not authorization | Gone, once `open` is `{ quiz_id }` and the hunt is read off the quiz (§6) |
| `convex/writing/quiz_actions.ts:559` `revisable()` | Refuses a locked quiz | Resource-state policy | Policy rule `revise: smith.and(unlocked)` |
| `convex/writing/perform.ts` docblock and switch | Which actions a lock exempts (realm/hunt/library/review) | Policy, expressed as code structure | `ActionVerbs`: `arrange`/`manage_hunt`/`review` verbs are not gated by lock |
| `convex/writing/library_actions.ts:378` comment | "a locked quiz refuses none of this" | Policy in a comment | Same |
| `convex/writing/review_actions.ts:1157` | "a review is never refused for a locked quiz" | Policy in a docblock | Same |
| `convex/writing/hunting_actions.ts:187,208` `ownHunting` | Nobody changes their own membership | Policy | Rule on `huntings`: `write: smith.and(notSelf)` |
| `convex/hunts.ts` `open` handler | Non-member is shown existence and smiths | Disclosure policy | A per-table "existence is public" flag, with the denial *explanation* coming from the policy layer |
| `convex/reviews.ts` `forQuiz` | Per-row `mayReadReview` filter | Hand-rolled RLS | RLS rule on `reviews` |
| `convex/hunts.ts` `list` | Filters hunts by own huntings | Hand-rolled RLS | Trivial once `actor.smith_of ∪ reviewer_of` is in hand |
| `convex/widgets.ts` `usage`, `authorize.mayCountUsage` | A smith of any hunt may count | Admin-ish policy | `admin_library` verb |
| `convex/writing/account_actions.ts:64` | `newHunt` refuses `notIdentified` | Identity | The actor builder |
| `src/models/hunting.ts` `Hunting.mayAct`, `actFor` | Which presentation a role is shown | Presentation policy in a model | Fine where it is, but should be *derived from* the server's verdict, not a second copy |
| `src/components/ReviewScreen.tsx:224` `AnswerLock` | Hides `full_answer` client-side | Enforcement in the view | Server withholds until `peek_answer` has been recorded; the view shows what it is given |
| `src/components/QuizManageModal.tsx:94` | Quiz label uniqueness within realm | Integrity in the view only | Server check in `relabelQuiz` (see `integrity-plan.md`) |

What is *not* mixed, and should stay as it is: `convex/writing/*` refusing on **integrity**
grounds (`labelTaken`, `widgetGone`, `questionGone`, `sourceUnshowable`, caps). Those are
properties of the data, true for every actor, and belong with the write.

## 5. Separating them: the shape of the layer

The Coach asked for three distinct ways to ask for a resource. Proposed vocabulary (names are
first drafts; `notes/vocabulary.md` should settle them):

| Mode | Call | Absent | Present but forbidden | Use |
|---|---|---|---|---|
| **visible** | `access.visible('quizzes', (cvx) => …)` / `access.peek(table, id)` | `null` / omitted | `null` / omitted, indistinguishably | Watches, lists, anything a screen asks for. Never throws, so a watch never takes a page down |
| **entitled** | `access.entitled(table, id \| label, verb)` | `refuse('…Gone')` | `refuse('notPermitted')` | Inside `perform`: the actor was invited to act, so a refusal is news |
| **ensure** | `access.ensure(table, key, verb, make)` | made, if the actor may create under the parent | `refuse('notPermitted')` | `open_review`, `assume_ident`, `fetch-or-create label:foo` |

The business code (`writing/*`, projections) receives an `access` handle and rows; it never sees
`browser_key`, never calls `roleOn`, and never asks about locks. Concretely:

```ts
// before
export async function retitleQuiz(db, open, title) { await updateQuiz(db, await openQuizRow(db, open), { title }) }
// after
export async function retitleQuiz(access, quiz_id, title) { await updateQuiz(access, await access.entitled('quizzes', quiz_id, 'revise'), { title }) }
```

`entitled(..., 'revise')` is where `smith`, `unlocked`, and one day `notArchived` are evaluated,
against the row it just fetched: no extra read.

**The disclosure question** the modes raise, for the Coach: *visible* makes absent and forbidden
look alike, which is right for a hunt you are not on, except that `hunts.open` deliberately tells
a non-member the hunt exists and who its smiths are. The policy layer needs an "existence is
public" flag per resource (today: hunts yes, everything else no), and the deny explanation
(`notOnHunt` + smiths) should come from the layer, not the handler.

## 6. Where a lookup is still needed, and what denormalization buys

Given a zero-cost actor (`is_admin`, `smith_of`, `reviewer_of`), the question for every check is
"what else must I read?"

| Check | Reads today | Reads with the proposal | How |
|---|---|---|---|
| Who is asking | 2 (`identings` index, `idents` get) per function call | 0 | Actor from the trusted identity |
| Role on hunt | 1 (`huntings` index) | 0 | `actor.smith_of.has(hunt_id)` |
| Which hunt a **quiz** belongs to | 1 (`realms` get), plus `isPlaced`'s 2 | 0 | **Denormalize `hunt_id` onto `quizzes`.** Immutable (a quiz never moves), so no fan-out on update. `open` shrinks to `{ quiz_id }` |
| Which hunt a **question** belongs to | 0 | 0 | Already denormalized (`questions.hunt_id`) |
| Which hunt a **review** belongs to | 0 | 0 | Already denormalized |
| Which hunt a **widgeting / column** belongs to | 1-2 (quiz, then realm) | 0 | Denormalize `hunt_id`. Immutable. Cheap. Mostly matters for RLS on the frame facet |
| Which hunt a **widgeted / reviewing** belongs to | 2-3 | 0 if denormalized, else 1 | Denormalize opportunistically: these rows are nearly always reached through a parent already in hand. Do it when RLS reaches them |
| Quiz locked / archived / version | 0 extra (the row is being acted on anyway) | 0 extra | Rules evaluate against the fetched row |
| Own review is shared (reviewer reading another's) | 1 (`reviewFor`) | 0 | `reviews.forQuiz` already reads every review of the quiz (≤999); evaluate the rule over the set. Elsewhere, 1 read is fine |
| Review belongs to actor | 0 | 0 | `row.ident_id === actor.ident_id` |
| Widget exists for a `widget_label` | 1 | 1 | Inherent in label addressing. Not a policy read |
| Label uniqueness (hunt, quiz-in-realm, widgeting, column, widget, ident) | 1 index read each | 1 | Inherent; Convex has no unique index. OCC makes read-then-insert safe |
| Caps (`questionsFull`, `huntingsFull`, …) | reads the children (bounded), or `row_ordering.length` for questions (0) | same | A denormalized count per parent would make them 0 but adds a write per child change. Not worth it at these caps |
| Widget deletion (`isWorked`) | 1 | 1 | Inherent |
| **Admin** (library writes, usage counts) | `huntingsFor` (1) | 0 | `actor.is_admin` |

**Does denormalizing `hunt_id` scale?** Yes, because it is *immutable*: a quiz, widgeting, column,
question, review never changes hunt, so there is no update fan-out, only one extra field per row
and one more index (`by_hunt_id`) where we want hunt-wide reads (archive, export, delete-hunt
cascades, "everything of this hunt" for a future per-hunt widget scope). It costs a schema push
and a migration for `quizzes` on production (`notes/deploy.md`, *Schema pushes*). The pattern is
already established by `questions.hunt_id` and `reviews.hunt_id`; this finishes it.

**What not to denormalize:** counts, "own review shared", and anything about the *actor*. Actor
facts belong on the request.

## 7. Many readers

The design space says: be defensive about very many people reading. Two facts bear on it.

1. **Convex caches and shares a query result by (function, arguments, identity read).** Today
   every query takes `browser_key` as an argument, so every browser is its own cache entry and its
   own subscription: a change to a question re-runs `questions.open` once per watching browser,
   each run paying `identFor` + `huntingFor`. Under the new identity the key is the identity
   rather than an argument, but a function that *reads* the identity is still cached per user.
   For 100 smiths and 500 reviewers this is fine. For "a lot of people taking a quiz" it is not.
2. **The policy layer should know which rules depend on the actor and which only on the
   resource.** `shared`, `locked`, `archived`, `published`, `isCurrentVersion` are resource facts;
   `smith`, `member`, `own` are actor facts. A facet whose rule is *resource-only* and whose
   projection is *role-free* can be served by a query function that never reads the identity, and
   so is cached and pushed once for every reader. That is how a player-facing read would scale:
   a `published` snapshot of a quiz (immutable rows, no answers), addressed by label, authorized
   by its own state. The smiths' edits never touch those rows, so they never invalidate that cache
   and never contend with it in OCC.

Nothing to build now. The ask is only that the layer be designed with the actor/resource split
explicit (§2's `Rules` makes it so), so that a public facet is a new rule, not a new mechanism.

## 8. Admin, and the library

The Coach says admin acts bear an extra token and may go to another endpoint. Today the library
rides `hunts.perform` from inside a quiz, authorized as a smith of the open hunt. Proposal:

* Split `LibraryActionKindVals` out of `huntAction` into a `library.perform` mutation of its own,
  gated by `actor.is_admin` (and the token, however the identity design delivers it). `widgets.
  usage` moves under the same gate. `widgets.library` stays readable by any identified actor.
* The browser already dispatches library actions through a distinct path (`src/state/widget-edit.
  ts`); the UI change is who sees the editor's write affordances.
* Product consequence to confirm: today a smith adds a widget to the library while building a
  quiz. If only admins may, smiths need a way to propose or to work a *private* widget. A future
  `scope` other than `pub` (the field is already there, closed to `pub`) would put a hunt's own
  widgets under the hunt's policy, and that is the natural answer; it is not in this plan.

## 9. `/api/ask`

Outside Convex, so outside RLS, but the same actor should reach it: the route should refuse a
request without the identity (and, since asking spends money, should know the actor is a smith
of *some* hunt, which the trusted lists give for free). `Approval.need` already has an `ident`
parameter that is passed `null`; it is the right seam. Also the one place `convex-helpers`' rate
limiter (listed under Discuss in `stack.md`) would earn its keep.

## 10. What is good and should be kept

* `authorize.test.ts`'s enumeration of every public function. Extend it: every public function
  must be built with the actor-bearing builder, so the test can assert that structurally.
* Queries return `null`/`[]` rather than throw. The *visible* mode keeps this.
* Zod → authorize → perform, in that order, one mutation.
* Integrity refusals in `writing/`, author-facing messages in `lib/notices`.
* `questions.hunt_id` and `reviews.hunt_id`: the denormalization pattern this review extends.
