/** Deeper than node's own default of 2: these dumps exist to answer "what is actually in there" */
const DefaultDepth = 4
const IdentRe      = /^[A-Za-z_$][\w$]*$/
// Matching control characters is the whole job here: they are what breaks a terminal and what
// a plain dump renders invisibly. no-control-regex is right in general and wrong here.
// eslint-disable-next-line no-control-regex
const CtrlRe       = /[\u{0}-\u{1F}\u{7F}-\u{9F}]/gu
const CtrlEscs: Record<string, string> = {
  '\b': String.raw`\b`, '\t': String.raw`\t`, '\n': String.raw`\n`,
  '\f': String.raw`\f`, '\r': String.raw`\r`,
}

/** `str` as a quoted literal, preferring the quote character it does not itself contain */
function quoteStr(str: string): string {
  const body = str.replaceAll(CtrlRe, (char) => {
    const hex = (char.codePointAt(0) ?? 0).toString(16).padStart(2, '0').toUpperCase()
    return CtrlEscs[char] ?? String.raw`\x` + hex
  })
  if (! body.includes("'")) { return `'${body}'` }
  if (! body.includes('"')) { return `"${body}"` }
  if (! body.includes('`')) { return `\`${body}\`` }
  const escaped = body.replaceAll("'", String.raw`\'`)
  return `'${escaped}'`
}

/** A bare key prints as itself; anything else gets quoted, the way node's inspect does it */
function quoteKey(key: string): string {
  return IdentRe.test(key) ? key : quoteStr(key)
}

/**
 * The constructor's name, when there is one.
 *
 * Typed optional on purpose: `Object.create(null)` has no constructor at all, which the
 * structural type of `object` does not admit but reality does.
 */
function ctorname(val: object): string | undefined {
  return (val as { constructor?: { name?: string } }).constructor?.name
}

/** Scalars and the objects that have a one-line spelling; null when `val` needs descending into */
function scalarText(val: unknown): string | null {
  if (val === undefined)     { return 'undefined' }
  if (val === null)          { return 'null' }
  switch (typeof val) {
  case 'string':             { return quoteStr(val) }
  case 'number':             { return Object.is(val, -0) ? '-0' : String(val) }
  case 'boolean':            { return String(val) }
  case 'bigint':             { return `${String(val)}n` }
  case 'symbol':             { return val.toString() }
  case 'function':           { return val.name ? `[Function: ${val.name}]` : '[Function (anonymous)]' }
  default:                   { break }
  }
  if (val instanceof Date)   { return Number.isNaN(val.getTime()) ? 'Invalid Date' : val.toISOString() }
  if (val instanceof RegExp) { return String(val) }
  if (val instanceof Error)  { return `${val.name}: ${val.message}` }
  return null
}

/** What node prints in place of a container it has run out of depth for */
function elidedText(val: object): string {
  if (Array.isArray(val)) { return '[Array]' }
  if (val instanceof Map) { return '[Map]' }
  if (val instanceof Set) { return '[Set]' }
  const named = ctorname(val)
  return (named !== undefined && named !== 'Object') ? `[${named}]` : '[Object]'
}

/** `{ aa: 1 }` -- with the constructor's name in front when it is not a plain object */
function braced(val: object, parts: string[]): string {
  const named  = ctorname(val)
  const prefix = (named !== undefined && named !== 'Object') ? `${named} ` : ''
  return parts.length === 0 ? `${prefix}{}` : `${prefix}{ ${parts.join(', ')} }`
}

/** `Set(2) { 1, 2 }` and `Map(0) {}` both read as a labelled brace group */
function labelled(label: string, size: number, parts: string[]): string {
  const body = parts.length === 0 ? '{}' : `{ ${parts.join(', ')} }`
  return `${label}(${String(size)}) ${body}`
}

function enumerableKeys(obj: object): (string | symbol)[] {
  return Reflect.ownKeys(obj).filter((key) => Object.getOwnPropertyDescriptor(obj, key)?.enumerable === true)
}

/** A getter that throws is a property like any other: report it rather than taking the dump down */
function readProp(obj: object, key: string | symbol): unknown {
  try {
    return (obj as Record<string | symbol, unknown>)[key]
  } catch {
    return '[unreadable]'
  }
}

function format(val: unknown, depth: number | null, seen: Set<object>, showHidden: boolean): string {
  const scalar = scalarText(val)
  if (scalar !== null) { return scalar }

  const obj = val as object
  if (seen.has(obj)) { return '[Circular]' }
  if (depth !== null && depth < 0) { return elidedText(obj) }

  seen.add(obj)
  try {
    const under = depth === null ? null : depth - 1
    if (Array.isArray(obj)) {
      const items = obj.map((item) => format(item, under, seen, showHidden))
      return items.length === 0 ? '[]' : `[ ${items.join(', ')} ]`
    }
    if (obj instanceof Set) {
      return labelled('Set', obj.size, [...obj].map((item) => format(item, under, seen, showHidden)))
    }
    if (obj instanceof Map) {
      return labelled('Map', obj.size, [...obj].map(([ckey, item]) => (
        `${format(ckey, under, seen, showHidden)} => ${format(item, under, seen, showHidden)}`
      )))
    }
    // Own keys rather than Object.keys: a property explicitly set to undefined is exactly what a
    // JSON dump swallows, and exactly what you most need to see.
    const keys  = showHidden ? Reflect.ownKeys(obj) : enumerableKeys(obj)
    const parts = keys.map((key) => {
      const shown = typeof key === 'symbol' ? `[${key.toString()}]` : quoteKey(key)
      return `${shown}: ${format(readProp(obj, key), under, seen, showHidden)}`
    })
    return braced(obj, parts)
  } finally {
    seen.delete(obj)
  }
}

/**
 * Render `val` the way node's `util.inspect` would, using nothing but the language.
 *
 * This is the browser half of `inspectify`; see that function for the contract. It is a close
 * approximation of node's output rather than a reimplementation of it -- enough that a value
 * reads the same in a browser console as in a server log, without carrying node's formatter
 * into the client bundle.
 *
 * @param val - Anything at all.
 * @param opts - `depth` bounds the descent (`null` for no bound); `showHidden` includes
 *   non-enumerable own properties.
 * @returns The rendered text. Throws only if the caller's own getters do.
 */
export function runInspect(val: unknown, opts: { depth?: number | null, showHidden?: boolean } = {}): string {
  // `?? DefaultDepth` would be wrong: an explicit `depth: null` means no limit, not absence.
  const depth = opts.depth === undefined ? DefaultDepth : opts.depth
  return format(val, depth, new Set<object>(), opts.showHidden ?? false)
}
