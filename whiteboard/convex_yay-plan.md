# Convex, yay: moving the app off Jazz

Status: plan, 2026-09-27, written for the implementing agent (Opus) and agreed in outline with the
Coach (Flip). **Extended 2026-09-28**: phases 0 to 2 are built on `20260928-convex_phase4` (not
yet merged) and the app runs on Convex alone; *Where this stands*, under *Phases*, says what is
left of the move, and the hunts-and-playtesting thread (`whiteboard/hunts-and-idents.md`, PR 4
onward), which paused for it, resumes here as phases 5 to 7.

**What we are doing.** Replacing Jazz v2 with [Convex](https://docs.convex.dev) as the database,
keeping every model, every action, every view and every test's intent. The move is also an
evaluation: `notes/database-decisions.md` scored Convex highest on paper, and the question this
work answers is whether its ergonomics and boringness in practice make up for what we give up
from Jazz (true local-first: a silent account, work with the network off, rows in the browser).
The answer, in writing, is one of the deliverables (phase 4).

**What we are not doing.** Migrating data or preserving ids. There are no users; the Coach's
quizzes come back through the Import box. Every dev database may be wiped freely.

Read first, in this order: `CLAUDE.md`, `STYLE.md`, `notes/vocabulary.md`, `notes/guidelines.md`,
`notes/database-decisions.md` (the scorecard this is testing), `notes/decisions/2026-09-jazz.md`
(*The shape of the data* and *Learned in the move*: what to keep and what was a Jazz workaround),
`notes/decisions/2026-09-client-first.md`, `notes/deploy.md`, `notes/testing.md`, and then
`notes/prior-work/jazz-migration.md` for how the last move was run. Then this document, then
`whiteboard/convex_yay-progress.md` if it exists (it is newer than this plan wherever they
disagree). For phases 5 to 7, also `whiteboard/hunts-and-idents.md` and
`whiteboard/hunts-and-idents-handoff.md`: what they say the app should do stands; how they say to
build it is Jazz's, and the phases here say what replaces it.

## Ground rules for every session on this thread

* **Work from the current Convex docs and the installed source, not recall.** Convex is stable
  and well trodden, but it moves: `.optional()` on every validator arrived in 1.46 (September 2026),
  `schema.doc()` in 1.44. Versions checked 2026-09-27: `convex` 1.46.0, `convex-helpers`
  0.1.124, `convex-test` 0.0.60, `@convex-dev/auth` 0.0.95. Verify before installing; pin exact.
  Run `npx convex ai-files install` in phase 0 and read what it puts in the repo: it is Convex's
  own rules file for agents (the `convex_rules.txt` conventions), and this plan defers to it on
  Convex idiom wherever the two agree with `STYLE.md`, and lists the collisions below where
  they don't.
* **Each phase is one pull request, of one or many commits**, branched with `pnpm run newb
  <label>`. Each ends green: `pnpm lint && pnpm typecheck && pnpm test`, and `pnpm test:e2e`
  from phase 2 on. A `/code-review` pass at the end of each.
* **Each PR updates `whiteboard/convex_yay-progress.md`** (see *The progress document* below).
  It is the handoff: the next agent reads it before this plan's phase text.
* **Discuss major deviations, unusual discoveries and blocked paths with the Coach in chat, before
  building around them.** No heroic workarounds. A workaround of more than a dozen lines for
  something the framework should do is a conversation, not a commit. Where this plan turns out
  to be wrong about Convex, say so and propose the alternative; don't quietly route around.
* **Same conceptual models, same test intent.** Every test today has a successor of equal or
  greater coverage. A test deleted without one is named in the progress document and in
  `HUMAN-whatsup.md`.
* **Ids stay internal, and are spelled `_id` everywhere.** Convex's `_id` replaces Jazz's `id` in
  rows, and the tree types (`QuizT`, `QuestionT`, `HuntT`, `RealmT`, `IdentT`) rename their `id`
  to `_id` too, so one spelling runs from the database to the projection and nothing translates
  between them. Business logic, URLs, exports, git paths and formulas keep working by label.
  Tests find rows by label, never by `_id`, except where the key itself is what is under test:
  a test of the database layer may assert that an insert's id is the one a read finds, or that
  `quiz_id` points at the quiz it should. A test of a quiz's behaviour never mentions one.
* **Install what the work needs.** `convex`, `convex-helpers`, `convex-test`, `@convex-dev/auth`
  and whatever else this plan names may be installed without asking; a package this plan does
  not name is proposed in chat first, as `notes/stack.md` says.
* **Convex's generated code is committed** (`convex/_generated/`), marked `-diff` in
  `.gitattributes` as `pnpm-lock.yaml` is, and **a large regeneration goes in a commit of its
  own** so the reviewable diff stays readable.
* **Field names stay `underbar_case`.** Convex allows it (alphanumerics and underscores; a name
  may not start with `_` or `$`), and only its own system fields are camelCase (`_id`,
  `_creationTime`). Convex's examples and the agent's training are camelCase; hold the line
  anyway, wholesale, no mixed names. Table names stay as they are.
* **Robust Zod at the boundaries, and none on the way back.** Form entry, import/export and the
  ask contract keep the validators they have. Every Convex function's arguments are validated
  with our Zod schemas (through `convex-helpers`' Zod 4 bridge), and every row still passes its
  row validator before it is written. Rows read back from the database are trusted: no
  `returns` validator on a query that hands back documents, and no re-parse of them in the
  browser. Convex's own schema validation is the second net, as Jazz's was; but the mutation is
  now a real server-side chokepoint, so the first net finally runs where a client cannot skip it.
* **Global resources**: as `CLAUDE.md` says. Agents get their own Convex deployment beside their
  own Next dev server, never the human's. How that is done is a phase 0 answer (below).
* **Agents never deploy to production.** Convex's production deploy key lives only in
  `prd_janitor`; the Coach runs production deploys and Vercel does the rest.

## Decisions carried in from the Coach

* Convex is the database. Turso stays out. Drizzle does not return. Jazz code does not survive;
  what we learned does (`notes/decisions/2026-09-jazz.md`, *Learned in the move*).
* No migration path, no id preservation.
* `underbar_case` field names, as above.
* One schema drives the others where the framework lets it; where not, a mechanical check holds
  the copies together. See *Schema: one source* below.
* Zod at form entry, import/export, and at reasonable chokepoints in the data flow, without
  deviating from Convex's standard practice to get it. Nothing validates rows on the way back
  from the database.
* Models have no optional fields; a field that may be empty is nullable.
* Reads follow standard Convex and React practice: small queries, one per thing a component
  renders, joined on the server, never a whole-hunt firehose. See *Reads* below.
* Where `STYLE.md` or another note collides with Convex's expectations, or with what agents have
  trained on, raise it; the likely outcome is to follow Convex and amend the note. The
  collisions this plan already saw were settled on 2026-09-27; they are listed next, with the
  ones still open after them.

## Settled with the Coach (2026-09-27)

Record each in `STYLE.md` or `notes/stack.md` during phase 0, then move it to the progress
document's *Decisions taken*.

1. **`CVX`, not `v`, enforced.** `import { v as CVX } from 'convex/values'`, then `CVX.string()`.
   The no-single-letter rule stays unqualified: the whole point of it is that `\bCVX\b` renames
   in one command and `v` never will. An eslint `no-restricted-syntax` selector flags a local
   binding named `v` imported from `convex/values`
   (`ImportSpecifier[imported.name="v"][local.name="v"]`), with a message naming the alias, so
   an agent that pastes a doc example is corrected by the linter rather than by a reviewer.
   Convex's docs, the rules file and the training corpus all say `v`; expect a stutter or two per
   session early on, and the rule to absorb them. Record beside `_` and `JZS` in `STYLE.md`.
2. **`_id` everywhere.** Rows carry Convex's `_id` and `_creationTime`; the tree types rename
   their `id` to `_id` so the spelling is one from database to screen. Our own fields never start
   with `_`. `lib/ids.ts` keeps minting a UUID for a tree node not yet written, and `treeid`
   accepts a Convex id string, a UUID, or an old export's ULID. (The Coach asked for one spelling
   and for the app to stay distanced from ids; taking Convex's spelling rather than mapping it
   away is this plan's reading of that. The alternative, mapping `_id` to `id` at the read
   boundary, is a translation layer of exactly the kind `database-decisions.md` counts against.)
3. **Commit `convex/_generated/`**, with `convex/_generated/** -diff` in `.gitattributes`
   beside `pnpm-lock.yaml`, eslint ignoring the directory, and a CI step that regenerates and
   fails on drift. Volume: five files (`api.d.ts`, `api.js`, `dataModel.d.ts`, `server.d.ts`,
   `server.js`), a few hundred lines in all; `api.d.ts` grows a few lines per function, and
   `dataModel.d.ts` re-emits on every schema change. Small, but a regeneration touching many
   lines goes in its own commit.
4. **No validation of rows read back.** Queries that return documents declare no `returns`
   validator and the browser does not re-parse them; TypeScript's inferred return type is the
   contract. Mutations return `null` or an id, and say so with `returns: CVX.null()` or
   `CVX.id('quizzes')`, which is cheap and what Convex's rules ask for. This is a stated
   departure from Convex's "always include `returns`" for the read side; record it in the rules
   overrides the progress document keeps.
5. **Nullable, never optional, in stored rows.** Convex distinguishes an absent field
   (`CVX.optional`, TypeScript `undefined`) from `null`. Our patch pattern gives three meanings
   to absent, null and value, and a document always carries every field. `zodToConvex` maps
   `.nullable()` to `CVX.union(x, CVX.null())` on its own.
6. **Reads follow Convex's and React's grain.** Small queries, one per thing a component renders
   (the hunts list, the open quiz assembled, a realm's quizzes for the switcher, a hunt's
   expressions, a quiz's reviews), each joined on the server inside the query function, each
   subscribed to by the one route component that needs it and handed down as props, as the
   views already expect. No whole-hunt query. Fewer, narrower subscriptions also mean fewer
   redeliveries, less bandwidth and fewer function calls (the two numbers that drive the price),
   and less React work per change. Detail under *Reads* below.
7. **The ask route stays as it is.** Nothing in this move touches `src/app/api/ask/route.ts` or
   `api/bots`: the browser posts to them and dispatches the result through `perform` exactly as
   today. The one thing that would force a change is identity: if the identity plan means the route must
   verify who is asking, we do not build permissioning into a Vercel function; asking moves
   into a Convex action (`'use node'`, the Anthropic SDK, the key in Convex's environment) and
   the action records the botting itself. Until then, leave it be.
8. **Packages named in this plan may be installed** without asking.
9. **`convex/` lives at the repo root**, Convex's default and what every agent knows, all the
   more since generated code lives in it. `CLAUDE.md`'s *Architecture* gains the entry below.
10. **Structured values are ordinary fields.** Under Jazz, `bulk_ishes_last` and
    `bottings.response` were JSON text behind a typed transform (`jsonText`, because an optional
    JSON column refused every value), `bottings.items` was a JSON-schema column, and
    `last_sortkey` went through a transform. Convex documents hold nested objects, arrays and
    unions natively, so all four become plain nullable fields derived from their Zod schemas
    like every other, with nothing special at the coding end: no `jsonText`, no transforms,
    no `UU.jsonify` on the way in or `JSON.parse` on the way out. `tests/db/json-text.test.ts`
    goes with the module and needs no successor.

11. **`convex-helpers` is in.** A Convex-maintained companion at 0.1.x whose `server/zod4`
    module is how Zod schemas become Convex validators and how a function takes Zod `args`: the
    supported path, and what makes *one schema drives the others* possible. Pinned exact, listed
    under Use in `notes/stack.md` with this reason and a note that its version number would
    otherwise make it Discuss.
12. **Goodbye offline.** The client-first decision is amended, not reversed: "static hosting plus
    stateless functions" stands; "works with the network off" is struck; the sync server
    exception becomes the Convex deployment. Pages still prerender at build and user data never
    renders on our server. `e2e/client-first.spec.ts` gets a successor in phase 2.
13. **Identity for the trial is a browser key.** A UUID minted once into `localStorage` and
    passed as an argument to the functions that read or write this browser's identing; nothing
    authorizes on it because nothing is authorized in the wide-open trial. This knowingly
    contradicts Convex's rule "never accept a user identifier as an argument for authorization";
    it is not authorization yet, and the identity plan (below) is where it stops being one.
14. **The views receive a shallow hunt.** Following Convex's grain (item 6), the route component
    holds the open quiz assembled, a shallow hunt (its own row, its realms with their quizzes'
    rows, its expressions each with a widget usage count), and the quiz's reviews. `Workbench`,
    `QuizSwitcher`, `QuizNotFound`, `ExpressionsModal` and `WidgetsEditor` read
    `hunt.expressions` and `hunt.realms[].quizzes` for titles, labels and locks, which the
    shallow hunt still carries; `Hunt.expressionUsage` becomes the count the expressions arrive
    with. `HuntT` stays as the whole tree for export, import, `Hunt.blank` and `writeHunt`, and
    the Export box fetches it once with a one-shot query. The prop changes are phase 2's.
15. **This plan ends with the app working as it does today, on Convex.** Phases 0 to 4. Identity
    (Convex Auth or a hub) and the resumption of hunts-and-idents at PR 4 get a plan of their
    own once phase 4's verdict is in; *Identity, later* below is the brief for it, not a phase.
    *Amended 2026-09-28 (Coach):* hunts-and-idents PRs 4 to 6 resume in this plan as phases 5
    to 7, on the browser key; the identity plan follows them rather than preceding them.
16. Put caps in place for oother things: 99 each for widgets, columns and expressions, and 999 for reviews

## For the Coach

What needs a human, and when. Each is mirrored in `HUMAN-whatsup.md` and the progress document
as it comes due. As of 2026-09-28:

* **Done**: `NEXT_PUBLIC_CONVEX_URL` in `dev_claude` and `dev_e2e`; Convex's AI files installed;
  Jazz's files, skill and data directories removed.
* **Still open from phase 2**: retire the Doppler variables nothing reads (`JAZZ_DEV_DATA_DIR`
  and `JAZZ_DEV_PORT` in `dev_claude` and `dev_e2e`; `NEXT_PUBLIC_JAZZ_APP_ID` and
  `NEXT_PUBLIC_JAZZ_SERVER_URL` in `dev_claude`). (The `.env.local` at the checkout root is the
  CLI's, rewritten on every push, harmless; and stale `.next*/dev/types` no longer fail
  typecheck.)
* **For phase 3b**, whenever it suits: a Convex team and project; a production deploy key into
  `prd_janitor`; a preview deploy key into Vercel's preview environment through Doppler's sync;
  Vercel's build command set to `npx convex deploy --cmd 'pnpm build' --cmd-url-env-var-name
  NEXT_PUBLIC_CONVEX_URL`. Then the first production deploy. Nothing in phases 3a to 7 waits on
  this: every agent phase runs on local backends.
* **Phase 6**: the huntings cap. **Phase 7**: the answer to its one design question (a query
  refused, or a query answering "not yours"), before it is built.

## Architecture after the move

`CLAUDE.md`'s *Architecture* section, as it will read. Imports still run down the list, never up.

* `convex/_generated/` -- Convex's generated types and function references (`api`, `internal`,
  `Doc`, `Id`). The bottom of the stack: everything may import its types.
* `src/lib/`, `src/models/` -- unchanged, peers. `models/` gains nothing Convex-specific: its
  row validators are what `convex/schema.ts` is derived from, and it imports nothing from
  `convex/` but the generated types. The pure projections from rows to tree (`quizFrom`,
  `huntFrom`, `quizRowsOf`, `huntRowsOf`, `huntListingsOf`, `reviewRowFor`, `huntRowFor`) move
  from `src/state/quiz-rows.ts` to `src/lib/rows.ts`: they now run inside query functions on
  the server, and `lib` is where pure functions over one concern live.
* `convex/` -- the server side, and the whole of it. `schema.ts` (tables, derived from the row
  validators, with indexes); `authorize.ts` (the one place authorization is written: a no-op
  seam during the trial, pointing at hunts-and-idents PR 6); one file per noun for the public
  functions (`hunts.ts`, `idents.ts`, `reviews.ts`, `bots.ts`, later `ask.ts`); `writing/` for
  the row-writing logic the mutations call, ported from `src/state/{quiz-writing,
  quiz-actions, layout-actions, review-actions, account-actions}.ts`; `testing.ts` for the
  internal mutation that clears a dev or e2e deployment. `convex/**` may import from `src/lib`
  and `src/models`, and from nothing else in `src/`.
* `src/state/` -- the browser's side, thinner: the hooks (`use-hunt`, `use-ident`,
  `use-hunts-list`, `use-account-actions`, `use-asking`, `use-bots`), the browser key, the quiz
  history mirror and its scheduler. Hooks call `useQuery`/`useMutation` with references from
  `convex/_generated/api`. The action vocabulary moves to `src/models/actions.ts`, with a Zod
  discriminated union of it, since `convex/` validates it and may not import from `state/`.
* `src/app/`, `src/components/` -- unchanged in role. `providers.tsx` mounts `ConvexProvider`.
  The route handlers under `api/` stay (settled item 7).
* `tests/` mirrors `src/` and `convex/` path for path: `tests/convex/**` runs under
  `convex-test`; `tests/support/convex.ts` replaces `tests/support/jazz.ts` with the same
  surface (`seedHunt`, `act`, `read`, `openOf`, `huntHolding`).
* Gone: `src/db/` entirely (schema, permissions, json-text, sync-settings, the runtime asset
  copying, `migrations/`), `next.config.ts`'s `withJazz`, `scripts/jazz_*`,
  `scripts/nuke-jazz_local`, the `migrations` CI job, `.claude/skills/jazz`, `public/jazz/`.

## Schema: one source

The Zod row validators in `src/models/*.ts` are the source. `convex/schema.ts` derives each
table from them:

```ts
import { defineSchema, defineTable } from 'convex/server'
import { zodToConvexFields } from 'convex-helpers/server/zod4'   // verify the exact export in phase 0
import { QuestionValidators } from '../src/models/question'

export default defineSchema({
  questions: defineTable(zodToConvexFields(QuestionValidators.row.shape))
    .index('by_quiz_id', ['quiz_id']),
  // ...
})
```

What the conversion keeps: object shape, nullability, enums (`oneof`), unions of literals,
nested objects and arrays (`bottings.items`, `quizzes.bulk_ishes_last`), integers as
`CVX.number()` (Convex has no `int` short of `CVX.int64()`; the row validator's `uint` is the
check). What it cannot keep, and which is the row validator's alone as it was under Jazz:
regexes, lengths, `templateLiteral` (`last_sortkey` becomes `CVX.string()` or a union the
bridge can express; phase 0 finds out which), refinements, defaults and transforms.

Relations: a `quiz_id: rowid` field in Zod must become `CVX.id('quizzes')` in Convex, so the
kit's `rowid` is replaced per field by `zid('quizzes')` from the same bridge (the row validator
then knows which table it points at, which is more than Jazz let it say). `treeid` (a tree
node's `_id`: the row's once written, a minted UUID before) widens to accept Convex's id strings.

Where the bridge refuses a shape, the field's Convex validator is written by hand beside the
derived ones, and **a canary test** (`tests/convex/schema.test.ts`) holds the two together: for
every table, the derived-or-hand-written table validator accepts a `fill`ed sample row and
refuses a wrong-typed one, and the set of field names equals the row validator's. This is the
successor of `tests/db/coherence.test.ts`, much smaller because there is no longer a second
authored copy. If the bridge turns out to refuse enough shapes that most tables are hand-written,
stop and raise it: that is the "may not be possible" the Coach anticipated, and the answer is
then the coherence test as it stands today, not a partial derivation.

Indexes, named as Convex names them (`by_field`, `by_field1_and_field2`):
`identings.by_browser_key`, `idents.by_label`, `hunts.by_label`, `realms.by_hunt_id`,
`expressions.by_hunt_id`, `quizzes.by_realm_id`, `questions.by_quiz_id`, `widgets.by_quiz_id`,
`columns.by_quiz_id`, `bottings.by_question_id_and_bot_label_and_textkind_and_status`
(so the newest done and the newest failed botting of a slot are each one `.first()`),
`reviews.by_quiz_id`. Every read in a function
goes through `withIndex`; `.filter()` only after one, and never a `.collect()` on an unindexed
table. `_creationTime` is appended to every index, so "the earliest of two idents with one
label" is `withIndex('by_label', q => q.eq('label', label)).first()`.

## Validation, boundary by boundary

* **Form entry**: unchanged. `useDraft`, `IdentGate`, the editors keep their validators.
* **Import/export**: unchanged. `models/import.ts`, `lib/importing.ts`, `lib/exporting.ts`.
* **Function arguments**: `zCustomMutation`/`zCustomQuery`/`zCustomAction` from
  `convex-helpers/server/zod4`, with our Zod schemas as `args`, so the full Zod check (labels,
  lengths, the patch pattern's three states) runs on the server before the handler. The action
  vocabulary gains a Zod discriminated union (`HuntActionValidators.action` in
  `src/state/actions.ts`, or `src/models/actions.ts` if `convex/` needs it, since `convex/` may
  not import from `state/`; prefer `models/`), so `perform`'s one argument is validated whole.
* **Before every write**: `convex/writing/*.ts` keeps today's discipline: each update validates
  the row as it would stand (`QuestionValidators.row({ ...held, ...patch })`) and patches only
  the changed fields; each insert validates whole.
* **On the way back**: nothing. Documents a query returns are trusted as read; mutations declare
  `returns: CVX.null()` or an id (settled item 4).
* **Convex's schema validation** at write time is the second net; its refusals are not messages
  for an author, exactly as Jazz's were not.

## Reads

Standard Convex practice is a query per thing a screen shows, doing its joins on the server
with indexed reads, and standard React practice is one subscription at the route component
with props handed down. That is what the views already expect (`QuizRoute` hands `hunt`,
`realm`, `quiz`, `reviews`, `dispatch` to `Workbench` and `ReviewScreen`), so the change is in
`use-hunt.ts` and the query functions, not in the components' contracts beyond settled
item 14.

The queries, each in `convex/<noun>.ts`, each reading only by index:

* `hunts.list` -- every hunt with its realms and each realm's quiz rows, for `HuntsList`. The
  one listing that reads across hunts; wide open today, filtered by membership at PR 5.
* `hunts.open({ hunt_label })` -- the shallow hunt: its row, its realms in order, each realm's
  quiz rows, its expressions in order (each with its widget usage count), or `null` when no
  hunt answers to the label (the earliest, should two). What the switcher, the expressions
  editor, `QuizNotFound` and the mirror's place need.
* `quizzes.open({ quiz_id })` -- one quiz assembled by `quizFrom` on the server: the quiz row,
  its questions, widgets and columns in order, and **the newest botting per slot**, read as
  three indexed `.order('desc').first()` lookups per question
  (`bottings.by_question_id_and_bot_label_and_textkind`) rather than every botting a question
  ever had. Bounded whatever the history's length; the 16,384-document read limit stops being
  a concern.
* `reviews.forQuiz({ quiz_id })` -- a quiz's reviews, oldest first, for `ReviewScreen` and
  `ReviewsPanel`.
* `idents.current({ browser_key })`, `idents.all` -- as before.
* `hunts.export({ hunt_id })` -- the whole `HuntT`, every quiz whole, for the Export box: called
  once with `useConvex().query(...)` when the box is opened, never subscribed.

`use-hunt.ts` subscribes to `hunts.open` for the address's hunt, then `quizzes.open` for the
quiz the labels resolve to, then `reviews.forQuiz`; `useQuery` with `'skip'` while an argument
is not yet known. A change to one question re-runs `quizzes.open` for the quizzes that hold it
(one, in practice) and nothing else. `HuntHandle` keeps `finding`, `realm`, `quiz`, `reviews`,
`unsaved`, `saveNotice` and `dispatch` as they are; `hunt` becomes the shallow shape.

Do not add a `useQuery` per row or per cell: one subscription per screen-level thing, props
below it, as now. The formula bag (`Expressed.forQuiz`) is computed in the browser from the
assembled quiz and the hunt's expressions, as today.

## What changes conceptually, and what does not

* **A mutation is the transaction.** Jazz's `transact` proxy, the empty-transaction dodge and
  the `NothingWritten` class go. A Convex mutation is serializable and atomic on its own; one
  that writes nothing commits nothing.
* **Mutations read the truth, then write.** The rule "write from the rows on screen, never read
  first" (`decisions/2026-09-jazz.md`) was a local-first workaround for a stale local read. On
  Convex the server holds the truth and the mutation reads it inside the transaction, so `held`
  disappears from `perform`'s signature: `perform({ open, action, browser_key })`. The "next
  keypress acts on the old order" problem is answered by optimistic concurrency, not by client
  state. `use-reorder`'s "step from where the last press sent the row" logic may still be
  wanted for feel; keep it, measure in phase 4.
* **Reads are subscriptions, and joins are the server's.** `useHeldRows`, `useKept`, `idsKey`,
  the flat-per-table reading and the browser-side assembly of a whole hunt were all answers to
  alpha.56's query hangs. They go. A query function reads by index and returns the assembled
  thing (*Reads* above). A result is `undefined` until the first delivery, then the value; a
  query with the same arguments never blanks, and "waiting" versus "missing" stays a distinction
  in `use-hunt`.
* **Latency arrives.** A Jazz write landed in microseconds locally; a Convex mutation is a round
  trip. Text fields save on blur through `useDraft`, so typing is unaffected. Reorders, sorts,
  checkboxes and the lock will show the round trip. The first cut adds **no** optimistic updates;
  phase 4 measures and adds `withOptimisticUpdate` where it is felt. This is a central part of
  the evaluation, so record the numbers.
* **`unsaved` and the page hold.** A mutation in flight is `unsaved`; the `beforeunload` hold
  and `Writing.count` stay as they are. Convex's client queues mutations while offline and
  replays on reconnect, which is more than Jazz promised for a closed laptop and less than it
  promised for an open one.
* **The mirror can now see everyone's edits.** Today the quiz history records only the tab's
  own changes (`HUMAN-whatsup.md`, 2026-09-27). With the open quiz arriving assembled by
  subscription, feed the mirror from successive deliveries of `quizzes.open` (a `mirrorQuiz(
  before, after)` in place of `mirrorHunt`), and a friend's edit reaches this browser's history
  too. `openHistories` runs for the open quiz rather than every quiz of the hunt, which is what
  the shallow hunt allows anyway. Do it in phase 2; it is simpler than what it replaces.
* **Permissions are code.** Convex has no policy DSL; authorization is what a function checks.
  `convex/authorize.ts` holds it, wide open for the trial, so hunts-and-idents PR 6 has one file
  to write. Convex Auth or a browser key, the check lives there and nowhere else.
* **No migrations.** A schema push validates existing documents and refuses if any fail. With
  no data to keep, a dev or e2e deployment is cleared (`convex/testing.ts`, an
  `internalMutation` that deletes every table, guarded by an environment variable the
  production deployment never has) and the push retried. `notes/deploy.md` loses its migration
  section and gains a paragraph on schema pushes; the `migrations` CI job goes.
* **Labels' global uniqueness** (idents, hunts) can now be enforced: the mutation reads by
  index and refuses or reuses inside the transaction, so the "duplicate ident under a slow
  server" race in the hunts handoff is closed for free. Do so.

## Phases

### Phase 0: spike and decisions (one session; PR `convex_spike`)

Install `convex`, `convex-helpers`, `convex-test` (exact versions). Run `npx convex ai-files
install`. Start an anonymous local deployment (`npx convex dev` with no account configures one;
`--configure new --dev-deployment local` is the explicit form) and put a throwaway table and one
function in `convex/`. The app stays on Jazz. Answer these, each as a throwaway test or a note,
and record the answers in the progress document (and the shape-affecting ones in
`HUMAN-whatsup.md`):

1. **Isolation.** How does an agent's dev server, the e2e suite and a human's own each get a
   Convex deployment of their own, on this machine, at the same time? Candidates: (a) one
   anonymous local deployment per role, each chosen by `--env-file` (`data/convex-agent.env`
   holding its `CONVEX_DEPLOYMENT`), with the CLI picking ports; (b) the open-source backend
   binary per role with explicit `--port`s in the `32xx` range and a data directory under
   `data/convex-<role>/`, addressed through `CONVEX_SELF_HOSTED_URL` and an admin key. Prefer
   (a) if it works, since it is what every agent knows; the answer must let `pnpm dev:agent`,
   `pnpm test:e2e` and `pnpm test:e2e:agent` run side by side, and must be scriptable for
   GitHub Actions without a Convex account (or with a scoped dev deploy key the Coach mints).
   `e2e/environment.ts`'s `TakenBy` table is rewritten from this answer.
2. **The bridge.** Does `convex-helpers/server/zod4` convert every row validator in
   `src/models/`? Try each: nullable strings, `oneof`, `templateLiteral`, nested objects,
   arrays of objects with `.max()`, `int`/`uint`, `zid`. List what it refuses.
3. **Zod's patch and error map.** Our patched Zod (`patches/zod@4.6.5.patch`) and
   `installErrorMap` must run inside Convex's bundled functions and under `convex-test`'s
   `edge-runtime`. Confirm an issue thrown in a mutation carries the input and our message.
   Convex serializes thrown errors for the client as `ConvexError` data or a generic message;
   settle how a validation refusal reaches the browser as a notice (`ConvexError` with a
   `failurekind`-shaped payload is the likely answer; `lib/notices.ts` already has the
   vocabulary).
4. **Vitest layout.** `convex-test` wants `environment: 'edge-runtime'` and
   `server.deps.inline: ['convex-test']`; the rest of the suite is `node`. Vitest projects
   (one for `tests/convex/**`, one for the rest) or one environment for all: pick, and confirm
   `tests/support/setup.ts` runs in both.
5. **Latency.** From a Playwright page against the local deployment, time a mutation round
   trip (`performance.now()` around `useMutation`) and a query redelivery. Write the numbers
   down; they set expectations for phase 4.
6. **Lint and typecheck.** `eslint.config.mjs` covers `convex/**` (same rules, `_generated/`
   ignored, and the `no-restricted-syntax` selector that refuses a bare `v` from
   `convex/values`, settled item 1); `tsconfig.json` includes `convex/**` or Convex's own
   `convex/tsconfig.json` does, without either breaking `pnpm typecheck`.
7. **Generated code in git.** Settled item 3: commit `_generated/`, add
   `convex/_generated/** -diff` to `.gitattributes`, and a CI step (`npx convex codegen` then
   `git diff --exit-code convex/_generated`) that fails on drift. Note the size of the
   directory in the progress document.
8. **`_id` through the tree.** Rename `id` to `_id` in the tree types and their `fill`/`blank`
   statics, `lib/ids.ts`'s callers, `lib/exporting.ts` (which omits it), `lib/importing.ts`
   (`idForForeignId`), `lib/quizgit.ts` and the formula bag's `exposed` lists (which never
   carried it). This is mechanical and independent of Convex; it may be its own early commit in
   this PR, so the phase 1 diff does not carry it.

Exit: Jazz still runs the app; the eight answers are recorded; the settled items are written into
`STYLE.md` / `notes/stack.md` and the isolation answer's Doppler variables listed for the Coach; the throwaway table is deleted or kept
as phase 1's seed. Nothing else changes.

### Phase 1: the server side, complete, beside Jazz (the design-heavy phase; PR `convex_server`)

`convex/schema.ts` from the row validators (*Schema: one source*), with the indexes listed
there, and with these model changes:

* `identings` gains `browser_key: str` (settled item 13) and loses nothing; its Zod row is
  `{ browser_key, ident_id: zid('idents') }`.
* Every `<parent>_id: rowid` becomes `zid('<parent>')`. The kit keeps `rowid` only if some
  field still needs a table-less id; otherwise drop it. `treeid` widens as above.
* `widgets` keeps its nullable per-kind columns (a tagged union at the table level is expressible
  in Convex as `CVX.union(CVX.object(...), CVX.object(...))` and would be the better shape; do it
  only if the bridge derives it from `WidgetValidators` cleanly, otherwise leave it for phase 4).
* `quizzes.bulk_ishes_last`, `quizzes.last_sortkey`, `bottings.items` and `bottings.response`
  are plain fields derived from their Zod schemas (settled item 10); `src/db/json-text.ts` and
  the `.transform()` on `last_sortkey` have no successor.
* `bottings` no longer needs `$createdAt` games: `_creationTime` is stamped at write and is on
  the document at once. `HeldBotting`'s optional `$createdAt`, `askedAt()`'s "just now"
  fallback, and the `created_at` juggling in `latestBySlot` simplify to `_creationTime`, and
  `latestBySlot` itself shrinks: the query already reads the newest done and the newest failed
  botting per slot by index (*Reads*), so the projection is handed at most two rows per slot.

`convex/writing/*.ts`: port `quiz-writing.ts`, `quiz-actions.ts`, `layout-actions.ts`,
`review-actions.ts`, `account-actions.ts` to functions over `MutationCtx`. `Tx` becomes
`MutationCtx['db']`; `tx.insert(app.questions, fields)` becomes `ctx.db.insert('questions',
fields)`; `tx.update(app.x, id, changed)` becomes `ctx.db.patch(id, changed)`; each function
reads what it needs by index instead of taking `held`. `reviseOpenQuiz` reads the quiz by id
and refuses if locked, as today. `writeQuiz`/`writeHunt` keep their shape.

`convex/hunts.ts`, `convex/quizzes.ts`, `convex/idents.ts`, `convex/reviews.ts`: the public
functions, queries as listed under *Reads* (Zod `args`, no `returns`), and the mutations:

* `hunts.perform` (mutation, `{ open, action, browser_key }`, `returns: CVX.null()`): today's
  `perform` switch, `ident_id` resolved server-side from the browser key's newest identing.
* `idents.performAccount` (mutation, `{ action, browser_key }`, returns the id it made):
  `assume_ident` (now race-free: read by label inside the transaction), `new_hunt` (label
  refused if taken).
* `testing.clearAll` (internalMutation, guarded).

The query functions call the projections in `src/lib/rows.ts`; `quizFrom` takes the rows a
query has read by index rather than a `QuizRows` filtered out of everything held, so its
signature changes little and its tests move with it.

`convex/authorize.ts`: the seam, wide open, with the doc block that `permissions.ts` has today.

Tests, all under `convex-test` in `tests/convex/**`, ported from `tests/state/**` and
`tests/db/**` with the same intent: `tests/support/convex.ts` gives `seedHunt(t, hunt)` →
`{ act, read, open }` exactly as `tests/support/jazz.ts` does, so `perform.test.ts`,
`layout-actions.test.ts`, `quiz-writing.test.ts`, `quiz-rows.test.ts`, `account-actions.test.ts`
and `lookup.test.ts` move with their cases. `permissions.test.ts` becomes `authorize.test.ts`
stating the wide-open rules. `coherence.test.ts` becomes the canary above. `schema.test.ts`'s
alpha.56 canaries are deleted with a line in the progress document (they pinned Jazz bugs).
`json-text`, `sync-settings`, `runtime-assets` and `publish-runtime-assets` tests go with their
modules in phase 2; leave them until then.

The pure projections move to `src/lib/rows.ts` with their tests; `src/state/quiz-rows.ts` keeps
only what the browser alone needs, if anything.

Exit: `pnpm test` green with both suites; `pnpm typecheck` and `pnpm lint` green over
`convex/**`; the app still runs on Jazz, untouched. No UI change.

### Phase 2: the browser switch, and Jazz out (PR `convex_client`)

* `src/app/providers.tsx`: `ConvexProvider` with a `ConvexReactClient` on
  `NEXT_PUBLIC_CONVEX_URL`, replacing `JazzProvider`. `SyncNotices` keeps `SyncUnconfigured`
  (no URL at build) and an opening notice; the worker-related help goes. `SyncLog` logs the
  client's connection state if Convex exposes one cheaply, else goes.
* `use-ident.ts`: mint or read the `browser_key` (one small module, `src/state/browser-key.ts`,
  `localStorage` behind try/catch), then `useQuery(api.idents.current, { browser_key })`.
* `use-held-rows.ts` goes; `use-hunts-list.ts` (`useQuery(api.hunts.list)`) serves `HuntsList`.
  `use-hunt.ts` subscribes to `hunts.open`, `quizzes.open` and `reviews.forQuiz` as *Reads*
  describes, and takes `useMutation(api.hunts.perform)`. `findIn`, `Finding` and `HuntHandle`
  keep their shapes apart from `hunt` becoming the shallow hunt (settled item 14): adjust
  `Workbench`, `QuizSwitcher`, `QuizNotFound`, `ExpressionsModal` and `WidgetsEditor` to it,
  which is mostly a type change, and `Hunt.expressionUsage` becomes the count the expressions
  arrive with. `askServer`/`lookUp` (`state/lookup.ts`) go: a Convex query that returns null has
  already asked the server.
* `use-account-actions.ts` calls `useMutation(api.idents.performAccount)`.
* The mirror: fed from `quizzes.open`'s deliveries (see *What changes conceptually*).
* The Export box fetches `hunts.export` once, on open, through `useConvex().query`.
* `e2e/`: `environment.ts` and `environment.setup.ts` check for the Convex deployment instead
  of the Jazz port; `support.ts`'s `otherVisitor` is a fresh browser context (a fresh
  `browser_key`), as today; `client-first.spec.ts` becomes "with every host but the app's and
  the Convex deployment's blocked, and `/api/bots` blocked, the app opens, edits and keeps
  its changes, and asking is the only Vercel function" (block `/api/ask` and assert the notice).
  `quiz-history.spec.ts` and `routing.spec.ts` lose their Jazz-specific waits. Expect
  `expect.timeout` to come down from 10 s; leave it until the suite is green, then try.
* Scripts and config: `dev:agent`, `test:e2e`, `test:e2e:agent` and `build:agent` start or point
  at their own Convex deployment per the phase 0 answer (a `--start`ed `npx convex dev`, or a
  `scripts/convex_dev` wrapper); `next.config.ts` loses `withJazz` and the runtime copy;
  `playwright.config.ts`'s `webServer` starts both. `scripts/convex_reset` runs
  `testing.clearAll` against the deployment the environment names, refusing production.
* Delete: everything under *Gone* above, `jazz-tools` from `package.json`, the `jazz` skill
  symlink, the Jazz variables from CI's `e2e` job and from `e2e/environment.ts`, `data/jazz*`
  (the human's `data/jazz/` is the Coach's to remove; say so in `HUMAN-whatsup.md`).
* Doppler: tell the Coach which variables each config now needs (`NEXT_PUBLIC_CONVEX_URL` for
  builds; `CONVEX_DEPLOYMENT` or the self-hosted pair for dev roles) and which Jazz ones retire.
  Agents cannot edit Doppler; list them in `HUMAN-whatsup.md` and the progress document.

Exit: the app runs on Convex alone against a local deployment; `pnpm test:e2e` green; `pnpm
build:agent` green with a `NEXT_PUBLIC_CONVEX_URL` set; the Coach can paste a hunt export into
the Import box and get their quiz back.

### Where this stands (2026-09-28)

Phases 0 to 2 are built and green on `20260928-convex_phase4`, off `main` at #12 and not yet
merged: lint, 1907 unit and convex tests, and 163 e2e specs in about a minute; `pnpm typecheck`
passes bar a stale `.next-e2e/dev/types` (phase 3a fixes the cause). The progress document has
every deviation. What is left of the move is phase 3's agent half, phase 4, and a sweep of Jazz's
last traces from the notes; then the playtesting thread resumes as phases 5 to 7.

**Phases 3a and 4 land on this branch, as one pull request**, the sweep inside phase 4. Phase 3b
(the cloud) is a small PR of its own whenever the Coach's account exists, and blocks nothing.
Phases 5, 6 and 7 are each a branch stacked on this one (`pnpm run newb <label>`), one PR each,
per the ground rules. Every phase still ends green and updates the progress document.

### Phase 3a: the deploy story, CI and the healthcheck (this branch)

Everything of phase 3 that needs no Convex account. The Coach's half is phase 3b.

* **`notes/deploy.md` rewritten** for Convex: Vercel builds the app and deploys the functions in
  one step (`npx convex deploy --cmd 'pnpm build'`); a preview deployment per branch, with its
  own empty database; production on merge to `main`; `ANTHROPIC_API_KEY` stays a Vercel variable
  (settled item 7). A schema push validates every document and refuses if any fails; with no
  data to keep, a dev or e2e backend is emptied (`scripts/convex_reset`) and pushed again, and
  production is the Coach's call. No migrations, no `migrations` job, no permissions head. What
  the local backends are, per role, and how CI brings one up. Keep the "does this change need a
  deploy?" table in spirit: under Convex every merge deploys the functions, and the interesting
  row is the schema.
* **`README.md`**: the storage paragraph and *Developing* rewritten (Convex, a local backend per
  role, `pnpm dev` / `dev:agent` / `test:e2e`, the `convex_*` scripts in place of the `jazz_*`
  ones). `CLAUDE.md`'s pointer at `deploy.md` loses "still Jazz's".
* **The `_generated` drift check in CI.** `convex codegen` needs a running deployment
  (*Discoveries*), so a job starts a local backend with `scripts/convex_backend` (the binary
  cached as the `e2e` job caches it), pushes `convex/` through `scripts/convex_dev`, then runs
  `git diff --exit-code convex/_generated`. A non-zero exit from the push fails the job too, so
  a stub is never mistaken for a regeneration.
* **`pnpm typecheck` must not depend on another role's stale build directory.** `tsconfig.json`
  includes every `.next-*/dev/types/**`, so a route rename fails typecheck until each role's dev
  server has run again (the "stale `.next*/` route types" note, now biting `.next-e2e`). Propose
  the fix in chat before making it; the likely answer is to include only the directory the
  current role writes (`NEXT_DIST_DIR`, defaulting to `.next`), or to clear them
  (`scripts/nuke-next`) before typecheck in CI. Either way `pnpm typecheck` runs clean in a fresh
  checkout and after any rename.
* **`scripts/convex_healthcheck <role>`**: does the deployment the environment names answer, and
  do its functions match `convex/`? `npx convex function-spec` against it compared with the
  checkout's, or a dry-run deploy: whichever the installed CLI offers cleanly. It writes
  nothing. `scripts/doppledo prd_janitor scripts/convex_healthcheck` is the Coach's spelling
  once 3b lands; `scripts/doppledo`'s usage line names it in place of `jazz_healthcheck`.

Exit: `notes/deploy.md` and `README.md` describe Convex; CI has the drift check and every job is
green; `pnpm typecheck` passes in a clean checkout; the healthcheck runs against a local role.

### Phase 3b: the cloud (a small PR of its own, when the Coach's account exists)

With the team, project and keys in place (*For the Coach*): the Coach's first `npx convex
deploy` to production; Vercel's build command; a preview deployment for one pull request, which
the agent watches; `TRIQUET_CLEARABLE` set on no cloud deployment; the healthcheck run against
production under `prd_janitor`; `notes/deploy.md` gains what the first deploy taught. Nothing
else in this plan waits on it: every agent phase runs on local backends.

### Phase 4: the evaluation, the ergonomics pass, and Jazz's last traces (this branch)

This phase is the reason for the whole exercise. With the app running for real (on a local
backend until 3b lands; record the numbers with that caveat, and add the cloud's once it does):

* **Measure** what phase 0 estimated: round trip for a reorder, a checkbox and the lock; time to
  first paint of a quiz; the size and frequency of `quizzes.open` redeliveries while editing the
  Coach's real quiz (brought in through the Import box); the cost of `hunts.whole` asked again on
  every change for the Export box (a phase 2 deviation: if it shows, an export prepared on demand
  is the alternative); **bandwidth and query/mutation volume per editing hour**, the two numbers
  that drive Convex's price, against the free plan's allowances; document counts. Record them
  in the progress document's *Measurements*.
* **Add optimistic updates** (`withOptimisticUpdate`) only where the measurement says the wait
  is felt: `move_question`, `move_widget`, `move_column`, `set_lock` are the candidates. Each is
  a pure function over `localStore`; never mutate what it returns. Say in the verdict how many
  were needed.
* **Check the subscription count** against React DevTools and the backend's function log: one
  live query per screen-level thing (`hunts.open`, `quizzes.open`, `reviews.forQuiz`,
  `idents.current`, the hunts list, and `useOtherQuiz` while the expression preview points at
  another quiz), none per row. If something subscribes more, fix it here.
* **Small sweeps the earlier phases left.** `BottingT` loses its minted `id` and `created_at`
  (`_id` and `_creationTime` are the row's) and `latestBySlot` goes with them, `resultsFor`'s
  tests building their `latest` maps by hand. The `widgets` union, only if
  `zodOutputToConvexFields` derives it from `WidgetValidators` cleanly; otherwise a line in the
  verdict. `SyncLog` keeps only what Convex's client exposes cheaply.
* **Write the verdict** into `notes/database-decisions.md`: the scorecard row for Convex
  re-scored from experience, what was lost from Jazz and how much it was missed, what was gained,
  and a recommendation. Move the reasoning to `notes/decisions/2026-09-convex.md` (the shape of
  the data, the rules that follow, what it replaced, learned in the move), written from the
  progress document's *Decisions taken*, *Deviations* and *Discoveries*, and `notes/stack.md`'s
  Convex entry shrinks to point at it.
* **Jazz's last traces, swept**, once the verdict is written. `grep -rniI jazz` outside
  `relics/`, `aside/`, `whiteboard/`, `notes/prior-work/` and the Jazz decision is the checklist;
  on 2026-09-28 it finds:
  - `CLAUDE.md`: the storage paragraph says what is; the `deploy.md` line (phase 3a).
  - `notes/stack.md`: the *Jazz v2* entry becomes a line pointing at the decision; under
    unique-names-generator, "Row ids are Jazz's own"; the Doppler paragraph's "Jazz server" and
    "Jazz admin and backend secrets"; *Later*'s "second device without logging in" (Jazz's
    `exportLocalFirstSecret`: the browser key has no such door, and the identity brief is the
    answer); *Discuss*'s Authentication entry, rewritten as the brief in *Identity, later*; the
    *Settled in Sept 2026* paragraph, which still says Jazz and one-subscription-per-table.
  - `notes/guidelines.md`: *Where validation sits, with a local-first database* becomes *with
    the database on the server*: the entrypoints are the same, the mutation is the chokepoint a
    client cannot skip, the second net is Convex's schema, and `JZS.json()` / `JZS.enum()` become
    the bridge's nested values and closed sets.
  - `notes/decisions/2026-09-client-first.md`, per settled item 12: "with the network off" is
    struck; the named exception becomes the Convex deployment; *global facts* are now possible
    (a mutation reads by index inside the transaction); *trusting identity* points at the brief.
  - `notes/decisions/2026-09-jazz.md`: a status line at the top, superseded by
    `2026-09-convex.md`, and nothing else touched. It is history.
  - `notes/vocabulary.md`: *id* is Convex's `_id`; *identing* says browser, not account.
  - `notes/sandbox_setup.md`: "the page finds Jazz at `localhost:3201`" becomes the backends'
    `34xx` ports.
  - `whiteboard/testing-practices.md` reasons about Jazz's worker under the fake clock; one line
    saying whether Convex's client behaves the same.
  - `src/lib/validator.ts`'s ULID comment may stay as history, or say "before September 2026".
  - `whiteboard/jazz-migration.md` moves to `notes/prior-work/`, as retrospectives are kept.
    `whiteboard/hunts-and-idents-handoff.md` is rewritten at the end of phase 5 (below).
  - Doppler's four variables: the Coach's (*For the Coach*).
* **`HUMAN-whatsup.md`** carries the verdict's one-paragraph summary and the numbers.

Exit: the notes describe the app as it is; the Coach has the verdict in writing; the grep above
finds nothing.

### Phase 5: reviewings (hunts-and-idents PR 4, on Convex)

What `whiteboard/hunts-and-idents.md` *PR 4* and the handoff's *For PR 4 in particular* ask for,
built the Convex way. The behaviour is theirs, to the letter; the mechanisms below replace the
Jazz ones they name (`use-held-rows`, `reviewingsQuery`, `quizRowsOf`'s fields, `perform`'s
`held`, the migration).

* **Model and schema.** `src/models/reviewing.ts`: `{ review_id: zid('reviews'), question_id:
  zid('questions'), get_rate: uint.max(100).nullable(), guesses (as `review.ts` shapes
  `overall`), comments: textish, minutes: a non-negative number, nullable, keep_it,
  needs_fact_check, elimination_candidate, peeked: bool }`, a `reviewingPatch` by the patch
  pattern, and `Reviewing.blank(review_id, question_id)`. `convex/schema.ts`: `reviewings`
  derived like the rest, indexed `by_review_id_and_question_id` (the upsert's lookup, and a
  review's reviewings with the review alone bound) and `by_question_id` (a question's deletion).
  The canary test grows a table. No migration: the local backends are emptied. No new cap: a
  review holds at most one reviewing per question, so `QuestionsPerQuiz` bounds the read.
* **Actions**, in `models/actions.ts`'s `huntAction`: `set_reviewing { quiz_id, question_id,
  patch: reviewingPatch }` and `peek_answer { quiz_id, question_id }`. `writing/review_actions.ts`
  gains `setReviewing` (the reviewer's review by `by_quiz_id_and_ident_id`, refused
  `reviewNotOpened`; the question by id, refused `questionGone`; the reviewing found or inserted
  blank, the row validated as it would stand, only the changed fields patched; an `empty` review
  moved to `draft`, a `shared` one left) and `peekAnswer` (the same lookups; `peeked` set once, a
  no-op after). Both go through `perform`'s `reviewer(ident_id)` and neither through
  `reviseOpenQuiz`: a locked quiz is reviewable.
* **Cascades.** `deleteQuestion` deletes the question's reviewings as it deletes its bottings
  (`by_question_id`, `for await`); `deleteQuiz` deletes each review's reviewings before the
  review. `replace_open_quiz` (an import) keeps questions by label, so their reviewings survive.
* **Reads.** `reviews.forQuiz` hands each review back with its reviewings: `ReviewedT` gains
  `reviewings: Doc<'reviewings'>[]`, `.take(QuestionsPerQuiz.max)`. One query, as now; no second
  subscription, and nothing the browser assembles.
* **Views.** `AnswerLock` gains an optional `onReveal`, called once, the first time `revealed`
  becomes true (a `useRef` guard), which `ReviewQuestionRow` wires to `peek_answer`.
  `ReviewQuestionRow` takes the reviewer's reviewing (or null) and `dispatch`, and after the lock
  shows *Get rate* (a number field 0..100, the spinner suppressed, as `QnumField`), *Guesses*,
  *Comments*, *Minutes*, and three `ToggleButton`s with `aria-label`s (👍 keep it, 🔍 needs fact
  check, ✂️ elimination candidate), each saving on commit through `set_reviewing`. Row height
  follows `QuestionRow.tsx`: *Comments* is a `GrowingField`, every other text box a
  `StretchField`; no third field component. `ReviewsPanel` gains, per shared review, a compact
  MUI `Table` of its reviewings in rank order: title, get rate (marked when `peeked`), minutes,
  the flags as their emoji, guesses and comments verbatim; it reads the same `sharedReviewsOf`
  list, which phase 7 deletes.
* **Tests.** `tests/models/reviewing.test.ts` (get rate 0, 100, 101, -1; minutes 0, 2.5, -1; a
  patch carries no default); `tests/convex/hunts.test.ts` (`set_reviewing` inserts then patches,
  a patch leaves absent fields alone, moves `empty` to `draft` and leaves `shared` alone, is
  refused unopened and for a question gone; `peek_answer` sets `peeked` once; deleting a question
  or a quiz takes the reviewings with it); `tests/convex/reviews.test.ts` (the join);
  `tests/convex/schema.test.ts` (the canary); `e2e/reviews.spec.ts` extended, not a new file: the
  reviewer fills a row, the comments field grows the row and the guesses field does not, and
  once shared the smith's panel shows the row with its get rate marked as peeked.
* **The handoff.** At the end of this phase, rewrite `whiteboard/hunts-and-idents-handoff.md` for
  phase 6 on Convex, dropping every Jazz mechanism: `useKept` and the `in` lists, the migration
  steps, and the duplicate-ident race, which `assumeIdent` closed by reading the label inside the
  transaction. `notes/vocabulary.md` already names *reviewing*; check its line matches.

Exit: green suites; a reviewer's per-question verdicts reach the smith's panel once shared.

### Phase 6: huntings (hunts-and-idents PR 5, on Convex)

* **Model and schema.** `src/models/hunting.ts`: `{ hunt_id: zid('hunts'), ident_id:
  zid('idents'), role: oneof(HuntRoleVals) }`, `HuntRoleVals = ['smith', 'reviewer']`.
  `huntings` indexed `by_hunt_id` and `by_ident_id_and_hunt_id`. A cap, `HuntingsPerHunt`, 99
  proposed; confirm the number in chat, as the others were.
* **Actions.** `new_hunt` (an account action) also writes a `smith` hunting for the browser's
  current ident, and is refused `notIdentified` without one (today it asks no ident). Two new
  hunt actions through `perform`, on `open.hunt_id`: `add_hunting { ident_label, role }`
  (resolves the label by `idents.by_label`, refuses `identUnknown` with the notice the thread
  words; an existing hunting has its role replaced, never duplicated) and `remove_hunting
  { ident_id }` (refused `notSelfRemovable` for one's own). Deleting a hunt is still no action.
* **Reads.** `hunts.list` takes `browser_key` and lists only the hunts the current ident has a
  hunting on, each with the role: the one listing across hunts, now by `by_ident_id_and_hunt_id`
  rather than a walk of every hunt, which was the last unbounded read. `hunts.open` takes
  `browser_key` too, and returns the caller's role (`null` for a stranger) beside the shallow
  hunt, with the hunt's huntings joined to their idents' labels and titles for the members panel.
  `useHunt` returns `role`.
* **Routing.** `QuizRoute`: `act` absent goes to `smith` for a smith and `review` for a
  reviewer; a stranger sees *You are not on this hunt. Ask a smith to add `<ident label>`.*, and
  `act=smith` as a reviewer the same, phrased for the role. Client enforcement until phase 7.
  **The link a smith hands a reviewer**, the gap both handoffs note (no UI switches `act`),
  closes here: a *Copy reviewer link* `CopyButton` beside the members panel, giving
  `quizPath(labels, 'review')`.
* **Views.** `components/panels/MembersPanel.tsx`, smith view only: an MUI `Table` of huntings
  (ident title, label, role, remove) and a row to add one (label field, role `Select`, *Add*).
* **Tests.** Model; `tests/convex/idents.test.ts` (the creator is a smith; `new_hunt` refused
  unidentified); `tests/convex/hunts.test.ts` (add resolves and replaces; remove refuses self;
  `list` shows only one's own, with the role; `open` says the role); `e2e/routing.spec.ts`
  (redirect by role; the stranger's notice); `e2e/reviews.spec.ts` (the smith adds the second
  visitor's ident as a reviewer, who arrives with no `act` and lands on the review screen).
  `e2e/support.ts` already makes every hunt as an ident (`startHunt`); the `list` change means no
  spec may assume it sees another spec's hunts, which none should.

Exit: `/my/hunts` is one's own; roles route; a smith can add a friend and hand them the link.

### Phase 7: authorization (hunts-and-idents PR 6, on Convex)

`convex/authorize.ts` stops being a seam and starts checking, keyed as the trial keys
everything: the browser key names its newest identing, the identing its ident, and the ident's
hunting on a hunt says what it may do. The honour system stays in one respect, as the thread
says: anyone may still assume any ident, so this is as strong as that until the identity plan
puts a credential behind the ident. Build it so that plan changes one function (`identFor(db,
browser_key)` becomes a read of `ctx.auth`) and no rule.

* **The rules**, each a function in `authorize.ts` and nowhere else: `mayReadHunt` (a hunting of
  any role), `mayChangeHunt` (a smith's), `mayReadReview` (one's own, or shared and a smith of
  its hunt), `mayWriteReview` (one's own). Idents and identings as today.
* **Where they run.** Every query below the hunts list takes `browser_key` (`hunts.open`,
  `hunts.whole`, `quizzes.open`, `reviews.forQuiz`) and asks before reading; `hunts.perform` asks
  `mayChangeHunt` for a quiz, layout or hunting action and `mayWriteReview` for a review action.
  `reviews.forQuiz` returns only what the caller may read, so `sharedReviewsOf` and the panel's
  client-side filter are deleted whole, as the handoff built them to be.
* **The one design question, for the Coach before building: a query that may not answer.**
  `useQuery` throws a query's error into React (*Discoveries*), so a refusal thrown from
  `hunts.open` would take the page down rather than show a notice. Proposed: a query answers
  with what the caller may see, `null` for a hunt they may not read exactly as for one that does
  not exist, and `hunts.open` says which with a small discriminant (`{ hunt: null, why:
  'notOnHunt' | 'noSuchHunt' }`) so `QuizRoute` can word the notice; mutations refuse as they do
  today. The alternative, an error boundary around the route, is the heavier answer.
* **Tests.** `tests/convex/authorize.test.ts` grows a smith, a reviewer and a stranger on one
  hunt, every rule each way; the function tests gain the refused cases (a reviewer's edit, a
  stranger's read, a draft review invisible to the smith); e2e: a stranger's deep link shows the
  notice, a reviewer who types `act=smith` is refused, `client-first.spec.ts` still holds. The
  installed `convex-authz` skill is worth a pass at the end, as a second reader.

Exit: the server enforces what phase 6 showed; wide open is over; the identity plan is next.

### Identity, later (not a phase of this plan)

After phase 7 the app works as the playtesting thread meant it to, on Convex, with the browser
key standing in for a credential. The Coach then issues the identity plan. Its brief, so the
seams built here point the right way: evaluate Convex Auth (`@convex-dev/auth`, beta) with the
Anonymous provider as the replacement for `browser_key`, and Google as the first real provider
behind it, against the alternative the Jazz plan named (Clerk or WorkOS as a hosted hub, Convex
trusting its JWTs). Client-side only (`ConvexAuthProvider`); we have no server components. The
design must include the "anonymous user signs in with Google on a second device" collision
policy. `identings` then hang off `ctx.auth.getUserIdentity().subject` and `browser_key` goes
from every argument list; `authorize.ts`'s rules keep their shape and change their first line;
the ask route moves into a Convex action if it must know who is asking (item 7).

## The progress document

`whiteboard/convex_yay-progress.md`, created in phase 0 and updated in every PR. It tells the
next agent what has happened; it is newer than this plan wherever they disagree. Sections, kept
in this order:

1. **Status**: which phases are merged, which is in flight and on what branch, what is green.
2. **Start here**: the three to five things the next session does first (read this, run that,
   check the Doppler variables the Coach was asked for).
3. **Decisions taken**: each collision above with the Coach's answer and where it was recorded.
4. **Deviations from the plan**: what was built differently and why, one entry each, newest
   first.
5. **Discoveries**: what Convex did that the plan did not expect, good or bad, with the version.
   The evaluation in phase 4 is written from this list.
6. **Measurements**: the phase 0 and phase 4 numbers.
7. **For the Coach**: what needs a human (accounts, keys, Doppler, production deploys), and
   whether it has been done. Mirror each ask in `HUMAN-whatsup.md` as it arises.
8. **Deleted tests and their successors**, per the ground rule.

Keep it factual and current; prune what is done into *Decisions taken*. Development notes go
here and in `HUMAN-whatsup.md`, never in code comments or doc blocks.

## Sub-agents

* Reading `convex-helpers`' `server/zod4` typings and `convex-test`'s surface is worth an
  Explore agent, asked for specific signatures.
* Never spawn for the schema or the `perform` port: one mind, one session.
* Porting `tests/state/**` to `tests/convex/**` parallelises once `tests/support/convex.ts` and
  one ported file exist as the pattern. One agent per test file group, each in a worktree,
  merged one at a time.

## Risks, named

* **The bridge does less than hoped.** Then the schema is authored twice and the coherence test
  returns, as under Jazz, and the "one source" preference is recorded as not met. Say so in
  the evaluation; don't hand-roll a converter.
* **Latency is felt.** Optimistic updates are the answer and they are a one-liner each, but each
  is a second place the write's effect is spelled out. Keep them few. If reorders need them
  everywhere, that is a finding for the verdict.
* **Local deployments don't isolate cleanly.** Then the self-hosted binary per role (phase 0,
  candidate b) is the fallback, at the cost of one more thing to run. Raise before building
  either into scripts.
* **Convex Auth is beta**, and Next.js support is "under active development" (client-side use is
  what we need, which is the more settled half). The identity plan starts with a spike for that
  reason.
* **A query redelivers whole when anything it read changes.** With one query per screen-level
  thing and the newest-per-slot botting lookups, each redelivery is one quiz's worth, which is
  the grain the screen renders anyway. If editing feels like it re-renders too much, the answer
  is React memoization at the row, not more queries. Bandwidth and query/mutation volume are
  the numbers to watch in phase 4: they are what the plan tiers price.
* **Public functions are public.** Anyone with the deployment URL can call `perform`. That is
  exactly the wide-open policy we run today under Jazz, now with the Coach's Convex quota behind
  it. Rate limiting is a `convex-helpers` component if it is ever needed; note it under Later.
* **Lock-in** is bounded as `database-decisions.md` said: the backend is open source and
  self-hostable, and `npx convex export` gives a zip of every table. The Import box and the git
  mirror stay as the exit door for a smith's own work.
