# Chai in Vitest: what's missing, and why `.to.be.true` "doesn't work"

Sprint misc, thread 1. Research only: no installs, no config changes. Versions checked:
vitest 5.0.1 (5.0.2 is latest), chai 6.2.2 (bundled by vitest; latest), @vitest/eslint-plugin
1.6.27 (latest). Every claim below was proved with a throwaway test file, run under vitest,
eslint and tsc, and then deleted.

## Short answer

**Vitest lacks nothing here. The lint rule is what refuses it.** `expect(x).to.be.true` passes
and fails correctly at runtime, typechecks, and a typo (`.to.be.tru`) is caught by both tsc
and chai's proxy. The complaint comes only from `vitest/valid-expect` (from
`vitest.configs.recommended`, block `triquet/tests` in `eslint.config.mjs`), which reports
*"Matchers must be called to assert"* on every chai **property** assertion. The rule has no
option to allow them (options: `alwaysAwait`, `asyncMatchers`, `minArgs`, `maxArgs`).

There is nothing to install that fixes this inside `@vitest/eslint-plugin`. **Recommendation:
keep the rule and spell property assertions as method calls** (table below). That is what
the codebase already does, 166 times. Change `notes/testing.md` to match.

**Meanwhile, agents write `.to.eq(true)`**, and the other spellings in the table. Never
`.to.be.true` and never an `eslint-disable`.

## Why the rule can't tell them apart

`valid-expect` classifies each link in an `expect(...)` chain. Since upstream PR #920 (July
2026) it knows chai's language chains (`to`, `be`, `have`...), flags (`deep`, `not`...) and
dual-role words (`a`, `include`, `lengthOf`...). It does not know chai's *terminating properties*
(`true`, `false`, `null`, `undefined`, `ok`, `exist`, `empty`, `NaN`, `finite`, `frozen`...)
or vitest's own sinon-style properties (`called`, `calledOnce`). To the rule, a chain that ends
in an unknown, uncalled property is a matcher someone forgot to call. The PR calls its chai
support "intentionally conservative". No upstream issue asks for terminating properties.

This is the real trade. The rule's refusal of `.to.be.true` is the same check that catches
two bugs nothing else catches. Both pass silently at runtime:

| Mistake | tsc | vitest runtime | other lint | `valid-expect` |
|---|---|---|---|---|
| `expect(x).to.eq` (method never called) | silent | **passes** | silent | catches |
| `expect(x)` (no assertion at all) | silent | **passes** | silent | catches |
| unawaited `expect(p).resolves.to.eq(3)` | -- | fails | `no-floating-promises`, `sonarjs/async-test-assertions` | catches |
| `.to.be.tru` (typo) | catches | fails | -- | -- |

`@typescript-eslint/no-unused-expressions` is off in tests, since chai needs it off, so it
catches neither of the first two.

## Lint-clean spellings (all verified to pass, fail, lint and typecheck)

| Property form | Write instead | Note |
|---|---|---|
| `.to.be.true` / `.to.be.false` | `.to.eq(true)` / `.to.eq(false)` | Same `===` semantics |
| `.to.be.null` / `.to.be.undefined` | `.to.eq(null)` / `.to.eq(undefined)` | Same semantics |
| `.to.be.empty` (array, string, Set, Map) | `.to.have.lengthOf(0)` | chai's `lengthOf` reads `size` for Set/Map |
| `.to.be.empty` (object) | `.to.deep.eq({})` | |
| `.to.be.NaN` | `.to.eql(NaN)` | deep-eql treats NaN as equal to itself |
| `.to.be.ok` | `.to.satisfy(Boolean)` | Rare; prefer asserting the actual value |
| `.to.exist` | `.to.not.be.oneOf([null, undefined])` | Rare; same advice |
| `.to.have.been.called` / `.calledOnce` | `.to.have.callCount(n)` | vitest's chai-style spy method |

Failure messages barely differ: `expected false to equal true` against `expected false to be
true`.

## The rest of the survey: chai and its plugins under vitest 5

* **Core chai BDD**: all present. Vitest's `expect` is chai 6.2.2's, with jest matchers,
  snapshots, asymmetric matchers and spy assertions added through `chai.use`.
* **chai-subset**: no longer needed. Chai 6 has `containSubset` built in, and it is typed.
  Vitest's `toMatchObject` does the same job.
* **sinon-chai**: vitest has most of it built in (`ChaiStyleAssertions`). There are four
  properties: `called`, `calledOnce`, `calledTwice`, `calledThrice`. The rest are methods:
  `callCount(n)`, `calledWith`, `calledOnceWith`, `lastCalledWith`, `nthCalledWith`,
  `returned`, `returnedWith`, `returnedTimes`, `lastReturnedWith`, `nthReturnedWith`,
  `calledBefore`, `calledAfter`. Only `thrown` is missing (a TODO upstream). The methods are
  lint-clean. The properties are not, for the reason above.
* **chai-as-promised**: `eventually` is absent (*Invalid Chai property: eventually*).
  Vitest's `resolves`/`rejects` cover it, and chai chains after them work, as in
  `await expect(p).resolves.to.eq(3)`. A **property** after them breaks:
  `await expect(p).resolves.to.be.true` fails with "not awaited" plus an unhandled rejection,
  because a getter can't return the promise. That is another reason for method forms.
  `rejects.to.throw('boom')` runs, but tsc refuses the string argument, so the note's
  `rejects.toThrow(...)` exemption is right.
* **chai `assert` API**: available as `import { assert } from 'vitest'` and as
  `expect.assert.*`, which narrows types. Our `vitest/expect-expect` override lists its own
  `assertFunctionNames` without `assert`, so a test using only `assert.isTrue(...)` is
  reported as having no assertions. It is a side note, since nobody uses `assert` today.
* **Other chai plugins** (chai-dom, chai-string, chai-http): not bundled. Any of them would be
  an install, registered with `chai.use` through `import { chai } from 'vitest'` in
  `tests/support/setup.ts`. We need none of them.

## Options for the Coach

1. **Recommended: keep the rule, change the note.** Edit one line of `notes/testing.md`
   (line 17). Replace `` `to.be.true` `` with `` `to.eq(true)` `` and add one sentence:

   > Chai's property assertions (`to.be.true`, `.null`, `.empty`, `.called`) work, but
   > `vitest/valid-expect` cannot tell them from a matcher left uncalled, so spell them as
   > calls: `to.eq(true)`, `to.eq(null)`, `to.have.lengthOf(0)`, `to.have.callCount(1)`.

   No code changes, and the existing tests already comply.
2. **Keep the property style: swap the rule.** In `triquet/tests`, set
   `'vitest/valid-expect': 'off'` and add `eslint-plugin-chai-expect` (Turbo87, 4.1.0 from
   April 2026, about 105k downloads a week, flat config supported, lint-only, so it doesn't
   leave vitest's runtime). Its `missing-assertion` catches the bare `expect(x)`. Its
   `no-uncalled-method` catches `expect(x).to.eq`, but only for methods named in its options
   (default: `throw`), so we would have to maintain a list (`eq`, `equal`, `eql`, `include`,
   `match`, `lengthOf`, `property`...). Unawaited async stays covered by
   `no-floating-promises` and sonarjs. It is a new dependency, a hand-kept list, and a
   weaker guard, all to save a few characters. I don't recommend it.
3. **Upstream, alongside option 1.** An issue or PR to `vitest-dev/eslint-plugin-vitest`
   asking `valid-expect` to accept chai's terminating properties and vitest's own `called`,
   `calledOnce`... The parser already keeps sets of chai words
   (`chaiLanguageChainProperties` and its siblings), so a fourth set is a small change.
   Filing on a third-party repo is the Coach's call. If it lands, option 1's sentence can be
   relaxed and nothing else changes.

## Adjacent, for whoever edits notes/testing.md

The tests use jest-style spy matchers 10 times: `toHaveBeenCalledOnce`,
`not.toHaveBeenCalled`, `toHaveBeenCalledWith`. The note doesn't forbid them, but they sit
oddly beside its "never `toBe`" rule. The chai-style, lint-clean equivalents are
`to.have.callCount(1)`, `to.have.callCount(0)` and `to.have.been.calledWith(...)`. Whether to
mandate them is a style call, not a correctness one.
