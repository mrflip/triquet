# Thread 3: Cover the error boundary (2026-10-06)

Branch `20261006-e2e_error_boundary`. PR filed at landing; see the report. Suites: `pnpm justify` green
(4399 unit tests). `e2e/failing-pages.spec.ts` passes 5 of 5 under both the dev server
(`pnpm test:e2e:agent`) and the build (`pnpm test:e2e:built`), each test 2 to 7 s. The full `pnpm e2e` runs at landing.

* **Built**
  * `e2e/failing-pages.spec.ts`, one test per claim in the plan:
    * "a page that throws says so, with the request to look up, and tells the console the same". The alert carries `AppNotices.pageFailed`, the summary, `Request <id> · hunts:open` and *Try again*; the grid is gone, and the console gets exactly one report, opening with the summary.
    * "trying again draws the page afresh, reporting each failure once, and a page whose cause is gone comes back whole". **Tagged `@smoke`** (thread 5): it goes furthest. It fails, tries again while the cause is still there (a second report), heals, and tries again: the grid, the quiz name and the hunt's title in the header come back, and there is no third report.
    * "the site header stands above the failure, and its way home still works". The logo goes to `/my/hunts`, and the alert is gone.
    * "the hunt, its quiz, its categories and the hunts list each fail into the same boundary". The hunts list is covered at both its addresses, `/my/hunts` and `/~<org>`.
    * "nothing a failure says leaks onto the page: no stack, no row id, no key".
  * `failQuery(page, fnpath, reason?)` at the end of `e2e/support.ts`, with its doc block. It routes the page's Convex socket (`page.routeWebSocket`), notes the client's subscriptions to `fnpath`, and rewrites each answer to one into a `QueryFailed` frame: `[Request ID: <id>] <reason>`. `reason` defaults to `Server Error`, a production deployment's hidden failure. It returns `{ request_id, heal }`.
  * `src/components/PageFailed.tsx`: each failure goes to the console once (a module `WeakSet` of errors already reported). See *Deviations*.
* **Decisions taken**
  * **The triggers: (a) where it reaches, (b) for the rest, (c) never needed.**
    * (a) is `/~ghost_id/<hunt>...`. `orgFrom` takes an ident's label by shape and length, but `hunts.open`'s Zod door refuses a label ending `_id`, so the hunt, quiz and categories pages throw a real refusal from the real backend. The header test, three of the four pages and half the leak test use it.
    * (b) covers what no address can reach: a hidden failure with its request line, a cause that goes away, and the hunts list (`hunts:list` takes no arguments).
  * **`failQuery` fails every answer until healed, not "the next" one.** Under the dev server, StrictMode subscribes, drops and resubscribes, so "the next answer" fails a subscription the client has already dropped. Failing until healed also makes *Try again* deterministic.
  * **"No admin key" is proved by planting one.** The browser never holds the key: the only way one could reach the page is in the server's message. So the leak test plants key-shaped text, a row-id-shaped string and a stack in a crafted unplanned failure, and proves none of it is shown. I did not read `cli.env`.
  * **"Not one per render" gets its window from the redraw.** I tried a search-param change (`history.replaceState`): it does not redraw `PageFailed`, even with a deps-less effect. Clicking *Try again* and the page's recovery are the redraws, so the retry test counts across them: 1, then 2, then still 2.
* **Deviations**
  * **A product change, small, in `PageFailed`.** Under the dev server every failure reported twice: StrictMode mounts the boundary's component twice, and its effect ran each time. The build reported once, and the component's doc says "once". I made it hold under both, keyed on the error object, so a retry that fails again is a new report.
    * React's own docs advise living with doubled dev logs. The alternative is to revert this commit (`fix:`, alone) and have the spec expect 2 under dev. That would be a test of React's StrictMode, the kind thread 1 trimmed.
    * There is no unit test: Vitest renders no React here (see progress). The e2e spec proves it. Removing the guard fails two tests under dev.
* **Discoveries**
  * **Mutation-checked.** I ran the spec against three broken `PageFailed`s:
    * without the once-guard: the first two tests fail;
    * `error.message` in place of the summary: the first, fourth and fifth fail;
    * a dead *Try again*: the retry test fails.
  * **`/~ghost_id/<hunt>` says "This page couldn't be shown", not "No such hunt".** `orgFrom` checks `Userlabel`'s shape but not the `Unreserved`/`UnreservedToplevel` refinements `userlabel` adds, and `useHuntOpening`/`useHunt` pre-check the hunt label but not the org. That is a small product gap. The spec's `RefusedOrg` comment says that if it closes, those tests move to `failQuery`.
  * **An unplanned throw's summary is only "Error: Server Error" on a deployment that shows its reasons.** `Postmortem.of` keeps the first line, and the reason sits on the line after it. That is safe (the leak test pins it), though not informative: the console holds the rest.
  * **Under the dev server, Next's dev tools draw the error's stack in a shadow root**, and Playwright's `getByText` pierces shadow roots. A page-wide locator can match the overlay (my first probe did), so the spec scopes everything to the alert. The leak checks read `body` with `useInnerText`, which leaves shadow roots out.
  * Next 16.3's boundary hands `error.tsx` both `reset` and `retry` (a router refresh, then reset); `PageFailed` uses `retry`. A change of pathname also resets the boundary, which is why the header's way home clears it.
  * `failQuery` lets a `TransitionChunk` through unrewritten: the server chunks only large transitions, and a spec's hunt is small. If that ever bites, the test fails loudly (no alert), never silently.
* **For later threads**
  * Thread 2: the spec calls `huntOf`, `grid`, `page.reload()` and `page.goto()`, and nothing about how the fixture got its hunt. `failQuery` must be called before the page loads, so a fixture that lands on the quiz by `goto` is fine.
  * Thread 5: `PageFailed`, `error.tsx` and `postmortem` map to `failing-pages.spec.ts`. The `@smoke` test is "trying again draws the page afresh…".
* **For the Coach**
  * Keep the `PageFailed` once-guard, or revert its commit and accept two reports under dev?
  * Should an address refuse an org the server would refuse (`~ghost_id`), as it already does a hunt label? If so, it is a small follow-up, and the spec's three address-made failures switch to `failQuery`.
