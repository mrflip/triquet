# Deploying

Two things ship, in one step. **Vercel** builds and serves the app from git: a preview for every
pull request, production for every merge to `main`. **Convex** holds the data and runs the
functions in `convex/`; Vercel's build command deploys those to the matching Convex deployment
before it builds the app, so a deployment and the pages that talk to it always come from the same
commit. Nothing is published by hand.

Merge, and Vercel does the rest. The one thing that can stop a release is the schema (below).

## The pieces

* **Vercel** runs, on every push:

  ```
  npx convex deploy --cmd 'pnpm build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL
  ```

  `convex deploy` pushes `convex/` (schema, functions, indexes) to the deployment that
  `CONVEX_DEPLOY_KEY` names, then runs `pnpm build` with `NEXT_PUBLIC_CONVEX_URL` set to that
  deployment's URL, which the build bakes into the pages. A production key deploys to production;
  a preview key makes (or reuses) a preview deployment named for the branch. Without a key the
  build fails before it starts; without the URL, the page says so instead of opening
  (`SyncUnconfigured`). `ANTHROPIC_API_KEY` stays a Vercel variable for the ask route.
* **Convex** keeps one production deployment and a preview deployment per open branch, each with
  its own database and its own environment variables. A deployment holds exactly one version of
  the functions and one schema, whichever was pushed last. There is no permissions head and no
  migration chain: authorization is code in `convex/authorize.ts` and ships with the functions.
* **GitHub Actions** (`.github/workflows/ci.yml`) typechecks, lints, tests, builds and runs e2e
  on every pull request and every push to `main`, and checks that `convex/_generated/` was
  committed as the functions regenerate it. Every job runs against a local backend or none; CI
  deploys nothing and holds no Convex key.
* **Doppler** names who is acting where: `<stage>_<actor>`. `prd` holds production's settings,
  the ones Vercel builds production with, and syncs to Vercel's Production environment;
  `prd_janitor` adds the production deploy key, and is the only config that can reach production
  from a terminal (`./scripts/doppledo prd_janitor <command>`). The `dev_*` configs hold nothing
  of Convex's but `NEXT_PUBLIC_CONVEX_URL`, which the local scripts set anyway.
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
previous version untouched. There are no migrations here, by decision (`notes/decisions/
2026-09-convex.md`): nobody is using the app yet, so a deployment whose rows no longer fit is
emptied and pushed again. For a local role that is `scripts/convex_reset <role>`. For a preview
deployment it is nothing: each one starts empty. For production it is the Coach's call, made in
the Convex dashboard (clear the tables, or make the change accept the old rows). The day there is
data to keep, `@convex-dev/migrations` is the route (the `convex-migrate` skill knows it); until
then, do not write one.

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

## Previews

Vercel's Preview environment holds a preview deploy key (Doppler's `stg`, synced), so every pull
request's build makes a Convex preview deployment named for its branch, empty, with the functions
and schema of that commit. It is where a reviewer clicks around. Convex deletes a preview
deployment five days after it was made (fourteen on the paid plans, as of September 2026), and
the next push makes a fresh one. Nothing seeds a preview: `--preview-run` can name a function to run after the push, once
there is something worth seeding with.

## Who may do what

* **Coaches** hold `prd_janitor`, deploy production (ordinarily by merging), and run the healthcheck
  against it.
* **Agents** never deploy to production, never hold its key, and never run under a human's config.
  Their world is the local roles. An agent that finds production needs something says so in
  `HUMAN-whatsup.md`.

## Resetting

* **A local backend's rows:** `scripts/convex_reset <role>`, with the backend running.
* **A local backend, whole:** stop it, and move `data/convex-<role>/` away. The next start mints
  a new instance secret and admin key and starts empty.
* **A Next build directory:** `./scripts/doppledo <config> ./scripts/nuke-next`.
* **A cloud deployment:** clear its tables in the Convex dashboard, or delete a preview
  deployment and let the next push make another.

## Not yet done

Phase 3b of `whiteboard/convex_yay-plan.md`, which needs the Coach: the Convex team and project,
the production deploy key into `prd_janitor` and Doppler's `prd`, the preview key into `stg`,
Vercel's build command, and the first production deploy. Until then the app serves from local
backends only, and this document describes the arrangement as designed rather than as run.
