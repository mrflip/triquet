# THIS DOCUMENT IS **FROM** AGENTS **TO** COACHES
It does not represent authoritative decisions: it is a conversational scratchpad. Agents should not use this as input, but are encouraged to write to it.
Agents: add at the top of the document, add a level two header;  Put the date before your title, following the examples seen here:

## 2026-09-26: Jazz phase 3 -- the app runs on Jazz alone

Committed as `0e75804`, findings filed after it. libSQL, Drizzle, the store and the reducers are
gone; `useWorkspace` subscribes to Jazz and dispatches through `perform`, with the components
unchanged. Lint, unit tests (1781), the source's typecheck and e2e (130, one new) pass; see
below for `pnpm typecheck` and `pnpm build` on your machine.

**Before you run anything**

* **Your `.next/dev/types/validator.ts` is stale.** It still names the deleted workspace route,
  and `tsconfig.json` includes every build folder's generated types, so `pnpm typecheck` and
  `pnpm build` fail until your next `pnpm dev` rewrites it (or you delete `.next/dev/types`).
  I didn't touch `.next`. My own build compiled, and `tsc` over everything but `.next` is clean.
* **Your quizzes are not in Jazz.** `data/triquet.db` is untouched and nothing reads it now.
  Export from an older checkout, or read the JSON you already have, and bring it in through
  the import panel. I couldn't try your JSON; it isn't in the repo.
* `data/jazz/` holds the phase 0 placeholder schema's history. If `pnpm dev` complains about
  the schema not connecting, wipe `data/jazz/` (yours to do).

**Judgement calls you may want to overturn**

* **Actions write from the rows on screen, without reading first.** My first cut read rows in
  every action; e2e caught two quick arrow presses acting on a stale grid, and an editor's
  two-action plan (widget, then its column) refusing its own second half. Now a lone change
  writes at once, changes dispatched together queue, and `use-reorder` steps on from where
  it last sent a row.
* **`unsaved` now means "a change is being written"** (milliseconds). The page asks before it is
  left in that moment, and milestones and downloads wait for in-flight writes. One spec
  reloaded in the same instant it typed; it now leaves the field and waits, as the other specs
  do.
* **e2e asserts with retries** (`expect.poll`, list `toHaveText`) instead of one-shot reads,
  and `expect.timeout` went from 5 s to 10 s: a fresh page takes most of a second to open
  Jazz in dev, on top of first-visit compiles.
* **ULIDs are gone, `lib/ids.ts` is not**: it mints UUIDs for tree things not yet written. The
  plan said to delete it; the tree still needs ids for unwritten questions.
* **`JazzProvider` still wraps the whole app**, so the prerendered page is a progress bar. The
  plan asked me to decide; moving the chrome outside changes what the author sees first,
  which is a Coach's call.

**Noticed**

* The mirror reads the workspace once after each change so it can compare before and after.
  Cheap for now; say so if it isn't.

## 2026-09-26: Jazz phase 2 -- the write side

Committed as `7bbb224`, findings filed after it. `perform(db, open, action)` writes rows for every
action the reducer knew, over the same `WorkspaceAction` vocabulary, so phase 3's UI switch is
mostly swapping `dispatch` for it. Every reducer test case is ported to run against a real Jazz
database (`tests/state/perform.test.ts`, `layout-actions.test.ts`), plus tests for the
reading and writing layers. Lint, typecheck, unit tests (1962) and e2e (129) pass; the UI still
runs on libSQL.

**Judgement calls you may want to overturn**

* **Actions act on the quiz the screen shows**, passed in as `open`, not on `active_quiz_id`.
  Once Jazz syncs that row, a second tab opening another quiz would otherwise redirect this tab's
  edits. `active_quiz_id` is now "last opened".
* **The tree survives as a read model.** `quizFrom(rows)` projects rows into the old `QuizT`
  (row ids as ids, chains projected from labels to ids), because Sortings, Rank, Chain and
  Expressed all read it, and phase 3's bag, export and mirror need it anyway. The actions are
  targeted row writes; only imports, new quizzes and seeding write a whole tree, by diff.
* **Tree ids accept a row id or a ULID** (`treeid` in the kit), since a question minted by
  `Question.blank()` has no row id until it is written.
* **`transact` wraps the transaction in a Proxy** to count writes, because Jazz refuses to commit
  an empty transaction and the alternative was catching its error message. Small and documented,
  but it is cleverness, so flagging it.
* **I added `expectUnchanged` to `vitest/expect-expect`'s assertion names** in
  `eslint.config.mjs`, beside `accepts` and `rejects`.
* **`workspace-store.ts` is not deleted** though the plan put that in phase 2: it goes with the
  UI switch, or the running app breaks.

**Found in alpha.56** (in the plan and the decision record now)

* A query including two relations of a quiz, or a nested include, can freeze the process for
  good at realistic sizes. Flat queries only.
* `$createdAt` is missing on a row read back at once; a moment later it is there.
* An empty transaction cannot be committed.

**Not done**

* No `/code-review` pass (not a skill I can invoke here); I reviewed the diff myself.
* Two tabs opening a brand-new account at the same moment could each make a workspace;
  `ensureWorkspace` then uses the older. Not worth more than that for the trial.

## 2026-09-26: Jazz phase 1 -- schema, permissions, row validators

Committed as `48b31f3`, findings filed after it. Seven tables in `src/db/schema.ts`, each
`managedByCreator()`, and a Zod row validator per table in its model (`QuizValidators.row` and
so on). `tests/db/` now runs against a real in-process Jazz server: round trips per table,
permissions (another account sees nothing and can change nothing), and the coherence test,
which I broke on purpose to see it fail both at run time and in `tsc`. Lint, typecheck, unit
tests (1810) and e2e (129) pass. The running app is untouched.

**Judgement calls you may want to overturn**

* **alpha.56 broke two of the plan's column choices**, so I worked around them rather than
  stop. Both are pinned by canary tests that fail when a bump fixes them:
  - Optional JSON columns refuse every value. `bulk_ishes_last` and `playings.response` are
    stored as JSON text through a 30-line helper, `jsonText<TT>()`, a typed `transform` on a
    nullable string. Jazz no longer checks those two values; their row validators do.
  - Payload-bearing enums refuse every insert, so `widgets` did not get its tagged union: it
    keeps a nullable column per kind, as the Drizzle table has it, and the row validator
    checks which kind holds which. The decision record says so now.
* **`playings.items` is a required array defaulting to `[]`**, not nullable. Nothing reads a
  difference between "no spans" and "not a numnum reply", and it keeps one real Zod-checked
  JSON column in the schema.
* **The sort memory's column form is a Zod template literal** (`column:<label>`), replacing a
  `zod.custom` that JSON Schema cannot express. Same pattern; the refusal message is now Zod's
  generic one rather than "should be "column:" and then a label".
* **`rowid` joins the validator kit** (`Z.uuid()`); Jazz mints UUIDv7s.
* **`active_quiz_id` is a relation**, as the plan's table has it. Every other cross-reference
  is a label; the export will have to turn this one into a label in phase 3.

**Needs a Coach**

* **Point `dev_aijanitor` at a fresh Jazz app.** Deploying there refuses the new schema as
  "not connected to the previous schema" (the phase 0 placeholder) and asks for a migration.
  I didn't write a migration for a throwaway table. Nothing needs the cloud app until phase 3.

**Not done**

* No `/code-review` pass: it isn't a skill I can invoke here. I reviewed the diff myself.

## 2026-09-26: Doppler configs, Jazz housekeeping scripts, findings filed

Code committed as `fbdac46`, this docs sweep after it. The findings from this thread now live
where later readers look: the migration plan (ground rules, phase 0 answers, phases 1-3,
risks), both decision records, `stack.md` (Secrets and CI, Testing) and `testing.md` (the
default Jazz harness, how e2e is isolated).

**Superseding parts of the entry below**

* `src/db/.env` is gone. Jazz writes its app id into the Jazz data directory now
  (`data/jazz*/.env`), through `withJazz`'s untyped `envDir` option.
* The "production build shows an alert" concern is settled by `prd` carrying the Jazz app id
  and URL. `next.config.ts` clears the cloud variables only for the dev server, so a build
  always keeps them.
* The e2e suite has its own Doppler config (`dev_e2e`) and server; `dev:agent:bare` is gone.

**Still open**

* The agents' real Jazz app holds the placeholder schema; phase 1 either writes a migration
  or points `dev_aijanitor` at a fresh app (the plan says so).
* No `/code-review` pass on phase 0 yet.

## 2026-09-25: Jazz phase 0 -- installed, wired, four spikes answered

`jazz-tools@2.0.0-alpha.56` is installed (pinned exact; the `alpha` tag still points at it).
`withJazz` is in `next.config.ts`, and `JazzProvider` wraps the app with a local-first session.
The app still runs on libSQL. Lint, typecheck, unit tests (1567), e2e (129 plus 3 spike specs,
since removed) and `build:agent` all pass. Nothing committed.

**The four answers**

1. **Does the runtime reject a JSON write that breaks the column's schema? Yes.** `db.insert`
   throws synchronously and locally, before any sync, with `WriteError("encoding error: JSON
   schema validation failed for column `reply`: 42 is not a string")`. The edge rejects it the
   same way. Only what JSON Schema can say is checked (`minLength` yes; refinements and
   transforms no), and the message names only the first problem. The entrypoint checks still
   write the messages an author sees; the column is a real second net, not decoration.
2. **Does a `Validator` callable pass as `StandardJSONSchemaV1`? Yes, but use `plain()`.** Zod's
   `~standard` getter resolves through the callable's prototype, so it compiles. It loses its
   own top-level `.describe()`, though, because Zod keys descriptions on the schema's identity.
   The column's JSON schema then differs from `Z.toJSONSchema(plain(...))`, which the coherence
   test compares against.
3. **Which harness? `createPolicyTestApp`.** It starts a real in-process server in about 35 ms,
   a round trip with an edge wait takes about 25 ms, it enforces permissions (one account's rows
   hidden from another, verified), and it is Jazz's public testing API. The memory driver is
   just as fast, but it evaluates no permissions and needs a hand-made `AccountStore` plus a
   `serverUrl` it never uses.
4. **Playwright: does `dev:agent` bring Jazz up, and is a fresh context enough? Yes, and yes,
   on one condition.** `withJazz` runs the sync server inside `next dev`, so the existing
   `webServer` entry needs no change. A fresh context starts empty *only because each
   local-first account sees only its own rows*. With a read-by-anyone policy, the fresh
   context saw earlier runs' rows. So the reset holds while every table is creator-owned;
   otherwise wipe `data/jazz-agent/` before a run.

Bonus, for client-first: with the sync server blocked (HTTP and WebSocket), a *first* visit
still makes its account, writes and reads. An established tab keeps working when the server
goes away.

**Judgement calls you may want to overturn**

* **A production build without Jazz env shows an error instead of the app.** `withJazz` fills
  `NEXT_PUBLIC_JAZZ_APP_ID` / `_SERVER_URL` only in dev. Without them, `SyncProvider` renders
  an MUI Alert naming the two variables, so `pnpm build && pnpm start` (and any preview
  deploy) now shows that alert, although the app itself needs nothing from Jazz yet. CI's
  `pnpm build` still passes. The alternative is to render the app without Jazz when
  unconfigured, a fallback path phase 3 would have to remove. This is tied to the open "where
  does the sync server run" item.
* **The whole app waits for the Jazz session.** Server render and first paint are an MUI
  `LinearProgress`, then the app (under a second locally). That is how `JazzProvider` works,
  but it means the prerendered shell no longer paints before the data, as the client-first note
  hoped. Phase 3 may want the page chrome outside the provider.
* **Placeholder table.** An empty Jazz schema will not deploy (the permissions publish 404s),
  so `src/db/schema.ts` has one `spike_notes` table, creator-owned, which nothing reads.
  Phase 1 replaces it.
* **The Drizzle schema moved to `src/db/drizzle-schema.ts`.** Jazz loads whatever
  `schema.ts` sits in its `schemaDir` (`src/db`). Ten imports and `drizzle.config.ts` follow it.
* **Human ports and data:** `pnpm dev` now also runs Jazz on :3001 with data in `data/jazz/`,
  kept out of the default `node_modules/.cache` so a reinstall can't wipe it. The port is
  pinned rather than random because the browser's account is enrolled against the server URL.
  Agents get :3101 and `data/jazz-agent/`. README and CLAUDE.md say so.
* **The spikes were thrown away**, not kept in `whiteboard/`: exploratory code that logs
  instead of asserting would have needed lint exemptions to live in the tree. Their answers,
  and the one non-obvious harness recipe, are in the plan under Phase 0.
* **`protobufjs`'s build script is denied** in `pnpm-workspace.yaml`. It came in through
  jazz-tools' OpenTelemetry deps, and its postinstall only prints a version warning.

**Noticed, not acted on**

* `withJazz` writes the app id into `<schemaDir>/.env`, which is `src/db/.env` (gitignored
  by `.env*`). The plugin reads an `envDir` option at runtime, but its types leave it out.
* `playwright.config.ts` has `reuseExistingServer: ! process.env.CI`. When an agent's own
  `dev:agent` is already running, without the `webServer` env (stand-in API key, 2 s commit
  debounce), 19 specs fail for reasons unrelated to what they test. It bit me once today.
* jazz-tools brings in roughly 300 MB of native and WASM binaries (`jazz-napi`, `jazz-wasm`).
* Jazz's dev inspector overlay (a 🎵 button, Alt+Shift+J) mounts in dev. The e2e suite
  doesn't notice it.

## 2026-09-25: Jazz decision recorded, migration planned

Docs only; no code changed, nothing committed. `notes/decisions/2026-09-jazz.md` (rewritten) and
`notes/decisions/2026-09-client-first.md` (new) carry the discussion; `stack.md`, `CLAUDE.md`,
`README.md`, `guidelines.md`, `testing.md` and `vocabulary.md` point at them. The plan is
`whiteboard/jazz-migration.md`.

**Judgement calls you may want to overturn**

* **`src/db/` keeps its name** and becomes the Jazz layer (schema, permissions, client setup),
  no longer "server only". It now sits *above* `models` in the import order, since
  `schema.ts` takes Zod value schemas from the models. The old sanctioned climb (`player.ts`
  into `db/schema`) is noted as leaving with Drizzle.
* **The players table becomes a constant.** Nothing about a player was ever user data; the
  table existed to be asked "is there a key?". `/api/players` stays as part of the ask
  exception (it reads env, holds no state).
* **"Open with a Coach" in `stack.md` is now mostly a settled-list** with one open item (where
  the sync server runs). The other open items (e2e thickness, OPFS, formulas in a worker, the AI
  layer, MUI on the grid) are untouched.

**Noticed, not acted on**

* `stack.md`'s Testing line pointed at `.claude/rules/testing.md`, which does not exist; it now
  points at `notes/tests.md`.
* `testing.md` still says "Sketch/DNA/Real/Live" (flagged on 2026-09-20; still there).
* The e2e specs already prove the app runs with `/api/ask` aborted; that is the client-first
  rule as a test. Worth keeping one spec that asserts it on purpose.

## 2026-09-20: Guidance-doc review, swept in

Docs and small code fixes from the review of `CLAUDE.md`, `stack.md` and `guidelines.md`. Nothing
committed. Lint, typecheck and unit tests pass; e2e not run (no UI or route behaviour changed).

**Judgement calls you may want to overturn**

* **`stack.md` is now a lookup table.** The long drag-and-drop and routing write-ups moved to
  `notes/decisions/`; each leaves a short pointer carrying its rules. The grid entry stayed
  whole under *Hand-rolled on purpose*, since agents need to meet it.
* **Hand-rolling decisions are now recorded in `stack.md`**, not here, to match this file no
  longer being input. `CLAUDE.md`'s Library-first step 3 says so.
* **I left the lines under discussion alone** (Server Components, "thin" Playwright, Turso local
  mode) and listed them under *Open with a Coach* in `stack.md`, with a note not to "fix" the
  code toward them meanwhile.
* **"Direct zod imports" turned out to be two real ones.** `db/client.ts` and the ask route built
  schemas from raw `Z`; both now use the kit. The rest import `zod` for types only, which
  `guidelines.md` now says is fine. I did not touch the two-kits duplication.
* **`.describe()` strings**: I left them. They read as the information dumps guidelines bans from
  doc blocks, but they feed the JSON Schema and the chatbot prompt. Worth one sentence in
  guidelines saying which they are.
* **`downloading.ts` is tested against a stubbed `document`**, the first test here to fake the
  DOM. Fine for six lines; not a pattern to grow before the component-testing thread decides.

**Noticed, not acted on**

* `notes/tests.md` still says "Sketch/DNA/Real/Live"; guidelines no longer defines those
  phases. I reworded the `CLAUDE.md` pointer and left `testing.md`'s sentence for you.
* `models/player.ts` imports the `players` table from `db/schema` (for `drizzle-zod`): the one
  place a model reaches up into `db`. Client code only takes types from it, and
  `models/player-label.ts` exists so it never needs more. Recorded in `CLAUDE.md`'s architecture
  section as the sanctioned exception.
* `lib/vv/kit.ts` cites `whiteboard/vv.md` in a doc block. Left for the validators thread.
* `notes/prior-work/202609-prompts.md` held a copy of `src/lib/ask/prompts.ts` when I first read
  it, not prompts. It has changed since; I did not re-read it.
* `quizgit.ts`'s path doc block describes "a hierarchy that does not exist yet". A design
  reason rather than a progress note, so it stayed.

## 2026-09-19: Reviewed Changes

Coach has swept changes into future documents