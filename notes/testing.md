---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.ts"
  - "**/*.spec.tsx"
  - "**/__tests__/**/*.{ts,tsx}"
---

# Testing Conventions

Vitest, with chai-style assertions (`expect(foo).to.eq(bar)`). Style rules from `STYLE.md` apply
in test files too -- semicolonless, single quotes by default, braced blocks, no single-letter
names.

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

## Rows and Policies (Jazz)

Anything that writes or subscribes to rows is tested against a real Jazz database from
`jazz-tools/testing`, not a mock: `createPolicyTestApp` by default (an in-process server in tens
of milliseconds, with our permissions enforced), `startLocalJazzServer` when sync or several
clients are the behaviour under test. `testApp.as(session)` is one account's database; the
session is `{ user_id, issuer, claims, authMode: 'local-first' }`, typed as
`Parameters<PolicyTestApp['as']>[0]` since Jazz does not export `Session`; `tests/support/jazz.ts`
has `openTestApp()`, `sessionFor(user_id)`, `freshDb(testApp)` (an account no other test
shares) and `seedWorkspace(testApp, workspace)`, which writes a workspace tree into a fresh
account and hands back `act` (run an action through `perform`) and `read` (the tree its rows now
make up). Action tests seed a workspace tree as a fixture, act, and compare trees. Don't open a memory
driver by hand: it skips permissions, and needs a stand-in account store. Assert user-visible rows, subscription
deliveries, and accepted or rejected writes through the public API. Tell a query that has not
delivered yet apart from one that delivered nothing. Request the durability tier the assertion
depends on, and no higher. Row ids are never asserted on; find rows by label. `$createdAt`
counts milliseconds, so a test that orders two inserts by it waits a few between them. A write
to a row the account cannot read throws on the spot; a delete is refused only at the edge, so
assert it with `expectDenied`. Read with `LocalFirst` (from `state/quiz-rows`): edge-tier reads
stall once the shared test server holds many accounts. A row read back at once may not carry
`$createdAt` yet; wait a moment before asserting on it.

A change lands a moment after the author makes it, so a spec asserts with retries (`expect`
on a locator, or `expect.poll` around a read), never a one-shot read straight after an action,
and waits with `waitUntilSaved` before it reloads.

The e2e suite runs only as `pnpm test:e2e`, under Doppler's `dev_e2e` (its own port, build
directory and Jazz server); Playwright refuses to start locally otherwise. Each
spec's fresh browser context is a fresh local-first account, and that isolates specs only
because every table is creator-owned. A table readable across accounts would leak rows between
specs through the shared server; then wipe `data/jazz-e2e/` before a run.

## Validation Boundaries

Remember where the code under test sits in the Sketch/DNA/Real/Live lifecycle (`notes/guidelines.md`).
A module entrypoint should be tested with generous, sloppy, sketch-shaped input -- that's its
job. Internal functions past the validation boundary are entitled to assume clean data; don't
write paranoid tests feeding them garbage they were never meant to see.