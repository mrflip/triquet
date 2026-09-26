# Jazz migration

Move storage from libSQL + Drizzle to Jazz v2, rows-first, client-only, with the graceful path
from local-only to identified designed in and the identified half deferred. Decisions this plan
carries are in `notes/decisions/2026-09-jazz.md` and `2026-09-client-first.md`; read those
first, then this.

## Ground rules for every session on this thread

* Invoke the `jazz` skill at the start. Work from the installed `jazz-tools` source (`dist/*.d.ts`),
  never from recall; the docs hide the column list behind an include and are behind the source.
* `jazz-tools` is pinned to `2.0.0-alpha.56` (checked 2026-09-25; verify before installing).
* Same conceptual models, same test intent. Every test we have today has a successor of equal
  or greater coverage; a test deleted without a successor is reported in `HUMAN-whatsup.md`.
* No new migration paths. The Coach has their quizzes as JSON; the import tool brings them back.
  **The import/export format must correspond to the schema.** We will manually migrate old exports as needed.
* Ids are internal details of the database. Preferable that business logic work with labels
  (possibly scoped: `quizlabel-questionlabel`). Never assert on an id in a test of business logic;
  be mindful which is more salient if closer to the DB.
* `underscore_case` fields, as `STYLE.md` says. Jazz reserves only `$…` and `id`.
* `import { schema as JZS } from 'jazz-tools'`, never `s`: `JZS.table(...)`, `JZS.string()`,
  and the types `JZS.RowOf<typeof app.quizzes>` (a type, not a call).
* Validate between the UI and the app with the same Zod schemas the columns use.
* Agents use `pnpm dev:agent` (Doppler `dev_claude`: app on 3001, Jazz on 3201, `data/jazz-agent/`)
  and run e2e only as `pnpm test:e2e` (`dev_e2e`: 3002, 3202, `data/jazz-e2e/`). Never the
  human's 3000, 3200 or `data/jazz/`. Dev Jazz is local unless `JAZZ_REAL_DB=true`.
* Housekeeping against the agents' real Jazz app, `scripts/jazz_deploy` and
  `scripts/jazz_healthcheck`, runs under `doppler run --config dev_aijanitor --`; never under
  `dev_janitor`, which is the human's. Only the janitor configs hold the admin secret.
* Run the CLI as `pnpm exec jazz-tools … --schema-dir src/db`. `pnpm dlx` builds a throwaway
  install that pnpm refuses for its unapproved build scripts, and without `--schema-dir` Jazz
  looks for `schema.ts` at the root.

## Out of scope (recorded TODOs)

1. Auth: the hub, `linkJWT`, the collision policy, the ask proxy checking the JWT.
2. Google-Docs-ish text fields (character-level merge).
3. A review of validation boundaries once rows settle.
4. Turning the transitional notes ("outgoing", "mid-move") into what we learned.
5. Strengthening the Zod/Jazz sync checks beyond the phase 1 coherence test: compare
   `Z.toJSONSchema` output against Jazz's compiled schema for whole tables (`pnpm exec jazz-tools
   schema export` prints it as JSON; it may be reachable in-process too), lean on the
   type-level equality as the backstop for every table, and decide which side a new column is
   added to first so the failure message says which is behind.

## Phases

Each phase ends green: `pnpm lint && pnpm typecheck && pnpm test`, and e2e where the phase
touches the UI. Each phase is a PR-sized unit; a `/code-review` pass at the end of each.

### Phase 0: install, wire, spike (small; one session)

* Install `jazz-tools@2.0.0-alpha.56` (exact). `withJazz()` in `next.config.ts`, with the dev
  server's `port` and `dataDir` read from env so the agent scripts can point at their own:
  `dev:agent` gets a Jazz port beside 3200 and `data/jazz-agent/`; `.gitignore` already covers
  `/data/*`. Keep `distDir` and `turbopack.root` as they are.
* `JazzProvider` in `src/app/providers.tsx`, local-first session as the initial state.
* **Spikes, each a throwaway test, answers recorded in `HUMAN-whatsup.md`:**
  - Does the runtime reject a JSON write that violates the column's Zod-derived schema, or is
    the schema typing only?
  - Does a `Validator`-kit callable pass as `StandardJSONSchemaV1`, or must `plain()` unwrap it?
  - One table round-trip under Vitest with the memory driver, and one under
    `createPolicyTestApp`: which harness does the unit suite use by default?
  - The Playwright `webServer`: does `dev:agent` bring the Jazz dev server up by itself, and
    is a fresh browser context enough to reset state between specs?
* Exit: the app still runs on libSQL; Jazz is installed, provides, and the four answers are in.

**Phase 0 answers (2026-09-25, alpha.56).** Detail in `HUMAN-whatsup.md`.

* **JSON columns are enforced.** `db.insert` throws synchronously, before any sync, on a value
  its column's JSON schema refuses: `WriteError("encoding error: JSON schema validation failed
  for column `reply`: 42 is not a string")`. First issue only; not a message for an author.
* **Callables pass, but use `plain()`.** A `Validator` callable presents `~standard.jsonSchema`
  and compiles, but loses its own top-level `.describe()` (Zod keys metadata on identity), so
  its column schema differs from `Z.toJSONSchema(plain(...))`. Write `JZS.json(plain(X.y))`.
* **Default harness: `createPolicyTestApp`.** Opens in about 35 ms, and a round trip with an
  edge wait takes about 25 ms. Permissions are enforced and one account's rows are hidden from
  another. Sessions are `{ user_id, issuer, claims, authMode: 'local-first' }`; the type is
  `Parameters<PolicyTestApp['as']>[0]` (Jazz does not export `Session`). The memory driver
  works too, but needs a hand-made `AccountStore` and an unused `serverUrl`
  (`createAccountManager` → `createLocalFirst()` → `createDb({ account, driver: { type: 'memory' } })`),
  and it evaluates no permissions.
* **Playwright: the dev server brings Jazz up itself.** (Since then e2e has its own config and
  server: `pnpm test:e2e`, Jazz on 3202, `data/jazz-e2e/`.) A fresh browser context starts
  empty *only because rows are per-account*: rows do reach the server, and a policy that lets
  anyone read shows a fresh context everyone's rows. Keep every table creator-owned, or wipe
  `data/jazz-e2e/` before a run. Offline works: with the sync server blocked, a first visit
  still makes its account and writes locally.
* **Seams for phase 1.** `src/db/schema.ts` holds one placeholder table (`spike_notes`) because
  an empty schema will not deploy (the permissions publish 404s). When it goes, wipe
  `data/jazz-agent/`, since the server keeps schema history. The Drizzle schema is now
  `src/db/drizzle-schema.ts`, because Jazz loads whatever `schema.ts` is in `schemaDir`.
  `unicorn/max-nested-calls` (3) trips on `defineApp(defineSchema({ t: table({ c: string() }) }))`:
  declare the schema and the app separately, and expect to lift payload-enum tables into their
  own consts. `JZS.table()` requires its relations argument, even `{}`. The compiled columns
  are readable in-process as `app.wasmSchema[table].columns` (`name`, `column_type`), which is
  what the coherence test needs.
* **The placeholder is deployed to the agents' real app** (`dev_aijanitor`). Replacing it there
  demands a migration (confirmed in phase 1, below); pointing `dev_aijanitor` at a fresh Jazz
  app is the simpler way out, since nothing in it matters. `data/jazz-agent/` and
  `data/jazz-e2e/` were wiped in phase 1; `data/jazz/` is the human's to wipe.
* **How `withJazz` behaves (alpha.56).** In dev it publishes `schema.ts` and `permissions.ts` on
  start and on every save. It connects to the server the environment names whenever
  `NEXT_PUBLIC_JAZZ_SERVER_URL` *and* an admin secret are both present, and otherwise starts a
  local one and overwrites the URL the browser gets. So `next.config.ts` removes the cloud
  variables for the dev server unless `JAZZ_REAL_DB=true`, and then passes `server: false`. It
  records its app id in a `.env` inside `envDir`, an option its types omit; we point it at the
  Jazz data directory. `JazzProvider` renders its `loading` view until the session is ready,
  server render included, so the prerendered page is our progress bar.

### Phase 1: schema and permissions (design-heavy; one focused session, one model)

`src/db/schema.ts` and `src/db/permissions.ts`, from `src/db/schema.ts` (Drizzle) and the
models. Tables, with the mapping:

| Today                  | Jazz                                                                                                                                                                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workspaces` (id, active_quiz_id, created_at) | `workspaces`: `active_quiz: JZS.rel('quizzes', ...)` optional; provenance is magic. One per account.                                                                                                                                                                                       |
| `expressions` (workspace_id, owner, label, formula, description, position) | `expressions`: `workspace: JZS.rel(...)`, `owner: JZS.enum(...)`, rest as strings and ints.                                                                                                                                                                                                  |
| `quizzes`              | `quizzes`: `workspace: JZS.rel(...)`, `last_sortkey` via `.transform()` or a string with an entrypoint check, `bulk_ishes_last: JZS.json(plain(QuizValidators.bulkIshesRun)).optional()`.                                                                                                    |
| `widgets` (kind + nullable per-kind columns)  | `widgets`: `kind: JZS.enum({ expression: { expression_label }, player: { player_label, textkind } })`, `quiz: JZS.rel(...)`, `label`, `description`, `position`.                                                                                                                             |
| `columns`              | `columns`: `quiz: JZS.rel(...)`, `label`, `title`, `source`, `width_px`, `position`.                                                                                                                                                                                                       |
| `questions`            | `questions`: `quiz: JZS.rel(...)`, `position`, `label`, `forced_label` optional, texts as `JZS.string()`; `chains_to` becomes a **label**, not an id (vocabulary says chains are shown by label already).                                                                                    |
| `players`              | **No table.** `SeedPlayers` is the constant; `PlayerValidators.player` stays Zod.                                                                                                                                                                                                        |
| `playings`             | `playings`: `question: JZS.rel(...)`, `player_label: JZS.enum(PlayerLabelVals)`, `textkind: JZS.enum(...)`, `status: JZS.enum('done', 'error')`, `items: JZS.json(plain(arr(IshValidators.ishItemReply))).optional()`, `response: JZS.json(...)`, ints and booleans; newest = order by `$createdAt`. |

* `JZS.reverse()` for every parent → children walk the views need (`quiz.questions`, etc.).
* `permissions.ts`: for the trial, every table `managedByCreator()` (or `owner` = session
  account where a row is created on the author's behalf). Shares come with TODO 1; leave a
  comment-free seam, not a stub.
* **Each table is declared twice, on purpose**: the Jazz table in `db/schema.ts`, and a Zod
  *row* validator in the model file (`QuizValidators.row`, `QuestionValidators.row`, ...) that
  carries every constraint the column cannot (`label`'s regex, `titleish.max(82)`, `uint`),
  minus `id` and minus nested arrays. The write layer parses through the row validator before
  every insert or update. Today's nested `obj({...})` validators become document validators
  composed from the row validators (`quizDoc = obj({ ...row.shape, questions: arr(questionRow) })`)
  for import and export; no third copy. Value validators (`bulkIshesRun`, `ishItemReply`,
  `sortkey`) stay and are what the `JZS.json()` columns take. `fill`/`blank`/`exposed` stay.
* Tests: `tests/db/schema.test.ts` (round-trips per table, enum cases),
  `tests/db/permissions.test.ts` (own rows readable/writable; another account's not),
  successors for `tests/models/*` that asserted row shapes, and **`tests/db/coherence.test.ts`**,
  generic over a registry of `{ table: rowValidator }`: same column names (ignoring `id`, `$…`),
  same nullability, same base type via `Z.toJSONSchema`, `JZS.json()` schemas deep-equal to
  `Z.toJSONSchema(field, { target: 'draft-7' })`, `references` columns are id fields, and
  `expectTypeOf<Z.output<row>>().toEqualTypeOf<Omit<JZS.RowOf<table>, 'id'>>()`. Read the compiled
  schema through `getCollectedSchema()` (or the app handle, whichever the spike finds cleaner).
* Exit: schema and permissions compile, are exercised by tests against a real Jazz db, and
  nothing else has changed.

**Phase 1 as built (2026-09-26, alpha.56).** Where it departs from the table above:

* **alpha.56 cannot hold three things the table assumed**, each pinned by a canary test in
  `tests/db/schema.test.ts` so a bump shows when the workaround can go:
  - *An optional JSON column refuses every value* ("value does not match type ... Json"), on
    insert and on update; only null-by-omission gets in. Required JSON columns work, for
    objects, arrays and numbers, but not a bare top-level string. So a nullable structured
    value (`bulk_ishes_last`, `playings.response`) is a nullable string column holding JSON
    text, through `jsonText<TT>()` in `src/db/json-text.ts` (a typed `transform`, written with
    `UU.jsonify`). The column no longer checks the value; the row validator does.
  - *A payload-bearing enum refuses every insert* ("decode cells: unknown tag N in enum"), and
    its fields may not be enums anyway ("Payload enum v1 fields must be scalar columns"). So
    `widgets` keeps today's shape: `kind` an enum, `expression_label`, `player_label` and
    `textkind` nullable, the row validator checking which kind holds which.
  - *An insert with no content cells is refused*: a workspace is inserted with
    `active_quiz_id: null` spelled out.
* `playings.items` is a required JSON array defaulting to `[]`, not nullable: nothing told null
  from empty. It is the one column where Jazz still checks the Zod schema.
* `last_sortkey` is a nullable string with a typed `transform` to `Sortkey`. The sort memory's
  column form is now `zod.templateLiteral(['column:', label])` rather than `zod.custom`, since
  JSON Schema can express it (and so can the coherence test).
* The validator kit has `rowid` (`Z.uuid()`; Jazz mints UUIDv7). Row validators name each
  parent `<parent>_id: rowid`, with a `JZS.rel` beside it in the table.
* `active_quiz_id` is a relation, as planned. The export will need it as a label (phase 3).
* The coherence test reads the compiled columns from `app.wasmSchema` and the column builders
  from `schema` (to recognise `jsonText` columns), and checks names, nullability, base type,
  enum values, JSON schemas, relations, and the row type at the type level. Broken on purpose,
  it fails both at run time and in `tsc`.
* Found along the way: `$createdAt` counts milliseconds, so two inserts in one millisecond
  tie. An update to a row the account cannot read throws synchronously, before any sync
  ("read policy denied UPDATE"); a delete is refused only at the edge (`expectDenied`).
* **The agents' Jazz Cloud app still holds the placeholder.** `jazz_deploy` under
  `dev_aijanitor` says the new schema "is not connected to the previous schema" and asks for
  `migrations create --fromHash cfb3ee9c72d3`. No migration was written for a throwaway
  table: a Coach points `dev_aijanitor` at a fresh app before phase 3 ships.

### Phase 2: the write side (design-heavy; the largest phase)

Replace the tree reducers with row-writing actions in `src/state/`, keeping the action
vocabulary: `workspace-reducer.ts`, `revise-quiz.ts`, `layout-reducer.ts`, `widget-edit.ts`
become functions `(db, …) => Promise<void>` (or synchronous local writes where Jazz allows)
that insert/update/delete rows. `Labelmaker`, `Chain`, `sortings`, `columns`, `collections`
stay pure and untouched.

* Reorders write `position` on the rows that moved. A sort commits the new positions.
* Relabel is still a move (routing decision); it writes the row, then navigates.
* Each former reducer test becomes a test that runs the action against a `createPolicyTestApp`
  database (the phase 0 default) and reads rows back by label. Coverage must not drop: port
  every case.
* `workspace-store.ts` is deleted; nothing replaces it. `use-workspace.ts` becomes a thin hook
  over `useAll`/`useOne`.
* Exit: every action has a row-writing successor with tests; the UI is not yet switched.

**Phase 2 as built (2026-09-26).**

* **`perform(db, open, action)`** (`src/state/perform.ts`) takes the same `WorkspaceAction`s the
  reducer did; `performLayout` takes the layout ones. So `widget-edit.ts`'s planners, and every
  `dispatch` in the UI, keep their shape: phase 3 swaps `dispatch` for `perform`. The actions
  themselves are in `quiz-actions.ts` and `layout-actions.ts`, one function each.
* **`open` is `{ workspace_id, quiz_id }`, the quiz on this screen.** Actions no longer act on the
  workspace's `active_quiz_id`: Jazz syncs that row across tabs, so another tab opening a quiz
  would send this tab's edits there. `active_quiz_id` is now only "last opened", for
  `OpenQuizRedirect`.
* **Reading** (`quiz-rows.ts`): `loadQuizRows`, `loadWorkspaceRows`, and `quizFrom(rows)`, the
  one projection into the `QuizT` tree that Sortings, Rank, Chain and Expressed read (and that
  phase 3's bag, export and mirror will). Tree ids are row ids; chains are held as labels and
  projected to ids; the kit's `treeid` accepts a row id or a ULID (a question not written yet).
* **Writing** (`quiz-writing.ts`): per-table update helpers that validate the whole row as it
  would stand and write only changed fields; `writeQuiz`/`writeWorkspace`, which write a whole
  tree into rows by id (questions, quizzes) or label (widgets, columns, expressions), for new
  quizzes, imports and seeding; `transact(db, write)`, used for every write.
* **Asking actions always insert a playing** (reply or failure); nothing compares a reply's own
  timestamp with `$createdAt`. Only `writeQuiz` (imports) records "replies newer than the newest
  recorded", which is what keeps a quiz written back as read from recording twice.
* `ensureWorkspace(db)` finds the account's workspace or makes a blank one, reading at
  `remote-if-possible` so a device that has not synced yet does not make a second.
* `workspace-store.ts` is **not** deleted yet: it goes with the UI switch in phase 3, since
  deleting it now would break the running app. The reducers and their tests stay until then too.
* **alpha.56, found this phase** (all worked around; see the Risks section):
  - A query that `include`s two relations of one quiz, or nests an include in an ordered one,
    can block the process for good once a quiz has its standard 11 widgets and 21 columns. No
    timer fires; the page would freeze. Every read is a flat query per table, run in parallel,
    with `where({ question_id: { in: ids } })` for the playings. Phase 3's subscriptions must
    do the same.
  - `$createdAt` is missing from a row read back at once, even after an awaited transaction; a
    moment later it is there. `askedAt()` treats an unstamped playing as asked just now.
  - Jazz refuses to commit an empty transaction. `transact` counts writes through a thin proxy
    and abandons one that wrote nothing.
  - In tests, `edge`-tier reads slow to a stall once the shared test server holds many
    accounts; tests read `LocalFirst`.

### Phase 3: the read side and the UI switch (mechanical once phase 2 lands)

* `Workbench` subscribes: the workspace, the active quiz by label, its questions, widgets,
  columns, and the newest playing per (question, player, textkind). One flat subscription per
  table (phase 2's hang), assembled with `quizFrom`.
* `dispatch` becomes `perform(db, open, action)`, `open` being the quiz the route shows. Then
  `workspace-store.ts`, `workspace-reducer.ts`, `layout-reducer.ts`, `revise-quiz.ts` and their
  tests go (their cases already live in `tests/state/perform.test.ts` and
  `layout-actions.test.ts`); `isLayoutAction` and `openQuizOf` move to wherever they are still
  used. The quiz mirror's `onChanged(before, after)` needs a new source: a subscription.
* The formula bag, the export, and the git mirror's file are **projections** built from rows in
  one place (`lib/quiz-bag.ts` or a sibling). The reducers used to hand them a tree; now a
  function assembles one. The export format is unchanged, so import keeps working.
* `OpenQuizRedirect` reads `active_quiz` from the workspace row.
* Decide where `JazzProvider` sits. It renders a progress bar until the session is ready, server
  render included, so today no page chrome paints ahead of the data; the client-first note
  wants the shell to prerender. Page chrome outside the provider is the likely answer.
* Before this ships to a real database, `scripts/jazz_deploy` under the matching janitor config:
  a client whose schema the server does not hold cannot be expected to sync.
* Delete `lib/workspace/port.ts`, `lib/players/port.ts` (players are constants; only the
  credentialed flag is fetched, from `/api/players` which now reads env alone),
  `app/api/workspace/route.ts`, the cookie, `src/db/{client,players,workspaces}.ts`,
  `/drizzle`, `tests/db/{client,migrations,players,workspaces}.test.ts`, `lib/ids.ts` and its
  test. Remove `@libsql/client`, `drizzle-orm`, `drizzle-zod`, `drizzle-kit`, `ulid`, the
  `db:generate` script, and `TRIQUET_DATABASE_URL` from `dev:agent`, `build:agent` and
  Playwright's `webServer.env`, with `data/agent.db` and `data/e2e.db`.
* e2e: re-point the specs. Most stub `/api/ask` and `/api/players` and keep working;
  `quizzes`, `routing`, `importing`, `quiz-history` need the fresh-context reset from the phase 0
  spike. Add one spec that asserts the app works with every route except `/api/ask` blocked
  (the client-first rule as a test).
* Exit: the app runs on Jazz alone; `pnpm test:e2e` green; the Coach's JSON imports cleanly.

**Phase 3 as built (2026-09-26).**

* **`useWorkspace(label?)` kept its shape**, so every component still gets `{ workspace, quiz,
  loaded, unsaved, saveNotice, dispatch }`. Inside: `ensureWorkspace` (one lookup per database,
  local copy first), one `useAll` per table, `workspaceFrom(rows, workspace_id)`. Loaded means
  the workspace *and* one of its quizzes have arrived: the tables arrive one by one, and a
  workspace row alone sent the redirect off to mint a quiz.
* **Writes do not read first.** `perform(db, held, open, action)` takes `held`, every row the
  account holds, and the hook passes the rows on screen, so a lone change writes at once (a
  plain update notifies subscribers synchronously; a transaction one microtask later). An
  earlier version loaded rows inside every action, and two quick arrow-key moves then read a
  stale grid. A change dispatched while another is still being written (an editor applying a
  widget and its column together) waits for it and reads the rows afresh.
* **`use-reorder` steps from where the last arrow press sent a row**, until the list shows it
  there, so key repeat outruns neither the write nor the render.
* **`unsaved` means "a change is still being written"**, a few milliseconds each. The page asks
  before it is left in that window (registered at once, not on the next render), and the quiz
  history waits for in-flight writes before a milestone or a download.
* **The mirror** is fed by the tab that made a change: after `perform`, it reads the workspace
  and notes `(before, after)`, as the store did on its own dispatches.
* **Deleted:** the store, the three reducers and `revise-quiz`, `workspace-change`, the
  workspace route, port and cookie, `src/db/{client,players,workspaces,drizzle-schema}.ts`,
  `/drizzle`, `drizzle.config.ts`, the libSQL tests, `@libsql/client`, `drizzle-orm`,
  `drizzle-zod`, `drizzle-kit`, `ulid`, `db:generate`, `TRIQUET_DATABASE_URL` and
  `data/{agent,e2e}.db`. The action types and `isLayoutAction` live in `state/actions.ts`;
  `openQuizOf` and the tree's `expressionUsage` in `models/workspace.ts`.
* **`lib/ids.ts` stayed, minting UUIDs** instead of ULIDs: a question or quiz in the tree needs an
  id before it is written. `treeid` still accepts a ULID, so old exports import.
* **Players are constants** (`lib/ask/players.ts`); `PlayerValidators.player` no longer comes
  from `drizzle-zod`.
* **e2e:** `expect.timeout` is 10 s (a fresh page opens Jazz for most of a second in dev);
  one-shot reads became retrying assertions; cookie resets went (each spec's context is a fresh
  account); the spec that relied on a cookie reset for an empty quiz opens a new quiz;
  `e2e/client-first.spec.ts` blocks every host but the app's own, WebSockets included, plus
  `/api/players`, and still opens, edits and reloads. 130 specs.
* **Not done:** `JazzProvider` still wraps the whole app, so the prerendered page is a progress
  bar. Moving the chrome out is a design change for a Coach. The Coach's JSON was not tried
  (it is not in the repo); import's e2e specs pass.
* **Your `.next/dev/types/validator.ts` is stale** (it names the deleted workspace route), and
  `tsconfig.json` includes every build folder's types, so `pnpm build` and `pnpm typecheck`
  fail until the next `pnpm dev` rewrites it.

### Phase 4: the local-only → identified seam (small; design only for now)

Not auth. Only what makes TODO 1 a bolt-on later rather than a rework:

* The session is created with `initial: 'local-first'`; the account exists silently.
* The workspace row is found by `session.user.account`, never by a cookie or a stored id.
* A `Recovery` panel stub is *not* built; but `exportLocalFirstSecret` / `RecoveryPhrase` are
  noted in `stack.md` under *Later* as the no-login multi-device path.
* Write the collision policy (copy local rows into the identified account, then switch) as a
  test-less design note in the decision record; it is already there.
* Exit: nothing visible; the decision record's identity section matches the code's seams.

**Phase 4 as built (2026-09-26).** One finding changed the permissions: `managedByCreator()`
keys ownership on the exact identity, so the agreed `linkJWT` path would have left a signed-in
identity unable to read what the local-first identity made. Every table now owns rows by
`$createdBy.account`, and `ensureWorkspace` finds the workspace by the account that made it,
taking the account from `useSession()`. Tests hold two identities of one account to sharing
everything and to finding one workspace. The decision record's identity section lists the seams.

### Phase 5: notes cleanup (TODO 4; after everything lands)

Turn "outgoing" and "mid-move" into what is. `README.md` Developing section, `CLAUDE.md` storage
paragraph and `src/db/` entry, `stack.md` Outgoing lines, `guidelines.md`'s
"Sketch/DNA/Real/Live" mention in `testing.md`.

## Sub-agents:

* **Reading the `jazz-tools` package** is the one job worth an Explore agent: `dist/` is large,
  and the main session's context should hold the design, not the type declarations. Ask for
  the specific signatures (a column builder, `useAll`'s options, the testing exports), not a
  tour.
* **Never spawn for the schema or the action design.** One mind, one session, one file.
* **Test porting** parallelises well: one agent per `tests/` area (`models`, `state`, `lib`),
  each in a worktree, each given the landed pattern and the rule that ids are never asserted.
  Merge one at a time.
* **`/code-review`** at the end of each phase, high effort for phases 1 and 2.

## Risks, named

* The alpha moves under us. Pinned exact; a bump is a decision, made after reading the diff.
* JSON-column validation turned out to be enforced (phase 0), but only what JSON Schema can
  say, with a message not fit for an author. The entrypoint checks still carry the messages.
  And only on required JSON columns: the nullable ones are JSON text (phase 1), checked by
  their row validators alone.
* A reorder under concurrent edits is LWW per row; two people dragging at once can interleave.
  Acceptable for the trial; note it in the decision record if it bites.
* Some alpha.56 query shapes hang the page outright (phase 2): several `include`s on one
  query, or a nested one. Flat queries only, until a bump shows otherwise; a canary cannot pin
  this, since a hanging test takes the suite with it.
* The e2e suite is the largest test area and leans on server reset. If the fresh-context reset
  is not enough, a `page.evaluate` that clears IndexedDB is the fallback, not a route.
