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

  /** One row in every hunt table, written by `db` and confirmed by the server */
  async function seedEverything(db: TestDb, label: string) {
    const hunt = db.insert(app.hunts, { label, forced_label: null, title: 'Plays' }).value
    const realm = db.insert(app.realms, { hunt_id: hunt.id, label: 'home', title: 'Home', position: 0 }).value
    const quiz = db.insert(app.quizzes, { realm_id: realm.id, title: 'Princes', label, version: 'main', locked: false }).value
    const question = db.insert(app.questions, {
      quiz_id: quiz.id, position: 0, label: 'hamlet', title: 'Hamlet', qnum: '', clueing: '', hint: '', full_answer: '', alt_text: '', notes: '',
    }).value
    const rows = {
      hunt,
      realm,
      quiz,
      question,
      expression: db.insert(app.expressions, { hunt_id: hunt.id, owner: 'tq', label: 'shout', formula: '1', description: '', position: 0 }).value,
      widget:     db.insert(app.widgets, { quiz_id: quiz.id, label: 'shout', kind: 'expressing', expression_label: 'shout', description: '', position: 0 }).value,
      column:     db.insert(app.columns, { quiz_id: quiz.id, label: 'shout', title: 'Shout', source: 'shout', width_px: 90, position: 0 }).value,
      botting:    db.insert(app.bottings, { question_id: question.id, bot_label: 'dumdum', textkind: 'clueing', status: 'done', reply_text: 'Hamlet', truncated: false }).value,
    }
    await db.update(app.quizzes, quiz.id, { title: 'Princes' }).wait({ tier: 'edge' })
    return rows
  }

  /** What `db` can read of every hunt table, by table, among the rows `seeded` wrote */
  async function seenBy(db: TestDb, seeded: Awaited<ReturnType<typeof seedEverything>>) {
    const counts = await Promise.all([
      db.all(app.hunts.where({ id: seeded.hunt.id })),
      db.all(app.realms.where({ id: seeded.realm.id })),
      db.all(app.quizzes.where({ id: seeded.quiz.id })),
      db.all(app.questions.where({ id: seeded.question.id })),
      db.all(app.expressions.where({ id: seeded.expression.id })),
      db.all(app.widgets.where({ id: seeded.widget.id })),
      db.all(app.columns.where({ id: seeded.column.id })),
      db.all(app.bottings.where({ id: seeded.botting.id })),
    ])
    const [hunts, realms, quizzes, questions, expressions, widgets, columns, bottings] = counts.map((rows) => rows.length)
    return { hunts, realms, quizzes, questions, expressions, widgets, columns, bottings }
  }

  const EveryRow = { hunts: 1, realms: 1, quizzes: 1, questions: 1, expressions: 1, widgets: 1, columns: 1, bottings: 1 }

  describe('the hunt tables, open to every account for the trial', () => {
    it('let an account read back every row it wrote', async () => {
      const seeded = await seedEverything(alice, 'alice_reads')
      expect(await seenBy(alice, seeded)).to.deep.eq(EveryRow)
    })

    it('let another account read every row of it too', async () => {
      const seeded = await seedEverything(alice, 'alice_shows')
      expect(await seenBy(bob, seeded)).to.deep.eq(EveryRow)
    })

    it('let another account change and delete its rows', async () => {
      const { quiz, question } = await seedEverything(alice, 'alice_shares')
      await bob.update(app.quizzes, quiz.id, { title: 'Kings' }).wait({ tier: 'edge' })
      await bob.delete(app.questions, question.id).wait({ tier: 'edge' })
      const [held] = await alice.all(app.quizzes.where({ id: quiz.id }))
      const questions = await alice.all(app.questions.where({ id: question.id }))
      expect([held?.title, questions.length]).to.deep.eq(['Kings', 0])
    })
  })

  describe('identings, each account\'s own', () => {
    it('are read back by the account that wrote them, from any identity of it', async () => {
      const account = '0192f1b0-0000-7000-8000-00000000a11c'
      const laptop = testApp.as(sessionFor('local-first key', account))
      const phone = testApp.as(sessionFor('signed in later', account))
      const ident = laptop.insert(app.idents, { label: 'linked_one', title: 'Linked' }).value
      const identing = laptop.insert(app.identings, { ident_id: ident.id }).value
      await laptop.update(app.identings, identing.id, { ident_id: ident.id }).wait({ tier: 'edge' })
      const seen = await phone.all(app.identings.where({ id: identing.id }))
      expect(seen.map((row) => row.ident_id)).to.deep.eq([ident.id])
    })

    it('are hidden from every other account', async () => {
      const ident = alice.insert(app.idents, { label: 'alice_hidden', title: 'Alice' }).value
      const identing = alice.insert(app.identings, { ident_id: ident.id }).value
      await alice.update(app.identings, identing.id, { ident_id: ident.id }).wait({ tier: 'edge' })
      expect(await bob.all(app.identings.where({ id: identing.id }))).to.deep.eq([])
    })

    it('cannot be changed by another account, which cannot see them', async () => {
      const ident = alice.insert(app.idents, { label: 'alice_guarded', title: 'Alice' }).value
      const identing = alice.insert(app.identings, { ident_id: ident.id }).value
      await alice.update(app.identings, identing.id, { ident_id: ident.id }).wait({ tier: 'edge' })
      expect(() => bob.update(app.identings, identing.id, { ident_id: ident.id })).to.throw(/read policy denied UPDATE/)
    })
  })

  describe('idents', () => {
    it('are made by anyone and seen by everyone', async () => {
      const ident = alice.insert(app.idents, { label: 'everyone_sees', title: 'Seen' }).value
      await alice.all(app.idents.where({ id: ident.id }), { tier: 'edge' })
      const seen = await bob.all(app.idents.where({ id: ident.id }))
      expect(seen.map((row) => row.title)).to.deep.eq(['Seen'])
    })

    it('are never changed, not even by the account that made them', async () => {
      const ident = alice.insert(app.idents, { label: 'never_changed', title: 'Kept' }).value
      await alice.all(app.idents.where({ id: ident.id }), { tier: 'edge' })
      await alice.expectDenied((db) => db.update(app.idents, ident.id, { title: 'Stolen' }))
      await bob.expectDenied((db) => db.update(app.idents, ident.id, { title: 'Stolen' }))
      const kept = await bob.all(app.idents.where({ id: ident.id }))
      expect(kept.map((row) => row.title)).to.deep.eq(['Kept'])
    })

    it('are never deleted, not even by the account that made them', async () => {
      const ident = alice.insert(app.idents, { label: 'never_removed', title: 'Kept' }).value
      await alice.all(app.idents.where({ id: ident.id }), { tier: 'edge' })
      await alice.expectDenied((db) => db.delete(app.idents, ident.id))
      const kept = await bob.all(app.idents.where({ id: ident.id }))
      expect(kept.map((row) => row.label)).to.deep.eq(['never_removed'])
    })
  })
})
