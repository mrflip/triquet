# ESLint setup review

Thread parked 2026-09-27, to open **after** `whiteboard/testing-practices.md` lands. The Coach has
seen things they think ESLint should have flagged and may be wrong about; this collects the
candidates so the review starts from a list.

Seeds noticed while reviewing the tests (not yet verified beyond what is stated):

* `e2e/**` is outside every test block in `eslint.config.mjs`: the vitest preset is scoped to
  `tests/**`, and no Playwright rules exist. Lint is clean on `e2e/` today, which is the point.
  `eslint-plugin-playwright` is proposed in the testing thread.
* `@typescript-eslint/no-unused-expressions` is switched off for the whole of `tests/**` so that
  chai's `.to.be.true` may be bare. `eslint-plugin-chai-friendly` switches it off only for chai
  chains. The relic notes dropped it as "a plugin with no role here"; that judgement predates chai
  being the house style.
* Nothing fences assertion style: a `toEqual` in `tests/` or a `to.equal` in `e2e/` passes lint.
  A `no-restricted-syntax` selector per directory is two lines.
* `vitest.configs.recommended` is right. The plugin's `prefer-to-be`, `prefer-to-have-length`,
  `prefer-equality-matcher` and `prefer-strict-equal` would fight chai; `configs.all` must never
  be adopted.
* The config's own 3b comment records a contradiction with STYLE.md over `no-non-null-assertion`
  and `ban-ts-comment`, "the Coach's to settle". Still open.
* To add: the specific things the Coach expected to be flagged.
