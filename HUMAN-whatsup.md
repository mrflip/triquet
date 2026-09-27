# THIS DOCUMENT IS **FROM** AGENTS **TO** COACHES
It does not represent authoritative decisions: it is a conversational scratchpad. Agents should not use this as input, but are encouraged to write to it.
Agents: add at the top of the document, add a level two header;  Put the date before your title, following the examples seen here:

## 2026-09-26: e2e in CI -- four shards, a worker per core

CI's e2e job took 32 minutes, and passed. Nothing in the specs waits on purpose: no sleeps, no
serial blocks, and one spec at a time locally takes a median 2.5s, none over 7.1s. The cost is
137 specs, each a fresh browser that loads the dev bundle and opens a new Jazz account, run one
at a time on a runner that reported two or three cores (Playwright said "1 worker" at its
default of half). The repo is public, so `ubuntu-latest` should be GitHub's 4-core box, and
personal plans can't have larger runners anyway; with `workers: '100%'` on CI, the log's
"Running N tests using N workers" line now says how many cores it got.

The job is now a matrix of four shards, each on its own runner and dev server, and each shard
runs a worker per core. Every shard runs the `environment` setup first, and runs to the end
even when another fails. A failed shard uploads `playwright-report-<shard>`.
`pnpm test:e2e --shard=2/4` runs that shard's specs locally.

Locally the suite keeps Playwright's half the cores, 8 workers on this Mac: 137 passed in 1.9
minutes, against 6.5 at one worker. At 16 workers it was no faster (1.8 minutes), and one spec
failed because its page took more than 10s to render, which is load, not a collision. A
worker per core on CI is that same load per core, so if CI starts reporting flaky specs whose
first assertion timed out, the fix is `'50%'` there, not a longer timeout.

Flaky specs show on CI as error annotations and in the run summary even though the job passes,
so the retry reports a collision rather than hiding it. Locally there is no retry at all.

## 2026-09-26: e2e in CI -- silent, not (as far as we know) stuck

The CI e2e job printed "Running 130 tests" and then nothing for eight minutes. The `dot`
reporter writes one character per spec and no newline until the 80th, and GitHub's log shows
only whole lines, so up to 80 specs, passing or failing, left no trace. The same job run
locally, with an empty environment and one worker as a 2-vCPU runner gets, passed all 130 in 6.4
minutes on this Mac; CI's first pass also compiles every page. So the likeliest story is a slow
run that had not yet reached 80, not a hang. The next CI run will tell: CI now uses the `list`
and `github` reporters, has a 40-minute ceiling, and gets `dev_e2e`'s ports and directories.

`playwright.config.ts` now refuses to start when the environment would put the suite on
another session's port, build or database, or on a real Jazz database, listing every
complaint (`e2e/environment.ts`). An `environment` setup project runs before the specs: it
prints the relevant variables (values hidden where the name looks secret), checks Jazz's
`/health`, and opens the first page so no spec pays for compiling it.

Since: CI retries a failed spec once, so it records a trace, and a failed job uploads the html
report and `test-results/` as the `playwright-report` artifact (14 days). A new push to a pull
request cancels that pull request's run in progress; pushes to main are never cancelled.

## 2026-09-26: Blank page in production -- found and fixed

The Vercel deploy showed the loading bar, then nothing. Reproduced locally: a production build
served by `next start`, against a local Jazz server. A first visit found no workspace in the
browser, and asked the server. When the server could not be reached, that read failed; when it
did not serve the app, the read never answered. The failure went to a notice the root page never
showed, so the page was blank. Now the server gets 3 seconds (`ServerLookupMillis`) and any failure
means this browser makes the workspace (the server only advises there), and the redirect page
says "Opening your quizzes…" or why it stopped. All three cases now reach the grid in about two
seconds: server unreachable, app unknown to the server, and the working case.

Separately: `pnpm deploy prd_janitor` ran pnpm's own `deploy` command, which copied the whole
package (2.8 GB, `data/` included) into `prd_janitor/`. Our script never ran. Delete that folder:
it also breaks `tsc` and type-aware lint (two copies of every type), and slows the dev server's
file watching. The deploy is `doppler run --config prd_janitor -- scripts/jazz_deploy`.

**Noticed, not fixed:** an import writes the whole merged quiz, merged from the screen as it
stood when Import was pressed. An edit made a moment earlier, still being written, is put back.
The import spec now waits for the save first, as the other specs do; the real fix is for an
import to write only what it changes.

## 2026-09-26: Jazz migration done -- read this one first

Phases 1 to 5 are committed, each as code and then its findings (`48b31f3` to `33c8678`). The
app runs on Jazz alone; libSQL, Drizzle, the store and the reducers are gone. At the end: lint
clean, 1782 unit tests, 130 e2e specs (one new: the client-first rule), and `tsc` clean over
everything but your `.next`.

**Do first**

1. Run `pnpm dev` once before `pnpm build` or `pnpm typecheck`: your `.next/dev/types` still
   names the deleted workspace route (phase 3 entry).
2. If `pnpm dev` complains about the Jazz schema, wipe `data/jazz/`, which may hold the phase 0
   placeholder's history. That one is yours to wipe.
3. Your quizzes are still in `data/triquet.db`, which nothing reads now. Bring them in through
   the import panel.

**Decisions I made that you may want to overturn**, detailed in the phase entries below:

* The widgets table kept a nullable column per kind, and two nullable structured values are
  JSON text. alpha.56 can't do either the plan's way; canary tests show when it can.
* Actions write from the rows on screen, and changes dispatched together queue.
* Rows are owned by account, not identity. That's a change to `permissions.ts` the plan didn't
  foresee, but the agreed sign-in path needs it.
* ULIDs are gone; `lib/ids.ts` stayed, minting UUIDs.
* e2e asserts with retries, and its timeout is 10 s.

**Left for a Coach** (also at the top of `whiteboard/jazz-migration.md`): a fresh Jazz app for
`dev_aijanitor`; a `jazz_deploy` before any real database serves this schema; where
`JazzProvider` sits; where the sync server runs; no `/code-review` pass on any phase (not a
skill I could invoke here).

**Noticed in phase 5**

* `tsconfig.json` includes every build folder's generated types (Next adds each one it sees),
  so one person's stale folder breaks everyone's `tsc`. Excluding the folders other than your
  own would fix it, but Next re-adds them.
* The "Sketch/DNA/Real/Live" line in `testing.md`, flagged since 09-20, is fixed.

## 2026-09-26: Jazz phase 4 -- the seam for signing in

Committed as `a6f23d2`. One change you should look at: **permissions now own rows by account,
not by identity.** `managedByCreator()` compares the whole author, the exact identity. The
decision record's path to sign-in links the new identity to the *existing* account, and under
that rule the signed-in identity could not have read anything the local-first one made. Now
every table allows read, insert, update and delete where `$createdBy.account` is the session's
account (28 plain lines in `permissions.ts`; a loop over the tables would not typecheck against
Jazz's overloads). `ensureWorkspace` finds the workspace by the account that made it. A test
shows two identities of one account sharing everything. Unit (1782) and e2e (130) pass.

Nothing else in phase 4 needed code: the session already starts local-first, the collision
policy is already written down, and `exportLocalFirstSecret` is now under *Later* in
`stack.md`.

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

## 2026-09-19: Reviewed Changes

Coach has swept changes into future documents