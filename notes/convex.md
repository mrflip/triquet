---
paths:
  - "convex/**"
  - "tests/convex/**"
  - "src/state/**"
  - "src/lib/rows.ts"
---

# Convex

How this project uses Convex. This file loads itself when work touches `convex/`, its tests, the
browser's hooks in `src/state/`, or the row-to-tree projections; nothing here needs remembering
between sessions. `CLAUDE.md` keeps the ports and the backends, and the rule that agents never
touch the human's `dev` backend.

## The shape of the data

Storage is Convex, replacing Jazz in September 2026; Turso is out for good. The evaluation's
verdict is `notes/database-decisions.md` and its decision `notes/decisions/2026-09-convex.md`. The
plan and its handoff are `whiteboard/convex_yay-plan.md` and `whiteboard/convex_yay-progress.md`:
the thread's history, read when a question is "why is it like this", not as spec.

Rows, not a tree. A view dispatches an action, the `hunts.perform` mutation (`widgets.perform`,
for the library) writes the rows it comes to, and views subscribe to query functions that
assemble what a screen shows (`notes/queries_hooks_and_subscriptions.md` has the words: query
function, watch, fetch, facet, screen hook). Row ids are Convex's `_id` and internal: refer by
label. Zod validates every function's arguments and every row written, never rows read back. A
change to a row shape that rows already written would not fit is a migration on production
(`convex/migrations.ts`, and `notes/deploy.md` for the order of steps); a local backend is simply
emptied and pushed again.

## Stamps

The rows a person makes and edits (hunts, quizzes, questions, reviews, reviewings: `StampedTables`
in `convex/stamping.ts`) carry `created_at` and `updated_at`, epoch milliseconds. They are written
in one place: every public mutation's database is `stampingWriter`, which gives an inserted row
both from the moment of the mutation, moves `updated_at` on a patch that changes anything, and
sets aside whatever stamps a write carries. A row validator gives a row it checks the stamps of the
moment (`ValidatorKit.stamp`), so writers never name them; an internal mutation writes raw, and
stamps nothing but what it says. A reader takes a row's stamps through `Stamps.of`
(`src/lib/stamps.ts`), which reads a row written before stamps as the backfill will stamp it. A
person reads them as ISO-8601 UTC strings (`Stamps.isoOf`), in the balls and the tables.

## Denormalized fields

A row carries copies of what policy needs from the rows above it, so that the evidence for a
decision is one parallel round of `.get`/`.first`, with no read waiting on another only to learn
which hunt a row is of. The copies:

The rule: **a copy is written when its row is, and never changes after**, since nothing moves
between parents (a quiz does not change hunts, an ident's label is fixed). The one exception is
`huntings.ident_title`: retitling an ident (`retitleIdent`) rewrites it on every hunting the ident
has, a fan-out bounded by the hunts one ident is on. A copy that would need upkeep beyond that is
not added; a new one goes in this table, and in `Copies` in `tests/support/soundness.ts`, which
`expectSound` checks against its source. A reviewing does not copy its review's `phase`, which
changes: whatever needs it reads the review.

## Who is asking

A browser is a Convex Auth session (`convex/auth.ts`; anonymous for now), and asserts a username
on top of it. No function takes an argument saying who is asking: the builders in
`convex/functions.ts` (`zQuery`, `zMutation`) build it once per request (`askerOf`: the session,
if Convex Auth still holds it, its user, the newest identing, the ident) and hand it to every
handler as `ctx.actor` (`src/lib/actor.ts`: anonymous, or an ident) and `ctx.user_id` (the
session's user, null with no session). A builder layered over these calls `askerOf` rather than
reading identity a second way. Tests call as a session: `identified(tt, label)` and `signedIn(tt)`
in `tests/support/convex.ts`.

Who may do what is decided in one place and gathered in another. `src/lib/approve.ts` holds every
policy, a non-async `may…` function deciding from the claims it is handed, reachable by key
through `Approve.may`, `Approve.must` and `Approve.verdictOn`; its dispatch table gives every
action kind its policy, and a kind without a row fails to compile. `convex/authorize.ts` holds the
`affirm…` functions that read the evidence and build the claims, and decide nothing. A request
about a hunt carries the browser's **affirms** (its ident, the hunt, its standing there, the quiz
on screen), and `affirmForHunt` checks them all in one parallel round of reads (`EST.allKeyed`),
with whatever else the decision needs read beside them; a stale or forged affirm is a denial like
any other. A denial is thrown (`Approve.NotApprovedError`): a mutation's `refusingInvalid` turns it
into a refusal of its kind, and a query wraps its work in `emptyIfDenied` (`functions.ts`) so it
answers with its empty value, since a watch that throws takes the page down. Business code in
`writing/` is handed the claims, trusts them, and takes the rows they carry (the quiz on screen,
its realm) rather than reading them again. A quiz's lock is policy (`Approve.mayReviseQuiz`), not
the write's. The browser asks the same policies of the same claims: `idents.current` hands a
session the actor the server builds for it, and a screen's views decide what to offer from
claims built on it (`notes/views.md`, *What a view offers*).

Once affirmed, a function about one hunt holds a **scoped database**: the builders `zHuntQuery`
and `zHuntMutation` run its `affirm` on the plain database, then hand its handler the claims
(`ctx.claims`) and a `db` wrapped by convex-helpers' row-level security, held to one non-async rule
per table in `convex/policy_rules.ts`. A row of another hunt reads as absent and a write to one
throws, so a function that forgets a check still cannot reach another hunt. A query's rules
differ from a mutation's only for reviews: a query shows the ones its reader may read
(`Approve.mayReadReview`), a mutation sees them all to count and delete them. Identings and Convex
Auth's tables are not reachable through it; idents are read, never written. The two facts a write
must know across hunts (a hunt label's holder, a widget worked anywhere) are asked of the
**census** (`ctx.census`) instead. The library belongs to no hunt, and no hunt's function writes
it: changing it is an admin's act (`Approve.mayChangeLibrary`, and `Actor.isAdmin`, the one place
that says who an admin is), on a mutation of its own, `widgets.perform`, built by
`zLibraryMutation`, whose database reaches the library's widgets and nothing of any hunt
(`LibraryRules`). The public functions that hold the whole database, acting before any hunt is in
play or across hunts, are named in `Unscoped` (`convex/authorize.ts`) with why, and a test holds
every public function to one or the other.

What a query sends is shaped by the reader's **standing**, not only gated by it. A question is sent
as `Question.sentTo` lists for that standing (`seenQuestionFor` in `src/lib/rows.ts`): a smith all
of it, a reviewer what a review needs (the answer included: the review screen's lock is a spoiler
shield, not a security rule). A change to who is sent what is an edit to that list. The whole hunt
(`hunts.whole`, the export) is a smith's alone (`Approve.mayExportHunt`).

Convex Auth's tables (`users`, `authSessions`, `authAccounts` and the rest) are spread into
`convex/schema.ts` as it ships them (`authTables`): they are its own, written only by it, and not
derived from a row validator of ours. `tests/convex/schema.test.ts` leaves them out.

## Before the first Convex edit of a session

Read `convex/_generated/ai/guidelines.md`. It is Convex's own guidance, regenerated by
`npx convex ai-files`, and it is the floor: the object-form function syntax, validators on every
argument, indexes over filters, bounded reads. It is a pointer rather than part of this file
because it is long (about 30k characters) and not ours to edit. Where it and this file differ,
this file wins; the list below is the whole of the difference.

## Where this project departs from Convex's guidelines

Convex's guidelines target `^1.44.0` (fetched 2026-09-27). "Settled item N" names an entry in
the *Settled* list of `whiteboard/convex_yay-progress.md`, where the reasoning was recorded.

* **`import { v as CVX }`**, never `v`. Settled item 1; `eslint` refuses the paste
  (`triquet/convex-values-as-cvx`).
* **No `returns` on a query that hands back documents**; mutations say `CVX.null()` or an id.
  Settled item 4.
* **Tests live in `tests/convex/`**, not beside the functions in `convex/`: `notes/testing.md`
  keeps the test tree apart from the source. `import.meta.glob('../../convex/**/*.*s')` gives
  convex-test its modules from there; it finds the root by the `_generated` path.
* **Bounded reads, by our caps.** The guidelines say never `.collect()`, always `.take(n)`. A
  read of a parent's children takes the cap from `lib/vv/patterns.ts`
  (`.take(PA.QuestionsPerQuiz.max)`), and a write that would pass it is refused, so a read never
  silently drops a row. Two reads are not capped: a stored cell's history (`widgeteds`, one
  question and one widgeting), walked newest first and stopped at the first `ok` row (so it reads
  one row, plus one per failure since), and a question's or a widgeting's widgeteds when it is
  deleted, iterated with `for await` as the guidelines ask.
* **Module names are underbar_case** under `convex/` and `tests/convex/`: Convex refuses a hyphen
  in a module path, which `unicorn/filename-case` otherwise demands. An eslint block
  (`triquet/convex-module-names`) allows it there only.
* **Query builders are `cvx`** in `withIndex` and `filter` callbacks, where Convex's docs say `q`
  (`STYLE.md`). `qn` is a question's shorthand and never a builder.

## Skills to reach for

The Convex skills under `.claude/skills/` are pulled, never pushed: nothing loads one until it is
named. These are the moments to name one.

* **About to use a Convex API this repo has not used yet**, or unsure of a signature or a
  version's behaviour: `/convex-docs` first, rather than writing it from memory.
* **A schema or function-design question the guidelines file does not settle** (an index shape,
  a pagination form, an action-versus-mutation call): `/convex-expert` or `/convex-design`.
* **Before marking a PR that touches `convex/` ready**: `/convex-reviewer`, alongside the full
  test run `CLAUDE.md`'s Git section asks for.
* **Writing tests for a function family**: `/convex-test` and `/convex-verify` know convex-test;
  `notes/testing.md` wins on where tests live and how they assert.

The skills that talk to a deployment (`convex-insights`, `convex-advisor`, `convex-monitor`,
`convex-cost`, `convex-deploy-guard`, `convex-launch-readiness`) assume a Convex Cloud deployment.
Here every role runs a local backend, and agents never deploy (`notes/deploy.md`), so use one of
those only when a Coach points you at a deployment.

## Limits

This script works with `30_000` but fails with `40_000`, not sure what the actual limit is. If you just need "a large number", use 9321 which is easy to count the digits of and discover in a log

```
./scripts/doppledo prd_janitor npx convex data widgetings --limit 30000 --format jsonl | jq -c 'select(.label == "position" or .label == "forced_label" or .label == "id")'
```