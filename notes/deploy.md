# Deploying

Two things ship, in one step. **Vercel** builds and serves the app from git: a preview for every
pull request, production for every merge to `main`. **Convex** holds the data and runs the
functions in `convex/`; Vercel's build command deploys those to the matching Convex deployment
before it builds the app, so a deployment and the pages that talk to it always come from the same
commit. Nothing is published by hand.

If a task may touch on convex or vercel, load the appropriate skills

Merge, and Vercel does the rest. The one thing that can stop a release is the schema (below).

## The pieces

* **Vercel** runs `pnpm build:vercel` on every push:

  ```
  convex deploy --cmd 'node scripts/convex-previews.ts after-vercel-build && pnpm run build'
  ```

  `convex deploy` pushes `convex/` (schema, functions, indexes) to the deployment that
  `CONVEX_DEPLOY_KEY` names, then runs `pnpm build` with `NEXT_PUBLIC_CONVEX_URL` set to that
  deployment's URL, which the build bakes into the pages. A production key deploys to production;
  a preview key makes (or reuses) a preview deployment named for the branch. Without a key the
  build fails before it starts; without the URL, the page says so instead of opening
  (`SyncUnconfigured`). `ANTHROPIC_API_KEY` stays a Vercel variable for the ask route, beside
  `ENABLE_ANTHROPIC_BOT=allow`, which switches the route on (`lib/approval`): unset, or anything
  but `allow`, and every ask is declined politely before a model is called.
* **Convex** keeps one production deployment and a preview deployment per open branch, each with
  its own database and its own environment variables. A deployment holds exactly one version of
  the functions and one schema, whichever was pushed last. There is no permissions head:
  authorization is code in `convex/authorize.ts` and ships with the functions.
* **GitHub Actions** (`.github/workflows/ci.yml`) typechecks, lints, tests, builds and runs e2e
  on every pull request and every push to `main`, and checks that `convex/_generated/` was
  committed as the functions regenerate it. Every job runs against a local backend or none; CI
  deploys nothing and holds no Convex key.
* **Doppler** names who is acting where: `<stage>_<actor>`. `prd` holds production's settings,
  the ones Vercel builds production with, and syncs to Vercel's Production environment;
  `prd_janitor` (a Coach's) and `dev_aijanitor` (an agent's, when a Coach grants it) add the
  production deploy key, and are the only configs that can reach production from a terminal
  (`./scripts/doppledo prd_janitor <command>`). The other `dev_*` configs hold nothing of
  Convex's but `NEXT_PUBLIC_CONVEX_URL`, which the local scripts set anyway.
* **Local backends**, one per role, need no account at all: see *Working locally*.

## Does this change need anything of me?

| The pull request changes | On merge |
| --- | --- |
| Components, state, lib, models | Vercel builds; nothing else |
| A function in `convex/`, or `convex/authorize.ts` | `convex deploy` pushes it with the build; the new functions serve as soon as the push lands, a moment before the new pages |
| A row validator in `models/`, and so a table in `convex/schema.ts` (a field added, removed, renamed or reshaped; an index) | the push **validates every document the deployment holds** against the new schema, and refuses if any fails (below) |
| `convex/_generated/` | commit what the push writes; CI refuses a checkout whose generated code is stale |

**Schema pushes.** Convex checks every existing document against the schema being pushed, and
refuses the whole push if one does not fit: the build fails, and the deployment keeps serving the
previous version untouched. Production holds quizzes people are writing, so a change that its rows
would not fit (a required field added, a field reshaped) ships as a migration, in two pull
requests, through `@convex-dev/migrations` (`convex/migrations.ts`; the `convex-migrate` skill
knows it):

1. **Widen.** The schema accepts the old rows and the new: the field is optional in
   `convex/schema.ts` (written by hand there, over the row validator, which stays strict so every
   write gives it), and code that reads it copes with its absence. A backfill in
   `convex/migrations.ts` writes it into the old rows (a `runAll` runner lists them when there are
   several). `tests/convex/schema.test.ts` lists the field under `Backfilling`.
2. **Backfill.** Once the first is merged and deployed:
   `./scripts/doppledo dev_aijanitor npx convex run migrations:run '{"fn": "migrations:<name>"}'`,
   after the same with `"dryRun": true` to see what it would do.
   `npx convex run --component migrations lib:getStatus` says how far each got.
3. **Tighten.** The second pull request makes the field required again, drops the fallback and
   the backfill, and empties `Backfilling`. Its push checks every row, so it lands only once the
   backfill is complete. It also adds the migration to the ledger below, since the backfill it
   drops is still needed by any backend that has not run it.

Rehearse on a copy first: `npx convex export --path <zip>` from production (read-only; it also
leaves a snapshot in the dashboard to restore from), `npx convex import --replace-all` into a
local role, then the three steps against that role.

A local role whose rows no longer fit is simply emptied (`scripts/convex_reset <role>`), unless
its rows are worth keeping: then catch it up (below). A preview deployment is made fresh for a
branch and kept across its pushes; delete it in the dashboard and the next push makes another.

**The migration ledger.** Every backfill ever written, oldest first, with the commit on `main`
that added it. Any commit from that one up to the tightening one still holds it.

| Commit | What its backfill writes | Run |
| --- | --- | --- |
| `b648bc6` | `hunt_id` on questions and reviews; a smith (`CaretakerLabel`) on each hunt nobody is on | `migrations:runAll` |
| `ed009a7` | `smiths_note` on quizzes, empty | `migrations:run '{"fn": "migrations:backfillSmithsNotes"}'` |

**Catching up a backend that missed a backfill.** Main cannot do it: its schema push checks every
row before any of its functions arrive, so it is refused before a backfill could run, and main no
longer has the backfill anyway. The refusal names the table and the field, which the ledger
matches to a commit. A backend stuck there holds no row newer than that commit's schema, so it
goes back and comes forward again. For each migration it missed, oldest first:

1. Stop the role's dev server, whose `--watch` would push each checkout as it goes by, and check
   out the ledger's commit: `git switch --detach <commit>`.
2. Start the role's dev server again (`pnpm dev`, `pnpm dev:agent`). It pushes that commit's
   schema, which accepts the old rows, and keeps the backend up while the backfill runs.
3. In a second terminal, start the ledger's `Run` through `scripts/convex_dev`, prefixed as the
   role's `pnpm` script prefixes it (`doppler run --` for `dev`, `scripts/doppledo dev_claude` for
   `agent`), eg `doppler run -- scripts/convex_dev dev npx convex run migrations:runAll`. The
   runner does the first hundred rows at once and schedules the rest; `npx convex run --component
   migrations lib:getStatus`, run the same way, says when it is done.

Then stop the dev server, return to your branch, and start it again: the push lands.

## Working locally

Each role (`dev` for a person, `agent`, `e2e`, `e2e-agent`) has a Convex backend of its own:
Convex's open-source binary, run by `scripts/convex_backend <role>` on port `34xx` (HTTP actions on
`35xx`), with its database, file storage, instance secret and the CLI's `cli.env` in
`data/convex-<role>/`. Nothing of it leaves the machine, and it needs no Convex account.

`scripts/convex_dev <role> [--reset] [--watch] <command>` is how anything runs against one: it
starts the backend if it is not answering, pushes `convex/` to it (which regenerates
`convex/_generated/`), marks it clearable, empties it with `--reset`, keeps pushing as `convex/`
changes with `--watch`, and runs the command with `NEXT_PUBLIC_CONVEX_URL` naming the backend.
`pnpm dev` and `pnpm dev:agent` go through it; so does the e2e suite, from `playwright.config.ts`.
A backend the script started stops with the command; one that was already running is left alone.

`scripts/convex_reset <role>` empties a role's backend, every row of every table, through
`testing:clearAll`, which a backend refuses unless `TRIQUET_CLEARABLE` is set on it. Only the
local scripts set it, and only on `127.0.0.1`; production never has it.

`scripts/convex_healthcheck <role>` asks whether a role's backend answers and whether it holds
this checkout's functions: it takes the backend's function spec (`convex function-spec`: every
function's path, kind, visibility and argument shape), pushes, and takes it again; a push that
changes nothing means the backend was current. `scripts/convex_healthcheck --cloud` does the same
for the deployment `CONVEX_DEPLOY_KEY` names, comparing its spec with that of a local role the
checkout is pushed to (`--via dev` by default), and writes nothing to the cloud.

The CLI writes `.env.local` at the checkout root on every push, naming the backend it pushed to
last. It is ignored by git, and the environment's own `NEXT_PUBLIC_CONVEX_URL` (which every
script sets) wins over it, so it does no harm; it is not this project's way of configuring
anything.

`convex/_generated/` is committed. A push regenerates it; commit what it writes, a large
regeneration in a commit of its own. CI's `generated` job pushes to a backend of its own and fails
on any difference.

### Asking a real bot while debugging

The ask route declines every ask unless `ENABLE_ANTHROPIC_BOT` is exactly `allow`
(`src/lib/approval.ts`), and it spends real model usage when it is. To switch it on for one
session without touching a Doppler config, set it *inside* `doppledo`, so it lands after Doppler
has filled the environment:

```sh
# an agent's dev server, switched on: dev:agent, plus ENABLE_ANTHROPIC_BOT=allow
pnpm dev:agent:botkey
# a person's, under their own config
./scripts/doppledo dev_<you> env ENABLE_ANTHROPIC_BOT=allow scripts/convex_dev dev --watch next dev
```

Setting it in front instead (`ENABLE_ANTHROPIC_BOT=allow pnpm dev:agent`) does not work
whenever the config holds the variable: `doppler run` gives its own values precedence over the
environment it was started in. The config must hold `ANTHROPIC_API_KEY` too, or the bots read as
unable to play. The e2e suite always runs with the switch off (`playwright.config.ts`), whatever
you set; its specs stub the route instead.

## Previews

Vercel's Preview environment holds a preview deploy key (Doppler's `stg`, synced), so every pull
request's build makes a Convex preview deployment named for its branch, empty, with the functions
and schema of that commit. It is where a reviewer clicks around. Convex deletes a preview
deployment five days after it was made (fourteen on the paid plans, as of September 2026), and
the next push makes a fresh one.

Previews are kept few, because every one counts against the team's deployment limit (forty, which
we hit on 2026-09-30):

* **Each preview build shortens its preview's life to 36 hours** from that build
  (`scripts/convex-previews.ts after-vercel-build`, inside the deploy's `--cmd`), so a branch
  nobody pushes to lets go of its preview in a day and a half. Convex has no project-wide
  setting for this: the lifetime is per deployment, set after it is made. A failure there warns
  in the build log and leaves Convex's default; it never fails the build.
* **Closing a pull request deletes its branch's preview**, merged or not
  (`.github/workflows/convex-previews.yml`, with `CONVEX_PREVIEW_PRUNER_KEY`: a preview deploy
  key of its own, synced from Doppler to GitHub Actions, which reaches the project's previews
  and cannot see production). Run that
  workflow by hand, naming a branch, for one that never had a pull request.
* By hand: `./scripts/doppledo dev_aijanitor ./scripts/convex_preview node
  scripts/convex-previews.ts <prune <branch> | expire <branch> [hours]>`.

Nothing seeds a preview: `--preview-run` can name a function to run after the push, once
there is something worth seeding with.

## Who may do what

* **Coaches** hold `prd_janitor`, deploy production (ordinarily by merging), and run the healthcheck
  against it.
* **Agents** never cause a deploy to production or run using a human's config.  Their world is the local roles. An agent that finds production needs something says so in `HUMAN-whatsup.md`.
  - Agents may, when granted permission, use the `dev_aijanitor` role: it has significantly upgraded privileges and access to the production machines.

## Resetting

* **A local backend's rows:** `scripts/convex_reset <role>`, with the backend running.
* **A local backend, whole:** stop it, and move `data/convex-<role>/` away. The next start mints
  a new instance secret and admin key and starts empty.
* **A Next build directory:** `./scripts/doppledo <config> ./scripts/nuke-next`.
* **A cloud deployment:** clear its tables in the Convex dashboard, or delete a preview
  deployment and let the next push make another.

