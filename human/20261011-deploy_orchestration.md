# 2026-10-11: Deploys -- take Convex out of the web build; one program walks the steps

For the Coach, from a cloud session that read the pipeline end to end (`notes/deploy.md`,
`convex/migrations.ts`, `scripts/convex-migrations.ts`, `scripts/convex_dev`, `scripts/automerge.ts`,
the Oct 4 to 9 runbooks) and checked the claims against Convex's docs, the migrations component's
README (0.3.6) and Vercel's. Nothing here is built; it is the case for what to build. A first
draft proposed sequencing production builds one merge at a time; you rightly refused that
(quota, and insanity), and asked why the web deployment does this at all. This is the answer.

## The diagnosis

**The Convex mechanics are right**, and are Convex's own recommended practice (the migrations
component's README, steps 1 to 5; the migration primer): a push validates every existing row
against the new schema and refuses the whole push if one does not fit, leaving the old version
serving. A backfill runs only on a deployment that holds its code. So a field old rows lack ships
optional with a backfill, and becomes required in a later push, once the backfill has run. There
is no setting that lets one push do both (`schemaValidation: false` skips the check and leaves
the types lying about the rows). Within one commit nothing cancels: `runAll` runs that commit's
backfills under that commit's schema, in order, skipping finished ones.

**What is broken is where the deploy lives.** `pnpm build:vercel` makes Vercel's build of `main`
push `convex/` to production and then run the backfills. That couples three things that should
not be coupled:

1. **One build is one commit is one schema.** A widening and its tightening need two pushes in
   order with the backfill between them. Inside a Vercel build the only way to get two pushes is
   two merges, each built on its own, and Vercel skips queued builds of the same branch by default
   (`github.autoJobCancelation`), so even that needs babysitting. Hence `(Serial Deploy: ...)`,
   "merge up to here and watch the log", and a stuck production on 10-07 and 10-08.
2. **The backfill step is a warning in a build log.** It cannot fail the build (the functions
   already serve, and a failed build would only part the pages from them), so when it did nothing
   twice, nothing said so until a tightening was refused.
3. **Every merge touches the database.** A docs-only PR merged to `main` runs a production
   Convex push. Previews need their own deployment per branch, so `convex deploy --cmd` is the
   right shape *for previews*; it was never the right shape for production.

So: `human/20261005-deploy_migrations.md` bolted a runner onto the build because the build was
where the deploy was. Move the deploy, and the runner, the marker, the ledger table and the
runbook steps all go.

## The proposal: `pnpm deploy`

One program, run by you from the laptop under `prd_janitor` (agents never run it), that owns the
whole production deploy. Merge the stack first, in any way you like, all at once: nothing happens
to production on a merge. Then:

```sh
./scripts/doppledo prd_janitor pnpm deploy            # production, from origin/main
./scripts/doppledo prd_janitor pnpm deploy --dry-run  # the steps it would take, and nothing else
```

What it does, in order, saying each step as it goes and stopping at the first failure:

1. **Snapshot.** `npx convex export --path <dated zip>` (which also leaves a restorable snapshot
   in the dashboard), so the walk has an undo.
2. **Find the steps.** A migrations table, as everywhere else: a table of ours,
   `schema_steps`, holding one row per schema step the backend has taken (the commit, its subject,
   when). The program writes a row after a step's push has landed and its backfills have finished,
   through an internal mutation that ships with the functions; a fresh backend records the head it
   was first pushed with, since an empty backend fits any schema. The steps that *exist* are the
   first-parent commits of `origin/main` that touch `convex/schema.ts` or `convex/migrations.ts`,
   one per PR that changed the schema or a backfill, in merge order, so A precedes B precedes C by
   construction. The steps to *take* are the ones newer than the newest the table holds. Git says
   what exists; the database says what it has had; nothing is inferred from what a website or a
   deployment is serving. The table in `notes/deploy.md` goes.

   Half of this already exists: `@convex-dev/migrations` keeps a row per backfill (state, cursor,
   rows done), which `/stats` shows and the program waits on. What it cannot say is whether a
   step with no backfill (a tightening) was pushed; `schema_steps` says that.

3. **Walk them.** For each step, in a scratch worktree at that commit (`pnpm install` only when
   its lockfile differs): `npx convex deploy --typecheck disable --codegen disable` (functions and
   schema, no web build), then `migrations:runAll` and wait for `migrations:outstanding` to come
   back empty, then `seeding:seedWidgets`. A refused push, or a backfill that fails, stops the
   program with Convex's message: production is left serving the previous step, whole and
   consistent, and the fix is a new PR. There is no silent path.
4. **Land the head.** The same for `origin/main`'s head if it was not the last step, and a row
   for it.
5. **Build the pages.** Vercel's production build becomes a plain `pnpm build` with
   `NEXT_PUBLIC_CONVEX_URL` as an ordinary Production environment variable; the production deploy
   key leaves Vercel altogether. Automatic production builds are turned off for `main`
   (`git.deploymentEnabled`), and the program ends by hitting a Vercel Deploy Hook, which builds
   `main`'s head: one build per deploy, after the functions it talks to are in place. Previews are
   untouched: `convex deploy --cmd ... --preview-run` stays, chosen by `VERCEL_ENV` in
   `build:vercel`.

While the walk runs, the pages already live talk to functions a step or two ahead of them. That
is the downtime you said you are fine with: minutes, visible in your terminal, ending in either
`main` deployed whole or a named row and an untouched previous step.

**The same program does the local backends.** `pnpm deploy --role dev` (through
`scripts/convex_dev`, no Doppler) walks your `dev` backend from the commit it last took to the
checkout's head with the same steps and the same table: this is `notes/deploy.md`'s *Catching
up* recipe with the person removed, and it answers your second complaint without a staging round
trip (which would have had to walk the same commits, and `convex import` is, I believe, checked
against the schema anyway). `scripts/convex_dev` also runs `migrations:runAll` after every
successful push, so a backend that sees each widening never falls behind in the first place.

**Rehearsal is the same program too.** `pnpm deploy --rehearse <export.zip> --role agent`
imports the snapshot into a local role (`--replace-all`) and walks it. The snapshot carries
production's `schema_steps` rows with the rest of its data, so the rehearsal knows exactly where
those rows stand without being told: the reason the record is a table and not a deployment
variable. What production will do, on production's rows, before you run it on production.

## Two modes, one table (the Coach's framing, 2026-10-11)

Keep the current machinery and add the script, and there are two ways to deploy, which agree
because they read and write the same `schema_steps` table and the same backfill statuses.

**Serial mode** is today's: merge, Vercel builds `main`, pushes `convex/`, runs the backfills.
No downtime; with no widen, fill, tighten among the merges, nothing to think about; with one,
merge in order and let each build finish. A missed step does not lock production: the push is
refused, the build goes red, production keeps serving the previous step whole, and the exit is
yeet mode. Two changes make it safer than it is now: the post-push step records the head in the
table once its backfills finish; and a stuck or timed-out backfill fails the build rather than
warning (your downtime tolerance makes the loud choice the right one).

**Yeet mode** is the script: in any full checkout, against whatever Convex deployment the
environment names (`prd_janitor` for production, `convex_dev <role>` for a local backend), it
reads the table, takes the steps newer than the newest recorded, walks them in scratch worktrees,
pushing each and finishing its backfills, records as it goes, and lands the head. Downtime: the
pages already live talk to functions a step ahead until you redeploy `main`. Three refinements
on the framing:

* A step is identified by its sha on `main`'s first-parent line, named by its subject. The script
  refuses when the target's recorded step is not on the checkout's first-parent history: the
  database was migrated by some other branch, or the wrong checkout is pointed at production.
* The table is a high-water mark, not a set: serial mode may jump from step k to k+3 when nothing
  between tightens, so "absent" means newer than the newest recorded, and the script records the
  steps it passes over as superseded.
* A target already serving the head with unfinished backfills (the 10-07 and 10-08 shape) gets
  its backfills finished and recorded, not re-walked, which would regress functions below the
  live pages.

Two rules keep them from colliding: do not run the script while a production build is mid-push
(run it after the build has finished, red or green; the script can check the commit's status
first), and end a yeet with a redeploy of `main`, whose own Convex push is then a no-op and
whose backfill run finds nothing: the proof the two modes agree. Taking the Convex deploy out of
the web build altogether (the section above) then becomes optional, a later simplification rather
than a prerequisite.

## Why the walk needs the repository's history, and so not Vercel

The repo carries every step's pushable schema as git history, not as files at the head: a step's
schema is `convex/schema.ts` at that commit, and the backfills that fit it are
`convex/migrations.ts` at the same commit, importing that commit's row validators and readers.
That is deliberate. Rails-style migrations can live at the head for good because they are table
operations written against no model; ours write through the row validators on purpose, so a
backfill is correct only beside the models of its own commit. Keeping steps as head-resident files
would mean freezing a copy of the models beside each, which git already does at every commit.

Hence the program needs a full clone and cannot run inside a Vercel build, which has one commit's
checkout and one install. The laptop has the clone; a GitHub workflow with a full fetch would
too. What stays in sync: each pushed step is whole (its functions with its schema, its backfills
run before the next step), and at the end the head's functions and the head's pages are in, from
one commit, as before. In between, the pages already live talk to functions a step or two ahead
of them: the minutes of downtime you accept. One caveat: a step is pushed from its own checkout,
with its own lockfile and CLI. Days of drift for production; a dev backend left for months might
reach a step that no longer installs, and the answer there is a reset, as it is today.

## What goes

* `(Serial Deploy: ...)` in titles, the merge-up-to-it rule, and `automerge`'s refusal of schema
  PRs: a merge no longer deploys anything, so there is nothing for merge order to protect.
  `automerge` keeps its other stops (conflict, draft, fork, two stacks).
* `scripts/convex-migrations.ts after-vercel-build`, and the `&&` after `convex deploy` in
  `build:vercel`. The waiter it holds moves into `pnpm deploy`.
* The ledger table in `notes/deploy.md`, and the runbook's "run this, then check that" steps.
  Table clearings become backfills (delete every row while the widened schema still names the
  table; the tightening drops the table), so nothing in a deploy is by hand.
* The "until it has run, a row reads a default" fallback that each widening carried: the window
  between a widening's push and its tightening's is now the minutes of one program's run, not
  the days between two merges. Keep it only for a chain whose backfill is slow by design.

## What stays true

A widening and its tightening are still two pushes with a complete backfill between them; Convex
gives no way round that, and the program does not try to find one. It makes the two pushes happen
in order on their own. Two alternatives I looked at and recommend against: a build that pushes
twice from one commit with validation off in between (clever, and leaves production unvalidated
if its second push fails), and a GitHub workflow holding the production key that walks the
commits on each push to `main` (it works, but it puts the key in CI and makes every merge a deploy
again, which is the thing to stop). A `workflow_dispatch` workflow you trigger by hand, with the
key in a protected environment, is a fair place for the same program if the laptop is ever the
wrong place; the program is the same either way.

## Open questions

* `npx convex deploy` under a production deploy key with no `--cmd`: it should push functions and
  schema alone, as the help says; I have not run it that way. `convex run` and `convex env set`
  under the key already work (`prd_janitor` today).
* `--codegen disable` at an older commit keeps the worktree clean; that commit's committed
  `convex/_generated/` is what CI checked at the time, so it is the right code to bundle.
* The first run: the PR that adds `schema_steps` is itself the first step, and the program is
  told once, with `--from <sha>`, which commit production's rows stand at (`/stats` says what it
  serves); from then on the table says.
* Vercel: `git.deploymentEnabled: { main: false }` plus a Deploy Hook. A hook builds the branch's
  head, which is what we want; confirm the project's hook settings when you set it up.

If you want it built: one PR for `scripts/deploy.ts` and the `convex_dev` change, with its tests
(the step list from a git log, the walk against a local role); one for `build:vercel`,
`vercel.json`, `automerge`'s stops and the notes. The first is usable on a local role before
anything about production changes.
