import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createClient } from '@libsql/client'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import * as schema from '../../src/db/schema'
import { MigrationsFolder, openDb, type Db } from '../../src/db/client'
import { loadWorkspace } from '../../src/db/workspaces'
import { mintId } from '../../src/lib/ids'
import * as UU from '../../src/lib/useful'
import { SeedExpressions } from '../../src/models/expression'
import { defaultLayoutFor } from '../../src/models/layout'
import { SumColkeyLabels } from '../support/sum-colkeys'
import { present } from '../support/present'

const byText = (aa: string, bb: string) => aa.localeCompare(bb)

/** The statements of one migration file, as drizzle-kit wrote them */
function statementsOf(filename: string): string[] {
  return readFileSync(path.join(MigrationsFolder, filename), 'utf8').split('--> statement-breakpoint').map((chunk) => chunk.trim())
}

describe('the migration that introduced expressions', () => {
  const update = statementsOf('0005_expressions.sql').find((statement) => statement.startsWith('UPDATE'))

  it('carries a statement that renames the sum columns\' sort memory, and only that', () => {
    const statement = present(update)
    expect(SumColkeyLabels.map((label) => statement.includes(`'${label}'`))).to.deep.eq(SumColkeyLabels.map(() => true))
  })

  it('turns a quiz sorted by an old sum column into one sorted by the computed column of the same name', async () => {
    const db = await openDb(':memory:')
    const rows = SumColkeyLabels.map((label, idx) => `('q${String(idx)}', 'w', 'T', 'l${String(idx)}', 'main', 0, '${label}')`)
    await db.run(sql.raw(`INSERT INTO workspaces (id, created_at) VALUES ('w', 1)`))
    await db.run(sql.raw(`INSERT INTO quizzes (id, workspace_id, title, label, version, locked, last_sortkey) VALUES ${rows.join(', ')}`))
    await db.run(sql.raw(`INSERT INTO quizzes (id, workspace_id, title, label, version, locked, last_sortkey) VALUES ('qq', 'w', 'T', 'lqq', 'main', 0, 'qnum')`))
    await db.run(sql.raw(present(update)))
    const after = await db.all<{ id: string, last_sortkey: string }>(sql.raw('SELECT id, last_sortkey FROM quizzes ORDER BY id'))
    expect(after.filter((row) => row.id !== 'qq').map((row) => row.last_sortkey).toSorted(byText)).to.deep.eq(SumColkeyLabels.map((label) => `expressing:${label}`).toSorted(byText))
    expect(after.find((row) => row.id === 'qq')?.last_sortkey).to.eq('qnum')
  })
})

/** A copy of the migrations folder holding only the first `count` migrations, so a database can be built as it once was */
function foldersUpTo(count: number): string {
  const folder = mkdtempSync(path.join(tmpdir(), 'triquet-migrations-'))
  cpSync(MigrationsFolder, folder, { recursive: true })
  const journalPath = path.join(folder, 'meta', '_journal.json')
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: { idx: number }[] }
  writeFileSync(journalPath, UU.jsonify({ ...journal, entries: journal.entries.filter((entry) => entry.idx < count) }))
  return folder
}

describe('the migration that separated widgets from columns', () => {
  const OldMigrations = 8
  const [Ws, Qa, Qb] = [mintId(), mintId(), mintId()]

  /** A database as it was before: two quizzes, one with its own expressings, one that never had any */
  async function legacyDatabase() {
    const sqlite = createClient({ url: ':memory:' })
    const db = drizzle(sqlite, { schema })
    await migrate(db, { migrationsFolder: foldersUpTo(OldMigrations) })
    const statements = [
      `INSERT INTO workspaces (id, active_quiz_id, created_at) VALUES ('${Ws}', '${Qa}', 1)`,
      `INSERT INTO quizzes (id, workspace_id, title, label, version, locked, last_sortkey) VALUES ('${Qa}', '${Ws}', 'Has columns', 'has_columns', 'main', 0, 'expressing:hint_full')`,
      `INSERT INTO quizzes (id, workspace_id, title, label, version, locked, last_sortkey) VALUES ('${Qb}', '${Ws}', 'Has none', 'has_none', 'main', 0, 'qnum')`,
      `INSERT INTO expressings (quiz_id, label, expression_label, title, description, shape, position) VALUES ('${Qa}', 'letters', 'answer_letter_count', 'Letters', 'For anagrams', 'medium', 0)`,
      `INSERT INTO expressings (quiz_id, label, expression_label, title, description, shape, position) VALUES ('${Qa}', 'hint_full', 'hint_full', 'Hint Full Sum', '', 'skinny', 1)`,
    ]
    for (const statement of statements) { await db.run(sql.raw(statement)) }
    return db
  }

  it('gives a quiz its expressings as widgets, after the playing widgets every quiz gets, in order', async () => {
    const db = await legacyDatabase()
    await migrate(db, { migrationsFolder: MigrationsFolder })
    const rows = await db.all<{ label: string, kind: string, position: number }>(sql.raw(`SELECT label, kind, position FROM widgets WHERE quiz_id = '${Qa}' ORDER BY position`))
    expect(rows.map((row) => `${String(row.position)}:${row.kind}:${row.label}`)).to.deep.eq([
      '0:playing:dumdum', '1:playing:numnum_clueing', '2:playing:numnum_hint', '3:expressing:letters', '4:expressing:hint_full',
    ])
  })

  it('keeps each expressing\'s title and width as a column, between Q# and Alt Text', async () => {
    const db = await legacyDatabase()
    await migrate(db, { migrationsFolder: MigrationsFolder })
    const rows = await db.all<{ label: string, title: string, source: string, width_px: number }>(sql.raw(`SELECT label, title, source, width_px FROM columns WHERE quiz_id = '${Qa}' ORDER BY position`))
    expect(rows.map((row) => row.label)).to.deep.eq([
      'title', 'clueing', 'hint', 'chains_to', 'butnot', 'qnum', 'letters', 'hint_full',
      'alt_text', 'notes', 'full_answer', 'clueing_ishes', 'butnot_ishes', 'hint_ishes', 'guess',
    ])
    expect(rows.find((row) => row.label === 'letters')).to.deep.eq({ label: 'letters', title: 'Letters', source: 'letters', width_px: 180 })
    expect(rows.find((row) => row.label === 'hint_full')?.width_px).to.eq(78)
  })

  it('gives a quiz that never had expressings the eight standard sums', async () => {
    const db = await legacyDatabase()
    await migrate(db, { migrationsFolder: MigrationsFolder })
    const rows = await db.all<{ label: string }>(sql.raw(`SELECT label FROM widgets WHERE quiz_id = '${Qb}' AND kind = 'expressing' ORDER BY position`))
    expect(rows.map((row) => row.label)).to.deep.eq(['clueing_plus_rank', 'clueing_full', 'clueing_numeral', 'butnot_full', 'butnot_numeral', 'hint_full', 'hint_numeral', 'clueing_plus_butnot_full'])
  })

  it('renames every remembered sort to the column it named', async () => {
    const db = await legacyDatabase()
    await migrate(db, { migrationsFolder: MigrationsFolder })
    const rows = await db.all<{ id: string, last_sortkey: string }>(sql.raw('SELECT id, last_sortkey FROM quizzes ORDER BY id'))
    expect(rows.find((row) => row.id === Qa)?.last_sortkey).to.eq('column:hint_full')
    expect(rows.find((row) => row.id === Qb)?.last_sortkey).to.eq('column:qnum')
  })

  it('loads as the same grid the code would build for a new quiz, and the workspace still validates', async () => {
    const db = await legacyDatabase()
    await migrate(db, { migrationsFolder: MigrationsFolder })
    await db.run(sql.raw(`INSERT OR IGNORE INTO players (label, title, blurb, servicelabel, model_tier, max_tokens, prompts) VALUES ('dumdum', 'D', '', 'claude', 'quick', 1, '{}')`))
    const loaded = await loadWorkspace(appDbFor(db), Ws)
    const quiz = present(loaded?.quizzes.find((held) => held.id === Qb))
    expect(quiz.columns).to.deep.eq(defaultLayoutFor(SeedExpressions).columns)
    expect(quiz.widgets).to.deep.eq(defaultLayoutFor(SeedExpressions).widgets)
  })
})

/** `db` as the app's own database type */
function appDbFor(db: unknown): Db {
  return db as Db
}
