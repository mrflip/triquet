# Storage and hosting: what we want, and what could give it to us

**Status (2026-09-27): open, with a Coach.** Jazz v2 is on trial as the database
(`decisions/2026-09-jazz.md`); the trial is not going terribly, but it is not going well. This
note is the review of what we would miss by moving to something more conventional, and of which
conventional things are in the running. It settles nothing yet. When it does, the decision moves
to `decisions/` and this note becomes its reasoning.

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
`whiteboard/jazz-migration.md`. What matters for this review:

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

| | No 2nd paradigm | Client-only | Multiplayer | Ergonomic | Zero-ops, few vendors | Disciplined interface | Agent-friendly | Boring |
|---|---|---|---|---|---|---|---|---|
| Jazz v2 (today) | ●● | ●● | ●● | ● | ● | ● | ○ | ○ |
| Supabase + Drizzle, SSR Next | ● | ○ | ● | ● | ●● | ●● | ●● | ●● |
| Supabase, client-side (supabase-js + RLS) | ● | ●● | ● | ● | ●● | ● | ●● | ●● |
| Supabase + PowerSync | ○ | ●● | ●● | ● | ● | ● | ● | ● |
| Convex | ●● | ●● | ●● | ●● | ●● | ●● | ●● | ● |
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

## Where this leans

The decision is between **Convex** and **client-side Supabase**, and it turns on one question:
is multiplayer something we would build in the first month, or a promise for later? If the
former, Convex: realtime and transactions are the default rather than something wired, and the
static-plus-one-function shape survives. If the latter, client-side Supabase, accepting that
Realtime gets wired when the day comes. **PowerSync only if offline becomes a requirement**, which
the list above says it is not.

In every conventional option, what we give up from Jazz is true local-first: the silent no-login
account, work with the network off, and no vendor holding the rows. Convex gives the collaboration
back without the first two; Supabase gives back neither without PowerSync.

## Open with a Coach

* The question above: multiplayer now, or later?
* If Jazz stays: **where the sync server runs** for the trial, Jazz Cloud or our own. Tied to
  where Jazz Cloud takes the JWKS settings, which the docs do not show. (Moved here from
  `stack.md`.)
* If Jazz goes: which of the client-first decision's named exceptions survive. The ask route
  stays a stateless function wherever it lives; "user data never renders on a server" holds under
  Convex and client-side Supabase and falls under SSR.
* Identity was deferred until the Jazz move landed (`decisions/2026-09-jazz.md`, TODO 1). Every
  candidate above brings its own answer; settle storage first.

Facts checked 2026-09-27, and liable to drift: Zero 1.0 ([InfoQ](https://www.infoq.com/news/2026/06/zero-version-1/)),
Convex's free tier ([limits](https://docs.convex.dev/production/state/limits)), Supabase's free tier
pausing after a week idle ([pricing](https://costbench.com/software/database-as-service/supabase/)),
PowerSync's free tier ([pricing](https://powersync.com/pricing)).
