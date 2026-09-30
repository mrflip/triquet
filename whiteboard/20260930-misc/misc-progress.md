# Sprint misc: progress

The running handoff. It is newer than `misc-plan.md` wherever the two disagree. Workers add
their sections newest first, below the status table.

**Status:** threads 1, 2 and 3 done.

| # | Thread | Status | Branch | PR |
|---|--------|--------|--------|----|
| 1 | Chai in vitest: what's missing | complete | `20260930-chai_in_vitest` | #58 |
| 2 | Hard-to-miss alert for major problems | complete | `20260930-failure_snackbar` | #60 |
| 3 | e2e against a production build | complete | `20260930-e2e_built` | #61 |
| 4 | Formulas see the smith's note, hunt and realm | pending | | |

*Orchestrator:* thread 3's "production" means the optimized build mode only (`next build`
/ `next start`), never live keys or the production deployment -- the Coach's clarification is
in the plan, under thread 3.

*Orchestrator:* #54 merged mid-sprint; the stack now rests on `main`. Thread 3: the spec that
must hold under the built server is `e2e/alarms.spec.ts` (it makes a real refusal), and the
built run needs a role and port of its own -- thread 2 ran on `e2e-agent` (3003).

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

