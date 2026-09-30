# Sprint misc: progress

The running handoff. It is newer than `misc-plan.md` wherever the two disagree. Workers add
their sections newest first, below the status table.

**Status:** thread 1 underway.

| # | Thread | Status | Branch | PR |
|---|--------|--------|--------|----|
| 1 | Chai in vitest: what's missing | complete | `20260930-chai_in_vitest` | #58 |
| 2 | Hard-to-miss alert for major problems | pending | | |
| 3 | e2e against a production build | pending | | |
| 4 | Formulas see the smith's note, hunt and realm | pending | | |

## Thread 1: Chai in vitest (2026-09-30)

Branch `20260930-chai_in_vitest`, PR #58, stacked on #54. Suites: typecheck and lint clean, unit 2233/2233, e2e 185/185 (documents only; run for form).

* **Built**: `whiteboard/20260930-misc/chai-in-vitest.md`, the findings and the options,
  with the exact edit to `notes/testing.md`. Read it before writing a test that asserts on a
  boolean, null, an empty collection or a spy, or before touching the `triquet/tests` lint
  block. The PR holds documents only.
* **Decisions taken**: none were needed in code. The finding: vitest's runtime supports
  `expect(x).to.be.true` fully (passes, fails and typechecks). Only the lint rule
  `vitest/valid-expect` refuses chai's property assertions, and it has no option to allow
  them. There is no package that fixes this inside `@vitest/eslint-plugin` (1.6.27, latest).
* **Discoveries**:
  - **Style for threads 2 onward: `.to.eq(true)`**, `.to.eq(null)`, `.to.have.lengthOf(0)`,
    `.to.deep.eq({})`, `.to.eql(NaN)`, `.to.have.callCount(n)`. Never `.to.be.true`, and no
    `eslint-disable` for it. This matches the recommendation, so nothing needs rewriting
    when the Coach rules unless the Coach picks option 2.
  - Chai 6 has `containSubset` built in. `eventually` (chai-as-promised) is absent; use
    `await expect(p).resolves.to.eq(...)`. A *property* after `resolves` breaks at runtime.
  - vitest has most of sinon-chai built in: `called` and `calledOnce` are properties, so
    lint refuses them, while `callCount(n)`, `calledWith(...)` and the rest are methods and
    lint-clean.
  - Our `vitest/expect-expect` override omits `assert`, so a test asserting only with
    `assert.*` would be reported as having none. Nobody does that today.
* **For the Coach**:
  - Recommended: keep `vitest/valid-expect` and change `notes/testing.md` line 17 from
    `to.be.true` to `to.eq(true)`, adding one sentence (the exact text is in the report).
    The rule's refusal is the same check that catches `expect(x).to.eq` with no call, and a
    bare `expect(x)`. Both pass silently otherwise.
  - Optional: file an upstream issue asking `valid-expect` to accept chai's terminating
    properties. Filing on a third-party repo is your call.
  - The alternative, `eslint-plugin-chai-expect` in place of `valid-expect`, is described in
    the report and not recommended.

