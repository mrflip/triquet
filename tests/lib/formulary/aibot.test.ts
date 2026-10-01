import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AibotFormulary, SeededAsks, guessValueOf, textOf } from '../../../src/lib/formulary/aibot'
import * as Runner from '../../../src/lib/formulary/runner'
import { askModel } from '../../../src/lib/ask/port'
import { Question } from '../../../src/models/question'
import { Quiz } from '../../../src/models/quiz'
import type { AibotWidgetT } from '../../../src/models/widget'
import type { WidgetingT } from '../../../src/models/widgeting'
import { present } from '../../support/present'
import { runOf } from '../../support/runs'

vi.mock('../../../src/lib/ask/port')

const question = { ...Question.blank(), qnum: '1', clueing: '  Who?  ', hint: '' }
const run = runOf({ ...Quiz.blank(), questions: [question] })
const bag = present(Runner.bagsAt(run, { label: 'dumdum', params: {} }).get(question._id))

/** A seeded-shaped widget, under `label`, put the clueing */
const widgetOf = (label: string, input_formula = "$trim(qn.clueing) != '' ? { 'clueing': $trim(qn.clueing) }"): AibotWidgetT => ({
  scope:     'pub', formulary: 'aibot', label, title: 'Dumdum', description: '', formula: 'Question: {{clueing}}', input_formula,
  config:    { servicelabel: 'claude', model_tier: 'quick', max_tokens: 256 },
})
const widgeting: WidgetingT = { label: 'dumdum', widget_label: 'dumdum', description: '', params: {} }

describe('AibotFormulary', () => {
  beforeEach(() => { vi.mocked(askModel).mockReset() })

  it('reports the facts of a prompt asked from the cell', () => {
    expect([AibotFormulary.kind, AibotFormulary.defaultInput, AibotFormulary.refresh, AibotFormulary.store]).to.deep.eq(['aibot', "{ 'clueing': qn.clueing }", 'click', 'append'])
    expect(AibotFormulary.config.safeParse({ servicelabel: 'claude', model_tier: 'careful', max_tokens: 4000 }).success).to.be.true
    expect(AibotFormulary.config.safeParse({ servicelabel: 'claude', model_tier: 'careful', max_tokens: 9000 }).success).to.be.false
  })

  describe('input', () => {
    it('is the object the prompt is filled in from', () => {
      expect(AibotFormulary.input(widgetOf('dumdum'), bag)).to.deep.eq({ status: 'ok', input: { clueing: 'Who?' } })
    })

    it('is missing for a blank text, so nothing is asked', () => {
      expect(AibotFormulary.input(widgetOf('numnum_hint', "$trim(qn.hint) != '' ? { 'hint': $trim(qn.hint) }"), bag)).to.deep.eq({ status: 'missing' })
    })

    it('refuses an input that is not an object', () => {
      expect(AibotFormulary.input(widgetOf('dumdum', 'qn.clueing'), bag).status).to.eq('errored')
    })
  })

  describe('check', () => {
    it('wants a prompt, and an input formula that reads', () => {
      expect(AibotFormulary.check(widgetOf('dumdum'))).to.be.null
      expect(AibotFormulary.check({ ...widgetOf('dumdum'), formula: '  ' })).to.eq('The prompt is empty')
      expect(AibotFormulary.check(widgetOf('dumdum', '{'))).to.match(/^The input formula: /)
    })
  })

  describe('run', () => {
    it("puts a seeded widget as the route's fixed ask, with its input's text, and records the answer", async () => {
      vi.mocked(askModel).mockResolvedValue({ ok: true, job: 'guess', text: 'Leon\nThe lion.', truncated: false, model_tier_applied: 'quick', approx_tokens: 12 })
      const asked = await AibotFormulary.run(widgetOf('dumdum'), widgeting, bag)
      expect(vi.mocked(askModel).mock.calls).to.deep.eq([[{ job: 'guess', clueing: 'Who?' }]])
      expect(asked).to.deep.eq({
        input:    { clueing: 'Who?' },
        widgeted: { status: 'ok', value: { guess: 'Leon', explanation: 'The lion.' }, message: null, result_meta: { model_tier_applied: 'quick', approx_tokens: 12, truncated: false, reply_text: 'Leon\nThe lion.' } },
      })
    })

    it("puts numnum's text as an ishes ask, and records its spans", async () => {
      const items = [{ text: '3', value: 3, kind: 'numeral' as const }]
      vi.mocked(askModel).mockResolvedValue({ ok: true, job: 'ishes', items, truncated: true, model_tier_applied: 'careful', approx_tokens: 40 })
      const asked = await AibotFormulary.run(widgetOf('numnum_clueing'), { ...widgeting, label: 'numnum_clueing' }, bag)
      expect(vi.mocked(askModel).mock.calls).to.deep.eq([[{ job: 'ishes', textkind: 'clueing', text: 'Who?' }]])
      expect(asked?.widgeted.value).to.deep.eq({ items })
    })

    it('records a failure as an errored widgeted, with the author\'s sentence and the reply as it came', async () => {
      vi.mocked(askModel).mockResolvedValue({ ok: false, failurekind: 'rateLimited' })
      const asked = await AibotFormulary.run(widgetOf('dumdum'), widgeting, bag)
      expect(asked?.widgeted).to.deep.eq({ status: 'errored', value: null, message: 'Too many requests right now — try again shortly.', result_meta: { response: { ok: false, failurekind: 'rateLimited' } } })
    })

    it('records an answer to another ask as unreadable', async () => {
      vi.mocked(askModel).mockResolvedValue({ ok: true, job: 'ishes', items: [], truncated: false, model_tier_applied: 'careful', approx_tokens: 1 })
      const asked = await AibotFormulary.run(widgetOf('dumdum'), widgeting, bag)
      expect(asked?.widgeted.result_meta).to.deep.eq({ response: { ok: false, failurekind: 'unreadable' } })
    })

    it('asks nothing for an input of nothing', async () => {
      const asked = await AibotFormulary.run(widgetOf('dumdum', 'qn.nothing'), widgeting, bag)
      expect(asked).to.be.null
      expect(vi.mocked(askModel).mock.calls).to.have.lengthOf(0)
    })

    it('records a widget this build cannot ask as unavailable, asking nothing', async () => {
      const asked = await AibotFormulary.run(widgetOf('somebody_else'), widgeting, bag)
      expect(asked?.widgeted.status).to.eq('errored')
      expect(vi.mocked(askModel).mock.calls).to.have.lengthOf(0)
    })
  })

  describe('advice', () => {
    it('asks for the prompt, showing what it is filled in from for a real question', () => {
      const text = AibotFormulary.advice(widgetOf('dumdum'), { label: 'dumdum', description: 'The hasty guess.' }, bag)
      expect(text).to.include('- What the widgeting is for here: The hasty guess.')
      expect(text).to.include('Question: {{clueing}}')
      expect(text).to.include('"clueing": "Who?"')
    })

    it('asks for a prompt where there is none, and shows no input without a question', () => {
      const text = AibotFormulary.advice({ ...widgetOf(''), formula: '' }, null, null)
      expect(text).to.include('There is no prompt yet')
      expect(text).to.include('I have not written anything down about it yet')
      expect(text).to.not.include('For one real question')
    })
  })
})

describe('SeededAsks', () => {
  it('puts the three seeded widgets as the fixed asks the bots answer', () => {
    expect(Object.entries(SeededAsks).map(([label, seeded]) => `${label}:${seeded.job}:${seeded.textkind}`)).to.deep.eq(['dumdum:guess:clueing', 'numnum_clueing:ishes:clueing', 'numnum_hint:ishes:hint'])
  })
})

describe('guessValueOf', () => {
  const Cases: [string, { guess: string, explanation: string }, string][] = [
    ["Leon\nThe lion of the name.",   { guess: 'Leon', explanation: 'The lion of the name.' },  'the guess, then the explanation'],
    ["Leon",                          { guess: 'Leon', explanation: '' },                       'a guess with no explanation'],
    [" Leon \r\n  Two\nlines \n",     { guess: 'Leon', explanation: 'Two\nlines' },             'each part trimmed, the explanation kept whole'],
    ["",                              { guess: '', explanation: '' },                           'nothing at all'],
  ]
  for (const [text, expected, blurb] of Cases) {
    it(blurb, () => {
      expect(guessValueOf(text)).to.deep.eq(expected)
    })
  }
})

describe('textOf', () => {
  it('is the text under the ask\'s textkind, or nothing', () => {
    expect(textOf({ clueing: 'Who?' }, { textkind: 'clueing' })).to.eq('Who?')
    expect(textOf({ clueing: 3 }, { textkind: 'clueing' })).to.eq('')
    expect(textOf({}, { textkind: 'hint' })).to.eq('')
  })
})
