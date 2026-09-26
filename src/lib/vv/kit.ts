import * as Z from 'zod'

/**
 * The Zod surface, under this project's names.
 *
 * Small on purpose. Every schema needs these, so they never shake out of a bundle anyway, and
 * keeping the list short is what lets the named checks in `./checks/*` arrive by import instead
 * of out of a four-hundred-key bag. See `whiteboard/vv.md`.
 */
export const Kit = {
  /** The whole Zod surface, for the rare thing this kit does not alias */
  zod:      Z,
  //
  obj:      Z.object,
  strictObj: Z.strictObject,
  arr:      Z.array,
  oneof:    Z.enum,
  union:    Z.union,
  discrim:  Z.discriminatedUnion,
  lit:      Z.literal,
  bag:      Z.record,
  tuple:    Z.tuple,
  jsmap:    Z.map,
  jsset:    Z.set,
  custom:   Z.custom,
  lazy:     Z.lazy,
  //
  /** Any string at all */
  str:      Z.string(),
  num:      Z.number(),
  int:      Z.int(),
  bool:     Z.boolean(),
  bigint:   Z.bigint(),
  jsdate:   Z.date(),
  /** Anything, including undefined */
  anything: Z.any(),
  /** Anything, but you must narrow it before use */
  unk:      Z.unknown(),
  znever:   Z.never(),
} as const

export type KitT = typeof Kit

export const {
  obj, strictObj, arr, oneof, union, discrim, lit, bag, tuple, jsmap, jsset, custom, lazy,
  str, num, int, bool, bigint, jsdate, anything, unk, znever,
} = Kit
