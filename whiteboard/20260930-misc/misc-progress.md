# Sprint misc: progress

The running handoff. It is newer than `misc-plan.md` wherever the two disagree. Workers add
their sections newest first, below the status table.

**Status:** done -- threads 1 to 6 complete and reviewed. #58 and #60 merged; #61 <- #63 <- #64 <- #65 open, stacked.

| # | Thread | Status | Branch | PR |
|---|--------|--------|--------|----|
| 1 | Chai in vitest: what's missing | complete | `20260930-chai_in_vitest` | #58 |
| 2 | Hard-to-miss alert for major problems | complete | `20260930-failure_snackbar` | #60 |
| 3 | e2e against a production build | complete | `20260930-e2e_built` | #61 |
| 4 | Formulas see the smith's note, hunt and realm | complete | `20260930-formula_exposure` | #63 |
| 5 | Uniformly chai: `.to.be.true`, lint that allows it | complete | `20260930-chai_property_style` | #64 |
| 6 | CI runs the built suite in place of the dev suite | complete | `20260930-ci_built_e2e` | #65 |

*Orchestrator:* the Coach overruled thread 1's recommendation: the house style is chai's
property form (`.to.be.true`, `.null`...). Thread 5 swaps the lint rule and sweeps the tests.
Until it lands, `.to.eq(true)` still passes lint -- thread 4 writes it that way and thread 5
converts it.

*Orchestrator:* #54 merged mid-sprint; the stack now rests on `main`. A thread that adds e2e
specs runs them under both servers: `pnpm test:e2e:agent` (dev, 3003) and `pnpm
test:e2e:built` (the optimized build, 3005). Neither is the shared `pnpm test:e2e` port.

## Thread 6: CI runs the built suite in place of the dev suite (2026-09-30)

Branch `20260930-ci_built_e2e`, PR #65, stacked on #64. Suites: typecheck and lint clean, unit
2269/2269, e2e 193/193 under `pnpm test:e2e` (the finishing suite, dev). The CI mode passed locally
too: 193/193 on the `e2e` role at a quiet port. **CI on #65 is green**: all six shards passed
against the build (208 runs, the setup included, none flaky or retried).

* **Built**: `TRIQUET_E2E_SERVER: built` in the `e2e` job's env (`.github/workflows/ci.yml`),
  replacing the dev run. The port, backend and build directory are still the `e2e` role's.
  The comments above the job and its env are rewritten. Two comments in `playwright.config.ts` and
  the warm-up comment in `e2e/environment.setup.ts` no longer assume a dev server. A new case in
  `tests/e2e/environment.test.ts` pins that CI's env with `built` draws no complaint. Docs:
  `notes/testing.md` (the built run's paragraph says CI uses it, on the `e2e` role),
  `notes/stack.md` and `notes/deploy.md` (what CI runs e2e against).
* **Decisions taken**:
  - **Nothing to loosen.** Thread 3 kept the mode (`TRIQUET_E2E_SERVER`) and the role
    (`CONVEX_ROLE`) apart. Only the `test:e2e:built` script sets them together, so the `e2e`
    role takes `built` as it is. No code in `e2e/environment.ts` changed.
  - **No build-once artifact.** Measured on CI: the build takes about 30s per shard (backend
    empty at 20:03:42, first spec at 20:04:14 on shard 1), and the warm-up visit drops from 4.9s
    to 1.6s. The Playwright step per shard went from 1:27-2:36 (dev, #64's run) to 1:34-1:53
    (built): 10:19 in all against 12:54. The build pays for itself, so sharing one isn't worth the
    workflow machinery yet.
  - **No `test:e2e:ci` script.** To run what CI runs, locally:
    `scripts/doppledo dev_e2e env PORT=<quiet port> TRIQUET_E2E_SERVER=built pnpm exec playwright test`.
    With `CI=true` and the job's env alone (plus `PLAYWRIGHT_BROWSERS_PATH` in this container),
    it runs one worker with a retry, exactly as a shard does.
* **Discoveries**:
  - **Two shards took 6 and 9 minutes**, all of it in `playwright install --with-deps chromium`
    (apt), 4 and 6.5 minutes against about 20s on the others. It's the runner, not this change, and
    it's worth watching: the job's `timeout-minutes: 20` leaves room, but an apt stall could eat it.
    Caching the browser (`~/.cache/ms-playwright`, keyed on Playwright's version) would take most of
    that step off the table. Not done: not asked.
  - Playwright's `webServer` drops the server's stdout, so `next build`'s own output isn't in the
    CI log. Only Convex's lines (stderr) show. Set `stdout: 'pipe'` if you ever need the build's
    route table in a failed run.
  - The first push needs git_hygiene's borrowed-credential form, since the branch had no upstream
    (`git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push -u`).
* *Review:* **clean**, nothing fixed, nothing left. Confirmed CI's env draws no complaint, that
  the `webServer` is never reused on CI and its 480s timeout covers each shard's build, and
  that `NEXT_DIST_DIR` governs both the build and the start. All 12 checks on #65 green.
* **For the Coach**:
  - **The local finishing suite** (git_hygiene's `pnpm test:e2e`) is unchanged: dev mode, as
    asked. Now a PR sees dev mode locally and the build on CI. Should the finishing line switch to
    `pnpm test:e2e:built`, or run both? Running both adds about a minute locally.
  - Thread 3's CLAUDE.md note still stands: *Global resources* lists the roles without
    `e2e-built`.

## Thread 5: Uniformly chai: the property style, with lint that allows it (2026-09-30)

Branch `20260930-chai_property_style`, PR #64, stacked on #63. Suites: typecheck and lint clean, unit 2268/2268, e2e 193/193 under `pnpm test:e2e` (the thread touches no e2e spec or app code).

* **Built**:
  - **Lint** (`eslint.config.mjs`, a new block `triquet/tests-chai` after `triquet/tests`):
    `vitest/valid-expect` off; `eslint-plugin-chai-expect` 4.1.0 with all five rules
    (`missing-assertion`, `no-uncalled-method`, `terminating-properties`, `no-inner-compare`,
    `no-inner-literal`); `eslint-plugin-chai-friendly` 1.2.1's `no-unused-expressions` in place of
    the blanket `@typescript-eslint/no-unused-expressions: off`. Both run on ESLint 10.10 under
    flat config: chai-expect's peer range is `>=2 <=10.x`, chai-friendly's `>=3`, neither calls
    an API ESLint 10 removed, and neither adds a peer warning (`pnpm peers check` shows only
    the three it showed before).
  - **The method list** (`ChaiMethods`) and the extra terminators (`ChaiTerminators`) were read
    out of vitest's own `chai.Assertion.prototype` with a throwaway test (methods, chainable
    methods via `__methods`, and getters), not written from memory. `ChaiMethods` is chai's
    methods and chainable methods, vitest's chai-style spy methods, and the five Jest matchers
    the tests use or testing.md allows. Every name the tests call is on it (surveyed by walking
    the tests' ASTs: 27 distinct names).
  - **The sweep**: 166 assertions in 45 test files, `.to.eq(true|false|null|undefined)` to
    `.to.be.*` and `.to.not.eq(null)` to `.to.not.be.null`, by `sed`, diff reviewed. `e2e/` had
    none (Playwright's `expect` has no chai interface). No match sat after `resolves`/`rejects`.
  - **Docs**: `notes/testing.md` (the property form for the four literals, the lint behind it,
    the list a new method joins, and why a property never follows `resolves`), `notes/stack.md`
    (both plugins, under *Testing*), and a *Since* line atop `chai-in-vitest.md`.
* **Guards proved** with a throwaway test, linted, typechecked and run, then deleted:
  - `expect(x).to.eq`, `.to.deep.equal`, `.to.include`, `.to.be.a` left uncalled: caught by
    `chai-expect/no-uncalled-method`.
  - bare `expect(x)`: caught by `chai-expect/missing-assertion`.
  - `.to.be.true()`: caught by `terminating-properties` and by tsc.
  - `expect(x === 3).to.be.true`: caught by `no-inner-compare`.
  - unawaited `expect(p).resolves.to.eq(3)`: still caught, by `no-floating-promises` and
    `sonarjs/async-test-assertions`.
  - a bare do-nothing expression (`value + 1`): caught by `chai-friendly/no-unused-expressions`,
    which the old blanket `off` let through. A small gain.
  - `expect()` with no argument: caught by tsc.
* **What the new setup no longer catches**: an uncalled method that is **not** on `ChaiMethods`,
  such as `expect(x).to.be.toSatisfy`. That means a Jest matcher (testing.md forbids most of
  them anyway) or a chai method added by a plugin we do not have. `valid-expect` caught these;
  now a new one must be added to the list.
* **Decisions taken**:
  - **Its own config block**, `triquet/tests-chai`, rather than more rules in `triquet/tests`,
    so the valid-expect swap and its reasons read as one unit.
  - **The whole registry, not just the tests' 27 names**, on `ChaiMethods`. The plan said to
    derive from the tests; I derived from vitest's registry, which covers every name the tests
    call and every other name they could reach for. That makes the "must remember to add it"
    gap as small as it can be. The Jest matchers are left off, apart from the five in use.
  - **Two tag-order tests in `tests/lib/quizgit.test.ts`** said `expect(earlier < later).to.eq(true)`,
    which `no-inner-compare` now refuses. Its suggested `to.be.below` throws on strings, and
    `.toSorted()` trips `sonarjs/no-alphabetical-sort`. They now assert
    `expect(earlier).to.not.eq(later)` and `expect(_.sortBy([later, earlier])).to.deep.eq([earlier, later])`,
    which is the test's own title, "sorts as text".
* **Discoveries**:
  - **`sonarjs/no-incomplete-assertions`** (from `sonarjs.configs.recommended`, on all along)
    already reports an uncalled `.to.eq` and a bare `expect(x)`. So each of those two mistakes
    has two guards, and thread 1's table was wrong to say only `valid-expect` catches them.
    Keep chai-expect all the same: sonar's list is its own, and chai-expect's is ours to extend.
  - `no-inner-literal` refuses `expect(null)` and similar literal subjects. None in the tests.
* *Review:* **clean**, nothing fixed. The reviewer re-derived all 164 swept lines mechanically
  and matched them exactly (57 false, 54 null, 43 true, 10 undefined, 2 `.not.be.null`); no
  `.not` flipped, nothing under `.deep` touched. It confirmed from chai-expect's source that
  `ChaiMethods` and `ChaiTerminators` add to the plugin's defaults. Left, minor, already
  recorded: an uncalled method off the list, a chain stopped mid-sentence (`expect(x).to.be`),
  and a property after `resolves`/`rejects` all go unflagged.
* **For the Coach**:
  - **Two installs, Library-first**: `eslint-plugin-chai-expect` and `eslint-plugin-chai-friendly`,
    dev-only and lint-only, listed in `notes/stack.md`.
  - **Not asked for, and left as they are** (thread 1's table): an empty collection (`.to.have.length(0)`,
    `.to.deep.eq([])`, `.to.eql({})` and the like: about 84 lines) to `.to.be.empty`, which
    is looser (it passes any empty array, string, object, Set or Map), `.to.have.callCount(n)` to
    `.called`/`.calledOnce`, and the 10 Jest-style spy matchers (`toHaveBeenCalledOnce`,
    `not.toHaveBeenCalled`, `toHaveBeenCalledWith`) to chai's `.calledOnce` /
    `.not.called` / `.calledWith`. Should any of them follow the property style? Each is a
    `sed` and a reviewed diff; lint allows them now.

## Thread 4: Formulas see the smith's note, the hunt and the realm (2026-09-30)

Branch `20260930-formula_exposure`, PR #63, stacked on #61. Suites: typecheck and lint clean, unit 2268/2268, e2e 193/193 under each of `pnpm test:e2e`, `pnpm test:e2e:agent` and `pnpm test:e2e:built`.

* **Built**: a formula reads `quiz.smiths_note`, `hunt.label`, `hunt.title`, `realm.label` and
  `realm.title`.
  - `Quiz.exposed` gains `smiths_note`. `Hunt.exposed` and `Realm.exposed` are new, each
    `['label', 'title']`.
  - `Expressed.placeOf(hunt, realm)` makes a quiz's **place**, `Expressed.QuizPlace`: each label
    the one in force, each title as shown (a blank one reads as its label titleized), no ids.
    `forQuiz` and `bagsFor` take it. The callers are the grid (`Workbench`), the expression
    editor's preview (`ExpressionFields`, which also folds out `hunt` and `realm` in *The input
    the formula reads*), the server's sort (`quiz_actions.sortQuestions`, which now reads the
    hunt and realm rows), and the quiz history.
  - The history's old `Quizgit.QuizPlace` (two label strings) is gone. The mirror snapshot
    carries the new place, and the paths are filed by its labels exactly as before.
  - `quiz-bag.ts`: `bagQuiz`, `bagHunt` and `bagRealm` are picked from the models' row
    validators by their `exposed` lists, as `bagQuestion` already was. So the JSON Schema
    follows the lists, and hiding a field stays one edit.
  - Docs: the formula's `.describe()` in `expression.ts`, the chatbot prompt's input section, and
    `notes/vocabulary.md` (*smith's note*, *bag*, and the *place*).
  - Tests: `placeOf`, the bag and its schema, formulas reading each new field (and not `_id`),
    the server's sort by a column that reads the hunt, and one e2e spec
    (`e2e/expressions.spec.ts`, *a formula reads the smith's note, and the hunt and realm the
    quiz sits in*).
* **Decisions taken**:
  - **Where they sit in the bag**: `hunt` and `realm` are top-level keys beside `quiz`, and the
    note is `quiz.smiths_note`, not a key of its own.
  - **Titles as shown, never blank.** A hunt or realm with no title of its own gives its label
    titleized, which is what the screen shows. The quiz's `title` is left as stored, as it was.
  - **One place for formulas and the history.** A hunt retitle now counts as the quiz having
    moved for its history (`_.isEqual` on the place). That is correct: a column reading
    `hunt.title` changes the history's TSV.
* **What a bot is now shown**: nothing new. The four templates in the *Prompts used* panel put
  one question's clueing or hint to a bot and never see the bag. The one prompt that does
  change is *Copy prompt for a chatbot* in the expression editor. Its JSON Schema now has
  `hunt`, `realm` and `quiz.smiths_note`, with their descriptions, and one sentence names them.
  Its sample is only `qn`, so the note's own text never goes into the prompt.
* **Discoveries**:
  - **I found this thread already built.** Two commits (the code, and the vocabulary) were on
    the branch at 11:01 with no syndication, most likely from an earlier worker that stopped
    before reporting. I reviewed them, took them as mine, and folded in one change:
    `placeOfOpen` reads the hunt and the realm with `Promise.all`, as `authorize.ts` does.
  - **The finishing rebase.** Main had moved: #59 (the grid folds) and the merge of #60. A
    plain `git rebase --update-refs origin/main` replayed threads 1 and 2's commits. They were
    already on main, but the pre-thread rebase over #57 had changed their patch-ids, so git did
    not recognize them, and HUMAN-whatsup entries were duplicated. I aborted and ran
    `git rebase --update-refs --onto origin/main aaf77a9` (thread 2's last commit) instead.
    That replays only threads 3 and 4 and the orchestrator's commits. It moved
    `20260930-e2e_built` locally (not pushed) and dropped the orchestrator's #57 conflict
    repair from the stack, since main's own merge of #60 now stands in for it. Local tag
    `prerebase/20260930-formula_exposure` marks the tip from before the rebase.
  - **A formula that reads the note puts it into a column.** From there it reaches the sheets
    export and the history's TSV. The note already travels in Raw Export and the history's
    JSON, so nothing leaves that did not before. The review screen shows reviewers the note
    itself and no computed columns.
  - HUMAN-whatsup's entry *A smith's note beside the quiz's name* still says formulas don't see
    the note. That entry is now stale; I left it as written.
* *Review:* **fixed**, one kept (99fb014): a doc comment stranded above the wrong function in
  `tests/state/commit-scheduler.test.ts` when `Here` moved to `tests/support/places.ts`. Left,
  minor: `ExpressionFields`' preview shows nothing while a just-made quiz is missing from
  `hunt.realms`, and it recovers on its own.
* *Orchestrator:* "already built" is almost certainly the orchestrator's first thread-4 spawn,
  which the Coach interrupted: it had committed before the interrupt landed. #58 and #60 have
  since merged. The orchestrator pushed the rebased `20260930-e2e_built` (#61) with a lease.
* **For the Coach**: **which other elements deserve exposure?** A proposal only; none of these
  is built.
  1. **Review aggregates per question**: how many reviews, the mean get rate, how many flag *needs
     fact check*, *elimination candidate* or *keep it*, and the median minutes. The tool's second
     job is judging fairness and difficulty. A column such as "hard: get rate under 30%" is
     what expressions are for. The catch: which reviews a viewer may read depends on who they
     are (`mayReadReview`). A column must count the same set for everyone, the shared reviews,
     or two smiths see different values and the server's sort matches neither. Aggregates only:
     never who reviewed, and never their comments or guesses.
  2. **The other quizzes of the realm and the hunt**: their labels and titles, and their questions'
     `label`, `qnum` and `full_answer`. Metas are why the tool exists. A hunt-level meta draws on
     every quiz's answers, and today a formula sees only its own quiz. This is worth a thread of
     its own: the bag grows with the hunt, the screen and the sort must read every quiz's
     questions, and a column recomputes whenever any sibling quiz changes.
  3. **The quiz's position in its realm** (its index among the realm's quizzes, and how many
     there are). Cheap. It supports "Round 3 of 8" and ordering a meta's pieces, and it comes
     free with item 2.
  4. **The expressing's own label** (maybe). One expression could then serve several columns
     that differ only by label, like a recipe with a parameter. Cheap. Whether that is wanted
     is a design question.
  5. **The quiz's `version`** (low). An export column could stamp the draft ("v3").

  Not recommended:
  - **The lock state**: it is housekeeping about editing, not content. The header already
    shows it.
  - **The hunt's members**: who is on a hunt says nothing about its questions, and exposing it
    would put people's names into exports and histories.
  - **Position or rank**: already exposed. `qn.rank` is the 1-based place in Q# order (null
    without a Q#), and `qns` is in the quiz's order.

## Thread 3: e2e against the optimized build (2026-09-30)

Branch `20260930-e2e_built`, PR #61, stacked on #60. Suites: typecheck and lint clean, unit
2242/2242, e2e 187/187 under `pnpm test:e2e` (dev) and 187/187 under `pnpm test:e2e:built`.

* **Built**: `pnpm test:e2e:built`, the whole e2e suite against `next build && next start`.
  - A new Convex role, `e2e-built`: web 3005, backend 3405/3505, `data/convex-e2e-built/`, build
    in `.next-e2e-built`. It is in `scripts/convex_backend`, `convex_dev`, `convex_reset`,
    `convex_healthcheck`, and in `tsconfig.json`'s includes.
  - `e2e/environment.ts`: `ServerCommandFor` (`dev` gives `next dev`, `built` gives
    `sh -c "next build && next start"`), `serverOf(env)` (reads `TRIQUET_E2E_SERVER`, `dev` when
    unset), a complaint for an unknown mode, and the `e2e-built` backend URL. Port 3004
    (`start:agent`) is now among the ports the suite may not take.
  - `playwright.config.ts`: the webServer command follows the mode. `reuseExistingServer` is
    never on for `built`. The timeout is 480s for `built`.
  - Docs: a paragraph in `notes/testing.md` (End to End), and the role in `notes/deploy.md`.
* **Decisions taken**:
  - **Mode by variable, not by role.** `TRIQUET_E2E_SERVER=built` chooses the server, and
    `CONVEX_ROLE` chooses the backend. The script sets both.
  - **Never reuse a built server.** This closes the trap for this run: a server found on the
    port refuses the run. Each run builds, which took about 10s here.
  - **The build happens inside Playwright's webServer**, under `scripts/convex_dev`, so the
    `NEXT_PUBLIC_*` values it bakes in are the e2e run's.
* **Discoveries**:
  - **The whole suite already passes under the build.** No spec needed changing, and the review
    fix from 2026-09-29 holds. A full run takes about 1 minute, against 1.6 minutes for the dev
    run.
  - **Only the pages are prerendered at build**: `/`, `/about`, `/my/hunts` and the icons.
    `/api/ask` and `/api/bots` stay dynamic. Both guards read `process.env` per request, and a
    built server started by hand declined an unstubbed ask ("switched off").
  - **`lsof` can miss a listener in this container.** A `next-server` of mine outlived its
    shell and held 3005 while `lsof` said nothing. The built run refused it, as designed.
    `ps -eo pid,args | grep next-server` finds such a server.
  - **Thread 4:** a spec must pass under both servers. Run `pnpm test:e2e:built` beside
    `test:e2e:agent` if a thread adds specs.
* *Review:* **clean**, nothing fixed. Left, minor: the built command is `sh -c "next build &&
  next start"`, so `next start` is a grandchild that `convex_dev`'s EXIT trap doesn't reach;
  Playwright kills the whole process group, so nothing is orphaned. `&& exec next start` would
  harden it (on #61).
* **For the Coach**:
  - **Should the finishing suite and CI run it?** A proposal, not a decision:
    - Locally, add `pnpm test:e2e:built` to git_hygiene's finishing line. Dev mode catches
      impure effects; the build catches what dev mode hides.
    - On CI, the built server may suit the small runners better than the dev server, which
      compiles each page on first visit. Add `TRIQUET_E2E_SERVER: built` to the e2e job's env,
      either replacing the dev run or as a second matrix axis.
  - **CLAUDE.md** is stale in two places, which I left for you. *Global resources* lists roles
    as `<dev|agent|e2e|e2e-agent>` (add `|e2e-built`), and it could name the run: "`pnpm
    test:e2e:built` (the optimized build, port 3005)".
  - **The dev run's reuse trap** (HUMAN-whatsup, 2026-09-27) is unchanged, and it is still yours.

## Thread 2: A hard-to-miss alert for major problems (2026-09-30)

Branch `20260930-failure_snackbar`, PR #60, stacked on #58. Suites: typecheck and lint clean,
unit 2237/2237, e2e 187/187 (run on the `e2e-agent` role, `pnpm test:e2e:agent`).

* **Built**: an **alarm**, the app's one surface for a failure the author has to see.
  - `src/lib/alarms.ts`: `AlarmT` (headline, notice, request_id) and `Alarms.of(headline, err)`.
  - `src/state/alarms.tsx`: `AlarmsProvider`, `useRaiseAlarm()` (the seam) and `useAlarm()`.
    These are the codebase's first React contexts. There are two of them, so a hook that only
    raises doesn't re-render when an alarm comes or goes.
  - `src/components/AlarmSnackbar.tsx`: MUI `Snackbar` plus a filled error `Alert`, fixed at the
    bottom centre. It is dismissed only by its close button.
  - `Providers` (`src/app/providers.tsx`) mounts both around every page.
  - Fed by `useHunt`: every refused change, plus a change not sent because the quiz wasn't open
    yet. That case used to be a console warning only.
  - `carryOut(action, { quietly: true })` opts out; AddMember uses it.
  - Failed `AccountOutcome`s carry an `alarm`, which `HuntsList` raises (new hunt, retitle ident).
  - Removed: `ReviewScreen`'s status line and `QuizHeader`'s red pill (`saveNotice` props gone),
    and `HuntsList`'s inline notice.
  - Docs: *alarm* is in `notes/vocabulary.md`, and `notes/views.md` has a paragraph on where a
    failure is said.
* **Decisions taken**:
  - **Snackbar, not an Alert pinned beside Share**: the Snackbar is on every screen, not just
    the review screen.
  - **No notistack, no queue**: one alarm at a time, the latest replacing what's showing. The
    latest is about what the author just did. notistack is still unlisted in `notes/stack.md`.
  - **Dismissal**: no clickaway, no Escape, no timer. A later success doesn't take it down
    either, since the lost change is still lost.
  - **Inline vs alarm**: a page-level notice was replaced. A notice beside the field it is
    about stays: AddMember, the Edit hunt dialog and the ident gate.
  - `saveNotice` stays in `HuntHandle` for the members panel and `OpeningNotice`.
* **Discoveries**:
  - **No e2e spec asserted on `saveNotice`.** `failures.spec.ts`'s sentence is the recalculate
    notice (`runNotice`), a different path I left alone. `failures.spec.ts:63` passed in this run.
  - **Next's route announcer is a `role="alert"`** on every page. Find an alarm by its text
    (`getByRole('alert').filter({ hasText: AppNotices.changeNotKept })`), never by bare role.
  - **A reliable way to make the server refuse a save in e2e**: hold a draft in a field, lock
    the quiz from a second tab of the same context (`page.context().newPage()`, the same
    smith), wait for *Locked*, then blur. `useDraft` commits on blur even once the field is
    read-only. See `e2e/alarms.spec.ts`.
  - After that refusal, the field still shows the refused text until reload. Arguably the draft
    should revert; not touched.
  - An MUI modal marks the rest of the page `aria-hidden`, so an alarm raised under an open
    dialog is seen but not announced.
  - `--update-refs` also rebased the local `20260930-chai_in_vitest` onto the merged #54. I did
    not push it.
* *Review:* **fixed**, one kept (58a1cdb): a quiet `carryOut` on a quiz not yet open set no
  `saveNotice`, so AddMember showed nothing or a stale notice; it now sets `changeNotSent`.
  Left, minor: that same sentence now also shows in `QuizRoute`'s *Opening…* placeholder beside
  the alarm -- kept as more accurate; a one-line change if the Coach wants it bare.
* **For the Coach**: placement (bottom centre), Escape not dismissing, and the alarm outliving a
  later success are each one-line changes if you'd rather otherwise. They are also in
  HUMAN-whatsup and on #60.

## Thread 1: Chai in vitest (2026-09-30)

Branch `20260930-chai_in_vitest`, PR #58, stacked on #54. Suites: typecheck and lint clean, unit 2233/2233, e2e 185/185 (documents only; run for form).

* **Built**: `whiteboard/20260930-misc/chai-in-vitest.md`, the findings and the options,
  with the exact edit to `notes/testing.md`. Read it before writing a test that asserts on a
  boolean, null, an empty collection or a spy, or before touching the `triquet/tests` lint
  block. The PR holds documents only.
* **Decisions taken**: none were needed in code. The finding: vitest's runtime supports
  `expect(x).to.be.true` fully (passes, fails and typechecks). Only the lint rule
  `vitest/valid-expect` refuses chai's property assertions, and it has no option to allow
  them. There is no package that fixes this inside `@vitest/eslint-plugin` (1.6.27, latest).
* **Discoveries**:
  - **Style for threads 2 onward: `.to.eq(true)`**, `.to.eq(null)`, `.to.have.lengthOf(0)`,
    `.to.deep.eq({})`, `.to.eql(NaN)`, `.to.have.callCount(n)`. Never `.to.be.true`, and no
    `eslint-disable` for it. This matches the recommendation, so nothing needs rewriting
    when the Coach rules unless the Coach picks option 2.
  - Chai 6 has `containSubset` built in. `eventually` (chai-as-promised) is absent; use
    `await expect(p).resolves.to.eq(...)`. A *property* after `resolves` breaks at runtime.
  - vitest has most of sinon-chai built in: `called` and `calledOnce` are properties, so
    lint refuses them, while `callCount(n)`, `calledWith(...)` and the rest are methods and
    lint-clean.
  - Our `vitest/expect-expect` override omits `assert`, so a test asserting only with
    `assert.*` would be reported as having none. Nobody does that today.
* *Review:* skipped -- the thread's diff is documents only.
* **For the Coach**:
  - Recommended: keep `vitest/valid-expect` and change `notes/testing.md` line 17 from
    `to.be.true` to `to.eq(true)`, adding one sentence (the exact text is in the report).
    The rule's refusal is the same check that catches `expect(x).to.eq` with no call, and a
    bare `expect(x)`. Both pass silently otherwise.
  - Optional: file an upstream issue asking `valid-expect` to accept chai's terminating
    properties. Filing on a third-party repo is your call.
  - The alternative, `eslint-plugin-chai-expect` in place of `valid-expect`, is described in
    the report and not recommended.

