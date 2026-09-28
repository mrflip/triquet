# Convex, yay: progress

The handoff for `whiteboard/convex_yay-plan.md`. Newer than the plan wherever they disagree.

## 1. Status

* **Phase 0 (spike and decisions)**: built on `20260927-convex_spike`, not yet merged.
* **Phase 1 (the server side, beside Jazz)**: built on `20260927-convex_server`, stacked on the
  spike branch, not yet merged. Lint, typecheck and the unit and convex suites green (89 files,
  2274 tests). e2e not run: nothing the browser touches changed, bar the models (below). The app
  still runs on Jazz.
* **Phase 2 (the browser switch, and Jazz out) is next**, on a new branch.

## 2. Start here

1. Start the agents' backend with `pnpm convex:backend agent` (foreground; give it a terminal or
   the background), then push with `./node_modules/.bin/convex dev --once --typecheck disable
   --env-file data/convex-agent/cli.env`. `convex/_generated/` regenerates only against a running
   backend. Convex refuses a hyphen in a module path: `convex/**` is snake_case.
2. Read `convex/_generated/ai/guidelines.md`, then *Rules overrides* below.
3. The server's surface, for the hooks: `api.hunts.list`, `api.hunts.open({ hunt_label })` (the
   shallow hunt, `ShallowHuntT` in `src/lib/rows.ts`), `api.hunts.whole({ hunt_id })` (the export;
   named `whole` because `export` is a keyword), `api.quizzes.open({ quiz_id })`,
   `api.reviews.forQuiz({ quiz_id })` (each review with its `reviewer`), `api.idents.current({
   browser_key })`, and the mutations `api.hunts.perform({ open, action, browser_key })` and
   `api.idents.performAccount({ action, browser_key })`.
4. The views already say every action in a shape `hunts.perform` takes
   (`tests/models/actions.test.ts` holds `state/actions.ts`'s `HuntAction` to it at compile
   time). Phase 2 points the imports at `src/models/actions.ts` and deletes `state/actions.ts`.
5. *Deleted tests and their successors* below lists which Jazz tests phase 2 deletes, and what
   already replaces each.

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

Settled after phase 0 (Coach, 2026-09-27), and at the start of phase 1:

* **Isolation: a backend binary per role**, run by `scripts/convex_backend
  <dev|agent|e2e|e2e-agent>` (`pnpm convex:backend`), on ports 34xx and 35xx, with its data,
  instance secret and `cli.env` in `data/convex-<role>/`. The human's dev server uses it too.
  Written into `CLAUDE.md`'s *Global resources*. Agents are moving into containers of their own;
  a container still runs a dev server and an e2e suite side by side, so the script stays.
* **Caps**, in `src/lib/vv/patterns.ts` (*Collection sizes*): 999 questions and 999 reviews per
  quiz; 99 widgets and 99 columns per quiz; 99 realms and 99 expressions per hunt; 99 hunts in the
  app (plan, settled item 16). The tree validators apply those a tree holds. **99 quizzes per
  realm is mine, not yet agreed**: a realm's quizzes are read with a bound like every other
  child, and nothing had set one. Every write that would pass a cap is refused, silently, as
  other refusals are.
* **Convex's AI files** installed by the Coach: `convex/_generated/ai/guidelines.md`, a block in
  `CLAUDE.md` and `AGENTS.md`, and the `convex-*` skills. `CLAUDE.md` says this project's rules
  win where they differ.

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
* **Bounded reads, by our caps.** The guidelines say never `.collect()`, always `.take(n)`. A
  read of a parent's children takes the cap from `lib/vv/patterns.ts`
  (`.take(PA.QuestionsPerQuiz.max)`), and a write that would pass it is refused, so a read never
  silently drops a row. Two reads are not capped: a botting cell's history, walked newest first
  and stopped at the first answer (so it reads one row, plus one per failure since), and a
  question's bottings when it is deleted, iterated with `for await` as the guidelines ask.
* **Module names are snake_case** under `convex/` and `tests/convex/`: Convex refuses a hyphen
  in a module path, which `unicorn/filename-case` otherwise demands. An eslint block
  (`triquet/convex-module-names`) allows it there only.

## 4. Deviations from the plan

Newest first.

* **Refusals from inside a handler still say nothing.** The phase 0 proposal (a
  `ConvexError({ failurekind })` for a locked quiz or a taken label) is not built: the Jazz
  actions refused silently, the tests say so, and whether an author needs a notice for any of
  them is a phase 2 question, asked with the views in hand. What does reach the caller today:
  a refused argument, as `ConvexError` data `{ ZodError: [...] }`; a wrong-typed id or an unknown
  action, as Convex's plain `ArgumentValidationError`; a row validator refusing inside a handler
  (a widget patch wrong for its kind), as a plain error, which production shows only as "Server
  Error". The last wants a decision in phase 2.
* **`reviews.forQuiz` joins each review's reviewer; there is no `idents.all`.** The views used
  every ident only to title a review's author, and every ident is an unbounded read.
* **Indexes order children by position.** `by_hunt_id_and_position`, `by_quiz_id_and_position`
  in place of the plan's `by_hunt_id` and `by_quiz_id`, so a read comes back in committed order
  with no sort. Hunts also get `by_forced_label`, so a hunt is found by the label in force;
  reviews also get `by_quiz_id_and_ident_id`.
* **One index walk per botting cell, not two `.first()`s.** The plan's
  `by_question_id_and_bot_label_and_textkind_and_status` would spend two index ranges per cell,
  six per question: 5994 for a full quiz, past Convex's 4096 per function. The walk spends one
  per cell (2997 for a full quiz) on `by_question_id_and_bot_label_and_textkind`.
* **`BottingT` keeps `id` and `created_at`.** The Jazz projections still build it; phase 2
  renames it with them. `lib/rows.ts`'s `bottingFrom` maps a row onto it, with `created_at` the
  row's `_creationTime` floored: Convex's `_creationTime` carries a fraction, and the tree's
  timestamps are whole milliseconds (a fractional one fails `timestamp` when a tree comes back
  through `replace_open_quiz`). `latestBySlot` is left to the Jazz side; `slotLatestOf` builds a
  cell's latest from the two rows the walk found.
* **The models are Convex-shaped already, and the Jazz side bends to them.** The kit's `zid`
  takes a Convex id or a UUID, so Jazz's rows still pass; Jazz's identing insert leaves the
  browser key out (`state/account-actions.ts`, one line); `tests/db/coherence.test.ts` reads a
  `zid` as a Jazz row id and widens ids in its type check. `rowid` is gone from the kit.
* **The action vocabulary lives twice until phase 2**: `src/models/actions.ts` (the Zod union the
  server parses) and `src/state/actions.ts` (the TypeScript union Jazz and the views use), held
  together by a compile-time check. `HuntActionDNA` is what a view sends.
* **`testing.clearAll` reads `TRIQUET_CLEARABLE`**, declared in `convex/convex.config.ts`;
  `scripts/convex_backend` does not set it yet (phase 2, with `scripts/convex_reset`).
* **The tree's `_id` rename stops at the tree** (phase 0). `QuizT`, `QuestionT`, `RealmT`, `HuntT` and
  `IdentT` carry `_id`. Jazz rows still carry `id`, so `quizFrom`, `huntFrom` and `useIdent`
  translate at that one seam until phase 2 removes Jazz. The import file format keeps its `id`
  key (old exports carry it); `importing.ts` maps it as before. `treeid` takes a Convex id since
  phase 1; `BottingT` waits for phase 2 (above).
* **No CI drift check for `_generated/`.** `convex codegen` needs a running deployment (see
  *Discoveries*), so the check needs a backend in CI, which is the isolation question's answer.
  Build it with that, in phase 2 or 3.
* **`npx convex ai-files install` was run by the Coach**, not the phase 0 agent, whose auto-mode
  classifier refused it as self-modification.
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

### Phase 1

* **Convex refuses a hyphen in a module path** (`writing/layout-actions.js is not a valid path`),
  at push time only: convex-test loads such a module happily.
* **The bridge's types cannot follow a recursive Zod type.** `defineTable` over the botting row
  fails with "Type instantiation is excessively deep" at `response` (`zod.json()`), though the
  run-time conversion is fine. That one field is written by hand (`CVX.any()`, typed as the Zod
  output), and `tests/convex/schema.test.ts` holds it. The same wall stands in front of
  `zodToConvex(ActionValidators.huntAction)` in a test's types; `zCustomMutation` itself is fine.
* **`zid` survives `.describe()` and `.refine()`** in the bridge: the kit's `zid` refines Convex's
  to a row id's shape and is still an id of its table to Convex.
* **A Zod object in the args is strict at Convex's door.** Convex validates the args with the
  validator derived from the Zod before Zod runs, and a Convex object refuses a field it does not
  name, where Zod would strip it. A view must send exactly the action's fields.
* **convex-test's `_creationTime` is fractional** (`Date.now()`, plus 0.001 for each insert in
  the same millisecond), so two inserts never tie and tests need no pauses. Its ids are digits
  and the table's name (`0000000000000000000010002quizzes`); the local backend's are 32 lowercase
  base32 characters. `patterns.ts`'s `Convexid` takes both.
* **`tt.run` must hand back a Convex value**: a `Map` inside the result is refused.
* **`env` in `_generated/server` is `process.env`**, so `vi.stubEnv` sets it under convex-test.
* **`api` is a proxy at run time**: listing the public functions means loading the modules and
  keeping the exports with `isPublic` (`tests/convex/authorize.test.ts`).
* **The limits that bite are per function**: 4096 index ranges, 32,000 documents read, 16,000
  written. The caps multiply past them only at the extremes (99 realms of 99 quizzes, each read
  for its widgets by `hunts.open`), which the trial will not reach; worth knowing for phase 4.

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
  binary cache. `scripts/convex_backend` is what came of it: it downloads the pinned binary when
  missing, mints a random instance secret once per role and keeps it in the role's data
  directory, derives the admin key from it (`convex-local-backend keygen admin-key`), writes
  `data/convex-<role>/cli.env` (`CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY`), and
  runs the backend bound to 127.0.0.1. The admin key grants admin over that one backend only.
  CI can run the same script on Linux (it needs curl, unzip and openssl), or the backend's
  Docker image. An admin key holds a `|`, so read `cli.env` with `--env-file`, never by sourcing
  it in a shell.

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

* **Doppler, in phase 2** (agents cannot edit Doppler): `NEXT_PUBLIC_CONVEX_URL` for `dev`
  (`http://127.0.0.1:3400`), `dev_claude` (`:3401`) and `dev_e2e` (`:3402`); the e2e-agent run
  overrides it on the command line as it does its ports today. Nothing else: the script knows
  each role's ports and mints its own keys. Retiring with Jazz: `JAZZ_DEV_PORT`,
  `JAZZ_DEV_DATA_DIR`, `JAZZ_REAL_DB`, `JAZZ_ADMIN_SECRET`, `JAZZ_ADMIN_SNIPPET`,
  `NEXT_PUBLIC_JAZZ_SERVER_URL`, `NEXT_PUBLIC_JAZZ_APP_ID`, `NEXT_PUBLIC_JAZZ_RUNTIME_VERSION`,
  `NEXT_PUBLIC_JAZZ_LOG_LEVEL`.
* **Containers need no Convex key each.** A local backend needs no account; each role's admin
  key is minted from a secret made in its own data directory. Only phase 3's cloud deployments
  have keys (production for the Coach, preview for Vercel), and agents never hold the
  production one.
* **Quizzes per realm, 99?** Proposed in phase 1, not yet agreed (*Decisions taken*).
* **Should a refusal say so?** A locked quiz, a taken label, a cap reached: each writes nothing
  and tells the author nothing, as under Jazz. Phase 2 can answer with a notice through
  `ConvexError`; say if you want that, and for which.
* **Before phase 3** (unchanged from the plan): a Convex team and project, the production and
  preview deploy keys, and Vercel's build command.

## 8. Deleted tests and their successors

Phase 0 added `tests/convex/spike-bridge.test.ts` and `tests/convex/spike.test.ts`; phase 1
deleted both with the spike, and `tests/convex/schema.test.ts` (the canary) and
`tests/convex/hunts.test.ts` (the refusal in our words) cover what they held.

The Jazz tests stay until phase 2 deletes their modules. Their successors, already green:

| Jazz test (phase 2 deletes) | Successor |
| --- | --- |
| `tests/state/perform.test.ts` | `tests/convex/hunts.test.ts` (`hunts.perform`), case for case |
| `tests/state/layout-actions.test.ts` | `tests/convex/writing/layout_actions.test.ts` |
| `tests/state/quiz-writing.test.ts` | `tests/convex/writing/quiz_writing.test.ts`; `transact`'s cases become "a mutation keeps nothing when it throws" |
| `tests/state/quiz-rows.test.ts` | `tests/convex/reading.test.ts`, `quizzes.test.ts`, `hunts.test.ts` (`list`, `open`, `whole`), `tests/lib/rows.test.ts`; `idsKey`, `askedAt` and the "not arrived yet" cases pinned Jazz and have none |
| `tests/state/account-actions.test.ts` | `tests/convex/idents.test.ts` |
| `tests/state/lookup.test.ts` | `tests/convex/idents.test.ts` ("finds an ident this browser never made"): a query has already asked the server |
| `tests/db/permissions.test.ts` | `tests/convex/authorize.test.ts` |
| `tests/db/coherence.test.ts` | `tests/convex/schema.test.ts` |
| `tests/db/schema.test.ts` | none: its canaries pinned alpha.56's bugs |
| `tests/db/json-text.test.ts`, `sync-settings`, `runtime-assets`, `publish-runtime-assets` | none: their modules go |
