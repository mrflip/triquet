# 2026-10-08: Regex survey -- re2js, recheck, redos-detector

Why: we want to let users supply a regex for validation, run it with re2js (linear time, no
ReDoS), and ask whether the restrictions RE2 imposes would hurt us. If our own patterns live
comfortably inside them, they are fair to put on users.

What was surveyed: every regex literal in `src/`, `convex/` and `relics/vv/` (`src`, `tests`, and
`other`, the folder once called `aside`), plus the ones built at runtime (`reservedOf`,
`Unreserved`, `UnreservedToplevel`, `column.ts`'s `SourceRe`, the relic's file-extension
patterns): 275 distinct regexes, 69 live and 206 relic. Each went through:

* **recheck** 4.5 (pure-JS backend): flags a regex only when it finds an attack string.
* **redos-detector** 6.1: counts backtracking paths; far stricter, and gives a score of infinity
  to many patterns that are in fact linear (anything unanchored ahead of an unbounded repeat,
  like `/\.\d+Z$/`). "Undecided" is its `hitMaxSteps` or `timedOut`.
* **re2js** 2.8.6: `RE2JS.translateRegExp`, then `compile`; whatever compiled was run against
  6,290 inputs (seeds with awkward characters stuck on front, back and middle) beside JS, and its
  AST read for the constructs that are known to differ. "By construction" below means the
  construct guarantees a difference the sample inputs happened not to hit.

## How re2js differs from a JS regex with the `u` flag

Taking "equivalent" to mean JS with `u`, the differences checked directly against both engines:

**Silently different** (both compile, they answer differently):

| What | JS (`u`) | re2js |
|---|---|---|
| `.` excludes | `\n`, `\r`, U+2028, U+2029 | `\n` only |
| `^`/`$` under `m` break at | `\n`, `\r`, U+2028, U+2029 | `\n` only |
| `\s` | Unicode whitespace, `\v`, U+FEFF | `[\t\n\f\r ]` only |
| a capture inside a repeat: `/(?:(a)\|b)+/` on `"ab"` | group 1 is `undefined` | group 1 is `"a"` |

The capture difference touches only `exec`/`replace` results, never `test`. A bare `.` differs
only on input holding `\r`, U+2028 or U+2029 -- so `.*_id$` is fine to write; with `s`, `.`
matches everything in both engines, and the only effect is that `.*` can run across a line break.

**Refused by re2js** (loud, at compile): lookahead; lookbehind holding a capture (captureless
lookbehind compiles under `RE2JS.LOOKBEHINDS`); backreferences; a repeat count over 1000 or
nested repeats past RE2's size limit; `[]` and `[^]`; some property escapes (`\p{Script=Greek}`,
`\p{ASCII}` -- general categories, `\p{White_Space}` and `\p{Emoji}` work).

**Not a `RegExp`**: no `lastIndex`, and `translateRegExp` drops `g`, `y` and `d`;
`String.prototype` methods and Zod's `.regex()` won't take one (wrap it in a `.refine()`).

**Checked and the same under `u`**: case folding (`ſ`, `K`, `İ`, `ß`), emoji and lone
surrogates, `\w`/`\d`/`\b` (ASCII in both), alternation order and lazy quantifiers, named groups,
`$` before a trailing newline, `\0`, `\cJ`, `(?i:…)` groups. Not checked: re2js carries its own
Unicode tables, so a brand-new character may land in a different `\p{…}` than V8 puts it in.

If user regexes are only ever compiled by re2js -- it runs in the browser and in Convex functions
alike -- there is no equivalence to keep: the dialect is simply RE2's. It matters only if one
engine previews and the other enforces.

## Live code

Before thread `20261008-re2_ready_patterns`. **Fixed** marks what that thread changed.

| Regex | recheck | redos-detector | re2js | |
|---|---|---|---|---|
| `patterns.ts` `Unreserved` | -- | ∞ | refused (lookahead) | **Fixed**: a rule |
| `patterns.ts` `UnreservedToplevel` | -- | -- | refused (lookahead) | **Fixed**: a rule |
| `patterns.ts` `reservedOf` | -- | -- | refused (lookahead) | **Fixed**: a rule |
| `patterns.ts` `Replykey` | -- | -- | refused (lookahead) | **Fixed**: a class |
| `column.ts` `SourceRe` | -- | -- | refused (lookahead) | **Gone**: thread `cw_widen` replaced the source grammar with refs, and no regex |
| `ll-smith-export.ts:140` | -- | -- | refused (look-behind and -ahead) | **Fixed**: a replace |
| `patterns.ts` `TrimmedRe` | -- | -- | differs: `\s` | **Fixed**: `\p{White_Space}` + U+FEFF |
| `actor.ts:56` `/[\s,]+/` | -- | -- | differs: `\s` | left on JS |
| `QuizManageModal.tsx:313` `/\s+/g` | -- | -- | differs: `\s` | left on JS |
| `bbjank.ts:24`, `:30` | -- | `:30` ∞ | differs: `\s` (by construction) | left on JS |
| `build-stamp.ts:133` | -- | -- | differs: `\s`, `\S` (by construction) | left on JS |
| `markdown.ts:23` | -- | -- | differs: `\s` (by construction) | left on JS |
| `postmortem.ts:50` `RequestIdRe` | **quadratic** | ∞ | -- | left; input is our own backend's errors |
| `patterns.ts` `Email` | -- | ∞ | -- | left; recheck finds no attack, and `max: 82` bounds it |
| `Stats.tsx:161`, `use-face.ts:50`, `build-stamp.ts:138`, `:166` | -- | ∞ | -- | redos-detector's strictness only |

None of the live code uses a backreference. Every regex in `patterns.ts` now compiles in re2js,
and `tests/lib/vv/patterns.test.ts` keeps lookaround, backreferences and `\s` out of it.

## Relic (`relics/vv`, paths relative to it)

| Regex | recheck | redos-detector | re2js |
|---|---|---|---|
| `Consts.ts:66` `MEAN_EMAIL_RE` | **exponential** | ∞ | refused (lookahead) |
| `Consts.ts:145` S3 bucket, `:401` password, `:510` hostname, `checks/UrlChecks.ts:64` | -- | -- | refused (lookahead) |
| `Consts.ts:511` host-or-IP, `:546` `ISODUR`, `:549` `ISOTIME` | -- | ∞ | refused (lookahead) |
| `other/src/utils/inspectify.ts:21` `QUOTED_RE` | -- | -- | refused (backreference) |
| `Consts.ts:497`, `:498`, `:506` (URLs) | **exponential** | undecided | differs: `/i` takes `ſ`, `K` |
| `Consts.ts:499` (URL path) | **exponential** | threw | -- |
| `Consts.ts:417` `TSTYPE` | **exponential** | ∞ | differs: `/i` takes `ſ`, `K` |
| `Consts.ts:614` (money) | **quadratic** | ∞ | -- |
| `Consts.ts:616` (money) | **quadratic** | ∞ | differs: `\s` |
| `Consts.ts:752` `JUST_PATHSEGS_GLOB_RE` | **quadratic** | ∞ | -- |
| `ANY_FEXT_RE` | **quadratic** | ∞ | -- |
| `other/src/utils/StringUtils.ts:155`, `:157` | **quadratic** | ∞ | -- |
| `other/src/validation/ZodReporting.ts:56` | **quadratic** | ∞ | -- |
| `Consts.ts:49`, `:85`, `:86`, `:87` | -- | -- | differs: `/i` takes `ſ`, `K` |
| `FEXT_REGEXES`, `Consts.ts:808–834` (20) | -- | -- | differs: `/i` takes `ſ`, `K` (by construction) |
| `Consts.ts:93` `TRIMMED_RE`, `checks/WorldlyChecks.ts:44` `pricestr` | -- | -- | differs: `\s` |
| `PARSE_KNOWNFEXT_RE`, `PARSE_OTHERFEXT_RE` | -- | ∞ | differs: bare `.`, and `/i` |
| `Consts.ts:777` `PARSE_NOFEXT_RE` | -- | ∞ | differs: bare `.` (by construction) |
| `Consts.ts:13` `IDENTID_RE` | -- | -- | differs: bare `.` (by construction) |
| `Consts.ts:64`, `:72`, `:430`, `:508`, `:509`, `:533–535`, `:582`, `:750`, `:751`; `PrimshapeChecks.ts:39`; `KNOWN_FEXT_RE` | -- | ∞ or undecided | -- |
| Test files' message matchers (7) | 5 quadratic | ∞ | bare `.` |

The `/i` differences vanish once the pattern carries `u`. The test-file matchers only ever read
our own messages, and need nothing.

## Proposed for the relic, should we port it

Each rewrite was rerun through recheck, redos-detector and re2js, and set beside the original in
JS on the same inputs ("same" means no difference on that sample, not a proof).

* **Library-first instead of a regex**: URLs (`:497–506`) by `new URL()` or `z.url()`; IPs and
  hostnames (`:508–511`) by `z.ipv4()`, `z.ipv6()`, `z.hostname()`; `ISOTIME` and `ISODUR` by
  `z.iso.datetime()` and `z.iso.duration()`; the file-extension family by splitting the basename
  on `.` and looking the last part or two up in a `Set`.
* **Leave behind**: `MEAN_EMAIL_RE` (we have `Email`), the password and S3-bucket patterns,
  `TSTYPE` (an unambiguous rewrite exists, recheck-safe, stricter about spaces, if we want it).
* **Rewrites**:
  - `EXACTLYONESLASH_RE`: `^\/(?:[^/]|$)` -- same.
  - `QUOTED_RE`: ``^(?:`.*`|'.*'|".*")$`` with `s`.
  - `:614`: `^-?\$?\d+(?:\.\d*)?$` -- same, and no longer quadratic.
  - `:616`: `^\$? *(?:- *)?[0-9]+(?:\.[0-9][0-9])?$` -- spaces only, on purpose; both checkers
    pass it (a first try with `-? *` beside ` *` was still quadratic).
  - `pricestr`: `^[-$\d. \t]*$`.
  - `:752`: drop `/` from the class, `^(?:[…]*\/)*[…]*$` -- same, recheck-safe. The original is
    also a bug: each segment there is one character long.
  - `:13`: `dnt.` was almost surely meant as `dnt\.`.
  - `:777` and `PARSE_*`: add `s`.
  - `/i` patterns: drop the `i` where both cases are spelled out (`:85`, `:86`); `[A-Za-z]`
    elsewhere; `u` on the extensions, where taking `ſ` does no harm.
  - `StringUtils.ts:155/157`: leave; it only sees a slice no longer than `maxlen`.
  - `ZodReporting.ts:56`: `/(?:^| )is a ./u` -- passes both checkers.

## Left open

* Whether to keep a regression check: a unit test that compiles every exported pattern in re2js
  and diffs it against JS on awkward inputs. It needs `re2js` as a dev dependency.
* For the user-regex feature itself: compile with re2js alone, everywhere, and say so in the
  help text, rather than promising "JavaScript regexes".
