---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.ts"
  - "**/*.spec.tsx"
  - "**/__tests__/**/*.{ts,tsx}"
  - "tests/support/**"
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
  `eslint-plugin-chai-expect` catches a bare `expect(x)` or a method left uncalled; it knows only
  the methods in `ChaiMethods` (`eslint.config.mjs`), so a new one goes on that list. Never a
  property after `resolves` or `rejects`: `await expect(promise).resolves.to.eq(true)` is the one
  place the method form stays.
* **Playwright** for everything in `e2e/`, with its web-first assertions on locators:
  `notes/e2e.md` has the suite's conventions, and loads itself there.

`/vitest` (under `.claude/skills/`) is a reference for the runner, loaded only when named: fake
timers, `test.extend` fixtures, snapshots, concurrency. A reference that shows `toBe`/`toEqual`
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
Vitest's `convex` project (the edge runtime). The helpers are `tests/support/convex.ts`, each with
its doc block: `openTester()` for a fresh, empty deployment, `seedHunt` for a hunt with a smith on
it and the ways to act on it and read it back, and the sessions a test calls as (`identified`,
`signedIn`, the bare `tt`). What the doc blocks do not say:

* Reach past the functions with `tt.run(async (ctx) => ...)`, which must hand back a Convex value
  (no `Map`).
* Ids in an action must be ids: a malformed one is refused at Convex's door, so a test of "an id
  of no question here" uses a real question of another hunt.
* `_creationTime` never ties under convex-test, so no test pauses between writes.
* Action tests seed a hunt tree as a fixture, act, and compare trees; row ids are never asserted
  on, except where the key itself is under test.
* A test of a write that deletes or relinks rows ends with `expectSound(tt)`
  (`tests/support/soundness.ts`), which reads every table back and fails on anything that no
  longer holds together. Each check is a named entry in `SoundnessChecks`; a new kind of
  integrity is a new entry there.

The browser's hooks (`src/state/use-*.ts`) are not unit tested: what they add to the functions is
React's and Convex's client's, and the e2e suite drives them. Anything pure inside one (`placeIn`
in `use-hunt`) is exported and tested on its own.

A view is unit tested only for what it chooses to say: a notice in place of the page, a dash in
place of a zero. Such a test is a `tests/**/*.test.tsx`, and reads the view through `renderedText`
(`tests/support/rendering.tsx`): rendered once by `react-dom/server` under the `node`
environment, with no DOM, no effects and no testing library. Anything a view does in a browser --
focus, clicks, effects, heights -- is the e2e suite's.

## Validation Boundaries

Remember which side of a validation boundary the code under test sits on (`notes/guidelines.md`).
A module entrypoint should be tested with generous, sloppy, sketch-shaped input -- that's its
job. Internal functions past the validation boundary are entitled to assume clean data; don't
write paranoid tests feeding them garbage they were never meant to see.