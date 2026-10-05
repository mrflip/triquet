import * as EST from 'es-toolkit'
import * as UU from './useful'

/**
 * Tables as tab-separated text, the one way every table in a hunt's repository is written: a
 * header line of column names, then a line per row, each line ending in a newline.
 *
 * A row is a record, nested as a jsonball nests it, flattened to its leaves: each column is named
 * by its leaf's key path, dotted (`widgetings.dumdum.position`). The columns are sorted, and the
 * rows are sorted by their `label`, so that nothing about how a smith arranged a thing (the order
 * of its questions, its widgetings, its keys) moves a line: the order is the jsonball's to keep,
 * in its `position`s.
 *
 * **One line is one row, always.** A cell's tab, line break or carriage return (or a column
 * name's) is written as `\t`, `\n` or `\r`, and its backslash as `\\`, so a diff of the table shows
 * one changed line per changed row, and the text reads back exactly. A cell holding a list, or an empty object, holds
 * it as compact JSON; one holding nothing (null, or a field the row lacks) is empty.
 */

/** One row, before it is written: its label, and its fields, nested */
export type RecordT = { label: string } & Readonly<Record<string, unknown>>

/** The column every table has, naming each row: what rows are sorted by */
export const LabelColumn = 'label'

/** What each character a cell may not hold is written as */
const EscapeFor: Readonly<Record<string, string>> = { '\\': String.raw`\\`, '\t': String.raw`\t`, '\n': String.raw`\n`, '\r': String.raw`\r` }

/**
 * `records` as a table: a header of every key path any of them holds, sorted, then a line per
 * record, in order of label.
 *
 * @param records - The rows, each with its label, in any order.
 * @returns The text, ending in a newline; a header of `label` alone for no rows.
 *
 * @example textOf([{ label: 'nantes', qnum: '2' }, { label: 'leon', qnum: '1', dumdum: { status: 'ok' } }])
 *   // => 'dumdum.status\tlabel\tqnum\nok\tleon\t1\n\tnantes\t2\n'
 * @example textOf([])  // => 'label\n'
 */
export function textOf(records: readonly RecordT[]): string {
  const rows = records.toSorted((aa, bb) => byCode(aa.label, bb.label)).map((record) => leavesOf(record))
  const header = [...new Set([LabelColumn, ...rows.flatMap((row) => Object.keys(row))])].toSorted(byCode)
  const lines = [header.map((column) => escaped(column)), ...rows.map((row) => header.map((column) => cellOf(row[column])))]
  return lines.map((cells) => `${cells.join('\t')}\n`).join('')
}

/**
 * `keyed`'s members as rows: each member's fields, labelled with the key it sits under.
 *
 * @param keyed - A collection keyed by label, as a jsonball holds one.
 * @returns A record per member, in the collection's order.
 *
 * @example recordsOf({ leon: { position: 0 } })  // => [{ position: 0, label: 'leon' }]
 */
export function recordsOf(keyed: Readonly<Record<string, Readonly<Record<string, unknown>>>>): RecordT[] {
  return Object.entries(keyed).map(([label, member]) => ({ ...member, label }))
}

/** Compare by code unit, not by locale, so the order is the same wherever it is read */
function byCode(aa: string, bb: string): number {
  if (aa === bb) { return 0 }
  return aa < bb ? -1 : 1
}

/** `record`'s leaves by dotted key path, a list or an empty object counting as a leaf, and nothing for what is undefined (as its JSON holds nothing) */
function leavesOf(record: RecordT): Record<string, unknown> {
  return EST.omitBy(EST.flattenObject(record, { preserveArrays: true }), (val) => val === undefined)
}

/**
 * One cell's text: a string with its tabs, line breaks and backslashes escaped; a number or a
 * boolean as JSON writes it; nothing for null; anything else (a list, an empty object) as
 * compact JSON, escaped the same way.
 *
 * @example cellOf('two\nlines')  // => 'two\\nlines'
 * @example cellOf(['a', 'b'])  // => '["a","b"]'
 * @example cellOf(null)  // => ''
 */
export function cellOf(val: unknown): string {
  if (val === null || val === undefined) { return '' }
  if (typeof val === 'string') { return escaped(val) }
  if (typeof val === 'number' || typeof val === 'boolean') { return String(val) }
  return escaped(UU.jsonify(val))
}

/** `str` with every character a cell may not hold written as its escape */
function escaped(str: string): string {
  return str.replaceAll(/[\\\t\n\r]/g, (char) => EscapeFor[char] ?? char)
}
