---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.ts"
  - "**/*.spec.tsx"
  - "**/__tests__/**/*.{ts,tsx}"
  - "tests/support/**"
  - "e2e/**"
---

# Testing Conventions

Two runners, and the assertion style follows the runner:

* **Vitest** for everything in `tests/`, with chai-style assertions: `expect(foo).to.eq(bar)`,
  `to.deep.equal` (`to.equal` is `===`; an object or array wants `deep`), `to.be.true`,
  `to.have.lengthOf`, `to.throw`. Vitest's `expect` *is* chai with Jest's matchers added, so the
  chains are first-class. Two Vitest-only forms have no chai spelling and are allowed:
  `await expect(promise).rejects.toThrow(...)` and `toMatchSnapshot()`. Never `toBe`, `toEqual`
  or `toHaveLength` in `tests/`; one you find there is a bug, not a precedent. `true`, `false`,
  `null` and `undefined` are asserted in chai's property form, `to.be.null`, never `to.eq(null)`.
  The lint for it is chai's own: `vitest/valid-expect` cannot tell a property assertion from a
  matcher left uncalled, so it is off in `tests/`, and `eslint-plugin-chai-expect` catches a bare
  `expect(x)` and a method left uncalled in its place. That rule knows only the methods named in
  `ChaiMethods` (`eslint.config.mjs`), so a new one goes on that list. Never a property after
  `resolves` or `rejects`: a getter cannot hand back the promise, so `await
  expect(promise).resolves.to.eq(true)` is the one place the method form stays.
* **Playwright** for everything in `e2e/`, with its web-first assertions on locators:
  `await expect(locator).toHaveValue(...)`. Playwright's `expect` has no chai interface, and a
  locator assertion retries until it holds, which is the reason to use one.

Two skills under `.claude/skills/` are references for the runners, loaded only when named:
`/vitest` when a specific Vitest API is wanted (fake timers, `test.extend` fixtures, snapshots,
concurrency), and `/playwright-cli` when driving a browser by hand or reaching for a Playwright
API past the locators and assertions below. A skill or reference that shows `toBe`/`toEqual`
(the Vitest docs do) is an API reference, not a style guide. This file wins. Style rules from `STYLE.md` apply in test files too --
semicolonless, braced blocks, no single-letter names, and `"` around an `it` or `describe`
title, which so often holds an apostrophe (STYLE.md, *Strings*).

Put all test files in `/tests`, with a path and name that exactly parallels the source: `src/foo/bar.ts` -> `tests/foo/bar.test.ts` (and similarly for all standard React/Next conventions). Test and build artifacts should never pollute the source tree.
Put fixtures in `/fixtures` under a mostly-similar convention: if a fixture file exists in the main to serve `bar.ts`: `src/foo/bar-examples.json` or `src/foo/bar/demo_photo.png`, etc. If it serves most things in `src/foo`, use `/fixtures/foo/whatever.blah` (never `/fixtures/foo-...` for a directory). This particular rule will be more loosely followed than most, as various other concerns will drive their location.

## Coverage Expectations

Methods with an external interface must have at least one test demonstrating each use case.
**Every `@example` in a doc block must have a corresponding test.**

```ts
describe('padEnd', () => {
  it('returns a string with at least the requested length', () => {
    expect(padEnd("hello", 8)).to.eq('hello   ')
  })
  it('allows you to supply the padding character', () => {
    expect(padEnd("hello", 8, '_')).to.eq('hello___')
  })
})
```

## Bulk Example Lists

At whatever point the shape of the test function becomes duplicative, bulk-test against example
lists -- including every example from the docs and from those long-form tests -- written in this
style. The alignment is deliberate: parallel construction should be visible at a glance, and the
quote-switching convention (`"` for inputs and expected values, `'` for the description) lets the
IDE align the columns.

```ts
const PadTestCases = [
  // regular usage:
  [["hello world", 0],            "hello world",         'string, maxLength zero, default padding: returns input'],
  [["hello world", 10],           "hello world",         'string, maxLength less than its own: returns input'],
  [["hello world", 11],           "hello world",         'string, maxLength equal to its own: returns input'],
  [["hello world", 12],           "hello world ",        'string, maxLength one more than its own, default padding: adds one space'],
  // ... more ...
  // trivial cases:
  [["", 0],                       "",                    'empty string, length: 0, default padding: returns input'],
  // ...
  // ... weird cases ...
  [["L'Iñtërnâtiôñàlizætiøñ.𝍔", 20], "L'Iñtërnâtiôñàlizætiøñ.𝍔", 'Unicode characters retain fidelity'],
  [["L'Iñtërnâtiôñàlizætiøñ.𝍔", 26], "L'Iñtërnâtiôñàlizætiøñ.𝍔 ", 'Padding counts by character, not byte'],
  // ...
]
```

Group the list with comments (`// regular usage:`, `// trivial cases:`, `// weird cases`) rather
than sorting it arbitrarily. The third slot is a sentence describing the case, not a restatement
of the inputs -- it becomes the `it(...)` description.

## Choosing Examples

Do not go crazy with duplicated examples: **each one should tie to a plausible failure mode.**
In particular, address:

* what does an exists-as-undefined, or a null, value mean?
* what does a missing value mean?
* what do we do about nil/missing elements?
* what do we do about cardinality mismatches (`filter(1, iteratee)`)?
* what do we do about type mismatches that are absurd (`toInteger("three")`, `toInteger([])`)?
* what do we do about mismatches that aren't *patently* absurd -- `nth(arr, "1")`,
  `nth(arr, 1.5)`, `nth(arr, -1)`, `nth(arr, inf)`, `nth(arr, MAX_SAFE_INTEGER + 99)`?

## Convex functions (convex-test)

Everything under `convex/` is tested in `tests/convex/`, path for path, under `convex-test` in
Vitest's `convex` project (the edge runtime). `tests/support/convex.ts` has `openTester()` (a
fresh, empty deployment in this process: no test sees another's rows), `huntHolding`,
`seedHunt(tt, hunt, { openIdx, smith })` (the hunt written with one smith on it; `open`, `act`
through `hunts.perform` as that smith unless given another session, `actOnLibrary` likewise through
`widgets.perform`, `join(label, role)` to put
another ident on it, and `read`, the hunt as its rows make it up), `openOf(seen)`, `wholeHunt`
(read past authorization), `putOn`, and the sessions a test calls as: `identified(tt, label)` (the
session holding the username `label`, signed in fresh unless one already holds it in `tt`, on no
hunt: a stranger; `as` is its tester, `actor` what the server sees), `signedIn(tt)` (a session that
has asserted no username), and the bare `tt` (no session at all); `callerOf` takes any of them.
Reach past the functions with `tt.run(async (ctx) => ...)`, which must hand back a Convex
value (no `Map`). Ids in an action must be ids: a malformed one is refused at Convex's door, so a
test of "an id of no question here" uses a real question of another hunt. `_creationTime` never
ties under convex-test, so no test pauses between writes. Action tests seed a hunt tree as a
fixture, act, and compare trees; row ids are never asserted on, except where the key itself is
under test. A test of a write that deletes or relinks rows ends with `expectSound(tt)`
(`tests/support/soundness.ts`): it reads every table back and fails on anything that no longer
holds together (an id naming no row, a quiz's `row_ordering` that is not its questions, a dangling
chain or column source, two siblings under one label, a copy of a parent's field that is missing
or no longer its parent's). Each check is a named entry in
`SoundnessChecks`; a new kind of integrity is a new entry there.

The browser's hooks (`src/state/use-*.ts`) are not unit tested: what they add to the functions is
React's and Convex's client's, and the e2e suite drives them. Anything pure inside one (`placeIn`
in `use-hunt`) is exported and tested on its own.

A view is unit tested only for what it chooses to say: a notice in place of the page, a dash in
place of a zero. Such a test is a `tests/**/*.test.tsx`, and reads the view through `renderedText`
(`tests/support/rendering.tsx`): rendered once by `react-dom/server` under the `node`
environment, with no DOM, no effects and no testing library. Anything a view does in a browser --
focus, clicks, effects, heights -- is the e2e suite's.

One thing neither can see is how much one change draws again. A `tests/**/*.dom.test.tsx` runs in
Vitest's `dom` project, under happy-dom, and renders a screen with `react-dom/client` and React's
`act` over a stand-in for the Convex client (`tests/support/fake-convex-react.ts`, whose answers keep
their identity until the test changes them, as the client's do). It counts renders by spying on a
function each render calls once (`QuizRoute.dom.test.tsx` counts the Workbench by its offers and a
row by its grip), and asserts the counts: the guard on a memo. It is not for asserting what a
view looks like or does.

## End to End (Playwright)

The suite is a thin layer: the handful of flows a unit test cannot see -- the grid's heights,
autosave and reload survival, routing, the browser's history store, the network being off.
Everything else is a unit test. `eslint-plugin-playwright` enforces the mechanical half of what
follows on `e2e/**`.

**Locate as a person would.** `getByRole`, `getByLabel`, `getByText` first; a data attribute the
app already carries (`td[data-colname]`) second; CSS or XPath only for structure the page has no
name for, and then in one helper in `e2e/support.ts`, not inline in a spec. Never assert on a
CSS-module class name: give the element an aria or data attribute and assert that.

**Assert with a retry.** A change lands a moment after the author makes it. Every assertion
about the page is `await expect(locator).toX(...)`, which retries until it holds or the expect
timeout runs out. A read that returns a value -- `page.url()`, `count()`, `allTextContents()`,
`inputValue()`, `evaluate()` -- is a snapshot of one instant, and `expect(await read()).toBe(x)`
fails on the instant before the change lands.

* `expect(page).toHaveURL(...)`, never `expect(page.url())`. `toHaveCount`, never `count()`.
  `toHaveText([...])`, never `allTextContents()`. `toHaveValue`, never `inputValue()`.
* When no locator matcher fits (the values of a column of textboxes, a count from IndexedDB,
  the paths in a downloaded zip), wrap the read: `await expect.poll(() => read()).toEqual(...)`.
  `valuesOf(locator)` in support is for the first of those.
* A one-shot `expect(await read())` is allowed only to say "not yet", after a retrying
  assertion has established the state, and a comment says which it is.
* Never `waitForSelector`, `waitForTimeout` or `waitForLoadState('networkidle')`. Actions wait
  for their target on their own; a state the next step needs is an `expect` on it. Wait with
  `waitUntilSaved` before a reload.
* A timer of the app's (a debounce, a scheduler) is tested with `page.clock`, not by waiting
  it out.

**Share through fixtures, not copies.** `e2e/support.ts` extends Playwright's `test`; specs
import `test` and `expect` from there. Its `page` opens on a hunt of its own, made a moment ago
(`startAt` is `FreshHunt`), so a spec begins with the thing it is about. The way in is fast: each
worker says who it is at the front door once and keeps that session, and the backend makes each
test's hunt (`testing:makeHunt`, an internal function the spec process calls with the role's
admin key, `e2e/admin.ts`). A spec that is not about the gear asks for its quiz's layout up front,
`test.use({ layout: { widgetings: [...], columns: [...] } })`, rather than walking the dialogs
(`addWidgetings`, `addColumns`), which stay for the specs about them. A spec that is about the way
in itself (the front door, the hunts list, making a hunt) says `test.use({ startAt: null })` and
goes there itself, in a fresh anonymous session (`startHunt(page)` walks the front door and the
hunts list); a file whose tests are only partly about it says so in a `describe`, or in an
anonymous one, `test.describe(() => { test.use({ startAt: null }) ... })`, which leaves the
titles of the tests in it as they were; one that must stub a route before the page first asks for it stubs it and reloads. A
helper two specs need lives in support with a doc block; a helper one spec needs lives at the top
of that spec.

**One smoke test a spec file.** Exactly one test of each spec file carries `{ tag: '@smoke' }`
(the option, never words in its title): the one that walks furthest through what the file covers,
so `pnpm e2e:smoke` crosses every corner once (`notes/git_hygiene-laptop.md`, *Running only the corner*).
A new spec file tags its one when it is written, and goes into `SpecCorners` in `scripts/spine.ts`,
in the corner it covers; the unit tests of the map fail until both are done.

**Stub the network at the route.** `stubAsk` (`page.route('**/api/ask', ...)`) stands in for
the players, so nothing here ever spends model usage. Start `waitForEvent('download')` before
the click.

**A negative needs a window.** "Nothing was sent" or "not committed yet" cannot be proved by
one read. Give it a bounded window (`page.clock`, or `waitForRequest` with a timeout) and say
in a comment what the window is and why it is long enough.

The suite runs only as `pnpm test:e2e`, under Doppler's `dev_e2e` (its own port, build
directory and Convex backend, emptied as the suite starts); Playwright refuses to start locally
otherwise. `pnpm test:e2e:agent` is the same on a port and backend of an agent's own. In a
worktree every role's port and backend are its lane's (`scripts/lanes.ts`), and the guard wants
exactly those.
`pnpm test:e2e:built` runs it against the optimized build (`next build`, then `next start`) in
place of the dev server, on the `e2e-built` role (port 3005 in the main checkout): the mode the app is deployed in,
with none of React's dev-only doubled effects, which once hid a review that never opened. It
means the build mode only: the keys, settings and backend are the suite's own, as ever. It builds
afresh every run and refuses to start while anything holds its port, so an earlier build is never
tested in its place. CI runs the suite against the build too, on the `e2e` role's port, backend
and build directory, with `TRIQUET_E2E_SERVER=built` choosing the server: the mode travels apart
from the role. A spec must pass under both servers. Each test's browser context holds its worker's session, with a fresh hunt of which the worker's
ident is the smith; the session is handed on from test to test, since each page that opens on it
spends its refresh token (`KeptSessionT` in support). Specs share one database, and a worker's
tests share one ident, so find rows and pages by your own labels and titles, never by position or
by the hunts an ident is on, and never change who the page's session is. A second visitor is the
fixture's `friend`: a page in a browser of its own, signed in as a second ident each worker says
it is once (`friendLabel`), its session handed on from test to test as the worker's own is. The
friend is on no hunt of the test's, a stranger to it, until put on one: by the backend,
`putOnHunt(huntOf(page), friendLabel, 'reviewer')` (`e2e/admin.ts`, through `testing:putOnHunt`),
or through the Members panel (`addMember`) in a spec about the panel. A visitor nobody has seen,
or one whose own way in is what the spec is about, is `otherVisitor(browser)`: a browser context
with no session, closed after the test, who says who they are with `assumeIdent`. A context made
any other way inherits the worker's session.
The grid is `grid(page)`, the table named *Questions*: the page holds other tables.

A change lands one round trip after the author makes it: the screen shows it once the server
has it. A spec whose next step needs the change (a lock before forcing past it, a clueing before
asking about it, an export that holds the edit) waits for it with a retrying assertion first.

**A slow server, on purpose.** `TQ_E2E_LAG_MS=300` holds back everything the Convex backend
tells each page: every message that much late, and each at least that long after the one before,
as on a loaded CI runner (`laggedBy` in support). A spec that passes here and fails on CI is
usually acting within a round trip of a write, on the screen as it was; run it with the lag and
the race shows every time, not one run in ten. Fix the app (the screen showing the change at once,
or the server deciding against its own rows), or wait on what a person would see, never on a
longer timeout.

## Validation Boundaries

Remember which side of a validation boundary the code under test sits on (`notes/guidelines.md`).
A module entrypoint should be tested with generous, sloppy, sketch-shaped input -- that's its
job. Internal functions past the validation boundary are entitled to assume clean data; don't
write paranoid tests feeding them garbage they were never meant to see.