# vv -- the validator relic

Work thread for `/relics/vv`: a Zod 3 toolchest of validators, regexes and constants, to be
reborn as Zod 4 in `src/lib/vv/`. Testplan lives in `whiteboard/vv/testplan.md`.

Repo is on zod 4.6.5 already, so there is no version negotiation to do -- only translation.

## What's in the relic

| Area                 | Files                           | Lines | Feel                                             |
| -------------------- | ------------------------------- | ----- | ------------------------------------------------ |
| Constants & regexes  | `src/Consts.ts`, `src/consts/*` | ~1300 | 433 exports in one file; pure data, ports easily |
| Checks               | `src/checks/*`                  | ~450  | the actual validators, grouped by domain         |
| Validation machinery | `src/validation/*`              | ~1000 | `Validator`, reporter, typeguards, monkeypatch   |
| Tests                | `tests/**`                      | ~2400 | ~1500 of it is hostname/URL fixture corpus       |

## Headlines for the coach

**1. `tests/TestHelpers.ts` is missing from the relic.** Every single test file imports it
(`TH.checkSnapshot`, `TH.see`, `TH.Examples`, `TH.prettify`, `TH.Wutang`, `TH.MAX_CURSOR`).
`tests/fixtures/ExampleValues.ts` came over and is presumably `TH.Examples`, but the rest is
gone. Nothing in the relic runs as-is. This mostly costs us the snapshot mechanism -- see
testplan, where I propose dropping it for vitest's native one.

**2. `inspectify` must be synchronous.** The feature note asks for async. Every error message in
the relic interpolates it inside a string that a *throw* is built from --
``expect(() => boolish.cast(val)).to.throw(`«${UF.inspectify(val)}» should be...`)``. An async
inspectify makes `.cast()` async, which makes every validator async, which makes every model
constructor async. I'd like to propose: **synchronous, and never throws** (try/catch around the
whole body, fall back to `UU.jsonify`, fall back to `String(val)`, and if even that throws,
return `'(uninspectable)'`). That keeps the entire contract you asked for except the `async`
keyword. If there's a reason async was load-bearing that I'm not seeing, say so and I'll rethink
wave 1 around it.

On the Gemini doc's two options: **Option 2 (subpath imports)** is the one that matches the
framework grain -- `package.json` `imports` with a `node`/`default` split is standard Node
resolution, Next understands it natively, and it needs no `typeof window` check and no
`require()` smuggled past the bundler. Option 1's `require('node' + ':util')` string-concat
trick to defeat static analysis is exactly the kind of cleverness CLAUDE.md warns off. I'd go
with Option 2 and a shared `format.ts` holding the browser formatter.

**3. Control-character rendering is a real feature, not an accident.** The relic renders control
characters as `~^n`, `~^x01`, `~^x0B` inside `«»`. It means a bad value never breaks your
terminal and is greppable. Worth making an explicit part of inspectify's contract in wave 1
rather than rediscovering it in wave 2.

**4. The four-way nil distinction is the crown jewel.** `(unset)` / `«undefined» is missing` /
`«null» is nil` / `«''» is blank` are four different messages for four different bugs, and Zod
gives you one. Preserving it means the reporter has to look at the input object, not just the
issue list, because Zod 4 cannot distinguish a missing key from a present-but-undefined one.
That's a real cost in wave 2 and I want you to have chosen it deliberately. My vote is keep --
it's the single best idea in here, and `guidelines.md`'s "every field exists (possibly null,
never undefined)" only means something if we can tell the two apart.

## Treeshaking -- the proposal you asked for

**What went wrong before.** `Validator.ts` imports ~400 named checks and assembles `ZodFood`, one
object handed to every `Validator()` call. Barrel files (`checks/index.ts`, `checks/internal.ts`,
`consts/index.ts`) re-export everything through everything. So: any module that validates
anything constructs every check in the library at load time -- every regex, the ISO 4217 currency
table, the country-code table, the AWS region list. None of it shakes, and it isn't only types,
it's a runtime object graph built on every page. The barrels also produce import cycles
(`BasicChecks` re-exports `BootChecks` and `PrimshapeChecks`, which import back through
`consts/internal`).

**Proposed layout** under `src/lib/vv/`:

```
patterns.ts        -- regexes + bounds. imports nothing at all.
kit.ts             -- the zod aliases (obj, arr, oneof, str, num, bool...) -- grows today's ValidatorKit
checks/strings.ts  -- trimmed, lower, medstr, label, handleish, camel, locamel, varname, titleish
checks/numbers.ts  -- bareint, safeint, quantity, byte, lat, lng, portnum, ubux
checks/time.ts     -- isotime, timecode, timestamp, isoymd
checks/contact.ts  -- email, phone, postcode, fullname, stradd1, stradd2
checks/net.ts      -- hostname, ipv4host, ipv6host, urlstr  (regex ones only; see testplan)
checks/world.ts    -- currency, countryCode -- the big enums, isolated on purpose
report.ts          -- the error reporter (wave 2)
validator.ts       -- Validator() (wave 4)
```

Three rules do the actual work:

* **No barrel file.** `checks/index.ts` is what killed it last time -- and the relic knows,
  its own header says "This is a deliberate exception to the 'no barrel files' rule."
* **`patterns.ts` imports nothing**, so a module wanting one regex pays for one regex.
* **The big enums live alone**, so an email field doesn't ship the currency table.

**And the annoyance you flagged (item 5).** Today the block destructures from the world:
`Validator(({ obj, email, phone }) => ...)`. For that to typecheck, the 400-key bag must exist,
which is precisely the thing that can't shake. What I propose:

```ts
import { email, phone }  from '@/lib/vv/checks/contact'
import { Validator }     from '@/lib/vv/validator'

export const ContactValidators = Validator(({ obj, title }) => ({
  contact: obj({ title, email, phone: phone.nullable() }),
}))
```

The block still receives the small kit -- the ~25 builders and primitives that every schema needs
anyway, so they never shake out regardless. Named checks arrive by import. Cost: one import line
per domain. Gains: the bundle holds the checks you named, and `email` in a schema becomes
jump-to-definition instead of a name materialising out of an anonymous destructure.

If you want the old ergonomics back I can do per-domain kits (`Validator.with(ContactKit)`), but
I'd push for plain imports -- it's less machinery and reads better.

## Wave 1 done: inspectify

Landed as `src/lib/inspectify.ts` (entry + `maxlen` + the never-throw ladder),
`src/lib/inspectify-node.ts` (node's `util.inspect`), `src/lib/inspectify-browser.ts` (the
portable formatter). Re-exported by `useful`, so `UU.inspectify`. Option 2 as proposed: a
`#inspect-env` subpath import in `package.json`.

Verified rather than assumed: built with a `'use client'` page calling it, then grepped the
client chunks. `node:util` is absent from them, and the browser formatter's own strings
(`[Circular]`, `[unreadable]`) are present. Both halves run against the same 77-case table in
`tests/lib/inspectify.test.ts` and agree on every row -- vitest resolves to the node half, so
without that the browser code would never be executed by a test at all.

**Two things deliberately left for wave 2**, because they are message formatting rather than
value rendering, and the line I drew is *inspectify renders values; the reporter adorns
messages*:

* **`~^n` control-character rendering.** Both halves currently escape the way node does
  (`\n`, `\x01`). The relic's `~^` convention is a reporter-level choice -- adopting it means
  overriding node's escaping on the server too, and I'd rather do that once, where the `«»`
  wrapping happens.
* **Numeric separators** (`«8_675_309»`, `«39.000_01»`). The relic applies these to subject
  values *and* to the limits it interpolates (`«1_996» or more`), so it belongs with the
  message builder, not here.

**One thing to decide in wave 2:** the two halves agree on everyday values, but they are not
guaranteed byte-identical for exotic ones. If wave 2 wants error messages that are identical
whichever side produced them, the honest answer is to use the portable formatter on both sides
and keep `node:util` for logs only. Flagging now because the exact-match message tests will be
the first place it bites.

## Open questions for you

1. Sync inspectify -- confirm (headline 2).
2. Keep the four-way nil distinction, knowing wave 2 pays for it? (headline 4).
3. `badprops` keys use `cuts[0].year` bracket form; the unknown-property *message* uses
   `cuts.0.{...}` dot form. Same feature, two path spellings. Propose bracket form in both.
4. Two ZodFormatting scenarios enshrine a zod 3 bug as expected output (`set_eq_1`, `set_eq_3`,
   commented "zod doesn't test set.size correctly"). Propose porting them as what we *want*.
   Details in testplan under "Conflicts".
5. `Z.string().datetime()` scenarios exist to prove zod's datetime helper is bad, but only feed
   it strings it correctly rejects -- the actual claim is never tested. Drop them and keep
   `isotime`, which is the house answer and is properly tested?
