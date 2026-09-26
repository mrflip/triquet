# vv: what has moved, and what has not

Running ledger for the relic migration. Anything under `relics/vv/aside/` is finished with;
anything still under `relics/vv/src` or `relics/vv/tests` is outstanding.

## Landed

| relic | new home |
|---|---|
| `src/Errors.ts` | `src/lib/errors.ts` |
| `src/utils/PropUtils.ts` | `src/lib/props.ts` + `src/lib/collections.ts` |
| `src/utils/StringUtils.ts` | `src/lib/strings.ts` |
| `src/utils/ClxnUtils.ts` | `src/lib/collections.ts` |
| `src/utils/TSTools.ts` | `src/lib/type-tools.ts` |
| `src/utils/inspectify.ts` | `src/lib/inspectify*.ts` |
| `src/validation/ZodReporting.ts` | `src/lib/vv/reporting.ts` (the clean third of it) |
| `src/consts/CharsetChecks.ts` | `src/lib/vv/patterns.ts` + `src/lib/vv/checks/strings.ts` |
| `src/consts/ContactPrims.ts` | `src/lib/vv/checks/contact.ts` |
| part of `src/consts/PrimshapeChecks.ts` | `src/lib/vv/checks/{strings,numbers}.ts` |
| `src/validation/ZodMonkeypunch.ts` | deliberately not carried |

## Left behind from what did move

**From `ZodReporting.ts`** -- the file is ~390 lines and about 130 came over. Not carried:

* `repairError`, and the whole catch-rephrase-rethrow cycle it drove. This is what the coach
  asked to be rid of, and with `issue.input` now present there is nothing for it to recover.
* `getBadprop` -- forty lines of reaching into `_def.defaultValue` and the checker's shape to
  work out which value had failed. The zod patch puts `input` on every issue, so the question
  it answered no longer needs asking. `badpropsOf` is its replacement, in four lines.
* `unionizeIssue` -- recursion over `unionErrors`, mutating each sub-issue's `message` in
  place, then de-duplicating the results and stripping "should" back out of them with a regex.
  A union keeps Zod's own wording instead.
* `customErrorMap`'s two-phase `step: 'ceMap'` handling, and `fixInstanceofMessage`, which
  did regex surgery on a message Zod had already written.
* `invalid_union_discriminator` -- its branch had a `console.warn` and built a message with an
  empty `''` in the middle, so it was never finished in the first place.
* The `UNSET_VALUE` symbol and the missing-vs-present-undefined distinction that went with it.
  That rides on the other monkeypatch, which the coach is holding back.

**From `PrimshapeChecks.ts`** -- the numeric and generic-string shapes came over; the
identifier family (`id26`, `timecode`, `guidv4`, `extkey`, `nodeid` and the rest) did not, as
they depend on `Consts.ts`'s id grammar, which is a wave of its own.

## Still outstanding

| relic | what is in it |
|---|---|
| `src/Consts.ts` | 433 exports. The pattern bags for what has moved are now in `patterns.ts`; the id grammar, timecode alphabet, currency and country tables remain |
| `src/consts/TimePrims.ts` | 47 checks: isotime, timecode, timestamp, durations. Wants Luxon, and a decision about whether we take that dependency |
| `src/consts/EnumVals.ts`, `EnumChecks.ts` | currency, country, AWS regions and friends -- the big tables, to live alone so an email field does not ship them |
| `src/checks/UrlChecks.ts` | pipe- and transform-heavy; explicitly parked in the Epoch I testplan |
| `src/checks/FilerChecks.ts` | filesystem paths and globs -- another codebase's concern, probably abandon |
| `src/checks/WorldlyChecks.ts` | currency/country checks over the tables above |
| `src/checks/LoggerChecks.ts` | two checks, one of which wants a `LoggerT` we do not have |
| `src/checks/BootChecks.ts` | the kit. `src/lib/vv/kit.ts` covers the part we use; the rest is `arrROCk`, `bagWithKeys` and the other pipe constructs |
| `src/validation/Validator.ts` | wave 4 |
| `src/validation/ZodInternal.ts`, `ZodTypeguards.ts` | zod 3 internals; most of it dies with the monkeypatch |
| `tests/**` | the check and validation suites, per `testplan.md` |

## Decisions worth remembering

* **Messages are pure advice.** `customError` returns "should be «200» or less", not
  "«400» should be «200» or less". The value and the path are put in front by `explain`. This
  is what lets a check carrying its own message (`str.regex(re, 'should be a postcode')`) read
  the same as one phrased by the map -- Zod takes a check's own wording first and never calls
  the map at all for those.
* **Digit grouping lives in the reporter, not in inspectify.** `«20_000_000»` is a courtesy to
  a reader of a message; `inspectify` stays a faithful dump. Same line as the `~^` escaping.
* **The error map must be installed before anything parses.** `tests/support/setup.ts` does it
  for the suite; an app does it at startup. A `beforeAll` is not early enough -- a schema
  parsed at module scope will already have been phrased by then, which cost an hour to find.
* **Validator tests assert the error, not the wording.** `mirror-settings` and
  `commit-scheduler` used to match zod's English with a regex; they now expect a `ZodError`.
  Wording is pinned once, in `tests/lib/vv/reporting.test.ts`, and per-pattern advice in
  `tests/lib/vv/checks/strings.test.ts`.
