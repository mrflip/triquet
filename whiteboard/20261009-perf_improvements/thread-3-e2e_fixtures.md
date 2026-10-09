# Thread 3: The specs' way in: fixtures over the front door (2026-10-09)

Branch `20261009-e2e_fixtures`. PR filed at landing; see the report. Suites: `pnpm justify` green
(5610 unit tests); `routing`, `reviews` and `categories` green in all six runs of this branch,
alone and together. Not yet proved: `pnpm e2e --touched` runs at landing.

## Measurement

Test-seconds, back to back on lane 3 at about the same load (33 to 36): **routing 298 to 250 s
(down 16%), reviews 83 to 53 s (down 36%)**, categories 35 to 33 s. The base timed out three
times in two runs of these specs under load; this branch never did, in six. Every run, and why the
gain is smaller than the way in alone suggests, is in `thread-3-measurements.md`: read it to
compare a later thread's numbers.

## Built

* **`testing:putOnHunt`** (`convex/testing.ts`). It puts an ident on a hunt by org and hunt
  label with a role, through `addHunting`, the code behind the Members panel's `add_hunting`.
  Like `makeHunt`, it is internal and refused without `TRIQUET_CLEARABLE=yes`. Its unit tests,
  in `tests/convex/testing.test.ts`: puts on, changes a role without a second hunting, refuses an
  unknown ident, a missing hunt, and a deployment that is not clearable. `countsIn` now counts
  `huntings` too.
* **`putOnHunt(hunt, label, role)`** (`e2e/admin.ts`) calls it.
* **The `friend` and `friendLabel` fixtures** (`e2e/support.ts`). The worker-scoped `keptFriend`
  is a second ident. It says who it is at the front door once per worker, and its session is
  handed on from test to test the way `keptSession` is. `friend` is a page in a context of that
  session, open on nothing. The friend is a stranger to each test's hunt until a spec puts them
  on it. Both kept sessions are now made by one helper, `sessionMadeAtFrontDoor`.
* **`sessionLeftBy`**, a guard for the hand-on. At teardown, every page of the context that opened
  the app is given up to 5 s to exchange the refresh token the test began with. A test that ends
  a moment after its friend's first load would otherwise hand on a token the server has already
  spent. Over 30 probed teardowns it waited 2 to 200 ms, and never ran out of time.
* **`routing.spec.ts`**:
  * The file-wide `startAt: null` is gone. `the front door` and `the hunts` keep it per describe.
  * Two tests keep it in an anonymous `test.describe(() => ...)`, so their titles are unchanged:
    *opens its own page from its title in the hunts list* and *lists every hunt history this
    browser holds*.
  * The other 28 begin at the fixture's hunt.
* **`reviews.spec.ts`**: the reviewer is the friend, put on by `putOnHunt`.
* **`categories.spec.ts`**: the reviewer and the stranger are both the friend.
* **The notes**: `notes/testing.md` (the friend, `putOnHunt`, the anonymous describe) and
  `notes/deploy.md` (the third testing function).

## Coverage kept: which test still walks each way in

* **The front door**: every `the front door` test, and each worker's two kept sessions.
* **The front door, entered from a link** (`?then=`): *brings a friend who has not said who they
  are through the front door and back*, and *are shown only to someone who has said who they are*.
* **The hunts list and *+ New hunt***: all four `the hunts` tests, *opens its own page from its
  title in the hunts list*, *lists every hunt history*, and `client-first`.
* **The Members panel, adding a Smith**: *opens the quiz for the friend the moment a smith adds
  them*, and *makes a reviewer a smith by taking them off and putting them back on as one*. That
  second test puts the friend back on as a Smith.
* **The Members panel, adding a Reviewer**: the first add in *makes a reviewer a smith…*.
* **The Members panel, removing a member**: *lets a smith take a member off*, and *makes a
  reviewer a smith…*.
* **The Members panel's refusals**: its three tests, unchanged apart from their way in.
* **A second visitor nobody has seen, through the front door and then a link**: *turns a second
  browser away…*, *brings a friend…*, and reviews' second reviewer in *shows a reviewer the other
  reviewers' shared reviews…*.

## Decisions taken

* **`putOnHunt`, not `addMember`.** Lint refuses a non-function const named `add…`
  (`unicorn/no-non-function-verb-prefix`). "Putting someone on" is also the vocabulary's own phrase
  (`notes/vocabulary.md`, *hunting*).
* **The friend serves as the stranger** where a test needs one. It is on no hunt of the test's.
  Two tests (*opens in the mode the visitor works in…* and categories' *shows a reviewer the total
  order…*) now check the stranger first, then put the friend on as reviewer. They make the same
  claims, in a different order.
* **`friend` comes with a separate `friendLabel`**, rather than as one object. Tests read
  `friend.goto(...)` exactly as they read the old `otherVisitor` page.
* **`the hunts` keeps the front door whole.** Two of its tests count the ident's hunts or click
  its only gear. *list each hunt with its quizzes* could move, but the plan keeps the hunts list's
  own way in.
* **Moved, although not named in the plan**: *says there is no such hunt, once the server has had
  its say*. It only needed a session.

## Deviations

* **The teardown guard also applies to the worker's own `keptSession`** (pulled forward; it is
  the same hand-on). There, the exchange it waits for has always happened already.
* **Categories' reviewer test moved too.** The plan named "anything else that adds a member
  through the Members panel", and this was the one.

## Discoveries

* **Under load, the base's two-visitor tests time out.** Three timeouts in two runs, all in tests
  that walked a second front door and the Members panel. None in this branch's six runs.
* **The server's log shows `notPermitted` errors during the member-removal tests**, in both base
  and branch runs. These are writes by a page whose member was just taken off. They are expected,
  and the tests pass.
* **For later specs**: a spec that needs a second visitor should ask for `friend` and call
  `putOnHunt`. Thread 2 may want `putOnHunt` beside its own `testing` functions; it lives at the
  end of `convex/testing.ts`.
