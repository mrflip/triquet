# Development Guidelines

How we structure and document code in this project. Read this before designing a module
entrypoint or a data model. For character-level conventions -- names, braces, quotes, doc block
formatting -- see `STYLE.md`.

## Best Practices

Every new piece of code should have a proportional doc block and test suite. What "proportional"
means is described below.

Module entrypoints should apply strict validation and, if complex, purely that and then
orchestrate other methods. These are strict but fair, smooth managers. These functions are
encouraged to offer elegant, convenient, generous interfaces: pass a string, or strings, or
`undefined` if you don't care, we'll find a sensible default. We're here to serve, the function
says. After Zod has done its thing, there's no ambiguity, no undefined-checking paranoia.

After that point, write code that is focused on the task, confident it has clean meaningful
data. Short, single-concern stanzas.

* We enjoy convenience but will not tolerate ambiguity.
* We're comfortable saying "clean data will be clean, unclean data will be yolo" -- sanitize data
  at a high-level entrypoint, then write code without paranoia of absurd data; let the system or
  visual feedback be the policeman. If `undefined` is a perfectly reasonable way to communicate
  "do the right thing here", do the right thing.

## Validation

We distinguish these distinct lifecycle phases for structured data:

* *Sketch* -- convenient, generous, elegant data format indicating the caller's intent, requesting
  opinionated defaults. Use when that generosity is warranted over what DNA offers. It may have a
  different shape than the later stages. However, fields with the same name may narrow in type but
  must always mean the same thing (eg don't use `strategy` for both a strategy record and an enum
  indicating which record to select).
* *DNA* -- same structure as `Real` up to validating, defaulting and nulling fields. Can be
  broader: eg accepting a policy record, or a policy record label, and offering a default if
  neither is present.
* *Real* -- fully validated plain JS object (POJO). Every field exists (possibly null, never
  undefined). If it belongs to a model, it is a subset of that type. Defaults have been applied.
  Further typechecking is neither needed nor (within module boundary) invited.
* *Live* -- model class instance: data, getters, functions, etc.

Use these verbs: `fill(dna: FooDNA): FooReal`; `live(dna: FooDNA | FooReal): Foo`;
`get real(): FooReal` (serializing getter); `get dupe(overrides: FooPatch): FooReal`.

Use these to construct types:

```ts
// enums lead with the Vals, then the derived type
export const LightbulbTechVals = ['led', 'incandescent', 'fluorescent'] as const
export const SocketkindVals    = ['E26', 'E27', 'B12'] as const
export type  LightbulbTech     = typeof LightbulbTechVals[number]
export type  Socketkind        = typeof SocketkindVals[number]

export const LightbulbValidators = Validator(({ // from our custom library, it namespaces and provides these...
  obj, titleish, uint, oneof, // aliased / standardized Zod validators: oneof = enum, obj = object, uint = safe unsigned int
}) => {
  const lightbulbTech = oneof(LightbulbTechVals)
  const socketkind    = oneof(SocketkindVals)
  const lightbulb = obj({
    title:        titleish,
    lumens:       uint.min(0).max(200).nullable(),
    /** Light bulb technology; @default{ 'led' } */
    tech:         lightbulbTech.default('led'),
    socketkind:   socketkind.default('E26'),
  })
  return { lightbulb, lightbulbTech, socketkind }
})

export type LightbulbDNA =  Z.input<typeof LightbulbValidators.lightbulb>
export type LightbulbT   = Z.output<typeof LightbulbValidators.lightbulb>

/** (...good docblock here ...) */
export class Lightbulb implements LightbulbT {
  declare title:      string           // these will gain the docblocks of LightbulbT
  declare lumens:     number
  declare tech:       LightbulbTech
  declare socketkind: Socketkind
  //
  /** (...good docblock here ...) */
  static fill(dna: LightbulbDNA): LightbulbT {
    return LightbulbValidators.lightbulb(dna)
  }
}
```

## Documentation and Comments

**Do not use doc blocks or code comments for progress/development notes, for detailed caveats or
information dumps, or anything else that will become irrelevant later.** Instead, use
`HUMAN-whatsup.md` like a working-group's whiteboard, or a file in this repo's `/notes` folder
whenever that seems more suitable.

Write documentation in proportion to how much the code will be used, and how much there is to
say. Always supply at least one fragment on the very first line of the comment, since it will
still appear even if "folded" in the IDE:
`/** Description, continuing on following lines, but line-break'ed so the essentials are` --
IUCWIDT. See `STYLE.md` for doc block styling and ordering.

Code documentation must focus on serving the *caller* of that code. Code cleanliness and strong
tests are sufficient to serve current and future authors.

### Comments

Legible code written with short functions having strong contracts should rarely require running
comments. Too often a running comment either...

1. ...narrates what the code already does, or what the agent was thinking at the time.
   BAD: `// next, concat the foo and the bar and trim whitespace ...`
   PERFECT: `_.trim(foo + bar)` -- the code speaks for itself.
2. ...reflects poor name choices.
   BAD: `process(node) // calculate the current node's degree`
   BETTER: `degreeFor(currentNode)`
3. ...delimits code that should instead be a short, separate, testable function.
   BAD: `// next, calculate the foo, which should be less than 10` followed by ten lines
   BETTER: `calculateFoo(...)` -- a documented function with tests, not comments, enforcing its
   contract.

## Tests

Methods with an external interface must have at least one test demonstrating each use case.
Every `@example` in a doc block must have a corresponding test.

Once the shape of the test function becomes duplicative, switch to bulk-testing against example
lists. Each example should tie to a plausible failure mode -- nil and missing values, cardinality
mismatches, absurd and not-quite-absurd type mismatches.

Full conventions, with worked examples, live in `.claude/rules/testing.md`. Read that file before
writing tests.
