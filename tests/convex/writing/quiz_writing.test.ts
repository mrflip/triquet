import { describe, expect, it } from 'vitest'
import type { Id } from '../../../convex/_generated/dataModel'
import { quizRowsOf, realmsOf, reviewsOf } from '../../../convex/reading'
import {
  changedFields, deleteQuiz, insertHunt, insertQuiz, repositioned, updateQuestion, updateQuiz, updateReview,
} from '../../../convex/writing/quiz_writing'
import type { QuizRows } from '../../../src/lib/rows'
import { SeedExpressions } from '../../../src/models/expression'
import { Hunt, type HuntT } from '../../../src/models/hunt'
import { Question } from '../../../src/models/question'
import { BlankQuestionQty, Quiz } from '../../../src/models/quiz'
import { present } from '../../support/present'
import { huntHolding, identified, openTester, wholeHunt, type Tester } from '../../support/convex'
import { seedHuntRows } from '../../support/seed'

/** A fresh deployment holding `hunt`, and ways to read back its first quiz */
async function holding(hunt: HuntT) {
  const tt = openTester()
  const hunt_id = await tt.run(async (ctx) => await seedHuntRows(ctx.db, hunt))
  const [home] = await tt.run(async (ctx) => await realmsOf(ctx.db, hunt_id))
  const realm_id = present(home).realm._id
  const quiz_id = present(present(home).quizzes[0])._id
  /** Run `write` against the first quiz's rows as they stand, in one mutation */
  const revise = async (write: (db: Parameters<Parameters<Tester['run']>[0]>[0]['db'], rows: QuizRows) => Promise<unknown>) => {
    await tt.run(async (ctx) => { await write(ctx.db, present(await quizRowsOf(ctx.db, quiz_id))) })
  }
  /** The first quiz's rows, as plain values: its row, its questions, widgets and columns, and each cell's newest bottings */
  const rows = async () => await tt.run(async (ctx) => {
    const held = present(await quizRowsOf(ctx.db, quiz_id))
    return { quiz: held.quiz, questions: held.questions, widgets: held.widgets, columns: held.columns, slots: held.slots.values().toArray() }
  })
  return { tt, hunt_id, realm_id, quiz_id, revise, rows }
}

/** A hunt of one quiz whose questions are titled `titles` */
function titled(...titles: string[]): HuntT {
  return huntHolding([{ ...Quiz.blank('Princes'), questions: titles.map((title) => ({ ...Question.blank(), title })) }])
}

/** How many rows `tt` holds of the quiz `quiz_id` and of each table below it */
async function heldCounts(tt: Tester, quiz_id: Id<'quizzes'>): Promise<number[]> {
  return await tt.run(async (ctx) => {
    const quiz = await ctx.db.get('quizzes', quiz_id)
    const byQuiz = async (tablename: 'widgets' | 'columns') => await ctx.db.query(tablename).withIndex('by_quiz_id_and_position', (cvx) => cvx.eq('quiz_id', quiz_id)).collect()
    const [questions, widgets, columns] = await Promise.all([
      ctx.db.query('questions').withIndex('by_quiz_id', (cvx) => cvx.eq('quiz_id', quiz_id)).collect(), byQuiz('widgets'), byQuiz('columns'),
    ])
    const bottings = await ctx.db.query('bottings').collect()
    const reviews = await reviewsOf(ctx.db, quiz_id)
    return [quiz ? 1 : 0, questions.length, widgets.length, columns.length, bottings.length, reviews.length]
  })
}

/** The quiz `quiz_id` as its rows make it up: how many questions, widgets and columns, and its questions' order */
async function shapeOf(tt: Tester, quiz_id: Id<'quizzes'>) {
  return await tt.run(async (ctx) => {
    const held = present(await quizRowsOf(ctx.db, quiz_id))
    return { counts: [held.questions.length, held.widgets.length, held.columns.length], ordered: held.quiz.row_ordering, questions: held.questions.map((row) => row._id), title: held.quiz.title }
  })
}

describe('changedFields', () => {
  it('keeps only the fields that differ, comparing structured values by what they hold', () => {
    const held = { title: 'Princes', locked: false, run: { approx_tokens: 1 } }
    expect(changedFields(held, { title: 'Princes', locked: true, run: { approx_tokens: 1 } })).to.deep.eq({ locked: true })
    expect(changedFields(held, { run: { approx_tokens: 2 } })).to.deep.eq({ run: { approx_tokens: 2 } })
    expect(changedFields(held, {})).to.deep.eq({})
  })
})

describe('repositioned', () => {
  it('hands over only the rows whose position is not their place in the list', async () => {
    const moved: [string, number][] = []
    await repositioned([{ label: 'cc', position: 2 }, { label: 'aa', position: 0 }, { label: 'bb', position: 1 }], (row, position) => {
      moved.push([row.label, position])
      return Promise.resolve()
    })
    expect(moved).to.deep.eq([['cc', 0], ['aa', 1], ['bb', 2]])
    const unmoved: string[] = []
    await repositioned([{ label: 'aa', position: 0 }], (row) => {
      unmoved.push(row.label)
      return Promise.resolve()
    })
    expect(unmoved).to.deep.eq([])
  })
})

describe('a mutation', () => {
  it('keeps none of what it wrote when it throws', async () => {
    const { tt, hunt_id, revise } = await holding(titled('aa'))
    const writing = revise(async (db, rows) => {
      await updateQuiz(db, rows.quiz, { title: 'Kings' })
      throw new Error('changed my mind')
    })
    await expect(writing).rejects.toThrow('changed my mind')
    expect(Hunt.quizzesOf(await wholeHunt(tt, hunt_id)).map((quiz) => quiz.title)).to.deep.eq(['Princes'])
  })
})

describe('the update helpers', () => {
  it('write the fields that change', async () => {
    const { revise, rows } = await holding(titled('aa'))
    await revise(async (db, held) => { await updateQuestion(db, present(held.questions[0]), { clueing: 'Who?' }) })
    const { questions } = await rows()
    expect(questions[0]?.clueing).to.eq('Who?')
  })

  it('hold the row as it would stand afterwards to its validator, and write nothing when it fails', async () => {
    const { revise, rows } = await holding(titled('aa'))
    await expect(revise(async (db, held) => { await updateQuiz(db, held.quiz, { title: 'x'.repeat(83) }) })).rejects.toThrow(/is too long/)
    const { quiz } = await rows()
    expect(quiz.title).to.eq('Princes')
  })

  it('updateReview writes the fields that change, and leaves the rest', async () => {
    const { tt, quiz_id } = await holding(titled('aa'))
    const { ident_id } = await identified(tt, 'alice_reviews')
    await tt.run(async (ctx) => {
      const review_id = await ctx.db.insert('reviews', { quiz_id, ident_id, overall: '', phase: 'empty' })
      await updateReview(ctx.db, present(await ctx.db.get('reviews', review_id)), { overall: 'Went well.', phase: 'draft' })
    })
    const [after] = await tt.run(async (ctx) => await reviewsOf(ctx.db, quiz_id))
    expect([after?.overall, after?.phase, after?.ident_id]).to.deep.eq(['Went well.', 'draft', ident_id])
  })
})

describe('insertQuiz', () => {
  it('writes a blank quiz: its row, its blank questions in its order, and the standard layout for the expressions', async () => {
    const { tt, realm_id } = await holding(titled('aa'))
    const quiz_id = await tt.run(async (ctx) => await insertQuiz(ctx.db, realm_id, 'Kings', 'kings', SeedExpressions))
    const shape = await shapeOf(tt, quiz_id)
    expect(shape.counts).to.deep.eq([BlankQuestionQty, 11, 21])
    expect(shape.ordered).to.deep.eq(shape.questions)
    expect(shape.title).to.eq('Kings')
  })

  it('titles a quiz from its label when the title is blank, and mints a label when none is given', async () => {
    const { tt, realm_id } = await holding(titled('aa'))
    const named = await tt.run(async (ctx) => await insertQuiz(ctx.db, realm_id, '', 'princes', []))
    const namedShape = await shapeOf(tt, named)
    expect(namedShape.title).to.eq('Princes')
    const minted = await tt.run(async (ctx) => await insertQuiz(ctx.db, realm_id, '', undefined, []))
    const quiz = await tt.run(async (ctx) => await ctx.db.get('quizzes', minted))
    const mintedShape = await shapeOf(tt, minted)
    expect(quiz?.label).to.match(/^[a-z][a-z0-9_]+$/)
    expect(mintedShape.counts).to.deep.eq([BlankQuestionQty, 3, 13])
  })
})

describe('deleteQuiz', () => {
  it('deletes the quiz and every row that hangs from it', async () => {
    const blank = Hunt.blank()
    const quiz = { ...present(Hunt.quizzesOf(blank)[0]), questions: [{ ...Question.blank(), clueing: 'Who?' }] }
    const { tt, quiz_id, revise } = await holding(huntHolding([quiz], blank.expressions))
    const { ident_id } = await identified(tt, 'alice_reviews')
    await tt.run(async (ctx) => {
      const [question] = present(await quizRowsOf(ctx.db, quiz_id)).questions
      await ctx.db.insert('bottings', {
        question_id: present(question)._id, bot_label: 'dumdum', textkind: 'clueing', asked_text: 'Who?', status: 'done', reply_text: 'Leon',
        items: [], message: null, response: null, truncated: false, model_tier_applied: 'quick', approx_tokens: null,
      })
      await ctx.db.insert('reviews', { quiz_id, ident_id, overall: '', phase: 'empty' })
    })
    expect(await heldCounts(tt, quiz_id)).to.deep.eq([1, 1, 11, 21, 1, 1])
    await revise(async (db, rows) => { await deleteQuiz(db, rows) })
    expect(await heldCounts(tt, quiz_id)).to.deep.eq([0, 0, 0, 0, 0, 0])
  })
})

describe('insertHunt', () => {
  it('writes a fresh hunt: its row titled from its label, the seed expressions, a home realm, and one blank quiz under the hunt\'s label', async () => {
    const tt = openTester()
    const hunt_id = await tt.run(async (ctx) => await insertHunt(ctx.db, 'loud_heron'))
    const back = await wholeHunt(tt, hunt_id)
    const [realm] = back.realms
    const [quiz] = present(realm).quizzes
    expect([back.label, back.title, present(realm).label, present(realm).title, back.expressions.length])
      .to.deep.eq(['loud_heron', 'Loud Heron', 'home', 'Home', SeedExpressions.length])
    expect([present(quiz).label, present(quiz).title, present(quiz).questions.length, present(quiz).widgets.length, present(quiz).columns.length])
      .to.deep.eq(['loud_heron', 'Loud Heron', BlankQuestionQty, 11, 21])
  })
})
