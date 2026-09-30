# ESLint setup review

Thread parked 2026-09-27; `whiteboard/testing-practices.md` has since landed, so this can open.
The Coach has seen things they think ESLint should have flagged and may be wrong about; this
collects the candidates so the review starts from a list.

Seeds noticed while reviewing the tests (checked against `eslint.config.mjs` on 2026-09-28):

* ~~`e2e/**` is outside every test block~~ Landed: `eslint-plugin-playwright`'s
  `flat/recommended` on `e2e/**`, with the web-first, count, length and no-wait rules as errors.
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

Seeds from the audit of 2026-09-28 (`whiteboard/20260928-audit/`), each a STYLE.md rule the
config could hold:

* **Quotes.** STYLE.md now says `"` for a string likely to hold an apostrophe and for every
  `it`/`describe` title; `@stylistic/quotes` is `off` (line 99). The Coach's planned sweep of
  existing titles is a regex; `quotes: ['error', 'single', { avoidEscape: true }]` would hold
  the first half afterwards (it forbids `'isn\'t'` and allows `"isn't"`), and a selector on
  `CallExpression[callee.name=/^(it|describe)$/] > Literal` the second.
* **Convex's builders are `cvx`.** A selector beside the `CVX` one (line 212) on the callback
  handed to `withIndex`, `filter` or `withSearchIndex` whose parameter is not `cvx`; and `qq`
  anywhere, since STYLE.md reserves `qn` for a question and forbids `qq` so a stray one is seen.
* **`React.*` as a global namespace** (`React.JSX.Element`, `React.ReactNode`) in components
  that never import `React`: a `no-restricted-syntax` selector on
  `TSQualifiedName[left.name="React"]` when no import binds it, or simply require the type
  import. Audit §1, *Framework practice*; the Coach has not said.
