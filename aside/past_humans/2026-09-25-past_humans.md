
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
