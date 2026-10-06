import _ from 'es-toolkit/compat'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Id } from '../../convex/_generated/dataModel'
import { StampedTables, stampsAfter } from '../../convex/stamping'
import { Hunt } from '../../src/models/hunt'
import { openOf, openTester, seedHunt, type Tester } from '../support/convex'
import { present } from '../support/present'

/** Three moments, a minute apart, at which the tests write */
const [Early, Later, Latest] = [Date.UTC(2026, 9, 5, 9), Date.UTC(2026, 9, 5, 9, 1), Date.UTC(2026, 9, 5, 9, 2)]

/** A seeded hunt, and its open quiz's first two questions' ids */
async function seeded(tt: Tester = openTester()) {
  const held = await seedHunt(tt, Hunt.blank('quiet_otter'))
  const [first, second] = openOf(await held.read()).questions.map((question) => question._id as Id<'questions'>)
  return { ...held, tt, question_id: present(first), other_id: present(second) }
}

/** The question `question_id`'s stamps as its row holds them, beside the whole millisecond the database made it */
async function stampsOf(tt: Tester, question_id: Id<'questions'>) {
  return await tt.run(async (ctx) => {
    const row = present(await ctx.db.get('questions', question_id))
    return { made: Math.floor(row._creationTime), ..._.pick(row, ['created_at', 'updated_at']) }
  })
}

beforeEach(() => { vi.useFakeTimers({ now: Early, toFake: ['Date'] }) })
afterEach(() => { vi.useRealTimers() })

describe("StampedTables", () => {
  it("is every table of ours the app writes, but the identings, appended and never edited", () => {
    expect(StampedTables).to.not.include('identings')
    expect(StampedTables).to.include.members(['hunts', 'quizzes', 'questions', 'widgetings', 'columns', 'widgeteds', 'reviews', 'reviewings'])
  })
})

describe("stampsAfter", () => {
  const Made = 1_759_700_000_000
  const Cases: [Parameters<typeof stampsAfter>[1], ReturnType<typeof stampsAfter>, string][] = [
    [{ id: 'aa', operation: 'insert', oldDoc: null, newDoc: { _creationTime: Made + 0.5 } },                                                        { created_at: Made, updated_at: Made },   'an insert: made, and last edited, in the whole millisecond the database made it'],
    [{ id: 'aa', operation: 'update', oldDoc: { _creationTime: Made, created_at: Made }, newDoc: { _creationTime: Made, created_at: Made } },        { created_at: Made, updated_at: Later },  'an edit: last edited now'],
    [{ id: 'aa', operation: 'update', oldDoc: { _creationTime: Made + 0.5 }, newDoc: { _creationTime: Made + 0.5 } },                                { created_at: Made, updated_at: Later },  'the first edit of a row it never saw: made when the database made it'],
    [{ id: 'aa', operation: 'update', oldDoc: { _creationTime: Made, created_at: Made - 9 }, newDoc: { _creationTime: Made } },                      { created_at: Made - 9, updated_at: Later }, 'a replace that leaves the stamps out: keeps when it was made'],
    [{ id: 'aa', operation: 'delete', oldDoc: { _creationTime: Made }, newDoc: null },                                                               null,                                     'a deletion: nothing'],
  ]
  for (const [change, stamps, describes] of Cases) {
    it(`stamps ${describes}`, () => {
      expect(stampsAfter('questions', change, Later)).to.deep.eq(stamps)
    })
  }

  it("refuses a write that changes when a row was made", () => {
    const change = { id: 'aa', operation: 'update' as const, oldDoc: { _creationTime: Made, created_at: Made }, newDoc: { _creationTime: Made, created_at: Made + 1 } }
    expect(() => stampsAfter('questions', change, Later)).to.throw(/created_at is immutable/)
  })

  it("reads the doc block's examples", () => {
    expect(stampsAfter('questions', { id: 'aa', operation: 'insert', oldDoc: null, newDoc: { _creationTime: 5.5 } }, 9)).to.deep.eq({ created_at: 5, updated_at: 5 })
    expect(stampsAfter('questions', { id: 'aa', operation: 'update', oldDoc: { _creationTime: 5.5, created_at: 5 }, newDoc: { _creationTime: 5.5, created_at: 5 } }, 9)).to.deep.eq({ created_at: 5, updated_at: 9 })
  })
})

describe("a mutation's database", () => {
  it("stamps a question made, made and last edited alike, in the whole millisecond the database made it", async () => {
    const { tt, act, read } = await seeded()
    vi.setSystemTime(Later)
    await act({ kind: 'add_question' })
    const added = present(openOf(await read()).questions.at(-1))
    const { made, created_at, updated_at } = await stampsOf(tt, added._id as Id<'questions'>)
    expect([created_at, updated_at]).to.deep.eq([made, made])
  })

  it("moves an edited question's updated_at to the moment of the edit, and its alone, filling in when it was made", async () => {
    const { tt, act, question_id, other_id } = await seeded()
    vi.setSystemTime(Later)
    await act({ kind: 'edit_question', question_id, patch: { clueing: 'Who?' } })
    vi.setSystemTime(Latest)
    await act({ kind: 'edit_question', question_id, patch: { clueing: 'Who?' } })
    const edited = await stampsOf(tt, question_id)
    expect([edited.created_at, edited.updated_at]).to.deep.eq([edited.made, Later])
    expect(await stampsOf(tt, other_id)).to.not.have.any.keys('created_at', 'updated_at')
  })

  it("stamps a row of the layout too: a column moved", async () => {
    const { tt, act } = await seeded()
    vi.setSystemTime(Later)
    const before = await tt.run(async (ctx) => await ctx.db.query('columns').collect())
    const last = present(before.at(-1)).label
    await act({ kind: 'move_column', label: last, onto_idx: 0 })
    const stamped = await tt.run(async (ctx) => {
      const columns = await ctx.db.query('columns').collect()
      return columns.filter((column) => column.updated_at === Later).map((column) => column.label)
    })
    expect(stamped).to.include(last)
  })

  it("refuses, writing nothing, an edit that would change when a row was made", async () => {
    const { tt, act, question_id } = await seeded()
    await act({ kind: 'edit_question', question_id, patch: { clueing: 'Who?' } })
    await expect(tt.run(async (ctx) => {
      const { triggers } = await import('../../convex/triggers')
      await triggers.wrapDB(ctx).db.patch('questions', question_id, { created_at: 1 })
    })).rejects.toThrow(/created_at is immutable/)
  })
})
