import * as Z from 'zod'
import _ from 'es-toolkit/compat'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { schema as JZS } from 'jazz-tools'
import { createPolicyTestApp, type PolicyTestApp, type TestDb } from 'jazz-tools/testing'
import { app } from '../../src/db/schema'
import { openTestApp, sessionFor } from '../support/jazz'

/** Everything but the row's id, which is Jazz's business and never asserted on */
function sansId<RT extends { id: string }>(row: RT): Omit<RT, 'id'> {
  return _.omit(row, ['id'])
}

describe('schema', () => {
  let testApp: PolicyTestApp
  let db: TestDb
  beforeAll(async () => {
    testApp = await openTestApp()
    db = testApp.as(sessionFor('alice'))
  })
  afterAll(async () => { await testApp.shutdown() })

  /** A hunt with one realm holding one quiz with one question, the parents every other row hangs from */
  function seedQuiz(label: string) {
    const hunt = db.insert(app.hunts, { label, forced_label: null, title: 'Plays' }).value
    const realm = db.insert(app.realms, { hunt_id: hunt.id, label: 'home', title: 'Home', position: 0 }).value
    const quiz = db.insert(app.quizzes, { realm_id: realm.id, title: 'Princes', label, version: 'main', locked: false }).value
    const question = db.insert(app.questions, {
      quiz_id: quiz.id, position: 0, label: 'hamlet', title: 'Hamlet', qnum: '1', clueing: 'Dane, melancholy', hint: '',
      full_answer: 'Hamlet', alt_text: '', notes: '',
    }).value
    return { hunt, realm, quiz, question }
  }

  describe('idents and identings', () => {
    it('round-trip, an identing reaching its ident by relation', async () => {
      const ident = db.insert(app.idents, { label: 'flip_kromer', title: 'Flip' }).value
      const identing = db.insert(app.identings, { ident_id: ident.id }).value
      const [held] = await db.all(app.identings.where({ id: identing.id }).include({ ident: true }))
      expect([held?.ident_id, held?.ident?.label, held?.ident?.title]).to.deep.eq([ident.id, 'flip_kromer', 'Flip'])
    })
  })

  describe('hunts and realms', () => {
    it('round-trip, a hunt reaching its realms and a realm its quizzes by relation', async () => {
      const { hunt, realm } = seedQuiz('ht_nested')
      const [heldHunt] = await db.all(app.hunts.where({ id: hunt.id }).include({ realms: true }))
      const [heldRealm] = await db.all(app.realms.where({ id: realm.id }).include({ quizzes: true }))
      expect(heldHunt && _.omit(heldHunt, ['id', 'realms'])).to.deep.eq({ label: 'ht_nested', forced_label: null, title: 'Plays' })
      expect(heldHunt?.realms.map((each) => [each.label, each.title, each.position])).to.deep.eq([['home', 'Home', 0]])
      expect(heldRealm?.quizzes.map((quiz) => quiz.label)).to.deep.eq(['ht_nested'])
    })
  })

  describe('expressions', () => {
    it('round-trips every field, and belongs to its hunt', async () => {
      const { hunt } = seedQuiz('ex_quiz')
      db.insert(app.expressions, { hunt_id: hunt.id, owner: 'tq', label: 'shout', formula: '$uppercase(qn.title)', description: 'Loud.', position: 3 })
      const [held] = await db.all(app.hunts.where({ id: hunt.id }).include({ expressions: true }))
      expect(held?.expressions.map((expression) => [expression.owner, expression.label, expression.formula, expression.description, expression.position]))
        .to.deep.eq([['tq', 'shout', '$uppercase(qn.title)', 'Loud.', 3]])
    })
  })

  describe('quizzes', () => {
    it('round-trips its own fields, with the optional ones null when omitted', async () => {
      const { quiz } = seedQuiz('qz_plain')
      const [held] = await db.all(app.quizzes.where({ id: quiz.id }))
      expect(_.omit(held, ['id', 'realm_id'])).to.deep.eq({
        title: 'Princes', label: 'qz_plain', forced_label: null, version: 'main', locked: false, last_sortkey: null, bulk_ishes_last: null,
      })
    })

    it('holds a sort memory and a batch run\'s cost, and lets both go back to null', async () => {
      const { quiz } = seedQuiz('qz_memory')
      const run = { approx_tokens: 4200, text_count: 28, updated_at: 1_700_000_000_000 }
      db.update(app.quizzes, quiz.id, { last_sortkey: 'column:clueing', bulk_ishes_last: run, forced_label: 'kings' })
      const [held] = await db.all(app.quizzes.where({ id: quiz.id }))
      expect([held?.last_sortkey, held?.bulk_ishes_last, held?.forced_label]).to.deep.eq(['column:clueing', run, 'kings'])
      db.update(app.quizzes, quiz.id, { last_sortkey: null, bulk_ishes_last: null })
      const [cleared] = await db.all(app.quizzes.where({ id: quiz.id }))
      expect([cleared?.last_sortkey, cleared?.bulk_ishes_last]).to.deep.eq([null, null])
    })

    it('reaches its questions, widgets and columns by relation, ordered by position', async () => {
      const { quiz } = seedQuiz('qz_children')
      db.insert(app.questions, { quiz_id: quiz.id, position: 1, label: 'lear', title: 'Lear', qnum: '', clueing: '', hint: '', full_answer: '', alt_text: '', notes: '' })
      db.insert(app.widgets, { quiz_id: quiz.id, label: 'dumdum', kind: 'botting', bot_label: 'dumdum', textkind: 'clueing', description: '', position: 0 })
      db.insert(app.columns, { quiz_id: quiz.id, label: 'clueing', title: 'Clueing', source: 'question.clueing', width_px: 330, position: 0 })
      const [held] = await db.all(app.quizzes.where({ id: quiz.id }).include({
        questions: app.questions.orderBy('position'), widgets: true, columns: true,
      }))
      expect(held?.questions.map((question) => question.label)).to.deep.eq(['hamlet', 'lear'])
      expect(held?.widgets.map((widget) => widget.label)).to.deep.eq(['dumdum'])
      expect(held?.columns.map((column) => column.label)).to.deep.eq(['clueing'])
    })
  })

  describe('widgets', () => {
    const Kinds = [
      [{ kind: 'expressing', expression_label: 'shout', bot_label: null, textkind: null },   'an expressing, naming its expression'],
      [{ kind: 'botting', expression_label: null, bot_label: 'numnum', textkind: 'hint' },    'a botting, naming its bot and text'],
    ] as const
    for (const [kindFields, describes] of Kinds) {
      it(`round-trips ${describes}`, async () => {
        const { quiz } = seedQuiz(`wd_${kindFields.kind}`)
        const widget = db.insert(app.widgets, { quiz_id: quiz.id, label: 'thing', description: 'Why.', position: 0, ...kindFields }).value
        const [held] = await db.all(app.widgets.where({ id: widget.id }))
        expect(held && sansId(held)).to.deep.eq({ quiz_id: quiz.id, label: 'thing', description: 'Why.', position: 0, ...kindFields })
      })
    }
  })

  describe('columns', () => {
    it('round-trips every field', async () => {
      const { quiz } = seedQuiz('cl_quiz')
      const column = db.insert(app.columns, { quiz_id: quiz.id, label: 'answer', title: 'Answer', source: 'question.full_answer', width_px: 120, position: 2 }).value
      const [held] = await db.all(app.columns.where({ id: column.id }))
      expect(held && sansId(held)).to.deep.eq({ quiz_id: quiz.id, label: 'answer', title: 'Answer', source: 'question.full_answer', width_px: 120, position: 2 })
    })
  })

  describe('questions', () => {
    it('round-trips every field, text kept exactly as written, and chains by label', async () => {
      const { quiz } = seedQuiz('qn_quiz')
      const texts = { clueing: '  *Quoth* the raven,\n\t"千"  ', hint: 'BUT NOT a bird', full_answer: 'Poe', alt_text: 'alt', notes: 'n' }
      const question = db.insert(app.questions, {
        quiz_id: quiz.id, position: 4, label: 'raven', forced_label: 'poe', title: 'Raven', qnum: '3.1', chains_to: 'hamlet', ...texts,
      }).value
      const [held] = await db.all(app.questions.where({ id: question.id }))
      expect(held && sansId(held)).to.deep.eq({
        quiz_id: quiz.id, position: 4, label: 'raven', forced_label: 'poe', title: 'Raven', qnum: '3.1', chains_to: 'hamlet', ...texts,
      })
    })

    it('finds a question by its label within its quiz', async () => {
      const { quiz } = seedQuiz('qn_find')
      const found = await db.all(app.questions.where({ quiz_id: quiz.id, label: 'hamlet' }))
      expect(found.map((question) => question.title)).to.deep.eq(['Hamlet'])
    })
  })

  describe('bottings', () => {
    it('round-trips a numnum reply, its spans held as they came', async () => {
      const { question } = seedQuiz('pl_done')
      const items = [{ text: 'three', value: 3, kind: 'wordish' }, { text: '#17', value: 17, kind: 'numeral' }] as const
      const botting = db.insert(app.bottings, {
        question_id: question.id, bot_label: 'numnum', textkind: 'clueing', asked_text: 'three and #17', status: 'done',
        items: [...items], truncated: false, model_tier_applied: 'careful', approx_tokens: 210,
      }).value
      const [held] = await db.all(app.bottings.where({ id: botting.id }))
      expect(held && sansId(held)).to.deep.eq({
        question_id: question.id, bot_label: 'numnum', textkind: 'clueing', asked_text: 'three and #17', status: 'done',
        reply_text: null, items, message: null, response: null, truncated: false, model_tier_applied: 'careful', approx_tokens: 210,
      })
    })

    it('defaults the spans to none, and holds a failure with the response as it came back', async () => {
      const { question } = seedQuiz('pl_error')
      const response = { error: { kind: 'overloaded', detail: [1, null, 'x'] } }
      const botting = db.insert(app.bottings, {
        question_id: question.id, bot_label: 'dumdum', textkind: 'clueing', status: 'error', message: 'The model was busy.', response, truncated: false,
      }).value
      const [held] = await db.all(app.bottings.where({ id: botting.id }))
      expect([held?.items, held?.message, held?.response]).to.deep.eq([[], 'The model was busy.', response])
    })

    it('are found newest first for one question, bot and text', async () => {
      const { question } = seedQuiz('pl_newest')
      for (const reply_text of ['first', 'second']) {
        db.insert(app.bottings, { question_id: question.id, bot_label: 'dumdum', textkind: 'clueing', status: 'done', reply_text, truncated: false })
        // `$createdAt` counts milliseconds, and two asks of one cell are never closer than that
        await new Promise((resolve) => { setTimeout(resolve, 3) })
      }
      const newest = await db.all(app.bottings.where({ question_id: question.id, bot_label: 'dumdum', textkind: 'clueing' }).orderBy('$createdAt', 'desc').limit(1))
      expect(newest.map((botting) => botting.reply_text)).to.deep.eq(['second'])
    })
  })

  describe('reviews', () => {
    it('round-trips its fields, defaulted empty for a fresh review', async () => {
      const { quiz } = seedQuiz('rv_quiz')
      const ident = db.insert(app.idents, { label: 'reviewer_one', title: 'Reviewer' }).value
      const review = db.insert(app.reviews, { quiz_id: quiz.id, ident_id: ident.id, overall: '', phase: 'empty' }).value
      const [held] = await db.all(app.reviews.where({ id: review.id }))
      expect(held && sansId(held)).to.deep.eq({ quiz_id: quiz.id, ident_id: ident.id, overall: '', phase: 'empty' })
    })

    it('moves through its phases, and holds the overall note it was given', async () => {
      const { quiz } = seedQuiz('rv_phase')
      const ident = db.insert(app.idents, { label: 'reviewer_two', title: 'Reviewer' }).value
      const review = db.insert(app.reviews, { quiz_id: quiz.id, ident_id: ident.id, overall: '', phase: 'empty' }).value
      db.update(app.reviews, review.id, { overall: 'Went well.', phase: 'draft' })
      const [drafted] = await db.all(app.reviews.where({ id: review.id }))
      expect([drafted?.overall, drafted?.phase]).to.deep.eq(['Went well.', 'draft'])
      db.update(app.reviews, review.id, { phase: 'shared' })
      const [shared] = await db.all(app.reviews.where({ id: review.id }))
      expect(shared?.phase).to.eq('shared')
    })
  })
})

// The schema works around these. When a Jazz bump makes one of them pass, the workaround it
// names can go: see `src/db/json-text.ts` and the widgets table.
describe('what this Jazz release cannot hold', () => {
  const Held = Z.object({ aa: Z.int() })
  const optionalJson = JZS.table({ tag: JZS.string(), held: JZS.json(Held).optional() }, {})
  const payloadEnum = JZS.table({ tag: JZS.string(), held: JZS.enum({ one: { xx: JZS.string() } }) }, {})
  const limitsApp = JZS.defineApp(JZS.defineSchema({ optional_json: optionalJson, payload_enum: payloadEnum }))
  const limitsPermissions = JZS.definePermissions(limitsApp, ({ policy }) => {
    policy.optional_json.managedByCreator()
    policy.payload_enum.managedByCreator()
  })

  let testApp: PolicyTestApp
  let db: TestDb
  beforeAll(async () => {
    testApp = await createPolicyTestApp(limitsApp, limitsPermissions, expect)
    db = testApp.as(sessionFor('alice'))
  })
  afterAll(async () => { await testApp.shutdown() })

  it('refuses a value in an optional JSON column (so `jsonText` stores those as text)', () => {
    expect(() => db.insert(limitsApp.optional_json, { tag: 'a', held: { aa: 1 } })).to.throw(/does not match type/)
  })

  it('refuses every insert into a payload-bearing enum (so widgets keep one nullable column per kind)', () => {
    expect(() => db.insert(limitsApp.payload_enum, { tag: 'a', held: { type: 'one', xx: 'b' } })).to.throw(/enum/)
  })
})
