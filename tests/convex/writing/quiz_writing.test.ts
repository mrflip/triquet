import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import type { Id } from '../../../convex/_generated/dataModel'
import { quizRowsOf, realmsOf, reviewsOf } from '../../../convex/reading'
import {
  bottingFieldsOf, changedFields, deleteQuiz, repositioned, updateQuestion, updateQuiz, updateReview, writeHunt, writeQuiz,
} from '../../../convex/writing/quiz_writing'
import type { QuizRows } from '../../../src/lib/rows'
import type { BottingT } from '../../../src/models/botting'
import { Hunt, type HuntT } from '../../../src/models/hunt'
import { Question } from '../../../src/models/question'
import { Quiz, type QuizT } from '../../../src/models/quiz'
import { present } from '../../support/present'
import { huntHolding, identified, openTester, wholeHunt, type Tester } from '../../support/convex'

/** A fresh deployment holding `hunt`, and ways to read back its first quiz */
async function holding(hunt: HuntT) {
  const tt = openTester()
  const hunt_id = await tt.run(async (ctx) => await writeHunt(ctx.db, hunt))
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
  /** The first quiz, as its rows make it up */
  const quiz = async (): Promise<QuizT> => present(Hunt.quizzesOf(await wholeHunt(tt, hunt_id)).find((each) => each._id === quiz_id))
  return { tt, hunt_id, realm_id, quiz_id, revise, rows, quiz }
}

/** A hunt of one quiz whose questions are titled `titles` */
function titled(...titles: string[]): HuntT {
  return huntHolding([{ ...Quiz.blank('Princes'), questions: titles.map((title) => ({ ...Question.blank(), title })) }])
}

/** Dumdum's guess, made now */
function guessed(text: string) {
  return { status: 'done' as const, text, truncated: false, updated_at: Date.now(), last_err: null }
}

/** Every botting in the deployment */
async function bottingsIn(tt: Tester) {
  return await tt.run(async (ctx) => await ctx.db.query('bottings').collect())
}

/** How many rows `tt` holds of the quiz `quiz_id` and of each table below it */
async function heldCounts(tt: Tester, quiz_id: Id<'quizzes'>): Promise<number[]> {
  return await tt.run(async (ctx) => {
    const quiz = await ctx.db.get('quizzes', quiz_id)
    const byQuiz = async (tablename: 'questions' | 'widgets' | 'columns') => await ctx.db.query(tablename).withIndex('by_quiz_id_and_position', (qq) => qq.eq('quiz_id', quiz_id)).collect()
    const [questions, widgets, columns] = await Promise.all([byQuiz('questions'), byQuiz('widgets'), byQuiz('columns')])
    const bottings = await ctx.db.query('bottings').collect()
    const reviews = await reviewsOf(ctx.db, quiz_id)
    return [quiz ? 1 : 0, questions.length, widgets.length, columns.length, bottings.length, reviews.length]
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

describe('bottingFieldsOf', () => {
  it('drops the tree\'s id and time, which are the row\'s own', () => {
    const botting = {
      id: 'x', question_id: 'j97d0qbj35dar1v8edndzckvsx8f828f', bot_label: 'dumdum', textkind: 'clueing', asked_text: 'Who?', status: 'done',
      reply_text: 'Leon', items: [], message: null, response: null, truncated: false, model_tier_applied: null, approx_tokens: null, created_at: 9,
    } satisfies BottingT
    expect(bottingFieldsOf(botting)).to.deep.eq({
      question_id: botting.question_id, bot_label: 'dumdum', textkind: 'clueing', asked_text: 'Who?', status: 'done',
      reply_text: 'Leon', items: [], message: null, response: null, truncated: false, model_tier_applied: null, approx_tokens: null,
    })
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

describe('writeQuiz', () => {
  it('writes a new quiz whole, and hands back its row id', async () => {
    const { tt, realm_id } = await holding(titled('aa'))
    const quiz_id = await tt.run(async (ctx) => await writeQuiz(ctx.db, realm_id, Quiz.blank('Princes'), null))
    const count = await tt.run(async (ctx) => present(await quizRowsOf(ctx.db, quiz_id)).questions.length)
    expect(count).to.eq(5)
  })

  it('revises the questions it holds by id, adds the new ones, and deletes the missing ones with their replies', async () => {
    const guess = guessed('Leon')
    const quiz = { ...Quiz.blank('Princes'), questions: ['aa', 'bb'].map((title) => ({ ...Question.blank(), title, clueing: 'Who?', guess })) }
    const held = await holding(huntHolding([quiz]))
    const tree = await held.quiz()
    const first = present(tree.questions[0])
    const revised = { ...tree, questions: [{ ...Question.blank(), title: 'new' }, { ...first, title: 'AA' }] }
    await held.revise(async (db, rows) => { await writeQuiz(db, held.realm_id, revised, rows) })
    const after = await held.rows()
    expect(after.questions.map((row) => [row.title, row.position])).to.deep.eq([['new', 0], ['AA', 1]])
    expect(after.questions[1]?._id).to.eq(first._id)
    const bottings = await bottingsIn(held.tt)
    expect(bottings.map((row) => row.question_id)).to.deep.eq([first._id])
  })

  it('writes a chain as the label of the question it names', async () => {
    const [first, second] = ['aa', 'bb'].map((label) => ({ ...Question.blank(), label }))
    const quiz = { ...Quiz.blank(), questions: [{ ...present(first), chains_to: present(second)._id }, present(second)] }
    const { rows } = await holding(huntHolding([quiz]))
    const { questions } = await rows()
    expect(questions.map((row) => row.chains_to)).to.deep.eq(['bb', null])
  })

  it('matches widgets and columns by label, in the order given', async () => {
    const held = await holding(Hunt.blank())
    const tree = await held.quiz()
    const revised = { ...tree, widgets: tree.widgets.slice(1).toReversed(), columns: [...tree.columns.slice(1), present(tree.columns[0])] }
    await held.revise(async (db, rows) => { await writeQuiz(db, held.realm_id, revised, rows) })
    const after = await held.rows()
    expect(after.widgets.map((row) => row.label)).to.deep.eq(revised.widgets.map((widget) => widget.label))
    expect(after.columns.map((row) => row.label)).to.deep.eq(revised.columns.map((column) => column.label))
  })

  it('records a reply the quiz shows only when it is newer than the newest recorded', async () => {
    const quiz = { ...Quiz.blank(), questions: [{ ...Question.blank(), clueing: 'Who?', guess: guessed('Leon') }] }
    const held = await holding(huntHolding([quiz]))
    const tree = await held.quiz()
    const older = { ...tree, questions: tree.questions.map((question) => ({ ...question, guess: { ...guessed('Lyon'), updated_at: 1 } })) }
    await held.revise(async (db, rows) => { await writeQuiz(db, held.realm_id, older, rows) })
    const newer = { ...tree, questions: tree.questions.map((question) => ({ ...question, guess: { ...guessed('Lyon'), updated_at: Date.now() + 60_000 } })) }
    await held.revise(async (db, rows) => { await writeQuiz(db, held.realm_id, newer, rows) })
    const bottings = await bottingsIn(held.tt)
    expect(bottings.map((row) => row.reply_text)).to.have.members(['Leon', 'Lyon'])
  })

  it('records nothing again, and changes nothing, when a quiz is written back as it was read', async () => {
    const quiz = { ...Quiz.blank(), questions: [{ ...Question.blank(), clueing: 'Who?', guess: guessed('Leon') }] }
    const held = await holding(huntHolding([quiz]))
    const [before, tree] = [await held.rows(), await held.quiz()]
    await held.revise(async (db, rows) => { await writeQuiz(db, held.realm_id, tree, rows) })
    expect(await bottingsIn(held.tt)).to.have.lengthOf(1)
    expect(await held.rows()).to.deep.eq(before)
  })
})

describe('deleteQuiz', () => {
  it('deletes the quiz and every row that hangs from it', async () => {
    const blank = Hunt.blank()
    const quiz = { ...present(Hunt.quizzesOf(blank)[0]), questions: [{ ...Question.blank(), clueing: 'Who?', guess: guessed('Leon') }] }
    const { tt, quiz_id, revise } = await holding(huntHolding([quiz], blank.expressions))
    const { ident_id } = await identified(tt, 'alice_reviews')
    await tt.run(async (ctx) => { await ctx.db.insert('reviews', { quiz_id, ident_id, overall: '', phase: 'empty' }) })
    expect(await heldCounts(tt, quiz_id)).to.deep.eq([1, 1, 11, 21, 1, 1])
    await revise(async (db, rows) => { await deleteQuiz(db, rows) })
    expect(await heldCounts(tt, quiz_id)).to.deep.eq([0, 0, 0, 0, 0, 0])
  })
})

describe('writeHunt', () => {
  it('writes a new hunt whole: its realms, their quizzes, and its expressions', async () => {
    const hunt = Hunt.blank()
    const { tt, hunt_id } = await holding(hunt)
    const back = await wholeHunt(tt, hunt_id)
    expect([back.label, back.realms.map((realm) => realm.label), Hunt.quizzesOf(back).length, back.expressions.length])
      .to.deep.eq([hunt.label, ['home'], 1, hunt.expressions.length])
  })

  it('refuses a hunt holding a row that is not valid, and keeps none of it', async () => {
    const tt = openTester()
    const blank = Hunt.blank()
    const bad = { ...blank, expressions: [{ owner: 'tq' as const, label: 'Not A Label', formula: '1', description: '' }] }
    await expect(tt.run(async (ctx) => await writeHunt(ctx.db, bad))).rejects.toThrow(Z.ZodError)
    expect(await tt.run(async (ctx) => await ctx.db.query('hunts').collect())).to.deep.eq([])
  })
})
