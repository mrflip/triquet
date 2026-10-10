import { describe, expect, it } from 'vitest'
import { counting, plainReads } from './counting'

/** Rows by table, as a stand-in database hands them back */
const Rows: Record<string, { _id: string }[]> = { questions: [{ _id: 'qn1' }, { _id: 'qn2' }, { _id: 'qn3' }], widgetings: [] }

/** A query over `rows`, as far as the counting database reaches into one */
function queryOf(rows: { _id: string }[]) {
  const query = {
    withIndex:  () => query,
    order:      () => query,
    first:      () => Promise.resolve(rows[0] ?? null),
    take:       (qty: number) => Promise.resolve(rows.slice(0, qty)),
    collect:    () => Promise.resolve(rows),
    [Symbol.asyncIterator]: () => {
      const each = rows.values()
      return { next: () => Promise.resolve(each.next()) }
    },
  }
  return query
}

/** A stand-in database: reads from `Rows`, and one write, which hands back what it was given */
function standIn() {
  return {
    get:    (tablename: string, id: string) => Promise.resolve(Rows[tablename]?.find((row) => row._id === id) ?? null),
    query:  (tablename: string) => queryOf(Rows[tablename] ?? []),
    insert: (tablename: string, row: object) => Promise.resolve({ tablename, row }),
  }
}

describe('counting', () => {
  it('counts each document read, and each range opened, by first, take, collect, get or a walk', async () => {
    const { db, reads } = counting(standIn())
    await db.query('questions').withIndex().order().first()
    await db.query('questions').take(2)
    await db.query('widgetings').collect()
    await db.get('questions', 'qn3')
    await db.get('questions', 'gone')
    expect(plainReads(reads)).to.deep.eq({ docs: 4, ranges: 5, tables: ['questions', 'widgetings'] })
  })

  it('counts a walk as one range, and each document it is handed, up to where it stops', async () => {
    const { db, reads } = counting(standIn())
    for await (const row of db.query('questions')) {
      if (row._id === 'qn2') { break }
    }
    expect(plainReads(reads)).to.deep.eq({ docs: 2, ranges: 1, tables: ['questions'] })
  })

  it('passes a write straight through, counting nothing', async () => {
    const { db, reads } = counting(standIn())
    expect(await db.insert('questions', { label: 'aa' })).to.deep.eq({ tablename: 'questions', row: { label: 'aa' } })
    expect(plainReads(reads)).to.deep.eq({ docs: 0, ranges: 0, tables: [] })
  })
})

describe('plainReads', () => {
  it('is the reads as plain values, the tables in code-unit order', () => {
    expect(plainReads({ docs: 2, ranges: 1, tables: new Set(['widgeteds']) })).to.deep.eq({ docs: 2, ranges: 1, tables: ['widgeteds'] })
    expect(plainReads({ docs: 0, ranges: 2, tables: new Set(['widgeteds', 'huntings']) }).tables).to.deep.eq(['huntings', 'widgeteds'])
  })
})
