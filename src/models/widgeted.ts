import type * as Z from 'zod'
import { Validator } from '../lib/validator'
import * as UU from '../lib/useful'
import * as PA from '../lib/vv/patterns'

/** Any JSON value: what a widgeted's `value` may be */
export type JsonT = Z.core.util.JSONType

/** The three states of a widgeted, and the only ones */
export const WidgetedStatusVals = ['ok', 'errored', 'missing'] as const
export type WidgetedStatus = typeof WidgetedStatusVals[number]

/** The two a stored widgeted can be in: `missing` is never stored, it is the absence of a row */
export const StoredStatusVals = ['ok', 'errored'] as const
export type StoredStatus = typeof StoredStatusVals[number]

/** Whether `val`'s JSON text fits within `bound` */
function fitsIn(val: unknown, bound: { max: number }): boolean {
  return UU.jsonify(val).length <= bound.max
}

/** Whatever a stored widgeted carries that its status does not allow: a message on `ok`, a value on `errored`, or an `errored` one that does not say why */
function storedIssues(stored: { status: StoredStatus, value: unknown, message: string | null }): { input: unknown, path: string[], message: string }[] {
  return [
    ...(stored.status === 'ok' && stored.message !== null ? [{ input: stored.message, path: ['message'], message: 'An `ok` widgeted carries no failure message' }] : []),
    ...(stored.status === 'errored' && stored.value !== null ? [{ input: stored.value, path: ['value'], message: 'An `errored` widgeted carries no value' }] : []),
    ...(stored.status === 'errored' && stored.message === null ? [{ input: stored.message, path: ['message'], message: 'An `errored` widgeted says why' }] : []),
  ]
}

export const WidgetedValidators = Validator(({ obj, lit, str, num, zod, rec, oneof, union, label, noteish, timestamp, discrim, zid }) => {
  const err = obj({
    message:  str
      .describe('Why it failed, in the author\'s words.'),
    at:       timestamp.nullable()
      .describe('When the failure was recorded; null for a failure worked out just now, on render.'),
    response: zod.json().nullable()
      .describe('The failure as it came back, for the author to read; null when there is nothing more to show.'),
  })
    .describe('A failure on a widgeted.')

  const widgeted = discrim('status', [
    obj({ status: lit('ok'),      value: zod.json(), err: err.nullable() })
      .describe('A value; `err` is a newer failure riding along on it, which never replaces it.'),
    obj({ status: lit('errored'), value: lit(null),  err })
      .describe('Only a failure: there has never been a value.'),
    obj({ status: lit('missing'), value: lit(null),  err: lit(null) })
      .describe('Nothing: never asked, or an input or formula that came to nothing. Not zero.'),
  ])
    .describe('What one widgeting came to for one question: `ok` with a `value`, `errored` with only a failure, or `missing`. Read `value` only when `status` is `ok`.')

  const status = oneof(StoredStatusVals)
    .describe('What was stored: `ok` with a value, or `errored` with only a failure. `missing` is never stored.')
  const value = zod.json().nullable()
    .refine((val) => fitsIn(val, PA.WidgetedJson), PA.WidgetedJson.msg)
    .describe('What it came to: any JSON, untyped; null when `errored`.')
  const message = noteish.nullable()
    .describe('Why it errored, in the author\'s words; null when `ok`.')
  const result_meta = rec(str, zod.json())
    .refine((val) => fitsIn(val, PA.WidgetedJson), PA.WidgetedJson.msg)
    .describe('A free bag of how it ran: the tier applied, the approximate tokens, whether it was cut short, and on a failure the raw `response`. Nothing reads it but the views that show it.')

  const storedFields = { status, value, message, result_meta }

  const row = obj({
    question_id:  zid('questions')
      .describe('The question it is for.'),
    widgeting_id: zid('widgetings')
      .describe('The widgeting it is what of: keyed by widgeting, not widget, since one widget can be worked twice in a quiz.'),
    ...storedFields,
  })
    .check((context) => { for (const issue of storedIssues(context.value)) { context.issues.push({ code: 'custom', ...issue }) } })
    .describe('What one widgeting came to for one question, as the database holds it. When it was recorded is the row\'s own `_creationTime`. Only a formulary that stores keeps one: `aibot` appends, history kept; `entry` upserts, one row a cell.')

  const record = obj({
    question_id:     zid('questions')
      .describe('The question it is for, by its row id.'),
    widgeting_label: label
      .describe('The widgeting of the open quiz it is for, by its label.'),
    status,
    value:           value.default(null),
    message:         message.default(null),
    result_meta:     result_meta.default({}),
  })
    .check((context) => { for (const issue of storedIssues(context.value)) { context.issues.push({ code: 'custom', ...issue }) } })
    .describe('One widgeted as a browser sends it to be recorded: the question by id, the widgeting by label, and what it came to.')

  const enteredValue = union([str.max(PA.Textish.max), num]).nullable()
    .describe('What was typed into an entry cell: text or a number, held to the widget\'s entry kind once it is known; null for a cell emptied.')
  const entered = obj({
    question_id:     zid('questions')
      .describe('The question it is for, by its row id.'),
    widgeting_label: label
      .describe('The entry widgeting of the open quiz it is for, by its label.'),
    value:           enteredValue,
  })
    .describe('One entry cell as a browser sends it, committed on blur: the question by id, the widgeting by label, and the one value it now holds.')

  const stored = obj({ ...storedFields, _creationTime: num.nonnegative() })
    .describe('One stored widgeted as the runner reads it: a row\'s own fields, and when it was recorded, in epoch milliseconds with a fraction.')
  const history = obj({
    newest: stored,
    ok:     stored.nullable()
      .describe('The newest `ok` row: `newest` itself when it is one, null when no row ever was.'),
  })
    .describe('One cell\'s stored history, as far as its widgeted needs it: the newest row, and the newest `ok` one.')

  return { err, widgeted, row, record, enteredValue, entered, stored, history }
})

/** A failure on a widgeted: on `errored` the failure itself, on `ok` a newer one riding along */
export type WidgetedErrT = Z.output<typeof WidgetedValidators.err>

/** What one widgeting came to for one question, as everyone reads it: cells, sorts, the sheet, the exports and the bag */
export type WidgetedT = Z.output<typeof WidgetedValidators.widgeted>

/** One stored widgeted as the runner reads it: a row's fields, before they are projected */
export type StoredWidgetedT = Z.output<typeof WidgetedValidators.stored>

/** What one widgeted is to be recorded as: a stored widgeted, before the database stamps it */
export type WidgetedRecordT = Omit<StoredWidgetedT, '_creationTime'>

/** One cell's stored history, as far as its widgeted needs it: the newest row, and the newest `ok` one */
export type WidgetedHistoryT = Z.output<typeof WidgetedValidators.history>

/** One widgeted as the database holds it */
export type WidgetedRowT = Z.output<typeof WidgetedValidators.row>

/** One widgeted as a browser sends it to be recorded: the question by id, the widgeting by label */
export type WidgetedRecordingDNA = Z.input<typeof WidgetedValidators.record>
/** One widgeted as a browser sends it to be recorded, validated */
export type WidgetedRecordingT   = Z.output<typeof WidgetedValidators.record>

/** One entry cell as a browser sends it: the question by id, the widgeting by label, and what was typed */
export type WidgetedEnteringDNA  = Z.input<typeof WidgetedValidators.entered>
/** One entry cell as a browser sends it, validated */
export type WidgetedEnteringT    = Z.output<typeof WidgetedValidators.entered>

/** What one widgeting came to for one question: a value, a failure, or nothing */
// A class of statics, as a model is, with no instance fields to declare: a widgeted is a union.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class Widgeted {
  /** A cell with nothing in it */
  static readonly missing: WidgetedT = { status: 'missing', value: null, err: null }

  /**
   * A widgeted holding `value`.
   *
   * @param value - Any JSON.
   * @param err - A newer failure riding along on it, if there is one.
   *
   * @example Widgeted.ok(42)  // => { status: 'ok', value: 42, err: null }
   */
  static ok(value: JsonT, err: WidgetedErrT | null = null): WidgetedT {
    return { status: 'ok', value, err }
  }

  /**
   * A widgeted holding only a failure.
   *
   * @param err - The failure.
   *
   * @example Widgeted.errored({ message: 'No.', at: null, response: null }).status  // => 'errored'
   */
  static errored(err: WidgetedErrT): WidgetedT {
    return { status: 'errored', value: null, err }
  }

  /**
   * Whether a widgeted has nothing to show: it is not `ok`, or its value is null or empty text.
   * Nothing shows as the muted dash, is written as an empty cell, and sinks in a sort; an `ok`
   * of null keeps its status, and the JSON export keeps the null.
   *
   * @example Widgeted.isNothing(Widgeted.ok(null))  // => true
   * @example Widgeted.isNothing(Widgeted.ok(0))     // => false
   */
  static isNothing(widgeted: WidgetedT): boolean {
    return widgeted.status !== 'ok' || widgeted.value === null || widgeted.value === ''
  }

  /**
   * Whether a widgeted's value is a list or an object: what a cell shows folded, as JSON.
   *
   * @example Widgeted.isStructured(Widgeted.ok({ items: [] }))  // => true
   * @example Widgeted.isStructured(Widgeted.ok('Leon'))        // => false
   */
  static isStructured(widgeted: WidgetedT): boolean {
    return widgeted.status === 'ok' && typeof widgeted.value === 'object' && widgeted.value !== null
  }

  /**
   * A widgeted's value as text, as a cell, a sheet or a table holds it: a scalar as itself, a
   * list or an object as its JSON, and nothing for null or for a widgeted that is not `ok`.
   *
   * @param widgeted - What one cell came to.
   * @returns The text; empty when there is no value.
   *
   * @example Widgeted.textOf(Widgeted.ok(42))            // => '42'
   * @example Widgeted.textOf(Widgeted.ok({ b: 1, a: 2 }))  // => '{"a":2,"b":1}'
   * @example Widgeted.textOf(Widgeted.ok(null))          // => ''
   * @example Widgeted.textOf(Widgeted.missing)           // => ''
   */
  static textOf(widgeted: WidgetedT): string {
    if (widgeted.status !== 'ok' || widgeted.value === null) { return '' }
    const { value } = widgeted
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') { return String(value) }
    return UU.jsonify(value)
  }
}
