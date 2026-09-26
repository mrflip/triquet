import type * as TY from './types'

/** A property descriptor, whatever the value's type */
export type Propdesc<VT = unknown> = TypedPropertyDescriptor<VT>

/**
 * Attach a hidden, frozen property to `obj`.
 *
 * Non-enumerable and non-writable, so it survives a debugger but not a spread or a
 * `JSON.stringify`. Reach for it when a value belongs *to* an object without belonging to its
 * data -- a back-reference, a cached derivation, a tag only the machinery reads.
 *
 * See also {@link setNormalProp} for a visible one, and {@link decorate} for several at once.
 *
 * @param obj - The object to attach to; mutated in place.
 * @param ckey - Name of the property.
 * @param val - What to attach.
 * @returns `val`, so the call can stand in for the value.
 *
 * @example adorn({}, 'parent', quiz)  // => quiz, and the property does not serialise
 */
export function adorn<VT>(obj: object, ckey: string, val: VT): VT {
  Object.defineProperty(obj, ckey, { value: val, enumerable: false, writable: false, configurable: true })
  return val
}

/**
 * Attach an ordinary visible property to `obj`.
 *
 * Enumerable and writable -- indistinguishable from one written with `=`, but defined rather
 * than assigned, so it lands even where a setter on the prototype would otherwise intercept.
 *
 * @param obj - The object to attach to; mutated in place.
 * @param ckey - Name of the property.
 * @param val - What to attach.
 * @returns `val`.
 *
 * @example setNormalProp({}, 'title', 'Round One')  // => 'Round One'
 */
export function setNormalProp<VT>(obj: object, ckey: string, val: VT): VT {
  Object.defineProperty(obj, ckey, { value: val, enumerable: true, writable: true, configurable: true })
  return val
}

/**
 * Attach every entry of `vals` to `obj` as an ordinary visible property.
 *
 * @param obj - The object to attach to; mutated in place.
 * @param vals - Properties to attach.
 * @returns `obj`, typed as carrying both.
 *
 * @example setNormalProps({ aa: 1 }, { bb: 2 })  // => { aa: 1, bb: 2 }
 */
export function setNormalProps<OT extends object, VT extends TY.AnyBag>(obj: OT, vals: VT): OT & VT {
  for (const [ckey, val] of Object.entries(vals)) {
    Object.defineProperty(obj, ckey, { value: val, enumerable: true, writable: true, configurable: true })
  }
  return obj as OT & VT
}

/**
 * Attach every entry of `vals` to `obj`, hidden from enumeration but still writable.
 *
 * The middle setting between {@link setNormalProps} and {@link decorate}: out of sight of a
 * spread or a serialiser, but not frozen.
 *
 * @param obj - The object to attach to; mutated in place.
 * @param vals - Properties to attach.
 * @returns `obj`, typed as carrying both.
 */
export function setHiddenProps<OT extends object, VT extends TY.AnyBag>(obj: OT, vals: VT): OT & VT {
  for (const [ckey, val] of Object.entries(vals)) {
    Object.defineProperty(obj, ckey, { value: val, enumerable: false, writable: true, configurable: true })
  }
  return obj as OT & VT
}

/**
 * Attach every entry of `vals` to `obj`, hidden and frozen.
 *
 * {@link adorn} for several properties at once -- the usual way to hang machinery off a
 * function or a class without it showing up in the object's data.
 *
 * @param obj - The object to attach to; mutated in place.
 * @param vals - Properties to attach.
 * @returns `obj`, typed as carrying both.
 *
 * @example decorate(Validator, { Checks, Kit })  // => Validator, with neither enumerable
 */
export function decorate<OT extends object, VT extends TY.AnyBag>(obj: OT, vals: VT): OT & VT {
  for (const [ckey, val] of Object.entries(vals)) {
    Object.defineProperty(obj, ckey, { value: val, enumerable: false, writable: false, configurable: true })
  }
  return obj as OT & VT
}

/**
 * Descriptors of every own property of `obj`, enumerable or not.
 *
 * @param obj - Any object, or nothing at all.
 * @returns The descriptors by name; an empty bag when `obj` is nil.
 *
 * @example ownProps({ aa: 1 }).aa?.value  // => 1
 * @example ownProps(null)                 // => {}
 */
export function ownProps(obj: object | null | undefined): TY.Bag<Propdesc> {
  if (obj === null || obj === undefined) { return {} }
  return Object.getOwnPropertyDescriptors(obj)
}

/**
 * Names of every own property of `obj`, enumerable or not.
 *
 * @param obj - Any object, or nothing at all.
 * @returns The names; an empty array when `obj` is nil.
 *
 * @example ownPropnames({ aa: 1, bb: 2 })  // => ['aa', 'bb']
 * @example ownPropnames(undefined)         // => []
 */
export function ownPropnames(obj: object | null | undefined): string[] {
  if (obj === null || obj === undefined) { return [] }
  return Object.getOwnPropertyNames(obj)
}

/**
 * Names of every own property of the object's immediate prototype.
 *
 * One step up only -- a class instance reports its class's methods, not the grandparent's.
 *
 * @param obj - Any object, or nothing at all.
 * @returns The names; an empty array when `obj` is nil or has no prototype.
 */
export function protoPropnames(obj: object | null | undefined): string[] {
  if (obj === null || obj === undefined) { return [] }
  return ownPropnames(Object.getPrototypeOf(obj) as object | null)
}

/**
 * Descriptor of one own property of `obj`.
 *
 * @param obj - The object to look on.
 * @param propname - Name of the property.
 * @returns Its descriptor, or `undefined` if `obj` does not own it.
 */
export function ownProp<VT = unknown>(obj: object, propname: string): Propdesc<VT> | undefined {
  return Object.getOwnPropertyDescriptor(obj, propname)
}

/**
 * Descriptor of one property of the object's immediate prototype.
 *
 * @param obj - The object whose prototype to look on.
 * @param propname - Name of the property.
 * @returns Its descriptor, or `undefined` if the prototype does not own it.
 */
export function protoProp<VT = unknown>(obj: object, propname: string): Propdesc<VT> | undefined {
  const proto = Object.getPrototypeOf(obj) as object | null
  if (proto === null) { return undefined }
  return Object.getOwnPropertyDescriptor(proto, propname)
}

/**
 * Descriptor of the first `propname` found while climbing the prototype chain.
 *
 * `depth` is how many prototypes to climb past the object itself, so the default of `0` looks
 * only at own properties and `1` also reaches the class.
 *
 * @param obj - Where to start looking.
 * @param propname - Name of the property.
 * @param depth - Prototypes to climb; `0` means own properties only.
 * @returns The first descriptor found, or `undefined`.
 *
 * @example getProp({ aa: 1 }, 'aa')?.value                    // => 1
 * @example getProp(Object.create({ aa: 1 }), 'aa', 1)?.value  // => 1
 * @example getProp(Object.create({ aa: 1 }), 'aa')            // => undefined
 */
export function getProp<VT = unknown>(obj: object, propname: string, depth = 0): Propdesc<VT> | undefined {
  let here: object | null = obj
  let left = depth
  while (here !== null) {
    const found = Object.getOwnPropertyDescriptor(here, propname)
    if (found !== undefined) { return found }
    if (left <= 0) { return undefined }
    left -= 1
    here = Object.getPrototypeOf(here) as object | null
  }
  return undefined
}
