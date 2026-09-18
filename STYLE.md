# Application Style Guide

Conventions for `.ts` files in this project. The audience is a human or an AI coding session
working in this codebase;.

## Naming Conventions

**No single-letter names.** Use `row`, `col`, `thing`. The only sanctioned short names are `ii`, `jj` for traditional index iterators.

**Never use bare `name`, `value`, `node`, `error`, or `query` as variable names.** For `name`, there's almost always some salient prefix to supply `fooname` (note: no camel).
**Never use `type` to mean "kind"** as in "selection key into a menu of items" -- not even as part of an identifier. BAD: `woodType` BETTER: `woodkind`. `type` is strictly reserved for data model type. A typename is a string
**Add `name`, `kind`, `handle`, `flavor`, un-camel'ed, for an isomorphic selector**; `woodname` is a string, `wood` is an object

Specificity is a virtue: `bboxHt` makes clear that this height might depend on coordinate system.
Don't add a tag when it's obvious: `title`, not `titleStr`.
However, when genericity is exactly the salient feature, use one of the following tags as is: Good: `pad(str)` (any string might enjoy good padding)

Tags to append or use directly:
* `key`            -- generic map key, `keys` for a collection of keys, `keylist` to emphasize the list aspect.
* `val`            -- any-typed, truly generic value. `vv`/`kk` are secondary choices in a lambda when `key` or `val` is in-scope
* `kind`, `flavor` -- legible enumerated strong identifier. use `handle` for legible freeform strong identifier (eg a slugged title)
* `props` and `propnames` for structured objects;
* `fieldnames` and `fields` for their definitions (i.e. the fields of the class are the props of the instance)
* `idx`            -- generic array index
* `iter`           -- sequence iteration counter
* `ii`/`jj`/`kk` for array iterators, or for element indexes in a grid pattern (use `row` and `col`, or `horiz` and `vert` exactly and only in their precise meaning). One may use `iter` or `seq`, `fooIter` or `fooSeq`, `fooIter0 / fooIter1 / fooIter2`, but ii/jj/kk are never foo'ed.
  - (avoid, however, index-based iteration unless there's a reason neither `for (const foo in foos)` nor `_.map(foos, (foo, ii) => {})` is useable)
* `count` or `ct`  -- reported quantity
* `qty` or `nFoos` -- input quantity
* `ckey`           -- `string|number` collection key: string for a map, index number for an array
* `idx`            -- array index, when it's known to be an integer array index
* `key`            -- map key, when it's known to be a string map key
* `dotkey`         -- string with dotted segments to indicate a ckey path
* `keypath`        -- array with string/number segments to indicate a ckey path
* `anypath`        -- string|array that can be either a dotkey string or a ckey path array
* `funcOrKey`      -- key|keypath|func iteratee value; referred to in text as an "iteratee"
* `funcOrPath`     -- dotkey|keypath|func iteratee value with _.get semantics; referred to in text as an "iteratee"
* `rule`           -- rule ("predicate" in lodash) accepting (val, ckey) and returning truthy/falsy; referred to in text as a "rule"
* `ruleOrKey`      -- key|keypath|rule iteratee value, generating truthy/falsy; referred to in text as a "rule iteratee"
* `reducer`        -- reducer function accepting (acc, val, ckey); referred to in text as a "reducer"
* `comparator`     -- comparator function accepting (aa, bb) and returning positive/zero/negative
* `bag`, `foos`, `foobag` -- generic key-value map (i.e. Record<string, any>); `foos` or `foobag` for a generic-key map of foo's; `barFoos` if you want to highlight that the keys are `bar`-like. `FooForBar` or `FooLookup` for a 1:1 or 1:N lookup table.
* `arr`, `foos`, `foolist` -- array names, as taste informs (is the foo-ness or the array-ness more salient?)
* `xx` / `yy` / `zz` for **position** values within the contextually natural coordinate system. If it's important to
* `from` and `onto` for initial and final position, `beg` and `end` for starting and ending points of a sequence or continuum, `ante` and `post` for before/after in time or processing steps, `prev`, `curr` and `next` for a chain or other ordered situation.
* `loc` would be a variable describing a location; used locally it can have any convenient type, but it's often useful to follow the ducktyped-intent-map pattern described elsewhere. Use `pt` or `vertex` or `center` exactly when you want to specifically note that a location is a point, or a single-point junction, or a unique unambiguous and dominant central location.
* `str`              -- generic string
* `num`              -- generic num
* `err`              -- error; **never** use `error` as a variable name.
* `obj`              -- specifically to mean 'object-like'; otherwise use `bag`, and double-check whether its object-ness is really the most salient
* `name`             -- identifier perfectly isomorphic with what it identifies, though it may be contextual. Prefer `title`, `kind`, `handle` when they are a better match. Lots and lots of things have name in their name, don't casually make it more crowded
* `title`            -- human readable name, independent of the item's identity. Don't use title as an identifier or vice-versa
* `Model`            -- parent class / generic term for a business model data structure


### Variables

- `const` by default, `var` only where the value is actually reassigned -- which you should rarely do
- functional programming is strongly preferred

Mildly prefer to not camelcase within the name of a reified concept. Good: `lightbulb`, `religiousGroup` (too long to get away with it)

## Validation

We distinguish these distinct lifecycle phases for structured data:

* *Sketch* -- convenient, generous, elegant data format indicating the caller's intent, requesting opinionated defaults. Use when that generosity is warranted over what DNA offers. It may have a different shape than the later stages. However, fields with the names may narrow in type but must always mean the same thing (eg don't use `strategy` for both a strategy record and an enum indicating which record to select)
* *DNA* -- has same structure as `Real` up to validating, defaulting and nulling fields. Can be broader: eg accepting a policy record, or a policy record handle, and offering a default if neither is present.
* *Real* -- fully validated plain JS object (POJO). Every field exists (possibly null, never undefined). If it belongs to a model, it is a subset of that type. Defaults have been applied. Further typechecking is neither needed nor (within module boundary) invited.
* *Live* -- model class instance: data, getters, functions, etc.

Use these verbs: `fill(dna: FooDNA): FooReal`; `live(dna: FooDNA | FooReal): Foo`; `get real(): FooReal` (serializing getter); `get dupe(overrides: FooPatch): FooReal`

Use these to construct types:

```ts
// enums lead with the Vals then the
export const LightbulbTechVals = ['led', 'incandescent', 'fluorescent'] as const
export type  LightbulbTechReal = typeof LightbulbTechVals[number]
export const SocketkindVals    = ['E26', 'E27', 'B12']

export const LightbulbValidators = Validator(({ // from our custom library, it namespaces and provides these...
  obj, title, uint, oneof, // aliased / standardized Zod validators: oneof = enum, obj = object, unum: safe unsigned int
}) => {
  const lightbulbTech     = oneof(LightbulbTechVals)
  const socketkind        = oneof(SocketkindVals)
  const lightbulb = obj({
    title,
    lumens: uint.min(0).max(200).nullable(),
    /** Light bulb technology; @default{ 'led' } */
    tech:         lightbulbTech.default('led'),
    socketkind:   socketkind.default('E26'),
  })
  return { lightbulb, lightbulbTech }
})

export type LightbulbDNA =  Z.input<typeof LightbulbValidators.lightbulb>
export type LightbulbT   = Z.output<typeof LightbulbValidators.lightbulb>

/** (...good docblock here ...) */
export class Lightbulb implements LightbulbT {
  declare title:    string           // these will gain the docblocks of LightbulbT
  declare lumens:   number
  declare tech:     LightbulbTech
  //
  /** (...good docblock here ...) */
  static fill(dna: LightbulbDNA): LightbulbT {
    return LightbulbValidators.lightbulb(dna)
  }
}

```

## Indentation & Braces

- **2 spaces** per indent level. No tabs.
- Opening braces go at end of the line
- Always brace `if`/`else` and other blocks, even single-statement ones: `if (nope) { return }`
- Cuddle `} else if (...) {` and `} catch (err) {`.
- Short guards stay on one line, still braced, if they should be read in passing. If they warrant more attension, expand.
- Parenthesize and space every negation (`!`) expression -- `if (! approved) { ... }`, to give it proper visual weight and transparent order of operations
The eslint.config.mjs file is the ultimate and best source of truth for styling conventions

## Strings

`'` by default (no shift key). When forced to quote a key, use `"`.
In cases where there's a parallel construction, switching quotes means the IDE can help align them:

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

Params are always parenthesized, even a single one.
Use dagger functions for inline-lambdas.

## Comments

Bulleted lists use `*` at the top level and `-` (indented two spaces per level) for sub-lists.

Use `/** */` for doc blocks,  `/* */` for TODOs; `//` for running clarifications (same or preceding line) and commented-out
code.

### Doc Blocks

Focus on what the end user needs to know.
Do NOT describe the internals of the function, or make notes about its development, or describe future work, in a function's doc string.

* Use this order, as needed:
  - header
  - `@param`
  - `@returns`, followed by a newline if there are examples;
  - `@examples` -- don't be stingy.
* Header should tell the overall story of the function.
  - Elide unneccesary articles, self-mentions, and fluff. GOOD: `Array/map to merge as described by \`keypath\`` BAD: `An array or map that this function will combine at the location described by keypath`
* A `@param` block describes that parameter's role, maybe its interactions, not its actions; it's an entry in the playbill, not the sparknotes or the script. Bad: `d]each succeeding element is used as a path element follows: first, ...` Good: `dd
* First line should be a `/** Brief statement of function if that's truly enough */`, or `/** Description of function, continuing on following lines, but worded and line-break'ed so the reader can get\n` ... the picture.
* @example on one line, if short enough; otherwise, split to multiple lines, indented by two spaces.

### Function preambles (`/** */` docblocks)

All functions get a docblock immediately above the definition.

**Tone and content:**

* Lead with what the function *is* or *returns*. Omit "Creates/Builds/Calculates/Finds" when you can say it
  more directly. "Bounding-box record for min/max extent tuples" beats "Builds a bounding-box record from supplied
  min/max extent tuples."
* Omit implementation details: delegation chains, internal mechanics
  - if there are important caveats for future authors, include them as running comments

With that said, it is easier for the next programmer to
remove excess prose than to wonder at missing details. Be informative.

## Visual Weight == Didactic Weight

Make the visual tempo of the code match what you're trying to communicate:

```ts
  // Compare  A: "passing check, nothing to see here, move along"
  if (isNil(opts.something)) { throw 'Please supply the "something" options; received keys were ' ~ keys(opts); }
  // ...With  B: "pay attention to what is happening here"
  if (isNil(opts.nuclearLaunchAuthorizationCode)) {
    throw "The opts.nuclearLaunchAuthorizationCode is absent, please audit the call chain. Received keys were ' ~ keys(opts);
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
