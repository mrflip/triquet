import       _                               /**/ from 'lodash'
import type { AnyBag }                            from '../types/index.ts'
import      { ELLIPSIS_1GLYPH, ELLIPSIS_3DOTS }   from '../Consts.ts'
import      { inspectify }                        from './stringify.ts'
import      { throwable }                         from './OutcomeUtils.ts'
import      { scrubVoid }                         from './PropUtils.ts'

type StringMaybe = string | undefined | null

const BRIEF_STRINGIFIER = (_vv: any) => inspectify(_vv, { naked: true, maxlen: 80 })
export function snipjoin(arr: any[], { max = 8, joiner = ', ', stringifier = BRIEF_STRINGIFIER, yadayada = ', ...', shave = 1, ...rest }: toSentenceOpts = {}) {
  return toSentence(arr, { max, joiner, stringifier, shave, yadayada, lastJoiner: joiner, pairJoiner: joiner, ...rest })
}
export function briefSentence(arr: readonly any[], briefSentenceOpts: toSentenceOpts = {}): string {
  const { max = 8, joiner = ', ', stringifier = BRIEF_STRINGIFIER, yadayada = ', ...', shave = 1, ...rest } = briefSentenceOpts
  return toSentence(arr, { max, joiner, stringifier, shave, yadayada, lastJoiner: joiner, pairJoiner: joiner, ...rest })
}
export interface toSentenceOpts {
  joiner?: StringMaybe, conj?: string, lastJoiner?: StringMaybe, pairJoiner?: StringMaybe,
  max?: number, min?: number, shave?: number, yadayada?: string, whoa?: string,
  empty?: string, stringifier?: (val: any) => string,
}
export function toSentence(arr: any[] | AnyBag, opts: toSentenceOpts = {}): string {
  const conj   =  opts.conj ?? 'and'
  const joiner = opts.joiner ?? ', '
  // const joinchar = joiner.trim
  const {
    max:_max = Infinity, min = 0, shave = 0, whoa = '', empty = '',
    lastJoiner = `${joiner}${conj} `, pairJoiner = ` ${conj} `, yadayada = `${joiner}...${joiner}${conj} `,
    stringifier = BRIEF_STRINGIFIER, joiner:_j, conj:_c, ...rest
  } = opts
  const max = _.clamp(Number(_max), _.clamp(Number(min), 0, Infinity), Number(_max))
  if (! _.isEmpty(rest)) { throw throwable(`Need joiner, pairJoiner, lastJoiner, stringifier`, 'blanks', { keys: _.keys(rest) }) }
  //
  const joinable: manyAndLastResult = manyAndLast(_.values(arr), { max, shave }) as manyAndLastResult
  const { iam } = joinable
  if (iam === 'void') { return empty }
  if (iam === 'xnil') { return empty + whoa }
  if (iam === 'solo') { return stringifier(joinable.first) }
  if (iam === 'xone') { return stringifier(joinable.first) + whoa }
  const last = stringifier(joinable.last)
  if (iam === 'pair') { return stringifier(joinable.first) + (pairJoiner ?? '') + last }
  if (iam === 'xtwo') { return stringifier(joinable.first) + (yadayada   ?? '') + last + whoa }
  const many = _.map(joinable.many, stringifier)
  if (iam === 'many') { return many.join(joiner) + (lastJoiner ?? '') + last }
  // extra elements present. Even with two we want to indicate the overflow
  return many.join(joiner) + (yadayada ?? '') + last + whoa
}

const ManyAndLastKeys = ['void', 'solo', 'pair', 'many', 'xnil', 'xone', 'xtwo', 'xtra'] as const
type ManyAndLastFrames<VT = any> = (
  | { iam: 'void' }                        // the collection was empty
  | { iam: 'solo', first: VT }             // there was only one entry, stored in `first`
  | { iam: 'pair', first: VT,  last: VT }  // there were exactly two entries, and two is less than the cap
  | { iam: 'many', many: VT[], last: VT }  // there were more than two entries but less than the cap; `last` has the last element, `many` has the others.
  | { iam: 'xnil' }                        // an empty result was requested (but the collection was not empty)
  | { iam: 'xone', first: VT }             // a single result was requested, stored in `first` (but more than one was present)
  | { iam: 'xtwo', first: VT,  last: VT }  // two entries were requested (but more were present)
  | { iam: 'xtra', many: VT[], last: VT }  // there were more than the cap; here are the first many and the last one (total count = max - shave)
  )
export interface ManyAndLastMerged<VT = any> {
  iam: typeof ManyAndLastKeys[number],
  many?:  VT[] | undefined,
  first?: VT   | undefined,
  last?:  VT   | undefined,
}
type manyAndLastResult<VT = any>   = { iam: typeof ManyAndLastKeys[number], many: VT[], first: VT, last: VT }

// takes up to `max` entries from tne collection
export function manyAndLast<VT = any>(clxn: VT[], { max = Infinity, shave = 0 }: { max?: number, shave?: number } = {}): ManyAndLastFrames<VT> {
  const arr: VT[] = _.values(clxn)
  const arrlen: number = arr.length
  if (arrlen <= max) {
    if (! (arrlen > 0)) { return { iam: 'void' } }
    if (arrlen === 1)   { return { iam: 'solo', first: arr[0]! } }
    const last: VT = arr.pop() as VT
    if (arrlen === 2)   { return { iam: 'pair', first: arr[0]!, last } }
    return { iam: 'many', many: arr, last }
  }
  if (! (max >= 1))     { return { iam: 'xnil' } }
  const cap = (shave > 0) ? _.clamp(max - shave, 1, max) : max
  if (cap <= 1)         { return { iam: 'xone', first: arr[0]! } }
  const last = _.last(arr) as VT
  if (cap === 2)        { return { iam: 'xtwo', first: arr[0]!,              last } }
  return                         { iam: 'xtra', many: _.take(arr, cap - 1), last }
}

export interface SomeManyAndLastFrame<VT = any> extends ManyAndLastMerged<VT> {
  /** the shortened list (first, many, and last) with no joiners inserted; if shaved, there might be fewer than `max` */
  some: VT[]
  /** the body (first/many), including the last if no reduction was done */
  body: VT[]
  /** if reduced, an array with the 'extra' element */
  tail: VT[]
  /** the reduced number of elements */
  postsize: number
  /** true if there was a 'last' element to ellipsize */
  ellipsize: boolean
}
export function someManyAndLast<VT = any>(clxn: VT[], opts: { max?: number, shave?: number } = {}): SomeManyAndLastFrame<VT> {
  const result = manyAndLast(clxn, opts)
  const parts  = result as ManyAndLastMerged<VT>
  const body: VT[] = parts.many ? parts.many : parts.first ? [parts.first] : []
  const tail: VT[] = []
  const ellipsize = (parts.iam === 'xtra' || parts.iam === 'xtwo')
  // const some: VT[] = parts.many ?? []
  // if ('first' in parts) { some.unshift(parts.first as VT) }
  // if ('last' in parts)  {  some.push(parts.last  as VT) }
  if ('last' in parts)  {
    if (ellipsize) { tail.push(parts.last as VT) } else { body.push(parts.last as VT) }
  }
  const some = [...body, ...tail]
  const postsize = some.length
  return { ...result, some, body, tail, postsize, ellipsize }
}

export function hardcapList<VT = any>(clxn: VT[], opts: { max?: number, shave?: number, yadayada?: string } = {}): VT[] {
  const copts = { max: 7, shave: 1, yadayada: '…', ...opts }
  const result = manyAndLast(clxn, copts)
  const { iam } = result
  switch (iam) {
  case 'void':    return clxn
  case 'solo':    return clxn
  case 'pair':    return clxn
  case 'xnil':    return [] as VT[]
  case 'xone':    return [result.first]
  case 'many':    return clxn
  case 'xtwo':    return [result.first, copts.yadayada as VT, result.last]
  case 'xtra':    return [...result.many, copts.yadayada as VT, result.last]
  default:        throw throwable('Unreachable state from manyAndLast', 'unknownTag', { result, clxn, ManyAndLastKeys })
  }
}

export interface shortenOpts { tail?: string }

// sugar for calling shorten with the fancy `…` single character rather
// than three '...' dots. Note: `…` will have catastrophic effects on the
// size of an SMS, do not do that.
export function shortenWithEllipsis(str: string, maxlen = 29): string {
  return shorten(str, maxlen, { tail: ELLIPSIS_1GLYPH })
}

export function shorten(str: string, maxlen = 29, opts: shortenOpts = {}): string {
  const { tail = ELLIPSIS_3DOTS } = opts
  if (! str) { return '' }
  if (str.trim().length <= maxlen) { return str.trim() }              // if it's already legal return it
  //
  if (maxlen <= 16 || (! tail)) { return str.slice(0, maxlen).trim() } // Don't get fancy with ellipsis if it's short or no ellipsis is to be used
  //
  const taillen = tail.length
  const breaklen = maxlen - (12 + taillen)
  const most = str.slice(0, breaklen)                // Keep most of it around, and
  let rest = str.slice(breaklen, maxlen - taillen)   // shorten the tail to one longer than maxlen + ellipsis
  if (/\w$/.test(rest)) {                            // if the last character is part of a word,
    rest = rest.replace(/\w+$/, '')                  // chop off the partial word
  }
  rest = rest.replace(/\W+$/, '')                    // and in any case trim non-word characters from the end
  const shorter = `${most}${rest}${tail}`            // finally, attach an ellipsis
  //
  return shorter.trim()
}

// Strip blank/undefined/null strings from the args and string-join them with sep
export function smush(sep: string, ...rest: (string | undefined | null | number)[]): string {
  return scrubVoid(rest).join(sep)
}

export function qt(val: string)    { return `'${val.replaceAll('\'', '\\\'')}'` }
export function dqt(val: string)   { return `"${val.replaceAll('"', '\\"')}"` }
export function qtc(val: string)   { return comma(qt(val)) }
export function comma(val: string) { return val + ',' }

function indentStr(by: number | string = 2) {
  return _.isNumber(by) ? _.repeat(' ', by) : by
}

export function indent(text: string, by: number | string = 2) {
  const  indenting = indentStr(by)
  return _.trim(text)
    .split(/\n/g)
    .map((line) => (indenting + line).replace(/^ +$/, "")) // replace lines of all spaces with empty string; tabs, \v, other whitespace are not touched
    .join("\n")
}
/** remove the leading indent from each line of the text */
export function dedent(text: string, by: number = 2) {
  const  indenting = indentStr(by)
  return text.replace(indenting, '').replaceAll('\n' + indenting, '\n')
}
