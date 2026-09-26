# Hosting: client-first, plus stateless functions (Sept 2026)

**Decision.** The app is written for the browser. It must run on static hosting plus stateless
functions, and it must work with the network off except for asking a model. User data never
renders on a server. Every server call goes through one `port.ts`, and each one is either
replaceable by a client-only path or a named exception below. We do not take charge of a server
until a clear, strong reason arrives; none has.

**Why Vercel, then.** For provisioning, previews, deploys and environment management, not for
compute. Static hosting with a function or two beside it is what we use of it. Taking advantage
of Next.js is fine: pages prerender at build so the shell paints before the data arrives. That
is static prerendering, not request-time rendering; there is no request-time rendering of user
data by construction once the data lives in the browser.

**What was wrong before.** `stack.md` said "Server Components for anything that touches user
data." It was followed nowhere, and with a local-first database it is backwards: a Server
Component could reach user data only through a backend session. Replaced by the line above.

## Named exceptions

* **The ask route** (`src/app/api/ask/route.ts`). It holds `ANTHROPIC_API_KEY` on the author's
  behalf. This is the worked example of when we choose a serverful component: *a secret we must
  hold for the user*, and with it the rate limiting and cost control that only a server can do.
  It is stateless and about a hundred lines; not a one-way door.
* **BYOK** (the author's own key, kept in their browser and sent straight to Anthropic) is the
  client-only alternative. It may arrive as its own independent feature; it does not replace
  the proxy, because it moves the cost and the account to the author.
* **The Jazz sync server.** A server, but not ours: Jazz Cloud or Jazz's own binary with env
  vars. Its lock-in is the data format and protocol, accepted in `2026-09-jazz.md`. It is not
  needed to start: with it unreachable, a first visit still makes its local-first account and
  reads and writes locally, and an open tab keeps working when it goes away (verified on
  alpha.56, sync server blocked in Playwright).

## What gets harder client-only, and the answer to each

* **Holding any secret**: impossible; hence the ask route.
* **Global facts** (a label unique across all users, a public leaderboard): local-first gives
  per-user and per-group truth only. Nothing in the design needs a global fact. Public-by-link
  sharing is a Jazz group with read access, and is fine.
* **Background work** (bulk passes with the tab closed, digests): needs a function or cron. Not
  contemplated.
* **Object storage** (images by presigned URL): needs a signing function. Under *Later*.
* **Trusting identity in the sync server**: configuration on Jazz's side (a JWKS URL), not code
  of ours. See the identity section of `2026-09-jazz.md`.

## Not `output: 'export'`, yet

"Serves from S3" is a stronger constraint than "no server of ours", and it has a cost: a static
export forbids dynamic segments it cannot enumerate at build, and `/my/quiz/<label>` cannot be
prerendered for labels that do not exist yet. Either a per-host rewrite rule or walking the
routing decision back to `?label=`. Neither is worth it now. The constraint we hold is *static
hosting plus stateless functions*; the export switch waits for a move to be on the table.
