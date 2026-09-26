import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from 'jazz-tools'
import type { PolicyTestApp } from 'jazz-tools/testing'
import { app } from '../../src/db/schema'
import { askedAt, expressionFrom, LocalFirst, loadQuizRows, loadWorkspace, loadWorkspaceRows, quizFrom, type QuizRows } from '../../src/state/quiz-rows'
import { transact, writeWorkspace } from '../../src/state/quiz-writing'
import { SeedExpressions } from '../../src/models/expression'
import { Question } from '../../src/models/question'
import { Quiz } from '../../src/models/quiz'
import { Workspace, type WorkspaceT } from '../../src/models/workspace'
import { present } from '../support/present'
import { freshDb, openTestApp } from '../support/jazz'

/** A fresh account's database, holding `workspace`, and its first quiz's id */
async function holding(testApp: PolicyTestApp, workspace: WorkspaceT): Promise<{ db: Db, workspace_id: string, quiz_id: string }> {
  const db = freshDb(testApp)
  const workspace_id = present(await transact(db, (tx) => writeWorkspace(tx, workspace, null)))
  const rows = present(await loadWorkspaceRows(db, workspace_id))
  return { db, workspace_id, quiz_id: present(rows.quizzes[0]).id }
}

/** One quiz's rows, which must be there */
async function rowsOf(db: Db, quiz_id: string): Promise<QuizRows> {
  return present(await loadQuizRows(db, quiz_id))
}

/** One quiz's question rows, in order */
async function questionsOf(db: Db, quiz_id: string): Promise<QuizRows['questions']> {
  const { questions } = await rowsOf(db, quiz_id)
  return questions
}

/** `workspace` with every id blanked, for comparing a tree with the one its rows make up */
function sansIds(workspace: WorkspaceT) {
  return {
    ...workspace,
    active_quiz_id: '',
    quizzes:        workspace.quizzes.map((quiz) => ({ ...quiz, id: '', questions: quiz.questions.map((question) => ({ ...question, id: '' })) })),
  }
}

/** A workspace of one quiz, its questions labelled `aa`, `bb` and `cc` */
function threeQuestions(): WorkspaceT {
  const quiz = { ...Quiz.blank(), questions: ['aa', 'bb', 'cc'].map((label) => ({ ...Question.blank(), label, title: label.toUpperCase() })) }
  return Workspace.fill({ quizzes: [quiz], active_quiz_id: quiz.id })
}

/** Let a few milliseconds pass */
async function pause(millis: number): Promise<void> {
  await new Promise((resolve) => { setTimeout(resolve, millis) })
}

describe('reading rows', () => {
  let testApp: PolicyTestApp
  beforeAll(async () => { testApp = await openTestApp() })
  afterAll(async () => { await testApp.shutdown() })

  describe('loadWorkspace', () => {
    it('reads back a workspace exactly as it was written, apart from its ids', async () => {
      const workspace = Workspace.blank()
      const { db, workspace_id } = await holding(testApp, workspace)
      const back = present(await loadWorkspace(db, workspace_id))
      expect(sansIds(back)).to.deep.eq(sansIds(workspace))
    })

    it('keeps the quizzes in the order they were made, with the open one open', async () => {
      const quizzes = ['one', 'two', 'three'].map((title) => Quiz.blank(title))
      const { db, workspace_id } = await holding(testApp, Workspace.fill({ quizzes, active_quiz_id: present(quizzes[2]).id }))
      const back = present(await loadWorkspace(db, workspace_id))
      expect(back.quizzes.map((quiz) => quiz.title)).to.deep.eq(['one', 'two', 'three'])
      expect(back.quizzes.find((quiz) => quiz.id === back.active_quiz_id)?.title).to.eq('three')
    })

    it('reads null for a workspace this account does not hold', async () => {
      const { workspace_id } = await holding(testApp, Workspace.blank())
      const { db } = await holding(testApp, Workspace.blank())
      expect(await loadWorkspace(db, workspace_id)).to.eq(null)
    })
  })

  describe('loadWorkspaceRows', () => {
    it('reads the workspace\'s own row, its quizzes\' rows and its expressions in order', async () => {
      const { db, workspace_id } = await holding(testApp, Workspace.blank())
      const rows = present(await loadWorkspaceRows(db, workspace_id))
      expect(rows.quizzes).to.have.length(1)
      expect(rows.expressions.map((row) => row.label)).to.deep.eq(SeedExpressions.map((expression) => expression.label))
      expect(rows.workspace.active_quiz_id).to.eq(rows.quizzes[0]?.id)
    })
  })

  describe('loadQuizRows', () => {
    it('reads every row of one quiz, each list in its committed order', async () => {
      const quiz = { ...Quiz.blank('Princes'), questions: ['b', 'a', 'c'].map((title) => ({ ...Question.blank(), title })) }
      const { db, quiz_id } = await holding(testApp, Workspace.fill({ quizzes: [quiz], active_quiz_id: quiz.id }))
      const rows = await rowsOf(db, quiz_id)
      expect(rows.quiz.title).to.eq('Princes')
      expect(rows.questions.map((row) => [row.title, row.position])).to.deep.eq([['b', 0], ['a', 1], ['c', 2]])
      expect([rows.widgets, rows.columns, rows.playings]).to.deep.eq([[], [], []])
    })

    it('reads the playings of its questions, and when each was asked once Jazz has stamped it', async () => {
      const guess = { status: 'done' as const, text: 'Leon', truncated: false, updated_at: Date.now(), last_err: null }
      const quiz = { ...Quiz.blank(), questions: [{ ...Question.blank(), clueing: 'Who?', guess }] }
      const { db, quiz_id } = await holding(testApp, Workspace.fill({ quizzes: [quiz], active_quiz_id: quiz.id }))
      const { playings } = await rowsOf(db, quiz_id)
      expect(playings[0]).to.deep.include({ player_label: 'dumdum', textkind: 'clueing', reply_text: 'Leon', asked_text: 'Who?' })
      await pause(200)
      const { playings: stamped } = await rowsOf(db, quiz_id)
      expect(stamped[0]?.$createdAt).to.be.instanceOf(Date)
    })

    it('reads null for a quiz this account does not hold', async () => {
      const { db } = await holding(testApp, Workspace.blank())
      expect(await loadQuizRows(db, '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f9')).to.eq(null)
    })
  })

  describe('quizFrom', () => {
    it('names each question by its row\'s id', async () => {
      const { db, quiz_id } = await holding(testApp, threeQuestions())
      const rows = await rowsOf(db, quiz_id)
      expect(quizFrom(rows).questions.map((question) => question.id)).to.deep.eq(rows.questions.map((row) => row.id))
    })

    it('reads a chain held as a label as the id of the question answering to it', async () => {
      const { db, quiz_id } = await holding(testApp, threeQuestions())
      const [first, , third] = await questionsOf(db, quiz_id)
      await transact(db, (tx) => { tx.update(app.questions, present(first).id, { chains_to: 'cc' }) })
      const after = quizFrom(await rowsOf(db, quiz_id))
      expect(after.questions[0]?.chains_to).to.eq(present(third).id)
    })

    it('reads a chain by the label in force, an override included', async () => {
      const { db, quiz_id } = await holding(testApp, threeQuestions())
      const [first, second] = await questionsOf(db, quiz_id)
      await transact(db, (tx) => {
        tx.update(app.questions, present(second).id, { forced_label: 'bee' })
        tx.update(app.questions, present(first).id, { chains_to: 'bee' })
      })
      const after = quizFrom(await rowsOf(db, quiz_id))
      expect(after.questions[0]?.chains_to).to.eq(present(second).id)
    })

    it('reads a chain to no question here, or to itself, as no chain', async () => {
      const { db, quiz_id } = await holding(testApp, threeQuestions())
      const [first, second] = await questionsOf(db, quiz_id)
      await transact(db, (tx) => {
        tx.update(app.questions, present(first).id, { chains_to: 'nobody' })
        tx.update(app.questions, present(second).id, { chains_to: 'bb' })
      })
      const after = quizFrom(await rowsOf(db, quiz_id))
      expect(after.questions.map((question) => question.chains_to)).to.deep.eq([null, null, null])
    })

    it('shows each cell\'s newest reply, stale once its text is edited', async () => {
      const { db, quiz_id } = await holding(testApp, threeQuestions())
      const [question] = await questionsOf(db, quiz_id)
      const question_id = present(question).id
      const ask = async (reply_text: string) => {
        const items = [{ text: reply_text, value: 1, kind: 'numeral' as const }]
        await transact(db, (tx) => {
          tx.insert(app.playings, { question_id, player_label: 'numnum', textkind: 'clueing', asked_text: '', status: 'done', reply_text, truncated: false, items })
        })
      }
      await ask('older')
      await pause(3)
      await ask('newer')
      const fresh = quizFrom(await rowsOf(db, quiz_id))
      expect(fresh.questions[0]?.clueing_ishes).to.deep.include({ status: 'done', items: [{ text: 'newer', value: 1, kind: 'numeral' }], stale: false })
      await transact(db, (tx) => { tx.update(app.questions, question_id, { clueing: 'Reworded' }) })
      const edited = quizFrom(await rowsOf(db, quiz_id))
      expect(edited.questions[0]?.clueing_ishes).to.deep.include({ stale: true })
    })
  })

  describe('expressionFrom', () => {
    it('is the expression, without its row\'s place or workspace', async () => {
      const { db, workspace_id } = await holding(testApp, Workspace.blank())
      const [row] = await db.all(app.expressions.where({ workspace_id }).orderBy('position'), LocalFirst)
      expect(expressionFrom(present(row))).to.deep.eq(SeedExpressions[0])
    })
  })
})

describe('askedAt', () => {
  const playing = {
    id: '', question_id: '', player_label: 'dumdum', textkind: 'clueing', asked_text: null, status: 'done', reply_text: null,
    items: [], message: null, response: null, truncated: false, model_tier_applied: null, approx_tokens: null,
  } as const

  it('is when Jazz stamped the playing', () => {
    expect(askedAt({ ...playing, items: [], $createdAt: new Date(1_700_000_000_000) })).to.eq(1_700_000_000_000)
  })

  it('is now for one it has not stamped yet', () => {
    const before = Date.now()
    expect(askedAt({ ...playing, items: [] })).to.be.at.least(before)
  })
})
