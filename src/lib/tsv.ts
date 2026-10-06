import * as EST from 'es-toolkit'
import * as UU from './useful'

/**
 * Tables as tab-separated text, the one way every table in a hunt's repository is written
 * (`notes/decisions/tsv-formats.md`): a header line of column names, then a line per row, each
 * line ending in a newline.
 *
 * A row is a record, nested as a jsonball nests it, flattened to its leaves: each column is named
 * by its leaf's key path, dotted (`dumdum.status`, `columns.title.width_px`), no prefix added. A
 * bag opens into columns down to the level whose shape the caller's schema fixes; a value below
 * that (a widgeting's `value` or `params`, a widget's `config`: whatever the caller names as
 * whole) is one cell of JSON. The columns are sorted, and the rows are sorted by their `label`,
 * so that nothing about how a smith arranged a thing moves a line: the order is the jsonball's to
 * keep, in its `position`s.
 *
 * **One line is one row, always.** A string cell is written as JSON would encode it, but without
 * the enclosing quotes and without escaping `"`: a backslash, tab, line break, carriage return or
 * other control character is its escape (`\\`, `\t`, `\n`, `\r`, `\u0001`), and everything else
 * is itself, so the text reads back exactly given the field's type. A number or a boolean is
 * written as JSON writes it, never escaped; a list, or a bag not opened, as compact JSON, not
 * escaped again (it holds no raw tab or line break); null, a missing field and an empty string,
 * as an empty cell. A column's name is escaped as a string cell is.
 */

/** One row, before it is written: its label, and its fields, nested */
export type RecordT = { label: string } & Readonly<Record<string, unknown>>

/**
 * Where, in a row, a value is one cell of JSON however it is nested: a key path, any of whose
 * segments may be `*` for any key. `['*', 'value']` is every widgeted's value in a question's row.
 */
export type WholePatternT = readonly string[]

/** The column every table has, naming each row: what rows are sorted by */
export const LabelColumn = 'label'

/** A pattern segment that matches any key */
const AnyKey = '*'

/** One cell, before it is written: its value, and whether it is a cell of JSON whatever the value is */
type LeafT = { val: unknown, json: boolean }

/**
 * `records` as a table: a header of every key path any of them holds, sorted, then a line per
 * record, in order of label.
 *
 * @param records - The rows, each with its label, in any order.
 * @param wholes - Where a row's value is one cell of JSON rather than opened into columns.
 * @returns The text, ending in a newline; a header of `label` alone for no rows.
 *
 * @example textOf([{ label: 'nantes', qnum: '2' }, { label: 'leon', qnum: '1', dumdum: { status: 'ok', value: 'Leon?' } }], [['*', 'value']])
 *   // => 'dumdum.status\tdumdum.value\tlabel\tqnum\nok\t"Leon?"\tleon\t1\n\t\tnantes\t2\n'
 * @example textOf([])  // => 'label\n'
 */
export function textOf(records: readonly RecordT[], wholes: readonly WholePatternT[] = []): string {
  const rows = records.toSorted((aa, bb) => byCode(aa.label, bb.label)).map((record) => leavesOf(record, wholes))
  const header = [...new Set([LabelColumn, ...rows.flatMap((row) => row.keys().toArray())])].toSorted(byCode)
  const lines = [header.map((column) => cellOf(column)), ...rows.map((row) => header.map((column) => leafCellOf(row.get(column))))]
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

/**
 * Compare by code unit, not by locale, so the order is the same wherever it is read: how a
 * table's rows and columns, and a repository's paths, are sorted.
 *
 * @example ['b', 'B', 'a'].toSorted(byCode)  // => ['B', 'a', 'b']
 */
export function byCode(aa: string, bb: string): number {
  if (aa === bb) { return 0 }
  return aa < bb ? -1 : 1
}

/**
 * `record`'s leaves by dotted key path: a bag is opened into its members, but for an empty one, or
 * one at a key path `wholes` names, which is a leaf whole. Nothing is kept for what is undefined,
 * as its JSON holds nothing.
 */
function leavesOf(record: RecordT, wholes: readonly WholePatternT[]): Map<string, LeafT> {
  const leaves = new Map<string, LeafT>()
  const walk = (val: unknown, keypath: readonly string[]) => {
    if (val === undefined) { return }
    const json = wholes.some((pattern) => isAt(pattern, keypath))
    if (! json && EST.isPlainObject(val) && Object.keys(val).length > 0) {
      for (const [key, member] of Object.entries(val)) { walk(member, [...keypath, key]) }
      return
    }
    leaves.set(keypath.join('.'), { val, json })
  }
  for (const [key, val] of Object.entries(record)) { walk(val, [key]) }
  return leaves
}

/** Whether `keypath` is where `pattern` points */
function isAt(pattern: WholePatternT, keypath: readonly string[]): boolean {
  return pattern.length === keypath.length && pattern.every((seg, idx) => seg === AnyKey || seg === keypath[idx])
}

/** One leaf's cell: as JSON where it is a cell of JSON (nothing for null), else as its type says (`cellOf`) */
function leafCellOf(leaf: LeafT | undefined): string {
  if (leaf === undefined) { return '' }
  if (! leaf.json || leaf.val === null) { return cellOf(leaf.val) }
  return UU.jsonify(leaf.val)
}

/**
 * One cell's text, by the type of what it holds: a string as JSON encodes it, but without its
 * quotes and without escaping `"`; a number or a boolean as JSON writes it; nothing for null,
 * undefined or an empty string; anything else (a list, a bag) as compact JSON, as it is.
 *
 * @example cellOf('two\nlines')  // => 'two\\nlines'
 * @example cellOf('say "hi"')  // => 'say "hi"'
 * @example cellOf(['a', 'b'])  // => '["a","b"]'
 * @example cellOf(null)  // => ''
 */
export function cellOf(val: unknown): string {
  if (val === null || val === undefined) { return '' }
  if (typeof val === 'string') { return escaped(val) }
  if (typeof val === 'number' || typeof val === 'boolean') { return String(val) }
  return UU.jsonify(val)
}

/**
 * `str` as JSON encodes a string, without the enclosing quotes and without escaping `"`. Every
 * `\"` in JSON's text is a quote's own escape, since a quote never stands bare there, and the
 * leftmost match of each is that escape, never the tail of an escaped backslash.
 */
function escaped(str: string): string {
  return JSON.stringify(str).slice(1, -1).replaceAll(String.raw`\"`, '"')
}
