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

  /** A workspace holding one quiz with one question, the parents every other row hangs from */
  function seedQuiz(label: string) {
    const workspace = db.insert(app.workspaces, { active_quiz_id: null }).value
    const quiz = db.insert(app.quizzes, { workspace_id: workspace.id, title: 'Princes', label, version: 'main', locked: false }).value
    db.update(app.workspaces, workspace.id, { active_quiz_id: quiz.id })
    const question = db.insert(app.questions, {
      quiz_id: quiz.id, position: 0, label: 'hamlet', title: 'Hamlet', qnum: '1', clueing: 'Dane, melancholy', hint: '',
      full_answer: 'Hamlet', alt_text: '', notes: '',
    }).value
    return { workspace, quiz, question }
  }

  describe('workspaces', () => {
    it('holds which quiz is open, and reaches it and its siblings by relation', async () => {
      const { workspace } = seedQuiz('ws_open')
      const [held] = await db.all(app.workspaces.where({ id: workspace.id }).include({ active_quiz: true, quizzes: true }))
      expect(held?.active_quiz?.label).to.eq('ws_open')
      expect(held?.quizzes.map((quiz) => quiz.label)).to.deep.eq(['ws_open'])
    })

    it('holds no open quiz as null', async () => {
      const workspace = db.insert(app.workspaces, { active_quiz_id: null }).value
      const [held] = await db.all(app.workspaces.where({ id: workspace.id }))
      expect(held && sansId(held)).to.deep.eq({ active_quiz_id: null })
    })
  })

  describe('expressions', () => {
    it('round-trips every field, and belongs to its workspace', async () => {
      const { workspace } = seedQuiz('ex_quiz')
      db.insert(app.expressions, { workspace_id: workspace.id, owner: 'tq', label: 'shout', formula: '$uppercase(qn.title)', description: 'Loud.', position: 3 })
      const [held] = await db.all(app.workspaces.where({ id: workspace.id }).include({ expressions: true }))
      expect(held?.expressions.map((expression) => [expression.owner, expression.label, expression.formula, expression.description, expression.position]))
        .to.deep.eq([['tq', 'shout', '$uppercase(qn.title)', 'Loud.', 3]])
    })
  })

  describe('quizzes', () => {
    it('round-trips its own fields, with the optional ones null when omitted', async () => {
      const { quiz } = seedQuiz('qz_plain')
      const [held] = await db.all(app.quizzes.where({ id: quiz.id }))
      expect(_.omit(held, ['id', 'workspace_id'])).to.deep.eq({
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
      db.insert(app.widgets, { quiz_id: quiz.id, label: 'dumdum', kind: 'playing', player_label: 'dumdum', textkind: 'clueing', description: '', position: 0 })
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
      [{ kind: 'expressing', expression_label: 'shout', player_label: null, textkind: null },   'an expressing, naming its expression'],
      [{ kind: 'playing', expression_label: null, player_label: 'numnum', textkind: 'hint' },    'a playing, naming its player and text'],
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

  describe('playings', () => {
    it('round-trips a numnum reply, its spans held as they came', async () => {
      const { question } = seedQuiz('pl_done')
      const items = [{ text: 'three', value: 3, kind: 'wordish' }, { text: '#17', value: 17, kind: 'numeral' }] as const
      const playing = db.insert(app.playings, {
        question_id: question.id, player_label: 'numnum', textkind: 'clueing', asked_text: 'three and #17', status: 'done',
        items: [...items], truncated: false, model_tier_applied: 'careful', approx_tokens: 210,
      }).value
      const [held] = await db.all(app.playings.where({ id: playing.id }))
      expect(held && sansId(held)).to.deep.eq({
        question_id: question.id, player_label: 'numnum', textkind: 'clueing', asked_text: 'three and #17', status: 'done',
        reply_text: null, items, message: null, response: null, truncated: false, model_tier_applied: 'careful', approx_tokens: 210,
      })
    })

    it('defaults the spans to none, and holds a failure with the response as it came back', async () => {
      const { question } = seedQuiz('pl_error')
      const response = { error: { kind: 'overloaded', detail: [1, null, 'x'] } }
      const playing = db.insert(app.playings, {
        question_id: question.id, player_label: 'dumdum', textkind: 'clueing', status: 'error', message: 'The model was busy.', response, truncated: false,
      }).value
      const [held] = await db.all(app.playings.where({ id: playing.id }))
      expect([held?.items, held?.message, held?.response]).to.deep.eq([[], 'The model was busy.', response])
    })

    it('are found newest first for one question, player and text', async () => {
      const { question } = seedQuiz('pl_newest')
      for (const reply_text of ['first', 'second']) {
        db.insert(app.playings, { question_id: question.id, player_label: 'dumdum', textkind: 'clueing', status: 'done', reply_text, truncated: false })
        // `$createdAt` counts milliseconds, and two asks of one cell are never closer than that
        await new Promise((resolve) => { setTimeout(resolve, 3) })
      }
      const newest = await db.all(app.playings.where({ question_id: question.id, player_label: 'dumdum', textkind: 'clueing' }).orderBy('$createdAt', 'desc').limit(1))
      expect(newest.map((playing) => playing.reply_text)).to.deep.eq(['second'])
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
