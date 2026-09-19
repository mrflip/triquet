import      _                                 /**/ from 'lodash'
import      { DateTime }                           from 'luxon'
import      { ZodIssueCode as ZIC }                from 'zod'
import type {
  ZodIssueOptionalMessage,  ZodParsedType,
  ZodInvalidTypeIssue,      ZodInvalidStringIssue,
  ZodUnrecognizedKeysIssue, ZodInvalidUnionIssue,
  ZodTooSmallIssue,         ZodTooBigIssue,
  ZodIssueCode as ZodIssueCodeT,
}                                                   from 'zod'
//
import type { Story }                               from '../checks/BasicChecks.ts'
import type { ZIssue, Zchecker, ProtoZodIssue, TKZodError, ZodSubIssue } from './ZodInternal.ts'
import      { TS_EARLIEST, TS_FARTHEST }            from '../Consts.ts'
//
import {
  jsonify, type stringifyOpts, adorn, setNormalProp, objectish,  arrayish, inspectify,
  shortenWithEllipsis, type shortenOpts, smush, toSentence, hardcapList, decorate,
}                                                  from '../utils/BaseUtils.ts'

const EmptyTypeDescriptions = {
  undefined: `undefined`,   null:      `null`,           nan:     `not-a-number`, void:      `void`,
  never:     `never`,
} as const
const TypeDescriptions: Record<ZodParsedType, string> = {
  string:    `text`,        number:    `a number`,       integer: `an integer`,   float:     `a decimal`,
  boolean:   `true/false`,  date:      `a date`,         bigint:  `a bigint`,     symbol:    `a jssym`,
  function:  `a function`,  array:     `an array`,       object:  `an object`,    unknown:   `an idk`,
  promise:   `an async`,    map:     `a js Map`,     set:       `a js Set`,
  ...EmptyTypeDescriptions,
} as const

interface ErrorMapIssueContext { data: any, defaultError: string }

export function customErrorMap(issue: ZodIssueOptionalMessage, ctx: ErrorMapIssueContext): { message: string } {
  if (issue.code === ZIC.invalid_union) {
    const message = unionizeIssue(issue, ctx.data, ctx.defaultError, { step: 'unionize', unionized: true, ctx })
    return { message }
  }
  return { message: customMessage(issue, ctx.data, ctx.defaultError, { step: 'ceMap', ctx }) }
}

export interface FormatZMessageOpts {
  checker?: Zchecker, step?: 'repair' | 'unionize' | 'ceMap', ctx?: ErrorMapIssueContext, unionized?: boolean | undefined, story?: Story,
}

export const PRESENCE_REQD = new Set<ZodIssueCodeT>([ZIC.invalid_type, ZIC.too_small])
export const SKIP_VALPART  = new Set<ZodIssueCodeT>([ZIC.unrecognized_keys])

function customMessage(issue: ZodIssueOptionalMessage, subj: any, defaultError: string, opts: FormatZMessageOpts = {}): string {
  const message = makeCustomMessage(issue, subj, defaultError, opts)
  // console.warn(inspectify(subj, { maxlen: 1000 }), defaultError, '\nresult customMessage:\n', message, '\n')
  return message
}
const INSTANCE_OF_RE = /(Input not )?instance of */
const DOUBLE_TROUBLE_RE = / *is a .+/
function disappointedinyou(badprop: any) {
  if (badprop === UNSET_VALUE) { return 'is unset'   }
  if (badprop === undefined)   { return 'is missing' }
  if (badprop === null)        { return 'is nil'     }
  const actualClass  = badprop?.constructor?.name ?? (typeof badprop) ?? '(anon)' // nulls shouldn't get here
  return `is a ${actualClass}`
}
function fixInstanceofMessage(message: string | undefined, _issue: ZodIssueOptionalMessage, badprop: any, defaultError: string, _opts: FormatZMessageOpts = {}): string {
  const bemorelikeyoursister = disappointedinyou(badprop)
  if (! message) { return bemorelikeyoursister + ' (' + defaultError + ')' }
  if (DOUBLE_TROUBLE_RE.test(message)) { return message } // sometimes it loops through twice
  if (INSTANCE_OF_RE.test(message)) {
    return message.replace(INSTANCE_OF_RE, bemorelikeyoursister + ', need a ')
  }
  return bemorelikeyoursister + ', needs ' + message
}

export function makeCustomMessage(issue: ZodIssueOptionalMessage, subj: any, defaultError: string, opts: FormatZMessageOpts = {}) {
  const { code, message } = issue
  const badprop = _.hasIn(opts.ctx, 'data') ? opts.ctx?.data  : getBadprop(issue, subj, opts)
  // console.warn('custom', 'message', message, code, typeof badprop, badprop?.constructor?.name, '\nbad prop\n', inspectify(badprop, { maxlen: 1000 }), inspectify(subj, { maxlen: 1000 }), '\nopts', opts, '\nzod issue\n', issue)
  //
  if (code === ZIC.unrecognized_keys)   { return unrecognizedKeysAdvice(issue, badprop)  }
  if (isVacant(badprop) && (PRESENCE_REQD.has(code))) { return 'is ' + displayVacancy(badprop) }
  if (code === ZIC.invalid_literal)     { return `should be the value ${display(issue.expected)}`  }
  if (code === ZIC.not_multiple_of)     { return `should be an exact multiple of ${display(issue.multipleOf)}` }
  if (code === ZIC.not_finite)          { return `should be finite` }
  if (code === ZIC.invalid_type)        { return invalidTypeAdvice(issue, badprop, defaultError, opts) }
  if (code === ZIC.invalid_union)       { return unionizeIssue(issue, subj, defaultError, opts) }
  if (code === ZIC.invalid_enum_value)  { return (issue.options.length === 1) ? `should be ${display(issue.options.join())}` : `should be one of ${joinChoices(issue.options)}` }
  if (code === ZIC.too_big)             { return smush(' ', boundsAdvice(issue, badprop, issue.maximum), message) }
  if (code === ZIC.too_small)           { return smush(' ', boundsAdvice(issue, badprop, issue.minimum), message) }
  //
  if (code === ZIC.invalid_string)      { return invalidStringAdvice(issue, badprop, defaultError, opts)  }
  if (code === ZIC.custom && issue.params?.msg) { return issue.params.msg }
  //
  if (code === ZIC.custom)              {
    return fixInstanceofMessage(message, issue, badprop, defaultError, opts)
    // if (! message)                    { return defaultError }
    // if (INSTANCE_OF_RE.test(message)) { return fixInstanceofMessage(message, issue, badprop, defaultError, opts) }
    // return message ?? defaultError
  }
  if (code === ZIC.invalid_union_discriminator)   {
    const tags = issue.options.join('/')
    const tagfield = _.last(issue.path)
    console.warn('invalid_union_discriminator', jsonify(issue), subj, opts, badprop, defaultError)
    return `union tag ${tagfield} value '' should be one of ${tags}`
  }
  //
  console.warn('please add this case to ZodReporting.customMessage', jsonify(issue), subj, opts, badprop, defaultError)
  //
  if (code === ZIC.invalid_arguments)   { return defaultError }
  if (code === ZIC.invalid_return_type) { return defaultError }
  if (code === ZIC.invalid_date)        { return defaultError }
  return defaultError
}

function unrecognizedKeysAdvice(issue: ZodUnrecognizedKeysIssue, badprop: any) {
  const badprops   = _.pick(badprop, issue.keys)
  const kvs        = displayKVs(badprops, issue.keys)
  const splayedKVs = (_.size(issue.keys) <= 1) ? kvs : ('{' + kvs + '}')
  return smush('.', issue.path.join('.'), splayedKVs)
}

function invalidTypeAdvice(issue: ZodInvalidTypeIssue, _badprop: any, _defaultError: string, _opts: FormatZMessageOpts = {}) {
  return `is ${TypeDescriptions[issue.received]} but should be ${TypeDescriptions[issue.expected]}`
}

function invalidStringAdvice(issue: ZodInvalidStringIssue, badprop: any, defaultError: string, opts: FormatZMessageOpts = {}): string {
  if (issue.message && (! /^(Invalid|Expected|Required|Expected)/.test(issue.message))) { return issue.message }
  const { validation } = issue
  if (validation === 'regex') { return opts.checker?.hasDescription ? `should be a ${opts.checker?.checkname}` : 'should match pattern' }
  if (_.isString(validation)) { return `should be a ${validation}` }
  if ('includes' in validation) {
    const where = validation.position ? ` at ${validation.position}` : ''
    return `should contain ${display(validation.includes)}${where}`
  }
  if ('startsWith' in validation) { return `should start with ${display(validation.startsWith)}` }
  if ('endsWith'   in validation) { return   `should end with ${display(validation.endsWith)}`   }
  console.warn('unfamiliar invalid_string issue', jsonify(issue), badprop, defaultError)
  return defaultError
}

function segAndSep(seg: string | number, idx: number) {
  if (_.isNumber(seg)) { return `[${seg}]` }
  const dotmaybe = ((idx === 0) ? '' : '.')
  if (/^([A-Za-z]\w*)$/.test(seg)) { return dotmaybe + seg }
  return dotmaybe + inspectify(seg)
}
function dotpathFor(segs: (string | number)[]) {
  return _.map(segs, (seg, idx) => segAndSep(seg, idx)).join('')
}
/* eslint-disable no-param-reassign */
// function unionizeIssue(issue: Z.ZodInvalidUnionIssue, badprop: any, badpropStr: string): { message: IssueDetails } {
function unionizeIssue(issue: ZodInvalidUnionIssue, subj: any, _defaultError: string, opts: FormatZMessageOpts = {}): string {
  const subIssues = _.flatten(_.map(issue.unionErrors, 'issues'))
  adorn(issue, 'unionErrors', issue.unionErrors) // quiet, you
  const dotpath = dotpathFor(issue.path)
  const subMessages = _.uniq(_.map(subIssues, (subIssue) => {
    const badprop = getBadprop(subIssue, subj, opts)
    const subDotpath = subIssue.path.join('.')
    const subPathing = (subDotpath === dotpath || (! subDotpath)) ? '' : subDotpath + ' should '
    const submsg  = customMessage(subIssue, subj, subIssue.message, opts)
    subIssue.message = submsg
    if (subIssue.code === ZIC.invalid_type) { // collapse all should be a X but got a Y into one short message.
      return subPathing + ((isVacant(badprop) ? ('not be ' + displayVacancy(badprop)) : ('be ' + TypeDescriptions[subIssue.expected])))
    }
    return subPathing + submsg
  }))
  if (subMessages.length === 1) { return 'should ' + subMessages.join() }
  const msg = joinUnionedMessages(subMessages)
  return 'should either ' + msg
}
/* eslint-enable no-param-reassign */

function boundsAdvice(issue: ZodTooBigIssue | ZodTooSmallIssue, badprop: any, expected: any): string {
  const { code } = issue
  if (issue.message && (badprop !== undefined)) { return '' }  // message will be appended
  if (issue.type === 'date') {
    const expectedStr = displayDate(expected)
    const direction = (issue.code === ZIC.too_small) ? 'after' : 'before'
    return (issue.inclusive) ? `should be on or ${direction} ${expectedStr}` : `should be strictly ${direction} ${expectedStr}`
  }
  const expectedStr = display(expected)
  if (issue.type === 'set' || issue.type === 'array') {
    // `have no items` / `have one item` / `have 4 items` / `have at most one item` / `have at least one item`
    if (issue.exact)  {
      if (expected === 0) { return 'should be empty' }
      return `has ${display(_.size(badprop))} items but should have exactly ` + nItems(expected)
    }
    if (code === ZIC.too_big) {
      if (expected === 0) { return 'should be empty' }
      return `has ${display(_.size(badprop))} but should have ${nItems(expected)} or fewer`
    }
    // too small
    if (expected <= 1) { return 'should not be empty' }
    return `has ${display(_.size(badprop))} items but should have ${display(expected)} or more`
  }
  if (issue.type === 'string') {
    if (issue.exact)  {
      if (expected === 0) { return 'should be empty' }
      if (expected === 1) { return 'should have exactly one character' }
      return `has length ${display(_.size(badprop))} vs ${display(expected)} needed`
    }
    if (code === ZIC.too_big) {
      if (expected === 0) { return 'be empty' }
      return `is too long: ${display(_.size(badprop))} vs ${display(expected)} available`
    }
    if (_.isEmpty(badprop) || (expected <= 1)) { return 'should not be empty' }
    return `is too short: ${display(_.size(badprop))} vs ${display(expected)}`
  }
  if (issue.exact) { return `be ${expectedStr}` }
  if (expected === Number.MAX_SAFE_INTEGER || expected === Number.MIN_SAFE_INTEGER) { return 'should not be unusually large' }
  const direction = (issue.code === ZIC.too_small) ? 'more' : 'less'
  return (issue.inclusive) ? `should be ${expectedStr} or ${direction}` : `should be strictly ${direction} than ${expectedStr}`
}
function nItems(expected: any): string {
  if (expected === 0) { return 'no items' } if (expected === 1) { return 'one' } return `${display(expected)}`
}

const UNSET_VALUE = Symbol('UNSET_VALUE')

export function getBadprop(issue: ZodIssueOptionalMessage, subj: any, opts: FormatZMessageOpts = {}): any {
  if (opts.step === 'ceMap') { return subj }
  const { code, path } = issue
  if (code === ZIC.unrecognized_keys) {
    const within = _.isEmpty(path) ? subj : _.get(subj, path)
    return _.pick(within, issue.keys)
  }
  if (_.isEmpty(path)) { return subj }
  if ((! objectish(subj)) && (! arrayish(subj))) { return subj }
  const { received } = issue as any
  if (received && (code !== ZIC.invalid_type)) { return received }
  if (! _.hasIn(subj, path)) {
    // see if it's a default value
    const fieldChecker = _.get((opts.checker as any)?.shape, path)
    if (_.isFunction(fieldChecker?._def?.defaultValue)) {
      try { return fieldChecker._def.defaultValue(opts) } catch (err) { /** noop */ }
      return '(bad default)'
    }
    if (fieldChecker?._def?.typeName === 'ZodDefault') {
      return fieldChecker._def.defaultValue
    }
    // if we can only find undefined, but it's an invalid type that isn't undefined, return the typename, better than nothing
    if (received && (code === ZIC.invalid_type) && (received !== 'undefined')) { return received }
    // Give up. Using UNSET_VALUE shows that we investigated and found nothing, vs somehow skipped this step
    return UNSET_VALUE
  }
  return _.get(subj, path)
}

interface DisplayOpts extends stringifyOpts, shortenOpts { len?: number, brace?: boolean }
export function display(val: any, opts: DisplayOpts = {}): string {
  const { len = 180, brace = true } = opts
  const core = shortenWithEllipsis(inspectify(val, { ...opts, maxlen: len + 10 }), len).replaceAll(/\\/g, '~^')
  return brace ? frenchbrace(core) : core
}
export function frenchbrace(str: string): string {
  return `«${str}»`
}
function joinMessages(subMessages: string[]): string {
  return toSentence(subMessages, { joiner: '; ', yadayada: ', …' })
}
function joinUnionedMessages(subMessages: string[]): string {
  return toSentence(subMessages, { joiner: '; ',  yadayada: ', …', conj: 'or' }).replaceAll(/((should )+(either )?(be +)?)/g, '') // .replaceAll(/(should *)+( *(either))* /g, 'should ')
}
function joinBadprops(badprops: string[]): string {
  return toSentence(badprops, { joiner: '; ', yadayada: ', …' })
}
function joinChoices(choices: any[]): string {
  return toSentence(choices, { conj: 'or', max: 3, yadayada: '…', joiner: ',' })
}
function displayKVs(obj: any, keys: readonly string[], opts = {}): string {
  const kvs = _.map(keys, (key) => [key, _.get(obj, key)])
  const displayed = _.map(kvs, ([key, val]) => (String(key) + '=' + display(val, opts)))
  return toSentence(displayed, { yadayada: ', …' })
}

function displayVacancy(val: any): "missing" | "blank" | "nil" | "an invalid number" | "unset" | "empty" {
  if (val === undefined)   { return 'missing' }
  if (val === '')          { return 'blank'   }
  if (val === null)        { return 'nil'  }
  if (_.isNaN(val))        { return 'an invalid number' }
  if (val === UNSET_VALUE) { return 'unset' }
  return 'empty'
}
export function isVacant(badprop: any) {
  return (badprop === '') || _.isUndefined(badprop) || _.isNull(badprop) || _.isNaN(badprop) || (badprop === UNSET_VALUE)
}

function displayDate(timestamp: number): string {
  try {
    const millis = timestamp?.valueOf?.()
    if (_.isFinite(millis) && (millis >= TS_EARLIEST) && (millis <= TS_FARTHEST)) { // we don't tolerate small timestamps
      return display(DateTime.fromMillis(millis).toISO(), { naked: true })
    }
    return '(~BOGUS DATE ' + display(timestamp) + '~)'
  } catch (err2) { console.error('error while handling error'); return String(timestamp) }
}

/* eslint-disable no-param-reassign */
export function repairError<RT, ZE extends TKZodError<RT>>(err: ZE, subj: any, checker: Zchecker, story: Story = {}): ZE {
  // console.warn('repairError', err, subj, checker, story)
  //
  repairIssues(err.issues as ProtoZodIssue[], subj, checker, story) // all issues now have { message: { msg, badprop, val } }
  const [rawUnknownKeyIssues, mostIssues] = _.partition(err.issues, ({ code }) => (code === ZIC.unrecognized_keys))
  //
  const rawPathed = _.groupBy(mostIssues, ({ path }) => (_.isEmpty(path) ? 'it' : dotpathFor(path)))
  const pathed = _.mapValues(rawPathed, (issues) => assemblePathedIssue(issues[0]?.path ?? [], issues as ZodSubIssue[], err))
  //
  const _unknown = assembleUnknownKeyIssue(rawUnknownKeyIssues as any[])
  if (_unknown) { (pathed as any)._unknown = _unknown }
  //
  const message = _.map(pathed, ({ message:msg, path, propmsg }) => (
    `${dotpathFor(path)} ${smush(' ', propmsg, msg)}`.trim()
  )).join(';; ')
  //
  setNormalProp(err, 'message', smush(' issues: ', checker.description, message))
  //
  err.messages   = _.mapValues(pathed, 'message')
  err.badprops   = _.mapValues(pathed, 'badprop') as Partial<RT>
  err.success    = false
  err.ok         = false
  err.extensions = { ...err.extensions, ...story, subj, badprops: err.badprops, messages: err.messages }
  decorate(err,            { checker, issues: err.issues, addIssue: err.addIssue, addIssues: err.addIssues, errors: undefined })
  decorate(err.extensions, { pathed, checker, issues: err.issues, ok: false })
  return err
}

function badpropTree(issues: readonly ZodSubIssue[]) {
  const subtrees = _.map(issues, ({ path, badprop }) => (_.isEmpty(path) ? badprop : { [dotpathFor(path)]: badprop }))
  return _.merge({}, ...subtrees)
}

function assembleUnknownKeyIssue(ekIssues: readonly (ZodSubIssue & ZodUnrecognizedKeysIssue)[]): ZodSubIssue & ZodUnrecognizedKeysIssue | null {
  if (_.isEmpty(ekIssues)) { return null }
  if (ekIssues.length === 1 && ekIssues[0]?.keys?.length === 1) { return { ...ekIssues[0], message: `unknown property ${ekIssues[0].message}` } }
  const dotkeys = _.flatMap(ekIssues, ({ keys, path }) => (_.map(keys, (key) => [...path, key].join('.'))))
  const badprop = badpropTree(ekIssues)
  const badpropStr = joinBadprops(_.map(ekIssues, 'message'))
  const issue: ZodSubIssue & ZodUnrecognizedKeysIssue = {
    keys: dotkeys, path: [], code: ZIC.unrecognized_keys, message: 'unknown properties ' + badpropStr, badprop, badpropStr,
  }
  return issue
}

export function assemblePathedIssue(path: (string | number)[], issues: ZodSubIssue[], _subj: any): ZIssue {
  // if the item is missing, report that simply and move on -- I don't need to know that an empty string flunked a regex
  const shegone = _.find(issues, ({ code, badprop }) => (PRESENCE_REQD.has(code) && isVacant(badprop))) as any
  if (shegone) {
    const  { badprop, message, badpropStr } = shegone
    return { badprop, badpropStr, propmsg: badpropStr, message, path, issues: [shegone], code: shegone.code }
  }
  //
  const exemplar = issues[0]!
  const { badprop, message, badpropStr } = exemplar
  const code = exemplar.code as any
  //
  // if there is only one issue, the path - badpropStr - message dance is easy
  if (issues.length === 1) {
    const propmsg = SKIP_VALPART.has(code) ? '' : badpropStr
    // const subIssue: ZodSubIssue = { ...exemplar, message, code }
    return { propmsg, message, badprop, badpropStr, path, issues: [exemplar], code }
  }
  // with many issues, roll them up under one path - badpropStr
  const assembledMessage = joinMessages(_.map(issues, 'message'))
  return {
    code, path, propmsg: badpropStr, badprop, badpropStr, issues, message: assembledMessage,
  }
}


// When a custom message is provided, the customErrordMap may not be called,
// so we have to try to infer the value and fix the message.
export function repairIssues(issues: ProtoZodIssue[], subj: any, checker: Zchecker, story: Story) { /* eslint-disable no-param-reassign */
  // const issues = _.map(this.issues, (issue) => forceProtoIssue(issue, subj))
  _.each(issues as any, (issue: ZIssue) => {
    const opts: FormatZMessageOpts = { checker, step: 'repair', story }
    if ('unionErrors' in issue) { adorn(issue, 'unionErrors', issue.unionErrors) }
    const badprop    = getBadprop(issue, subj, opts)
    issue.badprop    = (badprop === UNSET_VALUE) ? undefined  : badprop
    issue.badpropStr = (badprop === UNSET_VALUE) ? (issue.code === 'custom' ? '(unset)' : '') : display(badprop)
    issue.message    = customMessage(issue, subj, issue.message, opts)
    if (issue.code === ZIC.invalid_enum_value && _.isArray(issue.options)) {
      issue.options = hardcapList(issue.options, { max: 5 }) // up to five options, or first three, '…', and last one
    }
  })
} /* eslint-enable no-param-reassign */

// function _repairError<RT, ZE extends TKZodError<RT>>(this: ZE, subj: any, checker: Zchecker, story: Story = {}): ZE {
//   return repairError(this, subj, checker, story)
// }
// (ZLib.ZodError as any).prototype._repair = _repairError
// ZLib.setErrorMap(customErrorMap as any)
