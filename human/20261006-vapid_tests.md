# 2026-10-06: Vapid tests, nominated (nothing here is deleted yet)

From thread 1 of sprint e2e_triage. I went over every test under `tests/` (146 files) and
`e2e/` (23 specs) against `notes/testing.md`, *Choosing Examples*: each case should tie to a
plausible failure mode. I left out the twenty e2e tests thread 1 deleted. You expected a
short list, and the e2e list is short. The unit list is longer, but it is mostly one pattern
over and over: a walk through a constant or a library, one `it` per value.

Verdicts: **cut**, **trim** (to the cases named), **keep, don't imitate**. Line numbers are as
of `20261006-e2e_trim`.

## The patterns other agents will copy

* **One `it` per member of a constant**, all down the same code path. These are the
  "pad 6, pad 7" tests: reserved widgeting labels, prefix lists, every error factory, every
  table under a lock.
* **A test of the library under the wrapper**: JSONata evaluating, Convex enforcing a schema,
  TypeScript's own type checking, `crypto.randomUUID` being distinct.
* **A title that restates the literal**: "is /my/hunts", "is eighteen widgets".

## Unit tests

| File and test | Why | Verdict |
|---|---|---|
| `tests/lib/types.test.ts`, the whole file | Each `expectTypeOf` restates the alias's own definition; the `@ts-expect-error` case tests TypeScript | cut |
| `tests/convex/hunts.test.ts`, "refuses while the quiz is locked" (13 times), and `tests/convex/writing/layout_actions.test.ts` (6 times) | The lock is checked in one place, centrally (`convex/authorize.ts`, `Approve.mayReviseQuiz`). Which kinds it covers is pinned by the matrix in `tests/lib/approve.test.ts` (:367, :381), and the wiring by `tests/convex/authorize.test.ts` (:338). The clearest copy-me pattern in the suite | trim to 2 |
| `tests/lib/vv/checks/numbers.test.ts:155-173`, `NotNumberlike` against every numberlike check | 12 values x 8 checks = 96 `it`s, over two builders. Only `unumstrOrBlank` is used by app code | trim to one check per builder |
| `tests/models/widgeting.test.ts:44`, "refuses the reserved label ${label}" | Loops over all 17 reserved labels on one enum path; the list itself is pinned at :10. `tests/lib/widgeting-edit.test.ts:75` (moved from `tests/state/` by thread 2) repeats it for 4 | trim to 2, and to 1 |
| `tests/lib/vv/patterns.test.ts:113-121`, one case per reserved prefix | Membership of a constant, one regex path | trim to 2, keeping the near-misses (`insecure`, `team_otter`, `stafford`) |
| `tests/lib/routes.test.ts:52-68` (`switchIdentPath`, `huntsPath` "is /my/hunts", `aboutPath` "is /about") | Each function returns a literal, and the test restates it | cut |
| `tests/lib/routes.test.ts:7-40`, the path wrappers | One-line wrappers of `Addresses.urlOf`, which `tests/lib/addresses.test.ts` covers | trim to one |
| `tests/lib/errors.test.ts:39`, "returns the error rather than throwing it", once per factory | Cannot fail unless the test before it (:26), which calls `make('nope')`, already has | cut |
| `tests/lib/errors.test.ts:184`, "is throwable and catchable as its own flavor" | JavaScript's `throw`; `instanceOf` is covered elsewhere | cut |
| `tests/lib/formulas.test.ts:5-17`, the `evaluate` table | On success `evaluate` is `jsonata(...).evaluate`. "The letters of a word reversed" and "a sum down a list of objects" test JSONata | trim to 3, keeping "summing nothing is nothing, not nought", which the sums rely on |
| `tests/convex/schema.test.ts:191`, "refuse a row with a field of the wrong type", per table | Tests that Convex enforces a schema; each table's shape is pinned at :174 and :178 | trim to 1 |
| `tests/lib/sheets.test.ts:64-74`, the `cellTextOf` table | Re-runs `tests/models/widgeted.test.ts:39-48`; `cellTextOf` delegates to it in one line | trim to 1 |
| `tests/lib/sheets.test.ts:106`, "heads the standard layout with its question fields first" | Passes only because of alphabetical order, which :100 already proves; the reason in the title is a coincidence | cut |
| `tests/models/persona.test.ts:28` and `:33`; `tests/models/category.test.ts:60` and `:65` | Table lookups asserting the constant's own literals (`defaultIdxOf` is `indexOf`, walked through 0, 8, 16, 23) | cut |
| `tests/lib/personas.test.ts:20-42`, `MasieCases` | Own, opposite and no-category, each walked through easy, medium and hard: a table lookup pinned in `persona.test.ts:17` | trim to one difficulty each, keeping the distance cases |
| `tests/models/ish.test.ts:7-14` | "A magnitude phrase carrying its whole value" and "a fraction, which stays fractional" cannot fail for those reasons: the validator is a non-empty text and a number | trim to 4 (digits, non-Latin, zero, negative) |
| `tests/lib/vv/checks/contact.test.ts:63-71`, twelve `takes ${addr}` | Same regex branch several times; nothing imports the module | trim to 5, or cut with the module |
| `tests/lib/chain.test.ts:96`, "still places a question whose backward path was taken by a sibling" | Same fixture as :89, and asserts only a length that :89's `deep.eq` implies | cut |
| Single pads: `tests/lib/notices.test.ts:7`, `tests/components/panels/spread-table.test.ts:105`, `tests/lib/rank.test.ts:23`, `tests/lib/wheel.test.ts:159` and `:161`, `tests/lib/columns.test.ts:50`, `tests/lib/ids.test.ts:12`, `tests/models/question.test.ts:151` ("mints a distinct id" tests `crypto.randomUUID`) | A second value down the path the first already walked | cut |

Two that are **wrong rather than vapid**: they assert less than their titles say.

* `tests/lib/personas.test.ts:77` promises "nor below the worst or above the best", but asserts only `within(0, 1)`.
* `tests/lib/vv/reporting.test.ts:83` ("keeps zod wording for a union") asserts only a non-empty string. `:101` ("brackets a key that is not an identifier") would pass unbracketed.

Fix the assertions. Separately, `rank.test.ts` has no case for `qnumOf`'s non-finite branch.

Keep, don't imitate (constants restating their literals): `tests/models/widget.test.ts:15` and
`:25`, `tests/models/seeds.test.ts:39` ("is eighteen widgets") and `:71`,
`tests/models/estimate.test.ts:79`, `tests/lib/inspectify.test.ts:135`.

## e2e

| Spec and test | Why | Verdict |
|---|---|---|
| `grid.spec.ts`, "adding a question appends a blank one" | "a question added to a folded grid is open" asserts the same six rows, and more | cut |
| `widgets.spec.ts`, "a column is dragged into a new place by its handle" | Same `dragOnto` path as the two edge-of-row drops after it | cut |
| `panels.spec.ts`, "LL Export holds the quiz in the league's format" | The translation is pinned in `tests/lib/ll-smith-export.test.ts`; the panel's wiring is proven by "LL Export's mode, going live at first" | cut |
| `brand.spec.ts`, "downloads a brand asset when it is clicked" | A static `<a download>`; the filename asserted is the link's own | cut |
| `routing.spec.ts`, "asks a visitor who has not said who they are" | A static heading that three other tests assert on their way past | cut |
| `ishes.spec.ts`, "extracting lists every span with its value and kind" | Asserts the stub's JSON echoed into the cell; the two tests after it depend on the extraction landing | cut |
| `ishes.spec.ts`, "editing the clueing leaves the sums as they were until it is asked again" | Can fail if an edit clears the sums, but the stub answers the same on every ask, so "until it is asked again" is never tested | re-stub after the edit, or retitle |

## Code that nothing imports, with suites of its own

Not vapid tests, but upkeep: `src/lib/props.ts` (189 lines of tests),
`src/lib/vv/checks/contact.ts`, all of `vv/checks/numbers` except `unumstrOrBlank`, and many of
the `vv/checks/strings` checks (camel, snake, keyish, the alnum family and more). Cutting the
code takes its tests with it. That is a decision about the toolchest, so it is yours.
