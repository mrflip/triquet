# Deploying

Two things ship, in one step. **Vercel** builds and serves the app from git: a preview when a
pull request opens, production for every merge to `main`. **Convex** holds the data and runs the
functions in `convex/`; Vercel's build command deploys those to the matching Convex deployment
before it builds the app, so a deployment and the pages that talk to it always come from the same
commit. Nothing is published by hand.

If a task may touch on convex or vercel, load the appropriate skills

Merge, and Vercel does the rest, backfills included. The one thing that can stop a release is the
schema (below), and the one thing to watch for when merging is a pull request titled
`(Serial Deploy: …)` (*Serial Deploy*, below).

**What is live** is said at `/stats`, linked from nowhere: the commit the build came from, the pull
request its merge names (number, title, description) and the commits it brought in, when it was
built, a link to every change since the deployment before, and, to an admin (`Actor.isAdmin`),
how far each backfill has run on the deployment it talks to. The build's facts are gathered as the page is prerendered
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
  production, `scripts/convex-migrations.ts` starts them and waits for them to finish
  (*Schema pushes*, below). Without a key the
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
  Doppler's app configs: `JWT_PRIVATE_KEY` and `JWKS`, a key pair minted for that deployment alone
  (`scripts/convex_auth_keys` shows how), and `SITE_URL`, the web app's address. Without them no
  browser can sign in, and so none can assert a username. Preview deployments take theirs from
  the project's default environment variables for previews. A fourth names the admins, who may
  change the widget library: `TRIQUET_ADMINS`, usernames parted by commas or spaces (`*` for
  every username, which only a local backend should have). Unset, nobody is an admin. Production:
  `./scripts/doppledo prd_janitor npx convex env set TRIQUET_ADMINS mrflip`. Previews take it from
  the same defaults; a local backend gets `*` from `scripts/convex_dev` unless `TRIQUET_ADMINS` is
  in its environment.
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
| A row validator in `models/`, and so a table in `convex/schema.ts` (a field added, removed, renamed or reshaped; an index) | the push **validates every document the deployment holds** against the new schema, and refuses if any fails (below) |
| A backfill in `convex/migrations.ts` | it runs once the push lands, and the build waits for it; the title says `(Serial Deploy: …)`: merge up to it, and wait (*Serial Deploy*, below) |
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
   `convex/migrations.ts` writes it into the old rows, and joins the end of `Backfills` there (a
   test refuses a backfill missing from it). `tests/convex/schema.test.ts` lists the field under
   `Backfilling`. The pull request's title ends `(Serial Deploy: <chain>)` (below).
2. **Backfill: the deploy does it.** Once `convex deploy` has pushed, `scripts/convex-migrations.ts`
   starts `migrations:runAll`, which runs every backfill in `Backfills` in order and skips each one
   already finished, then waits (up to five minutes) for `migrations:outstanding` to come back
   empty. The build log ends `Backfills: every one has finished.`, or warns naming each backfill
   still running or stopped. A warning never fails the build: the new functions already serve, and
   a failed build would only part the pages from them. A backfill that throws stops the series,
   and those after it in `Backfills` wait until it is fixed and deployed again. To look later, or
   to start them by hand:
   `./scripts/doppledo prd_janitor npx convex run migrations:outstanding` (and `migrations:runAll`).
3. **Tighten.** The second pull request makes the field required again, drops the fallback and
   the backfill (from `Backfills` too), and empties `Backfilling`. Its push checks every row, so
   it lands only once the backfill is complete: merged too soon, its build fails and production
   keeps serving the widened version, and redeploying once the backfill is done lands it. It also
   adds the migration to the ledger below, since the backfill it drops is still needed by any
   backend that has not run it. It leaves `Backfills` holding at least one: `runAll` is the
   component's runner of a series, which refuses an empty one, and every deploy runs it.

**Serial Deploy.** A widening's production deploy must finish, backfill and all, before anything
stacked above it reaches `main`. Vercel builds only the newest commit of a push, so a tightening
merged in the same push as its widening is built alone: its schema is refused, since no backfill
has run, and the backfill never runs, since the widening's commit is never deployed and the
tightening's no longer holds it. Production keeps serving safely, but stuck, until the widening
is deployed by itself. So a pull request that adds a backfill to `Backfills`, or changes one, says
so at the end of its title:

```
Hunts remember the branch their quizzes were on (Serial Deploy: hunt_branches)
```

It means: **merge up to and including this pull request, wait for its production deploy to finish
(its build log says `Backfills: every one has finished.`), then merge what is stacked above it.**
The name is the migration chain: related backfills, run in pull-request order. In a sprint it is
the sprint's name; outside one, the thread's label. Every pull request of a chain that adds a
backfill carries the same name. The tightening carries no marker, since nothing waits on it, and
says in its body which chain it ends: `Tightens Serial Deploy: hunt_branches`.

Two chains may interleave: each widening is its own stop, so nothing lands unready. Recovery is
harder, though: every backfill runs in one series, so a failure in one chain holds back the other
chain's backfills, and both chains' tightenings are refused until it is fixed. Where it costs
nothing, merge one chain through its tightening before the next chain's first widening.

Two ordinary `convex/` changes merged in separate pushes close together are not covered: if Vercel
builds them at once, Convex keeps whichever pushed last, which may be the older. That is tolerated
for now; redeploy `main` if it happens.

Rehearse a backfill on a copy first, since nobody runs it by hand on production any more: `npx convex export --path
<zip>` from production (read-only; it also leaves a snapshot in the dashboard to restore from),
`npx convex import --replace-all` into a local role, push the widening to it, and run
`migrations:run '{"fn": "migrations:<name>", "dryRun": true}'` to see what it would do, then
`node scripts/convex-migrations.ts run`, each through `scripts/convex_dev <role>` (as under
*Catching up*, below). Push the tightening last: it lands only if every row now fits.

A field whose absence has a meaning of its own needs none of this: it is optional in its row
validator for good, every reader says what its absence means, and `tests/convex/schema.test.ts`
lists it under `Absentable`. A hunt's `wheel` is the first: a hunt nobody has arranged reads as
the default wheel.

A local role whose rows no longer fit is simply emptied (`scripts/convex_reset <role>`), unless
its rows are worth keeping: then catch it up (below). A preview deployment is made fresh for a
branch and kept across its pushes; delete it in the dashboard and the next push makes another.

**The migration ledger.** Every backfill ever written, and every table cleared by hand rather
than migrated, oldest first, with the commit on `main` that needed it. Production's deploys run
each backfill themselves now (`20261005-deploy_migrations` on); `Run` is for catching up a backend
that missed one, and for the clearings, which are still a Coach's steps. Any commit from a backfill's
up to the tightening one still holds the backfill; a clearing has no code to hold, only the steps
below the table.

| Commit | What its backfill writes | Run |
| --- | --- | --- |
| `b648bc6` | `hunt_id` on questions and reviews; a smith (`CaretakerLabel`) on each hunt nobody is on | `migrations:runAll` |
| `ed009a7` | `smiths_note` on quizzes, empty | `migrations:run '{"fn": "migrations:backfillSmithsNotes"}'` |
| the rewidgeting merge (thread 3, `20261001-widget_tables`) | No backfill. Cleared by hand: `expressions`, `widgets` and `bottings`, which no schema since holds (`bulk_ishes_last` too, taken off by the next row). Re-created by seeding: the library and each laid-out quiz's default widgetings. Not re-created: the bots' replies, and any expression or widget a person wrote (*Clearing the widget tables*, below; `whiteboard/20261001-rewidgeting/losses.md`) | `seeding:seedWidgets` |
| `20261004-unset_bulk_ishes_last` (#77) | No backfill: takes `bulk_ishes_last` off each quiz, which no schema since the rewidgeting names | `migrations:run '{"fn": "migrations:retireBulkIshesLast"}'` |
| `20261004-dbpolicy_sessions` (#79, dbpolicy thread 1) | Cleared by hand first: `identings`, whose rows name a browser key the new schema has no place for. It is only history: every browser signs in afresh and asserts its username once more (*Sessions*, below). Then the backfill: `user_id: null` on each ident, claimed by nobody until a session asserts it | `migrations:run '{"fn": "migrations:backfillIdentClaims"}'` |
| `20261004-dbpolicy_one_label` (#82, dbpolicy thread 3) | No backfill of a new field: folds the retiring `forced_label` into `label` on hunts, quizzes and questions (the override, where one is set, becomes the label), and takes `forced_label` off every row. Run it straight after the deploy: until it has, a hunt or quiz relabelled before answers to the label it was made with. `migrations:runAll` runs it with every other backfill still defined | `migrations:runAll`, or one at a time: `migrations:run '{"fn": "migrations:retireHuntForcedLabels"}'`, then `retireQuizForcedLabels`, `retireQuestionForcedLabels` |
| `20261004-dbpolicy_denormalize` (#83, dbpolicy thread 4) | Copies of a parent's field (`notes/convex.md`, *Denormalized fields*): `hunt_id` on quizzes (from the realm), widgetings and columns (from the quiz); `hunt_id` and `quiz_id` on widgeteds (from the question); `hunt_id`, `quiz_id` and `ident_id` on reviewings (from the review); `ident_label` and `ident_title` on huntings (from the ident). Until a row has them its reads go through its parent and its first update fills them in, so nothing breaks in between; run it before threads 5 to 9 deploy, which read the copies alone. A row whose parent is gone is left without, and the tightening's push names it. Here `migrations:runAll` runs the two rows above it too, oldest first: once `identings` is cleared, one run brings rows from before thread 1 up to the tightening, `20261004-dbpolicy_tighten` | `migrations:runAll`, or one at a time: `migrations:run '{"fn": "migrations:backfillQuizCopies"}'`, then `backfillWidgetingCopies`, `backfillColumnCopies`, `backfillWidgetedCopies`, `backfillReviewingCopies`, `backfillHuntingCopies` |
| `20261004-export_tweaks` (#80) | `q1_preamble` on quizzes, the default (`Important: Read the smith's note before you play![br][br]`) | `migrations:run '{"fn": "migrations:backfillQ1Preambles"}'` |
| `20261005-hunt_branch` (#115) | `branch` on hunts, from the version most of each hunt's quizzes were on (`main` winning a tie it is part of, and for a hunt whose quizzes name none); then takes the retiring `version` off every quiz. The second refuses a quiz whose hunt has no branch yet, so the order is safe | `migrations:runAll`, or one at a time: `migrations:run '{"fn": "migrations:backfillHuntBranches"}'`, then `retireQuizVersions` |
| `20261005-orglabel` (#133, hunt_git thread 7) | `orglabel` on hunts: the ident label of each hunt's earliest member (its maker, unless they left), which its address has named since this commit. A hunt nobody is on is left without one, said in the log, and the tightening's push names it: give it a smith, or delete it, first. Until it has run, a hunt reads its org that same way, and its next edit stores it | `migrations:runAll`, or `migrations:run '{"fn": "migrations:backfillHuntOrglabels"}'` |
| `20261005-viz` (#140, hunt_git thread 8) | `viz: 'normal'` on each question, which the tightening then requires. Then stamps, for forensics, on every row of every table the stamping trigger covers (all of ours but `identings`): `created_at` and `updated_at` both the whole millisecond the database made the row (`_creationTime`), so a never-edited row reads as untouched; a row edited since the deploy keeps its `updated_at`. The stamps stay optional for good (the trigger writes them once a row has landed), so the tightening leaves them be; the backfill writes raw, past the trigger, and so is no edit. Until it has run, a row reads its viz and stamps that same way. Defined beside the orgs' backfill, so one `migrations:runAll` after merging brings production up to both tightenings (`orglabel`, `viz`) | `migrations:runAll`, or one at a time: `migrations:run '{"fn": "migrations:backfillQuestionViz"}'`, then the stamps, a backfill per table (`backfillIdentStamps`, `backfillHuntStamps`, … `backfillHuntingStamps`) |
| `20261006-tighten_orglabel_viz` (hunt_git, the tightening of #133 and #140) | No backfill: requires `orglabel` on hunts and `viz` on questions, and drops their backfills. Its push is refused by a hunt with no `orglabel`, or a question with no `viz`, for one of two reasons. The backend missed `20261005-viz`: catch it up there first. Or a hunt nobody is on, which the orgs' backfill skipped with a warning ("has nobody on it") and still reported `success`: give it a smith or delete it, then push again. The stamps' backfills stay defined (the stamps stay optional, so no tightening retires them), and `migrations:runAll` still runs them | nothing |
| `20261006-recap_widen` (#163, recap thread 1; `1ca9e16`) | On quizzes, an empty `recap_head` and `recap_tail` and an empty `templated`; on questions, an empty `recap`; on widgetings, `tier: 'question'` (every widgeting before it ran for each question). Each writes only what a row lacks, and holds only that to its validator, so an older row the validators would now refuse (a widgeting labelled `recap`) cannot stop the series. Until it has run, a row reads those same defaults, and its next edit stores them. Production's deploy did not start these (2026-10-07): a Coach ran `migrations:runAll` by hand, and they finished | `migrations:runAll`, or one at a time: `migrations:run '{"fn": "migrations:backfillQuizRecaps"}'`, then `backfillQuestionRecaps`, `backfillWidgetingTiers` |
| `20261007-recap_tighten` (recap thread 9, the tightening of #163) | No backfill: requires `recap_head`, `recap_tail` and `templated` on quizzes, `recap` on questions and `tier` on widgetings, and drops their backfills and the defaults rows were read with meanwhile. Its push is refused by a row lacking one only where the backend missed `20261006-recap_widen`: catch it up there first. A quiz's `recap_template` is not among them: it stays optional for good (`Absentable`) | nothing |

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
   Every ident made before is then claimed by nobody, and the first session to assert its username
   holds it from then on: that is how each person gets theirs back, and also how someone else could
   get there first.

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

Each role (`dev` for a person, `agent`, `e2e`, `e2e-agent`, `e2e-built`) has a Convex backend of
its own: Convex's open-source binary, run by `scripts/convex_backend <role>` on port `34xx` (HTTP
actions on `35xx`), with its database, file storage, instance secret and the CLI's `cli.env` in
`data/convex-<role>/`. Nothing of it leaves the machine, and it needs no Convex account.

`scripts/convex_dev <role> [--reset] [--watch] <command>` is how anything runs against one: it
starts the backend if it is not answering, pushes `convex/` to it (which regenerates
`convex/_generated/`), marks it clearable, gives it throwaway keys for Convex Auth when it has none
(`scripts/convex_auth_keys`), empties it with `--reset`, keeps pushing as `convex/`
changes with `--watch`, and runs the command with `NEXT_PUBLIC_CONVEX_URL` naming the backend.
`pnpm dev` and `pnpm dev:agent` go through it; so does the e2e suite, from `playwright.config.ts`.
A backend the script started stops with the command; one that was already running is left alone.

`scripts/convex_reset <role>` empties a role's backend, every row of every table, through
`testing:clearAll`, which a backend refuses unless `TRIQUET_CLEARABLE` is `yes` on it. Only the
local scripts set it, and only on `127.0.0.1`; production never has it. The e2e suite's way in
makes each test's hunt through `testing:makeHunt` (`e2e/admin.ts`), refused the same way. Both are
internal functions, so they deploy with the rest, but nothing without the deployment's admin key
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

