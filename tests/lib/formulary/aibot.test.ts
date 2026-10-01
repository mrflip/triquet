import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AibotFormulary } from '../../../src/lib/formulary/aibot'
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

    it("refuses an input that is a function, which JSONata hands back as a marked object", () => {
      expect(AibotFormulary.input(widgetOf('dumdum', 'function($x) { $x }'), bag).status).to.eq('errored')
    })
  })

  describe('check', () => {
    it('wants a prompt, and an input formula that reads', () => {
      expect(AibotFormulary.check(widgetOf('dumdum'))).to.be.null
      expect(AibotFormulary.check({ ...widgetOf('dumdum'), formula: '  ' })).to.eq('The prompt is empty')
      expect(AibotFormulary.check(widgetOf('dumdum', '{'))).to.match(/^The input formula: /)
      expect(AibotFormulary.check({ ...widgetOf('dumdum'), formula: 'Q: {{clueing' })).to.match(/^The prompt: Unclosed tag/)
    })
  })

  describe('prompt', () => {
    it('is the template rendered over the input', () => {
      expect(AibotFormulary.prompt(widgetOf('dumdum'), bag)).to.deep.eq({ status: 'ok', input: { clueing: 'Who?' }, prompt: 'Question: Who?' })
    })

    it('is missing for an input of nothing', () => {
      expect(AibotFormulary.prompt(widgetOf('dumdum', 'qn.nothing'), bag)).to.deep.eq({ status: 'missing' })
    })

    it('fails, with no input to show, for an input that fails', () => {
      expect(AibotFormulary.prompt(widgetOf('dumdum', 'qn.clueing'), bag)).to.deep.include({ status: 'errored', input: null })
    })

    it('fails, with its input, for a template that does not parse', () => {
      const rendered = AibotFormulary.prompt({ ...widgetOf('dumdum'), formula: '{{#clueing}}' }, bag)
      expect(rendered).to.deep.include({ status: 'errored', input: { clueing: 'Who?' } })
      expect(rendered.status === 'errored' && rendered.message).to.match(/^The prompt: Unclosed section/)
    })

    it('fails for a prompt longer than may be sent', () => {
      const rendered = AibotFormulary.prompt({ ...widgetOf('dumdum', "{ 'clueing': $pad('', 16001, 'x') }") }, bag)
      expect(rendered.status === 'errored' && rendered.message).to.eq('The prompt comes to 16011 characters, more than the 16000 a prompt may run to')
    })

    it('hands the template plain JSON, never a function to call', () => {
      expect(AibotFormulary.prompt({ ...widgetOf('dumdum', "{ 'shout': function($x) { $uppercase($x) } }"), formula: '[{{shout}}]' }, bag)).to.deep.include({ status: 'ok', prompt: '[]' })
    })
  })

  describe('run', () => {
    it('puts the rendered prompt to the route with the widget\'s config, and records the object answered', async () => {
      vi.mocked(askModel).mockResolvedValue({ ok: true, value: { guess: 'Leon', explanation: 'The lion.' }, truncated: false, model_tier_applied: 'quick', approx_tokens: 12 })
      const asked = await AibotFormulary.run(widgetOf('anybody'), widgeting, bag)
      expect(vi.mocked(askModel).mock.calls).to.deep.eq([[{ prompt: 'Question: Who?', servicelabel: 'claude', model_tier: 'quick', max_tokens: 256 }]])
      expect(asked).to.deep.eq({
        input:    { clueing: 'Who?' },
        widgeted: { status: 'ok', value: { guess: 'Leon', explanation: 'The lion.' }, message: null, result_meta: { model_tier_applied: 'quick', approx_tokens: 12, truncated: false } },
      })
    })

    it('records a failure as an errored widgeted, with the author\'s sentence and the reply as it came', async () => {
      vi.mocked(askModel).mockResolvedValue({ ok: false, failurekind: 'rateLimited' })
      const asked = await AibotFormulary.run(widgetOf('dumdum'), widgeting, bag)
      expect(asked?.widgeted).to.deep.eq({ status: 'errored', value: null, message: 'Too many requests right now — try again shortly.', result_meta: { response: { ok: false, failurekind: 'rateLimited' } } })
    })

    it('asks nothing for an input of nothing', async () => {
      const asked = await AibotFormulary.run(widgetOf('dumdum', 'qn.nothing'), widgeting, bag)
      expect(asked).to.be.null
      expect(vi.mocked(askModel).mock.calls).to.have.lengthOf(0)
    })

    it('asks nothing for an input that fails', async () => {
      expect(await AibotFormulary.run(widgetOf('dumdum', 'qn.clueing'), widgeting, bag)).to.be.null
      expect(vi.mocked(askModel).mock.calls).to.have.lengthOf(0)
    })

    it('records a prompt that cannot be sent as a failure, asking nothing', async () => {
      const asked = await AibotFormulary.run({ ...widgetOf('dumdum'), formula: '{{#clueing}}' }, widgeting, bag)
      expect(asked?.widgeted).to.deep.include({ status: 'errored', value: null, result_meta: {} })
      expect(asked?.widgeted.message).to.match(/^The prompt: Unclosed section/)
      expect(vi.mocked(askModel).mock.calls).to.have.lengthOf(0)
    })
  })

  describe('advice', () => {
    it('asks for the prompt, showing what it is filled in from for a real question', () => {
      const text = AibotFormulary.advice(widgetOf('dumdum'), { label: 'dumdum', description: 'The hasty guess.' }, bag)
      expect(text).to.include('- What the widgeting is for in this quiz: The hasty guess.')
      expect(text).to.include('Question: {{clueing}}')
      expect(text).to.include('"clueing": "Who?"')
    })

    it('says in words that the prompt must name the object it wants, and where a later column reads it', () => {
      const text = AibotFormulary.advice(widgetOf('dumdum'), { label: 'dumdum', description: '' }, null)
      expect(text).to.include('the prompt itself has to say in words which object it wants')
      expect(text).to.include('`qn.dumdum.value`')
      expect(text).to.include('send the prompt alone')
    })

    it('asks for a prompt where there is none, and shows no input without a question', () => {
      const text = AibotFormulary.advice({ ...widgetOf(''), formula: '' }, null, null)
      expect(text).to.include('There is no prompt yet')
      expect(text).to.include('I have not written anything down about it yet')
      expect(text).to.not.include('For one real question')
    })
  })
})
