import _ from 'es-toolkit/compat'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Id } from '../../convex/_generated/dataModel'
import { StampedTables, isStamped, stampingWriter } from '../../convex/stamping'
import { Hunt } from '../../src/models/hunt'
import { Question } from '../../src/models/question'
import { openOf, openTester, seedHunt, type Tester } from '../support/convex'
import { present } from '../support/present'

/** Three moments, a minute apart, at which the tests write */
const [Early, Later, Latest] = [Date.UTC(2026, 9, 5, 9), Date.UTC(2026, 9, 5, 9, 1), Date.UTC(2026, 9, 5, 9, 2)]

/** A seeded hunt, and its open quiz's first question's id */
async function seeded(tt: Tester = openTester()) {
  const held = await seedHunt(tt, Hunt.blank('quiet_otter'))
  const question_id = present(openOf(await held.read()).questions[0])._id as Id<'questions'>
  return { ...held, tt, question_id }
}

/** The stamps of the question `question_id`, as its row holds them */
async function stampsOf(tt: Tester, question_id: Id<'questions'>) {
  return await tt.run(async (ctx) => _.pick(await ctx.db.get('questions', question_id), ['created_at', 'updated_at']))
}

beforeEach(() => { vi.useFakeTimers({ now: Early, toFake: ['Date'] }) })
afterEach(() => { vi.useRealTimers() })

describe("StampedTables", () => {
  it("is the rows a person makes and edits: a hunt, a quiz and its questions, a review and its verdicts", () => {
    expect(StampedTables).to.deep.eq(['hunts', 'quizzes', 'questions', 'reviews', 'reviewings'])
    expect([isStamped('questions'), isStamped('columns'), isStamped('widgeteds')]).to.deep.eq([true, false, false])
  })
})

describe("stampingWriter", () => {
  it("stamps a row inserted into a stamped table with one moment, made and last edited, whatever stamps it carried", async () => {
    const { tt, open } = await seeded()
    const question_id = await tt.run(async (ctx) => {
      const row = { ...Question.blankRow({ hunt_id: open.hunt_id, quiz_id: open.quiz_id }), created_at: 1, updated_at: 2 }
      return await stampingWriter(ctx.db, Later).insert('questions', row)
    })
    expect(await stampsOf(tt, question_id)).to.deep.eq({ created_at: Later, updated_at: Later })
  })

  it("moves a patched row's updated_at, and leaves its created_at, whatever stamps the patch carried", async () => {
    const { tt, question_id } = await seeded()
    await tt.run(async (ctx) => { await stampingWriter(ctx.db, Later).patch('questions', question_id, { clueing: 'Who?', created_at: 1, updated_at: 2 }) })
    expect(await stampsOf(tt, question_id)).to.deep.eq({ created_at: Early, updated_at: Later })
  })

  it("writes nothing for a patch that holds stamps alone", async () => {
    const { tt, question_id } = await seeded()
    await tt.run(async (ctx) => { await stampingWriter(ctx.db, Later).patch('questions', question_id, { created_at: 1, updated_at: 2 }) })
    expect(await stampsOf(tt, question_id)).to.deep.eq({ created_at: Early, updated_at: Early })
  })

  it("keeps a replaced row's created_at, and moves its updated_at", async () => {
    const { tt, question_id } = await seeded()
    await tt.run(async (ctx) => {
      const held = present(await ctx.db.get('questions', question_id))
      await stampingWriter(ctx.db, Later).replace('questions', question_id, { ..._.omit(held, ['_id', '_creationTime']), clueing: 'Who?', created_at: 1 })
    })
    expect(await stampsOf(tt, question_id)).to.deep.eq({ created_at: Early, updated_at: Later })
  })

  it("finds a stamped table from the id alone, when a write names none", async () => {
    const { tt, question_id } = await seeded()
    await tt.run(async (ctx) => { await stampingWriter(ctx.db, Later).patch(question_id, { clueing: 'Who?' }) })
    expect(await stampsOf(tt, question_id)).to.deep.eq({ created_at: Early, updated_at: Later })
  })

  it("passes a write to a table that is not stamped straight through", async () => {
    const { tt, open } = await seeded()
    const column = await tt.run(async (ctx) => {
      const [first] = await ctx.db.query('columns').withIndex('by_quiz_id_and_position', (cvx) => cvx.eq('quiz_id', open.quiz_id)).take(1)
      const held = present(first)
      await stampingWriter(ctx.db, Later).patch('columns', held._id, { width_px: 99 })
      return await ctx.db.get('columns', held._id)
    })
    expect(column).to.deep.include({ width_px: 99 }).and.not.to.have.property('updated_at')
  })

  it("reads as the database it wraps", async () => {
    const { tt, question_id } = await seeded()
    const label = await tt.run(async (ctx) => {
      const question = await stampingWriter(ctx.db, Later).get('questions', question_id)
      return question?.label
    })
    expect(label).to.be.a('string')
  })
})

describe("a mutation's database", () => {
  it("stamps a question made with the moment of the mutation, made and last edited alike", async () => {
    const { tt, act, read } = await seeded()
    vi.setSystemTime(Later)
    await act({ kind: 'add_question' })
    const added = present(openOf(await read()).questions.at(-1))
    expect(await stampsOf(tt, added._id as Id<'questions'>)).to.deep.eq({ created_at: Later, updated_at: Later })
  })

  it("moves an edited question's updated_at to the moment of the edit, and its alone", async () => {
    const { tt, act, read, question_id } = await seeded()
    const other = present(openOf(await read()).questions[1])._id as Id<'questions'>
    vi.setSystemTime(Later)
    await act({ kind: 'edit_question', question_id, patch: { clueing: 'Who?' } })
    vi.setSystemTime(Latest)
    await act({ kind: 'edit_question', question_id, patch: { clueing: 'Who?' } })
    expect(await stampsOf(tt, question_id)).to.deep.eq({ created_at: Early, updated_at: Later })
    expect(await stampsOf(tt, other)).to.deep.eq({ created_at: Early, updated_at: Early })
  })
})
