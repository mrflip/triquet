---
paths:
  - "e2e/**"
---

# End to End (Playwright)

How the e2e suite is written. This file loads itself when work touches `e2e/`; `notes/testing.md`
has what holds for every test (where files live, how examples are chosen) and the unit runners.
`/playwright-cli` (under `.claude/skills/`) is the reference for driving a browser by hand or for
a Playwright API past the locators and assertions below, loaded only when named.

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
so `pnpm e2e:smoke` crosses every corner once (`notes/git_hygiene-laptop.md`, *Running only the corner*; `notes/git_hygiene-cloud.md`, step 3).
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
