# Deploying

Two things ship, separately. **Vercel** builds and serves the app from git: a preview for every
pull request, production for every merge to `main`. **Jazz Cloud** holds the data, the schema
it is shaped by, the migrations between schemas, and the permissions; nothing in git reaches it
by itself. You publish to it with `scripts/jazz_deploy`, by hand, under a janitor config.

Most pull requests touch only the app: merge, and Vercel does the rest. A pull request that
changes what Jazz holds needs one more step, *before* it merges (below).

## The pieces

* **Vercel** runs `pnpm build` on every push. The build bakes in `NEXT_PUBLIC_JAZZ_APP_ID` and
  `NEXT_PUBLIC_JAZZ_SERVER_URL` from the environment Vercel is given (from Doppler), so each
  deployment talks to exactly one Jazz app. Without them, the page says so instead of opening.
* **GitHub Actions** (`.github/workflows/ci.yml`) typechecks, lints, tests, builds and runs e2e
  on every pull request and every push to `main`, and checks that the migrations are ready
  (`pnpm migrations:check`, below). It deploys nothing.
* **Jazz Cloud** keeps, per app: every schema it has been given (by hash), the migrations that
  connect them, and one *permissions head*, the rules every client is held to. Old and new
  clients coexist: a client on an earlier schema keeps working, its rows translated by the
  migrations in between.
* **Doppler** names who is acting where: `<stage>_<actor>`. `prd` holds production's settings,
  the ones Vercel builds production with; `prd_janitor` adds the admin secret, and is the only
  config that can publish to production.
  `./scripts/doppledo prd_janitor <command>` runs a command under it.

## Does this change need a Jazz deploy?

| The pull request changes | Jazz deploy? | Migration file? |
| --- | --- | --- |
| Components, state, lib, models (outside the rows below) | no | no |
| `src/db/permissions.ts` | yes | no |
| A table or column in `src/db/schema.ts`: added, removed, renamed, or its type, nullability or reference (`JZS.rel`) changed | yes | yes |
| A value list behind a `JZS.enum()` column (`BotLabelVals`, `TextkindVals`, `ModelTierVals`, `WidgetkindVals`, `ExpressionOwnerVals`, `BottingStatusVals`) | yes | yes |
| A Zod validator behind a `JZS.json()` column (today, `IshValidators.ishItem`, behind `bottings.items`), **descriptions included** | yes | yes |
| A validator behind a `jsonText` column, or a row validator in `models/` | no | no |
| Only a reverse relation (`JZS.reverse`) | no | no |

When in doubt, ask the server. `./scripts/doppledo prd_janitor ./scripts/jazz_healthcheck` changes
nothing. It prints your checkout's schema hash ("Current schema hash: …") and the schema
production's permissions head is on ("Server permissions head is vN on …"). The same hash means
no deploy is needed for the schema; a different one means there is. Whether it also needs a
migration file, `jazz_migration` (below) decides.

## Migrations

Migrations live in `src/db/migrations/`, one committed folder for every app. A migration joins
two schemas, not two apps: `cfb3…-8fce….ts` serves any app that holds `cfb3…`, production or dev.
Beside them, `snapshots/` records each schema a migration led to. The latest snapshot is the
baseline the next migration starts from, and a deploy reads the snapshots for the schemas in
between. Keep every migration and snapshot for good: a deploy walks from whatever an app holds to
your checkout, one migration after another, and may need any of them.

The dev server reads the same folder (Jazz looks for it beside `schema.ts`, which is why it sits
in `src/`), so your local database follows along: write a migration, and the running dev server
applies it.

`./scripts/doppledo <your dev config> ./scripts/jazz_migration` writes the migration a schema
change needs, from the latest snapshot to `src/db/schema.ts` as it stands. It asks no server, so
any config does. With nothing to migrate, it writes nothing; run it whenever you like. It ends by
saying which of these happened:

* **Nothing written.** The schema is the one the latest snapshot holds.
* **A snapshot, no migration.** The change transforms no rows; commit the snapshot.
* **A migration that needs no edits.** Jazz inferred every step. Glance at its `migrate` section
  and commit it.
* **A migration that needs editing.** Its path comes alone on the last line (stdout). In its
  `migrate` section, resolve every `// TODO`: a `default` for each new required column (what
  existing rows read as), a `backwardsDefault` for each removed one (what older clients see),
  `s.renameFrom('old_name')` for a rename. "No safe migration steps were inferred" is a change
  Jazz cannot translate on its own (a JSON column's schema changing in place, say): stop and ask
  a Coach.

On a branch made by `pnpm run newb <label>`, the migration is named for the branch
(`…-20260926-<label>-<from>-<to>.ts`) and staged. On any other branch it is left `unnamed` and
unstaged: rename it for what the change is, keeping its timestamp and hashes.

`pnpm migrations:check` fails when the schema has changed since the latest snapshot with nothing
to match, or a migration is still `unnamed` or holds a `TODO`. It changes nothing and needs no
Doppler, and CI runs it on every pull request, so a forgotten migration fails the pull request
rather than the deploy.

**Two branches that both change the schema.** Each writes a migration from the same snapshot.
Once one merges, the other's no longer starts from what production holds, and
`migrations:check` fails on it after rebasing. Delete that branch's own migrations and snapshots
(the ones `main` doesn't have), rerun `jazz_migration`, and redo any edits it needs. A local
database that already applied a deleted migration has no way forward from it; reset it (below).

## Releasing a change Jazz must know about

1. **Start a branch** (`pnpm run newb <label>`) **and change the schema.** The dev server
   republishes to your local Jazz on every save. A structural change waits for its migration
   (the dev server logs `schema push failed … requires a migration` meanwhile): run
   `jazz_migration` whenever the schema settles, at least before each commit, and once its TODOs
   are resolved the dev server applies it (`schema updated`). Each run adds one migration to the
   chain, which is fine.
2. **Finish the migration** (above), and commit it with its snapshot.
3. **Open the pull request.** CI runs, including `migrations:check`; Vercel builds a preview. See
   *Previews* below for what the preview's database holds.
4. **Once you mean to merge, publish to production, from the branch:**

   ```
   ./scripts/doppledo prd_janitor ./scripts/jazz_deploy
   ```

   It publishes the schema, pushes each migration from what production holds to your
   schema, and moves the permissions head, then runs the healthcheck. The production app already serving keeps working: its clients stay on their
   schema, translated through the migration.
5. **Merge.** Vercel deploys; new clients arrive on the new schema and find it waiting.

Publish only what you will merge. A deploy moves production's head to your schema, and the next
release's migration must start from there; a published-then-abandoned schema has to be migrated
through. If a release goes out without its deploy, the app still opens and works in each browser,
but its changes will not sync until `jazz_deploy` runs.

**Permissions apply at once, to every client.** There is one head, and a deploy moves it; keep a
change to `permissions.ts` one that old clients also satisfy.

## Previews

A preview deployment is built with whatever Jazz app Vercel's *Preview* environment names.

* **If that is the production app**, a preview of a schema change talks to a server that does not
  hold its schema: it opens and works in the browser, but does not sync. Deploying to production
  just to preview is the "publish only what you will merge" trap above.
* **Better: a staging app for previews.** A Jazz Cloud app of its own, named by `stg` for
  Vercel's Preview environment, with a `stg_janitor` config holding its admin secret. Deploy a
  schema change there while the pull request is open (`./scripts/doppledo stg_janitor
  ./scripts/jazz_deploy`); when staging's history gets tangled, replace the app, not the process.

**To do:** have Vercel's preview deployments use the staging database, and have CI deploy the
schema to it automatically (CI then lives in the staging environment, with `stg` settings).

## Who may do what

* **Coaches** publish to production (`prd_janitor`) and to their own dev app (`dev_janitor`).
* **Agents** publish only to the agents' app (`dev_aijanitor`), never to production, and never under
  a human's config. An agent that finds production needs a deploy says so in `HUMAN-whatsup.md`.

## Resetting

* **A local Jazz database:** `./scripts/doppledo <config> ./scripts/nuke-jazz_local` moves its data
  directory aside (and with it the `.env` recording its app id); the next dev server starts empty.
* **A Next build directory:** `./scripts/doppledo <config> ./scripts/nuke-next`.
* **A Jazz Cloud app:** there is no reset. Make a fresh app in the Jazz Cloud dashboard, point the
  config's app id and secrets at it in Doppler, run `jazz_deploy` under it (a fresh app needs no
  migration), and for `prd`, rebuild on Vercel so the new app id is baked in.

## History

The first migration (`src/db/migrations/…-20260926-initial_setup-cfb3ee9c72d3-8fced61cea62.ts`)
exists because an agent published a placeholder schema (`cfb3ee9c72d3`) to the production app
during setup.
The agents' app (`dev_aijanitor`) holds the same placeholder; the same migration brings it
current with `./scripts/doppledo dev_aijanitor ./scripts/jazz_deploy`.
