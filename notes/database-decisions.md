# Storage and hosting: what we want, and what could give it to us

**Status (2026-09-28): settled on Convex**, pending the Coach's word on the verdict below. The
decision is `decisions/2026-09-convex.md`; this note is its reasoning. It began (2026-09-27) as
the review of what we would miss by leaving Jazz v2 for something more conventional, and of which
conventional things were in the running; Convex won on paper, the app moved to it, and *Verdict*
re-scores it from experience.

Ground rules for the review, from the Coach:

* The list below is **desiderata, not requirements**. No one of them drives the decision.
* A different choice will likely reverse an earlier decision (client-first, "Drizzle is gone",
  the shape of identity). That is allowed; don't let it weigh much.
* **Switching costs are zero.** This is a weekend tinker with no users and no data to protect or
  migrate. Score the destinations, not the journey.

## What we want

These are also the terms `stack.md` scores a dependency against; the storage question is where
they bite hardest.

* **No distinct backend layer.** Nothing that brings a second coding paradigm (GraphQL, Postgres
  plus an ORM plus a client cache, Express), a second deploy cycle, or even minor
  schema-transduction mismatches between the layers.
* **Mostly client-only.** Vercel for deploys, previews and hosting, but the code stays a short
  distance from running off S3 with a couple of edge workers. (`decisions/2026-09-client-first.md`
  is the current form of this.)
* **Multiplayer, or at least real-time collaborative, at the field level.** Toggle a checkbox and
  collaborators see it more or less immediately. Developing a quiz together, or solving a puzzle
  as a team, would be a major feature. Offline mode and Yjs-style shared text boxes are
  nice-to-haves. **A framework that makes us responsible for fine-grained conflict resolution
  scattered around the codebase is a no-go.**
* **Ergonomic.** Most of the code is business logic. Permissioning, optimistic updates and leaky
  abstractions are handled by helpers, or better, absent.
* **Zero-ops infrastructure, from as few places as reasonable.** Vercel, GitHub and Doppler are
  gimmes; nothing contemplated should push any of them to a higher paid tier. Ink in one database
  provider of some sort. Google for OAuth with a small key-vault worker is a little deal, not a
  big one. A BYOK database is a nice-to-have we don't foresee.
* **Disciplined interface.** GraphQL gives you this; an ORM gives you this. No code interleaved
  with custom queries, whether as a matter of practice or as "what happens when the demo meets
  delivery".
* **Agent-coder friendly.** Tried and true, and already gradient-descended into the agent's brain.
* **Boring.** No chance an agent hits a weird use case for a not-very-weird app.

## What Jazz taught us

The detail is in `decisions/2026-09-jazz.md` (*Learned in the move*) and
`notes/prior-work/jazz-migration.md`. What matters for this review:

* **What Jazz gives that nothing conventional does:** true local-first. A silent, no-login
  account on first visit; the app works with the network off; the rows live in the browser and
  no vendor holds them; field-level sync with per-column merge that we never touch; group-based
  permissions in one file. That is the whole first half of the list, met.
* **What it costs:** it is an alpha, newer than the agent's training, so every session works from
  installed source and canary tests rather than recall. Several DSL shapes don't work yet
  (optional JSON columns, payload-bearing enums, empty inserts); several query shapes hang the
  page (nested or multiple `include`s); and its SharedWorker is named after a content-hashed
  URL, so each deploy's worker could not open the database the previous one still held, and a
  production page stalled with nothing in its console. Two days went to the last one, and the fix
  is a copy step in `next.config.ts` that waits on an upstream bug. The schema is declared twice
  (Jazz's DSL and Zod) with a coherence test holding them together.
* **Turso**, the database before Jazz, is out for good: concurrent access from several tabs, and
  a conflict resolution that is last-push-wins in some cases. libSQL and Drizzle went with it;
  Drizzle could come back under a conventional choice, and only through this note.

## Scorecard

●● meets it, ● partly, ○ misses it. Struck-through rows are ruled out; see *Ruled out* below.
The Convex row is as re-scored from experience on 2026-09-28 (*Verdict*); on paper it was the
same bar *Boring*, which experience left at ●.

| | No 2nd paradigm | Client-only | Multiplayer | Ergonomic | Zero-ops, few vendors | Disciplined interface | Agent-friendly | Boring |
|---|---|---|---|---|---|---|---|---|
| Jazz v2 (until Sept 2026) | ●● | ●● | ●● | ● | ● | ● | ○ | ○ |
| Supabase + Drizzle, SSR Next | ● | ○ | ● | ● | ●● | ●● | ●● | ●● |
| Supabase, client-side (supabase-js + RLS) | ● | ●● | ● | ● | ●● | ● | ●● | ●● |
| Supabase + PowerSync | ○ | ●● | ●● | ● | ● | ● | ● | ● |
| **Convex (today)** | ●● | ●● | ●● | ●● | ●● | ●● | ●● | ● |
| Zero (Rocicorp) | ●● | ● | ●● | ●● | ○ | ●● | ○ | ○ |
| TanStack DB over Postgres | ● | ● | ● | ● | ● | ●● | ● | ○ |
| Firebase Firestore | ● | ●● | ●● | ● | ● | ○ | ●● | ●● |
| ~~InstantDB~~ | ●● | ●● | ●● | ●● | ●● | ● | ● | ● |
| ~~WatermelonDB~~ | ○ | ● | ○ | ○ | ○ | ● | ● | ○ |

## The candidates

**Supabase + Drizzle on SSR Next.js.** The maximally boring choice, and it scores that way.
Everything is in training data; Drizzle is a real disciplined interface; Supabase Auth gives
Google sign-in with no key-vault worker; migrations are drizzle-kit, dull in the good way. Three
things we would miss. Multiplayer is not free: Supabase Realtime delivers row changes over a
websocket, but the subscribe-and-patch-the-cache layer and the optimistic updates are ours to
write (TanStack Query, most likely). That code is not scattered conflict resolution, but it is
exactly the "demo meets delivery" surface where a whole-row save clobbers a collaborator's
checkbox. SSR puts our server in the read path for user data, reversing the client-first decision
outright and giving up the S3-distance property. Permissions are Row Level Security written in
SQL, a second language, and the one place Drizzle does not protect us. No offline at all.

**Supabase from the browser**. Drop SSR and Drizzle; call
supabase-js with RLS; generate types from the schema. This keeps the static-site-plus-one-function
shape we have and stays entirely boring. The cost: PostgREST's query builder is a weaker discipline
than an ORM, and RLS carries even more weight because the browser talks to the database directly.
If the conventional route wins, this is the flavour to prefer over SSR: it reverses fewer decisions.

**Supabase + PowerSync.** Closes the gaps: a SQLite copy in the browser, offline, field-level
sync, and one upload function where every write conflict is handled rather than scattered. A
Drizzle driver for the client-side SQLite restores the disciplined interface on reads. But it is
the option that most violates "no schema transduction": the schema is declared in Postgres, again
in the PowerSync client schema, and the sync rules are a third YAML-plus-SQL dialect deciding which
rows reach which user. JSON columns arrive as text. It is a third vendor with its own free tier.
And it runs its database in a SharedWorker over OPFS, so the multi-tab and deploy-time failure
class we just met in Jazz is possible here too, only on a mature codebase with a support team. It
is Jazz-shaped on boring parts, at roughly Jazz's amount of ceremony.

**Convex.** The strongest score on the card. Schema and functions are TypeScript in a `convex/`
folder in the same repo, deployed in the Vercel build step, types flowing to the client with no
transduction. Queries are reactive by default: a mutation patches one field and every subscribed
component re-renders. Mutations are serializable transactions, so there is no conflict
resolution to own anywhere. Optimistic updates are a one-liner on the mutation. Google OAuth
comes via Convex Auth or Clerk. The free tier is a forever tier that includes crons, file storage
and a preview deployment per Vercel preview. Convex publishes agent rules files and is heavily
used for AI-coded apps, so agents know it well. What we would miss versus Jazz: no offline and no
data in the browser. Queries cache in memory only; a closed laptop is a stopped app. The data
model is documents with indexes and no joins, so `quizFrom` stays a TypeScript assembly, as it is
now. Argument validators are Convex's own `v.*`, so the Zod double-declaration stays, against a
stable target. Lock-in is real but bounded: the server is open source and self-hostable, and
snapshot export exists. The ask route could move to a Convex action holding the key, keeping the
"one server function" rule with Vercel holding nothing.

**Zero (Rocicorp).** 1.0 shipped June 2026. Postgres plus TypeScript queries, and custom mutators
that run on both client and server. Architecturally it is exactly what we want over a Supabase
database. But it needs a `zero-cache` server we run, and the hosted "Cloud Zero" is still on
their roadmap. Fails zero-ops today, and it sits at the edge of the agent's training. Kept on the
list; watch for the hosted offering.

**TanStack DB over Postgres.** Client collections with live queries and optimistic transactions,
writes through a server action with Drizzle, reads synced by a read-path engine. A principled
middle path with the strongest interface discipline of the conventional options. Two caveats: it
is young (2025), and its read-path engine of choice was ElectricSQL, whose team was acqui-hired
(see *Ruled out*); what that does to TanStack DB is not yet clear. Kept on the list, provisionally.

**Firebase Firestore.** The boring original for realtime plus offline, with Google auth trivially.
The wrong shape for a relational quiz, and its rules language and read-billed pricing are the
tax. Listed for completeness, not favoured.

## Ruled out

* **Triplit, ElectricSQL and InstantDB** were each acqui-hired, in part or whole (Coach,
  2026-09-27). Out, whatever their scores; InstantDB had been the closest thing to "Jazz, but
  shipped". ElectricSQL's fate is the open question over TanStack DB above.
* **Liveblocks** (and Yjs over any database, generally): shared text and presence, but state split
  between CRDT documents and a database is precisely the scattered-conflict-resolution no-go, and
  the impedance mismatches are a certainty. Only ever if collaborative text becomes the point,
  and probably not then.
* **WatermelonDB.** A React Native ORM with a second-class web adapter, class-based models with
  decorators, and a sync protocol where we write both the pull and push endpoints and the
  server-side conflict handling. That is a backend layer, a paradigm mismatch with our functional
  style, and no realtime push. It solves a mobile problem we don't have.
* **Dexie Cloud** and other single-small-team sync services: the same longevity risk as Jazz with
  less upside.
* **Turso**, as above.

## Verdict (2026-09-28)

**Keep Convex.** The app has run on it since phase 2 of `whiteboard/convex_yay-plan.md`; every
test's intent carried over; nothing needed a heroic workaround. Measured on a local backend and then
in the cloud (*Appendix*, *Measured*, *Measured in the cloud*).

**Re-scored from experience.** Every column held, bar the one it started weakest on:

* *No second paradigm* ●●: schema and functions are TypeScript beside the app, and the tables are
  derived from the Zod row validators we already had, so the schema is authored once. The bridge
  took every shape we have, including a discriminated union (widgets, at last a tagged union), bar
  one recursive JSON field that TypeScript cannot follow, written by hand and held by a canary.
* *Client-only* ●●: static hosting plus the one stateless ask function stands; the functions run
  in Convex, not on a server of ours. Pages prerender; no user data renders on a server.
* *Multiplayer* ●●: a second browser sees each change one round trip after it lands, and every
  mutation is a transaction, so there is no conflict code anywhere. The quiz history now hears a
  collaborator's edits too.
* *Ergonomic* ●●: no optimistic updates were needed (below); mutations read the truth instead of
  writing from the rows on screen; a refusal reaches the author in a sentence through Convex's own
  error channel. The rough edges were small: `useQuery` throws a query's error into React, and
  the CLI rewrites `.env.local` on every push.
* *Zero-ops, few vendors* ●●: one vendor. Isolation for agents and e2e cost four small scripts
  running Convex's own backend binary per role, with no account and no quota. The cloud is untried
  until phase 3b.
* *Disciplined interface* ●●: one mutation for every edit (`hunts.perform`), one query per thing a
  screen shows, arguments and rows through Zod, authorization in one file.
* *Agent-friendly* ●●: Convex's own guidelines file for agents, and a training-deep API. The
  stumbles were new spellings (`ctx.db.patch` takes the table first) the guidelines already had.
* *Boring* ●, as scored: nothing hung and nothing lost data, but the spike met a handful of
  undocumented-in-passing facts (a local deployment is one per checkout; codegen needs a running
  deployment; a hyphen in a module path is refused at push; argument objects are strict at the
  door). Each was found in an hour and none recurred.

**What was lost from Jazz, and how much it was missed.**

* *Working with the network off*: not missed. Nobody used it, and the client-first decision now
  strikes it.
* *A silent, no-login account*: not missed yet. The browser key gives the same first visit; what
  it lacks (a verifiable root, a door to a second device) is the identity plan's job, and Convex
  Auth's anonymous provider is the first candidate.
* *No vendor holding the rows*: Convex holds them. The exit doors are the Export box, each quiz's
  git history, `npx convex export`, and a self-hostable backend.
* *Writes landing in microseconds*: a change now shows one round trip after it is made, 70 to
  90 ms on a local backend and 150 to 175 ms at a simulated 80 ms network. Not felt, on the
  local numbers. In the cloud, 150 to 230 ms for a one-row edit and 400 for a sort: a reorder
  is felt, and wants an optimistic update (recommendation 3).

**What was gained.** A server-side chokepoint that validates every write and will enforce
authorization (the playtesting thread's phase 7); global facts, so a label's uniqueness is
enforced in the transaction and the duplicate-ident race is gone; a schema authored once; 1,900
unit and function tests in about two seconds, and an e2e suite that runs in a minute and stopped
flaking; deploys with no migrations and no worker to strand; no query shape that hangs a page.

**What it costs, measured.** Database I/O, not function calls, is the binding number, as the
appendix predicted: about 46 KiB per edit on a quiz the sample's size, most of it the mutation's
own read of the open quiz and the rerun of `quizzes.open`. On the free plan that is roughly
ninety hours of steady editing a month; on Starter, overage is cents. Asking for the whole hunt
again after every change for the Export box was the largest single cost, and it is now asked
for only on request. *Since then* (same day): each action reads what it needs, and each question
is a query of its own, so a text edit costs about 3 KiB and the session's mix about 32 KiB
(*Appendix*, *Measured*).

**Recommendations**, in order:

1. Convert the trial to the decision (done in `decisions/2026-09-convex.md`, pending the Coach).
2. Carry on with the playtesting thread (phases 5 to 7 of the plan), then the identity plan.
3. When the cloud lands (phase 3b), re-measure; add an optimistic `move_question` first if a
   reorder passes about 150 ms, reusing `Rank`'s pure functions so its effect is not spelled
   twice. *Measured*: in the cloud a reorder takes 233 ms, so it is called for (*Measured in the
   cloud*).
4. ~~Cheaper reads, when bandwidth matters~~: done the same day. Each action reads what it
   needs, and each question is its own query.
5. Memoize the grid's formulas by question: on a large quiz the recompute on every redelivery,
   not the network, is most of the wait (about 70 ms of 200 at 60 questions). Since October
   2026 the work is `Runner.runQuiz` (`src/lib/formulary/runner.ts`), and its shape is W
   widgetings by Q questions: each `jsonata` cell evaluates its input formula and then its
   formula, each `aibot` cell its input formula, and each widgeting copies every question's bag
   entry once to add its widgeted, so later widgetings see it. Run order makes a widgeting depend
   on everything before it, so a cache keyed by question alone is not enough: the key is the
   question's own fields plus whatever its input formula read, which is what the deferred
   staleness digest (`notes/decisions/2026-10-widgets.md`) computes anyway.

## Where this leaned (2026-09-27)

The decision was between **Convex** and **client-side Supabase**, and it turns on one question:
is multiplayer something we would build in the first month, or a promise for later? If the
former, Convex: realtime and transactions are the default rather than something wired, and the
static-plus-one-function shape survives. If the latter, client-side Supabase, accepting that
Realtime gets wired when the day comes. **PowerSync only if offline becomes a requirement**, which
the list above says it is not.

In every conventional option, what we give up from Jazz is true local-first: the silent no-login
account, work with the network off, and no vendor holding the rows. Convex gives the collaboration
back without the first two; Supabase gives back neither without PowerSync.

## Open with a Coach

* **The verdict above**, and with it `decisions/2026-09-convex.md`.
* Answered by the move: multiplayer is now (Convex gives it by default); the ask route stays a
  stateless Vercel function until identity says otherwise; "user data never renders on a server"
  holds. Identity is the plan after the playtesting thread (`decisions/2026-09-convex.md`,
  *Identity*).

Facts checked 2026-09-27, and liable to drift: Zero 1.0 ([InfoQ](https://www.infoq.com/news/2026/06/zero-version-1/)),
Convex's free tier ([limits](https://docs.convex.dev/production/state/limits)), Supabase's free tier
pausing after a week idle ([pricing](https://costbench.com/software/database-as-service/supabase/)),
PowerSync's free tier ([pricing](https://powersync.com/pricing)).

## Appendix: what Convex would bill us for

Worked 2026-09-27 against the sample quiz (`notes/example-quiz.json`, untracked: 20 questions of
about ten fields each, 21 columns, 11 widgets, 14 expressions), so that a later candidate can be
sized the same way. Sources at the end of the appendix.

**What a function call is.** "Explicit client calls, scheduled executions, subscription updates,
and file accesses count as function calls." A query is one, a mutation is one, and each re-run of
a subscribed query after a mutation touched its read set is one. Writes inside a mutation don't
multiply anything: a mutation patching five fields across two tables is one call, up to the
per-transaction cap of 16,000 documents.

**Fan-out.** That same mutation, with six devices connected under our read-flat shape (one query
per table), re-runs two queries on each device: one mutation plus twelve subscription updates.
Read through one whole-quiz query it would be one plus six. The architecture write-up says the
re-run happens per client session with a function-runner cache in front, so the second client's
re-run is a cache hit; nothing official says whether a cache hit is billed. The numbers below
count every re-run, which is the conservative reading.

**Two people, a week of writes and rewrites, three clients' worth of listeners.** Field edits
commit on blur (`use-draft`), so a field commit is one mutation, never one per keystroke. Asking
the model lands one or two writes per question per textkind. Both people draft this quiz and a
second, rewrite every text field several times, run the askers repeatedly and fiddle with layout:
about 3,000 mutations a week, rounded up to 5,000. Three listeners and one and a half tables
touched per mutation gives about five subscription updates per mutation; a page open is seven
queries.

| Per month, conservative | Estimate | Free tier | Share |
|---|---|---|---|
| Mutations | 22,000 | | |
| Subscription re-runs | 110,000 | | |
| Page-open queries | 13,000 | | |
| Ask-route actions, if moved to Convex | 2,000 | | |
| **Function calls** | **~150,000** | 1,000,000 | 15% |
| Action compute for asks | ~2.5 GB-hours | 20 GB-hours | 12% |
| Storage | under 1 MB | 0.5 GB | ~0% |
| Database I/O, every re-run re-reads | ~1.4 GB | 1 GB | over |
| Database I/O, cache shared across clients | ~0.5 GB | 1 GB | 50% |

**The binding number is bandwidth, not calls.** Calls would have to grow seven-fold before the
free tier noticed. Database I/O is `result size × re-runs`: each re-run of the questions query
ships every question row, and a row carries its clueing, hint, notes and any ishes JSON, about
20 KB per re-run for this quiz. Three listeners times twenty thousand mutations lands on the 1 GB
line; a two-user chat app in the post linked below hit the same wall. Two design choices keep it
under: query per open quiz rather than per account, and keep large blobs (ishes results, guesses)
off the row that every field edit invalidates.

**What crossing a line does.** Free is a hard cap: emails as a limit approaches, then the
deployment is disabled for the rest of the calendar month and calls return errors until the
first of the month. Starter has no monthly fee, needs a card, and meters the same overage at
$2.20 per extra million calls or $0.22 per extra GB of I/O: a bad month is tens of cents. Limits
are summed per team across all projects and deployments, so the agents' dev deployments, preview
deployments and e2e runs draw on the same pool as production.

Sources, read 2026-09-27: [pricing](https://www.convex.dev/pricing),
[limits](https://docs.convex.dev/production/state/limits),
[usage limits](https://docs.convex.dev/production/usage-limits),
[pricing FAQ](https://www.convex.dev/pricing/faq),
[How Convex Works](https://stack.convex.dev/how-convex-works),
[query functions](https://docs.convex.dev/functions/query-functions), and a post-mortem,
[Two users, tiny data](https://dev.to/dheerajakula/why-a-two-user-convex-chat-app-read-tens-of-mb-a-day-360k).

### Measured (2026-09-28)

The same sample-sized hunt, brought in through the Import box (24 questions by the end of the
session, 11 widgets, 21 columns, 13 expressions), edited in the production build by a script
while a second browser watched the same quiz: 46 mutations of five kinds (reorders, the lock,
new questions, text commits, sorts). Server numbers are the local backend's own per-function
log (`usageStats`), each execution counted once. A local backend, so these are the server's
costs without the network; latency at a distance was simulated by delaying every websocket
message, which adds round-trip time but not bandwidth limits.

| Per edit, author plus one watcher | Before (export asked on every change) | Now (export on request) |
|---|---|---|
| Function calls | 6.0 (3.3 not cached) | 3.7 (2.2 not cached) |
| Database I/O | 76 KiB | 46 KiB |
| Downloaded by each browser | 34 KiB | 15 KiB |

Where the 46 KiB goes: about 20 KiB is `hunts.perform` reading the open quiz, about 22 KiB the one
uncached rerun of `quizzes.open` (the watcher's rerun is a cache hit, which costs no I/O), and a
little `hunts.open` when a quiz row changes. At 60 questions the same edit costs 110 KiB. Nothing
official says whether a cache hit counts as a billed function call; the table counts every one.

**Against the free plan**, at a steady edit every fifteen seconds (240 an hour): about 900
function calls and 11 MiB of database I/O an hour, so the 1 GB of I/O lasts about ninety editing
hours a month and the million calls about eleven hundred. The appendix's month (22,000
mutations, three listeners) comes to about 110,000 calls (11%) and 1.0 GB of I/O: at the free
line, as it predicted; on Starter, a few cents at most. Only cloud deployments count: the agents'
and e2e's local backends draw on no quota.

| Wait the author sees (median, ms) | Local | 80 ms network | 200 ms network | Local, 60 questions |
|---|---|---|---|---|
| Reorder (arrow key) | 84 | 165 | 310 | 202 |
| Four quick presses, after the last | 88 | 155 | 271 | 276 |
| Lock or unlock | 70 | 152 | 284 | 174 |
| Add a question | 84 | 162 | 290 | 214 |
| A text commit, until saved | 76 | 158 | 280 | 202 |
| Sort by a column (rewrites every place) | 140 | 220 | 350 | 421 |
| The quiz on screen, fresh tab | 225 | 400 | 670 | 430 |

The mutation's own round trip at the socket is 32 to 36 ms locally (86 for a sort); the rest of
each wait is the page redrawing, most of it the grid's formulas recomputed for every question.
A fresh tab paints its shell in 30 to 60 ms and needs about three round trips for the quiz
(the socket, `hunts.open`, then `quizzes.open`, which waits on the hunt to resolve the labels).

A quiz screen holds four live queries (`idents.current`, `hunts.open`, `quizzes.open`,
`reviews.forQuiz`), none per row, as designed.

**Since then** (same day, same session and hunt): a quiz holds its questions' order, each
question is a query of its own (`questions.open`), and each action reads what it needs.

| | Before | After |
|---|---|---|
| Database I/O per edit, this session's mix | 46 KiB | 32 KiB |
| Downloaded per edit, each browser | 15 KiB | 5.2 KiB |
| Function calls per edit (not cached) | 3.7 (2.2) | 10.1 (4.2) |
| A text edit, with the reruns it causes | 46 KiB | 3 KiB |
| A move | 45 KiB | 45 KiB |
| Add a question, until shown (local; 80 ms network) | 84; 162 ms | 115; 261 ms |
| The quiz on screen, fresh tab (local; 80 ms network) | 225; 400 ms | 235; 495 ms |

At a steady edit every fifteen seconds of mostly text, that is a few MiB of I/O an hour rather
than eleven. A move still reads every question (for their Q#s); a new question, and a fresh tab,
take one more round trip, since a question's query is asked for once the quiz names it. A quiz
screen now holds a query per question as well as the four above.

### Measured in the cloud (2026-09-28)

The production deployment (`triquet.vercel.app`), driven by `scripts/measure-latency.ts` from a
container on the Coach's machine, whose requests reach Convex through Cloudflare's Boston edge:
the sample's largest quiz brought in through the Import box (25 rows, 33 by the end), a second
browser watching, 56 edits of six kinds a run, two runs. The same script against the agents'
local backend and production build gives the local column, and lands within a few ms of the
table above, so the two tables compare directly. A request to the deployment over a warm
connection takes 28 to 45 ms, so this is close to the best case: an author farther from the
deployment pays the extra distance on every edit.

| Wait the author sees (median; p90, ms) | Local | Cloud |
|---|---|---|
| Reorder (arrow key) | 86; 115 | 233; 287 |
| Four quick presses, after the last | 171; 188 | 420; 451 |
| Lock or unlock | 74; 84 | 188; 210 |
| Add a question | 93; 102 | 232; 275 |
| A text commit, until saved | 58; 66 | 149; 160 |
| Sort by a column (rewrites every place) | 149; 171 | 401; 442 |
| The quiz on screen, fresh tab | 232; 248 | 588; 720 |

The watcher sees each change within 10 ms of the author, both locally and in the cloud.

| Mutation round trip at the socket (median ms) | Local | Cloud |
|---|---|---|
| A one-row edit (lock, add, text, reorder) | 23 to 31 | 87 to 98 |
| A sort | 76 | 281 |
| Each of four quick presses | 87 | 245 |

Where a cloud wait goes, for a reorder: about 35 ms of network, about 60 ms for the server to run
and commit the mutation, then about 135 ms until the redelivered queries are on screen (57
locally). A sort rewrites every place and commits more slowly in the cloud than locally. Four
presses queue behind one another, so the last waits for the three before it. A fresh tab's four
round trips in sequence (the socket, `hunts.open`, `quizzes.open`, then each question's
`questions.open`), at about 90 ms each, account for its extra 350 ms.

Bandwidth does not move: each browser downloads the same 9 KiB per edit in both columns (about 4
redelivered queries per edit, for this mix, which leans on moves), and a fresh tab 29 KiB. This
side cannot see database I/O or function calls in the cloud: agents hold no production key,
so those are for the Convex dashboard's usage page.

**What it means.** The reorder passes the 150 ms line that recommendation 3 set, at 233 ms, and
four quick presses come to over 400 ms: an optimistic `move_question` is now called for. A sort,
at 400 ms, is the next candidate; it could reuse the same `Rank` functions. The lock and an added
question sit near 200 ms, a pause but a short one. A text commit needs nothing, since the author's
text is on screen as they type it.
