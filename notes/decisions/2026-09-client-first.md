# Hosting: client-first, plus stateless functions (Sept 2026)

**Decision.** The app is written for the browser. It runs on static hosting plus stateless
functions, and the database. Pages prerender at build, so the shell paints before the data
arrives; user data never renders on a server, and the browser reads it from the database
directly. We take charge of no server of our own until a clear, strong reason arrives.

**Named exceptions.** Adding another needs a Coach.

* **The ask route** (`src/app/api/ask/route.ts`), the one named server function: it holds the
  model's key on the author's behalf, the worked example of a secret we must hold for the user.
  Stateless; its browser side is `src/lib/ask/port.ts`.
* **The Convex deployment**: a server, but not ours. Its functions live in `convex/`, deployed
  with the build. `e2e/client-first.spec.ts` holds the app to needing nothing else.

**Why Vercel, then.** Provisioning, previews, deploys and environment management, not compute:
static hosting with a function beside it.

**Where else it is written.** `notes/stack.md`, *Application framework*, states the rule as the
stack lives by it; `notes/decisions/20260928-database-decisions.md` weighs it against the storage
choices (*Mostly client-only* among the desiderata). This file was rewritten short in October 2026,
when the pointers to it from `CLAUDE.md` and `notes/stack.md` were found dangling.
