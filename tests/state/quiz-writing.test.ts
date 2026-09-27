import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as Z from 'zod'
import type { Db } from 'jazz-tools'
import type { PolicyTestApp } from 'jazz-tools/testing'
import { app } from '../../src/db/schema'
import { LocalFirst, huntRowsOf, loadHeldRows, loadHunt, loadQuizRows, type QuizRows } from '../../src/state/quiz-rows'
import {
  changedFields, deleteQuiz, bottingFieldsOf, repositioned, transact, updateQuestion, updateQuiz, writeHunt, writeQuiz,
} from '../../src/state/quiz-writing'
import type { BottingT } from '../../src/models/botting'
import { Hunt, type HuntT } from '../../src/models/hunt'
import { Question } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { present } from '../support/present'
import { freshDb, huntHolding, openTestApp } from '../support/jazz'

/** A fresh account's database holding `hunt`, and ways to read back its first quiz */
async function holding(testApp: PolicyTestApp, hunt: HuntT) {
  const db = freshDb(testApp)
  const hunt_id = present(await transact(db, (tx) => writeHunt(tx, hunt)))
  const { realms, quizzes } = present(huntRowsOf(await loadHeldRows(db, hunt_id), hunt_id))
  const realm_id = present(realms[0]).id
  const quiz_id = present(quizzes[0]).id
  /** The first quiz's rows */
  const rows = async (): Promise<QuizRows> => present(await loadQuizRows(db, quiz_id))
  /** The first quiz, as its rows make it up */
  const quiz = async (): Promise<QuizT> => {
    const tree = present(await loadHunt(db, hunt_id))
    return present(Hunt.quizzesOf(tree).find((each) => each.id === quiz_id))
  }
  return { db, hunt_id, realm_id, quiz_id, rows, quiz }
}

/** A hunt of one quiz whose questions are titled `titles` */
function titled(...titles: string[]): HuntT {
  return huntHolding([{ ...Quiz.blank('Princes'), questions: titles.map((title) => ({ ...Question.blank(), title })) }])
}

/** Dumdum's guess, made now */
function guessed(text: string) {
  return { status: 'done' as const, text, truncated: false, updated_at: Date.now(), last_err: null }
}

/** Let some milliseconds pass */
async function pause(millis: number): Promise<void> {
  await new Promise((resolve) => { setTimeout(resolve, millis) })
}

/** How many rows `db` holds of the quiz `quiz_id` and of each table below it */
async function heldCounts(db: Db, quiz_id: string, question_ids: readonly string[]): Promise<number[]> {
  const counts = [
    await db.all(app.quizzes.where({ id: quiz_id }), LocalFirst),
    await db.all(app.questions.where({ quiz_id }), LocalFirst),
    await db.all(app.widgets.where({ quiz_id }), LocalFirst),
    await db.all(app.columns.where({ quiz_id }), LocalFirst),
    await db.all(app.bottings.where({ question_id: { in: [...question_ids] } }), LocalFirst),
  ]
  return counts.map((rows) => rows.length)
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
  it('hands over only the rows whose position is not their place in the list', () => {
    const moved: [string, number][] = []
    repositioned([{ label: 'cc', position: 2 }, { label: 'aa', position: 0 }, { label: 'bb', position: 1 }], (row, position) => { moved.push([row.label, position]) })
    expect(moved).to.deep.eq([['cc', 0], ['aa', 1], ['bb', 2]])
    const unmoved: string[] = []
    repositioned([{ label: 'aa', position: 0 }], (row) => { unmoved.push(row.label) })
    expect(unmoved).to.deep.eq([])
  })
})

describe('bottingFieldsOf', () => {
  it('drops the tree\'s id and time, which are the row\'s own', () => {
    const botting = {
      id: 'x', question_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f9', bot_label: 'dumdum', textkind: 'clueing', asked_text: 'Who?', status: 'done',
      reply_text: 'Leon', items: [], message: null, response: null, truncated: false, model_tier_applied: null, approx_tokens: null, created_at: 9,
    } satisfies BottingT
    expect(bottingFieldsOf(botting)).to.deep.eq({
      question_id: botting.question_id, bot_label: 'dumdum', textkind: 'clueing', asked_text: 'Who?', status: 'done',
      reply_text: 'Leon', items: [], message: null, response: null, truncated: false, model_tier_applied: null, approx_tokens: null,
    })
  })
})

describe('writing rows', () => {
  let testApp: PolicyTestApp
  beforeAll(async () => { testApp = await openTestApp() })
  afterAll(async () => { await testApp.shutdown() })

  describe('transact', () => {
    it('commits what it writes, and hands back what the writing returned', async () => {
      const db = freshDb(testApp)
      const label = `written_${freshTail()}`
      const hunt_id = await transact(db, (tx) => tx.insert(app.hunts, { label, forced_label: null, title: 'Written' }).id)
      expect(await db.all(app.hunts.where({ label }), LocalFirst)).to.have.length(1)
      expect(hunt_id).to.be.a('string')
    })

    it('commits nothing, and hands back null, when nothing was written', async () => {
      const { db, rows } = await holding(testApp, titled('aa'))
      const { quiz } = await rows()
      expect(await transact(db, (tx) => { updateQuiz(tx, quiz, { title: quiz.title }) })).to.eq(null)
    })

    it('keeps none of it when the writing throws', async () => {
      const db = freshDb(testApp)
      const label = `unwritten_${freshTail()}`
      await expect(transact(db, (tx) => {
        tx.insert(app.hunts, { label, forced_label: null, title: 'Unwritten' })
        throw new Error('changed my mind')
      })).rejects.toThrow('changed my mind')
      expect(await db.all(app.hunts.where({ label }), LocalFirst)).to.deep.eq([])
    })
  })

  describe('the update helpers', () => {
    it('write the fields that change', async () => {
      const { db, rows } = await holding(testApp, titled('aa'))
      const { questions: before } = await rows()
      await transact(db, (tx) => { updateQuestion(tx, present(before[0]), { clueing: 'Who?' }) })
      const { questions: after } = await rows()
      expect(after[0]?.clueing).to.eq('Who?')
    })

    it('hold the row as it would stand afterwards to its validator, and write nothing when it fails', async () => {
      const { db, rows } = await holding(testApp, titled('aa'))
      const { quiz } = await rows()
      await expect(transact(db, (tx) => { updateQuiz(tx, quiz, { title: 'x'.repeat(83) }) })).rejects.toThrow(Z.ZodError)
      const { quiz: after } = await rows()
      expect(after.title).to.eq('Princes')
    })
  })

  describe('writeQuiz', () => {
    it('writes a new quiz whole, and hands back its row id', async () => {
      const { db, realm_id } = await holding(testApp, titled('aa'))
      const quiz_id = present(await transact(db, (tx) => writeQuiz(tx, realm_id, Quiz.blank('Princes'), null)))
      const rows = present(await loadQuizRows(db, quiz_id))
      expect([rows.quiz.title, rows.questions.length]).to.deep.eq(['Princes', 5])
    })

    it('revises the questions it holds by id, adds the new ones, and deletes the missing ones with their replies', async () => {
      const guess = guessed('Leon')
      const quiz = { ...Quiz.blank('Princes'), questions: ['aa', 'bb'].map((title) => ({ ...Question.blank(), title, clueing: 'Who?', guess })) }
      const held = await holding(testApp, huntHolding([quiz]))
      const [before, tree] = [await held.rows(), await held.quiz()]
      const first = present(tree.questions[0])
      const revised = { ...tree, questions: [{ ...Question.blank(), title: 'new' }, { ...first, title: 'AA' }] }
      await transact(held.db, (tx) => writeQuiz(tx, held.realm_id, revised, before))
      const after = await held.rows()
      expect(after.questions.map((row) => [row.title, row.position])).to.deep.eq([['new', 0], ['AA', 1]])
      expect(after.questions[1]?.id).to.eq(first.id)
      expect(after.bottings.map((row) => row.question_id)).to.deep.eq([first.id])
    })

    it('writes a chain as the label of the question it names', async () => {
      const [first, second] = ['aa', 'bb'].map((label) => ({ ...Question.blank(), label }))
      const quiz = { ...Quiz.blank(), questions: [{ ...present(first), chains_to: present(second).id }, present(second)] }
      const { rows } = await holding(testApp, huntHolding([quiz]))
      const { questions } = await rows()
      expect(questions.map((row) => row.chains_to)).to.deep.eq(['bb', null])
    })

    it('matches widgets and columns by label, in the order given', async () => {
      const held = await holding(testApp, Hunt.blank())
      const [before, tree] = [await held.rows(), await held.quiz()]
      const revised = { ...tree, widgets: tree.widgets.slice(1).toReversed(), columns: [...tree.columns.slice(1), present(tree.columns[0])] }
      await transact(held.db, (tx) => writeQuiz(tx, held.realm_id, revised, before))
      const after = await held.rows()
      expect(after.widgets.map((row) => row.label)).to.deep.eq(revised.widgets.map((widget) => widget.label))
      expect(after.columns.map((row) => row.label)).to.deep.eq(revised.columns.map((column) => column.label))
    })

    it('records a reply the quiz shows only when it is newer than the newest recorded', async () => {
      const quiz = { ...Quiz.blank(), questions: [{ ...Question.blank(), clueing: 'Who?', guess: guessed('Leon') }] }
      const held = await holding(testApp, huntHolding([quiz]))
      // Let Jazz stamp the recorded reply: one it has not stamped yet counts as asked just now.
      await pause(200)
      const [before, tree] = [await held.rows(), await held.quiz()]
      const older = { ...tree, questions: tree.questions.map((question) => ({ ...question, guess: { ...guessed('Lyon'), updated_at: 1 } })) }
      await transact(held.db, (tx) => writeQuiz(tx, held.realm_id, older, before))
      const newer = { ...tree, questions: tree.questions.map((question) => ({ ...question, guess: guessed('Lyon') })) }
      await transact(held.db, (tx) => writeQuiz(tx, held.realm_id, newer, before))
      const { bottings } = await held.rows()
      expect(bottings.map((row) => row.reply_text)).to.have.members(['Leon', 'Lyon'])
    })

    it('records nothing again when a quiz is written back as it was read', async () => {
      const quiz = { ...Quiz.blank(), questions: [{ ...Question.blank(), clueing: 'Who?', guess: guessed('Leon') }] }
      const held = await holding(testApp, huntHolding([quiz]))
      const [before, tree] = [await held.rows(), await held.quiz()]
      expect(await transact(held.db, (tx) => writeQuiz(tx, held.realm_id, tree, before))).to.eq(null)
    })
  })

  describe('deleteQuiz', () => {
    it('deletes the quiz and every row that hangs from it', async () => {
      const blank = Hunt.blank()
      const quiz = { ...present(Hunt.quizzesOf(blank)[0]), questions: [{ ...Question.blank(), clueing: 'Who?', guess: guessed('Leon') }] }
      const { db, rows, quiz_id } = await holding(testApp, huntHolding([quiz], blank.expressions))
      const held = await rows()
      const question_ids = held.questions.map((row) => row.id)
      expect(await heldCounts(db, quiz_id, question_ids)).to.deep.eq([1, 1, 11, 21, 1])
      await transact(db, (tx) => { deleteQuiz(tx, held) })
      expect(await heldCounts(db, quiz_id, question_ids)).to.deep.eq([0, 0, 0, 0, 0])
    })
  })

  describe('writeHunt', () => {
    it('writes a new hunt whole: its realms, their quizzes, and its expressions', async () => {
      const hunt = Hunt.blank()
      const { db, hunt_id } = await holding(testApp, hunt)
      const back = present(await loadHunt(db, hunt_id))
      expect([back.label, back.realms.map((realm) => realm.label), Hunt.quizzesOf(back).length, back.expressions.length])
        .to.deep.eq([hunt.label, ['home'], 1, hunt.expressions.length])
    })

    it('refuses a hunt holding a row that is not valid, and keeps none of it', async () => {
      const db = freshDb(testApp)
      const blank = Hunt.blank()
      const bad = { ...blank, expressions: [{ owner: 'tq' as const, label: 'Not A Label', formula: '1', description: '' }] }
      await expect(transact(db, (tx) => writeHunt(tx, bad))).rejects.toThrow(Z.ZodError)
      expect(await db.all(app.hunts.where({ label: blank.label }), LocalFirst)).to.deep.eq([])
    })
  })
})

/** A random tail for a label no other test uses */
function freshTail(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(-8)
}
