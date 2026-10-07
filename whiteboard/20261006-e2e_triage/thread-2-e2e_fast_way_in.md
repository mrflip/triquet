# Thread 2: Make the way in fast: a backend-made hunt, and a session kept per worker (2026-10-06)

Branch `20261006-e2e_fast_way_in`. PR filed at landing; see the report. Suites: `pnpm justify` green
(4405 unit tests), and `pnpm e2e` proved: 239 passed, no flakes in the proving run.

## Measurement

| | Tests | Test-seconds | Mean | Wall | Load |
|---|---|---|---|---|---|
| Before, back to back (11038c3) | 239 | 1148 | 4.8 s | 179 s | 8.7 to 28 |
| After, back to back | 239 | 846 | 3.5 s | 137 s | 28 to 26 |
| After, the quietest run | 239 | 762 | 3.2 s | 121 s | 2.7 to 25 |

At equal load, about 26% fewer test-seconds and 23% less wall time; peak memory unchanged.
**Neither target is met:** the way in takes about 1.3 s, most of it the quiz page's own first
load under the dev server, and the mean test takes 3.2 s at its quietest. Every run, the way in
part by part, and the reasons are in `thread-2-measurements.md`: read it to compare a later
thread's numbers, or before working on the way in again.

## Built

* **`testing:makeHunt`** (`convex/testing.ts`).
  * It is an internal mutation beside `clearAll`, refused without `TRIQUET_CLEARABLE=yes`.
  * It makes a hunt for the ident it is given, through `newHunt` itself, as `new_hunt` does.
  * It lays the quiz out with optional `widgetings` and `columns`, then returns the quiz's
    address.
  * Widgetings go through `planWidgetingEdit` and the layout writers, the same code the gear's
    dialog uses. Columns follow the columns editor's defaults (`namesFor`, `AddedColumnWidthPx`).
  * Unit tests are in `tests/convex/testing.test.ts`.
* **`e2e/admin.ts`.** It reads the role's `cli.env` with `util.parseEnv`, and checks that the
  backend it names is `NEXT_PUBLIC_CONVEX_URL`. It calls `/api/run/<module>/<fn>` with
  `Authorization: Convex <key>`, and reads the reply through a Zod schema.
* **`e2e/support.ts`.**
  * A worker fixture, `keptSession`, says who the worker is once, at the front door.
  * Each `FreshHunt` test then gets a context holding that session. The fixture has the backend
    make its hunt, then goes straight to the quiz.
  * `test.use({ layout })` asks for the layout up front.
  * Every helper keeps its name and signature.
* **Conversions to an up-front layout:** `ishes`, `bots`, `chaining`, `estimates`, `asking`,
  `failures`, `panels`, and the smith's side of `reviews`.
* **`notes/testing.md`** and **`notes/deploy.md`** now describe the new way in.

## Decisions taken

* **Admin calls go through the HTTP API, not the client.** `ConvexHttpClient.setAdminAuth` is
  `@internal` in convex 1.46, so it is not in the published types. So I used the plan's fallback,
  the `/api/run` endpoint. Without the key the function cannot be found at all ("Could not find
  function"), which is the first lock the plan asked for.
* **The session is handed on from test to test, not copied each time.** Each page that opens on a
  stored session spends its refresh token: the Convex client forces a refresh once the server
  confirms the token it had cached. Convex Auth accepts a spent token for ten seconds after its
  first use; after that it revokes the whole token tree. Sharing one frozen copy logged every
  worker out within seconds. So each test leaves its context's storage for the next one
  (`KeptSessionT`). A worker runs one test at a time, and a failure replaces the worker anyway.
* **`otherVisitor` now passes empty storage.** Inside a test, `browser.newContext()` inherits the
  test's options, and that now includes the kept session.
* **The widgeting planner moved** from `src/state/widgeting-edit.ts` to `src/lib/`, so the server
  may import it. It is pure code that imports only lib and models. The editor's 180 px default for
  a new column moved to `AddedColumnWidthPx` in `src/models/layout.ts`.
* **`bots` stubs `/api/bots` and then reloads.** The page asks for the bots' status as it loads,
  so the stand-in has to be in place before a load.
* **A hunt that collides with another is tried again.** It is retried through `expect().toPass()`,
  for up to 10 s, rather than a loop of my own, and only on Convex's
  `OptimisticConcurrencyControlFailure` (the review's c82beb7); any other refusal fails at once. `newHunt` reads every hunt, so two made at once
  collide, and Convex's server gives up after a few retries. That collision is what caused a 404
  at `/undefined`, which looked like a flake. The reply schema now names such an answer instead of
  taking it for an address.

## Deviations

* **Four tests now sit inside a new `describe`, so their full titles change.** These are `ishes`
  "BUT NOT ishes mirrors..." and three `panels` tests under "with answer_reversed at work".
  `test.use` cannot be per test. Thread 5: the inner `test(...)` lines also moved two spaces right.
* **Some tests still add their layout through the dialogs.** I left `reviews` "shows a reviewer
  each question..." (`addColumns`), `panels` "the Widgets panel lists..." (its claim includes the
  panel reacting to an addition), and `client-first`, which the plan did not name.

## Discoveries

* **For thread 4: a second visitor must be `otherVisitor(browser)`.** A context made any other way
  holds the worker's session. If `assumeIdent` runs there, or on `page`, it changes who the
  worker's session is, and every later test in that worker fails. A spec about idents uses
  `startAt: null`.
* **Hunt creation contends across the whole app.** `newHunt` reads every hunt to enforce
  `HuntsInApp`, so any two hunts made at once conflict, through the UI as well.
* **The milestone flake** (`quiz-history` "an edit commits only...") did not come back in six full
  runs.
  * Another milestone test, "a milestone names the branch it marks", failed once under
    `pnpm test:e2e:built`. It tagged `main_` instead of `playtest_`, because the page was
    reloaded just before it read the hunt's branch.
  * I believe it is the same `ReadWaitMs` race, so I did not fix it.

## For the Coach

* **Hunt creation is a product question.** Every new hunt conflicts with every other one made at
  the same moment, because of the full read of the hunts table. A counter, or an aggregate, would
  avoid it. The suite now retries around it.
* **A faster way in is a product question too.** The Convex client's `initialAuthTokenReuse`
  option would stop each page load from spending a refresh token. That would let the suite share
  one frozen session copy, and save a round trip per load in production. I did not set it: it
  changes how production signs in.
* **The next lever is the second visitor.** `reviews`, `categories` and `routing` walk the front
  door for every friend they bring in. A second kept session per worker would save about 2 s per
  friend, but only in specs that are not about the friend's way in.
