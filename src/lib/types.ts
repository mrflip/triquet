// import either named types, or as `import * as TY from ...`
// do not lard this file with tons of types! This is for a core of broadly-used utility types

/** String or we'll figure it out for you */
export type StringMaybe    = string | null | undefined
/** Lookup table / dictionary of generic properties */
export type Bag<VT> = Record<string, VT>
/** Generic bag of properties */
export type AnyBag = Bag<any>
/** Read-only Array */
export type ArrRO<AT>            = readonly AT[]
/** Read-only non-empty array */
export type ArrNZRO<AT>          = readonly [AT, ...AT[]]
/** Non-empty array */
export type ArrNZ<AT>            = [AT, ...AT[]]
