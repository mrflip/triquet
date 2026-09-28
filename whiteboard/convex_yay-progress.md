# Convex, yay: progress

The handoff for `whiteboard/convex_yay-plan.md`. Newer than the plan wherever they disagree.

## 1. Status

* **Phase 0 (spike and decisions)**: built on `20260927-convex_spike`, not yet merged.
* **Phase 1 (the server side, beside Jazz)**: built on `20260927-convex_server`; rebased by the
  Coach onto main as `20260927-convex_phase3`, not yet merged.
* **Phase 2 (the browser switch, and Jazz out)**: built, and now carried with phases 0 and 1 on
  `20260928-convex_phase4` (the Coach's rebase of `20260928-convex_client`), off `main` at #12,
  not yet merged. **The app runs on Convex alone.** On 2026-09-28: lint green; 1907 unit and
  convex tests green; 163 e2e specs green in about a minute (`pnpm test:e2e:agent`); `pnpm
  typecheck` fails only on the stale `.next-e2e/dev/types` (phase 3a fixes the cause).
* **Phase 3a (the deploy story, CI's drift check, the healthcheck)**: built on
  `20260928-convex_phase4` (`db7e137`), not yet merged.
* **Phase 4 (the evaluation, the ergonomics pass, Jazz's last traces)**: built on
  `20260928-convex_phase4b`, stacked on it, not yet merged. The verdict is written (keep Convex:
  `notes/database-decisions.md`, *Verdict*; `notes/decisions/2026-09-convex.md`), pending the
  Coach's word. Then, on the Coach's word, a quiz holds its questions' order and each question
  is a query of its own (*Deviations*). On 2026-09-28: lint and typecheck green; 1914 unit and
  convex tests and 164 e2e specs green.
* **Phase 5 (reviewings, hunts-and-idents PR 4)**: built on `20260928-convex_phase5`, stacked on
  phase 4's, not yet merged. On 2026-09-28: lint and typecheck green; 1966 unit and convex tests
  and 165 e2e specs green (`pnpm test:e2e:agent`, about a minute). The hunts-and-idents handoff is
  rewritten for phase 6.
* **Next**: phase 6 (huntings), a branch stacked on phase 5's; confirm the `HuntingsPerHunt` cap
  (99 proposed) with the Coach first. Phase 3b (the cloud): the Coach reports the app deployed to
  Vercel; when the cloud's round trip can be measured, re-measure (*Measurements*).

## 2. Start here

1. `pnpm dev:agent` runs the agents' app on Convex: `scripts/convex_dev agent --watch next dev`
   starts the agents' backend (3401) unless it is running, pushes `convex/` (regenerating
   `convex/_generated/`), marks it clearable, keeps pushing as `convex/` changes, and runs the
   dev server with `NEXT_PUBLIC_CONVEX_URL` naming it. `scripts/convex_reset <role>` empties a
   role's backend. Both unset `CONVEX_DEPLOY_KEY`, so a cloud key in the environment never steers a
   local role.
2. The e2e suite brings up its own (`scripts/convex_dev e2e --reset next dev`, from
   `playwright.config.ts`), emptied as it starts. `pnpm test:e2e:agent` uses the `e2e-agent` role
   (3003/3403).
3. `notes/decisions/2026-09-convex.md` is the shape of the data and the rules, in one place; read
   it before the plan's phase 5.
4. A schema change refuses a push to a backend holding rows of the old shape: `scripts/convex_reset
   <role>` and push again (`scripts/convex_dev ... --reset` now does this itself).
5. To measure against the production build: `pnpm build:agent`, then `pnpm start:agent` (3004,
   the agents' backend). The phase 4 harness is described under *Measurements*.

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
  `convex/` at the root; this plan ends with the app as it is today: now in
  `notes/decisions/2026-09-convex.md`, which `notes/stack.md`'s Convex entry points at.

Settled after phase 0 (Coach, 2026-09-27), and at the start of phase 1:

* **Isolation: a backend binary per role**, run by `scripts/convex_backend
  <dev|agent|e2e|e2e-agent>` (`pnpm convex:backend`), on ports 34xx and 35xx, with its data,
  instance secret and `cli.env` in `data/convex-<role>/`. The human's dev server uses it too.
  Written into `CLAUDE.md`'s *Global resources*. Agents are moving into containers of their own;
  a container still runs a dev server and an e2e suite side by side, so the script stays.
* **Caps**, in `src/lib/vv/patterns.ts` (*Collection sizes*): 999 questions and 999 reviews per
  quiz; 99 widgets and 99 columns per quiz; 99 realms and 99 expressions per hunt; 999 hunts in the
  app (99 in the plan, settled item 16; raised by the Coach in phase 2, so a whole e2e run fits); 99 quizzes per realm (proposed in phase 1, agreed). The tree
  validators apply those a tree holds. Every write that would pass a cap is refused.
* **Every refusal says why** (Coach, phase 1), and the browser shows it: `use-hunt` puts
  `noticeOf(err)` in `saveNotice`, `use-account-actions` in `notice`. The rest of the entry: by Convex's standard channel for an expected
  failure, a `ConvexError` whose data is `{ failurekind, message }` (`src/lib/refusals.ts`;
  the sentences are `RefusalNotices` in `lib/notices.ts`). A row validator refusing inside a
  handler becomes `{ failurekind: 'invalid', message, ZodError }` through `refusingInvalid`; a
  refused argument keeps convex-helpers' `{ ZodError }`. `noticeOf(err)` reads any of them as
  the sentence to show, and anything unmeant as `AppNotices.changeFailed`. Idempotent requests
  are not refusals: opening a review already open, deleting what is already gone (a quiz, a
  widget, a column, questions by id), and a bulk run's landing for a question deleted meanwhile.
* **Convex's AI files** installed by the Coach: `convex/_generated/ai/guidelines.md`, a block in
  `CLAUDE.md` and `AGENTS.md`, and the `convex-*` skills. `CLAUDE.md` says this project's rules
  win where they differ.

Settled in phase 5 (Coach, 2026-09-28):

* **The get rate is the reviewer's own estimate, and `peeked` says only that they looked**, not
  whether before or after they gave a rate. Nothing orders the two, and no wording implies it:
  the lock's dialog says the smiths will see that you looked, and the panel's mark reads "Saw the
  answer".

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
* **Module names are underbar_case** under `convex/` and `tests/convex/`: Convex refuses a hyphen
  in a module path, which `unicorn/filename-case` otherwise demands. An eslint block
  (`triquet/convex-module-names`) allows it there only.

## 4. Deviations from the plan

Newest first.

* **Phase 5: a quiz's deletion does not sweep each review's reviewings.** The plan asked for it;
  every reviewing names a question of its review's quiz (`setReviewing` and `peekAnswer` check
  `questionOf`), and each question's deletion already takes its reviewings (`by_question_id`), so
  the sweep could only find nothing, at an index range per review in a mutation that already
  spends two per question.
* **Phase 5: `peek_answer` leaves the review's phase alone.** The thread says the first write to
  a reviewing moves a review to `draft`; the plan names it for `set_reviewing` only. Seeing an
  answer writes nothing of the reviewer's own, so an `empty` review stays empty.
* **Phase 5: `NumberField`** (`cells/fields.tsx`, beside `QnumField`, whose pattern it follows)
  for get rate and minutes: an optional non-negative number, committed as a number or null,
  tidied into the number it means on exit. It is not a third height component: the row's height
  is still Comments' (`GrowingField`), and Guesses is stretched to it (`StretchField`).
* **Phase 5: `Panel` takes `wide`**, one rule in `workbench.module.css` (`.panelWide`, spanning the
  panels' grid): the verdicts table does not fit a 320-pixel column, and `ReviewsPanel` is wide
  once any review is shared.
* **Phase 5: `replace_open_quiz` keeps a question by its id**, not its label as the plan's phase 5
  text says; either way its reviewings survive, and a question the import drops takes its own.
* **`testing.clearAll` no longer schedules its own continuation** (a fix, found in phase 5). It
  deletes a batch of each table and says how many; `scripts/convex_reset` runs it until it says
  none. Scheduled and looped both, two runs deleted the same rows at once, and the e2e-agent
  backend's reset failed on an OCC conflict once a table held 500 rows.

* **A quiz holds its questions' order, and each question is a query of its own** (the Coach,
  2026-09-28). `quizzes.row_ordering` lists the questions by `_id`; questions lost `position`,
  and are indexed `by_quiz_id` (for a quiz's deletion) and read by id. Ids rather than labels:
  a label changes on a relabel, which would rewrite the quiz row, and a question's query is
  asked by id, so a label would cost a lookup per row. `quizzes.open` is now the quiz's frame
  (its fields, that order, its widgets and columns) and `questions.open` one question with its
  bots' newest replies; `useQuiz` (`state/use-quiz.ts`) assembles them with the server's own
  projection (`quizFromSeen`), holding the quiz last read whole while a question just added is
  on its way, and the history feed follows a watch per question. **This goes against the plan's
  settled item 6 and the "never a query per row" lines** in the plan, `notes/stack.md`'s history
  and `notes/decisions/2026-09-convex.md` (*Rules that follow*, and "a parent's children through
  the parent's index"). The Coach is reviewing that guidance and asked for it to be left as it
  stands and not followed: the code, not those lines, is current.
* **Every action reads what it needs**: the quiz row, and the questions it names by id, for an
  edit, a chain, a bot's reply, an add or a retitle; the layout alone for a widget or column;
  the questions for a move, a renumbering or the chain order, and their bots' replies too only
  for a sort; the whole quiz only for a quiz replaced or deleted. A test holds the order to
  naming every question of the quiz exactly once, whatever the actions do.
* **The hunt listing leaves out each quiz's `row_ordering`**: it is the quiz's own screen's.

* **No optimistic updates** (phase 4). The plan named four candidates for where the wait is
  felt; measured on a local backend, none is (*Measurements*). The cloud's round trip decides;
  `move_question` goes first, through `Rank`'s pure functions. Recorded in the verdict.
* **The Export box reads the whole hunt when asked** (*Prepare export*), and empties at the next
  change on screen, anyone's included. The phase 2 deviation below asked again after every
  change on every open screen; measured, that was the app's largest cost (half of what each
  browser downloaded, nearly two fifths of database I/O), so the plan's alternative is built.
* **The widgets table is a union** of the two kinds, derived by `zodOutputToConvex` from
  `WidgetValidators.row`, now a discriminated union. `writeQuiz` replaces a widget whose label now
  names the other kind, since a patch cannot unset the old kind's fields.
* **`BottingT` is a row's fields**, `RecordedBottingT` those and `_creationTime`; a cell's
  `SlotLatest` holds the rows the walk read. `latestBySlot`, `bottingFrom` and
  `bottingFieldsOf` are gone (the "not done" entry below is done).
* **`SyncLog` is gone** (the Coach, `ca2c63f`): Convex's client exposes nothing cheaply worth
  logging.
* **`pnpm start:agent`** (3004) serves the agents' production build, for measuring.
* **`scripts/convex_dev --reset` empties and pushes again** when a schema change refuses the push.

* **The export is asked for again whenever the screen changes**, not once. *Superseded in phase
  4: asked for on request.* The Export box has no
  opening to hang "once" on (it is always on screen), and an export a step behind the author is
  a backup that silently misses their last edits. `useWholeHunt` asks `hunts.whole` with a one-shot
  query each time the shallow hunt or the open quiz is redelivered; never subscribed. Its cost is a
  whole-hunt read per change, which phase 4 should measure (bandwidth); a button that prepares
  the export on demand is the cheaper alternative if it shows.
* **The expression preview subscribes to another quiz while it is pointed there.** It could pick
  any quiz of the hunt, whose questions the shallow hunt no longer carries; `useOtherQuiz`
  subscribes to `quizzes.open` for the picked quiz while the dialog shows it (none for the open
  quiz, already on screen).
* **A new quiz is gone to once it has been made** (`carryOut` on `HuntHandle`, which resolves
  whether that one change was kept). Going at once showed "No such quiz" for a round trip; a
  refused one now stays on the page with its notice.
* **The address follows its quiz when it is relabelled**, here or by anyone else (`movedTo` on
  `HuntHandle`, from `placeIn`, which keeps placing the quiz last shown at an address once it
  answers to another label). The gear's Apply no longer navigates itself. Found by the phase's
  `/code-review`: navigating after the relabel landed left a moment of "No such quiz", which
  unmounted the editor and paused the history feed.
* **The mirror is fed by watches, not renders** (`useHistoryFeed` in `use-hunt`). Convex's client
  calls a watch's listeners before it resolves the mutation that caused the change (checked in
  `browser/sync/client.js`, 1.46.0), so a milestone or marked change waiting on
  `writesLanded()` sees its edit noted. `mirrorQuiz(before, after)` replaces `mirrorHunt`;
  `openHistory` runs for the open quiz only.
* **A hunt label that cannot be one is not asked about** (`use-hunt`): `hunts.open` refuses it as
  an argument, and `useQuery` throws what a query throws.
* **`pnpm dev` changed too**, to `scripts/convex_dev dev --watch next dev`: the human's server
  needs a backend now, on 3400 as before. Nothing else of the human's was touched.
* **`Hunt.expressionUsage`, `Hunt.realmFor` and `Realm.quizFor` are gone**: the expressions arrive
  counted, and `placeIn` (`use-hunt`) places an address in the shallow hunt with
  `Labelmaker.entityForLabel`.
* **Not done (done in phase 4): `BottingT` keeps `id` and `created_at`, and `latestBySlot` stays** (now used only by
  `resultsFor`'s tests). With Jazz gone nothing needs either; dropping the minted `id` and
  building the tests' `latest` maps by hand is a small sweep, left for phase 4.

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

### Phase 5

* **A mutation that schedules itself and a script that loops over it race.** Two `clearAll`s at
  once delete the same documents; Convex retries the loser and, still conflicting, fails it with
  `OptimisticConcurrencyControlFailure`. One driver, not two (see *Deviations*).
* **Nothing else surprised.** A table, two indexes, two actions and a joined read went in as the
  plan wrote them; `_generated/` did not change (no new module), and the canary test asked for the
  new table before anything else did.

### Phase 4

* **Convex reruns a query whose read set changed, but sends nothing when the result is the
  same.** A reorder writes the quiz row, which `hunts.open` reads (as every quiz row of the
  hunt); with `row_ordering` left out of its result, it reruns (about 10 KiB of I/O) and
  delivers nothing.
* **Per question, a text edit costs about 3 KiB** of database I/O with a second browser
  watching, down from 46: the mutation reads the quiz row and the question, and only that
  question's query reruns. A move still costs about 45 KiB: it reads every question for their
  Q#s, and reruns the frame and `hunts.open`.
* **A new question takes a second round trip to appear**: the frame names it, then its own
  query is asked for. The first paint of a quiz likewise takes one more.
* **`useQueries` hands back the same object until one of its queries changes**, so a `useMemo`
  over it and the frame holds still between unrelated renders.

* **The backend's function log is the bill.** `convex logs --jsonl --success` gives every
  execution's `usageStats` (database I/O read and written, documents read), its `returnBytes`,
  and whether it was served from the cache. The stream repeats entries (the same `executionId`
  two to four times): count each once.
* **A cache hit costs no database I/O.** A second browser's rerun of `quizzes.open` after an edit
  is served from the cache; the plan's appendix could only guess. Whether it is a billed call,
  nothing official says.
* **Database I/O binds, not calls**: about 46 KiB per edit on the sample-sized quiz, half of it
  `hunts.perform` reading the whole open quiz for every action, half the one uncached rerun of
  `quizzes.open`.
* **On a large quiz the wait is the page's, not the network's.** At 60 questions a reorder shows
  after about 200 ms against a 50 ms round trip; a CPU profile puts most of the rest in
  `Expressed.forQuiz` (every expression widget for every question, in JSONata) re-run on each
  redelivery from `Workbench`'s `useMemo`.
* **A fresh tab takes three round trips to show its quiz**: the socket, `hunts.open`, then
  `quizzes.open`, which waits for the labels to resolve to an id.
* **`zodOutputToConvex` derives a union table** from a discriminated union, and `defineTable`
  types it; `Doc<'widgets'>` narrows by `kind`.
* **A schema push validates every document** and refuses the whole push for one that no longer
  fits, before `testing.clearAll` could empty it: hence `--reset`'s retry.
* **Convex's client runs under Playwright's fake clock** (`quiz-history.spec.ts`).

### Phase 2

* **The round trip shows in the e2e suite, and only where a spec relied on a write landing in the
  same instant**: forcing an edit past a lock before the lock landed, focusing a cell before the
  clueing that enables it landed, reading the Sheets and Export boxes the instant after an edit,
  clicking the gear before a relabel's navigation, and pausing the page's clock before an edit
  armed the commit timer. Six specs, each now waiting on the state
  its next step needs. The suite runs in about 25 s a shard, against minutes under Jazz.
* **A refusal reaches the screen**: the full suite's 100th hunt was refused with "The app holds
  at most 99 hunts." on the hunts page, exactly as `RefusalNotices` words it.
* **`convex env set` and `convex run` take no `--env-file`**; they read
  `CONVEX_SELF_HOSTED_URL` and `_ADMIN_KEY` from the environment, so the scripts export the two
  from `cli.env`, read line by line. A `CONVEX_DEPLOY_KEY` in the environment wins over them, and
  the CLI then asks for a cloud key.
* **`useQuery` throws a query's error into React**, so an argument a query would refuse must be
  kept from it (the hunt label, above).

### Phase 1 and before

All `convex` 1.46.0, `convex-helpers` 0.1.124, `convex-test` 0.0.60, local backend
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

**Phase 4** (2026-09-28): the numbers, and what they mean for the bill, are in
`notes/database-decisions.md` (*Appendix*, *Measured*). In brief, on a local backend with a
production build, a 24-question hunt and a second browser watching:

| | Local | 80 ms network | 200 ms network | Local, 60 questions |
|---|---|---|---|---|
| Reorder, until shown (median ms) | 84 | 165 | 310 | 202 |
| Lock, until shown | 70 | 152 | 284 | 174 |
| Quiz on screen, fresh tab | 225 | 400 | 670 | 430 |
| Database I/O per edit | 46 KiB | | | 110 KiB |
| Function calls per edit (uncached) | 3.7 (2.2) | | | 3.7 (2.2) |

After the order moved onto the quiz and each question became a query (same session and hunt):

| | Local | 80 ms network | Local, 60 questions |
|---|---|---|---|
| Reorder, until shown (median ms) | 92 | 170 | 209 |
| A text commit, until saved | 60 | 140 | 180 |
| Add a question, until shown | 115 | 261 | 228 |
| Quiz on screen, fresh tab | 235 | 495 | 482 |
| Database I/O per edit (this session's mix) | 32 KiB | | 54 KiB |
| Downloaded per edit, each browser | 5.2 KiB | | 7 KiB |
| Function calls per edit (uncached) | 10.1 (4.2) | | 16.9 (5.1) |

By action, locally, with the reruns each causes: a text edit 3 KiB (was 46), an add 25 (45), the
lock 24 (34), a sort 51 (80), a move 45 (45).

How: a Playwright script (kept out of the repo) drove the app through the Import box and five
kinds of edit, proxied the Convex websocket to log every frame and to delay each message for the
simulated networks, and read the backend's function log (`convex logs --jsonl --success`) for
the server's side. A quiz screen holds four live queries (`idents.current`, `hunts.open`,
`quizzes.open`, `reviews.forQuiz`); the expression preview adds `useOtherQuiz`'s while it points
at another quiz. None per row. Redo these against the cloud in phase 3b; ask the Coach for the
script if it is wanted in the repo.

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

* **Phase 5, two behaviours to confirm** (built as the plan says; the review pass raised them):
  - A draft review's reviewings reach every browser on the quiz, the smith's included, and only
    `sharedReviewsOf` keeps them off screen; as with `overall`, phase 7 moves the rule onto the
    server.
  - A flag toggle sends the opposite of what the screen shows, so two clicks inside one round
    trip send the same value twice. The lock works the same way; both are candidates if
    optimistic updates are taken up.

* **Jazz's leftovers** are gone (the Coach removed `public/jazz/`, the `jazz` skill and the
  `data/jazz*/` directories, 2026-09-28), bar a few Doppler variables: `JAZZ_DEV_DATA_DIR` and
  `JAZZ_DEV_PORT` in `dev_claude` and `dev_e2e`, and `NEXT_PUBLIC_JAZZ_APP_ID` and
  `NEXT_PUBLIC_JAZZ_SERVER_URL` in `dev_claude`. Nothing reads them.
* **The `.env.local`** at the checkout root is the CLI's: every push (`convex dev --once`, so
  every `scripts/convex_dev` run) rewrites it with the backend it pushed to last. Git ignores it
  and the environment's `NEXT_PUBLIC_CONVEX_URL` wins over it, so it is harmless; there is no
  flag to stop it (checked, 1.46.0). Nothing for you to do.
* **The stale `.next*/` route types** (`.next/dev/types/validator.ts` and the agents' and e2e's)
  name the pages as they were before the `(synced)` route group and fail `pnpm typecheck` until
  a dev server in that directory regenerates them. Yours regenerate on your next `pnpm dev`.

* **The verdict** (`notes/database-decisions.md`, *Verdict*, and `notes/decisions/2026-09-convex.md`)
  is written for your word: keep Convex.
* **The "never a query per row" guidance** is yours to review (left as it stands, not followed).
* **One open choice about the order**: kept on the quiz row as asked, a move, an add or a sort
  reruns `hunts.open` (about 10 KiB of I/O, nothing resent). Its own one-row-per-quiz table
  would spare that, at the cost of one more document per quiz.
* **Doppler**: `NEXT_PUBLIC_CONVEX_URL` is in `dev_claude` and `dev_e2e` (done, thank you);
  `scripts/convex_dev` sets it from the role anyway, so `dev` needs nothing new. Nothing reads
  these any more, and they can go: `JAZZ_DEV_PORT`, `JAZZ_DEV_DATA_DIR`, `JAZZ_REAL_DB`,
  `JAZZ_ADMIN_SECRET`, `JAZZ_ADMIN_SNIPPET`, `NEXT_PUBLIC_JAZZ_SERVER_URL`,
  `NEXT_PUBLIC_JAZZ_APP_ID`, `NEXT_PUBLIC_JAZZ_RUNTIME_VERSION`, `NEXT_PUBLIC_JAZZ_LOG_LEVEL`.
* **Containers need no Convex key each.** A local backend needs no account; each role's admin
  key is minted from a secret made in its own data directory. Only phase 3's cloud deployments
  have keys (production for the Coach, preview for Vercel), and agents never hold the
  production one.
* **Before phase 3** (unchanged from the plan): a Convex team and project, the production and
  preview deploy keys, and Vercel's build command.

## 8. Deleted tests and their successors

Phase 0 added `tests/convex/spike-bridge.test.ts` and `tests/convex/spike.test.ts`; phase 1
deleted both with the spike, and `tests/convex/schema.test.ts` (the canary) and
`tests/convex/hunts.test.ts` (the refusal in our words) cover what they held.

Phase 2 deleted the Jazz tests with their modules. Their successors, all green:

| Jazz test (deleted in phase 2) | Successor |
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
| `tests/models/actions.test.ts`'s "takes whatever a view already says" | none needed: the views say `HuntActionDNA` itself now |
| `tests/models/hunt.test.ts` (`Hunt.realmFor`, `Hunt.expressionUsage`) | `tests/state/use-hunt.test.ts` (`placeIn`); `tests/convex/writing/layout_actions.test.ts` (`expressionUsageOf`) |
| `tests/models/realm.test.ts` (`Realm.quizFor`) | `tests/state/use-hunt.test.ts` (`placeIn`) |
| `e2e/client-first.spec.ts` (the network off) | the same file: every host but the app's and its database's blocked, and asking blocked |

Phase 4 deleted these, each with a successor, all green:

| Test (deleted in phase 4) | Successor |
| --- | --- |
| `tests/models/botting.test.ts`, `latestBySlot` (five cases) | `tests/convex/reading.test.ts` (the walk: newest, newest answered, cells kept apart) and `tests/lib/rows.test.ts` (`slotLatestOf`) |
| `tests/lib/rows.test.ts`, `bottingFrom` | `tests/models/botting.test.ts` (`resultsFor` reads `_creationTime` in whole milliseconds) |
| `tests/convex/writing/quiz_writing.test.ts`, `bottingFieldsOf` | none needed: the insert is `BottingValidators.row` of the botting, covered by `writeQuiz`'s cases |
| `tests/lib/rows.test.ts`, `widgetFrom` throws for a row lacking its kind's fields | none possible: the union table cannot hold one |
| `tests/models/widget.test.ts`, "an expressing that also names a bot", "a botting that also names an expression" | the same file: the other kind's fields are dropped, and the table has no place for them |

Phase 5 replaced one, with a successor, green:

| Test (replaced in phase 5) | Successor |
| --- | --- |
| `tests/convex/testing.test.ts`, "hands what one run cannot delete to the next" | the same file, "deletes a batch of a table a run, leaving the rest for the next, and says none once empty" |
