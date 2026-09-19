import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { MigrationsFolder, openDb } from '../../src/db/client'
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
