# Application Style Guide

Conventions for `.ts` files in this project. The audience is a human or an AI coding session
working in this codebase. Read this before naming anything or writing a doc block -- the naming
vocabulary below is specific and not guessable from general TypeScript habit.

For architecture and process -- the validation lifecycle, documentation policy, testing -- see
`notes/guidelines.md`. `eslint.config.mjs` is the ultimate and best source of truth for anything
mechanically enforceable; where it and this document disagree, the linter wins and this document
is a bug.

## Imports and Facility Namespacing

The rules below are specific examples of three principles:
1. Follow framework and package conventions. React, MUI and Next.js get imported the way their ecosystems do it; this rule is about our own modules, selecting a single best practice out of many
2. Node offers several different ways to import code; accept that as a tailwind for code that reads as prose.
3. Structure your imports around good object-oriented technique.

### Basics

* Import paths carry no extension (`./thing`, not `./thing.ts`) -- the grain of Next.js and the
  wider ecosystem. Not mechanically enforced either direction; just don't add one. The one
  exception: a script under `scripts/` that node runs directly imports its siblings with the
  `.ts` (`./lanes.ts`), since node follows no extensionless path (tsconfig's
  `allowImportingTsExtensions` lets it typecheck).

### Use Splat (`* as Modulename`) imports for a module not grouped as a noun

use `import * as Labelmaker from ...` to turn a module of coherent, related behavior into a robust facility.
Importing functions directly puts everyone in a global namespace, with many quiet dysfunctions following behind) GOOD: `import * as Labelmaker`. BAD: `import { normalize } ...`
Use the Startcase filename as the import, in general (a couple exceptions will be made clear)
Functions within such file should be vigorous verbal phrases that do NOT have the module name tacked on: `normalize`, not `labelmakerNormalize`. Most things in `lib` are like this one: bare functions around a single concern that become objects with a splat import

* situational: `import { SOME_CONST } from ...` might totally make sense when you want that to feel local to the file.
* situational: certain frequently-used libraries with global vibes use a two-letter shorthand: `import * as UU from '.../utils'`; similarly `ST` for storage. A short punchy name for ambient facilities
* situational: If the length of the import statement becomes cumbersome, do a splat import using a two-or-three letter shorthand ending in 'T' (eg PT = product types; QYT = query types, ...). GOOD: `import type { ProductSomthing, ProductFoo } from ...`. BAD: `import type { Product ... 19 things...} from ...` INSTEAD: `import type * as PT from ...`
* exception: **`es-toolkit/compat`** is our lodash-shaped utility surface (see `notes/stack.md`). Import it as a single blanket default import named `_`, lodash-style, rather than naming individual functions: `import _ from 'es-toolkit/compat'`, then `_.map(...)`, `_.upperFirst(...)`. This is the one sanctioned exception to "no single-letter names".
* exception: **Convex's validator builder** is `CVX`: `import { v as CVX } from 'convex/values'`, then `CVX.string()`, `CVX.id('quizzes')`. Convex's docs, its rules file and every agent's training say `v`; the no-single-letter rule holds anyway, because `\bCVX\b` renames in one command and `v` never will. `eslint.config.mjs` refuses any other name for it.
* exception: **Convex's query builders** are `cvx`: the callback `withIndex`, `filter` or `withSearchIndex` hands you is Convex's DSL and nothing of ours, and which kind it is is already said by the method it went to: `.withIndex('by_quiz_id', (cvx) => cvx.eq('quiz_id', quiz_id))`. Convex's docs say `q`; never that, and never `qq` or `qn`, which are a question's (see the tags below).

### Use Named (`import { Foo }`) Imports for already-namespaced facilities

* If a file has **One primary export**, import it and its friends directly.
  GOOD: `import { Product } from '../models/product'`      -- then `Product.fill(dna)`
  Ancillary consts ride along on the same line: `import { Product, ProductKinds } from ...`

* If a file is **organized into coherent uniform objects**:
  GOOD: `import { AppNotices } from '../lib/appnotices'`   -- then `AppNotices.saveSuccess`

A good test, for a module that sits between these rules: does this import put *targeted well-named nouns* in scope, or several loose verbs? One noun, however it arrives, is the goal.

### Tailnotes for imports:

* Use files, not barrel `index.ts` re-exports
* Mock with `vi.mock('../lib/foo')`
* Hooks stay named, so `eslint-plugin-react-hooks` can recognise them by their `use` prefix.

REPEATING: This section on various import styles applies only when there's not alread a single standard practice. Do not deviate from standard framework conventions.

## Naming Conventions


**Smush variable tags `name`, `kind`, `label`, `path`, `bag` and `key` into one unit: `fooname` and `foolabel`,
  but not `fooCount` or `fooIter`. (added 20260916)

**Model fields are underbar_case** for database compatability. (added 20260916)

**Validators match the case and name of their check**. If the field is `foo_count`, call the validator `foo_count`. Craft function guards to match the convenience of the function:

```ts
function diamForHatSize(sized: { hatSize: HatSize }, lengthUnits: LengthUnit): number {
  const { sized: { hatSize } } = Validate.diamForHatSize.parse({ sized, lengthUnits })
  // ...do stuff with hatSize and lengthUnits
}
```

_(added 20260916)_

**No single-letter names.** Use `row`, `col`, `thing`. The only sanctioned short names are `ii`,
`jj` for traditional index iterators.

**Never use bare `name`, `value`, `node`, `error`, or `query` as variable names.** For `name`,
there's almost always some salient prefix to supply `fooname` (note: no camel).

**Never use `type` to mean "kind"** as in "selection key into a menu of items" -- not even as
part of an identifier. BAD: `woodType` BETTER: `woodkind`. `type` is strictly reserved for data
model type. A typename is a string.

**Add `name`, `kind`, `handle`, `flavor`, un-camel'ed, for an isomorphic selector**; `woodname`
is a string, `wood` is an object.

**Use `label` for a freeform-string-derived identifier (local or global) driven by the user** -- eg using the title of a quiz as the url pathseg.

**`_id` is a stored row's id, and a tree node's too** (`quiz._id`, `question._id`): Convex's
spelling, kept from the database to the screen so nothing translates between them. A pointer to
another row is `<parent>_id` (`quiz_id`). Our own field names never start with `_`; that prefix
is the database's (`_id`, `_creationTime`).

Specificity is a virtue: `bboxHt` makes clear that this height might depend on coordinate system.
Don't add a tag when it's obvious: `title`, not `titleStr`.
However, when genericity is exactly the salient feature, use the tag directly: BAD: `pad(displayableStr)` BETTER: `pad(str)` (any string might enjoy good padding).
It's much easier to process names where each segment represents a separation of concerns -- `fooCount`, `planTier`

### Specific Naming Tags

Tags to append or use directly:

* `key`            -- map key, when it's known to be a string map key; `keys` for a collection of keys, `keylist` to emphasize the list aspect
* `ckey`           -- `string|number` collection key: string for a map, index number for an array
* `idx`            -- array index, when it's known to be an integer array index
* `val`            -- any-typed, truly generic value. `vv`/`kk` are secondary choices in a lambda when `key` or `val` is in-scope
* `qn`             -- a question, when a shorthand is called for: an object satisfying `QuestionT`, or a question as the bag holds it, and nothing else; `qns` for several. Code only: the bag a formula reads spells them out (`question`, `questions`), and `qn` and `qns` are reserved from every label. Never `qq`, so a stray one is easy to spot, and never a query builder (`cvx`).
* `kind`, `flavor` -- legible **enumerated** strong identifier: picking from a menu or taxononmy. Use `label` or `handle` for legible freeform strong identifier (eg a slugged title)
  - all of these, and tag, should apply strict identifier validation: `\w` only, starts with a letter, ends with a letter or number, two or more characters; usually also lowercase-only
* `props` and `propnames` for structured objects; `fieldnames` and `fields` for their definitions (i.e. the fields of the class are the props of the instance)
* `iter`           -- sequence iteration counter
* `ii`/`jj`/`kk` mean "the ii'th time through this block": a literal `for (...)` loop's own bound variable (`for (const [ii, foo] of foos.entries())`, `for (let ii = 0; ...)`), or the counter a `map`/`forEach` callback is handed (`foos.map((foo, ii) => ...)`). Never for an index that reaches a block from outside -- a named function parameter, a keyword arg, a callback whose argument *is* an index (`pathFor: (idx) => ...`), or a field name. Those are `idx`, or a more specific `fooIdx` when a salient noun is in scope (`lineIdx`, `rowIdx`); and once a counter is used to index into something *else*, it is an index too.
  - `row`, `col`, `lvl` for element indexes in a grid pattern (use  `horiz` and `vert` exactly and only in their precise meaning).
  * You may use `iter` or `seq`, `fooIter` or `fooSeq`, `fooIter0 / fooIter1 / fooIter2` as varnames, but `ii/jj/kk` are never foo'ed
  - (Also keep in mind we prefer functional programming -- eschew index-based iteration unless there's a reason neither `for (const foo in foos)` nor `_.map(foos, (foo, idx) => {})` is useable)
* `count` or `ct`  -- reported quantity
* `qty` or `nFoos` -- input quantity
* `keypath`        -- array with string/number segments to indicate a ckey path
* `rule`           -- rule ("predicate" in lodash) accepting (val, ckey) and returning truthy/falsy; referred to in text as a "rule"
* `bag`, `foos`, `foobag` -- generic key-value map (i.e. `Record<string, any>`); `foos` or `foobag` for a generic-key map of foo's; `barFoos` if you want to highlight that the keys are `bar`-like. `FooForBar` or `FooLookup` for a 1:1 or 1:N lookup table
* `arr`, `foos`, `foolist` -- array names, as taste informs (is the foo-ness or the array-ness more salient?)
* `xx` / `yy` / `zz` for **position** values within the contextually natural coordinate system. Tag with the frame when the frame is not obvious from context
* `from` and `onto` for initial and final position, `beg` and `end` for starting and ending points of a sequence or continuum, `ante` and `post` for before/after in time or processing steps, `prev`, `curr` and `next` for a chain or other ordered situation
* `str`            -- generic string
* `num`            -- generic num
* `err`            -- error; **never** use `error` as a variable name
* `obj`            -- specifically to mean 'object-like'; otherwise use `bag`, and double-check whether its object-ness is really the most salient
* `name`           -- identifier perfectly isomorphic with what it identifies, though it may be contextual. Prefer `title`, `kind`, `label`, `handle`, `flavor` when they are a better match. Lots and lots of things have name in their name, don't casually make it more crowded
* `title`          -- human readable name, independent of the item's identity. Don't use title as an identifier or vice-versa
* `Model`          -- parent class / generic term for a business model data structure

### Variables

- `const` by default, `let` only where the value is actually reassigned -- which you should
  rarely do.
- functional programming is strongly preferred

Mildly prefer to not camelcase within the name of a reified concept. Good: `lightbulb`,
`religiousGroup` (too long to get away with it).

## Braces

- Opening braces go at end of the line.
- Always brace `if`/`else` and other blocks, even single-statement ones: `if (nope) { return }`
- Cuddle `} else if (...) {` and `} catch (err) {`.
- Short guards stay on one line, still braced, if they should be read in passing. If they warrant
  more attention, expand.
- Parenthesize and space every negation (`!`) expression -- `if (! approved) { ... }`, to give it
  proper visual weight and transparent order of operations.

## Strings

`'` by default (no shift key). `"` for a string likely to hold an apostrophe -- prose, a
notice, a `describe()`, and every `it`/`describe` title -- so it reads without a backslash:
`"That isn't readable"`, never `'That isn\'t readable'`. When forced to quote a key, use `"`.
In cases where there's a parallel construction, switching quotes means the IDE can help align
them:

```ts
  // Our IDE can vertically align the second slot on `  "` and the third on ` '`
  const PadTestCases = [
    [[ "", 0            ],  "",             'empty string, length: 0, default padding: returns input'],
    [[ "", 0, " "       ],  "",             'empty string, length 0, space padding explicit: returns input'],
    [[ "hello world", 0 ],  "hello world",  'string, length: 0, default padding: returns input'],
  ]
  const title = 'Airplane!'
  const entry = { "title":  'Airplane!' }
  const val   = obj["this.that"]
```

---

## Anonymous / Lambda / Dagger Functions

Params are always parenthesized, even a single one: `(val) => val[fieldname]`.
Use dagger functions for inline-lambdas.

## Comments

Bulleted lists use `*` at the top level and `-` (indented two spaces per level) for sub-lists.

Use `/** */` for doc blocks, `/* */` for TODOs; `//` for running clarifications (same or
preceding line) and commented-out code.

### Doc Blocks

Focus on what the end user needs to know.
Do NOT describe the internals of the function, or make notes about its development, or describe
future work, in a function's doc string.

* Use this order, as needed:
  - header
  - `@param`
  - `@returns`, followed by a newline if there are examples;
  - `@examples` -- don't be stingy.
* Header should tell the overall story of the function.
  - Elide unnecessary articles, self-mentions, and fluff.
    GOOD: `Array/map to merge as described by \`keypath\``
    BAD: `An array or map that this function will combine at the location described by keypath`
* A `@param` block describes that parameter's role, maybe its interactions -- not the function's
  actions upon it. It's an entry in the playbill, not the sparknotes or the script.
  BAD: `@param keypath - each succeeding element is used as a path element: first we look up ...`
  GOOD: `@param keypath - Slot to merge into; numeric segments index into arrays.`
* First line should be a `/** Brief statement of function if that's truly enough */`, or
  `/** Description of function, continuing on following lines, but worded and line-break'ed so the reader can get`
  ... the picture.
* `@example` on one line, if short enough; otherwise, split to multiple lines, indented by two
  spaces.

### Function preambles (`/** */` docblocks)

All functions get a docblock immediately above the definition.

**Tone and content:**

* Lead with what the function *is* or *returns*. Omit "Creates/Builds/Calculates/Finds" when you
  can say it more directly. "Bounding-box record for min/max extent tuples" beats "Builds a
  bounding-box record from supplied min/max extent tuples."
* Omit implementation details: delegation chains, internal mechanics.
  - if there are important caveats for future authors, include them as running comments

With that said, it is easier for the next programmer to remove excess prose than to wonder at
missing details. Be informative.

## Visual Weight == Didactic Weight

Make the visual tempo of the code match what you're trying to communicate:

```ts
  // Compare  A: "passing check, nothing to see here, move along"
  if (isNil(opts.something)) { throw new Error('Please supply the "something" option; received keys were ' + keys(opts)) }
  // ...With  B: "pay attention to what is happening here"
  if (isNil(opts.nuclearLaunchAuthorizationCode)) {
    throw new Error('The opts.nuclearLaunchAuthorizationCode is absent, please audit the call chain. Received keys were ' + keys(opts))
  }
```

Use whitespace to make parallel construction clear, as we do with test examples:

```ts
  const PadTestCases = [
    [["", 0],                       "",                    'empty string, length: 0, default padding: returns input'],
    [["hello world", 0],            "hello world",         'string, length: 0, default padding: returns input'],
    [["hello world", 12],           " hello world",        'string, length one more than its own, default padding: adds one space'],
  ]
```

---

## Mechanically Enforced

`eslint.config.mjs` enforces a strict set of rules; exceptions are as follow

**Deliberately not enforced** -- so don't "fix" these:

* `camelcase` is off, because `woodname` / `fooname` are correct here.
* `no-use-before-define` is off; define helpers below their callers when that reads better.
* `quotes` is not enforced -- the single/double convention above is yours to keep by hand.
* `no-underscore-dangle`, `no-continue`, `no-await-in-loop` are off: no objections to their use

**Allowed as safety hatches**:

Do not casually disable the type checker: not with a bang (`no-non-null-assertion`),
not with a whimper (`no-explicit-any`), not with a temper tantrum (`ban-ts-comment`)
That said: without the ability to deplot these so that we can investigate why a problem exists, there's a danger that the coder will thrash trying to make the linter happy when the problem is elsewhere. Also, if we ban them outright we don't get information about whether they are necessary; if we allow them, and they're not used or used with care, then we will switch them on.

Use these when needed, but ALWAYS discuss in chat.

**Allowed in deliberate situations**

In general, do not write code modifying object you don't own. `no-param-reassign' is switched on.
However, if it's appropriate, use it and apply an eslint-disable-line

In ordinary circumstances, always do return await from a try or catch block, and don't do it otherwise.
However, if you want the current method to remain in the stacktrace, do a return await