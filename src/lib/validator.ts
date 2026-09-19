import * as Z from 'zod'
import * as CK from './vv/checks/strings'

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
  /** Prose exactly as the author wrote it: newlines welcome, control characters not, never trimmed */
  textish:   CK.textish,
  /** Prose as `textish` takes it, but trimmed */
  noteish:   CK.noteish,
  /** A formula's source: newlines welcome, control characters not, never trimmed, at most 999 characters */
  formulaish: CK.formulaish,
  /** Human-readable name on one line, independent of any identity it might accompany */
  titleish:  CK.titleish,
  /** Lowercase Crockford-base32 ULID, as minted by `mintId` */
  ulid:      CK.ulid,
  /** Freeform-string-derived identifier: lowercase letters, digits, underscore; letter first, letter or digit last */
  label:     CK.label,
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

/** The keys of a schema's definition that hold a single schema inside it */
const SoleChildKeys = ['innerType', 'element', 'in', 'out', 'left', 'right', 'keyType', 'valueType', 'rest'] as const

/**
 * The plain schema under a callable wrapper, with every wrapper embedded inside it unwrapped
 * too, for tools that key on a schema's identity and so cannot see through one, such as
 * `Z.toJSONSchema`.
 *
 * This edits the schemas' definitions in place, swapping each wrapper for the schema it wraps;
 * both parse identically, so nothing that already holds them notices. Safe to call twice.
 *
 * @param schema - Any schema, callable or not.
 * @returns The plain schema.
 *
 * @example Z.toJSONSchema(plain(LightbulbValidators.lightbulb))
 */
export function plain<SC extends Z.ZodType>(schema: SC): SC {
  return unwrapped(schema, new Set()) as SC
}

/** `schema` unwrapped, and its children with it, remembering which it has done */
function unwrapped(schema: Z.ZodType, done: Set<object>): Z.ZodType {
  const bare: Z.ZodType = typeof schema === 'function' ? Object.getPrototypeOf(schema) as Z.ZodType : schema
  if (done.has(bare)) { return bare }
  done.add(bare)
  const def = bare._zod.def as unknown as Record<string, unknown>
  for (const key of SoleChildKeys) {
    if (isSchema(def[key])) { def[key] = unwrapped(def[key], done) }
  }
  for (const holder of [def.shape, def.options]) {
    if (typeof holder !== 'object' || holder === null) { continue }
    const bag = holder as Record<string, unknown>
    for (const [ckey, child] of Object.entries(bag)) {
      if (isSchema(child)) { bag[ckey] = unwrapped(child, done) }
    }
  }
  return bare
}

/** Whether `val` is a Zod schema, callable or not */
function isSchema(val: unknown): val is Z.ZodType {
  return (typeof val === 'object' || typeof val === 'function') && val !== null && '_zod' in val
}
