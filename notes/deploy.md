# Deploying

Two things ship, in one step. **Vercel** builds and serves the app from git: a preview when a
pull request opens, production for every merge to `main`. **Convex** holds the data and runs the
functions in `convex/`; Vercel's build command deploys those to the matching Convex deployment
before it builds the app, so a deployment and the pages that talk to it always come from the same
commit. Nothing is published by hand.

If a task may touch on convex or vercel, load the appropriate skills

Merge, and Vercel does the rest, backfills included: that is **serial mode**, and it holds as long
as every merge since the last deploy is one production's rows already fit. A stack holding a
widening and its tightening is deployed in **yeet mode** instead: merge it whole, then run
`pnpm db:up`, which walks production through the schema steps in order (*Schema pushes: the two
modes*, below). Both read and write one **migrations table**, `schema_steps`, so either can
follow the other.

**What is live** is said at `/stats`, linked from nowhere: the commit the build came from, the pull
request its merge names (number, title, description) and the commits it brought in, when it was
built, a link to every change since the deployment before, and, to an admin (`Actor.isAdmin`), or
to anyone where the deployment sets `EXPOSE_INTERNAL_STATS_TO_ALL`, how far each backfill has run
on the deployment it talks to. All of it is also compact JSON, in a box at the foot of the page and
behind a *Copy stats* button beside the heading; `/stats.json` serves the build's part of it as a
file written at build (`force-static`, so no server function: *Client-first*). The build's facts
are gathered as the page is prerendered
(`src/lib/build-stamp.ts`), from Vercel's git variables, or git itself elsewhere; each is a best
effort, and a shallow clone may list no commits.

## The pieces

* **Vercel** runs `pnpm build:vercel` for every build, production or preview:

  ```
  convex deploy --cmd 'node scripts/convex-previews.ts after-vercel-build && pnpm run build' \
      --preview-run migrations:runAll \
    && node scripts/convex-migrations.ts after-vercel-build
  ```

  `convex deploy` runs `pnpm build` with `NEXT_PUBLIC_CONVEX_URL` set to the URL of the
  deployment that `CONVEX_DEPLOY_KEY` names, which the build bakes into the pages, and then, if
  the build passed, pushes `convex/` (schema, functions, indexes) to it. A production key deploys
  to production; a preview key makes (or reuses) a preview deployment named for the branch. Once
  the push has landed, the backfills run: on a preview, `--preview-run` starts them; on
  production, `scripts/convex-migrations.ts` records the commit in the migrations table, starts
  them, waits for them to finish, seeds, and records them finished; a backfill that stops fails
  the build, loudly (*Serial mode*, below). Without a key the
  build fails before it starts; without the URL, the page says so instead of opening
  (`SyncUnconfigured`). `ANTHROPIC_API_KEY` stays a Vercel variable for the ask route, beside
  `ENABLE_ANTHROPIC_BOT=allow`, which switches the route on (`Approve.mayAskAnthropicBot`):
  unset, or anything but `allow`, and every ask is declined politely before a model is called.
* **Vercel builds a preview when a pull request opens, not on every push.** A restack pushes ten
  branches at once, and Vercel counts every build toward its daily quota, even one its Ignored
  Build Step cancels (124 in a day, October 2026). So `vercel.json` turns push builds off for
  every `20*` branch (`git.deploymentEnabled`), which leaves `main` building production, and
  `.github/workflows/preview.yml` asks Vercel's REST API for a Git deployment of the head commit
  when a pull request opens, reopens or is marked ready, and again whenever someone adds the
  `preview` label, which it then takes off. Because it is a Git deployment, not `vercel deploy`,
  Vercel shows the commit's message and serves it at the branch's address,
  `triquet-git-<branch>-mrflips-projects.vercel.app`; the workflow waits for the build and puts
  that address in its summary and in one comment on the pull request. The build runs on Vercel
  with the Preview environment's variables, exactly as before; GitHub holds a Vercel token
  (`notes/env_vars_tokens_and_keys.md`) and no Convex key.
* **Convex** keeps one production deployment and a preview deployment per open branch, each with
  its own database and its own environment variables. A deployment holds exactly one version of
  the functions and one schema, whichever was pushed last. There is no permissions head:
  authorization is code in `convex/authorize.ts` and ships with the functions. Sessions are
  Convex Auth's (`convex/auth.ts`), and every deployment needs three environment variables of its
  own for them, set on the deployment (the Convex dashboard, or `npx convex env set`), never in
  the Doppler configs that sync to Vercel (`prd`, `stg`), since the web app Vercel builds never
  reads them: `JWT_PRIVATE_KEY` and `JWKS`, a key pair minted for that deployment alone
  (`scripts/convex_auth_keys` shows how), and `SITE_URL`, the web app's address. Without them no
  browser can sign in, and so none can take a userlabel. Preview deployments take theirs from
  the project's default environment variables for previews. No variable names the admins, who may
  change the widget library: a user is one when its own `admin` flag says so, set only from the
  command line (`scripts/adopt`, *Adopting a user*, below). A local backend makes every user an
  admin (`TRIQUET_EVERYONE_ADMIN=yes`, set by `scripts/convex_dev`); production and previews never
  set it. A `TRIQUET_ADMINS` left on a deployment from before is read by nothing, and may be unset
  (`./scripts/doppledo prd_janitor npx convex env remove TRIQUET_ADMINS`). An admin must be signed
  in with Google: an anonymous user's flag counts for nothing (`Actor.ofUser`). Another,
  `EXPOSE_INTERNAL_STATS_TO_ALL`, shows `/stats`'s backfills to everyone rather than to an admin
  alone: `true` (`./scripts/doppledo prd_janitor npx convex env set EXPOSE_INTERNAL_STATS_TO_ALL
  true`); `false` or unset, they stay an admin's, and any other value is refused.
* **Google sign-in** is offered only on a deployment holding both of Google's keys,
  `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` (`googleKeyed`, `convex/auth.ts`); everywhere else the
  browser sees only the anonymous way in. Like the session keys, a cloud deployment's live on the
  deployment, never in the Doppler configs that sync to Vercel; the dev client's live in the dev
  configs, for local backends (below). **Production's** are a web client of a Google Cloud project
  of its own, made by *path A* in `whiteboard/20261010-oauth/google-oauth-keys.md` (published,
  unbranded; the consent screen names `<prod>.convex.site`), whose one redirect URI is
  production's HTTP-actions address plus `/api/auth/callback/google`; a Coach sets them with `npx convex env set` under
  `prd_janitor`, or in the dashboard, and keeps the secret out of chat and files. A deployment
  picks them up without a redeploy (a local backend served the Google routes at once, 2026-10-11).
  **A local backend** takes them from the Doppler config `scripts/convex_dev` runs under (all three
  dev configs carry the dev client, which accepts lane 0's `dev` and `agent` callbacks, ports 3500
  and 3501), and has them taken away under a config without them. **Previews and CI** never have
  them: Google allows no wildcard redirect URI, and nothing automated signs in to Google.
* **GitHub Actions** (`.github/workflows/ci.yml`) typechecks, lints, tests, builds and runs e2e
  (against the optimized build) on every pull request and every push to `main`, and checks that
  `convex/_generated/` was committed as the functions regenerate it. Every job runs against a local backend or none; CI
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
| A row validator in `models/`, and so a table in `convex/schema.ts` (a field added, removed, renamed or reshaped; an index) | the push **validates every document the deployment holds** against the new schema, and refuses if any fails (below): a widening lands, a tightening lands only after its widening's backfill |
| A backfill in `convex/migrations.ts` | it runs once the push lands, and the build waits for it. The title says `(Serial Deploy: …)`: in serial mode, merge up to it and let its build finish; in yeet mode, merge on |
| `convex/_generated/` | commit what the push writes; CI refuses a checkout whose generated code is stale |

## Schema pushes: the two modes

Convex checks every existing document against the schema being pushed, and refuses the whole push
if one does not fit: the build fails, and the deployment keeps serving the previous version
untouched. A backfill runs only on a deployment holding its code. So a change that production's
rows would not fit (a required field added, a field reshaped, a field retired) is **two schema
steps**, with a backfill between them, as the migrations component's own README has it:

1. **Widen.** The schema accepts the old rows and the new: the field is optional in
   `convex/schema.ts` (written by hand there, over the row validator, which stays strict so every
   write gives it). A backfill in `convex/migrations.ts` writes it into the old rows, and joins
   the end of `Backfills` there (a test refuses a backfill missing from it).
   `tests/convex/schema.test.ts` lists the field under `Backfilling`. The pull request's title
   ends `(Serial Deploy: <chain>)`, the chain being the sprint's name. A table to be emptied is
   emptied by a backfill the same way, while the widened schema still names it. Code that reads
   the field may cope with its absence, or may not: the window between the two steps is minutes
   in yeet mode, and a dash or an error on an old row for those minutes is accepted.
2. **Tighten.** A second pull request, stacked above, makes the field required again (or drops
   the table), drops the fallback and the backfill (from `Backfills` too), and empties
   `Backfilling`. It leaves `Backfills` holding at least one: `runAll`, the component's runner of
   a series, refuses an empty one, and every deploy runs it.

A **schema step** is a first-parent commit of `main` that changes `convex/schema.ts` or
`convex/migrations.ts`: a widening, a tightening, or a backfill with no schema change. Steps are
taken in merge order, which is the order the sprint needs. One Vercel build is one commit, and so
one step: the two modes differ in how the steps get taken.

A field whose absence has a meaning of its own needs none of this: it is optional in its row
validator for good, every reader says what its absence means, and `tests/convex/schema.test.ts`
lists it under `Absentable`. A hunt's `wheel` is the first: a hunt nobody has arranged reads as
the default wheel.

### Serial mode

Today's flow, unchanged in shape: merge, Vercel builds `main`, `convex deploy` pushes `convex/`,
and `scripts/convex-migrations.ts after-vercel-build` records the commit as pushed in the
migrations table, runs `migrations:runAll`, waits (up to five minutes) for
`migrations:outstanding` to come back empty, seeds (`seeding:seedWidgets`), and records the commit
backfilled. No downtime, and nothing to think about while no merge tightens.

With a tightening in play, **merge in order and let each Serial Deploy's build finish** before
merging what is stacked above it: Vercel builds only the newest commit of a push, so a widening
and its tightening merged in one push build the tightening alone (`vercel.json` turns off
`github.autoJobCancelation`, so merges in separate pushes build in sequence rather than the
newest alone). A tightening built before its widening's backfill has run is refused
(the rows lack the field), production keeps serving the previous step, whole, and the build log
names the row. That is not a lockout: it is the cue for yeet mode. A backfill that stops, or is
still running at the limit, fails the build the same way; the functions already serve, so what
fails is the pages, where a warning in a log once went unread (10-07, 10-08).

### Yeet mode

`pnpm db:up` (`scripts/deploy.ts`) walks a deployment through the schema steps itself, from a
full checkout, so a whole stack can be merged at once and deployed in one sitting, with the
minutes of downtime that implies. Agents never run it against production; a Coach does, under
the janitor's config:

```sh
./scripts/doppledo prd_janitor pnpm db:up --dry-run   # what it would do, and nothing else
./scripts/doppledo prd_janitor pnpm db:up             # do it
```

It fetches `origin/main`, reads the migrations table's newest row (`deploying:newest`), lists the
steps newer than it (`git rev-list --first-parent origin/main -- convex/schema.ts
convex/migrations.ts`), takes a snapshot (`convex export`, to `data/snapshots/` or `--snapshot
<path>`; it also leaves one to restore from in the dashboard), and then, for each step oldest
first, in a scratch worktree at that commit (its own packages installed when its lockfile
differs): pushes its functions and schema (`convex deploy`, typecheck and codegen off), records it
pushed, runs its backfills to the end, seeds, records it backfilled. Then the same for `main`'s
head. A refused push or a backfill that stops ends the run with Convex's words, the deployment
left serving the last step whole; fix it in a new commit and run again, and the walk resumes
where it stood. A head already pushed whose backfills never finished (serial mode's build failed
in the wait) is finished and recorded, not re-walked. Flags: `--to <ref>` for a head other than
`origin/main`; `--from <rev>` (a sha, short or long, or any ref) for the step the rows stand at
when the table is empty or names a commit not in this history (the first run on production:
`/stats` names the commit it serves; given both, `--from` wins and the run says so);
`--wait <seconds>` for the backfill limit (300); `--verify <role>` to check the table's word
before anything is pushed: the step it names is pushed to that local role (emptied if its rows
refuse it) and the role's function spec (`convex function-spec`, as `scripts/convex_healthcheck`
compares it) must equal the target's, or the run stops naming the functions that differ. It
checks the functions, which is what the CLI exposes, not the tables themselves; name a disposable
role (`e2e`). With `TRIQUET_DEPLOY_HOOK_URL` set, it ends by
posting to it: Vercel's deploy hook, so the pages are built once the functions they talk to are
in. Without it, redeploy `main` from Vercel, whose own push is then a no-op and whose backfill run
finds nothing.

Two rules keep the modes from colliding: **do not run `pnpm db:up` while a production build is
mid-push** (run it after the build has finished, red or green), and end a yeet with that
redeploy. The steps the walk needs are the repository's history, each step's schema and the
backfills that fit it being the files at that commit; that is why it runs from a clone and not
from Vercel's build, and why a backfill may lean on its commit's row validators.

### The migrations table

`schema_steps` (`src/models/schema-step.ts`, `convex/deploying.ts`): one row per schema step a
backend has taken, with the commit's sha and subject, when it was pushed, and when its backfills
finished (null until they have). Written by whatever pushed the step: the build, `pnpm db:up`,
or `scripts/convex_dev`. The newest row is the backend's mark; `pnpm db:up` walks what is newer
and infers nothing from what a deployment or a website is serving. It is data, so an export
carries it, and a rehearsal knows where a snapshot stands without being told. The migrations
component keeps the other half, a row per backfill with how far it got, which `/stats` shows and
every runner waits on. Git is the ledger of what each step did:
`git log --first-parent -- convex/schema.ts convex/migrations.ts`.

### Rehearsing a deploy on production's rows

```sh
./scripts/doppledo prd_janitor npx convex export --path ~/prd-exports/<date>.zip
pnpm db:up --role agent --rehearse ~/prd-exports/<date>.zip
```

The rehearsal reads the snapshot's `schema_steps` to learn the step its rows stand at (or is told
with `--from <rev>`), pushes that step to the role, imports the snapshot over everything the role
holds (`convex import --replace-all`), and walks it to the checkout's head: what production will
do, on production's rows. Keep the export outside the repo; it is production's data.

### Local backends

`scripts/convex_dev` records the checkout's `HEAD` as the step a role's backend holds at every
push (an empty backend fits any schema, so a reset backend holds the head) and starts its
backfills. A backend that saw each widening as it was merged never falls behind. One that jumped
past a tightening is refused its push, and is caught up by the same program:

```sh
pnpm db:up --role dev            # stop the role's dev server first: its watch would push the head over every step
pnpm db:up --role dev --dry-run
```

It walks the role from its mark to the checkout's `HEAD` (uncommitted changes come with the next
`pnpm dev`). A mark the checkout's history does not hold (a backend last pushed from a branch
since rebased) is refused; `--from <rev>` says where its rows really stand. A role whose rows are
not worth keeping is simply emptied instead (`scripts/convex_reset <role>`, or
`scripts/convex_dev <role> --reset`).

## Commands run by hand on production

A few one-off commands change production's rows from a terminal, under the janitor's config.
Each stands behind one guard, `scripts/janitor.ts`, so none can be pointed at the wrong deployment
by accident:

* **A dry run by default.** Without `--deployment`, the command looks, says what it would do, and
  changes nothing. It ends by naming the deployment it reached.
* **It acts only with `--deployment <name>`**, and only when that name is the deployment the
  environment's key actually reaches: the guard asks that deployment, with the same admin key,
  for the address it reports for itself (its `cloudUrl`, which `convex function-spec` reads and
  which writes nothing), and takes the name from that (`careful-otter-123` from `https://careful-otter-123.convex.cloud`; a local backend's host
  and port, `127.0.0.1:3431`). A name typed on the command line never vouches for itself. Any other
  name stops the command before it does anything.

So the second run copies the name the first one printed, having seen it. Agents prove such a
command against their own lane's backend (`./scripts/doppledo dev_claude scripts/convex_dev
<role> scripts/<command>`) and in convex-test, and never run it under a production config, not
even dry.

### Checking the reserved list against production

The reserved list (`src/lib/vv/patterns.ts`, `ReservedToplevelGroups` and the prefixes beside it)
keeps a new hunt's label and a userlabel being claimed from the words for the app's own pages and
people. It governs only new labels: a hunt or an org named before a word joined the list keeps
it, at its address, and stays writable, since a hunt's row holds its label and org to their shape
and the words every label is kept from alone. After the list grows, see what it leaves standing:

```
./scripts/doppledo prd_janitor scripts/check_reserved
```

It reads every hunt (`check_reserved:refused`) and names each one whose label or org the list
would refuse were it made now, as `~org/label`, saying which of the two. It writes nothing, and
behind the guard it names the deployment it reached first; `--deployment` changes nothing but which
deployment it insists on. A hunt it names needs nothing done: it is there to tell you who holds a
word now kept, if you want to ask them to move.

### Adopting a user

Some things only the command line may give a user: the admin flag (no variable names admins), a
userlabel that a hunt's address holds (`~mrflip/…` keeps `mrflip` from being claimed in the app),
and a place on a hunt without its smiths adding them. `scripts/adopt` gives them, to one user:

```
./scripts/doppledo prd_janitor scripts/adopt --email <address> --userlabel mrflip --admin --smith-all
```

* **Which user**, one way: `--email <address>` (the one user whose row holds that email, as Google
  sent it; refused when none does, or more than one, which it names), `--holding <userlabel>`, or
  `--id <user id>`. An email is for a lookup you are watching, once: it is no standing way to name
  a user, since an address can change hands. Once it holds a userlabel, name it by that.
* **What to give it**, any of: `--userlabel <userlabel>` (refused when another user or a ghosting
  holds it, or it is not a userlabel one may claim; a hunt's address holding it is no bar, and
  the user's huntships' copies follow), `--title <title>`, `--admin` or `--no-admin`, and a role on
  hunts, never lowering one it holds: `--smith <~org/hunt>`, `--reviewer <~org/hunt>` (each as often
  as needed), `--smith-all`, `--reviewer-all`. Only a user signed in with Google (not anonymous) is
  made an admin or put on a hunt.
* **What it keeps to.** Sealing keeps an anonymous user's sandbox its own alone, and the command
  keeps to that: `--smith-all` and `--reviewer-all` pass over such sandboxes (and say how many),
  and `--smith` or `--reviewer` naming one is refused. A sandbox merged into a user signed in with
  Google, or whose user signed in with Google, is a hunt like any other. An anonymous user holding
  its sandbox is not relabelled (relabelled, it could make a second), though it may be retitled;
  nor is any anonymous user given a userlabel a hunt's address holds (it would seem to own hunts it
  cannot be put on).
* **The userlabel it leaves.** Relabelling a user that held one retires nothing (an adoption is no
  merge): the old userlabel is left free for anyone to claim, unless a hunt's address still holds
  it. The outcome says which.

It stands behind the guard: the first run is dry, and says who it found and what it would change
(`adopt:plan`, which writes nothing); the second, with `--deployment`, changes it in one transaction
(`adopt:perform`) and says what it changed. Run again, it changes nothing more, and says how much of
what was asked the user holds already. A refusal changes nothing, and says why. **Read the user it
found before you act**: its id, handle, the name Google sent and when its row was made. An email is
Google's claim, kept without Google's word that it was verified, so make sure the user is yours.

On a local backend it runs the same way, under `scripts/convex_dev`: `./scripts/doppledo
dev_<you> scripts/convex_dev dev scripts/adopt --holding <userlabel> --smith ~org/hunt`. Every user
of a local backend is an admin already (`TRIQUET_EVERYONE_ADMIN`), and one that has not signed in
with Google is anonymous, so is put on no hunt, unless `testing:vouchFor` has vouched for it.

### Clearing production's people (the OAuth sprint, October 2026)

Production keeps its hunts and loses its people (the Coach, 2026-10-11): the sprint makes Convex
Auth's `users` row the person-facing record, and there is nothing worth carrying across.
`scripts/clear_people` deletes every row of `users`, `authAccounts`, `authSessions`,
`authRefreshTokens`, `authVerifiers`, `authVerificationCodes`, `authRateLimits`, `idents`,
`identings`, `huntings`, `reviews` and `reviewings`, through `clear_people:clearBatch`, a batch a
run, until a run deletes nothing. Hunts, realms, quizzes, questions, widgetings, columns,
widgeteds, signals and the library stay, at their addresses; a quiz whose shared reviews go has
its change signal moved, as any write to its reviews moves it. Every browser is signed out.

**Why a command, and not a backfill.** A table is usually emptied by a backfill (*Schema pushes*,
above), which runs by itself when its pull request merges. This clear must happen at a moment
the Coach chooses: after production has been exported, and just before the push that drops
the tables, so that nobody's visit in between leaves a row the new schema refuses. A backfill would
run at the first merge, while the old app still serves and makes new people. A command also gives
a dry run that shows the counts first, and can simply be run again. And it reaches Convex Auth's
tables, which are not ours to backfill.

The Coach's steps, in order:

1. **Export production**, and keep the file outside the repo:
   `./scripts/doppledo prd_janitor npx convex export --path ~/prd-exports/<date>.zip`.
2. **Merge the sprint's first two threads** (`split_account` and `clear_people`), and let them
   deploy. Nothing changes for visitors; the clear's functions are now on production.
3. **Clear, then deploy at once.**
   - `./scripts/doppledo prd_janitor scripts/clear_people`: a dry run, counting each table's rows
     and naming the deployment it reached. Check that the name is production's.
   - `./scripts/doppledo prd_janitor scripts/clear_people --deployment <that name>`: the clear. It
     says what each run deleted, and counts again; anything left was written while it ran (exit 1),
     and a second run takes it.
   - Then merge the sprint's remaining threads straight away, and let them deploy. A visit in
     between leaves a row the new schema refuses, and the push stops, naming it: clear again and
     redeploy.
4. **Set production's two Google keys** (*Google sign-in*, under *The pieces*, above), only once
   the sprint's `google_signin` thread is merged and deployed (the Coach, 2026-10-11; the pre-plan
   had them before the clear). The deployment picks them up without another deploy.
5. **Sign in with Google**, with any handle or none (`mrflip` is held by hunts' addresses, so it
   cannot be claimed in the app).
6. **Adopt** (*Adopting a user*, above), on the Coach's word at the time, said in chat before it
   runs, its output relayed whole: give the user the Coach signed in as `mrflip`, admin, and smith
   of every hunt.
   - `./scripts/doppledo prd_janitor scripts/adopt --email <the Coach's> --userlabel mrflip --admin
     --smith-all`: a dry run. Check that the user it found is the Coach's (no userlabel, or the one
     they chose, and signed in with Google), and the deployment's name is production's.
   - The same, with `--deployment <that name>`: the adoption. Reload the app: the handle is
     `mrflip`, and every hunt is in the list.

The `converge` thread deletes `scripts/clear_people` and `convex/clear_people.ts` with the tables
they empty, and keeps the guard. So step 3's clear runs from a checkout of `main` as step 2 left
it, holding the script, before the remaining threads merge: once `converge` is on `main`, the
script is no longer there to run (`git switch --detach <step 2's merge>` brings it back).

`converge` is a schema step with no backfill and no tightening: it drops `idents`, `identings`
and `huntings`, adds `huntships` and `ghostings`, gives `reviews` and `reviewings` a required
`user_id`, and makes `users` ours (our row validator, Convex Auth's fields kept). Its push fits
only a deployment the clear left empty of people; one row of them left (a visit between the clear
and the push) and Convex refuses the push, naming it, and production keeps serving the step before:
clear again and redeploy. A browser still running the bundle from before the push is turned away
by the functions it calls (`idents:*` are gone) until it reloads, and its session is gone with
the clear anyway. A Coach's own local backends (`dev`, `e2e`) refuse the new schema too:
`scripts/convex_reset <role>` empties one, or `scripts/convex_dev <role> --reset`.

## History

What was done by hand before deploys took their own steps: the table clearings of September and
October 2026, kept here because no commit holds them. Everything since is in git and in the
migrations table.

**Clearing the widget tables (rewidgeting).** The merge that brought in `widgets`, `widgetings`
and `widgeteds` translates no rows: the three tables they replace are cleared, and one idempotent
mutation seeds what the tool can make again. What is lost, and what comes back, is
`whiteboard/20261001-rewidgeting/losses.md`. A Coach's steps, in order, done in one sitting:

1. **Export the hunt.** On each quiz's screen, Raw Export → *Prepare export*, and keep the JSON
   somewhere safe; it holds every question as typed. For a whole snapshot as well,
   `./scripts/doppledo prd_janitor npx convex export --path <zip>` (read-only; it also leaves a
   snapshot in the dashboard to restore from).
2. **Clear the old tables in the Convex dashboard** (production's data view): delete every
   document of `expressions`, `widgets` and `bottings`. A push is refused while a table absent
   from the new schema holds documents, so the deploy cannot land until this is done; a missed
   one names itself in the build log, and the deployment keeps serving the old version
   meanwhile. Between this step and the next the old app is still serving, its bots' cells
   reading empty, so go straight on.
3. **Deploy**: merge, and Vercel's build pushes the new schema and functions. Each quiz's
   `bulk_ishes_last`, which the new schema no longer names, cannot be deleted in the dashboard
   (the old schema, still serving, requires it), so the merge that lands first is
   `20261004-unset_bulk_ishes_last`, whose schema still lets a quiz hold it. Once Vercel has
   deployed it, take the field off:
   `./scripts/doppledo prd_janitor npx convex run migrations:run '{"fn": "migrations:retireBulkIshesLast"}'`.
   Then merge the tightening after it, which pushes the schema without the field.
4. **Seed**: `./scripts/doppledo prd_janitor npx convex run seeding:seedWidgets`. It answers with
   the widgets it added (seventeen, the first time) and each quiz it gave the default widgetings,
   as `hunt/realm/quiz`; a second run adds nothing. A quiz whose columns name none of the default
   set is left with none, and its widgetings are added by hand from its gear.
5. **Re-ask the bots.** Every bot's cell reads *Double-click to ask*; there is no Recalculate all
   any more, so each cell is asked on its own, and the sums follow.

A local backend needs none of this: `scripts/convex_dev <role> --reset --seed <command>` empties
it, pushes, and seeds it (the dev scripts pass `--seed` on every start). One whose rows are worth
keeping is exported first as in step 1 and its questions pasted back through Import once it has
been reset.

**Sessions (dbpolicy thread 1).** The merge that brings in Convex Auth replaces the browser key.
A Coach's steps, in order:

1. **Keys.** Set `JWT_PRIVATE_KEY`, `JWKS` and `SITE_URL` on production (and in the defaults for
   preview deployments), from a pair minted for it alone: run `scripts/convex_auth_keys`' Node
   snippet by hand, or Convex Auth's own `generateKeys.mjs` (its *Manual Setup* page), and paste
   the values in the dashboard. `SITE_URL` is the app's public address. Keep the private key out
   of chat, files and Doppler's app configs.
2. **Clear `identings`** in production's data view, every document, and go straight on: the push
   is refused while any row still names a browser key, and the old app keeps writing them until
   the new one serves. A row that slipped in names itself in the build log; clear it and redeploy.
3. **Deploy**: merge.
4. **Backfill**: `./scripts/doppledo prd_janitor npx convex run migrations:run '{"fn": "migrations:backfillIdentClaims"}'`.
   Every ident made before is then claimed by nobody, and the first session to assert its userlabel
   holds it from then on: that is how each person gets theirs back, and also how someone else could
   get there first.

## Working locally

Each role (`dev` for a person, `agent`, `e2e`, `e2e-agent`, `e2e-built`) has a Convex backend of
its own: Convex's open-source binary, run by `scripts/convex_backend <role>` on port `34xx` (HTTP
actions on `35xx`), with its database, file storage, instance secret and the CLI's `cli.env` in
`data/convex-<role>/`. Nothing of it leaves the machine, and it needs no Convex account.

`scripts/convex_dev <role> [--reset] [--watch] <command>` is how anything runs against one: it
starts the backend if it is not answering, pushes `convex/` to it (which regenerates
`convex/_generated/`), marks it clearable, gives it throwaway keys for Convex Auth when it has none
(`scripts/convex_auth_keys`), empties it with `--reset`, records the checkout's `HEAD` in its
migrations table and starts its backfills (*Local backends*, above), keeps pushing as `convex/`
changes with `--watch`, and runs the command with `NEXT_PUBLIC_CONVEX_URL` naming the backend.
`pnpm dev` and `pnpm dev:agent` go through it; so does the e2e suite, from `playwright.config.ts`.
A backend the script started stops with the command; one that was already running is left alone.

`scripts/convex_reset <role>` empties a role's backend, every row of every table, through
`testing:clearAll`, which a backend refuses unless `TRIQUET_CLEARABLE` is `yes` on it. Only the
local scripts set it, and only on `127.0.0.1`; production never has it. The e2e suite's way in
makes each test's hunt through `testing:makeHunt` (`e2e/admin.ts`), and puts a second visitor on
it through `testing:putOnHunt`, refused the same way. All three are internal functions, so they deploy with the rest, but nothing without the deployment's admin key
can call them, and production refuses them even then.

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
regeneration in a commit of its own. CI's `test-generated-build` job pushes to a backend of its own and fails
on any difference.

### Asking a real bot while debugging

The ask route declines every ask unless `ENABLE_ANTHROPIC_BOT` is exactly `allow`
(`mayAskAnthropicBot` in `src/lib/approve.ts`), and it spends real model usage when it is. To switch
it on for one session without touching a Doppler config, set it *inside* `doppledo`, so it lands
after Doppler has filled the environment:

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

Vercel's Preview environment holds a preview deploy key (Doppler's `stg`, synced), so every
preview build makes a Convex preview deployment named for its branch, empty, with the functions
and schema of that commit. It is where a reviewer clicks around. A preview is built when its pull
request opens, and again on the `preview` label (*The pieces*): a push alone builds nothing, so a
pull request's preview shows the commit it was last built from. Convex deletes a preview
deployment five days after it was made (fourteen on the paid plans, as of September 2026), and
the next preview build makes a fresh one.

Previews are kept few, because every one counts against the team's deployment limit (forty, which
we hit on 2026-09-30):

* **Each preview build shortens its preview's life to 36 hours** from that build
  (`scripts/convex-previews.ts after-vercel-build`, inside the deploy's `--cmd`), so a pull
  request nobody rebuilds lets go of its preview in a day and a half; its pages then reach a
  deployment that is gone. Add the `preview` label to build both afresh. Convex has no project-wide
  setting for this: the lifetime is per deployment, set after it is made. A failure there warns
  in the build log and leaves Convex's default; it never fails the build.
* **Closing a pull request deletes its branch's preview**, merged or not
  (`.github/workflows/convex-previews.yml`), with `CONVEX_PREVIEW_PRUNER_KEY`: a preview deploy
  key of its own, synced from Doppler to GitHub Actions, which reaches the project's previews
  and cannot see production (`notes/env_vars_tokens_and_keys.md`). Run that
  workflow by hand, naming a branch, for one that never had a pull request.
* By hand, under the janitor's Doppler config: `pnpm previews` lists every preview, oldest
  first (made, expires, branch, label); `pnpm previews drop-oldest [count]` deletes the
  `count` (5) oldest and lists what is left; `pnpm previews <prune <branch> | expire <branch>
  [hours]>` acts on one branch's. Reach for `drop-oldest` when the deployment limit is hit
  before the 36 hours are up: a sprint can open thirty previews in a day.

Nothing seeds a preview: `--preview-run` can name a function to run after the push, once
there is something worth seeding with.

## Who may do what

* **Coaches** hold `prd_janitor`, deploy production (ordinarily by merging), and run the healthcheck
  against it.
* **Agents** never cause a deploy to production or run using a human's config.  Their world is the local roles. An agent that finds production needs something says so in an entry under `human/`.
  - Agents may, when granted permission, use the `dev_aijanitor` role: it has significantly upgraded privileges and access to the production machines.

## Resetting

* **A local backend's rows:** `scripts/convex_reset <role>`, with the backend running.
* **A local backend, whole:** stop it, and move `data/convex-<role>/` away. The next start mints
  a new instance secret and admin key and starts empty.
* **A Next build directory:** `./scripts/doppledo <config> ./scripts/nuke-next`.
* **A cloud deployment:** clear its tables in the Convex dashboard, or delete a preview
  deployment and let the next push make another.

