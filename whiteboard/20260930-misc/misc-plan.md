# Sprint misc: miscellaneous tasks

Date: 2026-09-30. Issued by the Coach (Flip). Mode: **normal**. Review level: **medium**.
**Status:** done (2026-09-30). #58 and #60 merged; #61, #63, #64, #65 open, stacked in that order.

The Coach issued three threads at once, sent a fourth soon after, and will send more as the sprint runs. Each new
thread is added below, in the order it arrives.

## Read first

Beyond CLAUDE.md and what it auto-loads (`notes/stack.md`, `notes/testing.md`,
`notes/convex.md`, `notes/views.md` by path):

* `misc-progress.md` beside this file, which is newer than this plan wherever the two disagree.
* `STYLE.md`, before writing code.
* Per thread, the files named in its gloss.

## Ground rules

* `notes/git_hygiene.md` (*A thread, start to finish* and *Sprints*) and
  `.claude/agents/thread-worker.md` govern. A `thread-reviewer` follows each thread that has code in it.
* **The stack.** The sprint started on `20260930-edit_hunt` (PR #54, open), so thread 1
  stacks on #54 unless it merges first. Each later thread stacks on the one before.
* **Two commits sit beneath thread 1** and ride on its PR. The first is `docs: sprints
  review themselves`: sprint machinery the orchestrator found uncommitted in the tree and
  committed whole. The second holds this plan and the progress document. Neither is thread
  1's to change. Mention both in thread 1's PR description.
* A thread that investigates without building still ends in a PR, holding its report
  and any note it touches.

## Threads

### 1. What chai assertions does vitest lack?

> what chai validators does vitest lack? .to.be.true doesn't seem to work; is there
> something to install? We don't want to leave the vitest universe. Don't implement code or
> install anything; your job is to report if there's a simple fix or well-known package,
> otherwise we'll tell agents to use the built-in vitest facilities

**Gloss.** This is research: no code, no installs. The trigger is HUMAN-whatsup, *Playtest
failures* (the *Lint vs notes/testing.md* bullet). `notes/testing.md` line 17 lists
`to.be.true` as house style, but the lint rule `vitest/valid-expect` (from
`vitest.configs.recommended` in `eslint.config.mjs`, block `triquet/tests`) rejects it.
Before assuming vitest is missing something, find out which of two things is happening:

* **The runtime.** Does vitest actually lack the assertion? Vitest's `expect` is built on
  chai, so check whether `expect(x).to.be.true` passes and fails correctly when run.
* **The lint rule.** Does only the ESLint rule reject it? Check what the rule allows and how
  it can be configured.

Then survey the rest: which chai assertions and plugins (chai-as-promised,
chai-subset and the like) vitest does or doesn't provide, and whether any fix is simple,
configures the lint rule, or uses a well-known package that stays within vitest.

Write the findings to `whiteboard/20260930-misc/chai-in-vitest.md`, with a short
recommendation and the exact change it would take. Don't make that change. A fix to
`eslint.config.mjs` or `notes/testing.md` waits for the Coach. The PR carries only the
report, so it gets no code review.

**Look-ahead.** Threads 2 and 3 write tests, and whichever style they use should agree with
this finding. Until the Coach rules, they use `.to.eq(true)`.

### 2. A hard-to-miss, dismissable alert for major problems

> add a better visual alert if there is a major problem (eg a failed save). it should be
> difficult to miss, dismissable; it should not take over the page as an alert would. Follow
> the framework practices for what you implement (eg Snackbar). Make sure that the alert is
> on screen even if its natural contextual element is offscreen

**Gloss.** Today a refusal goes to `saveNotice` (from `useHunt`, `src/state/use-hunt.ts`),
which shows as a muted `<p role="status">` in `ReviewScreen.tsx` and as a pill in
`QuizHeader.tsx` (used by `Workbench`). On a long page both scroll out of view. The
background is in HUMAN-whatsup, *Playtest failures*: the *Still poor* bullet names
`Snackbar` with `Alert`, or an `Alert` pinned beside Share. Also look at `src/lib/postmortem.ts`, where
`Postmortem.of` already puts each failure into words, and at `useAccountActions` (the hunts
list, the Edit hunt dialog from #54), which fails in the same way.

* **Library first.** MUI's `Snackbar` holding an `Alert` (with `onClose`, a severity, and no
  `autoHideDuration` for a failure that must be seen) is the obvious place to start. MUI's
  docs recommend `notistack` for queuing several snackbars at once. That is a new library,
  so check `notes/stack.md` first; queue only if the need is real. Read `notes/views.md` for
  the tripwires, and name `/material-ui-styling` if you need it.
* **Design it once, for the whole app**: one notice surface fed from the failure paths,
  rather than one Snackbar per screen. The Coach says more threads are coming, so leave a
  seam others can use.
* **Keep what the specs rely on.** The existing inline text is `role="status"`, and e2e
  specs assert on that sentence, `failures.spec.ts` among them. Decide whether the inline
  text stays (it is contextual) with the Snackbar alongside it, or whether the Snackbar
  replaces it, and update the specs to match. Keep the new surface accessible:
  `role="alert"` or a live region.
* **The flake.** `failures.spec.ts:63` fails about half the time on `main` (HUMAN-whatsup,
  2026-09-30). It is in the same neighbourhood. Don't go hunting for it, but note anything
  you learn.

**Look-ahead.** Thread 3 runs e2e against a production build, so this thread's specs should
hold up under both dev and production servers: no reliance on StrictMode's double effects.

### 3. e2e against a production build: has it landed?

> In HUMANS-whatsup there are questions about running test:e2e against the server in
> production mode. We decide yes; has that landed?

**The Coach, since** (2026-09-30): *"by production I don't mean 'using the real live keys'
> or 'production deploy environment' -- I just mean 'the mode where react and node et al don't
> slow down slightly alter and instrument the code paths'"*. So: the optimized build
(`next build` then `next start`, `NODE_ENV=production`, no StrictMode double effects, no dev
instrumentation), against the same e2e backend, Doppler config and stand-in keys as today.
Nothing here touches the production deployment or its keys. Name the script for the mode, not
the environment (`test:e2e:built` or similar, rather than `:prod`), so nobody reads it as
"against production".

**Gloss.** It has not. `playwright.config.ts`'s `webServer` runs `scripts/convex_dev <role>
--reset next dev`, and `package.json` has no production e2e script. The proposal is in
HUMAN-whatsup, *Playtest failures* (*Why no test caught it: StrictMode*): `next build &&
next start`, as a `test:e2e:prod` script beside the others. I read the Coach's "we decide
yes" as a request to build it.

* **Own resources.** It needs its own port, `NEXT_DIST_DIR` and Convex role, per CLAUDE.md's
  *Global resources*. Compare `test:e2e:agent` (port 3003, role `e2e-agent`) and
  `build:agent`/`start:agent`. `NEXT_PUBLIC_*` values are fixed at build time, so the
  build has to see the e2e environment, including
  `NEXT_PUBLIC_TRIQUET_COMMIT_DEBOUNCE_SECONDS`. `scripts/convex_backend` may need a new
  role.
* **Keep the guards.** `ANTHROPIC_API_KEY` stays a stand-in and `ENABLE_ANTHROPIC_BOT` stays
  `off` (HUMAN-whatsup, *No test can call Anthropic*). A built server must honour both.
* **Scope.** Run the whole suite if it passes, or at least the review and routing specs.
  Propose, without deciding, whether the finishing suite in `git_hygiene` and CI should run it.
  That is the Coach's call; put it in *For the Coach*.
* Note the `reuseExistingServer` trap (HUMAN-whatsup, *The Triquet brand is in*). A
  production server left running on the port from an earlier build would be tested stale.

### 4. Expose the smith's note, the hunt and the realm to formulas

> expose the smith's note, the hunt titlie and label, and the realm title and label to the
> formula. Let me know if there are other elements that deserve exposure

**Gloss.** Formulas see what the models' `exposed` lists allow:
`Quiz.exposed = ['label', 'title']` (`src/models/quiz.ts`), and `Question.exposed` and
`Widget.exposed` alongside it. The bag's shape is in `src/models/quiz-bag.ts`, where
`exposedQuiz` is written out by hand next to the list. The machinery is
`src/lib/exposure.ts` and `src/lib/expressed.ts`. HUMAN-whatsup, *A smith's note beside the
quiz's name*, notes that formulas don't see the note yet.

* Read `notes/vocabulary.md` (exposure, expressing, bag) and `notes/guidelines.md` before
  changing the bag's shape.
* Hunt and realm are new to the bag. Work out where the bag is built, whether the hunt and
  realm rows reach that point (see `notes/queries_hooks_and_subscriptions.md`), and what
  name they take in formulas (something like `hunt.title` or `realm.label`). Follow what
  `Quiz.exposed` does: add `exposed` statics on the Hunt and Realm models.
* The bag's `.describe()` strings may reach the bots' prompts and the *Prompts used* panel.
  Check what a bot will now be shown.
* Keep exports and quiz histories free of ids (HUMAN-whatsup, *Exports and quiz histories
  carry no ids*). A label is fine.
* **The Coach's question, answered in the report and in *For the Coach*:** which other
  elements deserve exposure? Propose a short list with a reason for each (candidates: the
  hunt's members' labels, a question's position or rank, review aggregates such as get
  rate, the lock state). **Don't build them.**

**Look-ahead.** Nothing in threads 1 to 3 touches formulas, so this thread is independent
of them. It stacks after thread 3 all the same.

### 5. Uniformly chai: the property style, with lint that allows it

> I prefer the .to.be.true style, so let's be uniformly chai -- replace.to.eq(true) (and null,
> undefined, false) with the .to.be.xxx form in the codebase. Does valid-expect take an
> exception? Research lightly what people do -- maybe there's an eslint plugin for the vitest
> chai helpers?

**Gloss.** The Coach decided against thread 1's recommendation. The research is done:
`vitest/valid-expect` has no exception option (only `alwaysAwait`, `asyncMatchers`, `minArgs`,
`maxArgs`), there's no vitest-specific plugin, and chai users turn to two general plugins.
`whiteboard/20260930-misc/chai-in-vitest.md` is the background, its option 2 the starting
point.

* **Lint, block `triquet/tests` in `eslint.config.mjs`.** Turn `vitest/valid-expect` off.
  Add `eslint-plugin-chai-expect`: `missing-assertion`, `terminating-properties`,
  `no-inner-compare`, `no-inner-literal`, and `no-uncalled-method` with the method names we
  use (`eq`, `equal`, `eql`, `include`, `match`, `lengthOf`, `property`, `oneOf`, `callCount`,
  `calledWith`, `throw`...). Derive the list from the tests, not from memory. Add
  `eslint-plugin-chai-friendly`, whose `no-unused-expressions` replaces the blanket `off` we
  have now. Check both against flat config and ESLint's current major before settling. List
  both in `notes/stack.md` (Library-first: widely used, lint-only, doesn't leave vitest).
  **Prove the guards**: a throwaway test where `expect(x).to.eq` is left uncalled and a bare
  `expect(x)` must both fail lint, then delete it. Record whatever the new setup no longer
  catches.
* **The sweep.** `.to.eq(true)` → `.to.be.true`, and the same for `false`, `null` and
  `undefined`, everywhere in `tests/` and `e2e/` (thread 1 counted 166). Don't touch
  `.to.eq(x)` for any other value. The rest of thread 1's table (`lengthOf(0)` → `.empty`,
  `callCount(n)` → `.called`, jest-style spy matchers) is **not** asked for: leave it, and
  list it as a question in *For the Coach*. A codemod or `sed` is fine if the diff is
  reviewed and the suites pass.
* **Documents.** `notes/testing.md` line 17 keeps `to.be.true` and gains a sentence on the
  lint setup. Correct `chai-in-vitest.md`'s recommendation with a line saying the Coach chose
  the property style.

**Look-ahead.** This runs last, so its sweep covers thread 4's tests as well.

### 6. CI runs the built suite in place of the dev suite

> I would like the ci tests to run test:e2e:built replacing test:e2e, so we don't need a
> different ci role.

**Gloss.** The Coach's answer to thread 3's CI question: **replace**, not a second matrix
axis. The `e2e` job in `.github/workflows/ci.yml` runs `pnpm exec playwright test
--shard=N/6` with `PORT: 3002`, `NEXT_PUBLIC_CONVEX_URL: http://127.0.0.1:3402` and
`NEXT_DIST_DIR: .next-e2e`, the `e2e` role's resources. "No different CI role" means CI
keeps that role and those ports and switches only the server mode. Most likely that's
`TRIQUET_E2E_SERVER: built` in the job's env, as thread 3 proposed. Check that
`playwright.config.ts` and `e2e/environment.ts` accept the `built` mode on the `e2e` role
(thread 3 paired `built` with `e2e-built`), and loosen that pairing if CI needs it.

* Each of the six shards builds for itself. That adds a `next build` (about 10s locally, more
  on a runner) per shard. Building once and sharing `.next-e2e` as an artifact is an
  optimization. Measure first, and propose it rather than build it unless it's trivial.
* The local finishing suite (git_hygiene's `pnpm test:e2e`) is **not** asked to change.
  Say so in *For the Coach*, and ask whether it should follow.
* CI can't be run from the container. Prove the workflow change as far as you can locally:
  run the same command with the same env against the `e2e` role, on a quiet port if 3002 is
  busy. Then push, and watch the PR's checks (`gh pr checks`) until the e2e shards finish.
* Update the comment above the job, and `notes/testing.md`'s paragraph on the built run.

**Look-ahead.** Independent of thread 5. It stacks after it all the same.

## For the Coach

* The sprint machinery (thread-reviewer and the rest) was uncommitted in the tree when the
  sprint began. The orchestrator committed it as its own `docs:` commit beneath thread 1.
  Move it to its own branch if you'd rather it not ride on thread 1's PR.
* The sprint was stacked on #54 (Edit hunt), which merged mid-sprint.
