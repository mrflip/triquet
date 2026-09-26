import { schema as JZS } from 'jazz-tools'
import * as UU from '../lib/useful'

/** A nullable string column whose rows read and write a structured value */
type JsonTextColumn<TT> = ReturnType<typeof jsonTextColumn<TT>>

/** Every column `jsonText` has made, so a check over the schema can tell them from plain text */
const Made = new WeakSet<object>()

/** The column itself, apart from its registration, so its type can be named */
function jsonTextColumn<TT>() {
  return JZS.string().optional().transform<TT | null>({
    from: (raw) => (raw === null ? null : JSON.parse(raw) as TT),
    to:   (val) => (val === null ? null : UU.jsonify(val)),
  })
}

/**
 * A nullable column holding a structured value, stored as JSON text.
 *
 * Jazz's own JSON column refuses a value once it is made optional, so a structured value that
 * may be absent is kept as text and parsed on the way out. Rows read and write the value itself;
 * only the stored cell is text. Nothing checks the value on the way in: the row validator does
 * that before any write.
 *
 * @returns A column whose rows hold a `TT`, or null.
 *
 * @example jsonText<BulkIshesRunT>()  // row.bulk_ishes_last is a BulkIshesRunT or null
 */
export function jsonText<TT>(): JsonTextColumn<TT> {
  const column = jsonTextColumn<TT>()
  Made.add(column)
  return column
}

/**
 * Whether `column` was made by `jsonText`, and so holds a structured value as text.
 *
 * @example isJsonText(jsonText<number[]>())  // => true
 * @example isJsonText(JZS.string())           // => false
 */
export function isJsonText(column: object): boolean {
  return Made.has(column)
}
