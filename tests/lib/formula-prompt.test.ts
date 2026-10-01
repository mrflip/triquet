import { describe, expect, it } from 'vitest'
import { formulaPrompt } from '../../src/lib/formula-prompt'

const widgeting = { label: 'letters', title: 'Letters', description: 'For the anagram round.' }
const widget = { label: 'answer_letter_count', description: 'How many letters the answer has.', formula: '$length(qn.full_answer)' }

describe('formulaPrompt', () => {
  it('passes along everything that is filled in', () => {
    const prompt = formulaPrompt({ widgeting, widget, sample: null })
    for (const text of ['Letters', 'letters', 'For the anagram round.', 'answer_letter_count', 'How many letters the answer has.']) {
      expect(prompt).to.include(text)
    }
  })

  it('offers a formula that is present as what there is now, not as a demand, and does not ask for one', () => {
    const prompt = formulaPrompt({ widgeting, widget, sample: null })
    expect(prompt).to.include('Here is what we have now')
    expect(prompt).to.include('$length(qn.full_answer)')
    expect(prompt).to.not.include('There is no formula yet')
  })

  it('asks for a formula when there is none, or only a blank one', () => {
    for (const formula of ['', ' '.repeat(2) + '\n']) {
      const prompt = formulaPrompt({ widgeting, widget: { ...widget, formula }, sample: null })
      expect(prompt).to.include('There is no formula yet. Please write one.')
      expect(prompt).to.not.include('Here is what we have now')
    }
  })

  it('leaves out what is blank, rather than printing an empty line for it', () => {
    const prompt = formulaPrompt({ widgeting: { ...widgeting, description: ' '.repeat(3) }, widget: { ...widget, description: '' }, sample: null })
    expect(prompt).to.not.include('What the widgeting is for')
    expect(prompt).to.not.include('What the widget works out')
    expect(prompt).to.include('The column\'s title: Letters')
  })

  it('still makes a whole prompt with nothing known, saying so', () => {
    const prompt = formulaPrompt({ widgeting: null, widget: null, sample: null })
    expect(prompt).to.include('I have not written anything down about it yet')
    expect(prompt).to.include('There is no formula yet. Please write one.')
  })

  it('always carries the input schema and the output schema', () => {
    const prompt = formulaPrompt({ widgeting: null, widget: null, sample: null })
    expect(prompt).to.include('"qns"')
    expect(prompt).to.include('$$.qn')
    expect(prompt).to.include('"widgeting_label"')
    expect(prompt).to.include('JSON Schema')
  })

  it('tells how to read a widgeted from an earlier column, and no longer how to mark a value stale', () => {
    const prompt = formulaPrompt({ widgeting: null, widget: null, sample: null })
    expect(prompt).to.include('`{ status, value, err }`')
    expect(prompt).to.include('qn.numnum_clueing.value.items')
    expect(prompt).to.not.include('stale')
  })

  it('shows one real input when it is given one, and not otherwise', () => {
    expect(formulaPrompt({ widgeting, widget, sample: { clueing: 'Which region?', rank: 1 } })).to.include('"clueing": "Which region?"')
    expect(formulaPrompt({ widgeting, widget, sample: null })).to.not.include('For example, `qn` for one real question')
  })

  it('asks for the formula alone in the reply, so it pastes straight back in', () => {
    const prompt = formulaPrompt({ widgeting, widget, sample: null })
    expect(prompt).to.include('send the formula alone')
    expect(prompt).to.include('no code fence')
  })

  it('states the length limit the tool enforces', () => {
    expect(formulaPrompt({ widgeting, widget, sample: null })).to.include('At most 999 characters')
  })
})
