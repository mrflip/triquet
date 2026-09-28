# Hosting: client-first, plus stateless functions (Sept 2026)

**Decision.** The app is written for the browser. It must run on static hosting plus stateless
functions, and the database. User data never renders on a server. Every server call goes
through one `port.ts`, and each one is either replaceable by a client-only path or a named
exception below. We do not take charge of a server until a clear, strong reason arrives; none
has.

*Amended when Convex replaced Jazz (Sept 2026):* "it must work with the network off except for
asking a model" is struck. The database is a server now, holding the truth; the browser holds
only what it is subscribed to. See `2026-09-convex.md`.

**Why Vercel, then.** For provisioning, previews, deploys and environment management, not for
compute. Static hosting with a function or two beside it is what we use of it. Taking advantage
of Next.js is fine: pages prerender at build so the shell paints before the data arrives. That
is static prerendering, not request-time rendering; there is no request-time rendering of user
data by construction: the browser reads the data from the database, never from a page.

**What was wrong before.** `stack.md` said "Server Components for anything that touches user
data." It was followed nowhere, and with a local-first database it is backwards: a Server
Component could reach user data only through a backend session. Replaced by the line above,
which still holds with the database on a server: the browser subscribes to it directly.

## Named exceptions

* **The ask route** (`src/app/api/ask/route.ts`). It holds `ANTHROPIC_API_KEY` on the author's
  behalf. This is the worked example of when we choose a serverful component: *a secret we must
  hold for the user*, and with it the rate limiting and cost control that only a server can do.
  It is stateless and about a hundred lines; not a one-way door.
* **BYOK** (the author's own key, kept in their browser and sent straight to Anthropic) is the
  client-only alternative. It may arrive as its own independent feature; it does not replace
  the proxy, because it moves the cost and the account to the author.
* **The Convex deployment.** A server, but not ours: Convex's cloud, or its open-source backend.
  Its functions are ours and live in `convex/`, deployed with the build; its lock-in is bounded by
  the Export box, the git history and `npx convex export`, as `2026-09-convex.md` says. The app
  needs it to open a quiz: with every host but the app's and the deployment's blocked, the app
  opens, edits and keeps its changes, and asking is the only other function
  (`e2e/client-first.spec.ts`). (Until September 2026 this was Jazz's sync server, which the app
  could do without.)

## What gets harder client-only, and the answer to each

* **Holding any secret**: impossible; hence the ask route.
* **Global facts** (a label unique across all users, a public leaderboard): possible now. A
  mutation reads by index inside its transaction, so an ident's or a hunt's label is unique
  across the app, enforced where it is written.
* **Background work** (bulk passes with the tab closed, digests): needs a function or cron. Not
  contemplated.
* **Object storage** (images by presigned URL): needs a signing function. Under *Later*.
* **Trusting identity**: the identity plan's job. Convex Auth or a hosted hub's JWTs, checked in
  `convex/authorize.ts`, not a server of ours. See the identity section of `2026-09-convex.md`.

## Not `output: 'export'`, yet

"Serves from S3" is a stronger constraint than "no server of ours", and it has a cost: a static
export forbids dynamic segments it cannot enumerate at build, and `/h/<hunt>/<realm>/<quiz>` cannot be
prerendered for labels that do not exist yet. Either a per-host rewrite rule or walking the
routing decision back to `?label=`. Neither is worth it now. The constraint we hold is *static
hosting plus stateless functions*; the export switch waits for a move to be on the table.
