import type * as Z from 'zod'
import { Validator } from '../lib/validator'
import * as UU from '../lib/useful'

/** Any JSON value: what a widgeted's `value` may be */
export type JsonT = Z.core.util.JSONType

/** The three states of a widgeted, and the only ones */
export const WidgetedStatusVals = ['ok', 'errored', 'missing'] as const
export type WidgetedStatus = typeof WidgetedStatusVals[number]

export const WidgetedValidators = Validator(({ obj, lit, str, zod, timestamp, discrim }) => {
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

  return { err, widgeted }
})

/** A failure on a widgeted: on `errored` the failure itself, on `ok` a newer one riding along */
export type WidgetedErrT = Z.output<typeof WidgetedValidators.err>

/** What one widgeting came to for one question, as everyone reads it: cells, sorts, the sheet, the exports and the bag */
export type WidgetedT = Z.output<typeof WidgetedValidators.widgeted>

/** One stored widgeted as the runner reads it: a row's fields, before they are projected */
export type StoredWidgetedT = {
  status:        'ok' | 'errored'
  value:         JsonT | null
  message:       string | null
  /** A free bag of how it ran; on a failure, `response` is the failure as it came back */
  result_meta:   Record<string, JsonT>
  /** When it was recorded, in epoch milliseconds (with a fraction) */
  _creationTime: number
}

/** What one widgeted is to be recorded as: a stored widgeted, before the database stamps it */
export type WidgetedRecordT = Omit<StoredWidgetedT, '_creationTime'>

/** One cell's stored history, as far as its widgeted needs it: the newest row, and the newest `ok` one */
export type WidgetedHistoryT = {
  newest: StoredWidgetedT
  /** The newest `ok` row: `newest` itself when it is one, null when no row ever was */
  ok:     StoredWidgetedT | null
}

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
   * A widgeted's value as text, as a cell, a sheet or a table holds it: a scalar as itself, any
   * other value as its JSON, and nothing for a widgeted that is not `ok`.
   *
   * @param widgeted - What one cell came to.
   * @returns The text; empty when there is no value.
   *
   * @example Widgeted.textOf(Widgeted.ok(42))            // => '42'
   * @example Widgeted.textOf(Widgeted.ok({ b: 1, a: 2 }))  // => '{"a":2,"b":1}'
   * @example Widgeted.textOf(Widgeted.missing)           // => ''
   */
  static textOf(widgeted: WidgetedT): string {
    if (widgeted.status !== 'ok') { return '' }
    const { value } = widgeted
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') { return String(value) }
    return UU.jsonify(value)
  }
}
