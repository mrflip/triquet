# vv testplan

For each chunk of code, the files and their corresponding tests come over in two phases:

1. Light-touch transfer, honoring the old contract directly: jest+chai -> vitest, import paths,
   filenames. Commit -- the infomercial's "before" photo.
2. Execute the changes to meaning and mechanics described below. Commit -- the "after" photo.
3. (Epoch II) transfer and modify the code these tests exercise.

Sequenced against the four waves: **W1** inspectify, **W2** reporter, **W3** checks, **W4**
Validator. A test file is transferred in the wave that owns the code it exercises.

Good news on mechanics: vitest's `expect` carries the whole chai surface these tests use --
`property()`, `to.have.keys`, `to.include.keys`, `to.be.an('error')`, `.of.length()`, `to.throw`,
`to.be.empty`, `to.eql`. Verified by probe. `it.each` / `describe.each` with `%s` and `$prop`
templating also port unchanged. So phase 1 really is mostly imports and filenames.

## Naming and location (applies to every file transferred)

`/tests` mirrors `/src`, kebab-case, per `notes/testing.md` and `STYLE.md`:

| relic | new home | wave |
|---|---|---|
| `tests/checks/HostnameTypechecks.test.ts` | `tests/lib/vv/patterns.test.ts` | W3 |
| `tests/checks/BasicStringChecks.test.ts` | `tests/lib/vv/checks/strings.test.ts` | W3 |
| `tests/checks/BoolishValidations.test.ts` + `tests/validation/Zodify.test.ts` | `tests/lib/vv/checks/boolish.test.ts` (merged) | W3 |
| `tests/checks/DateishValidations.test.ts` | `tests/lib/vv/checks/time.test.ts` | W3 |
| `tests/checks/NullishValidations.test.ts` | `tests/lib/vv/checks/nullish.test.ts` | W3 |
| `tests/checks/SpecialChecks.test.ts` | `tests/lib/vv/checks/contact.test.ts` | W3 |
| `tests/checks/URLFixtures.ts` | `fixtures/vv/urls.ts` | W3 (data only) |
| `tests/fixtures/ExampleValues.ts` | `fixtures/vv/examples.ts` | W2 |
| `tests/validation/ValidationReport.test.ts` | `tests/lib/vv/report.test.ts` | W2 |
| `tests/validation/ZodFormatting.test.ts` | `tests/lib/vv/report-messages.test.ts` | W2 |
| `tests/validation/Validator.test.ts` | `tests/lib/vv/validator.test.ts` | W4 |
| `tests/validation/ChecksPackaging.test.ts` | -- dropped, see Removed | -- |
| `tests/checks/URLValidation.test.ts` | -- parked, see Removed | -- |

`tests/TestHelpers.ts` **does not exist in the relic** though every file imports it. We rebuild
only what survives: `Examples` (from `ExampleValues.ts`) and nothing else. `TH.see`,
`TH.prettify`, `TH.wd`, `TH.kfy` are debug-print helpers used inside `if (mismatch) console.warn`
branches -- those branches go away (see "Better practices"). `TH.checkSnapshot` is replaced by
vitest's native `toMatchSnapshot` where a snapshot is still wanted.

## LGTM

Transfer the mechanics directly:

* **`HostnameTypechecks.test.ts` -- the best file in the relic.** ~500 hostnames, IPv4 and IPv6
  addresses tagged valid/invalid with explanations, from a known public corpus, plus a tidy S3
  bucket-name block. It exercises `CO.HOSTNAME.re` / `IPV4HOST` / `IPV6HOST` / `HOSTORIP` /
  `S3BUCKET` -- plain regexes, no Zod anywhere -- so the zod3→4 move cannot touch it. Port
  essentially verbatim; it is pure profit.
* **`URLFixtures.ts`** (812 lines): valuable corpus, comes over as fixture data even though the
  test that consumes most of it is parked.
* **`ExampleValues.ts`**: good fixture, comes over. Drop the `Luxon.Settings.defaultZone = "utc"`
  global side-effect at import time -- a fixture file should not reconfigure a library for the
  whole suite. Set the zone per-construction instead.
* **`NullishValidations.test.ts`** -- `notund` / `notnil`. Small, sharp, exactly the
  unset/undefined/null distinction we most want to keep. Port whole, minus `jest.setTimeout`.
* **`SpecialChecks.test.ts` -> `contact.test.ts`**, the `email validation` and `extkey` blocks:
  a well-chosen corpus (IDN `xn--` domains, segment-length limits, plus-addressing, delimiter
  placement) with intent written in the comments. The commented-out `cursoring` and `Path Types`
  blocks do not come (see Removed).
* **`ZodFormatting.test.ts`'s `InvalidScenarios` table** is the specification of the error
  reporter -- ~120 rows of input → exact message. This *is* wave 2's acceptance criteria. Port
  the table as data in phase 1 even though it cannot pass until the reporter exists.
* **`ValidationReport.test.ts`**: the report-object shape (`ok`, `act`, `val`, `tmi` on success;
  `badprops`, `messages`, `message`, `extensions` on failure). Port; expect churn in phase 2 once
  we simplify `extensions`.

## Changes to match contract

Phase 2 changes driven by decisions you've already made:

* **No monkeypatch.** `.cast()` / `.check()` / `.report()` / `.checkname` reach every test through
  `declare module "zod"` augmentation of `ZodType`. That's the thing we're not bringing. Every
  `checker.cast(x)` call site therefore changes shape. Two candidates, and I lean hard to the
  first: **(a)** the kit returns wrapped checkers carrying these methods -- keeps
  `medstr.cast(val)` reading exactly as it does today, no global patching, and composes with the
  existing `callable()` wrapper in `src/lib/validator.ts`; **(b)** free functions
  `cast(medstr, val)`, which is honest but noisier at ~200 call sites. Assuming (a) unless you
  say otherwise, the test bodies barely move.
* **Zod 4 renames.** `ZodIssueCode` → the `code` string literals; `ZodEffects`/`ZodPipeline` →
  `ZodPipe`/`ZodTransform`; `.strict()` → `Z.strictObject` or `.catchall(Z.never())`;
  `_def.typeName` → `_zod.def.type`. All confined to `report.ts` and the typeguards -- test files
  should not mention them at all, which is itself a check that the port stayed clean.
* **The `utilnames` / `zfuncsExpected` / `straynames` bookkeeping lists die with the mega-bag.**
  See Removed.
* **`splitStr`, `oneOrMany`, `arrROCk`, `arrNZCk`, `bagWithKeys`** and friends are pipe/transform
  constructs. Per your instruction they transfer in phase 1 and get commented out in phase 2 with
  a `needs modernization` note, so `BasicStringChecks.test.ts` keeps its `handleish` block live
  and parks its `splitStr` block.

## Better practices

* **Merge `Zodify.test.ts` into `boolish.test.ts`.** They are near-identical twins: same
  `describe('casting')`, the same `boolishes` fixture verbatim, the same five `hasBoolish*`
  validators, overlapping assertions. The only real difference is that one reaches
  `Validator.Zods.boolish` and the other `Validator.Checks.boolish` -- a packaging distinction,
  not a boolish one, and it evaporates with the mega-bag. One merged file; the boolish corpus is
  good and survives intact.
* **Replace `TH.checkSnapshot` with vitest's `toMatchSnapshot`** at the two sites where a
  snapshot still earns its place (the structured report object, the invalid-example sweep) and
  drop it at the three sites that snapshot the whole export surface -- a snapshot that changes
  whenever anyone adds a check is a snapshot that gets blessed unread.
* **Drop the `if (mismatch) { console.warn(...) }` preamble** that precedes ~8 assertions. A
  failing `expect` already prints the diff; the warn fires on the same run and just doubles the
  noise. This is what removes most of the need for `TH.see` / `TH.prettify`.
* **`it.each` for the hostname loops.** `strToHostPort`'s tests wrap `_.each` over
  `_.take(ValidHostnames, 2000)` inside a single `it`, so the first failure hides the other 1999.
  Also `it('validates %s with no port')` -- `%s` in a plain `it()` isn't interpolated, so that
  title renders literally. Both fixed by `it.each`.
* **Bulk example lists, per `notes/testing.md`.** The email tests are 30 consecutive
  `expect(Validate.emailV.cast({email: X})).to.eql({email: X})` lines. Same shape, so they become
  a `[input, wanted, description]` table. The `InvalidScenarios` table is already in exactly the
  house style -- it's where the house style seems to have come from.
* **`@ts-expect-error` over `@ts-ignore`.** The relic uses `@ts-ignore WONTFIX testing bad input`
  throughout; several sit on the line *before* a multi-line statement and silence more than the
  author meant. Per CLAUDE.md, `@ts-expect-error` (which fails loudly when it stops being needed)
  and reported in chat.
* **`es-toolkit/compat` for lodash.** Every relic test opens with `import _ from 'lodash'`;
  `stack.md` settles on es-toolkit. Mostly a mechanical swap. `_.sortedUniq`, `_.merge`,
  `_.upperFirst`, `_.difference` all have compat equivalents; I'll flag any that don't.

## Conflicts with directives or conventions

These are places where the tests enforce something at odds with the proposal, the codebase or
the conventions. Phase 2 alters titles and assertions:

* **Two test titles assert the opposite of what their test does.**
  `it('.required().nonNullable(), elides undefined and rejects null')` runs against
  `hasBoolishRN = obj({ foo: boolish.nullable() })` and asserts that null *passes* and undefined
  *throws*. The title says it rejects null. Same bug copied into the isotime file. Anyone
  debugging from the title gets sent the wrong way. Retitle to what the assertions actually
  check.
* **`.required` tests test nothing.** `hasBoolish: obj({ foo: boolish })` and
  `hasBoolishR: obj({ foo: boolish })` are character-for-character identical, so
  `it('.required, rejects null and undefined')` is a verbatim rerun of
  `it('by default, requires a value')`. `.required()` / `.notRequired()` / `.nonNullable()` are
  Yup's API -- these names are archaeology from a pre-Zod migration, and the `describe('Yupper')`
  block name is the fossil that dates the layer. Collapse to the four distinct cases that
  actually exist: bare, `.optional()`, `.nullable()`, `.optional().nullable()`.
* **`set_eq_1` / `set_eq_3` enshrine a Zod 3 bug as expected output.** Both are commented "zod
  doesn't test set.size correctly", and the expected messages are the *wrong* messages -- a
  `.size(1)` check expecting "has «2» but should have one or fewer". We would be writing a test
  that fails when Zod gets fixed. Propose porting them asserting what we want
  (`has «2» items but should have exactly «1»`), and if Zod 4 still gets it wrong, `it.fails` so
  the suite tells us the day it's fixed rather than the day it breaks.
* **`Z.string().datetime()` scenarios prove the wrong thing.** Three `str_date` rows exist to
  document "Do NOT use the built-in checker, it accepts eg 2022-02-31 as valid" -- but every
  input fed to it is one it correctly rejects. The claim in the comment is never tested. Either
  add `2022-02-31T00:00:00Z` as the case that demonstrates it, or drop the rows and keep
  `isotime`, which is the house answer and *is* properly tested against `2023-02-30`. I lean
  drop: we don't need a regression suite for a function we've banned.
* **Top-level `describe('casting')` in three unrelated files**, plus `describe('Validation')`,
  `describe('specific validations')`, `describe('by type')`. In one vitest run three unrelated
  `casting > Validator > ...` trees interleave. Name the top-level describe for the unit under
  test, per `notes/testing.md`.
* **Test titles to house style**: `'should package checks correctly'` → declarative;
  `'Yupper'` → gone with the Yup vestiges; `it('on invalid input')` nested directly inside
  `describe('on invalid input')`; `'can dump the groups if you want'` → deleted (see Removed).
* **PascalCase filenames** throughout → kebab-case, per the `unicorn/filename-case` rule already
  live in `eslint.config.mjs`.
* **Path spelling is inconsistent within one feature.** `badprops` keys read `cuts[0].year`;
  the unknown-property message for the same object reads `cuts.0.{only=...}`. Phase 2 unifies on
  bracket form, which changes a handful of expected strings in `InvalidScenarios`.

## Removed before transfer

Per the rules, anything abandoned lands in `whiteboard/vv/<same path as in relics/vv>` first.

* **All three export-bookkeeping suites: `ChecksPackaging.test.ts`,
  `Validator.test.ts > 'by type'`, and `Validator.test.ts > 'All exported zchecks are
  available'`.** Three separate mechanisms asserting the same thing -- that the check list and
  the export list agree -- carrying a hardcoded 40-name `utilnames` list, a `zfuncsExpected`
  list, a `straynames = ['_SYNTHKEY_RE']`, and `_.difference` run in both directions. The only
  failure it can catch is "someone added a check and forgot to add it to a list", and the
  remedy for that failure is to edit the test. It is a maintenance tax levied on a bookkeeping
  structure that the new layout deletes: with no mega-bag and no barrel, a check that isn't
  exported simply doesn't import, and `tsc` says so. Replace all three with one test that a
  `Validator` block can destructure the documented kit.
* **`Validator.test.ts > 'can dump the groups if you want'`** -- `const showCheckerGroups = false`
  guards the whole body, then it asserts `expect(lines).to.be.an('array')` where `lines` is `[]`.
  It asserts that an empty array is an array. It's a code generator wearing a test's clothes.
  Same family: `URLValidation`'s `it('dumps')` (ends `expect(valids).to.be.ok`) and
  `Validator.test.ts`'s `dumplist` helper. If the generator is genuinely useful it belongs in
  `/scripts`; the source goes to the whiteboard either way.
* **`URLValidation.test.ts` -- parked, not ported.** Everything it exercises
  (`urlOrPathToLiveurl`, `liveurl`, `strToHostPort`, `parsedUrlpath`) is pipe- and
  transform-heavy, which is precisely what you said not to modernize. Per the process, phase 1
  creates `tests/lib/vv/checks/net-urls.test.ts` containing a single failing test,
  `'URLValidation.test.ts from relics needs review'`, so the debt is enforced rather than
  forgotten. The fixtures come over now; the tests wait for the wave that modernizes `UrlChecks`.
* **`DateishValidations.test.ts`'s commented-out body** -- roughly 80% of the file, referencing a
  long-dead error format (`foo is required : got .foo:%~null.`). What still runs is one test
  asserting the same valid ISO string through five differently-configured validators -- i.e.
  proving a valid value is valid, five times -- while the `isoishes.invalid` fixture sits defined
  and unused, and `isotime`'s actual job (rejecting `2023-02-29`, coercing `Date` and
  `DateTime`) is never tested. Don't port the commented block; write the isotime tests fresh in
  W3 from the `isoishes` fixture, which is good and wants only a consumer.
* **`SpecialChecks.test.ts`'s commented-out `cursoring`, `Path Types`, `CurrencyCodes` and
  `Country codes` blocks** -- cursoring and parsed-paths are other-codebase concerns (knex
  cursors, filesystem paths) with no counterpart here. The two currency/country blocks compare
  our enum against an npm package we don't depend on; if we want that check it's a script, not a
  test. Whiteboard, then abandon.
* **`ZodMonkeypunch.ts` and everything reaching into zod internals** -- as directed, and it takes
  `ZodInternal.ts`'s re-export surface with it.
* **`jest.setTimeout(20_000)`** in `NullishValidations.test.ts` -- a jest global, and a 20-second
  budget for tests that check whether `undefined` is undefined.
