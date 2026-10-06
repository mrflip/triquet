# Thread 4: Cover the stats page and the other uncovered corners, lightly (2026-10-06)

Branch `20261006-e2e_light_gaps`. PR filed at landing; see the report. Suites: `pnpm justify` green
(4406 unit tests, 7 of them new). The new e2e tests pass under the dev server (`routing`, `stats` and
`widgets` whole, 88 of 88, and the new routing tests 3 times over) and under the build (`pnpm test:e2e:built`, all 5 new tests). Proved
after catching up onto thread 5: `pnpm e2e` full, 249 passed, 0 failed, no flakes, in 202 s wall,
1267 test-seconds, load 25.2 as it began, build cache seeded (lane 2). `pnpm justify` there: 4471 unit tests.

**No new spec file of a new name.** `e2e/stats.spec.ts` is new, and thread 5's `SpecCorners` already
maps it. The collaborating tests went into `e2e/routing.spec.ts`, not a `collaborating.spec.ts`, so
no corner line is needed.

* **Built**
  * `e2e/stats.spec.ts`, two tests.
    * "names the build and what the browser runs, says it is connected, and shows an admin the
      backfills", **tagged `@smoke`**. It checks the stamp's time, commit and Node; Next, React and
      Convex against the versions the checkout installs; the backend's address; "yes, N times so far";
      and a backfills table with at least one row.
    * "tells a browser that has not said who it is nothing of the backfills": the "Only an admin sees
      these" line, and no table.
  * `e2e/routing.spec.ts`. In *a link handed to a friend*: "makes a reviewer a smith by taking them
    off and putting them back on as one". It goes from playtest, to not on the hunt, to `!edit`, with
    the member listed once. A new *two smiths on one quiz* describe holds two tests:
    * "lets the author make edits that reach a friend made a smith": the direction routing lacked.
    * "keeps the later of two edits to one cell on both pages, loses nothing beside it, and alarms
      neither".
  * Unit tests that render a view: `tests/support/rendering.tsx` (`renderedText`, with its own
    test), `tests/app/providers.test.tsx` (`SyncProvider` with no URL, and with one) and
    `tests/components/cells/readouts.test.tsx` (the dash: missing, null and `''` read as `–`, and
    `0` reads as `0`). `vitest.config.ts`'s unit project now includes `*.test.tsx`.
    `notes/testing.md` says when such a test is wanted.
  * **Taken on at the orchestrator's request**, in a commit of its own: `e2e/widgets.spec.ts` "every
    dialog has a close button…" now looks up `Close` with `exact: true`, so it never matches a
    "Closed…" title (thread 3's flake).
* **Decisions taken**
  * **The suite is already an admin.** `Actor.isAdmin` is `true` for every ident, and
    `Approve.may('read_backfills')` refuses only an actor that has asserted no username. So
    `assumeIdent` then `/stats` is the admin view. "Anyone else" today means a browser that has not
    said who it is, and that is the non-admin test. If `isAdmin` ever narrows, the admin test fails
    loudly, and the suite then needs a way to be an admin.
  * **React rendering under Vitest: `react-dom/server`, no new package.** `renderToStaticMarkup`
    in the existing `node` environment, with no jsdom or happy-dom and no Testing Library. That is
    enough for "which does a view say", and it is what both cases need. `notes/stack.md` is
    unchanged: nothing was added. A test that needs effects or events would need a DOM environment,
    and that is the moment to choose one.
  * **The stats spec's React version is Next's own.** App Router pages run the React Next bundles
    (`19.3.0-canary-…`), not `react` from package.json (`19.3.0`). The spec reads
    `next/dist/compiled/react`'s `version`, and a comment says why.
  * **"Neither page alarms" filters on `AppNotices.changeNotKept`.** That headline is the only one a
    quiz page's alarm has. A bare `getByRole('alert')` also matches Next's route announcer, which
    holds text after a client navigation.
  * **"The later edit wins" is ordered without a timer.** Both type into one cell, and the author
    leaves it first. The author then makes a second edit, and once the friend's page shows that edit,
    the first has arrived too. The friend's box still holds what they typed, and their leaving it
    commits the later edit. Mutation-checked: with `useDraft`'s editing guard removed, the test fails
    ("the earlier edit").
* **Deviations**
  * The two-smith and member tests are in `routing.spec.ts`, not a new `collaborating.spec.ts`
    (the plan allowed either). They sit beside the friend-link tests they extend, and they spare the
    sprint a new corner line.
* **Discoveries**
  * `Stats.tsx` says "Only an admin sees these: choose a username first." It is accurate today, since
    every ident is an admin. Once `isAdmin` narrows, a named non-admin will be told to choose a
    username they already have. That is a small copy question for whoever narrows it.
  * Emotion writes `<style>` elements into server-rendered markup. `renderedText` strips them first.
* **For the Coach**
  * Unit-rendering a view is now a pattern (`renderedText`). Its line in `notes/testing.md` keeps it to
    "what a view chooses to say". Say if you would rather it not spread.
