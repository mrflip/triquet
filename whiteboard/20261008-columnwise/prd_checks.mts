// The columnwise sprint's checks over production's rows, read from an unzipped `npx convex export`.
// Read-only: it reads the export's files and prints what it finds. Run from the repo root:
//
//   npx tsx whiteboard/20261008-columnwise/prd_checks.mts <unzipped export dir>
//
// See `columnwise-convex_runbook.md` beside it for when to run it and what to do with each hit.

import * as FS   from 'node:fs'
import * as Path from 'node:path'
import { isUnreserved } from '../../src/lib/vv/patterns.ts'
import { ReservedWidgetingLabels } from '../../src/models/widgeting.ts'
import { ColumnValidators } from '../../src/models/column.ts'

type RowT = Record<string, unknown> & { _id: string }

const exportDir = process.argv[2]
if (! exportDir) {
  console.error('usage: npx tsx whiteboard/20261008-columnwise/prd_checks.mts <unzipped export dir>')
  process.exit(2)
}

function rowsOf(table: string): RowT[] {
  const file = Path.join(exportDir, table, 'documents.jsonl')
  if (! FS.existsSync(file)) {
    console.warn(`  (no ${table}/documents.jsonl in the export)`)
    return []
  }
  return FS.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as RowT)
}

/** Every string inside a row, with the path that reaches it */
function stringsOf(val: unknown, path: string[] = []): [string, string][] {
  if (typeof val === 'string') { return [[path.join('.'), val]] }
  if (Array.isArray(val)) { return val.flatMap((item, ii) => stringsOf(item, [...path, String(ii)])) }
  if (val && typeof val === 'object') { return Object.entries(val).flatMap(([key, item]) => stringsOf(item, [...path, key])) }
  return []
}

const Tables = ['idents', 'hunts', 'realms', 'widgets', 'quizzes', 'widgetings', 'columns', 'questions', 'widgeteds', 'quiz_widgeteds', 'reviews', 'reviewings', 'huntings', 'signals']
const rowsByTable = Object.fromEntries(Tables.map((table) => [table, rowsOf(table)]))

const hits: Record<string, string[]> = {
  reserved:   [],
  regex:      [],
  categories: [],
  exp:        [],
  unwidened:  [],
}
const say = (check: string, table: string, row: RowT, what: string) => {
  hits[check].push(`${table} ${row._id} ${String(row.label ?? '')}: ${what}`)
}

// 1. Labels and usernames now reserved (thread 2, #196)
for (const table of ['idents', 'hunts', 'realms', 'quizzes', 'questions', 'columns', 'widgets', 'widgetings']) {
  for (const row of rowsByTable[table]) {
    const label = row.label
    if (typeof label === 'string' && (! isUnreserved(label))) { say('reserved', table, row, `label "${label}" is reserved`) }
    if (table === 'widgetings' && typeof label === 'string' && ReservedWidgetingLabels.includes(label)) {
      say('reserved', table, row, `label "${label}" is reserved for widgetings`)
    }
    if (table === 'hunts' && typeof row.orglabel === 'string' && (! isUnreserved(row.orglabel))) {
      say('reserved', table, row, `orglabel "${row.orglabel}" is reserved`)
    }
  }
}

// 2. A `regex` param or config written before thread 6 (#198), never checked by recheck
for (const row of rowsByTable.widgetings) {
  const params = row.params as Record<string, unknown> | undefined
  if (params && ('regex' in params)) { say('regex', 'widgetings', row, `params.regex = ${JSON.stringify(params.regex)}`) }
}
for (const row of rowsByTable.widgets) {
  const config = row.config as Record<string, unknown> | undefined
  if (config && ('regex' in config)) { say('regex', 'widgets', row, `config.regex = ${JSON.stringify(config.regex)}`) }
}

// 3. Formulas or templates reading `categories`, which thread 3a (#193) relabelled `category_data`
const CategoriesRe = /\bcategories\b/
for (const table of ['widgets', 'widgetings', 'columns', 'quizzes']) {
  for (const row of rowsByTable[table]) {
    for (const [path, text] of stringsOf(row)) {
      if (['label', 'widget_label', 'title', 'description'].includes(path)) { continue }
      if (CategoriesRe.test(text)) { say('categories', table, row, `${path} = ${JSON.stringify(text.slice(0, 160))}`) }
    }
  }
}

// 4. LiquidJS `*_exp` filters, refused by thread 9: anywhere, so templateable question text too
const ExpRe = /\b(where|reject|group_by|has|find|find_index)_exp\b/
for (const table of Tables) {
  for (const row of rowsByTable[table]) {
    for (const [path, text] of stringsOf(row)) {
      if (ExpRe.test(text)) { say('exp', table, row, `${path} = ${JSON.stringify(text.slice(0, 160))}`) }
    }
  }
}

// 5. Rows thread 3a's backfills should have rewritten: what 3c's tightening push would refuse
for (const row of rowsByTable.quizzes) {
  if ('templated' in row) { say('unwidened', 'quizzes', row, `still holds templated ${JSON.stringify(row.templated)}`) }
  if (! ('templateable' in row)) { say('unwidened', 'quizzes', row, 'has no templateable') }
}
for (const row of rowsByTable.columns) {
  if (typeof row.source === 'string' && (! ColumnValidators.ref.safeParse(row.source).success)) { say('unwidened', 'columns', row, `source "${row.source}" is in the old grammar`) }
}
for (const table of ['widgets', 'widgetings']) {
  for (const row of rowsByTable[table]) {
    if (typeof row.label === 'string' && /^categories(_\d+)?$/.test(row.label)) { say('unwidened', table, row, 'still labelled categories') }
  }
}

const Titles: Record<string, string> = {
  reserved:   '1. Reserved labels and usernames (relabel each)',
  regex:      '2. regex params or config written before #198 (expect none)',
  categories: '3. Formulas or templates naming categories (look at each: one reading qn.categories now reads nothing)',
  exp:        '4. *_exp Liquid filters (rewrite each before thread 9 deploys)',
  unwidened:  '5. Rows 3a\'s backfills have not rewritten (must be none before 3c merges)',
}
for (const [check, lines] of Object.entries(hits)) {
  console.log(`\n${Titles[check]}: ${lines.length === 0 ? 'none' : String(lines.length)}`)
  for (const line of lines) { console.log(`  ${line}`) }
}
console.log(`\nRead ${Tables.map((table) => `${String(rowsByTable[table].length)} ${table}`).join(', ')}.`)
