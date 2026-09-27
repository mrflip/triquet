import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as Z from 'zod'
import type { Db } from 'jazz-tools'
import type { PolicyTestApp } from 'jazz-tools/testing'
import { app } from '../../src/db/schema'
import { LocalFirst, loadQuizRows, loadWorkspace, loadWorkspaceRows, type QuizRows } from '../../src/state/quiz-rows'
import {
  changedFields, deleteQuiz, bottingFieldsOf, repositioned, transact, updateQuestion, updateQuiz, writeQuiz, writeWorkspace,
} from '../../src/state/quiz-writing'
import { Expression } from '../../src/models/expression'
import type { BottingT } from '../../src/models/botting'
import { Question } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { Workspace, type WorkspaceT } from '../../src/models/workspace'
import { present } from '../support/present'
import { freshDb, openTestApp } from '../support/jazz'

/** A fresh account's database holding `workspace`, and ways to read back its first quiz */
async function holding(testApp: PolicyTestApp, workspace: WorkspaceT) {
  const db = freshDb(testApp)
  const workspace_id = present(await transact(db, (tx) => writeWorkspace(tx, workspace, null)))
  const { quizzes } = present(await loadWorkspaceRows(db, workspace_id))
  const quiz_id = present(quizzes[0]).id
  /** The first quiz's rows */
  const rows = async (): Promise<QuizRows> => present(await loadQuizRows(db, quiz_id))
  /** The first quiz, as its rows make it up */
  const quiz = async (): Promise<QuizT> => {
    const tree = present(await loadWorkspace(db, workspace_id))
    return present(tree.quizzes.find((each) => each.id === quiz_id))
  }
  return { db, workspace_id, quiz_id, rows, quiz }
}

/** A workspace of one quiz whose questions are titled `titles` */
function titled(...titles: string[]): WorkspaceT {
  const quiz = { ...Quiz.blank('Princes'), questions: titles.map((title) => ({ ...Question.blank(), title })) }
  return Workspace.fill({ quizzes: [quiz], active_quiz_id: quiz.id })
}

/** Dumdum's guess, made now */
function guessed(text: string) {
  return { status: 'done' as const, text, truncated: false, updated_at: Date.now(), last_err: null }
}

/** Let some milliseconds pass */
async function pause(millis: number): Promise<void> {
  await new Promise((resolve) => { setTimeout(resolve, millis) })
}

/** How many rows `db` holds of each table below the workspace */
async function heldCounts(db: Db): Promise<number[]> {
  const counts = [
    await db.all(app.quizzes, LocalFirst),
    await db.all(app.questions, LocalFirst),
    await db.all(app.widgets, LocalFirst),
    await db.all(app.columns, LocalFirst),
    await db.all(app.bottings, LocalFirst),
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
      const workspace_id = await transact(db, (tx) => tx.insert(app.workspaces, { active_quiz_id: null }).id)
      expect(await db.all(app.workspaces, LocalFirst)).to.have.length(1)
      expect(workspace_id).to.be.a('string')
    })

    it('commits nothing, and hands back null, when nothing was written', async () => {
      const { db, rows } = await holding(testApp, titled('aa'))
      const { quiz } = await rows()
      expect(await transact(db, (tx) => { updateQuiz(tx, quiz, { title: quiz.title }) })).to.eq(null)
    })

    it('keeps none of it when the writing throws', async () => {
      const db = freshDb(testApp)
      await expect(transact(db, (tx) => {
        tx.insert(app.workspaces, { active_quiz_id: null })
        throw new Error('changed my mind')
      })).rejects.toThrow('changed my mind')
      expect(await db.all(app.workspaces, LocalFirst)).to.deep.eq([])
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
      const db = freshDb(testApp)
      const workspace_id = present(await transact(db, (tx) => tx.insert(app.workspaces, { active_quiz_id: null }).id))
      const quiz_id = present(await transact(db, (tx) => writeQuiz(tx, workspace_id, Quiz.blank('Princes'), null)))
      const rows = present(await loadQuizRows(db, quiz_id))
      expect([rows.quiz.title, rows.questions.length]).to.deep.eq(['Princes', 5])
    })

    it('revises the questions it holds by id, adds the new ones, and deletes the missing ones with their replies', async () => {
      const guess = guessed('Leon')
      const quiz = { ...Quiz.blank('Princes'), questions: ['aa', 'bb'].map((title) => ({ ...Question.blank(), title, clueing: 'Who?', guess })) }
      const held = await holding(testApp, Workspace.fill({ quizzes: [quiz], active_quiz_id: quiz.id }))
      const [before, tree] = [await held.rows(), await held.quiz()]
      const first = present(tree.questions[0])
      const revised = { ...tree, questions: [{ ...Question.blank(), title: 'new' }, { ...first, title: 'AA' }] }
      await transact(held.db, (tx) => writeQuiz(tx, held.workspace_id, revised, before))
      const after = await held.rows()
      expect(after.questions.map((row) => [row.title, row.position])).to.deep.eq([['new', 0], ['AA', 1]])
      expect(after.questions[1]?.id).to.eq(first.id)
      expect(after.bottings.map((row) => row.question_id)).to.deep.eq([first.id])
    })

    it('writes a chain as the label of the question it names', async () => {
      const [first, second] = ['aa', 'bb'].map((label) => ({ ...Question.blank(), label }))
      const quiz = { ...Quiz.blank(), questions: [{ ...present(first), chains_to: present(second).id }, present(second)] }
      const { rows } = await holding(testApp, Workspace.fill({ quizzes: [quiz], active_quiz_id: quiz.id }))
      const { questions } = await rows()
      expect(questions.map((row) => row.chains_to)).to.deep.eq(['bb', null])
    })

    it('matches widgets and columns by label, in the order given', async () => {
      const held = await holding(testApp, Workspace.blank())
      const [before, tree] = [await held.rows(), await held.quiz()]
      const revised = { ...tree, widgets: tree.widgets.slice(1).toReversed(), columns: [...tree.columns.slice(1), present(tree.columns[0])] }
      await transact(held.db, (tx) => writeQuiz(tx, held.workspace_id, revised, before))
      const after = await held.rows()
      expect(after.widgets.map((row) => row.label)).to.deep.eq(revised.widgets.map((widget) => widget.label))
      expect(after.columns.map((row) => row.label)).to.deep.eq(revised.columns.map((column) => column.label))
    })

    it('records a reply the quiz shows only when it is newer than the newest recorded', async () => {
      const quiz = { ...Quiz.blank(), questions: [{ ...Question.blank(), clueing: 'Who?', guess: guessed('Leon') }] }
      const held = await holding(testApp, Workspace.fill({ quizzes: [quiz], active_quiz_id: quiz.id }))
      // Let Jazz stamp the recorded reply: one it has not stamped yet counts as asked just now.
      await pause(200)
      const [before, tree] = [await held.rows(), await held.quiz()]
      const older = { ...tree, questions: tree.questions.map((question) => ({ ...question, guess: { ...guessed('Lyon'), updated_at: 1 } })) }
      await transact(held.db, (tx) => writeQuiz(tx, held.workspace_id, older, before))
      const newer = { ...tree, questions: tree.questions.map((question) => ({ ...question, guess: guessed('Lyon') })) }
      await transact(held.db, (tx) => writeQuiz(tx, held.workspace_id, newer, before))
      const { bottings } = await held.rows()
      expect(bottings.map((row) => row.reply_text)).to.have.members(['Leon', 'Lyon'])
    })

    it('records nothing again when a quiz is written back as it was read', async () => {
      const quiz = { ...Quiz.blank(), questions: [{ ...Question.blank(), clueing: 'Who?', guess: guessed('Leon') }] }
      const held = await holding(testApp, Workspace.fill({ quizzes: [quiz], active_quiz_id: quiz.id }))
      const [before, tree] = [await held.rows(), await held.quiz()]
      expect(await transact(held.db, (tx) => writeQuiz(tx, held.workspace_id, tree, before))).to.eq(null)
    })
  })

  describe('deleteQuiz', () => {
    it('deletes the quiz and every row that hangs from it', async () => {
      const blank = Workspace.blank()
      const quiz = { ...present(blank.quizzes[0]), questions: [{ ...Question.blank(), clueing: 'Who?', guess: guessed('Leon') }] }
      const { db, rows } = await holding(testApp, { ...blank, quizzes: [quiz], active_quiz_id: quiz.id })
      const held = await rows()
      await transact(db, (tx) => { deleteQuiz(tx, held) })
      expect(await heldCounts(db)).to.deep.eq([0, 0, 0, 0, 0])
    })
  })

  describe('writeWorkspace', () => {
    it('writes a new workspace whole, with the open quiz open', async () => {
      const workspace = Workspace.blank()
      const { db, workspace_id } = await holding(testApp, workspace)
      const back = present(await loadWorkspace(db, workspace_id))
      expect([back.quizzes.length, back.expressions.length, back.active_quiz_id]).to.deep.eq([1, workspace.expressions.length, back.quizzes[0]?.id])
    })

    it('revises one it holds: expressions by owner and label, quizzes by id, and the open quiz', async () => {
      const quizzes = ['one', 'two'].map((title) => Quiz.blank(title))
      const expressions = [Expression.fill({ label: 'gone', formula: '1' }), Expression.fill({ label: 'kept', formula: '2' })]
      const { db, workspace_id } = await holding(testApp, Workspace.fill({ quizzes, active_quiz_id: present(quizzes[0]).id, expressions }))
      const ante = present(await loadWorkspace(db, workspace_id))
      const one = present(ante.quizzes[0])
      const three = Quiz.blank('three')
      const revised = {
        ...ante,
        quizzes:        [{ ...one, title: 'uno' }, three],
        active_quiz_id: three.id,
        expressions:    [Expression.fill({ label: 'kept', formula: '22' }), Expression.fill({ label: 'added', formula: '3' })],
      }
      const rows = present(await loadWorkspaceRows(db, workspace_id))
      const quizRows = await Promise.all(rows.quizzes.map(async (quiz) => present(await loadQuizRows(db, quiz.id))))
      await transact(db, (tx) => writeWorkspace(tx, revised, { rows, quizzes: quizRows }))
      const after = present(await loadWorkspace(db, workspace_id))
      expect(after.quizzes.map((quiz) => quiz.title)).to.deep.eq(['uno', 'three'])
      expect(after.quizzes[0]?.id).to.eq(one.id)
      expect(after.quizzes.find((quiz) => quiz.id === after.active_quiz_id)?.title).to.eq('three')
      expect(after.expressions.map((expression) => [expression.label, expression.formula])).to.deep.eq([['kept', '22'], ['added', '3']])
      expect(await heldCounts(db)).to.deep.eq([2, 10, 0, 0, 0])
    })

    it('refuses a workspace holding a row that is not valid, and keeps none of it', async () => {
      const db = freshDb(testApp)
      const bad = { ...Workspace.blank(), expressions: [{ owner: 'tq' as const, label: 'Not A Label', formula: '1', description: '' }] }
      await expect(transact(db, (tx) => writeWorkspace(tx, bad, null))).rejects.toThrow(Z.ZodError)
      expect(await db.all(app.workspaces, LocalFirst)).to.deep.eq([])
    })
  })
})
