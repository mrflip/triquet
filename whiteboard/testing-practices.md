# Testing practices: Playwright, chai, and the vitest skill

Thread opened 2026-09-27. Prompted by `expect(await committedEntryCount(page)).toBe(created)` in
`e2e/quiz-history.spec.ts`, and by the vitest skill's jest-style examples having won over
`notes/testing.md`. The skill is parked in `.claude/xx-skills/` (not loaded) while this is settled.

## 1. Review: are the e2e specs using Playwright well?

Mostly yes. The suite (18 files, ~2100 lines) is better than the one line suggests.

**What is already right, and should be named as the standard**

* Locators are user-facing almost everywhere: `getByRole`, `getByLabel`, `getByText`, with
  `exact` where names collide. Support helpers return locators, never element handles.
* Assertions are web-first and retrying almost everywhere: `toHaveValue`, `toHaveText`,
  `toHaveCount`, `toBeVisible`, `toHaveURL`, `toHaveTitle`, `toHaveAttribute`, `toBeDisabled`.
* `expect.poll` wraps reads that have no locator matcher (a column of textbox values, an
  IndexedDB count, the paths in a downloaded zip); `toPass` wraps the health check.
* The network is stubbed at the route (`page.route('**/api/ask')`), so no spec can spend model
  usage; `client-first.spec.ts` aborts everything but the page, including the WebSocket.
* `waitForEvent('download')` is started before the click. `test.use({ permissions })` for the
  clipboard. `test.describe` blocks carry their own `beforeEach`.
* The config is sound: a setup project the browser project depends on, `trace: 'on-first-retry'`,
  retries only on CI, an expect timeout that matches a Jazz-backed page, reporters per venue, and
  the environment refusal before any server starts.
* `dragOnto` is hand-rolled with its reason in the doc block (Chromium will not start a native
  drag under Playwright).

**What is not best practice** (counts are from grep, 2026-09-27)

| Pattern | Where | Count | Playwright's answer |
|---|---|---|---|
| `page.waitForSelector('table')` | quiz-history, routing, client-first | 28 | Discouraged API. Actions auto-wait for their target; a state the next step needs is `await expect(locator).toBeVisible()`. Here it is mostly dead weight before a `fill`. |
| `beforeEach` does `goto('/')`, then the test does `goto('/')` again | quiz-history (10), routing (14), players (1) | 25 | One load, in a fixture. The double load also means `players`'s describe stubs `/api/players` after the outer load already fetched it unstubbed. |
| `expect(new URL(page.url()).pathname).toBe(...)` one-shot | routing | ~11 | `await expect(page).toHaveURL(string \| RegExp)`, which retries. Some sites are gated by a prior retrying assertion and are safe today; the idiom is still `toHaveURL`. |
| `expect(await fn()).toBe(...)` one-shot | quiz-history:123, players:74, environment.setup:22 | 3 | Two are deliberate negatives ("not committed yet", "no request within 1 s"), one sits inside `toPass`. See below. |
| `await locator.count()` then `expect(n).toBe(22)`; `allTextContents()` then `toEqual` | ordering:110, expressions:66 | 2 | `toHaveCount(22)`; `toHaveText([...])`. |
| Helpers copied across specs | `cellOf` ×3 (+`sumCell`, `butnotCell`), `openManage` ×2, `stubAsk` ×2, `answersShown` ×2, `fillQuiz` ×2 | ~11 | `test.extend` fixtures and shared helpers in `e2e/support.ts`. Playwright's own guidance is fixtures over `beforeEach` for anything two specs share. |
| Asserting a CSS-module class | `toHaveClass(/headSorted/)`, `toHaveClass(/stale/)` | 2 | Couples the spec to a stylesheet. The sort header already carries `aria-sort`; give the stale span a `data-stale` or `aria-label` and assert that. |
| CSS locators inline | `tbody tr`, `td[data-colname=...]`, `tbody`, `option`, `span` | 14 sites | `td[data-colname]` is a legitimate data attribute and fine in **one** helper. `locator('span').first()` is the one to lose. |

**The debounce test** (`an edit is committed on its own once the wait is up, and not before`).
The one-shot `expect(await committedEntryCount(page)).toBe(created)` can only prove "not yet",
and it depends on a 2-second debounce set through the env plus a 15-second poll. Playwright 1.45+
has `page.clock`: install it before the edit, `runFor(1000)` and assert the count is unchanged,
`runFor(1500)` and assert it grew. That is the genuine best practice for a timer, and it would
retire `NEXT_PUBLIC_TRIQUET_COMMIT_DEBOUNCE_SECONDS` from the config. Caveat to spike first: the
fake clock replaces every timer on the page, and Jazz's worker and sync loops use timers too. If
Jazz stalls under it, keep `expect.poll` and leave the one-shot with a comment that names it as a
"not yet" check.

**The "no request was sent" test** (`players.spec.ts:74`) is an acceptable negative: the
`waitForRequest` timeout *is* the window. It should say so in a comment, and a
`page.route` counter would make it independent of timing. Low priority.

**Not findings.** `evaluateAll` to read a column of input values, wrapped in `expect.poll`, is
correct: there is no locator matcher for the values of several textboxes (`toHaveValues` is for
`<select multiple>`). `toMatchAriaSnapshot` might express grid order in one assertion; worth a
ten-minute spike, not a plan item. `test.step` is unused, and the tests are short enough not to
need it.

**Nothing watches `e2e/`.** `eslint.config.mjs` applies the vitest preset to `tests/**` only;
`e2e/**` gets no test rules at all, and lint is clean on it today. `eslint-plugin-playwright`
(2.12.0, flat config, `configs['flat/recommended']`) has a rule for nearly every row above:
`no-wait-for-selector`, `no-wait-for-timeout`, `prefer-web-first-assertions`,
`prefer-to-have-count`, `prefer-to-have-length`, `missing-playwright-await`, `no-element-handle`,
`no-networkidle`, `no-conditional-in-test`, `no-focused-test`, `no-skipped-test`, `valid-expect`.
It is unlisted in `notes/stack.md`, so: **proposed here, needs a Coach's yes.** Library first.

## 2. Chai or jest-style: advice

The premise needs correcting: the dominant style in this repo is chai, by a wide margin.

| | chai chains | jest-style matchers |
|---|---|---|
| `tests/` (71 files) | 1356 uses in 69 files | 11 uses: 10 `rejects`, 1 `toMatchSnapshot` (an earlier count of 20 `toEqual` was `expectTypeOf(...).toEqualTypeOf`, which is fine) |
| `e2e/` (18 files) | none possible | all of it |

Two facts settle it:

1. Vitest's `expect` *is* chai, with Jest's matchers added on top. The vitest skill says so in
   its own `core-expect` reference (line 8). Chai in `tests/` is first-class, not a hack.
2. Playwright's `expect` is not chai and has no `.to.equal`. Its locator matchers retry, which is
   the whole point of them. There is no chai option for `e2e/`, and nobody should want one.

So the rule is **the assertion style follows the runner**: chai in `tests/`, Playwright's
web-first matchers in `e2e/`. That is a one-line rule an agent can hold, and a lint can fence.

On "agents will be the main readers": agents read both styles fluently. The drift you saw was not
an agent preferring jest-style; it was a document (the skill) contradicting `notes/testing.md`,
which already said "never a one-shot read straight after an action". Fix the contradiction and
the style is stable. Do not convert the 69 chai files; there is nothing to convert the other
way either (`rejects` and `toMatchSnapshot` have no chai spelling and stay as named exceptions).
One trap worth a sentence in testing.md: chai's `to.equal` is `===`, so an object wants
`to.deep.equal` (or `to.eql`).

## 3. Proposed changes to `notes/testing.md`

Replace the opening paragraph with this:

> Two runners, and the assertion style follows the runner:
>
> * **Vitest** for everything in `tests/`, with chai-style assertions: `expect(foo).to.eq(bar)`,
>   `to.deep.equal` (`to.equal` is `===`; an object or array wants `deep`), `to.be.true`,
>   `to.have.lengthOf`, `to.throw`. Vitest's `expect` *is* chai with Jest's matchers added, so the
>   chains are first-class. Two Vitest-only forms have no chai spelling and are allowed:
>   `await expect(promise).rejects.toThrow(...)` and `toMatchSnapshot()`. Never `toBe`, `toEqual`
>   or `toHaveLength` in `tests/`; one you find there is a bug, not a precedent.
> * **Playwright** for everything in `e2e/`, with its web-first assertions on locators:
>   `await expect(locator).toHaveValue(...)`. Playwright's `expect` has no chai interface, and a
>   locator assertion retries until it holds, which is the reason to use one.
>
> A skill or reference that shows `toBe`/`toEqual` (the Vitest docs do) is an API reference, not
> a style guide. This file wins. Style rules from `STYLE.md` apply in test files too --
> semicolonless, single quotes by default, braced blocks, no single-letter names.

Add this section after "Rows and Policies (Jazz)", and move the two e2e sentences at the end of
that section into it:

> ## End to End (Playwright)
>
> The suite is a thin layer: the handful of flows a unit test cannot see -- the grid's heights,
> autosave and reload survival, routing, the browser's history store, the network being off.
> Everything else is a unit test.
>
> **Locate as a person would.** `getByRole`, `getByLabel`, `getByText` first; a data attribute the
> app already carries (`td[data-colname]`) second; CSS or XPath only for structure the page has no
> name for, and then in one helper in `e2e/support.ts`, not inline in a spec. Never assert on a
> CSS-module class name: give the element an aria or data attribute and assert that.
>
> **Assert with a retry.** Every assertion about the page is `await expect(locator).toX(...)`,
> which retries until it holds or the expect timeout runs out. A read that returns a value --
> `page.url()`, `count()`, `allTextContents()`, `inputValue()`, `evaluate()` -- is a snapshot of
> one instant, and `expect(await read()).toBe(x)` fails on the instant before the change lands.
>
> * `expect(page).toHaveURL(...)`, never `expect(page.url())`. `toHaveCount`, never `count()`.
>   `toHaveText([...])`, never `allTextContents()`. `toHaveValue`, never `inputValue()`.
> * When no locator matcher fits (the values of a column of textboxes, a count from IndexedDB,
>   the paths in a downloaded zip), wrap the read: `await expect.poll(() => read()).toEqual(...)`.
> * A one-shot `expect(await read())` is allowed only to say "not yet", after a retrying
>   assertion has established the state, and a comment says which it is.
> * Never `waitForSelector`, `waitForTimeout` or `waitForLoadState('networkidle')`. Actions wait
>   for their target on their own; a state the next step needs is an `expect` on it.
> * A timer of the app's (a debounce, a scheduler) is tested with `page.clock`, not by waiting
>   it out.
>
> **Share through fixtures, not copies.** `e2e/support.ts` extends Playwright's `test`; specs
> import `test` and `expect` from there. A page with the workbench open is a fixture, not a
> `beforeEach` that every spec repeats. A helper two specs need lives in support with a doc
> block; a helper one spec needs lives at the top of that spec.
>
> **Stub the network at the route.** `page.route('**/api/ask', ...)` stands in for the players,
> so nothing here ever spends model usage. Start `waitForEvent('download')` before the click.
>
> **A negative needs a window.** "Nothing was sent" or "not committed yet" cannot be proved by
> one read. Give it a bounded window (`page.clock`, or `waitForRequest` with a timeout) and say
> in a comment what the window is and why it is long enough.
>
> The suite runs only as `pnpm test:e2e`, under Doppler's `dev_e2e` (its own port, build
> directory and Jazz server); Playwright refuses to start locally otherwise. Each spec's fresh
> browser context is a fresh local-first account, and that isolates specs only because every
> table is creator-owned. A table readable across accounts would leak rows between specs through
> the shared server; then wipe `data/jazz-e2e/` before a run.

Also add `eslint-plugin-playwright` to `notes/stack.md` under **Use** once approved, beside Vitest
and Playwright, with the reason: it is the mechanical form of the section above.

## 4. Plan for the vitest skill

Where it stands: `.claude/skills/*` are symlinks into `.agents/skills/*`, vendored snapshots of
antfu's generated skills (`GENERATION.md`, 2026-06-22); nothing in the repo regenerates them. The
vitest one's description says "Use when writing tests", so it loads on every test task, and its
examples are the upstream docs' jest-style. It has no view on Playwright at all, so it did not
cause the e2e one-shots directly; it set the register the specs were written in.

Recommendation: **keep it, narrowed, and make `notes/testing.md` the thing that wins.**

1. `notes/testing.md` carries the "style follows the runner" rule and the sentence that a
   skill's examples are API reference, not style. It auto-loads with every `*.test.ts` and
   `*.spec.ts` (`.claude/rules/testing.md`), so it is in context whether or not any skill fires.
   This is the fix that does not depend on the skill.
2. Rewrite the skill's `description` so it triggers on Vitest *API* questions only: config,
   `vi` mocks and spies, fake timers, snapshots, `test.extend` fixtures, tags, coverage --
   "not for ordinary tests; assertions follow notes/testing.md". The description is the trigger,
   so this is the lever that stops it loading for routine work.
3. Add a four-line house-rules preamble to `SKILL.md` after the frontmatter, pointing at
   `notes/testing.md`, and record in `GENERATION.md` that the description and preamble are local
   edits to reapply if the skill is ever regenerated.
4. Move the symlink back from `.claude/xx-skills/` to `.claude/skills/`.

The alternative is deleting it. The cost is small (the model knows Vitest 4 well), but Vitest 5
is a beta with things training may not cover (`aroundEach`, test tags, the `bench` fixture,
`vi.waitFor`), and a narrowed reference costs nothing when it does not fire. No Playwright skill
is proposed: the testing.md section plus the lint plugin are the guidance, and both are ours.

## 5. Plan for converging the tests

Small PRs, each green on `pnpm test:e2e` and `pnpm test` before the next. Branch:
`pnpm run newb e2e_practices`.

1. **Lint first, so the list is mechanical.** Add `eslint-plugin-playwright` (Coach's yes) with
   `flat/recommended` on `e2e/**`, plus `prefer-web-first-assertions`, `prefer-to-have-count`,
   `prefer-to-have-length`, `no-wait-for-timeout` as errors. Leave `no-nth-methods` and
   `no-raw-locators` off: the grid is addressed by row index and column attribute by nature. Run
   it; the warning count is the baseline. Add the stack.md entry.
2. **Fixtures.** In `e2e/support.ts`, `test.extend` with a `workbench` fixture (a page that has
   gone to `/` and seen the grid) and move the shared helpers there: `rowAt`, `cellOf`,
   `valuesOf(locator)`, `openManage`, `stubAsk`, `fillQuiz`. Switch each spec's import to
   `./support`; delete its copy and its `beforeEach` goto. This alone removes the 28
   `waitForSelector` and the 25 double loads.
3. **Sweep the one-shots.** `page.url()` to `toHaveURL`; `count()` to `toHaveCount`;
   `allTextContents()` to `toHaveText`; the `evaluateAll` value lists through `valuesOf` inside
   `expect.poll`. Comment the two deliberate negatives.
4. **Spike `page.clock`** on the debounce test. Keep it if Jazz tolerates the fake clock and
   drop the env debounce from `playwright.config.ts`; otherwise keep `expect.poll` and the
   commented one-shot.
5. **Class-name assertions.** Give the stale span a data attribute; assert `aria-sort` and that.
   Touches two components, lightly.
6. **Unit tests.** Nothing to convert (see the corrected count above). Optionally fence
   `tests/**` with a `no-restricted-syntax` selector on `toBe|toEqual|toHaveLength` (a
   two-line rule; part of the ESLint thread if preferred).
7. **Documents and the skill.** Apply section 3 to `notes/testing.md`; do section 4.

Steps 1 to 3 are one sitting. Step 4 is a spike with a fallback. Steps 5 to 7 are small.

## 6. How it went (2026-09-27, branch `20260927-e2e_practices`)

* **Baseline**: the untouched suite from `origin/main`, 144 passed in 3.6 minutes with four workers.
* **`page.clock` works.** The debounce test installs the clock, pauses it, edits, steps 1900 ms
  (not committed), steps 200 more (committed), resumes. A mutation check that stepped 2100 ms
  before the "not yet" read failed as it should (22 entries against 21), so the fake clock is
  what drives the scheduler's `setTimeout`. Jazz, in its worker, was untroubled. The env's
  two-second debounce stays, since the clock is stepped by that amount; the 15-second poll is gone.
* **Unit tests needed nothing**: the "20 `toEqual`" in the first census were `toEqualTypeOf`.
* **`prefer-strict-equal` is off** for e2e: it would have churned every `expect.poll` list
  comparison for no gain. `sonarjs/assertions-in-tests` is off there too, as in `tests/`, since
  `playwright/expect-expect` knows `expect.poll` and sonar's does not. `react-hooks/rules-of-hooks`
  is off in `e2e/` because a fixture's `use` is Playwright's.
* **Environment.** The agent shell had no Doppler project at first (fixed the same day: the
  Coach is setting up a workspace for agents), so the first runs went the way CI runs, `CI=true`
  plus the four variables from `ci.yml`; the final run was `pnpm test:e2e` proper, 144 passed in
  2.5 minutes. Ports 3002/3202 were held by a human's own Playwright run from `~/code/triquet`, so
  this work used 3003/3203, `data/jazz-e2e-agent` and `.next-e2e-agent`; that is now
  `pnpm test:e2e:agent`, and CLAUDE.md says a bespoke port on the 30xx/32xx pattern is fine
  until agents have containers of their own.
