import { describe, expect, it } from 'vitest'
import * as Runner from '../../../src/lib/formulary/runner'
import * as Standins from '../../../src/lib/formulary/standins'
import { BotSlots } from '../../../src/models/botting'
import { Expression, SeedExpressions } from '../../../src/models/expression'
import { defaultLayoutFor } from '../../../src/models/layout'
import { Question } from '../../../src/models/question'
import { Quiz } from '../../../src/models/quiz'
import { Widgeted } from '../../../src/models/widgeted'
import { present } from '../../support/present'
import { Here } from '../../support/places'

describe('BotWidgets', () => {
  it('stands one aibot widget in for each (bot, text) pair the tool puts', () => {
    expect(Standins.BotWidgets.map((widget) => widget.label)).to.deep.eq(['dumdum', 'numnum_clueing', 'numnum_hint'])
    expect(Standins.BotWidgets).to.have.lengthOf(BotSlots.length)
  })

  it("carries each bot's prompt, tier and room, and an input of the text it is put", () => {
    const hint = present(Standins.BotWidgets.find((widget) => widget.label === 'numnum_hint'))
    expect(hint.config).to.deep.eq({ servicelabel: 'claude', model_tier: 'careful', max_tokens: 4000 })
    expect(hint.formula).to.include('Hint: {{hint}}')
    expect(hint.input_formula).to.eq("$trim(qn.hint) != '' ? { 'hint': $trim(qn.hint) }")
  })
})

describe('expressionWidgetOf', () => {
  it('stands a jsonata widget in for an expression, reading the whole bag', () => {
    const widget = Standins.expressionWidgetOf(Expression.fill({ label: 'shout', formula: '$uppercase(qn.title)' }))
    expect(widget).to.deep.eq({ formulary: 'jsonata', label: 'shout', title: '', description: '', formula: '$uppercase(qn.title)', input_formula: '$', config: {} })
  })
})

describe('sourceOf', () => {
  const quiz = { ...Quiz.blank('Standard'), ...defaultLayoutFor(SeedExpressions), questions: [Question.blank()] }
  const source = Standins.sourceOf(quiz, SeedExpressions, Here)

  it("reads a quiz's widgets as its widgetings, in its order, each naming the widget it works", () => {
    expect(source.steps.map(({ widgeting }) => `${widgeting.label}<${widgeting.widget_label}`).slice(0, 4)).to.deep.eq(['dumdum<dumdum', 'numnum_clueing<numnum_clueing', 'numnum_hint<numnum_hint', 'clueing_plus_rank<clueing_plus_rank'])
    expect(source.steps.every(({ widget }) => widget !== null)).to.be.true
  })

  it('names no widget for an expression the hunt no longer holds', () => {
    expect(Standins.sourceOf(quiz, [], Here).steps.find(({ widgeting }) => widgeting.label === 'clueing_full')?.widget).to.be.null
  })

  it("reads a botting's history from the reply its question carries, and nothing for any other widgeting", () => {
    const failure = { message: 'No.', response: { ok: false }, at: 4 }
    const question = { ...Question.blank(), clueing_ishes: { status: 'error' as const, message: 'No.', updated_at: 4, last_err: failure } }
    const numnum = present(source.steps.find(({ widgeting }) => widgeting.label === 'numnum_clueing')).widgeting
    const sum = present(source.steps.find(({ widgeting }) => widgeting.label === 'clueing_full')).widgeting
    expect(Runner.widgetedFrom(source.storedOf(numnum, question))).to.deep.eq(Widgeted.errored({ message: 'No.', at: 4, response: { ok: false } }))
    expect(source.storedOf(sum, question)).to.be.null
    expect(source.storedOf(numnum, Question.blank())).to.be.null
  })
})

describe('bottingOf', () => {
  const [dumdum, numnum] = [present(Standins.BotWidgets[0]), present(Standins.BotWidgets[2])]
  const meta = { model_tier_applied: 'quick', approx_tokens: 12, truncated: true }

  it("records dumdum's answer as its reply, on the cell of the text it was put", () => {
    const asked = { input: { clueing: 'Who?' }, widgeted: { status: 'ok' as const, value: { guess: 'Leon', explanation: 'The lion.' }, message: null, result_meta: meta } }
    expect(Standins.bottingOf(dumdum, 'question_1', asked)).to.deep.include({
      question_id: 'question_1', bot_label: 'dumdum', textkind: 'clueing', asked_text: 'Who?', status: 'done',
      reply_text:  'Leon\nThe lion.', items: [], truncated: true, model_tier_applied: 'quick', approx_tokens: 12,
    })
  })

  it("records dumdum's reply verbatim when the ask kept it", () => {
    const asked = { input: { clueing: 'Who?' }, widgeted: { status: 'ok' as const, value: { guess: '', explanation: 'Leon' }, message: null, result_meta: { ...meta, reply_text: '\nLeon  ' } } }
    expect(Standins.bottingOf(dumdum, 'question_1', asked).reply_text).to.eq('\nLeon  ')
  })

  it("records numnum's answer as its spans", () => {
    const items = [{ text: '3', value: 3, kind: 'numeral' }]
    const asked = { input: { hint: 'Three' }, widgeted: { status: 'ok' as const, value: { items }, message: null, result_meta: {} } }
    expect(Standins.bottingOf(numnum, 'question_1', asked)).to.deep.include({ textkind: 'hint', asked_text: 'Three', items, reply_text: null, model_tier_applied: null, approx_tokens: null })
  })

  it('records a failure with its sentence and the reply as it came', () => {
    const asked = { input: { clueing: 'Who?' }, widgeted: { status: 'errored' as const, value: null, message: 'No.', result_meta: { response: { ok: false } } } }
    expect(Standins.bottingOf(dumdum, 'question_1', asked)).to.deep.include({ status: 'error', message: 'No.', response: { ok: false } })
  })

  it('refuses a widget that is not one of the seeded bots', () => {
    const asked = { input: {}, widgeted: { status: 'errored' as const, value: null, message: 'No.', result_meta: {} } }
    expect(() => Standins.bottingOf({ label: 'somebody' }, 'question_1', asked)).to.throw('not one of the seeded bots')
  })
})
