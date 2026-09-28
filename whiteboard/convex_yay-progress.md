# Convex, yay: progress

The handoff for `whiteboard/convex_yay-plan.md`. Newer than the plan wherever they disagree.

## 1. Status

* **Phase 0 (spike and decisions)**: built on `20260927-convex_spike`, not yet merged. Lint,
  typecheck and unit tests green (79 files, 1999 tests). e2e after the `_id` rename: 151 of
  152 at three workers, the one failure passing three times of three alone (see
  *Measurements*). The app still runs on Jazz, untouched apart from the rename.
* Phases 1 to 4: not started. **Phase 1 waits on the Coach's answer to the isolation question**
  (*For the Coach*, first item), since the plan says to raise it before building it into scripts.

## 2. Start here

1. Read *For the Coach* below: if the isolation answer and the port scheme have been agreed,
   they may have been written into `CLAUDE.md` already; if not, ask before scripting either.
2. Start the agents' backend by hand as *Discoveries: isolation* shows (until a script does it),
   and push with `./node_modules/.bin/convex dev --once --typecheck disable --env-file
   data/convex-agent.env`. `convex/_generated/` regenerates only against a running backend.
3. `convex/schema.ts` and `convex/spike.ts` are the phase 0 spike: replace them whole in phase 1.
   `tests/convex/spike-bridge.test.ts` is the seed of the schema canary
   (`tests/convex/schema.test.ts` in the plan); `tests/convex/spike.test.ts` pins the error path.
4. Read *Rules overrides* before writing a Convex function: Convex's guidelines (fetched from
   `https://version.convex.dev/v1/guidelines`) say `v`, `returns` everywhere, tests inside
   `convex/`, and a bounded `.take()` on every read; this project differs on each.

## 3. Decisions taken

The plan's fifteen settled items (2026-09-27), and where each now lives:

* `CVX`, not `v`, enforced: `STYLE.md` (imports) and `eslint.config.mjs`
  (`triquet/convex-values-as-cvx`). The selector refuses any local name for `v` from
  `convex/values` other than `CVX`, which is a little stricter than the plan's (bare `v` only).
* `_id` everywhere, our own fields never starting with `_`: `STYLE.md` (naming). Done for the
  tree types in this phase; see *Deviations*.
* `convex/_generated/` committed, `-diff` in `.gitattributes`, eslint ignoring it: done. The CI
  drift check is not (see *Deviations*).
* No validation of rows read back; nullable, never optional; structured values are ordinary
  fields; `convex-helpers` in; reads follow Convex's and React's grain; the ask route stays;
  goodbye offline; identity is a browser key for the trial; the views receive a shallow hunt;
  `convex/` at the root; this plan ends with the app as it is today: `notes/stack.md` (the
  Convex entry under *Use*), in brief. Phase 4 moves them to `notes/decisions/2026-09-convex.md`.

### Rules overrides

Where this project departs from Convex's own guidelines (targeting `^1.44.0`, fetched
2026-09-27), and why:

* **`import { v as CVX }`**, never `v`. Settled item 1.
* **No `returns` on a query that hands back documents**; mutations say `CVX.null()` or an id.
  Settled item 4.
* **Tests live in `tests/convex/`**, not beside the functions in `convex/`: `notes/testing.md`
  keeps the test tree apart from the source. `import.meta.glob('../../convex/**/*.*s')` gives
  convex-test its modules from there; it finds the root by the `_generated` path.
* **A user identifier as an argument** (`browser_key`), for the trial only. Settled item 13.
* **Unbounded reads: open.** The guidelines say never `.collect()`, always `.take(n)` or
  paginate. A quiz's questions, widgets and columns are bounded only by the author. Phase 1
  should pick a named maximum per child table (and refuse past it in the writing actions) or
  record `.collect()` on an index scoped to one parent as an override. Raise with the Coach.

## 4. Deviations from the plan

Newest first.

* **The tree's `_id` rename stops at the tree.** `QuizT`, `QuestionT`, `RealmT`, `HuntT` and
  `IdentT` carry `_id`. Jazz rows still carry `id`, so `quizFrom`, `huntFrom` and `useIdent`
  translate at that one seam until phase 2 removes Jazz. The import file format keeps its `id`
  key (old exports carry it); `importing.ts` maps it as before. `treeid` is not widened yet: no
  Convex id reaches a tree until phase 1. `BottingT` (a row type with `id` and `created_at`) is
  left for phase 1, where `_creationTime` replaces `created_at`.
* **No CI drift check for `_generated/`.** `convex codegen` needs a running deployment (see
  *Discoveries*), so the check needs a backend in CI, which is the isolation question's answer.
  Build it with that, in phase 2 or 3.
* **`npx convex ai-files install` was not run.** The auto-mode classifier refused it as
  self-modification: it writes `CLAUDE.md`, `AGENTS.md` and agent skills. The guidelines it
  would have installed were read from the endpoint it fetches them from instead. The Coach may
  run it, or decide the repo does without (see *For the Coach*).
* **`zodOutputToConvexFields`, not `zodToConvexFields`**, derives a table. The input-side
  mapping turns a `.default()` into an optional field (`reviews.overall` and `reviews.phase`
  today); the output side keeps every field required, which is what a stored row is.
* **`@edge-runtime/vm` 5.0.0 installed**, unnamed in the plan: the `edge-runtime` environment
  the plan names needs it, and Convex's guidelines list it beside convex-test.
* **`tsconfig.json` lost its `#inspect-env` path.** esbuild honours tsconfig `paths` ahead of
  `package.json`'s conditional `imports`, so Convex's bundler was handed `inspectify-node.ts`
  (`node:util`) for its V8 runtime and refused the push. `package.json`'s `imports` map already
  says which half each environment gets, and `tsc` resolves it without the path. Worth a glance
  at the next Next build that `node:util` stays out of the client bundle (it should: the path
  forced the node half everywhere, and the map gives the browser `default`).
* **The error map goes in per call**, through the custom builder's `input` (which runs before
  the args are parsed), not as a module-level `installErrorMap()`: eslint's
  `unicorn/no-top-level-side-effects` refuses the latter, and the per-call form cannot be
  bypassed by a module that forgets the import. `Z.config` is idempotent and cheap.
* **`import.meta.glob` is typed by `tests/support/import-meta-glob.d.ts`**, not
  `/// <reference types="vite/client" />`: vite arrives only through vitest, so its types do not
  resolve, and adding vite as a direct dependency was not worth it for one signature.
* **Convex's backends use 34xx and 35xx**, not 32xx: Jazz's dev servers hold 32xx until phase 2.

## 5. Discoveries

All with `convex` 1.46.0, `convex-helpers` 0.1.124, `convex-test` 0.0.60, local backend
`precompiled-2026-09-21-0cf49cb`.

### Isolation (phase 0 question 1)

* **Candidate (a) does not isolate.** A local or anonymous deployment keeps its state in
  `<checkout>/.convex/local/default/`, one per checkout ("one deployment per
  project/worktree/clone", in the CLI's own words). An `--env-file` naming a second anonymous
  deployment (`CONVEX_DEPLOYMENT=anonymous:anonymous-e2e`) silently reused the first one's state
  and port. The first `npx convex dev` also writes `.env.local`, appends it to `.gitignore`, and
  (in a terminal) offers to install the AI files.
* **Candidate (b) does.** The CLI's own backend binary, one per role, each with its ports and
  data directory, addressed by the CLI's self-hosted variables. Verified with two at once: a row
  written to one never appears in the other. No account, nothing in the home directory but the
  binary cache. The spike's commands, per role (`agent` is `xx=01`, `e2e` is `02`):

  ```sh
  BIN=~/.cache/convex/binaries/precompiled-2026-09-21-0cf49cb/convex-local-backend
  SECRET=<a fixed 64-hex dev instance secret; the CLI's own legacy one serves>
  KEY=$("$BIN" keygen admin-key --instance-name triquet-$role --instance-secret $SECRET)
  "$BIN" --port 34$xx --site-proxy-port 35$xx --interface 127.0.0.1 \
    --instance-name triquet-$role --instance-secret $SECRET --disable-beacon \
    --local-storage data/convex-$role/storage data/convex-$role/backend.sqlite3
  # data/convex-$role.env holds CONVEX_SELF_HOSTED_URL=http://127.0.0.1:34$xx and
  # CONVEX_SELF_HOSTED_ADMIN_KEY=$KEY; every CLI command takes --env-file data/convex-$role.env
  ```

  The admin key is derived from the instance name and secret, so a script can mint it at start
  and nothing needs to be stored. It grants admin over one backend bound to localhost. The
  binary comes from `get-convex/convex-backend`'s GitHub releases (the CLI downloads it on first
  use); CI can fetch the Linux asset for the same version, or run the backend's Docker image.
  Stop a backend with `SIGTERM`. An admin key holds a `|`, so read the env file with
  `--env-file`, never by sourcing it in a shell.

### The bridge (question 2)

* **Every row validator in `src/models/` converts, and no field is refused.**
  `tests/convex/spike-bridge.test.ts` holds it: through `zodOutputToConvexFields`, every field
  of every row is present and required.
* What survives: object shape, nullability (`CVX.union(x, CVX.null())`), enums (unions of
  literals), nested objects, arrays of objects, the `response` JSON value (a union of
  primitives, arrays and records, going to `any` below two levels). What is lost, and stays the
  row validator's: regexes, lengths, `.max()` on arrays, integer-ness (`CVX.number()`), and the
  template literal (`last_sortkey` becomes `'chain_order' | string`).
* `rowid` becomes a plain `string`; `zid('<table>')` becomes `CVX.id('<table>')`. Phase 1
  replaces each `<parent>_id: rowid` with `zid`, as the plan says.
* `Validator` callables pass everywhere a Zod schema does: each keeps its schema as its
  prototype, so `instanceof` and `_zod` resolve.

### Zod inside Convex (question 3)

* **The patched Zod and our error map both run in Convex's bundle and under convex-test.** A
  refused argument reaches the caller as `ConvexError` data, `{ ZodError: [issue, ...] }`, each
  issue carrying our message (`should match pattern`) and the refused `input` (the patch).
* **How a refusal reaches the browser**, proposed for phase 1: argument refusals keep
  convex-helpers' `{ ZodError }` shape; a refusal from inside a handler (a locked quiz, a taken
  label) throws `ConvexError({ failurekind, ... })`; the browser turns either into a notice
  through `lib/notices.ts`. Anything not a `ConvexError` arrives in production as a bare
  "Server Error". Note for `notes/guidelines.md`'s warning about user text in a `ZodError`: the
  issues go back to the browser that sent them, and also into the deployment's function logs.
* **Two limits of `zCustomMutation`'s args.** They must be an object shape (the action union
  goes in a field, as the plan's `{ open, action, browser_key }` has it), and they are rebuilt
  with `z.object(shape)`, so an object-level `.check()` on the args is dropped. Convex's own
  validator (derived from the Zod) runs first and refuses a wrong-typed id with a plain
  `ArgumentValidationError`, which is a caller's bug, not an author's.
* **Convex's bundler honours tsconfig `paths`** (see *Deviations*).

### Vitest (question 4)

* **Two projects**, `convex` (`tests/convex/**`, `edge-runtime`, `convex-test` inlined) and
  `unit` (the rest, `node`), in `vitest.config.ts`. `tests/support/setup.ts` runs in both. The
  test output tags each line `|convex|` or `|unit|`.

### Lint and typecheck (question 6)

* **The root `tsconfig.json` already covers `convex/**`**, with our strict settings; `pnpm
  typecheck` is the authority. There is no `convex/tsconfig.json`, and without one the CLI skips
  its own typecheck (`--typecheck enable` then fails the push), so the dev loop runs `convex dev
  --typecheck disable`.
* **eslint's type-aware rules reach `convex/**`.** Four rules bite Convex's idiom, none needing
  a change yet: `unicorn/no-non-function-verb-prefix` refuses an exported function constant
  named `get…`, `set…`, `add…`, `create…`, `delete…`, `remove…`, `unset…` or `destroy…` (the
  plan's names avoid all eight); `unicorn/no-top-level-side-effects` (see the error map, above);
  `unicorn/max-nested-calls` on `defineTable(zodOutputToConvexFields({...})).index(...)` (hoist
  the fields to a const, as Jazz's schema already had to); and `@typescript-eslint/require-await`
  on a handler with nothing to await (drop the `async`).

### Generated code (question 7)

* **Five files, 395 lines, 24 KB** for the spike (`api.d.ts` 49, `api.js` 23, `dataModel.d.ts`
  60, `server.d.ts` 162, `server.js` 101).
* **`convex codegen` needs a running deployment.** With none named it refuses ("No
  CONVEX_DEPLOYMENT set"); with an unreachable one it writes an untyped stub (`AnyApi`) and exits
  1, so a CI check that ignored the exit code would commit the stub.

### Convex's API, as it now reads

* `ctx.db.get`, `patch`, `replace` and `delete` take the table name first:
  `ctx.db.patch('questions', id, fields)`. The plan's `ctx.db.patch(id, changed)` is the older
  spelling.
* `v.object(...)` has `.pick`, `.omit`, `.partial` and `.extend`; `schema.doc('table')` gives a
  whole document's validator.
* Typed app environment variables are declared in `convex/convex.config.ts`
  (`defineApp({ env: { ... } })`) and read from `env` in `./_generated/server`: the natural home
  for `testing.clearAll`'s guard variable.
* `await client.mutation(...)` resolves only once the client's subscribed queries reflect it
  (see *Measurements*): a mutation's promise is also "the screen is up to date".

## 6. Measurements

Phase 0, on a local backend (`127.0.0.1:3401`), from Chromium driven by Playwright, through
Convex's browser client (`ConvexClient`, which `useMutation` wraps; no React). 50 mutations,
each inserting a question into a quiz whose question list the page subscribes to; three runs.

| | median | p90 |
| --- | --- | --- |
| Mutation round trip | 29 to 35 ms | 41 to 68 ms |
| Query redelivery after it | the same | the same |

The two are equal because the mutation's promise resolves only once the subscription has the
result. A cloud deployment adds the network's round trip to each. Under convex-test, a
mutation costs about 0.06 ms in-process.

**e2e after the `_id` rename**, on a machine at a load average near 20 (16 cores), with a
fresh e2e Jazz database: at the default workers, between 7 and 17 specs failed, a different set
each run, all waiting on Jazz (sessions failing to fetch, rows arriving after 7 s), and each one
passing when its file ran alone. At three workers, 151 of 152 passed; the one failure (a second
visitor's edits reaching the author, `routing.spec.ts:256`) passed three times of three alone.
Worth a run on a quiet machine before merging.

## 7. For the Coach

* **The isolation answer, before anything is scripted.** Candidate (b), a backend binary per
  role, is the one that works. Proposed:
  - One script, `scripts/convex_backend <role>`, that downloads the pinned binary if absent,
    mints the admin key, writes `data/convex-<role>.env`, and runs the backend in the
    foreground; `dev:agent`, `test:e2e`, `test:e2e:agent` and the human's `dev` start it
    beside Next (phase 2).
  - Ports 34xx (backend) and 35xx (HTTP actions), with `xx` matching the web port: human
    3400/3500, agent 3401/3501, e2e 3402/3502, e2e-agent 3403/3503. Data in
    `data/convex-<role>/`.
  - The human's own dev server uses the same script, rather than `npx convex dev`'s default
    (port 3210, `.convex/local/default/`, a `.env.local`), so every role works the same way. Say
    if you would rather keep the default for yourself.
* **Doppler, once that is agreed** (agents cannot edit Doppler). For `dev` (yours), `dev_claude`
  and `dev_e2e`: `CONVEX_PORT` (34xx), `CONVEX_SITE_PORT` (35xx), `CONVEX_DATA_DIR`
  (`data/convex-<role>`), and `NEXT_PUBLIC_CONVEX_URL` (`http://127.0.0.1:34xx`). No admin key:
  the script derives it. In phase 2 these retire: `JAZZ_DEV_PORT`, `JAZZ_DEV_DATA_DIR`,
  `JAZZ_REAL_DB`, `JAZZ_ADMIN_SECRET`, `JAZZ_ADMIN_SNIPPET`, `NEXT_PUBLIC_JAZZ_SERVER_URL`,
  `NEXT_PUBLIC_JAZZ_APP_ID`, `NEXT_PUBLIC_JAZZ_RUNTIME_VERSION`, `NEXT_PUBLIC_JAZZ_LOG_LEVEL`.
* **Convex's AI files**: `npx convex ai-files install` adds a Convex section to `CLAUDE.md` and
  `AGENTS.md`, agent skills, and `convex/_generated/ai/guidelines.md`. The agent was refused it.
  Run it if you want it, or `npx convex ai-files disable` to silence the CLI's reminder.
* **Unbounded reads** (*Rules overrides*): a named maximum per child table, or `.collect()` on a
  parent-scoped index as a recorded override.
* **Before phase 3** (unchanged from the plan): a Convex team and project, the production and
  preview deploy keys, and Vercel's build command.

## 8. Deleted tests and their successors

None yet. Phase 0 added `tests/convex/spike-bridge.test.ts` and `tests/convex/spike.test.ts`.
