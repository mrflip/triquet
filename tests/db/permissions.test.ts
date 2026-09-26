import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PolicyTestApp, TestDb } from 'jazz-tools/testing'
import { app } from '../../src/db/schema'
import { openTestApp, sessionFor } from '../support/jazz'

describe('permissions', () => {
  let testApp: PolicyTestApp
  let alice: TestDb
  let bob: TestDb
  beforeAll(async () => {
    testApp = await openTestApp()
    alice = testApp.as(sessionFor('alice'))
    bob = testApp.as(sessionFor('bob'))
  })
  afterAll(async () => { await testApp.shutdown() })

  /** One row in every table, written by `db` and confirmed by the server */
  async function seedEverything(db: TestDb, label: string) {
    const workspace = db.insert(app.workspaces, { active_quiz_id: null }).value
    const quiz = db.insert(app.quizzes, { workspace_id: workspace.id, title: 'Princes', label, version: 'main', locked: false }).value
    const question = db.insert(app.questions, {
      quiz_id: quiz.id, position: 0, label: 'hamlet', title: 'Hamlet', qnum: '', clueing: '', hint: '', full_answer: '', alt_text: '', notes: '',
    }).value
    const rows = {
      workspace,
      quiz,
      question,
      expression: db.insert(app.expressions, { workspace_id: workspace.id, owner: 'tq', label: 'shout', formula: '1', description: '', position: 0 }).value,
      widget:     db.insert(app.widgets, { quiz_id: quiz.id, label: 'shout', kind: 'expressing', expression_label: 'shout', description: '', position: 0 }).value,
      column:     db.insert(app.columns, { quiz_id: quiz.id, label: 'shout', title: 'Shout', source: 'shout', width_px: 90, position: 0 }).value,
      playing:    db.insert(app.playings, { question_id: question.id, player_label: 'dumdum', textkind: 'clueing', status: 'done', reply_text: 'Hamlet', truncated: false }).value,
    }
    await db.update(app.quizzes, quiz.id, { title: 'Princes' }).wait({ tier: 'edge' })
    return rows
  }

  it('lets an account read back every row it wrote', async () => {
    await seedEverything(alice, 'alice_reads')
    const quizzes = await alice.all(app.quizzes.where({ label: 'alice_reads' }).include({ questions: { playings: true }, widgets: true, columns: true }))
    expect(quizzes.map((quiz) => [quiz.questions.length, quiz.questions[0]?.playings.length, quiz.widgets.length, quiz.columns.length])).to.deep.eq([[1, 1, 1, 1]])
  })

  it('lets an account change and delete its own rows', async () => {
    const { quiz, question } = await seedEverything(alice, 'alice_edits')
    await alice.update(app.quizzes, quiz.id, { title: 'Kings' }).wait({ tier: 'edge' })
    await alice.delete(app.questions, question.id).wait({ tier: 'edge' })
    const [held] = await alice.all(app.quizzes.where({ label: 'alice_edits' }).include({ questions: true }))
    expect([held?.title, held?.questions.length]).to.deep.eq(['Kings', 0])
  })

  /** What `db` can read of every table, by table */
  async function everythingSeenBy(db: TestDb) {
    return {
      workspaces:  await db.all(app.workspaces),
      expressions: await db.all(app.expressions),
      quizzes:     await db.all(app.quizzes),
      widgets:     await db.all(app.widgets),
      columns:     await db.all(app.columns),
      questions:   await db.all(app.questions),
      playings:    await db.all(app.playings),
    }
  }

  it('hides every row of one account from another', async () => {
    await seedEverything(alice, 'alice_hidden')
    const seenByAlice = await everythingSeenBy(alice)
    expect(Object.values(seenByAlice).every((rows) => rows.length > 0)).to.eq(true)
    expect(await everythingSeenBy(bob)).to.deep.eq({ workspaces: [], expressions: [], quizzes: [], widgets: [], columns: [], questions: [], playings: [] })
  })

  it('refuses another account\'s change to a row it cannot see, before it leaves the browser', async () => {
    const { quiz } = await seedEverything(alice, 'alice_guarded')
    expect(() => bob.update(app.quizzes, quiz.id, { title: 'Stolen' })).to.throw(/read policy denied UPDATE/)
    const [held] = await alice.all(app.quizzes.where({ label: 'alice_guarded' }))
    expect(held?.title).to.eq('Princes')
  })

  it('lets another identity of the same account read and change everything the account made', async () => {
    const account = '0192f1b0-0000-7000-8000-00000000a11c'
    const laptop = testApp.as(sessionFor('local-first key', account))
    const phone = testApp.as(sessionFor('signed in later', account))
    const { quiz } = await seedEverything(laptop, 'linked_account')
    const [seen] = await phone.all(app.quizzes.where({ label: 'linked_account' }))
    expect(seen?.title).to.eq('Princes')
    await phone.update(app.quizzes, quiz.id, { title: 'Kings' }).wait({ tier: 'edge' })
    const [held] = await laptop.all(app.quizzes.where({ label: 'linked_account' }))
    expect(held?.title).to.eq('Kings')
  })

  it('refuses another account\'s delete', async () => {
    const { question } = await seedEverything(alice, 'alice_kept')
    await bob.expectDenied((db) => db.delete(app.questions, question.id))
    const kept = await alice.all(app.questions.where({ id: question.id }))
    expect(kept.map((each) => each.label)).to.deep.eq(['hamlet'])
  })
})
