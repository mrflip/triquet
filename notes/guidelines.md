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

Build every schema through a `Validator` block, or from the kit's aliases where a block is more
than the job needs. Import `zod` itself only for its types (`Z.input`, `Z.output`, `Z.ZodError`);
the kit's `zod` key is the escape hatch for the rare thing it does not alias.

A Validator should be your first choice for filling in defaults, coercing types, collapsing union types, checking limits.

```ts
// GOOD: No fear about measured being spreadable; offers generous interface without distracting code
function convertUnits(measured: MeasuredT, units: MeasurementUnitOrSomethingOrSomethingElse) {
  const { measured: { val:fromVal, units:fromUnits }, intoUnits } = Validate.convertUnits.parse({ measured, intoUnits: units })
  // do stuff with fromVal, fromUnits and intoUnits...
  const intoVal = ...
  return { ...measured, val: intoVal, units: intoUnits }
}
// BAD:
if (nBottles > 99) { throw new Error("At most 99 bottles per wall") }
// BETTER: (using bareint.min(0).max(99).description('...')) -- min and max each have their own crafted message; no risk of having one limit here and a different one there
const nBottles = Validator.placeBottles.parse(nBottles)
```

Anticipate likely error conditions and refusals: make sure they are surfaced to the customer in a calm, frank manner. Test that they are handled as you expect. If an error condition doesn't signal a problem -- such as in convex, where repeating something already done is a refusal but not a problem -- do not surface it, and test that it is not surfaced.

### Where validation sits, with the database on the server

The entrypoints that matter most are **between the UI and the app**: a field's new value being
submitted, an import, a reply from a model. Validate there, with the same Zod schemas the tables
are derived from. Then again at the server's door: every Convex function takes its arguments
through our Zod schemas, and every row passes its row validator before it is written, so the
mutation is a chokepoint no client can skip. Never rely on the database alone to refuse bad data:
Convex's schema validation is the second net, and a write refused there makes a lousy message.
What the derived table cannot carry (patterns, lengths, integers, a check across fields) is the
row validator's; nested values and closed sets it carries. Past the boundary, rows are clean,
and rows read back are trusted.

### The patch pattern

A model that can be revised field by field publishes a second schema beside its own, `fooPatch`,
and a `FooPatch` type. **Do not derive it with `.partial()`.** A default still fires through
`.partial()`, so a one-field patch built that way arrives carrying every *other* field's default
and quietly wipes what the author had.

Instead, name each field once, bare -- its checks and its `.describe()`, no default -- and then
give it opposite treatment in the two schemas: `.default(...)` in the model, `.optional()` in
the patch.

```ts
export const LightbulbValidators = Validator(({ obj, titleish, uint, ulid }) => {
  const title  = titleish.describe('What the box says.')
  const lumens = uint.max(200).nullable().describe('Brightness; null when unrated.')

  const lightbulb      = obj({ id: ulid, title: title.default(''), lumens: lumens.default(null) })
  const lightbulbPatch = obj({           title: title.optional(),  lumens: lumens.optional() })
  return { lightbulb, lightbulbPatch }
})

export type LightbulbPatch = Z.output<typeof LightbulbValidators.lightbulbPatch>
```

* **A key absent from a patch means "leave whatever is already there".** Nothing in a patch
  carries a default, ever.
* **`null` means "clear it"**, and only for a field whose model type is nullable. Where input
  arrives from outside and every field must be clearable (see `models/import.ts`), the three
  states are spelled `.nullable().optional()`: absent is *leave it*, null is *clear it*, a value
  is *take this*; and a lookup says what "cleared" means for each field.
* **What a patch leaves out is a statement.** An id is never in one. Neither is anything other
  things refer to the model by (an expression's `owner` and `label`), nor anything derived.
* An action applies a patch by spreading it over the row it revises (`{ ...held, ...patch }`),
  and the row validator checks the result whole before anything is written. The patch itself
  was validated at the entrypoint.

### Zod is patched, on purpose

`patches/zod@4.6.5.patch` flips `reportInput` to default **true**: every Zod issue carries the
value that was refused. `lib/vv/reporting` depends on it to tell the four kinds of nothing apart
(unset, missing, nil, blank) and to quote the offending value in the message. This is a
deliberate, understood trade. Its consequence: **a `ZodError` contains user text.** Show it to the
author who typed it; never log it whole, send it to a third party, or return it from a route
handler -- answer with a notice instead. Bumping Zod means re-cutting the patch for the new
version; `tests/lib/zod-patch.test.ts` fails loudly if it did not apply.

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
