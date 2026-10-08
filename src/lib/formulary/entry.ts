import type * as Z from 'zod'
import _ from 'es-toolkit/compat'
import * as Labelmaker from '../labelmaker'
import * as Regexes from '../regexes'
import { ValidatorKit } from '../validator'
import * as PA from '../vv/patterns'
import { EstimateValidators } from '../../models/estimate'
import { EntryFamilyOf, EntryParamsOf, EntryPresets, WidgetValidators, entryParamsIssues, type EntryParamsFor, type EntryValueT, type EntryWidgetT, type TextParamsT, type TextPattern } from '../../models/widget'
import type { WidgetingT } from '../../models/widgeting'
import type { InputOutcome } from './formularies'

const { str, num, bool, oneof, noteish } = ValidatorKit

/** An entry widget, as far as its cells hang on it: its kind and its default params */
type EntryWidgetish = Pick<EntryWidgetT, 'config'>

/** A widgeting of an entry, as far as its cells hang on it: its own params */
type EntryWidgetingish = Pick<WidgetingT, 'params'>

/**
 * What one of an entry's cells is: its family, and the params in force for it, the widget's
 * defaults overlaid by the widgeting's own. What a cell editor is drawn from, and what it may hold.
 */
export type EntryInForceT = { [FT in keyof EntryParamsFor]: { family: FT, params: EntryParamsFor[FT] } }[keyof EntryParamsFor]

/** The pattern each named pattern of a `text` entry holds its cells to */
const TextPatterns: Readonly<Record<TextPattern, PA.Patternbag & { re: RegExp, msg: string }>> = {
  label:   PA.Label,
  oneline: PA.Stringish,
  url:     PA.Weburl,
}

/**
 * The formulary of a value a person types: no formula, no input, never worked out and never
 * asked. Its cell is a field editor that commits on blur, and what it commits is upserted as the
 * cell's one row (`enter_widgeted`); an emptied cell holds no row, and reads as `missing`.
 *
 * What a cell may hold hangs on the widget's `entry_kind`, its **family**, which is fixed once the
 * widget is made; and on the params in force, which the widget defaults and each widgeting may
 * overlay, since a constraint only bites on the next edit.
 */
// A class of statics with no instances, as every formulary is.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class EntryFormulary {
  static readonly kind = 'entry'
  /** It reads nothing */
  static readonly defaultInput = null
  /** Typed, so neither worked out nor asked */
  static readonly refresh = null
  static readonly store = 'upsert'
  /** Its widgeting folds to its family's params: what its cells may hold */
  static readonly folded = 'params'
  static readonly config = WidgetValidators.entryConfig

  /**
   * Whether the widget is well-formed: always, since it has no formula to get wrong.
   *
   * @example EntryFormulary.check(notesEntry)  // => null
   */
  static check(): string | null {
    return null
  }

  /**
   * What the widget reads: nothing, ever, so there is never anything to run.
   *
   * @example EntryFormulary.input()  // => { status: 'missing' }
   */
  static input(): InputOutcome {
    return { status: 'missing' }
  }

  /**
   * The validator of a widgeting's params, given the entry widget it works: its family's, each
   * param optional, none it does not know; and the params taken together with the widget's
   * defaults beneath them, so a least above a most is refused whichever of the two said it.
   *
   * @param widget - The entry widget, whose kind names its family and whose config holds its defaults.
   * @returns The validator; its shape has one key per param, which a params editor draws a field for.
   *
   * @example EntryFormulary.paramsOf({ config: { entry_kind: 'number', min: 1 } }).safeParse({ max: 0 }).success  // => false
   * @example EntryFormulary.paramsOf({ config: { entry_kind: 'boolean' } }).safeParse({ min: 1 }).success          // => false
   */
  static paramsOf(widget: EntryWidgetish): Z.ZodObject {
    const { entry_kind } = widget.config
    const defaults = defaultsOf(widget)
    return EntryParamsOf[entry_kind].check((context) => {
      const issues = entryParamsIssues(entry_kind, { ...defaults, ...context.value })
      for (const issue of issues) { context.issues.push({ code: 'custom', ...issue }) }
    })
  }

  /**
   * One of the entry's cells: its family, and the params in force, a preset of `text` beneath the
   * widget's defaults, beneath the widgeting's own. A widgeting written before params were held to
   * its family is read as saying nothing of its own.
   *
   * @param widget - The entry widget.
   * @param widgeting - The widgeting working it, whose params overlay the widget's.
   * @returns The family, and its params in force.
   *
   * @example EntryFormulary.inForce({ config: { entry_kind: 'number', min: 1, max: 10 } }, { params: { max: 5 } })  // => { family: 'number', params: { min: 1, max: 5 } }
   * @example EntryFormulary.inForce({ config: { entry_kind: 'labelish' } }, { params: {} })                       // => { family: 'text', params: { pattern: 'label', lines: 'one' } }
   */
  static inForce(widget: EntryWidgetish, widgeting: EntryWidgetingish): EntryInForceT {
    const { entry_kind } = widget.config
    const own = EntryParamsOf[entry_kind].safeParse(widgeting.params)
    const params = { ...EntryPresets[entry_kind], ...defaultsOf(widget), ...(own.success && own.data) }
    // The params are each family's own, by the validator its kind names.
    return { family: EntryFamilyOf[entry_kind], params } as EntryInForceT
  }

  /**
   * The validator of what one of the entry's cells may hold, by its family and the params in
   * force: prose of a length, a pattern and a number of lines; a number between bounds, whole or
   * not; a yes or no; one of the options; or a question's category estimates. Each refusal is a
   * sentence of its own.
   *
   * @param widget - The entry widget.
   * @param widgeting - The widgeting working it.
   * @returns The validator.
   *
   * @example EntryFormulary.valueOf({ config: { entry_kind: 'labelish' } }, { params: {} }).parse('quiet_otter')  // => 'quiet_otter'
   * @example EntryFormulary.valueOf({ config: { entry_kind: 'number' } }, { params: { max: 10 } }).safeParse(11).success  // => false
   */
  static valueOf(widget: EntryWidgetish, widgeting: EntryWidgetingish): Z.ZodType<EntryValueT> {
    const cell = this.inForce(widget, widgeting)
    switch (cell.family) {
    case 'text':      { return textValueOf(cell.params) }
    case 'number':    { return numberValueOf(cell.params) }
    case 'boolean':   { return bool }
    case 'enum':      { return enumValueOf(cell.params.options ?? []) }
    case 'estimates': { return EstimateValidators.estimates }
    }
  }

  /**
   * The validator of what one of the entry's cells may hold by its kind alone, whatever params are
   * in force: what an import holds a pasted value to, since an export is a promise, and a
   * constraint bites only on the next edit of a cell. Any option of an `enum`'s shape will do.
   *
   * @param widget - The entry widget.
   * @returns The validator.
   *
   * @example EntryFormulary.kindValueOf({ config: { entry_kind: 'number', max: 10 } }).safeParse(11).success  // => true
   * @example EntryFormulary.kindValueOf({ config: { entry_kind: 'labelish' } }).safeParse('Quiet Otter').success  // => false
   */
  static kindValueOf(widget: EntryWidgetish): Z.ZodType<EntryValueT> {
    const { entry_kind } = widget.config
    switch (EntryFamilyOf[entry_kind]) {
    case 'text':      { return textValueOf(EntryPresets[entry_kind] ?? {}) }
    case 'number':    { return num }
    case 'boolean':   { return bool }
    case 'enum':      { return WidgetValidators.enumOption }
    case 'estimates': { return EstimateValidators.estimates }
    }
  }

  /**
   * The most characters a `text` entry's cell takes: what its params say, or failing that what its
   * pattern allows, or prose's.
   *
   * @example EntryFormulary.lengthMaxOf({ pattern: 'label' })                  // => 40
   * @example EntryFormulary.lengthMaxOf({ pattern: 'label', max_length: 12 })  // => 12
   * @example EntryFormulary.lengthMaxOf({})                                    // => 3600
   */
  static lengthMaxOf(params: TextParamsT): number {
    const pattern = params.pattern === undefined ? null : TextPatterns[params.pattern]
    return Math.min(params.max_length ?? PA.Textish.max, pattern?.max ?? PA.Textish.max)
  }

  /**
   * How a one-line `text` entry's box tidies what was typed as it is left: into a label, for one
   * held to the label pattern; trimmed, for any other.
   *
   * @example EntryFormulary.tidyFor({ pattern: 'label' })('Quiet Otter!')  // => 'quiet_otter'
   * @example EntryFormulary.tidyFor({ pattern: 'url' })(' https://a.b ')    // => 'https://a.b'
   */
  static tidyFor(params: TextParamsT): (typed: string) => string {
    return params.pattern === 'label' ? (typed) => Labelmaker.normalize(typed) : (typed) => typed.trim()
  }

  /**
   * Whether a `text` entry's cell takes one line: when it says so, or a pattern holds it to one.
   *
   * @example EntryFormulary.isOneLine({ pattern: 'url' })  // => true
   * @example EntryFormulary.isOneLine({})                  // => false
   */
  static isOneLine(params: TextParamsT): boolean {
    return params.lines === 'one' || params.pattern !== undefined
  }

  /**
   * How a `number` entry's box takes what is typed: signed unless its least is nought or more,
   * fractional unless it is whole. A box holding a number its params now refuse takes it as it
   * stands, since the box would otherwise show it cut down (`-4` as `4`, `2.5` as `2`), and a
   * constraint bites only on the next edit, where the value typed is refused with a sentence.
   *
   * @param params - The params in force.
   * @param held - What the cell holds now, or null for nothing.
   * @returns Whether the box takes a minus sign, and a fraction.
   *
   * @example EntryFormulary.numberBoxOf({ min: 0, integer: true }, 3)     // => { signed: false, fractional: false }
   * @example EntryFormulary.numberBoxOf({ min: 0, integer: true }, -2.5)  // => { signed: true, fractional: true }
   */
  static numberBoxOf(params: EntryParamsFor['number'], held: number | null): { signed: boolean, fractional: boolean } {
    return {
      signed:     params.min === undefined || params.min < 0 || (held !== null && held < 0),
      fractional: params.integer !== true || (held !== null && ! Number.isSafeInteger(held)),
    }
  }
}

/** The params a widget gives its widgetings to start from: its config, without its kind */
function defaultsOf(widget: EntryWidgetish): Record<string, unknown> {
  return _.omit(widget.config, ['entry_kind'])
}

/**
 * What a `text` entry's cell may hold: trimmed prose, never empty, held to its params: its length,
 * its named pattern, and its own regular expression, which was checked for safety where it was
 * written (`Redos`) and is trusted here.
 */
function textValueOf(params: TextParamsT): Z.ZodType<string> {
  const pattern = params.pattern === undefined ? null : TextPatterns[params.pattern]
  const oneLine = EntryFormulary.isOneLine(params) ? noteish.regex(PA.Stringish.re, PA.Stringish.msg) : noteish
  const bounded = oneLine.min(pattern?.min ?? 1).max(EntryFormulary.lengthMaxOf(params))
  const named = pattern === null ? bounded : bounded.regex(pattern.re, pattern.msg)
  return params.regex === undefined ? named : named.regex(Regexes.compiled(params.regex), `should match «${Regexes.shown(params.regex)}»`)
}

/** What a `number` entry's cell may hold: a number within its bounds, whole when it says so */
function numberValueOf(params: EntryParamsFor['number']): Z.ZodType<number> {
  const atLeast = params.min === undefined ? num : num.min(params.min)
  const ranged = params.max === undefined ? atLeast : atLeast.max(params.max)
  return params.integer === true ? ranged.int() : ranged
}

/** What an `enum` entry's cell may hold: one of its options, or nothing at all while it has none */
function enumValueOf(options: readonly string[]): Z.ZodType<string> {
  const [first, ...rest] = options
  if (first === undefined) { return str.refine(() => false, 'has no options to be one of: give the widgeting some') }
  return oneof([first, ...rest])
}
