import * as Z from 'zod'
import { zid as convexZid } from 'convex-helpers/server/zod4'
import * as CK from './vv/checks/strings'
import { Inconsistent } from './errors'

/** What a row id looks like: a Convex document id, or a UUID */
const rowidish = Z.union([CK.convexid, Z.uuid()])

/**
 * A pointer to a row of `tablename`, as Convex's own `zid` makes one, holding a row id's shape:
 * the bridge to Convex still reads it as an id of that table.
 *
 * @example zid('quizzes').parse('j97d0qbj35dar1v8edndzckvsx8f828f')
 */
function zid<TN extends string>(tablename: TN) {
  return convexZid(tablename).refine((val) => rowidish.safeParse(val).success, 'should be a row id')
}

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
  unk:       Z.unknown(),
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
  /** A pointer to a row of the table named: internal, never shown, and checked against that table by Convex */
  zid,
  /** A random UUID, of the kind `crypto.randomUUID()` mints */
  uuid:      Z.uuid(),
  /** An id in a quiz as the tool holds it whole: its row's id; or a UUID, in a quiz built rather than read (a test's fixture) */
  treeid:    rowidish,
  /** Freeform-string-derived identifier: lowercase letters, digits, underscore; letter first, letter or digit last; never a reserved word */
  label:     CK.label,
  /** A label global across the app, a hunt's: never a word kept for the app's own pages and people either */
  toplabel:  CK.toplabel,
  /** Shaped as a label, but any word at all: a value typed in a label's alphabet that names nothing in the tool */
  labelshape: CK.labelshape,
  /** An ident's label: label-shaped, 6 to 24 characters, since it is a name a person chose and types to become; never a reserved word, top-level ones included */
  identlabel: CK.identlabel,
  /** Epoch milliseconds */
  timestamp: Z.int().positive(),
  /**
   * One of a row's stamps (`created_at`, `updated_at`), in epoch milliseconds (`Stamps`). The
   * database's writer stamps each row it writes (`convex/stamping.ts`), so a row validated on its
   * way there is stamped now, for the moment.
   */
  stamp:     Z.int().positive().default(() => Date.now()),
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

/** Validators already built, spread into a block's kit beside the builders: one namespace, or several */
export type ValidatorSources = ValidatorBag | readonly ValidatorBag[]

/** Every namespace in `Src`, merged into one */
export type SpreadSources<Src> =
  Src extends readonly [infer Head, ...infer Rest] ? Head & SpreadSources<Rest>
    : Src extends readonly unknown[] ? unknown
      : Src

/** What a `Validator` block receives: the kit, with the validators of `Src` spread in */
export type SpreadKitT<Src extends ValidatorSources> = ValidatorKitT & SpreadSources<Src>

export type ValidatorBuilder<Bag extends ValidatorBag, Src extends ValidatorSources = readonly []> = (kit: SpreadKitT<Src>) => Bag

/**
 * Namespace of callable validators, built from the standardized kit.
 *
 * The block receives the kit and returns the schemas worth exporting; each comes back callable,
 * so `LightbulbValidators.lightbulb(dna)` parses while `Z.input<typeof ...>` still reads the
 * schema's types. Everything the block keeps to itself stays private to it.
 *
 * Namespaces passed as `sources` are spread into the kit, so a block destructures another
 * model's validators beside `obj` and `uint`. A name may come from only one place: a source that
 * repeats a kit name or another source's name throws when the block is built.
 *
 * @param build - Receives the aliased Zod builders and the sources' validators; returns the schemas to publish, by name.
 * @param sources - A namespace of validators, or a list of them, to spread into the kit.
 * @returns The same schemas, each callable as its own parse function.
 *
 * @example
 *   const LightbulbValidators = Validator(({ obj, title, uint }) => {
 *     const lightbulb = obj({ title, lumens: uint.max(200).nullable() })
 *     return { lightbulb }
 *   })
 *   LightbulbValidators.lightbulb({ title: 'Anglepoise', lumens: 400 })  // throws
 *
 *   const LampValidators = Validator(({ obj, titleish, lightbulb }) => {
 *     const lamp = obj({ title: titleish, bulbs: lightbulb.array() })
 *     return { lamp }
 *   }, LightbulbValidators)
 */
export function Validator<Bag extends ValidatorBag, const Src extends ValidatorSources = readonly []>(
  build: ValidatorBuilder<Bag, Src>, sources?: Src,
): CallableBag<Bag> {
  const bag = build(spreadKit(sources ?? []) as SpreadKitT<Src>)
  return Object.fromEntries(
    Object.entries(bag).map(([key, schema]) => [key, callable(schema)]),
  ) as unknown as CallableBag<Bag>
}

/** The kit with every source's validators spread in, refusing a name that arrives twice */
function spreadKit(sources: ValidatorSources): Record<string, unknown> {
  const entries = [ValidatorKit, ...[sources].flat()].flatMap((bag) => Object.entries(bag))
  const keys = entries.map(([key]) => key)
  const twice = keys.filter((key, ii) => keys.indexOf(key) !== ii)
  if (twice.length > 0) { throw Inconsistent('Validator sources may not repeat a name the kit or another source gives', { twice }) }
  return Object.fromEntries(entries)
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
  // A callable handed back is unwrapped first, so a wrapper never wraps another.
  const bare = bareOf(schema) as SC
  const parse = (dna: Z.input<SC>): Z.output<SC> => bare.parse(dna)
  Object.setPrototypeOf(parse, bare)
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
  const bare = bareOf(schema)
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

/** The schema under a callable wrapper, or `schema` itself when it is not wrapped */
function bareOf(schema: Z.ZodType): Z.ZodType {
  return typeof schema === 'function' ? Object.getPrototypeOf(schema) as Z.ZodType : schema
}

/** Whether `val` is a Zod schema, callable or not */
function isSchema(val: unknown): val is Z.ZodType {
  return (typeof val === 'object' || typeof val === 'function') && val !== null && '_zod' in val
}
