// import type   * as TSTB                                      from 'ts-toolbelt'
// import type { A as TSTA, O as TSTO }                         from 'ts-toolbelt'
// export type { Any as TSTA, List as TSTL, Object as TSTO, Tuple as TSTT, Union as TSTU } from 'ts-toolbelt' // eslint-disable-line import/no-extraneous-dependencies

// For the Static Factory pattern -- https://tsplay.dev/w8Dkpw

type Bag<TT>     = { [key: string]: TT }
export type ArrRO<T>            = readonly T[]
export type ArrNZRO<T>          = readonly [T, ...T[]]
export type StrArrNZRO          = ArrNZRO<string>
export type ArrNZ<T>            = [T, ...T[]]
export type StrArrNZ            = ArrNZ<string>
export type NonEmptyArray<T>    = ArrNZ<T>
export type NonEmptyStringArray = StrArrNZ

export type Optionally<T> = { [P in keyof T]?: T[P] | undefined; }
export type Nullablize2<OT,    KT extends keyof OT> = Omit<OT, KT> & { [P in KT]:          OT[P] | null }
export type Optionalize2<OT,   KT extends keyof OT> = Omit<OT, KT> & { [P in KT]?:         OT[P] | undefined }
export type Optnullablize2<OT, KT extends keyof OT> = Omit<OT, KT> & { [P in KT]?:         OT[P] | undefined | null }
export type Unnullablize2<OT,  KT extends keyof OT> = Omit<OT, KT> & { [P in KT]:   Exclude<OT[P], null> }
export type Unoptionalize2<OT, KT extends keyof OT> = Omit<OT, KT> & { [P in KT]-?: Exclude<OT[P], undefined> }
export type Requireize2<OT,    KT extends keyof OT = keyof OT> = Omit<OT, KT> & { [P in KT]-?: Exclude<OT[P], undefined | null> }

export type Nullablize<OT,      KT extends string = keyof OT & string> = Omit<OT, KT> & { [P in KT & keyof OT]:          OT[P] | null }
export type Partialize<OT,      KT extends string = keyof OT & string> = Omit<OT, KT> & { [P in KT & keyof OT]?:         OT[P] }
export type Optionalize<OT,     KT extends string = keyof OT & string> = Omit<OT, KT> & { [P in KT & keyof OT]?:         OT[P] | undefined }
export type Optnullablize<OT,   KT extends string = keyof OT & string> = Omit<OT, KT> & { [P in KT & keyof OT]?:         OT[P] | undefined | null }
export type Unnullablize<OT,    KT extends string = keyof OT & string> = Omit<OT, KT> & { [P in KT & keyof OT]:   Exclude<OT[P], null> }
export type Unoptionalize<OT,   KT extends string = keyof OT & string> = Omit<OT, KT> & { [P in KT & keyof OT]-?: Exclude<OT[P], undefined> }
export type UnPartialize<OT,    KT extends string = keyof OT & string> = Omit<OT, KT> & { [P in KT & keyof OT]-?:         OT[P] }
export type Requireize<OT,      KT extends string = keyof OT & string> = Omit<OT, KT> & { [P in KT & keyof OT]-?: Exclude<OT[P], undefined | null> }
export type OptionalizePick<OT, KT extends keyof OT> = Pick<OT, KT> & { [P in Exclude<keyof OT, KT>]?: OT[P] | undefined }

export type Invert<BagT extends Record<string, string>>   = { [KT in keyof BagT as BagT[KT]]: KT }

/** Scrub undefined values from an array */
export type ArrDefinedVals<A extends readonly unknown[]> =
  A extends readonly [infer First, ...infer Rest]
    ? [undefined] extends [First]
      ? [First] extends [undefined]
        ? ArrDefinedVals<Rest>
        : [...([] | [First]), ...ArrDefinedVals<Rest>]
      : [First, ...ArrDefinedVals<Rest>]
    : A extends readonly []
      ? []
      : Exclude<A[number], undefined>[]

/** Scrub undefined values from an object */
export type ObjDefinedVals<O extends object> = {
  [K in keyof O as O[K] extends undefined ? never : K]: Exclude<O[K], undefined>
}

/** Scrub undefined values from a collection */
export type DefinedVals<O extends unknown[] | object> =
  O extends unknown[]
    ? ArrDefinedVals<O>
    : O extends object
      ? ObjDefinedVals<O>
      : never
