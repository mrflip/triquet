import * as Z from 'zod'

/**
 * Aliased, standardized Zod builders handed to every `Validator` block. Naming follows
 * `STYLE.md`'s tag glossary rather than Zod's own vocabulary, so a schema reads in the same
 * words as the code around it.
 */
export const ValidatorKit = {
  /** Escape hatch to the whole Zod surface, for the rare thing this kit does not alias */
  zod:       Z,
  //
  obj:       Z.object,
  arr:       Z.array,
  oneof:     Z.enum,
  union:     Z.union,
  discrim:   Z.discriminatedUnion,
  lit:       Z.literal,
  rec:       Z.record,
  //
  /** Generic string, no constraints beyond being one */
  str:       Z.string(),
  /** Freeform prose the author types: long, but not unbounded */
  text:      Z.string().max(10_000),
  /** Human-readable label, independent of any identity it might accompany */
  title:     Z.string().max(200),
  /** Lowercase Crockford-base32 ULID, as minted by `mintId` */
  ulid:      Z.string().regex(/^[0-9a-hjkmnp-tv-z]{26}$/),
  /** Freeform-string-derived identifier: lowercase letters, digits, underscore; letter-bound */
  label:     Z.string().regex(/^([a-z][a-z0-9_]*[a-z0-9])$/),
  /** Epoch milliseconds */
  timestamp: Z.int().positive(),
  //
  num:       Z.number(),
  int:       Z.int(),
  /** Safe unsigned integer */
  uint:      Z.int().nonnegative(),
  bool:      Z.boolean(),
} as const

export type ValidatorKitT = typeof ValidatorKit

/** A schema that is also its own parse function: `Foos.foo(dna)` is `Foos.foo.parse(dna)` */
export type Callable<SC extends Z.ZodType> = SC & ((dna: Z.input<SC>) => Z.output<SC>)

export type ValidatorBag = Record<string, Z.ZodType>

export type CallableBag<Bag extends ValidatorBag> = { [KK in keyof Bag]: Callable<Bag[KK]> }

/**
 * Namespace of callable validators, built from the standardized kit.
 *
 * The block receives the kit and returns the schemas worth exporting; each comes back callable,
 * so `LightbulbValidators.lightbulb(dna)` parses while `Z.input<typeof ...>` still reads the
 * schema's types. Everything the block keeps to itself stays private to it.
 *
 * @param build - Receives the aliased Zod builders; returns the schemas to publish, by name.
 * @returns The same schemas, each callable as its own parse function.
 *
 * @example
 *   const LightbulbValidators = Validator(({ obj, title, uint }) => {
 *     const lightbulb = obj({ title, lumens: uint.max(200).nullable() })
 *     return { lightbulb }
 *   })
 *   LightbulbValidators.lightbulb({ title: 'Anglepoise', lumens: 400 })  // throws
 */
export function Validator<Bag extends ValidatorBag>(build: (kit: ValidatorKitT) => Bag): CallableBag<Bag> {
  const bag = build(ValidatorKit)
  return Object.fromEntries(
    Object.entries(bag).map(([key, schema]) => [key, callable(schema)]),
  ) as unknown as CallableBag<Bag>
}

/**
 * `schema`, wrapped so that calling it parses.
 *
 * @param schema - Any Zod schema.
 * @returns A function delegating to `schema.parse`, carrying the schema's whole surface.
 *
 * @example callable(Z.string())('hi')  // => 'hi'
 */
export function callable<SC extends Z.ZodType>(schema: SC): Callable<SC> {
  // The schema itself becomes the wrapper's prototype: `.parse`, `.optional()`, `instanceof`
  // and `_zod` all resolve through the chain, so no surface is lost by wrapping.
  const parse = (dna: Z.input<SC>): Z.output<SC> => schema.parse(dna)
  Object.setPrototypeOf(parse, schema)
  return parse as Callable<SC>
}
